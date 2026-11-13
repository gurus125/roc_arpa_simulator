import { CourseSpeed, Vec2, angleDiffDeg, bearingOf, courseSpeedOf, fromPolar, length, minutesToHours, normalizeDeg } from "./vec";
import { CpaResult, computeCpa } from "./cpa";
import { trueFromRelative } from "./motion";
import { fitLinearMotion, fitPositionAt } from "./track";

/** One radar observation of a target, as a student would record it on the plotting sheet. */
export interface PlotObservation {
  /** Minutes from any fixed reference (clock time converted to minutes is fine). */
  timeMinutes: number;
  /** TRUE bearing of the target from own ship, degrees. */
  bearing: number;
  /** Range, NM. */
  range: number;
}

/** Convert a relative bearing (from own bow) to a true bearing. */
export function relativeToTrueBearing(relativeBearing: number, ownHeading: number): number {
  return normalizeDeg(relativeBearing + ownHeading);
}

export interface PlotAnalysis {
  relativeVelocity: Vec2;
  relativeCourseSpeed: CourseSpeed;
  targetTrue: CourseSpeed;
  cpa: CpaResult;
  /** Total change of true bearing from first to last observation, degrees (+ = bearing drawing right). */
  bearingChangeDeg: number;
  rangeDecreasing: boolean;
  /** Constant bearing and decreasing range: the classic warning sign of collision risk. */
  constantBearingDecreasingRange: boolean;
  /** CPA closer than the safe passing distance while the target is closing. */
  riskOfCollision: boolean;
  /** Aspect of the target at the last observation (see `aspectOf`), or null for a target that is stopped. */
  aspect: number | null;
}

/** Below this speed a target has no course to speak of, and so no aspect, knots. */
export const ASPECT_MIN_SPEED_KN = 0.3;

/**
 * Aspect of a target: the angle between the target's course and the line of sight from the
 * target to own ship, which is the relative bearing of own ship as seen from the target.
 * Positive is GREEN (own ship is on the target's starboard side, so its green light would show),
 * negative is RED (port side); 0 is bow on and 180 stern on.
 * (Bole and Dineley, Radar and ARPA Manual, 7.2.3: aspect is measured between the line of sight
 * and the direction WA of the target's true motion.)
 * `bearingOfTarget` is the true bearing of the target from own ship, degrees.
 */
export function aspectOf(bearingOfTarget: number, targetCourse: number): number {
  return angleDiffDeg(bearingOfTarget + 180, targetCourse);
}

/** An aspect as it is reported: "Red 65°", "Green 20°". */
export function formatAspect(aspect: number | null | undefined): string {
  if (aspect === null || aspect === undefined) return "none";
  const a = Math.round(Math.abs(aspect));
  if (a === 0) return "0° (bow on)";
  if (a === 180) return "180° (stern on)";
  return `${aspect > 0 ? "Green" : "Red"} ${a}°`;
}

export interface PlotOptions {
  /** Bearing change (degrees) at or below which the bearing counts as "steady". Default 1.0. */
  steadyBearingDeg?: number;
  /** Passing distance (NM) below which a closing target counts as a risk. Default 1.0. */
  safePassingNm?: number;
}

/**
 * Manual-plot analysis (the ROC core): from successive range/bearing observations and own
 * ship's course and speed, find the target's relative motion, true course and speed, CPA
 * and TCPA. Own ship must hold course and speed throughout the plot.
 *
 * With two observations the relative motion line is the line joining them. With more, a
 * least-squares straight line is fitted to the positions against time.
 * TCPA is measured from the LAST observation.
 */
export function analysePlot(
  observations: PlotObservation[],
  own: CourseSpeed,
  options: PlotOptions = {},
): PlotAnalysis {
  if (observations.length < 2) throw new Error("Need at least two observations");
  const obs = [...observations].sort((a, b) => a.timeMinutes - b.timeMinutes);
  const first = obs[0]!;
  const last = obs[obs.length - 1]!;
  if (last.timeMinutes === first.timeMinutes) throw new Error("Observations must be at different times");

  const t = obs.map((o) => minutesToHours(o.timeMinutes - first.timeMinutes));
  const fit = fitLinearMotion(obs.map((o, i) => ({ t: t[i]!, p: fromPolar(o.bearing, o.range) })));
  if (!fit) throw new Error("Observations must be at different times");
  const relativeVelocity: Vec2 = fit.vel;
  const lastFitted = fitPositionAt(fit, t[t.length - 1]!);

  const cpa = computeCpa(lastFitted, relativeVelocity);
  const bearingChangeDeg = angleDiffDeg(last.bearing, first.bearing);
  const rangeDecreasing = last.range < first.range;
  const steady = Math.abs(bearingChangeDeg) <= (options.steadyBearingDeg ?? 1.0);
  const safe = options.safePassingNm ?? 1.0;

  const targetTrue = trueFromRelative(own, relativeVelocity);
  return {
    relativeVelocity,
    relativeCourseSpeed: courseSpeedOf(relativeVelocity),
    targetTrue,
    aspect: targetTrue.speed < ASPECT_MIN_SPEED_KN ? null : aspectOf(bearingOf(lastFitted), targetTrue.course),
    cpa,
    bearingChangeDeg,
    rangeDecreasing,
    constantBearingDecreasingRange: steady && rangeDecreasing,
    riskOfCollision: !cpa.opening && cpa.cpa < safe && rangeDecreasing,
  };
}

/** Range of the last observation vs a point, handy for plotting-board checks. */
export function lastRange(obs: PlotObservation[]): number {
  return length(fromPolar(obs[obs.length - 1]!.bearing, obs[obs.length - 1]!.range));
}

/** Bearing helper re-exported for UI code. */
export { bearingOf };
