import { Vec2, add, angleDiffDeg, bearingOf, courseSpeedOf, normalizeDeg, scale, sub, velocityOf, length, CourseSpeed } from "../core/vec";
import { MAX_ROUTE_WAYPOINTS, turnRadiusNm, waypointReached, wheelOverDistance } from "../core/route";
import { TurnProfile } from "../core/trial";
import { CoastEdge, CoastSample, Coast, Scenario, Target, World } from "./types";
import { targetTypeById } from "./targets";
import { courseToSteer, tidalStreamRate } from "../core/current";
import { autopilotRudder, rudderRate, shipTypeById, stepShip } from "../core/shipmodel";
import { DEFAULT_SWELL_PERIOD_S, combineResponses, seawayResponse, seawayResponseH, waveHeightM } from "../core/seaway";
import { SeaComponent, WAVE_LOSS_MIN_LENGTH_M, displacementFromLength, displacementM3, lossAfterSeaMargin, seasSpeedLoss, waveDriftKn } from "../core/waves";
import { TidalDiamond, TideHeights, streamAt, tideHeightM } from "../core/tide";
import { AREA_TIDES } from "./area-tides";
import { stepRadarPower } from "./power";
import { TerrainGrid, landHeightAt, unpackTerrain } from "./terrain";
import { REAL_TERRAIN } from "./real-terrain";
import { MUMBAI_ORIGIN } from "./real-coasts";
import { DepthGrid, depthOnGrid, unpackDepths } from "./depth";
import { REAL_DEPTHS } from "./real-depths";
import { SEA_MARK_FIRST_ID, SeaMark, seaMarkEchoes } from "./seamarks";
import { REAL_SEAMARKS } from "./real-seamarks";
import { isLandAt } from "./terrain";
import { pointInPolygon } from "../core/nav";

const terrainCache = new Map<string, TerrainGrid>();
/** The terrain grid of a real area, unpacked once. Null when there is no data for it. */
export function terrainById(id: string | undefined): TerrainGrid | null {
  if (!id) return null;
  const hit = terrainCache.get(id);
  if (hit) return hit;
  const packed = REAL_TERRAIN[id];
  if (!packed) return null;
  const g = unpackTerrain(packed);
  terrainCache.set(id, g);
  return g;
}

const depthCache = new Map<string, DepthGrid>();
/** The approximate depths of a real area (engine/depth.ts), unpacked once. Null when there are none for it. */
export function depthGridById(id: string | undefined): DepthGrid | null {
  if (!id) return null;
  const hit = depthCache.get(id);
  if (hit) return hit;
  const packed = REAL_DEPTHS[id];
  if (!packed) return null;
  const g = unpackDepths(packed);
  depthCache.set(id, g);
  return g;
}

/**
 * The depth of water at a point, metres, as far as the simulator knows it: the real area's approximate depths, made
 * no deeper than any shallow area the scenario draws (`World.depths`). Null where nothing is known (drawn scenarios
 * away from their shallow areas, or outside the real area's grid). A guide for the echo sounder and the picture:
 * it never grounds the ship.
 */
export function depthAt(w: World, p: Vec2): number | null {
  const g = depthGridById(w.area);
  let d = g ? depthOnGrid(g, p) : null;
  for (const a of w.depths) if (pointInPolygon(p, a.points)) d = d === null ? a.depthM : Math.min(d, a.depthM);
  return d;
}

/** The buoys, beacons and lights of a real area (engine/seamarks.ts); empty when there are none. */
export function seaMarksOf(id: string | undefined): SeaMark[] {
  return (id && REAL_SEAMARKS[id]) || [];
}

/**
 * Height of the coast at a shoreline point, from the terrain: the highest ground within `reachNm`
 * of it (the land the radar sees rising behind the water's edge).
 */
export function shorelineHeightM(g: TerrainGrid, p: Vec2, reachNm = 0.15): number {
  let best = 0;
  for (let dy = -reachNm; dy <= reachNm + 1e-9; dy += reachNm / 3) {
    for (let dx = -reachNm; dx <= reachNm + 1e-9; dx += reachNm / 3) {
      const h = landHeightAt(g, { e: p.e + dx, n: p.n + dy });
      if (h !== null && h > best) best = h;
    }
  }
  return best;
}

export const COAST_SAMPLE_SPACING_NM = 0.025;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/**
 * Movement of the water over the ground now at a point (own ship's position when left out): the steady current, plus
 * the simple tidal stream, plus the tidal streams of the diamonds when the tide is set.
 */
export function currentVelocity(w: World, p?: Vec2): Vec2 {
  let v = velocityOf({ course: w.env.current.set, speed: w.env.current.drift });
  const t = w.env.tidal;
  if (t && t.maxRateKn !== 0) v = add(v, scale(velocityOf({ course: t.floodSet, speed: 1 }), tidalStreamRate(t.maxRateKn, t.hoursAfterSlackAtStart + w.time / 3600)));
  const tide = w.env.tide;
  if (tide && tide.streams !== false) {
    const d = tidalDiamondsOf(w);
    if (d.length) v = add(v, streamAt(d, p ?? w.own.pos, tideClockH(w), tide.springs));
  }
  return v;
}

/** Hours from high water at the reference port now (the tide's clock); 0 when no tide is set. */
export function tideClockH(w: World): number {
  return w.env.tide ? w.env.tide.hwAtStartH + w.time / 3600 : 0;
}

/** The tidal diamonds in use: the scenario's own, else the real area's (invented); none without a tide. */
export function tidalDiamondsOf(w: World): TidalDiamond[] {
  const t = w.env.tide;
  if (!t) return [];
  return t.diamonds ?? (w.area ? AREA_TIDES[w.area]?.diamonds : undefined) ?? [];
}

/** The tide heights in use: the scenario's own, else the real area's (invented); null without a tide. */
export function tideHeightsOf(w: World): TideHeights | null {
  const t = w.env.tide;
  if (!t) return null;
  return t.heights ?? (w.area ? AREA_TIDES[w.area]?.heights : undefined) ?? null;
}

/** Height of the tide above chart datum now, metres; null when no tide is set or no heights are known. */
export function tideHeightNow(w: World): number | null {
  const h = tideHeightsOf(w);
  return h && w.env.tide ? tideHeightM(h, tideClockH(w), w.env.tide.springs) : null;
}

/**
 * Depth of water now at a point: the charted depth (depthAt) plus the height of the tide. The real areas' depths are
 * taken as charted depths below chart datum (they are approximate and relative to mean sea level: PLACEHOLDER).
 */
export function waterDepthAt(w: World, p: Vec2): number | null {
  const d = depthAt(w, p);
  if (d === null) return null;
  return d + (tideHeightNow(w) ?? 0);
}

/** The seas running: the wind sea (from the sea state and the wind's direction) and the swell. */
export function seasOf(w: World): SeaComponent[] {
  const out: SeaComponent[] = [];
  const h = waveHeightM(w.env.seaState);
  if (h > 0) out.push({ fromDeg: seaFromDeg(w), heightM: h });
  const sw = w.env.swell;
  if (sw && sw.heightM > 0) out.push({ fromDeg: sw.from, heightM: sw.heightM });
  return out;
}

/** Own ship velocity over the ground: water velocity plus current. */
/** Own ship's velocity through the water: ahead speed along the heading plus, with a ship model, the sideways speed. */
export function ownWaterVelocity(w: World): Vec2 {
  const ahead = velocityOf({ course: w.own.heading, speed: w.own.speedThroughWater });
  const m = w.own.model;
  return m ? add(ahead, velocityOf({ course: w.own.heading + 90, speed: m.motion.v })) : ahead;
}

export function ownGroundVelocity(w: World): Vec2 {
  const an = w.own.anchor;
  if (an) return velocityOf({ course: an.dragSet, speed: an.dragKn });
  return add(ownWaterVelocity(w), currentVelocity(w));
}

/**
 * How own ship would come round by `dCourseDeg` (the shorter way) and change speed by `dSpeedKn`, from now,
 * with her own handling: the ship model under its autopilot, or the simple ship's rate of turn and
 * acceleration. Her heading and speed change every `stepSec` seconds until she is steady (at most
 * `maxSec`). Used by the trial manoeuvre, which must include own ship's dynamic characteristics.
 */
export function ownTurnProfile(w: World, dCourseDeg: number, dSpeedKn: number, stepSec = 5, maxSec = 1800): TurnProfile {
  const o = w.own;
  const dH: number[] = [0];
  const dS: number[] = [0];
  let h = 0;
  if (o.model) {
    const type = shipTypeById(o.model.typeId);
    let m = { ...o.model.motion };
    const u0 = m.u;
    const units = o.model.steeringUnits ?? 1;
    for (let t = stepSec; t <= maxSec; t += stepSec) {
      const rudder = autopilotRudder(type, angleDiffDeg(dCourseDeg, h), m.r, m.u);
      m = stepShip(type, m, { rudder, speed: Math.max(0, u0 + dSpeedKn), rudderRateDegPerSec: rudderRate(units) }, null, stepSec);
      h += m.r * stepSec;
      dH.push(h);
      dS.push(m.u - u0);
      if (Math.abs(dCourseDeg - h) < 0.5 && Math.abs(m.r) < 0.05 && Math.abs(m.u - u0 - dSpeedKn) < 0.2) break;
    }
  } else {
    let sp = 0;
    for (let t = stepSec; t <= maxSec; t += stepSec) {
      h += clamp(dCourseDeg - h, -o.turnRateDegPerSec * stepSec, o.turnRateDegPerSec * stepSec);
      sp += clamp(dSpeedKn - sp, -o.accelKnPerSec * stepSec, o.accelKnPerSec * stepSec);
      dH.push(h);
      dS.push(sp);
      if (Math.abs(dCourseDeg - h) < 1e-9 && Math.abs(dSpeedKn - sp) < 1e-9) break;
    }
  }
  return { stepSec, dHeadingDeg: dH, dSpeedKn: dS };
}

/** Most speed over the ground at which the anchor may be let go, knots (this simulator's limit). */
export const ANCHOR_MAX_SOG_KN = 1;

/**
 * Let go the anchor. Refused (returns false) when the ship is still making more than
 * ANCHOR_MAX_SOG_KN over the ground or is already at anchor. The engine is stopped.
 */
export function letGoAnchor(w: World): boolean {
  const o = w.own;
  if (o.anchor || length(ownGroundVelocity(w)) > ANCHOR_MAX_SOG_KN + 1e-9) return false;
  o.anchor = { pos: { ...o.pos }, dragKn: 0, dragSet: 0, since: w.time };
  o.ordered.speed = 0;
  o.speedThroughWater = 0;
  if (o.model) o.model.motion = { ...o.model.motion, u: 0, v: 0, r: 0, engine: 0 };
  return true;
}

/** Weigh the anchor: the ship is free again, stopped in the water. */
export function weighAnchor(w: World): void {
  delete w.own.anchor;
}

/** Instructor fault: the anchor drags at `kn` knots (0 stops it) towards `set` (default: with the current, else the wind, else 180). */
export function setAnchorDrag(w: World, kn: number, set?: number): void {
  const an = w.own.anchor;
  if (!an) return;
  const cur = courseSpeedOf(currentVelocity(w));
  an.dragKn = Math.max(0, kn);
  an.dragSet = set ?? (cur.speed > 0.05 ? cur.course : w.env.wind ? normalizeDeg(w.env.wind.from + 180) : 180);
}

/**
 * Relative (apparent) wind as felt on board: `head` knots from ahead, `beam` knots from the port
 * side (negative: from starboard), and as a direction off the bow (0-360, clockwise) and speed.
 */
export function relativeWind(w: World): { head: number; beam: number; fromRel: number; speedKn: number } | null {
  return apparentWind(w, w.own.heading, ownGroundVelocity(w));
}

/** Apparent wind on a vessel with the given heading and velocity over the ground. */
export function apparentWind(w: World, heading: number, groundVel: Vec2): { head: number; beam: number; fromRel: number; speedKn: number } | null {
  const wind = w.env.wind;
  if (!wind || wind.speedKn <= 0) return null;
  const air = sub(velocityOf({ course: wind.from + 180, speed: wind.speedKn }), groundVel);
  const f = velocityOf({ course: heading, speed: 1 });
  const s = velocityOf({ course: heading + 90, speed: 1 });
  const fwd = air.e * f.e + air.n * f.n;
  const stbd = air.e * s.e + air.n * s.n;
  // The air moves aft when the wind is from ahead, and to starboard when it is from the port side.
  return { head: -fwd, beam: stbd, fromRel: normalizeDeg((Math.atan2(-stbd, -fwd) * 180) / Math.PI), speedKn: Math.hypot(fwd, stbd) };
}

/** Give own ship a manoeuvring model (or change its type), keeping her present motion. */
export function setShipModel(w: World, typeId: string): void {
  const o = w.own;
  const prev = o.model;
  o.model = {
    typeId: shipTypeById(typeId).id,
    steering: prev?.steering ?? "auto",
    rudderOrder: prev?.rudderOrder ?? 0,
    motion: prev?.motion ?? { u: o.speedThroughWater, v: 0, r: 0, rudder: 0, engine: o.ordered.speed },
    steeringUnits: prev?.steeringUnits ?? 1,
  };
}

export function ownCogSog(w: World): CourseSpeed {
  return courseSpeedOf(ownGroundVelocity(w));
}

export function buildCoast(coasts: Coast[]): { edges: CoastEdge[]; samples: CoastSample[] } {
  const edges: CoastEdge[] = [];
  const samples: CoastSample[] = [];
  for (const c of coasts) {
    const n = c.points.length;
    const count = c.closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const a = c.points[i]!;
      const b = c.points[(i + 1) % n]!;
      const edgeIndex = edges.length;
      edges.push({ a, b, heightM: c.heightM ?? 60 });
      const len = length(sub(b, a));
      const steps = Math.max(1, Math.round(len / COAST_SAMPLE_SPACING_NM));
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        samples.push({ pos: { e: a.e + (b.e - a.e) * f, n: a.n + (b.n - a.n) * f }, edge: edgeIndex, heightM: c.heightM ?? 60 });
      }
    }
  }
  return { edges, samples };
}

export function createWorld(sc: Scenario, tuningOptimum = 62): World {
  const { edges, samples } = buildCoast(sc.coasts);
  const terrain = terrainById(sc.terrain);
  // With terrain, the shoreline (used by the ARPA's land plots) takes its height from the ground behind it.
  if (terrain) {
    for (const s of samples) s.heightM = shorelineHeightM(terrain, s.pos);
    for (const e of edges) e.heightM = Math.max(shorelineHeightM(terrain, e.a), shorelineHeightM(terrain, e.b));
  }
  return {
    ...(terrain ? { terrain } : {}),
    ...(sc.terrain ? { area: sc.terrain } : {}),
    ...(sc.traffic && sc.traffic !== "hold"
      ? { traffic: { mode: sc.traffic, wrongId: null, ships: {}, log: [], ...(sc.traffic === "careless" || sc.traffic === "hunting" ? { chase: { id: sc.trafficShip ?? null, corrections: 0, nextLook: 0, over: false } } : {}) } }
      : {}),
    origin: sc.origin ?? MUMBAI_ORIGIN,
    time: 0,
    own: {
      pos: sc.own.pos ?? { e: 0, n: 0 },
      heading: sc.own.heading,
      speedThroughWater: sc.own.speed,
      ordered: { course: sc.own.heading, speed: sc.own.speed },
      antennaHeight: 18,
      turnRateDegPerSec: 2,
      accelKnPerSec: 0.1,
    },
    targets: [...sc.targets, ...(sc.seaMarks && sc.terrain ? seaMarkEchoes(seaMarksOf(sc.terrain), SEA_MARK_FIRST_ID, (p) => (terrain ? isLandAt(terrain, p) : false)).filter((m) => !sc.targets.some((t) => t.id === m.id)) : [])].map((t) => {
      const { motion: _m, route, ...rest } = t as Target;
      const tgt: Target = { ...rest, pos: { ...t.pos }, events: [...t.events].sort((a, b) => a.atSeconds - b.atSeconds), nextEvent: 0 };
      initTargetMotion(tgt);
      if (route) setTargetRoute(tgt, route.points, route.speeds);
      return tgt;
    }),
    coasts: sc.coasts,
    edges,
    coastSamples: samples,
    env: {
      current: sc.env.current ?? { set: 0, drift: 0 },
      seaState: sc.env.seaState ?? 3,
      ducting: sc.env.ducting ?? false,
      refraction: sc.env.refraction ?? "standard",
      rain: sc.env.rain ? sc.env.rain.map((r) => ({ ...r })) : [],
      interference: sc.env.interference ?? false,
      ...(sc.env.tidal ? { tidal: { ...sc.env.tidal } } : {}),
      ...(sc.env.swell ? { swell: { ...sc.env.swell } } : {}),
      ...(sc.env.tide ? { tide: copyTide(sc.env.tide) } : {}),
      ...(sc.env.wind ? { wind: { ...sc.env.wind } } : {}),
      ...(sc.env.visibilityNm !== undefined && sc.env.visibilityNm > 0 ? { visibilityNm: sc.env.visibilityNm } : {}),
    },
    radar: {
      controls: { rangeNm: 6, gain: 50, tuning: 50, stc: 0, ftc: 0, brilliance: 70 },
      tuningOptimum,
      // Mast / funnel shadow dead astern.
      shadowSectors: [{ from: 176, to: 184 }],
      rpm: 24,
      band: "X",
    },
    sensors: { gyroErrorDeg: 0, logErrorKn: 0, rampPerMin: { gyroDeg: 1, logKn: 1 } },
    hazards: (sc.hazards ?? []).map((h) => ({ ...h, center: { ...h.center } })),
    route: (sc.route ?? []).map((p) => ({ ...p })),
    tss: (sc.tss ?? []).map((t) => ({ ...t, a: { ...t.a }, b: { ...t.b } })),
    depths: (sc.depths ?? []).map((d) => ({ ...d, points: d.points.map((p) => ({ ...p })) })),
    structures: (sc.structures ?? []).map((s) => ({ ...s, a: { ...s.a }, b: { ...s.b } })),
  };
}

/** A deep copy of a tide setting (its diamonds and heights are not shared with the scenario). */
export function copyTide(t: NonNullable<Scenario["env"]["tide"]>): NonNullable<Scenario["env"]["tide"]> {
  return {
    ...t,
    ...(t.diamonds ? { diamonds: t.diamonds.map((d) => ({ ...d, pos: { ...d.pos }, hours: d.hours.map((h) => ({ ...h })) })) } : {}),
    ...(t.heights ? { heights: { ...t.heights } } : {}),
  };
}

/** Advance the simulation by dtSec seconds. */
export function stepWorld(w: World, dtSec: number): void {
  stepRadarPower(w);
  const o = w.own;
  if (o.anchor) {
    // At anchor: engine stopped, heading held, no way through the water.
    o.ordered.speed = 0;
    o.speedThroughWater = 0;
    if (o.model) o.model.motion = { ...o.model.motion, u: 0, v: 0, r: 0, engine: 0 };
  } else if (o.model) {
    const type = shipTypeById(o.model.typeId);
    const m0 = o.model.motion;
    const rudder = o.model.steering === "auto" ? autopilotRudder(type, angleDiffDeg(o.ordered.course, o.heading), m0.r, m0.u) : o.model.rudderOrder;
    const seas = seasOf(w);
    const sea = seas.length
      ? { loss: lossAfterSeaMargin(seasSpeedLoss(seas, o.heading, displacementM3(type.lengthM, type.beamM, type.draughtM, type.blockCoeff))), driftKn: waveDriftKn(seas, o.heading, type.lengthM) }
      : undefined;
    const m = stepShip(type, m0, { rudder, speed: o.ordered.speed, rudderRateDegPerSec: rudderRate(o.model.steeringUnits ?? 1) }, relativeWind(w), dtSec, sea);
    o.model.motion = m;
    o.heading = normalizeDeg(o.heading + m.r * dtSec);
    o.speedThroughWater = m.u;
    if (o.model.steering === "hand") o.ordered.course = o.heading;
  } else {
    const diff = angleDiffDeg(o.ordered.course, o.heading);
    const maxTurn = o.turnRateDegPerSec * dtSec;
    o.heading = normalizeDeg(o.heading + clamp(diff, -maxTurn, maxTurn));
    const dv = o.ordered.speed - o.speedThroughWater;
    const maxDv = o.accelKnPerSec * dtSec;
    o.speedThroughWater = Math.max(0, o.speedThroughWater + clamp(dv, -maxDv, maxDv));
  }

  stepSeaway(w, dtSec);
  o.pos = add(o.pos, scale(ownGroundVelocity(w), dtSec / 3600));

  const sn = w.sensors;
  if (sn.target) {
    const k = dtSec / 60;
    sn.gyroErrorDeg += clamp(sn.target.gyroErrorDeg - sn.gyroErrorDeg, -sn.rampPerMin.gyroDeg * k, sn.rampPerMin.gyroDeg * k);
    sn.logErrorKn += clamp(sn.target.logErrorKn - sn.logErrorKn, -sn.rampPerMin.logKn * k, sn.rampPerMin.logKn * k);
  }

  const tNext = w.time + dtSec;
  for (const t of w.targets) {
    while (t.nextEvent < t.events.length && t.events[t.nextEvent]!.atSeconds <= tNext) {
      const ev = t.events[t.nextEvent]!;
      if (ev.course !== undefined) clearTargetRoute(t);
      orderTarget(t, ev);
      t.nextEvent++;
    }
    if (t.route) followRoute(t);
    const m = t.motion;
    const type = m ? targetTypeById(t.typeId) : undefined;
    if (t.atAnchor) {
      // Held by her anchor: no way, and not set by the current.
      if (m) {
        m.stw = 0;
        m.drift = { e: 0, n: 0 };
      }
      t.speed = 0;
    } else if (m && type) {
      // Catalogue type: steers through the water, turns and changes speed gradually, set by the current, blown by the wind.
      const turn = type.turnDegPerSec * dtSec;
      m.heading = normalizeDeg(m.heading + clamp(angleDiffDeg(m.orderedCourse, m.heading), -turn, turn));
      const dv = type.accelKnPerSec * dtSec;
      // In waves she cannot make her ordered speed (core/waves.ts), and a beam sea pushes her sideways.
      const seas = seasOf(w);
      // Ships only: the method is not for small craft (core/waves.ts).
      const loss = seas.length && type.kind === "ship" && type.lengthM >= WAVE_LOSS_MIN_LENGTH_M ? lossAfterSeaMargin(seasSpeedLoss(seas, m.heading, displacementFromLength(type.lengthM))) : 0;
      m.stw = Math.max(0, m.stw + clamp(m.orderedSpeed * (1 - loss) - m.stw, -dv, dv));
      let ground = add(velocityOf({ course: m.heading, speed: m.stw }), currentVelocity(w, t.pos));
      if (seas.length && m.stw > 0) ground = add(ground, velocityOf({ course: m.heading + 90, speed: waveDriftKn(seas, m.heading, type.lengthM) }));
      const aw = apparentWind(w, m.heading, ground);
      if (aw) ground = add(ground, velocityOf({ course: m.heading + 90, speed: type.leeway * aw.beam }));
      m.drift = sub(ground, velocityOf({ course: m.heading, speed: m.stw }));
      const cs = courseSpeedOf(ground);
      t.speed = cs.speed;
      t.course = cs.speed > 0.01 ? cs.course : m.heading;
      t.pos = add(t.pos, scale(ground, dtSec / 3600));
    } else {
      t.pos = add(t.pos, scale(velocityOf({ course: t.course, speed: t.speed }), dtSec / 3600));
    }
  }
  w.time = tNext;
}

/**
 * Order a target to a new course and/or speed. A catalogue-type target comes round and changes
 * speed gradually; any other target changes at once.
 */
export function orderTarget(t: Target, o: { course?: number; speed?: number }): void {
  if (o.speed !== undefined && o.speed > 0) delete t.atAnchor;
  if (t.motion) {
    if (o.course !== undefined) t.motion.orderedCourse = normalizeDeg(o.course);
    if (o.speed !== undefined) t.motion.orderedSpeed = Math.max(0, o.speed);
  } else {
    if (o.course !== undefined) t.course = normalizeDeg(o.course);
    if (o.speed !== undefined) t.speed = Math.max(0, o.speed);
  }
}

/** With no wind set, the sea is taken to come from this direction, degrees true (an arbitrary choice). */
export const DEFAULT_SEA_FROM_DEG = 270;

/** Direction the sea comes FROM, degrees true: the wind's direction when a wind is set. */
export function seaFromDeg(w: World): number {
  const wind = w.env.wind;
  return wind && wind.speedKn > 0 ? wind.from : DEFAULT_SEA_FROM_DEG;
}

/**
 * Roll, pitch, heave and yaw of own ship in the sea that is running. Only a ship with a manoeuvring
 * model moves; the exercise ship (fixed rates) stays steady so that plotting exercises are not disturbed.
 * The yaw is put on the heading itself, so the gyro, the picture and the autopilot all feel it.
 */
function stepSeaway(w: World, dtSec: number): void {
  const o = w.own;
  const swell = w.env.swell && w.env.swell.heightM > 0 ? w.env.swell : null;
  if (!o.model || (w.env.seaState <= 0 && !swell)) {
    if (o.seaway) {
      o.heading = normalizeDeg(o.heading - o.seaway.yawDeg);
      delete o.seaway;
    }
    return;
  }
  const sw = o.seaway ?? (o.seaway = { rollDeg: 0, pitchDeg: 0, yawDeg: 0, heaveM: 0, rollPhase: 0, encounterPhase: 0 });
  const L = shipTypeById(o.model.typeId).lengthM;
  const r = combineResponses(
    seawayResponse(w.env.seaState, normalizeDeg(seaFromDeg(w) - o.heading), o.speedThroughWater, L),
    swell ? seawayResponseH(swell.heightM, swell.periodS ?? DEFAULT_SWELL_PERIOD_S, normalizeDeg(swell.from - o.heading), o.speedThroughWater, L) : null,
  );
  sw.rollPhase += (2 * Math.PI * dtSec) / r.rollPeriodS;
  if (r.encounterPeriodS > 0) sw.encounterPhase += (2 * Math.PI * dtSec) / r.encounterPeriodS;
  sw.rollDeg = r.rollDeg * Math.sin(sw.rollPhase);
  sw.pitchDeg = r.pitchDeg * Math.sin(sw.encounterPhase);
  sw.heaveM = r.heaveM * Math.cos(sw.encounterPhase);
  const yaw = r.yawDeg * Math.sin(sw.encounterPhase + 1);
  o.heading = normalizeDeg(o.heading + yaw - sw.yawDeg);
  sw.yawDeg = yaw;
  if (o.model.steering === "hand") o.ordered.course = o.heading; // in hand steering the autopilot's course follows the heading
}

/** A target without a turning circle alters at the waypoint; this is how close counts as "at", NM. */
export const ROUTE_ARRIVAL_NM = 0.02;

/**
 * Programme a route for a target: it steers for each waypoint in turn and carries on as it goes
 * after the last. `speeds[i]` is ordered when the leg to waypoint i begins. Returns false (and
 * changes nothing) for a fixed object or an empty list. Waypoints beyond MAX_ROUTE_WAYPOINTS are dropped.
 */
export function setTargetRoute(t: Target, points: Vec2[], speeds?: (number | null)[]): boolean {
  if (t.kind === "buoy" || t.kind === "beacon" || points.length === 0) return false;
  const pts = points.slice(0, MAX_ROUTE_WAYPOINTS).map((p) => ({ ...p }));
  t.route = { points: pts, next: 0, from: { ...t.pos }, ...(speeds ? { speeds: speeds.slice(0, pts.length) } : {}) };
  const first = speeds?.[0];
  if (first !== null && first !== undefined) orderTarget(t, { speed: first });
  followRoute(t);
  return true;
}

/** Take a target off its route: it keeps the course and speed it has now. */
export function clearTargetRoute(t: Target): void {
  delete t.route;
}

/** Waypoints of a target's route still ahead of it (empty when it has no route or has finished it). */
export function routeAhead(t: Target): Vec2[] {
  const r = t.route;
  return r ? r.points.slice(r.next ?? 0) : [];
}

/** Move on to the next waypoint when the present one is reached, and steer for the waypoint ahead. */
function followRoute(t: Target): void {
  const r = t.route;
  if (!r) return;
  const type = t.motion ? targetTypeById(t.typeId) : undefined;
  let next = r.next ?? 0;
  while (next < r.points.length) {
    const wp = r.points[next]!;
    const from = r.from ?? t.pos;
    let arrive = ROUTE_ARRIVAL_NM;
    const after = r.points[next + 1];
    if (after && t.motion && type) {
      // A ship with a turning circle puts the wheel over early, to come out of the turn on the next leg;
      // never earlier than half way along the leg, so a tight track is cut short, not skipped.
      const turn = angleDiffDeg(bearingOf(sub(after, wp)), bearingOf(sub(wp, from)));
      const wheelOver = wheelOverDistance(turn, turnRadiusNm(t.motion.stw, type.turnDegPerSec));
      arrive = Math.max(arrive, Math.min(wheelOver, length(sub(wp, from)) / 2));
    }
    if (!waypointReached(t.pos, from, wp, arrive)) break;
    r.from = { ...wp };
    next++;
    const sp = r.speeds?.[next];
    if (next < r.points.length && sp !== null && sp !== undefined) orderTarget(t, { speed: sp });
  }
  r.next = next;
  const ahead = r.points[next];
  if (ahead) {
    const v = sub(ahead, t.pos);
    if (length(v) > 1e-6) {
      // A ship set by the current or blown by the wind steers off the line by the allowance that
      // makes good the track to the waypoint (current triangle); if it cannot hold the track it steers for the point.
      const d = t.motion?.drift ? courseSpeedOf(t.motion.drift) : null;
      const cts = t.motion && d && d.speed > 0.01 ? courseToSteer(bearingOf(v), t.motion.stw, { set: d.course, drift: d.speed }) : null;
      orderTarget(t, { course: cts ? cts.heading : bearingOf(v) });
    }
  }
}

/** Give a target the motion of its catalogue type (nothing for fixed objects or targets without a type). */
export function initTargetMotion(t: Target): void {
  const type = targetTypeById(t.typeId);
  if (type && !type.fixed && !t.motion) t.motion = { heading: t.course, stw: t.speed, orderedCourse: t.course, orderedSpeed: t.speed };
}

/**
 * The way a target's bow points, degrees true. A catalogue-type target steers its own heading. A plain
 * target is given its course and speed OVER THE GROUND, so where there is a current its bow points along
 * its course THROUGH THE WATER (its ground velocity less the current; leeway is not modelled for plain
 * targets): the heading a sea-stabilised display shows by the target's movement (Radar and ARPA Manual,
 * 3rd edition, 1.5.2.1), and the one its AIS sends. A plain target that is not moving through the water
 * keeps the course it was given.
 */
export function targetHeading(w: World, t: Target): number {
  if (t.motion) return t.motion.heading;
  if (t.atAnchor || t.speed === 0) return t.course;
  const water = sub(velocityOf({ course: t.course, speed: t.speed }), currentVelocity(w, t.pos));
  return length(water) < 0.1 ? t.course : bearingOf(water);
}

/** Length used for a target that does not state one, metres (placeholder values by kind). */
export function targetLengthM(t: { kind: string; lengthM?: number }): number {
  if (t.lengthM !== undefined) return t.lengthM;
  return t.kind === "ship" ? 120 : t.kind === "small-craft" ? 15 : 0;
}

/** Heading as the gyro reports it (true heading plus the gyro error). */
export function measuredHeading(w: World): number {
  return normalizeDeg(w.own.heading + w.sensors.gyroErrorDeg);
}

/** Speed through the water as the log reports it. */
export function logSpeed(w: World): number {
  return Math.max(0, w.own.speedThroughWater + w.sensors.logErrorKn);
}

export function rangeBearingFromOwn(w: World, p: Vec2): { range: number; trueBearing: number } {
  const v = sub(p, w.own.pos);
  return { range: length(v), trueBearing: normalizeDeg(Math.atan2(v.e, v.n) * (180 / Math.PI)) };
}
