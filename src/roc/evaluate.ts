import { CourseSpeed, Vec2, angleDiffDeg, bearingOf, courseSpeedOf, fromPolar, length, sub, velocityOf, minutesToHours } from "../core/vec";
import { computeCpa } from "../core/cpa";
import { ASPECT_MIN_SPEED_KN, analysePlot, aspectOf, PlotAnalysis } from "../core/plot";
import { Answer, AnswerCheck, PLACEHOLDER_TOLERANCES, Tolerances, checkAnswer } from "../core/assess";
import { combineFixes, fixFromRangeBearing, angleOfCut, setDriftFromFixes } from "../core/nav";
import { SetDrift } from "../core/current";
import { classifyEncounter, ColregHint } from "../core/colreg";
import { ChartedObject, RocObservation, RocSession, TruthSnapshot, TargetEncounter } from "./session";
import { ExerciseDef } from "./exercises";

/**
 * PLACEHOLDER limits. The academy handouts give no pass marks or accuracy limits. Replace these
 * with the figures from the approved DG Shipping documents or the instructor's marking scheme.
 */
export const ROC_PLACEHOLDERS = {
  plotTolerances: PLACEHOLDER_TOLERANCES,
  /** Largest acceptable error of the reported aspect, degrees. */
  aspectToleranceDeg: 5,
  /** Largest acceptable error of a radar fix, NM. */
  fixErrorNm: 0.15,
  /** Position lines crossing at less than this angle give a poor fix, degrees. */
  minAngleOfCut: 30,
  setToleranceDeg: 10,
  driftToleranceKn: 0.3,
  /** Largest acceptable cross-track error in the channel, NM. */
  pilotageXteLimitNm: 0.4,
  /** Action should be "readily apparent": at least this much course change, degrees. */
  minAlterationDeg: 30,
  /** Action should be early: at least this range (NM) or TCPA (minutes) from the critical ship. */
  minActionRangeNm: 4,
  minActionTcpaMin: 12,
  /** Plot residual above which points are not on one straight line, NM. */
  plotResidualNm: 0.1,
};

export interface Message {
  level: "error" | "warn" | "info";
  text: string;
}

export type SituationAnswer = "no-risk" | "head-on" | "crossing-give-way" | "crossing-stand-on" | "overtaking" | "overtaken";

export interface PlotAnswerInput extends Answer {
  risk: boolean;
  situation: SituationAnswer;
  /** Aspect reported by the student: positive Green, negative Red, degrees. Left out when not given. */
  aspect?: number;
}

export function situationOf(hint: ColregHint): SituationAnswer {
  if (hint.situation === "head-on") return "head-on";
  if (hint.situation === "overtaking") return "overtaking";
  if (hint.situation === "overtaken") return "overtaken";
  return hint.ownRole === "give-way" ? "crossing-give-way" : "crossing-stand-on";
}

export interface Comparison {
  checks: AnswerCheck[];
  fractionCorrect: number;
}

export interface PlotReport {
  valid: boolean;
  messages: Message[];
  analysis?: PlotAnalysis;
  /** What the student should have got from their own observations. */
  fromPlot?: Answer;
  /** The true values at the time of the last observation. */
  truth?: Answer;
  truthRisk?: boolean;
  truthSituation?: SituationAnswer;
  /** Student against their own plot: did they do the plotting arithmetic right? */
  studentVsPlot?: Comparison;
  /** Their plot against the truth: how good were the observations? */
  plotVsTruth?: Comparison;
  studentVsTruth?: Comparison;
  riskOk?: boolean;
  situationOk?: boolean;
  /** Aspect from the student's own plot and from the true values (null: the target is stopped). */
  fromPlotAspect?: number | null;
  truthAspect?: number | null;
  aspectVsPlotOk?: boolean;
  aspectVsTruthOk?: boolean;
}

const toAnswer = (a: PlotAnalysis): Answer => ({
  relativeCourse: a.relativeCourseSpeed.course,
  relativeSpeed: a.relativeCourseSpeed.speed,
  trueCourse: a.targetTrue.course,
  trueSpeed: a.targetTrue.speed,
  cpa: a.cpa.cpa,
  tcpaMinutes: a.cpa.tcpaMinutes ?? 0,
});

export function truthAnswer(t: TruthSnapshot): { answer: Answer; closing: boolean; hint: ColregHint } {
  const tgtVel = velocityOf({ course: t.targetCourse, speed: t.targetSpeed });
  const ownVel = velocityOf(t.ownGround);
  const rel = sub(t.targetPos!, t.ownPos);
  const relVel = sub(tgtVel, ownVel);
  const cpa = computeCpa(rel, relVel);
  const rcs = courseSpeedOf(relVel);
  return {
    answer: {
      relativeCourse: rcs.course,
      relativeSpeed: rcs.speed,
      trueCourse: t.targetCourse,
      trueSpeed: t.targetSpeed,
      cpa: cpa.cpa,
      tcpaMinutes: cpa.tcpaMinutes ?? 0,
    },
    closing: !cpa.opening && cpa.tcpaMinutes !== null,
    hint: classifyEncounter(rel, t.ownGround, { course: t.targetCourse, speed: t.targetSpeed }),
  };
}

export function evaluatePlot(
  observations: RocObservation[],
  student: PlotAnswerInput | null,
  safePassingNm: number,
  tol: Tolerances = ROC_PLACEHOLDERS.plotTolerances,
): PlotReport {
  const messages: Message[] = [];
  const fail = (text: string): PlotReport => {
    messages.push({ level: "error", text });
    return { valid: false, messages };
  };
  if (observations.length < 2) return fail("Take at least two observations (three are better, so you can check the line is straight).");
  const badIdx = observations.findIndex((o) => o.objectId === null);
  if (badIdx >= 0) return fail(`Observation ${badIdx + 1} did not match any echo. The EBL and VRM were not on a target. Delete it and take it again.`);
  const ids = new Set(observations.map((o) => o.objectId));
  if (ids.size > 1) return fail("The observations are of different targets. Plot one target at a time.");
  const sorted = [...observations].sort((a, b) => a.timeSec - b.timeSec);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (last.timeSec - first.timeSec < 30) return fail("The observations are too close together in time. Wait longer between them.");
  const altered = sorted.some(
    (o) => Math.abs(angleDiffDeg(o.ownHeading, first.ownHeading)) > 2 || Math.abs(o.ownSpeedWater - first.ownSpeedWater) > 0.3,
  );
  if (altered) {
    return fail("Own ship altered course or speed during the plot, so the plot is not valid. Hold course and speed, then start a new plot.");
  }
  if (sorted.length === 2) messages.push({ level: "warn", text: "Only two observations: you cannot tell whether the target is steady. Take a third." });

  const own: CourseSpeed = { course: first.ownHeading, speed: first.ownSpeedWater };
  const analysis = analysePlot(sorted.map((o) => ({ timeMinutes: o.timeSec / 60, bearing: o.bearing, range: o.range })), own, { safePassingNm });

  // Straightness of the plotted points.
  const t0 = first.timeSec;
  const pts = sorted.map((o) => ({ t: (o.timeSec - t0) / 3600, p: fromPolar(o.bearing, o.range) }));
  const tMean = pts.reduce((a, b) => a + b.t, 0) / pts.length;
  const eMean = pts.reduce((a, b) => a + b.p.e, 0) / pts.length;
  const nMean = pts.reduce((a, b) => a + b.p.n, 0) / pts.length;
  let worst = 0;
  for (const q of pts) {
    const fe = eMean + analysis.relativeVelocity.e * (q.t - tMean);
    const fn = nMean + analysis.relativeVelocity.n * (q.t - tMean);
    worst = Math.max(worst, Math.hypot(q.p.e - fe, q.p.n - fn));
  }
  if (worst > ROC_PLACEHOLDERS.plotResidualNm && sorted.length > 2) {
    messages.push({ level: "warn", text: `The plotted points do not lie on a straight line (off by ${worst.toFixed(2)} NM). The target may have manoeuvred, or an observation was misread.` });
  }
  if (analysis.constantBearingDecreasingRange) messages.push({ level: "info", text: "Constant bearing with decreasing range: risk of collision may exist." });

  const fromPlot = toAnswer(analysis);
  const t = truthAnswer(last.truth);
  const truthRisk = t.closing && t.answer.cpa < safePassingNm;
  const truthSituation: SituationAnswer = truthRisk ? situationOf(t.hint) : "no-risk";
  const truthAspect = last.truth.targetSpeed < ASPECT_MIN_SPEED_KN ? null : aspectOf(bearingOf(sub(last.truth.targetPos!, last.truth.ownPos)), last.truth.targetCourse);
  const report: PlotReport = {
    valid: true,
    messages,
    analysis,
    fromPlot,
    truth: t.answer,
    truthRisk,
    truthSituation,
    plotVsTruth: checkAnswer(fromPlot, t.answer, tol),
    fromPlotAspect: analysis.aspect,
    truthAspect,
  };
  if (student) {
    report.studentVsPlot = checkAnswer(student, fromPlot, tol);
    report.studentVsTruth = checkAnswer(student, t.answer, tol);
    report.riskOk = student.risk === truthRisk;
    report.situationOk = student.risk === truthRisk && (!truthRisk || student.situation === truthSituation);
    if (student.aspect !== undefined) {
      const near = (ref: number | null): boolean => ref !== null && Math.abs(angleDiffDeg(student.aspect!, ref)) <= ROC_PLACEHOLDERS.aspectToleranceDeg;
      report.aspectVsPlotOk = near(analysis.aspect);
      report.aspectVsTruthOk = near(truthAspect);
    }
  }
  return report;
}

/* ---------- position fixing and set/drift ---------- */

export interface FixResult {
  group: number;
  valid: boolean;
  messages: Message[];
  pos?: Vec2;
  time?: number;
  objects?: string[];
  /** Distance from the true position, NM. */
  errorNm?: number;
  cutAngle?: number;
  ok?: boolean;
}

export function computeFix(obs: RocObservation[], charted: ChartedObject[], group: number): FixResult {
  const messages: Message[] = [];
  const mine = obs.filter((o) => o.group === group);
  const unmatched = mine.filter((o) => o.objectId === null || !charted.some((c) => c.id === o.objectId));
  if (unmatched.length > 0) {
    messages.push({ level: "warn", text: `${unmatched.length} observation(s) did not match a charted object and were ignored.` });
  }
  const good = mine.filter((o) => !unmatched.includes(o));
  const distinct = new Set(good.map((o) => o.objectId));
  if (distinct.size < 2) {
    messages.push({ level: "error", text: "A fix needs observations of at least two different charted objects." });
    return { group, valid: false, messages };
  }
  const last = [...good].sort((a, b) => a.timeSec - b.timeSec).pop()!;
  const cs: CourseSpeed = { course: last.ownHeading, speed: last.ownSpeedWater };
  const estimates = good.map((o) => {
    const c = charted.find((x) => x.id === o.objectId)!;
    return { pos: fixFromRangeBearing(c.pos, o.bearing, o.range), time: o.timeSec };
  });
  const pos = combineFixes(estimates, last.timeSec, cs);
  let cut = 0;
  for (let i = 0; i < good.length; i++) {
    for (let j = i + 1; j < good.length; j++) {
      if (good[i]!.objectId !== good[j]!.objectId) cut = Math.max(cut, angleOfCut(good[i]!.bearing, good[j]!.bearing));
    }
  }
  const errorNm = length(sub(pos, last.truth.ownPos));
  const ok = errorNm <= ROC_PLACEHOLDERS.fixErrorNm;
  if (cut < ROC_PLACEHOLDERS.minAngleOfCut) {
    messages.push({ level: "warn", text: `Poor angle of cut (${cut.toFixed(0)}°). Choose objects whose bearings differ more.` });
  }
  const names = [...distinct].map((id) => charted.find((c) => c.id === id)!.name);
  return { group, valid: true, messages, pos, time: last.timeSec, objects: names, errorNm, cutAngle: cut, ok };
}

export interface SetDriftReport {
  valid: boolean;
  messages: Message[];
  fix1?: FixResult;
  fix2?: FixResult;
  /** Set and drift from the student's two fixes. */
  fromFixes?: SetDrift;
  truth?: SetDrift;
  studentVsFixes?: { setOk: boolean; driftOk: boolean };
  studentVsTruth?: { setOk: boolean; driftOk: boolean };
}

const setOk = (a: number, b: number): boolean => Math.abs(angleDiffDeg(a, b)) <= ROC_PLACEHOLDERS.setToleranceDeg;
const driftOk = (a: number, b: number): boolean => Math.abs(a - b) <= ROC_PLACEHOLDERS.driftToleranceKn;

export function evaluateSetDrift(
  obs: RocObservation[],
  charted: ChartedObject[],
  truthCurrent: SetDrift,
  student: SetDrift | null,
): SetDriftReport {
  const messages: Message[] = [];
  const fix1 = computeFix(obs, charted, 1);
  const fix2 = computeFix(obs, charted, 2);
  if (!fix1.valid || !fix2.valid) {
    messages.push({ level: "error", text: "You need two valid fixes (fix 1 and fix 2), each from at least two charted objects." });
    return { valid: false, messages, fix1, fix2 };
  }
  const o1 = obs.filter((o) => o.group === 1);
  const o2 = obs.filter((o) => o.group === 2);
  const a = o1[o1.length - 1]!;
  const b = o2[o2.length - 1]!;
  if (Math.abs(angleDiffDeg(a.ownHeading, b.ownHeading)) > 2 || Math.abs(a.ownSpeedWater - b.ownSpeedWater) > 0.3) {
    messages.push({ level: "error", text: "Own ship altered course or speed between the fixes, so the dead reckoning is not valid." });
    return { valid: false, messages, fix1, fix2 };
  }
  if (fix2.time! - fix1.time! < 300) {
    messages.push({ level: "warn", text: "The fixes are less than 5 minutes apart. The current will be hard to measure; wait longer." });
  }
  const water: CourseSpeed = { course: a.ownHeading, speed: a.ownSpeedWater };
  const fromFixes = setDriftFromFixes({ pos: fix1.pos!, time: fix1.time! }, { pos: fix2.pos!, time: fix2.time! }, water);
  const rep: SetDriftReport = { valid: true, messages, fix1, fix2, fromFixes, truth: truthCurrent };
  if (student) {
    rep.studentVsFixes = { setOk: setOk(student.set, fromFixes.set), driftOk: driftOk(student.drift, fromFixes.drift) };
    rep.studentVsTruth = { setOk: setOk(student.set, truthCurrent.set), driftOk: driftOk(student.drift, truthCurrent.drift) };
  }
  return rep;
}

/* ---------- clearing range ---------- */

export interface ClearingReport {
  messages: Message[];
  recorded: boolean;
  requiredRange?: number;
  recordedRange?: number;
  rangeOk?: boolean;
  keptOutside?: boolean;
  minRangeToObject?: number;
  minClearance: number;
  grounded: boolean;
  passed: boolean;
}

export function evaluateClearing(session: RocSession, charted: ChartedObject[], ex: ExerciseDef, hazards: { center: Vec2; radius: number }[]): ClearingReport {
  const messages: Message[] = [];
  const log = session.log;
  const margin = ex.clearingMarginNm ?? 0.3;
  const rec = session.clearing;
  const obj = charted.find((c) => c.id === (rec?.objectId ?? ex.clearingObjectId));
  const h = hazards[0];
  const rep: ClearingReport = {
    messages,
    recorded: rec !== null,
    minClearance: log.minHazardClearance,
    grounded: log.grounded || log.hazardStruck,
    passed: false,
  };
  if (obj && h) {
    rep.requiredRange = length(sub(h.center, obj.pos)) + h.radius + margin;
  }
  if (!rec) {
    messages.push({ level: "error", text: "You did not record a clearing range." });
  } else if (rep.requiredRange !== undefined) {
    rep.recordedRange = rec.range;
    rep.rangeOk = rec.range >= rep.requiredRange - 0.05;
    if (!rep.rangeOk) messages.push({ level: "error", text: `Your clearing range ${rec.range.toFixed(2)} NM is too small. The hazard would not be inside the ring. At least ${rep.requiredRange.toFixed(2)} NM is needed.` });
    const closest = log.minRange.get(rec.objectId) ?? Infinity;
    rep.minRangeToObject = closest;
    rep.keptOutside = closest >= rec.range - 0.05;
    if (!rep.keptOutside) messages.push({ level: "error", text: `Own ship came inside your clearing range (closest ${closest.toFixed(2)} NM from the ${obj?.name ?? "object"}).` });
  }
  if (rep.grounded) messages.push({ level: "error", text: log.hazardStruck ? "Own ship ran onto the shoal." : "Own ship ran aground." });
  rep.passed = !!rec && !!rep.rangeOk && !!rep.keptOutside && !rep.grounded;
  if (rep.passed) messages.push({ level: "info", text: `Passed clear of the shoal with ${log.minHazardClearance.toFixed(2)} NM to spare.` });
  return rep;
}

/* ---------- blind pilotage ---------- */

export interface PilotageReport {
  messages: Message[];
  grounded: boolean;
  reachedEnd: boolean;
  maxXte: number;
  meanXte: number;
  durationMin: number;
  passed: boolean;
}

export function evaluatePilotage(session: RocSession): PilotageReport {
  const log = session.log;
  const messages: Message[] = [];
  const limit = ROC_PLACEHOLDERS.pilotageXteLimitNm;
  const rep: PilotageReport = {
    messages,
    grounded: log.grounded,
    reachedEnd: log.reachedEnd,
    maxXte: log.xteAbsMax,
    meanXte: log.meanXte,
    durationMin: (log.endTime - log.startTime) / 60,
    passed: false,
  };
  if (log.grounded) messages.push({ level: "error", text: "Own ship ran aground." });
  if (!log.reachedEnd) messages.push({ level: "warn", text: "The last waypoint was not reached." });
  if (log.xteAbsMax > limit) messages.push({ level: "warn", text: `Maximum cross-track error ${log.xteAbsMax.toFixed(2)} NM is over the ${limit.toFixed(2)} NM limit (placeholder).` });
  rep.passed = !log.grounded && log.reachedEnd && log.xteAbsMax <= limit;
  if (rep.passed) messages.push({ level: "info", text: "Channel passage completed within the cross-track limit." });
  return rep;
}

/* ---------- heavy traffic ---------- */

export interface TrafficTargetResult {
  id: number;
  name: string;
  initialCpa: number;
  initialTcpaMinutes: number | null;
  initialRisk: boolean;
  situation: SituationAnswer;
  minRange: number;
  safe: boolean;
}

export interface TrafficReport {
  perTarget: TrafficTargetResult[];
  firstAction: null | {
    timeMin: number;
    kind: "course" | "speed";
    changeDeg: number;
    changeKn: number;
    direction: "starboard" | "port" | "speed";
    criticalTarget: string | null;
    rangeToCritical: number | null;
    tcpaToCritical: number | null;
  };
  advisories: Message[];
  safeFraction: number;
  allSafe: boolean;
}

export function evaluateTraffic(session: RocSession, safePassingNm: number): TrafficReport {
  const log = session.log;
  const adv: Message[] = [];
  const perTarget: TrafficTargetResult[] = log.initial.map((e: TargetEncounter) => {
    const risk = !e.cpa.opening && e.cpa.cpa < safePassingNm;
    const min = log.minRange.get(e.id) ?? e.range;
    return {
      id: e.id,
      name: e.name,
      initialCpa: e.cpa.cpa,
      initialTcpaMinutes: e.cpa.tcpaMinutes,
      initialRisk: risk,
      situation: risk ? situationOf(e.hint) : "no-risk",
      minRange: min,
      safe: min >= safePassingNm,
    };
  });
  const dangerous = perTarget.filter((t) => t.initialRisk);

  const init = log.initialOrdered;
  const sig = log.actions.find((a) => (a.kind === "course" ? Math.abs(angleDiffDeg(a.to, init.course)) >= 5 : Math.abs(a.to - init.speed) >= 2));
  let first: TrafficReport["firstAction"] = null;
  if (sig) {
    const crit = sig.encounters
      .filter((e) => e.tcpaMinutes !== null && e.tcpaMinutes > 0 && e.cpa < safePassingNm)
      .sort((a, b) => a.tcpaMinutes! - b.tcpaMinutes!)[0];
    const changeDeg = sig.kind === "course" ? angleDiffDeg(sig.to, init.course) : 0;
    first = {
      timeMin: (sig.t - log.startTime) / 60,
      kind: sig.kind,
      changeDeg: Math.abs(changeDeg),
      changeKn: sig.kind === "speed" ? sig.to - init.speed : 0,
      direction: sig.kind === "speed" ? "speed" : changeDeg > 0 ? "starboard" : "port",
      criticalTarget: crit ? perTarget.find((p) => p.id === crit.id)!.name : null,
      rangeToCritical: crit ? crit.range : null,
      tcpaToCritical: crit ? crit.tcpaMinutes : null,
    };
  }

  if (dangerous.length > 0 && !first) {
    adv.push({ level: "error", text: `${dangerous.length} ship(s) were on a close-quarters course and you took no significant action.` });
  }
  if (first) {
    if (first.tcpaToCritical !== null && first.rangeToCritical !== null) {
      if (first.tcpaToCritical < ROC_PLACEHOLDERS.minActionTcpaMin && first.rangeToCritical < ROC_PLACEHOLDERS.minActionRangeNm) {
        adv.push({ level: "warn", text: `Late action: ${first.criticalTarget} was ${first.rangeToCritical.toFixed(1)} NM away, ${first.tcpaToCritical.toFixed(0)} min to CPA. COLREG Rule 8 asks for action in ample time.` });
      } else {
        adv.push({ level: "info", text: `Action taken in good time (${first.criticalTarget}: ${first.rangeToCritical.toFixed(1)} NM, ${first.tcpaToCritical.toFixed(0)} min to CPA).` });
      }
    }
    if (first.kind === "course" && first.changeDeg < ROC_PLACEHOLDERS.minAlterationDeg) {
      adv.push({ level: "warn", text: `The first alteration was only ${first.changeDeg.toFixed(0)}°. Rule 8 asks for action that is readily apparent to the other ship; a small alteration may not be noticed.` });
    }
    if (first.direction === "port") {
      const against = dangerous.filter((d) => d.situation === "head-on" || d.situation === "crossing-give-way");
      if (against.length > 0) adv.push({ level: "warn", text: `You altered to port. For ${against.map((a) => a.name).join(", ")} the Rules (14, 15) normally call for an alteration to starboard. Check your reasoning with your instructor.` });
    }
  }
  const closeOnes = perTarget.filter((t) => !t.safe);
  for (const t of closeOnes) adv.push({ level: "error", text: `${t.name} came within ${t.minRange.toFixed(2)} NM (limit ${safePassingNm.toFixed(1)} NM, placeholder).` });
  const safeFraction = perTarget.length ? perTarget.filter((t) => t.safe).length / perTarget.length : 1;
  return { perTarget, firstAction: first, advisories: adv, safeFraction, allSafe: closeOnes.length === 0 };
}

export { bearingOf, minutesToHours };
