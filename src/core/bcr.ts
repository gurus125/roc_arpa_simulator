import { Vec2, hoursToMinutes, length, sub } from "./vec";
import { velocityOf } from "./vec";

export interface BowCrossing {
  /** Range of the target from own ship when it crosses own ship's course line ahead, NM. */
  rangeNm: number;
  /** Minutes from now until the crossing. */
  minutes: number;
}

/**
 * Bow crossing range and time (BCR / BCT): where and when the target's relative track crosses
 * own ship's course line AHEAD of own ship. Returns null when the target never crosses ahead
 * (it crosses astern, is already past, or its relative track runs parallel to own course).
 *
 * `relPos` is the target's position relative to own ship (NM, east/north), `relVel` the relative
 * velocity (knots) and `ownCourse` own ship's course in degrees true (the line to cross).
 */
export function bowCrossing(relPos: Vec2, relVel: Vec2, ownCourse: number): BowCrossing | null {
  const u = velocityOf({ course: ownCourse, speed: 1 }); // unit vector along own course
  const nrm = { e: u.n, n: -u.e }; // perpendicular
  const vn = relVel.e * nrm.e + relVel.n * nrm.n;
  if (Math.abs(vn) < 1e-9) return null;
  const t = -(relPos.e * nrm.e + relPos.n * nrm.n) / vn; // hours
  if (t < 0) return null;
  const p = { e: relPos.e + relVel.e * t, n: relPos.n + relVel.n * t };
  if (p.e * u.e + p.n * u.n <= 0) return null; // crossing astern
  return { rangeNm: length(sub(p, { e: 0, n: 0 })), minutes: hoursToMinutes(t) };
}
