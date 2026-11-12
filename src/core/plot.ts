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

  return {
    relativeVelocity,
    relativeCourseSpeed: courseSpeedOf(relativeVelocity),
    targetTrue: trueFromRelative(own, relativeVelocity),
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
