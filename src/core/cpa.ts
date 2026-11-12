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
