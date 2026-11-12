import { Vec2, angleDiffDeg, bearingOf, length, sub } from "./vec";
import { alongTrack, crossTrackError, distanceToSegment, pointInPolygon } from "./nav";

/** Route (passage plan) maths. NM, degrees true, flat east/north frame. */
export interface RouteLeg {
  from: Vec2;
  to: Vec2;
  /** Track to make good, degrees true. */
  bearing: number;
  distance: number;
}

export function routeLegs(wps: Vec2[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i + 1 < wps.length; i++) {
    const v = sub(wps[i + 1]!, wps[i]!);
    legs.push({ from: wps[i]!, to: wps[i + 1]!, bearing: bearingOf(v), distance: length(v) });
  }
  return legs;
}

export const routeLength = (wps: Vec2[]): number => routeLegs(wps).reduce((s, l) => s + l.distance, 0);

/**
 * Distance before a waypoint at which the wheel goes over so that a turn of `turnDeg` on a
 * circle of radius `radiusNm` joins the next leg: R tan(turn / 2).
 */
export function wheelOverDistance(turnDeg: number, radiusNm: number): number {
  const half = (Math.min(Math.abs(turnDeg), 170) * Math.PI) / 360;
  return radiusNm * Math.tan(half);
}

export interface RouteMonitor {
  /** Index of the active leg (0 = from waypoint 1 to waypoint 2). */
  leg: number;
  /** Cross-track distance from the active leg, NM. Positive = ship is to starboard of the track. */
  xtd: number;
  bearingToWp: number;
  distanceToWp: number;
  /** Along the route from the ship's abeam point to the last waypoint, NM. */
  distanceToGo: number;
  /** Time to go at the given speed, hours; null when stopped. */
  ttgHours: number | null;
  /** Course change at the next waypoint, degrees (+ starboard); 0 on the last leg. */
  nextTurnDeg: number;
  /** Distance to the wheel-over point of the next waypoint, NM (negative when past it). */
  toWheelOver: number;
}

export function monitorRoute(wps: Vec2[], pos: Vec2, legIndex: number, sogKn: number, turnRadiusNm: number): RouteMonitor | null {
  const legs = routeLegs(wps);
  const leg = legs[Math.min(Math.max(legIndex, 0), legs.length - 1)];
  if (!leg) return null;
  const i = legs.indexOf(leg);
  const remainingOnLeg = leg.distance - alongTrack(pos, leg.from, leg.to);
  const after = legs.slice(i + 1).reduce((s, l) => s + l.distance, 0);
  const distanceToGo = Math.max(0, remainingOnLeg) + after;
  const next = legs[i + 1];
  const nextTurnDeg = next ? angleDiffDeg(next.bearing, leg.bearing) : 0;
  const toWp = sub(leg.to, pos);
  return {
    leg: i,
    xtd: crossTrackError(pos, leg.from, leg.to),
    bearingToWp: bearingOf(toWp),
    distanceToWp: length(toWp),
    distanceToGo,
    ttgHours: sogKn > 0.05 ? distanceToGo / sogKn : null,
    nextTurnDeg,
    toWheelOver: remainingOnLeg - (next ? wheelOverDistance(nextTurnDeg, turnRadiusNm) : 0),
  };
}

/** The active leg moves on when the ship has passed the wheel-over point of its end waypoint. */
export function advanceLeg(wps: Vec2[], pos: Vec2, legIndex: number, turnRadiusNm: number): number {
  let i = legIndex;
  for (;;) {
    const m = monitorRoute(wps, pos, i, 0, turnRadiusNm);
    if (!m || i >= wps.length - 2 || m.toWheelOver > 0) return i;
    i++;
  }
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.e - a.e) * (c.n - a.n) - (b.n - a.n) * (c.e - a.e);
}

/** True when segments a-b and c-d cross or touch. */
export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  const on = (p: Vec2, q: Vec2, r: Vec2): boolean => Math.min(p.e, q.e) - 1e-12 <= r.e && r.e <= Math.max(p.e, q.e) + 1e-12 && Math.min(p.n, q.n) - 1e-12 <= r.n && r.n <= Math.max(p.n, q.n) + 1e-12;
  if (o1 === 0 && on(a, b, c)) return true;
  if (o2 === 0 && on(a, b, d)) return true;
  if (o3 === 0 && on(c, d, a)) return true;
  if (o4 === 0 && on(c, d, b)) return true;
  return false;
}

/** True when the segment a-b enters or touches the closed polygon. */
export function segmentHitsPolygon(a: Vec2, b: Vec2, poly: Vec2[]): boolean {
  if (poly.length < 3) return false;
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (segmentsIntersect(a, b, poly[i]!, poly[(i + 1) % poly.length]!)) return true;
  return false;
}

/** Shortest distance from the segment a-b to the polygon (0 when it enters it). */
export function segmentToPolygonDistance(a: Vec2, b: Vec2, poly: Vec2[]): number {
  if (segmentHitsPolygon(a, b, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i]!;
    const d = poly[(i + 1) % poly.length]!;
    best = Math.min(best, distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
  }
  return best;
}

/** True when the segment a-b passes within `radius` of the point `centre`. */
export const segmentHitsCircle = (a: Vec2, b: Vec2, centre: Vec2, radius: number): boolean => distanceToSegment(centre, a, b) <= radius;

/** Shortest distance between segments a-b and c-d (0 when they cross). */
export function segmentToSegmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
}
