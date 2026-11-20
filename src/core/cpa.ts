import { Vec2, add, dot, length, scale, bearingOf, hoursToMinutes } from "./vec";

export interface CpaResult {
  /** Range at closest approach, NM. */
  cpa: number;
  /** Time to CPA in hours. Negative = closest approach already passed. null = no relative motion. */
  tcpaHours: number | null;
  /** Time to CPA in minutes (same sign rules). */
  tcpaMinutes: number | null;
  /** True when the target is moving away (CPA is in the past). */
  opening: boolean;
  /** Current range, NM. */
  currentRange: number;
  /** Relative position of the target at CPA (own ship at origin). */
  cpaPoint: Vec2;
  /** True bearing of the target from own ship at CPA. */
  cpaBearing: number;
}

const EPS = 1e-12;

/**
 * CPA / TCPA from the target's relative position (NM) and relative velocity (kn).
 *
 *   TCPA = -(r . v) / |v|^2          CPA = | r + v * TCPA |
 *
 * If TCPA is negative the vessels are opening and the closest approach is in the past;
 * the result still reports the past CPA but flags `opening`. With no relative motion
 * the range never changes: CPA = current range and TCPA is null.
 */
export function computeCpa(relPos: Vec2, relVel: Vec2): CpaResult {
  const currentRange = length(relPos);
  const v2 = dot(relVel, relVel);
  if (v2 < EPS) {
    return {
      cpa: currentRange,
      tcpaHours: null,
      tcpaMinutes: null,
      opening: false,
      currentRange,
      cpaPoint: relPos,
      cpaBearing: bearingOf(relPos),
    };
  }
  const t = -dot(relPos, relVel) / v2;
  const cpaPoint = add(relPos, scale(relVel, t));
  return {
    cpa: length(cpaPoint),
    tcpaHours: t,
    tcpaMinutes: hoursToMinutes(t),
    opening: t < 0,
    currentRange,
    cpaPoint,
    cpaBearing: bearingOf(cpaPoint),
  };
}

/** Minimum distance of a straight relative track from t0 to t1 (hours). */
export function minRangeOnSegment(
  relPos: Vec2,
  relVel: Vec2,
  t0: number,
  t1: number,
): { range: number; time: number } {
  const v2 = dot(relVel, relVel);
  let t = t0;
  if (v2 >= EPS) {
    const tStar = -dot(relPos, relVel) / v2;
    t = Math.min(Math.max(tStar, t0), t1);
  }
  const p = add(relPos, scale(relVel, t));
  return { range: length(p), time: t };
}

/** The CPA worked as on a plotting sheet, step by step (see `cpaWorking`). */
export interface CpaWorking {
  /** Range and true bearing of the target now, NM and degrees. */
  rangeNm: number;
  bearingDeg: number;
  /** Direction (degrees true) and rate (knots) of the target's relative motion. */
  relCourseDeg: number;
  relSpeedKn: number;
  /**
   * Angle between the relative track and the line from the target to own ship, degrees (0 to 180). Under 90 the
   * target is closing; over 90 it is opening and its closest approach is past.
   */
  angleDeg: number;
  /** CPA = range × sin(angle), NM; the run along the relative track to that point = range × cos(angle), NM. */
  cpaNm: number;
  runToCpaNm: number;
  /** TCPA = run ÷ relative speed, minutes (negative when opening; null with no relative motion). */
  tcpaMin: number | null;
}

/**
 * The CPA and TCPA worked the way a plotting sheet does it, for teaching: from the range and bearing of the target
 * and its relative motion, through the angle between its relative track and the line to own ship. Gives the same
 * CPA and TCPA as `computeCpa`; this one also returns the steps.
 */
export function cpaWorking(relPos: Vec2, relVel: Vec2): CpaWorking {
  const rangeNm = length(relPos);
  const bearingDeg = bearingOf(relPos);
  const relSpeedKn = length(relVel);
  const relCourseDeg = relSpeedKn < 1e-9 ? 0 : bearingOf(relVel);
  if (relSpeedKn < 1e-9 || rangeNm < 1e-9) return { rangeNm, bearingDeg, relCourseDeg, relSpeedKn, angleDeg: 0, cpaNm: rangeNm, runToCpaNm: 0, tcpaMin: relSpeedKn < 1e-9 ? null : 0 };
  // The line from the target to own ship runs on the reciprocal of the bearing.
  const towardsOwn = (bearingDeg + 180) % 360;
  let angleDeg = Math.abs(((relCourseDeg - towardsOwn + 540) % 360) - 180);
  if (angleDeg > 180) angleDeg = 360 - angleDeg;
  const a = (angleDeg * Math.PI) / 180;
  const cpaNm = rangeNm * Math.sin(a);
  const runToCpaNm = rangeNm * Math.cos(a);
  return { rangeNm, bearingDeg, relCourseDeg, relSpeedKn, angleDeg, cpaNm, runToCpaNm, tcpaMin: hoursToMinutes(runToCpaNm / relSpeedKn) };
}
