import { CourseSpeed, Vec2, add, bearingOf, dot, fromPolar, length, minutesToHours, scale, sub, velocityOf } from "./vec";
import { SetDrift } from "./current";

/** Range (NM) and true bearing (degrees) from one point to another. */
export function rangeBearing(from: Vec2, to: Vec2): { range: number; bearing: number } {
  const v = sub(to, from);
  return { range: length(v), bearing: bearingOf(v) };
}

/**
 * Position line from a fixed charted object: if the object bears `bearing` at `range` from own
 * ship, own ship is at the object's position minus that vector.
 */
export function fixFromRangeBearing(objectPos: Vec2, bearing: number, range: number): Vec2 {
  return sub(objectPos, fromPolar(bearing, range));
}

/** Dead reckoning: move a position along a course and speed for `hours`. */
export function runOn(pos: Vec2, cs: CourseSpeed, hours: number): Vec2 {
  return add(pos, scale(velocityOf(cs), hours));
}

/**
 * Signed cross-track error of point p from the track a -> b, in NM.
 * Positive = to starboard (right) of the track, negative = to port.
 */
export function crossTrackError(p: Vec2, a: Vec2, b: Vec2): number {
  const t = sub(b, a);
  const len = length(t);
  if (len === 0) return length(sub(p, a));
  const right: Vec2 = { e: t.n / len, n: -t.e / len };
  return dot(sub(p, a), right);
}

/** Distance of p along the track a -> b, from a, in NM. */
export function alongTrack(p: Vec2, a: Vec2, b: Vec2): number {
  const t = sub(b, a);
  const len = length(t);
  return len === 0 ? 0 : dot(sub(p, a), t) / len;
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const t = sub(b, a);
  const l2 = dot(t, t);
  if (l2 === 0) return length(sub(p, a));
  const f = Math.max(0, Math.min(1, dot(sub(p, a), t) / l2));
  return length(sub(p, add(a, scale(t, f))));
}

/** Ray casting point-in-polygon test. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.n > p.n !== b.n > p.n && p.e < ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e) inside = !inside;
  }
  return inside;
}

export interface TimedPosition {
  pos: Vec2;
  /** Seconds. */
  time: number;
}

/**
 * Combine several position estimates taken at slightly different times into one fix at
 * `toTime`, running each on by dead reckoning (own course and speed through the water), then
 * averaging.
 */
export function combineFixes(estimates: TimedPosition[], toTime: number, cs: CourseSpeed): Vec2 {
  if (estimates.length === 0) throw new Error("No position estimates");
  let e = 0;
  let n = 0;
  for (const x of estimates) {
    const p = runOn(x.pos, cs, minutesToHours((toTime - x.time) / 60));
    e += p.e;
    n += p.n;
  }
  return { e: e / estimates.length, n: n / estimates.length };
}

/**
 * Set and drift from two fixes. Own ship has steered a steady course and speed through the
 * water between them (read from gyro and log). The difference between the observed second fix
 * and the dead-reckoned position is the effect of the current over that time.
 */
export function setDriftFromFixes(fix1: TimedPosition, fix2: TimedPosition, throughWater: CourseSpeed): SetDrift {
  const hours = (fix2.time - fix1.time) / 3600;
  if (hours <= 0) throw new Error("Second fix must be later than the first");
  const dr = runOn(fix1.pos, throughWater, hours);
  const v = scale(sub(fix2.pos, dr), 1 / hours);
  return { set: bearingOf(v), drift: length(v) };
}

/** Angle in degrees between two bearings, folded into 0..90 (the "angle of cut" of two position lines). */
export function angleOfCut(b1: number, b2: number): number {
  let d = Math.abs(((b1 - b2) % 360 + 360) % 360);
  if (d > 180) d = 360 - d;
  return d > 90 ? 180 - d : d;
}

/**
 * Latitude and longitude of a position given in the local east/north frame (NM) from an origin.
 * One nautical mile north is one minute of latitude; one nautical mile east is one minute of
 * longitude divided by the cosine of the latitude (plane sailing with the mid-latitude, good for
 * the tens of miles of an exercise area).
 */
export function latLonOf(origin: { lat: number; lon: number }, pos: Vec2): { lat: number; lon: number } {
  const lat = origin.lat + pos.n / 60;
  const mid = ((origin.lat + lat) / 2) * (Math.PI / 180);
  return { lat, lon: origin.lon + pos.e / (60 * Math.cos(mid)) };
}

/** A latitude or longitude in degrees and decimal minutes, e.g. 18°50.0'N. */
export function formatLatLon(value: number, kind: "lat" | "lon"): string {
  const hemi = kind === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const a = Math.abs(value);
  let deg = Math.floor(a);
  let min = Math.round((a - deg) * 600) / 10;
  if (min >= 60) {
    min = 0;
    deg += 1;
  }
  return `${String(deg).padStart(kind === "lat" ? 2 : 3, "0")}°${min.toFixed(1).padStart(4, "0")}'${hemi}`;
}
