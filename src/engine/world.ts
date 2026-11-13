import { Vec2, add, angleDiffDeg, bearingOf, courseSpeedOf, normalizeDeg, scale, sub, velocityOf, length, CourseSpeed } from "../core/vec";
import { MAX_ROUTE_WAYPOINTS, turnRadiusNm, waypointReached, wheelOverDistance } from "../core/route";
import { CoastEdge, CoastSample, Coast, Scenario, Target, World } from "./types";
import { targetTypeById } from "./targets";
import { courseToSteer, tidalStreamRate } from "../core/current";
import { autopilotRudder, rudderRate, shipTypeById, stepShip } from "../core/shipmodel";
import { seawayResponse } from "../core/seaway";
import { stepRadarPower } from "./power";
import { TerrainGrid, landHeightAt, unpackTerrain } from "./terrain";
import { REAL_TERRAIN } from "./real-terrain";
import { MUMBAI_ORIGIN } from "./real-coasts";

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

/** Movement of the water over the ground now: the steady current plus the tidal stream. */
export function currentVelocity(w: World): Vec2 {
  const steady = velocityOf({ course: w.env.current.set, speed: w.env.current.drift });
  const t = w.env.tidal;
  if (!t || t.maxRateKn === 0) return steady;
  const rate = tidalStreamRate(t.maxRateKn, t.hoursAfterSlackAtStart + w.time / 3600);
  return add(steady, scale(velocityOf({ course: t.floodSet, speed: 1 }), rate));
}

/** Own ship velocity over the ground: water velocity plus current. */
/** Own ship's velocity through the water: ahead speed along the heading plus, with a ship model, the sideways speed. */
export function ownWaterVelocity(w: World): Vec2 {
  const ahead = velocityOf({ course: w.own.heading, speed: w.own.speedThroughWater });
  const m = w.own.model;
  return m ? add(ahead, velocityOf({ course: w.own.heading + 90, speed: m.motion.v })) : ahead;
}

export function ownGroundVelocity(w: World): Vec2 {
  return add(ownWaterVelocity(w), currentVelocity(w));
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
    targets: sc.targets.map((t) => {
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
      ...(sc.env.wind ? { wind: { ...sc.env.wind } } : {}),
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
    depths: (sc.depths ?? []).map((d) => ({ ...d, points: d.points.map((p) => ({ ...p })) })),
    structures: (sc.structures ?? []).map((s) => ({ ...s, a: { ...s.a }, b: { ...s.b } })),
  };
}

/** Advance the simulation by dtSec seconds. */
export function stepWorld(w: World, dtSec: number): void {
  stepRadarPower(w);
  const o = w.own;
  if (o.model) {
    const type = shipTypeById(o.model.typeId);
    const m0 = o.model.motion;
    const rudder = o.model.steering === "auto" ? autopilotRudder(type, angleDiffDeg(o.ordered.course, o.heading), m0.r, m0.u) : o.model.rudderOrder;
    const m = stepShip(type, m0, { rudder, speed: o.ordered.speed, rudderRateDegPerSec: rudderRate(o.model.steeringUnits ?? 1) }, relativeWind(w), dtSec);
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
    if (m && type) {
      // Catalogue type: steers through the water, turns and changes speed gradually, set by the current, blown by the wind.
      const turn = type.turnDegPerSec * dtSec;
      m.heading = normalizeDeg(m.heading + clamp(angleDiffDeg(m.orderedCourse, m.heading), -turn, turn));
      const dv = type.accelKnPerSec * dtSec;
      m.stw = Math.max(0, m.stw + clamp(m.orderedSpeed - m.stw, -dv, dv));
      let ground = add(velocityOf({ course: m.heading, speed: m.stw }), currentVelocity(w));
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
  if (!o.model || w.env.seaState <= 0) {
    if (o.seaway) {
      o.heading = normalizeDeg(o.heading - o.seaway.yawDeg);
      delete o.seaway;
    }
    return;
  }
  const sw = o.seaway ?? (o.seaway = { rollDeg: 0, pitchDeg: 0, yawDeg: 0, heaveM: 0, rollPhase: 0, encounterPhase: 0 });
  const r = seawayResponse(w.env.seaState, normalizeDeg(seaFromDeg(w) - o.heading), o.speedThroughWater, shipTypeById(o.model.typeId).lengthM);
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
