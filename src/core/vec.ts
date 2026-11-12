/**
 * Basic geometry for the simulator.
 *
 * Conventions (used everywhere):
 *  - Positions are in nautical miles (NM) in a local flat frame: e = east, n = north.
 *  - Velocities are in knots (NM per hour).
 *  - Time inside the core is in HOURS. Helpers convert to/from minutes.
 *  - Bearings and courses are degrees true, 0-360, clockwise from north.
 */

export interface Vec2 {
  e: number;
  n: number;
}

export interface CourseSpeed {
  /** degrees true, 0 <= course < 360 */
  course: number;
  /** knots */
  speed: number;
}

export const DEG = Math.PI / 180;

export function normalizeDeg(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r === 360 ? 0 : r;
}

/** Smallest signed difference a - b in degrees, in (-180, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export const minutesToHours = (m: number): number => m / 60;
export const hoursToMinutes = (h: number): number => h * 60;

export const add = (a: Vec2, b: Vec2): Vec2 => ({ e: a.e + b.e, n: a.n + b.n });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ e: a.e - b.e, n: a.n - b.n });
export const scale = (a: Vec2, k: number): Vec2 => ({ e: a.e * k, n: a.n * k });
export const dot = (a: Vec2, b: Vec2): number => a.e * b.e + a.n * b.n;
export const length = (a: Vec2): number => Math.hypot(a.e, a.n);

/** Bearing (degrees true) of a vector, 0 = north. A zero vector returns 0. */
export function bearingOf(v: Vec2): number {
  if (v.e === 0 && v.n === 0) return 0;
  return normalizeDeg(Math.atan2(v.e, v.n) / DEG);
}

/** Position from a true bearing and a range (NM). */
export function fromPolar(bearingDeg: number, range: number): Vec2 {
  const b = bearingDeg * DEG;
  return { e: range * Math.sin(b), n: range * Math.cos(b) };
}

/** Velocity vector (knots) from a course and speed. */
export function velocityOf(cs: CourseSpeed): Vec2 {
  return fromPolar(cs.course, cs.speed);
}

/** Course and speed of a velocity vector. */
export function courseSpeedOf(v: Vec2): CourseSpeed {
  return { course: bearingOf(v), speed: length(v) };
}

/**
 * Rotate a vector so that its bearing increases by `deg` (clockwise), keeping its length.
 * Used for a gyro compass error: every measured bearing is turned by the error.
 */
export function rotateVec(v: Vec2, deg: number): Vec2 {
  const a = deg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { e: v.e * c + v.n * s, n: -v.e * s + v.n * c };
}
