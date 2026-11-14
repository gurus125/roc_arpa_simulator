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
 * How own ship comes round and changes speed once the trial manoeuvre starts: her heading change and speed
 * change (from the moment it starts) every `stepSec` seconds, until she is steady on the new course and
 * speed. Worked out by the simulator from the ship's own handling (engine/world.ts, ownTurnProfile).
 */
export interface TurnProfile {
  stepSec: number;
  dHeadingDeg: number[];
  dSpeedKn: number[];
}

/**
 * ARPA trial manoeuvre including own ship's dynamic characteristics (IMO MSC.192(79); Radar and ARPA
 * Manual, 3rd edition, 4.4.3): as `trialManoeuvre`, but own ship comes round and changes speed as the
 * profile says instead of at once. Her path is followed in steps; on each the relative motion is straight.
 */
function trialWithProfile(relPos: Vec2, own: CourseSpeed, targetTrue: CourseSpeed, trial: TrialManoeuvre, prof: TurnProfile): TrialResult {
  const tgtV = velocityOf(targetTrue);
  const delay = minutesToHours(Math.max(0, trial.delayMinutes));
  const segs: { rel: Vec2; dt: number }[] = [{ rel: sub(tgtV, velocityOf(own)), dt: delay }];
  const ownAt = (k: number): Vec2 => velocityOf({ course: own.course + prof.dHeadingDeg[k]!, speed: Math.max(0, own.speed + prof.dSpeedKn[k]!) });
  for (let k = 0; k + 1 < prof.dHeadingDeg.length; k++) {
    const v = scale(add(ownAt(k), ownAt(k + 1)), 0.5);
    segs.push({ rel: sub(tgtV, v), dt: prof.stepSec / 3600 });
  }
  segs.push({ rel: sub(tgtV, velocityOf({ course: trial.course, speed: trial.speed })), dt: Infinity });
  let p = relPos, t0 = 0;
  let best = { range: Infinity, time: 0, point: relPos };
  for (const sgm of segs) {
    const m = minRangeOnSegment(p, sgm.rel, 0, sgm.dt);
    if (m.range < best.range - 1e-12) best = { range: m.range, time: t0 + m.time, point: add(p, scale(sgm.rel, m.time)) };
    if (!Number.isFinite(sgm.dt)) break;
    p = add(p, scale(sgm.rel, sgm.dt));
    t0 += sgm.dt;
  }
  return { cpa: best.range, tcpaMinutes: hoursToMinutes(best.time), cpaBearing: bearingOf(best.point), beforeManoeuvre: best.time <= delay + 1e-12 };
}

/**
 * ARPA trial manoeuvre. Own ship holds its present course/speed until the delay has run, then
 * changes to the trial course/speed: as her handling allows when a `profile` is given (the ARPA and
 * AIS always give one), otherwise at once. The target is assumed to keep its present true course and
 * speed.
 *
 * Nothing in the live simulation changes: this is a pure prediction.
 */
export function trialManoeuvre(
  relPos: Vec2,
  own: CourseSpeed,
  targetTrue: CourseSpeed,
  trial: TrialManoeuvre,
  profile?: TurnProfile,
): TrialResult {
  if (profile && profile.dHeadingDeg.length > 1) return trialWithProfile(relPos, own, targetTrue, trial, profile);
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
