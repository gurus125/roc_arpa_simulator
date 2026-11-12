import { CourseSpeed, Vec2, add, bearingOf, hoursToMinutes, minutesToHours, scale, velocityOf, length, sub } from "./vec";
import { minRangeOnSegment } from "./cpa";

export interface TrialManoeuvre {
  /** Proposed own-ship course after the manoeuvre, degrees true. */
  course: number;
  /** Proposed own-ship speed after the manoeuvre, knots. */
  speed: number;
  /** Delay before the manoeuvre starts, minutes from now (0 = immediately). */
  delayMinutes: number;
}

export interface TrialResult {
  /** Predicted closest range (NM) over the whole encounter, from now onward. */
  cpa: number;
  /** Minutes from now until that predicted closest approach. */
  tcpaMinutes: number;
  /** True bearing of the target from own ship at that moment. */
  cpaBearing: number;
  /** Whether the closest approach happens before the trial manoeuvre starts. */
  beforeManoeuvre: boolean;
}

/**
 * ARPA trial manoeuvre. Own ship holds its present course/speed until the delay has run,
 * then changes INSTANTLY to the trial course/speed (turning circle and speed change time
 * are not modelled; the ARPA handout notes this is a simplification of real equipment).
 * The target is assumed to keep its present true course and speed.
 *
 * Nothing in the live simulation changes: this is a pure prediction.
 */
export function trialManoeuvre(
  relPos: Vec2,
  own: CourseSpeed,
  targetTrue: CourseSpeed,
  trial: TrialManoeuvre,
): TrialResult {
  const ownV = velocityOf(own);
  const tgtV = velocityOf(targetTrue);
  const trialV = velocityOf({ course: trial.course, speed: trial.speed });
  const delay = minutesToHours(Math.max(0, trial.delayMinutes));

  const rel1 = sub(tgtV, ownV); // before the manoeuvre
  const rel2 = sub(tgtV, trialV); // after the manoeuvre

  const phase1 = minRangeOnSegment(relPos, rel1, 0, delay);
  const posAtDelay = add(relPos, scale(rel1, delay));
  const phase2 = minRangeOnSegment(posAtDelay, rel2, 0, Infinity);

  const phase1Wins = phase1.range <= phase2.range;
  const time = phase1Wins ? phase1.time : delay + phase2.time;
  const rel = phase1Wins ? rel1 : rel2;
  const base = phase1Wins ? relPos : posAtDelay;
  const t = phase1Wins ? phase1.time : phase2.time;
  const point = add(base, scale(rel, t));

  return {
    cpa: length(point),
    tcpaMinutes: hoursToMinutes(time),
    cpaBearing: bearingOf(point),
    beforeManoeuvre: phase1Wins,
  };
}
