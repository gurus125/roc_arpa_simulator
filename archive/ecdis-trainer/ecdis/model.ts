import { Vec2, add, bearingOf, courseSpeedOf, length, normalizeDeg, scale, sub, velocityOf } from "../core/vec";
import { computeCpa, CpaResult } from "../core/cpa";
import { pointInPolygon } from "../core/nav";
import {
  RouteMonitor, advanceLeg, monitorRoute, routeLegs, segmentHitsCircle, segmentHitsPolygon, segmentToPolygonDistance,
  segmentToSegmentDistance,
} from "../core/route";
import { World, logSpeed, measuredHeading, ownGroundVelocity } from "../engine/index";
import { ArpaSystem } from "../arpa/index";

/**
 * ECDIS trainer on the simulator's own chart data (coastlines, shallow areas, hazards, marks).
 * It teaches the ECDIS functions (route planning and checking, route monitoring, safety contour,
 * look-ahead, alarms, radar and AIS overlay). It is NOT an ECDIS: it does not read official ENC
 * charts, has no chart updating and is not type-approved. Every default below is a placeholder.
 */
export interface EcdisSettings {
  /** Water shallower than this is shown and alarmed as unsafe, metres. */
  safetyDepthM: number;
  /** Look-ahead (anti-grounding) time, minutes. */
  lookAheadMin: number;
  /** Cross-track limit of the route, NM. */
  xtdLimitNm: number;
  /** Turn radius used for wheel-over points, NM. */
  turnRadiusNm: number;
  /** Own-ship vector length, minutes. */
  vectorMin: number;
  showAis: boolean;
  showArpa: boolean;
  showPastTrack: boolean;
  palette: "day" | "dusk" | "night";
}

export const ECDIS_DEFAULTS: EcdisSettings = {
  safetyDepthM: 10, lookAheadMin: 6, xtdLimitNm: 0.25, turnRadiusNm: 0.3, vectorMin: 6, showAis: true, showArpa: true, showPastTrack: true, palette: "day",
};

export type EcdisAlarmKind = "xtd" | "wheelover" | "grounding" | "contour" | "position" | "endroute" | "aground";

export interface EcdisAlarm {
  key: string;
  kind: EcdisAlarmKind;
  text: string;
  raisedAt: number;
  acked: boolean;
}

export interface EcdisState {
  settings: EcdisSettings;
  /** The planned route (waypoints). */
  route: Vec2[];
  /** True while the route is being monitored (activated). */
  monitoring: boolean;
  activeLeg: number;
  alarms: EcdisAlarm[];
  pastTrack: Vec2[];
  lastTrackAt: number;
  mob: { pos: Vec2; time: number } | null;
  /** Position sensor (GNSS): an instructor-set error and failure. */
  gnss: { offset: Vec2; failed: boolean };
  /** Dead-reckoned position used while the GNSS has failed (gyro and log only: no current). */
  dr: Vec2 | null;
  lastTime: number;
}

export function newEcdisState(w: World): EcdisState {
  return {
    settings: { ...ECDIS_DEFAULTS }, route: w.route.map((p) => ({ ...p })), monitoring: false, activeLeg: 0, alarms: [], pastTrack: [],
    lastTrackAt: -Infinity, mob: null, gnss: { offset: { e: 0, n: 0 }, failed: false }, dr: null, lastTime: w.time,
  };
}

/** The position the ECDIS believes: GNSS (with any injected error), or dead reckoning after a failure. */
export function ecdisPosition(w: World, st: EcdisState): { pos: Vec2; source: "GNSS" | "DR" } {
  if (st.gnss.failed && st.dr) return { pos: st.dr, source: "DR" };
  return { pos: add(w.own.pos, st.gnss.offset), source: "GNSS" };
}

/** Course and speed over the ground as the ECDIS knows them (from GNSS; gyro and log when on DR). */
export function ecdisCogSog(w: World, st: EcdisState): { course: number; speed: number } {
  if (st.gnss.failed) return { course: measuredHeading(w), speed: logSpeed(w) };
  return courseSpeedOf(ownGroundVelocity(w));
}

export interface Danger {
  name: string;
  kind: "land" | "shoal" | "hazard";
  /** NM from the start of the checked line to where it first comes within reach; null when not computed. */
  detail: string;
}

/** Charted dangers within `marginNm` of the line a-b, for the given safety depth. */
export function dangersNear(w: World, a: Vec2, b: Vec2, marginNm: number, safetyDepthM: number): Danger[] {
  const out: Danger[] = [];
  for (const c of w.coasts) {
    let hit = false;
    if (c.closed && c.points.length >= 3) hit = segmentToPolygonDistance(a, b, c.points) <= marginNm;
    else for (let i = 0; i + 1 < c.points.length && !hit; i++) hit = segmentToSegmentDistance(a, b, c.points[i]!, c.points[i + 1]!) <= marginNm;
    if (hit) out.push({ name: c.name, kind: "land", detail: "land" });
  }
  for (const d of w.depths) {
    if (d.depthM < safetyDepthM && segmentToPolygonDistance(a, b, d.points) <= marginNm) out.push({ name: d.name, kind: "shoal", detail: `${d.depthM} m, less than the safety depth ${safetyDepthM} m` });
  }
  for (const h of w.hazards) if (segmentHitsCircle(a, b, h.center, h.radius + marginNm)) out.push({ name: h.name, kind: "hazard", detail: "isolated danger" });
  return out;
}

export interface RouteIssue {
  /** Leg number, from 1. */
  leg: number;
  text: string;
}

/** Route check: every leg, with its cross-track limit on both sides, against land, unsafe depths and isolated dangers. */
export function checkRoute(w: World, route: Vec2[], s: EcdisSettings): RouteIssue[] {
  const issues: RouteIssue[] = [];
  if (route.length < 2) return [{ leg: 0, text: "The route needs at least two waypoints." }];
  const legs = routeLegs(route);
  legs.forEach((l, i) => {
    for (const d of dangersNear(w, l.from, l.to, s.xtdLimitNm, s.safetyDepthM)) issues.push({ leg: i + 1, text: `${d.name}: ${d.detail} within the ${s.xtdLimitNm} NM cross-track limit.` });
    if (l.distance < 1e-6) issues.push({ leg: i + 1, text: "Two waypoints are at the same position." });
    const next = legs[i + 1];
    if (next) {
      const turn = Math.abs(((next.bearing - l.bearing + 540) % 360) - 180);
      if (turn > 120) issues.push({ leg: i + 1, text: `Turn of ${turn.toFixed(0)}° at waypoint ${i + 2} is very sharp.` });
    }
  });
  return issues;
}

/** Least charted depth at a position, metres: 0 on land, null in deep (uncharted-as-shallow) water. */
export function depthAt(w: World, p: Vec2): number | null {
  for (const c of w.coasts) if (c.closed && c.points.length >= 3 && pointInPolygon(p, c.points)) return 0;
  let best: number | null = null;
  for (const d of w.depths) if (pointInPolygon(p, d.points)) best = best === null ? d.depthM : Math.min(best, d.depthM);
  return best;
}

function raise(st: EcdisState, w: World, key: string, kind: EcdisAlarmKind, text: string): void {
  const a = st.alarms.find((x) => x.key === key);
  if (a) {
    a.text = text;
    return;
  }
  st.alarms.push({ key, kind, text, raisedAt: w.time, acked: false });
}
const clear = (st: EcdisState, key: string): void => {
  st.alarms = st.alarms.filter((a) => a.key !== key);
};

export function ackEcdisAlarm(st: EcdisState, key: string): void {
  const a = st.alarms.find((x) => x.key === key);
  if (a) a.acked = true;
}

export function routeMonitor(w: World, st: EcdisState): RouteMonitor | null {
  if (!st.monitoring || st.route.length < 2) return null;
  return monitorRoute(st.route, ecdisPosition(w, st).pos, st.activeLeg, ecdisCogSog(w, st).speed, st.settings.turnRadiusNm);
}

/** Call after every simulation step. */
export function stepEcdis(w: World, st: EcdisState): void {
  const dtH = Math.max(0, w.time - st.lastTime) / 3600;
  st.lastTime = w.time;
  // Position sensor.
  if (st.gnss.failed) {
    if (!st.dr) st.dr = add(w.own.pos, st.gnss.offset);
    else st.dr = add(st.dr, scale(velocityOf({ course: measuredHeading(w), speed: logSpeed(w) }), dtH));
    raise(st, w, "position", "position", "POSITION SENSOR FAILURE: dead reckoning on gyro and log. Fix the position by other means.");
  } else {
    st.dr = null;
    clear(st, "position");
  }
  const { pos } = ecdisPosition(w, st);
  const cs = ecdisCogSog(w, st);
  const s = st.settings;

  if (w.time - st.lastTrackAt >= 30) {
    st.lastTrackAt = w.time;
    st.pastTrack.push({ ...pos });
    if (st.pastTrack.length > 600) st.pastTrack.shift();
  }

  // Anti-grounding look-ahead along the course over the ground.
  const ahead = add(pos, scale(velocityOf(cs), s.lookAheadMin / 60));
  const dangers = cs.speed > 0.1 ? dangersNear(w, pos, ahead, 0, s.safetyDepthM) : [];
  if (dangers.length > 0) raise(st, w, "grounding", "grounding", `DANGER AHEAD within ${s.lookAheadMin} min: ${[...new Set(dangers.map((d) => d.name))].join(", ")}.`);
  else clear(st, "grounding");

  // Safety contour / aground at the present position.
  const depth = depthAt(w, pos);
  if (depth !== null && depth < s.safetyDepthM) raise(st, w, "contour", "contour", depth === 0 ? "POSITION IS ON CHARTED LAND." : `INSIDE THE SAFETY CONTOUR: charted depth ${depth} m.`);
  else clear(st, "contour");

  // Route monitoring.
  if (st.monitoring && st.route.length >= 2) {
    st.activeLeg = advanceLeg(st.route, pos, st.activeLeg, s.turnRadiusNm);
    const m = monitorRoute(st.route, pos, st.activeLeg, cs.speed, s.turnRadiusNm)!;
    if (Math.abs(m.xtd) > s.xtdLimitNm) raise(st, w, "xtd", "xtd", `OFF TRACK: ${Math.abs(m.xtd).toFixed(2)} NM to ${m.xtd > 0 ? "starboard" : "port"} (limit ${s.xtdLimitNm} NM).`);
    else clear(st, "xtd");
    const last = st.activeLeg >= st.route.length - 2;
    const minutesToWo = cs.speed > 0.1 ? (m.toWheelOver / cs.speed) * 60 : Infinity;
    if (!last && minutesToWo <= 1 && minutesToWo >= 0) raise(st, w, `wo-${st.activeLeg}`, "wheelover", `WHEEL OVER for waypoint ${st.activeLeg + 2}: new course ${String(Math.round(routeLegs(st.route)[st.activeLeg + 1]!.bearing)).padStart(3, "0")}°.`);
    st.alarms = st.alarms.filter((a) => a.kind !== "wheelover" || a.key === `wo-${st.activeLeg}`);
    if (last && m.distanceToWp < 0.1) raise(st, w, "endroute", "endroute", "END OF ROUTE.");
  } else {
    st.alarms = st.alarms.filter((a) => !["xtd", "wheelover", "endroute"].includes(a.kind));
  }
}

export interface AisTarget {
  id: number;
  name: string;
  pos: Vec2;
  cog: number;
  sog: number;
  cpa: CpaResult;
  range: number;
  bearing: number;
}

/** AIS reports: only vessels carry AIS here (ships), not buoys or small craft. Truth, as transmitted by the target. */
export function aisTargets(w: World, st: EcdisState): AisTarget[] {
  const { pos } = ecdisPosition(w, st);
  const ownV = velocityOf(ecdisCogSog(w, st));
  return w.targets
    .filter((t) => t.kind === "ship")
    .map((t) => {
      const rel = sub(t.pos, pos);
      return { id: t.id, name: t.name, pos: t.pos, cog: t.course, sog: t.speed, cpa: computeCpa(rel, sub(velocityOf({ course: t.course, speed: t.speed }), ownV)), range: length(rel), bearing: bearingOf(rel) };
    });
}

/** Radar (ARPA) targets placed on the chart: the tracked position is relative to own ship in the gyro frame. */
export function arpaOverlay(w: World, st: EcdisState, a: ArpaSystem): { id: number; pos: Vec2; vel: Vec2; dangerous: boolean }[] {
  const { pos } = ecdisPosition(w, st);
  const g = w.sensors.gyroErrorDeg;
  const rot = (v: Vec2): Vec2 => {
    const r = (-g * Math.PI) / 180;
    return { e: v.e * Math.cos(r) + v.n * Math.sin(r), n: -v.e * Math.sin(r) + v.n * Math.cos(r) };
  };
  void normalizeDeg;
  return a.tracks
    .filter((t) => t.state === "tracking" && t.est && t.quality !== "acquiring")
    .map((t) => ({ id: t.id, pos: add(pos, rot(t.est!.rel)), vel: rot(t.est!.trueVel), dangerous: t.dangerous }));
}
