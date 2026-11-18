import { SetDrift } from "../core/current";
import { World } from "../engine/index";
import {
  ClearingReport, ExerciseDef, ExerciseKind, FixResult, PilotageReport, PlotAnswerInput, PlotReport, ROC_PLACEHOLDERS, RocSession, SetDriftReport,
  SituationAnswer, TrafficReport, evaluateClearing, evaluatePilotage, evaluateTraffic,
} from "../roc/index";
import { ExerciseResult, ResultItem, ScoringConfig, TaskCriterion } from "./session";
import { ChecklistItem, sheetHtml } from "./assess";

/**
 * Points for the six ROC exercises. Until now each gave a written report and no points, so it could not count
 * in an examination total. The points are worked from the SAME report the trainee sees, with the limits of
 * ROC_PLACEHOLDERS, and the list of marked items comes from one table, so the exercise sheet and the marking
 * cannot differ.
 *
 * To be fair, what counts for the plot, the fix and the set and drift is the FIRST check: the report shows the
 * real values, so a second check could simply copy them.
 *
 * Every limit and every number of points is a PLACEHOLDER for the institute to replace. In the traffic exercise
 * the notes about the collision regulations stay advice for the instructor and carry no points.
 */

/** What was marked on the first check, and by whom. */
export interface RocMarked {
  plot: { report: PlotReport; answer: PlotAnswerInput; by: string } | null;
  /** Each fix as it stood when first completed (two charted objects), by its number. */
  fixes: Record<number, { result: FixResult; by: string }>;
  setDrift: { report: SetDriftReport; answer: SetDrift | null; by: string } | null;
}

/** The reports an exercise is marked from. */
export interface RocReports extends RocMarked {
  clearing?: ClearingReport;
  pilotage?: PilotageReport;
  traffic?: TrafficReport;
}

interface Marked {
  student: string;
  correct: string;
  ok: boolean;
  by?: string;
}

interface RocItem {
  id: string;
  label: string;
  kind: ResultItem["kind"];
  criterion: string;
  limit: string;
  mark: (r: RocReports) => Marked;
}

const NOT_ANSWERED = "not answered";
const P = ROC_PLACEHOLDERS;
const yesNo = (b: boolean): string => (b ? "yes" : "no");

const SITUATION: Record<SituationAnswer, string> = {
  "no-risk": "no risk", "head-on": "head-on", "crossing-give-way": "crossing, own ship gives way", "crossing-stand-on": "crossing, own ship stands on",
  overtaking: "own ship overtaking", overtaken: "own ship being overtaken",
};

const plotNumber = (id: string, label: string, field: "relativeCourse" | "relativeSpeed" | "trueCourse" | "trueSpeed" | "cpa" | "tcpaMinutes", limit: string, digits: number): RocItem => ({
  id, label, kind: "number", limit, criterion: `Your value within ${limit} of the real value at the last observation, on the first check`,
  mark: (r) => {
    const c = r.plot?.report.valid ? r.plot.report.studentVsTruth?.checks.find((x) => x.field === field) : undefined;
    if (!c) return { student: NOT_ANSWERED, correct: "-", ok: false };
    return { student: c.student.toFixed(digits), correct: c.correct.toFixed(digits), ok: c.ok, by: r.plot!.by };
  },
});

const aspectText = (a: number | null | undefined): string => (a === null ? "none (the ship is stopped)" : a === undefined ? "not given" : `${a < 0 ? "Red" : "Green"} ${Math.abs(Math.round(a))}°`);

const fixItem = (id: string, label: string, group: number): RocItem => ({
  id, label, kind: "number", limit: `${P.fixErrorNm} NM`, criterion: `A fix from two charted objects or more, within ${P.fixErrorNm} NM of the real position, as it stood when first completed`,
  mark: (r) => {
    const f = r.fixes[group];
    if (!f?.result.valid || f.result.errorNm === undefined) return { student: "no valid fix", correct: `within ${P.fixErrorNm} NM`, ok: false };
    return { student: `${f.result.errorNm.toFixed(2)} NM from the real position`, correct: `within ${P.fixErrorNm} NM`, ok: !!f.result.ok, by: f.by };
  },
});

const ITEMS: Record<ExerciseKind, RocItem[]> = {
  plot: [
    plotNumber("relC", "Relative course", "relativeCourse", `±${P.plotTolerances.courseDeg}°`, 0),
    plotNumber("relS", "Relative speed", "relativeSpeed", `±${P.plotTolerances.speedKn} kn`, 1),
    plotNumber("trueC", "True course of the other ship", "trueCourse", `±${P.plotTolerances.courseDeg}°`, 0),
    plotNumber("trueS", "True speed of the other ship", "trueSpeed", `±${P.plotTolerances.speedKn} kn`, 1),
    plotNumber("cpa", "CPA", "cpa", `±${P.plotTolerances.cpaNm} NM`, 2),
    plotNumber("tcpa", "TCPA", "tcpaMinutes", `±${P.plotTolerances.tcpaMinutes} min`, 1),
    {
      id: "aspect", label: "Aspect at the last observation", kind: "number", limit: `±${P.aspectToleranceDeg}°`, criterion: `Your value within ±${P.aspectToleranceDeg}° of the real aspect, on the first check`,
      mark: (r) => {
        const p = r.plot;
        if (!p?.report.valid) return { student: NOT_ANSWERED, correct: "-", ok: false };
        const truth = p.report.truthAspect;
        if (p.answer.aspect === undefined) return { student: NOT_ANSWERED, correct: aspectText(truth), ok: false };
        return { student: aspectText(p.answer.aspect), correct: aspectText(truth), ok: p.report.aspectVsTruthOk === true, by: p.by };
      },
    },
    {
      id: "risk", label: "Does risk of collision exist?", kind: "choice", limit: "", criterion: "The correct choice, on the first check",
      mark: (r) => {
        const p = r.plot;
        if (!p?.report.valid) return { student: NOT_ANSWERED, correct: "-", ok: false };
        return { student: yesNo(p.answer.risk), correct: yesNo(!!p.report.truthRisk), ok: p.report.riskOk === true, by: p.by };
      },
    },
    {
      id: "situation", label: "The situation under the collision regulations", kind: "choice", limit: "", criterion: "The correct choice, on the first check",
      mark: (r) => {
        const p = r.plot;
        if (!p?.report.valid) return { student: NOT_ANSWERED, correct: "-", ok: false };
        return { student: SITUATION[p.answer.risk ? p.answer.situation : "no-risk"], correct: SITUATION[p.report.truthSituation ?? "no-risk"], ok: p.report.situationOk === true, by: p.by };
      },
    },
  ],
  fix: [
    fixItem("fix", "Position by radar", 1),
    {
      id: "cut", label: "Angle of cut of the position lines", kind: "outcome", limit: `${P.minAngleOfCut}°`, criterion: `Judged from the first fix: the position lines cross at ${P.minAngleOfCut}° or more`,
      mark: (r) => {
        const f = r.fixes[1]?.result;
        if (!f?.valid || f.cutAngle === undefined) return { student: "no valid fix", correct: `${P.minAngleOfCut}° or more`, ok: false };
        return { student: `${f.cutAngle.toFixed(0)}°`, correct: `${P.minAngleOfCut}° or more`, ok: f.cutAngle >= P.minAngleOfCut };
      },
    },
  ],
  setdrift: [
    fixItem("fix1", "First fix", 1),
    fixItem("fix2", "Second fix", 2),
    {
      id: "set", label: "Set of the current", kind: "number", limit: `±${P.setToleranceDeg}°`, criterion: `Your value within ±${P.setToleranceDeg}° of the real set, on the first check`,
      mark: (r) => {
        const s = r.setDrift;
        if (!s?.report.valid || !s.answer || !s.report.truth) return { student: NOT_ANSWERED, correct: "-", ok: false };
        return { student: `${s.answer.set.toFixed(0)}°`, correct: `${s.report.truth.set.toFixed(0)}°`, ok: s.report.studentVsTruth?.setOk === true, by: s.by };
      },
    },
    {
      id: "drift", label: "Drift of the current", kind: "number", limit: `±${P.driftToleranceKn} kn`, criterion: `Your value within ±${P.driftToleranceKn} kn of the real drift, on the first check`,
      mark: (r) => {
        const s = r.setDrift;
        if (!s?.report.valid || !s.answer || !s.report.truth) return { student: NOT_ANSWERED, correct: "-", ok: false };
        return { student: `${s.answer.drift.toFixed(1)} kn`, correct: `${s.report.truth.drift.toFixed(1)} kn`, ok: s.report.studentVsTruth?.driftOk === true, by: s.by };
      },
    },
  ],
  clearing: [
    {
      id: "range", label: "Clearing range recorded", kind: "number", limit: "", criterion: "Not less than the distance from the object to the shoal, plus its radius, plus the margin",
      mark: (r) => {
        const c = r.clearing;
        const need = c?.requiredRange !== undefined ? `${c.requiredRange.toFixed(2)} NM or more` : "-";
        if (!c?.recorded || c.recordedRange === undefined) return { student: "not recorded", correct: need, ok: false };
        return { student: `${c.recordedRange.toFixed(2)} NM`, correct: need, ok: c.rangeOk === true };
      },
    },
    {
      id: "outside", label: "Kept outside the clearing range", kind: "outcome", limit: "", criterion: "Judged at the end: own ship never came inside the range she recorded",
      mark: (r) => {
        const c = r.clearing;
        if (!c?.recorded || c.minRangeToObject === undefined) return { student: "no clearing range recorded", correct: "outside throughout", ok: false };
        return { student: `closest ${c.minRangeToObject.toFixed(2)} NM from the object`, correct: "outside throughout", ok: c.keptOutside === true };
      },
    },
    {
      id: "afloat", label: "Passed clear of the shoal and the land", kind: "outcome", limit: "", criterion: "Judged at the end: own ship did not ground and did not run onto the shoal",
      mark: (r) => {
        const c = r.clearing;
        if (!c) return { student: "-", correct: "clear", ok: false };
        return { student: c.grounded ? "grounded" : `clear by ${c.minClearance.toFixed(2)} NM`, correct: "clear", ok: !c.grounded };
      },
    },
  ],
  pilotage: [
    {
      id: "end", label: "Reached the last waypoint", kind: "action", limit: "", criterion: "Done before the exercise ends",
      mark: (r) => ({ student: r.pilotage?.reachedEnd ? "reached" : "not reached", correct: "reached", ok: !!r.pilotage?.reachedEnd }),
    },
    {
      id: "xte", label: "Kept to the planned track", kind: "outcome", limit: `${P.pilotageXteLimitNm} NM`, criterion: `Judged at the end: never more than ${P.pilotageXteLimitNm} NM off the track`,
      mark: (r) => {
        const p = r.pilotage;
        if (!p) return { student: "-", correct: `${P.pilotageXteLimitNm} NM or less`, ok: false };
        return { student: `${p.maxXte.toFixed(2)} NM off at most`, correct: `${P.pilotageXteLimitNm} NM or less`, ok: p.maxXte <= P.pilotageXteLimitNm };
      },
    },
    {
      id: "afloat", label: "Did not ground", kind: "outcome", limit: "", criterion: "Judged at the end: own ship did not run aground",
      mark: (r) => ({ student: r.pilotage ? (r.pilotage.grounded ? "grounded" : "afloat") : "-", correct: "afloat", ok: !!r.pilotage && !r.pilotage.grounded }),
    },
  ],
  traffic: [
    {
      id: "safe", label: "Every ship passed at a safe distance", kind: "outcome", limit: "", criterion: "Judged at the end: no ship came closer than the safe passing distance of the exercise",
      mark: (r) => {
        const t = r.traffic;
        if (!t) return { student: "-", correct: "all safe", ok: false };
        const close = t.perTarget.filter((x) => !x.safe).sort((a, b) => a.minRange - b.minRange);
        return { student: close.length === 0 ? "all safe" : `too close: ${close.map((x) => `${x.name} ${x.minRange.toFixed(2)} NM`).join(", ")}`, correct: "all safe", ok: t.allSafe };
      },
    },
    {
      id: "early", label: "Action taken in ample time", kind: "outcome", limit: `${P.minActionRangeNm} NM or ${P.minActionTcpaMin} min`,
      criterion: `Judged from the first alteration: the ship that mattered most was still ${P.minActionRangeNm} NM off or more, or ${P.minActionTcpaMin} minutes from her closest approach or more`,
      mark: (r) => {
        const correct = `${P.minActionRangeNm} NM or ${P.minActionTcpaMin} min, or more`;
        const a = r.traffic?.firstAction;
        if (!r.traffic) return { student: "-", correct, ok: false };
        if (!a) {
          const risk = r.traffic.perTarget.some((x) => x.initialRisk);
          return { student: risk ? "no alteration of course or speed" : "no alteration, and none was needed", correct, ok: !risk };
        }
        if (a.rangeToCritical === null || a.tcpaToCritical === null) return { student: `at ${a.timeMin.toFixed(1)} min, with no ship then closing inside the safe distance`, correct, ok: true };
        const late = a.tcpaToCritical < P.minActionTcpaMin && a.rangeToCritical < P.minActionRangeNm;
        return { student: `at ${a.timeMin.toFixed(1)} min: ${a.criticalTarget} ${a.rangeToCritical.toFixed(1)} NM off, ${a.tcpaToCritical.toFixed(0)} min to her closest approach`, correct, ok: !late };
      },
    },
    {
      id: "large", label: "Action large enough to be readily apparent", kind: "outcome", limit: `${P.minAlterationDeg}°`, criterion: `Judged from the first alteration: a turn of ${P.minAlterationDeg}° or more, or a change of speed`,
      mark: (r) => {
        const correct = `a turn of ${P.minAlterationDeg}° or more, or a change of speed`;
        const a = r.traffic?.firstAction;
        if (!r.traffic) return { student: "-", correct, ok: false };
        if (!a) {
          const risk = r.traffic.perTarget.some((x) => x.initialRisk);
          return { student: risk ? "no alteration of course or speed" : "no alteration, and none was needed", correct, ok: !risk };
        }
        if (a.kind === "speed") return { student: `speed changed by ${a.changeKn.toFixed(1)} kn`, correct, ok: true };
        return { student: `${a.changeDeg.toFixed(0)}° to ${a.direction}`, correct, ok: a.changeDeg >= P.minAlterationDeg };
      },
    },
  ],
};

const pointsOf = (kind: ResultItem["kind"], cfg: ScoringConfig): number => (kind === "outcome" ? cfg.points.safety : kind === "action" ? cfg.points.action : cfg.points.question);

/** The marked items of a ROC exercise, as on its exercise sheet. */
export function rocCriteria(kind: ExerciseKind, cfg: ScoringConfig): TaskCriterion[] {
  return ITEMS[kind].map((i) => ({ id: i.id, label: i.label, kind: i.kind, criterion: i.criterion, limit: i.limit, points: pointsOf(i.kind, cfg) }));
}

/** Questions for the debrief of each ROC exercise. */
export const ROC_DEBRIEF: Record<ExerciseKind, string[]> = {
  plot: [
    "Was the bearing of the ship steady while her range fell? What does that tell you before any working?",
    "Your answers were compared with your own plot and with the real values. Where did the larger difference come from: the readings or the working?",
    "How long must a plot run before its result can be relied on, and what would make it invalid?",
  ],
  fix: [
    "Why did you choose those objects? At what angle did the position lines cut?",
    "Which is the more accurate on this radar, a range or a bearing, and why?",
    "On board there is no real position to compare with. How would you know that a fix was poor?",
  ],
  setdrift: [
    "What does the set and drift you found do to the course to steer?",
    "How does an error in either fix change the answer, and how does a longer interval between the fixes help?",
  ],
  clearing: [
    "How did you work out the clearing range, and what margin did you allow?",
    "How would you keep watching the clearing range while also attending to traffic?",
  ],
  pilotage: [
    "Where was the ship furthest off the track, and what caused it?",
    "What did you use to know when to start each turn?",
  ],
  traffic: [
    "Which ship mattered most at the start, and how did you know?",
    "Was the first action early and large enough for the other ships to see? What did it do to the ships that were safe before?",
    "When was it safe to resume, and how did you check?",
  ],
};

/** The standard sheet of a ROC exercise (see sheetHtml). */
export function rocSheetHtml(ex: ExerciseDef, cfg: ScoringConfig, checklist: ChecklistItem[]): string {
  return sheetHtml({
    heading: `ROC: ${ex.name}`, aim: ex.description, refs: null, briefing: ex.steps, rows: rocCriteria(ex.id, cfg),
    timeLimitMin: ex.durationSec === undefined ? null : ex.durationSec / 60, safeNm: ex.safePassingNm, debrief: ROC_DEBRIEF[ex.id],
    note: ex.id === "plot" || ex.id === "setdrift" || ex.id === "fix"
      ? "The answers marked are those of the first check, and a fix is marked as it stands when first completed (two charted objects): the report then shows the real values."
      : ex.id === "traffic" ? "The notes the report gives about the collision regulations are advice for the instructor and carry no points." : "",
  }, cfg, checklist);
}

/** The marked result of a ROC exercise from its reports. */
export function rocResultFrom(ex: Pick<ExerciseDef, "id" | "name">, simSeconds: number, reports: RocReports, cfg: ScoringConfig): ExerciseResult {
  const items: ResultItem[] = ITEMS[ex.id].map((i) => {
    const m = i.mark(reports);
    const max = pointsOf(i.kind, cfg);
    const item: ResultItem = { id: i.id, label: i.label, kind: i.kind, student: m.student, correct: m.correct, ok: m.ok, points: m.ok ? max : 0, max };
    if (m.by) item.by = m.by;
    return item;
  });
  const score = items.reduce((s, i) => s + i.points, 0);
  const max = items.reduce((s, i) => s + i.max, 0);
  const percent = max > 0 ? (100 * score) / max : 0;
  return {
    exerciseId: `roc-${ex.id}`, title: `ROC: ${ex.name}`, simSeconds, items, score, max, percent,
    passed: cfg.passPercent === null ? null : percent >= cfg.passPercent,
    debrief: ROC_DEBRIEF[ex.id],
    placeholderNote: "Tolerances and points are placeholders, not an approved marking scheme. The answers marked are those of the first check.",
  };
}

/** The marked result of a ROC exercise at its end. */
export function rocResult(s: RocSession, w: World, marked: RocMarked, cfg: ScoringConfig): ExerciseResult {
  const reports: RocReports = { ...marked };
  if (s.ex.id === "clearing") reports.clearing = evaluateClearing(s, s.charted, s.ex, w.hazards);
  if (s.ex.id === "pilotage") reports.pilotage = evaluatePilotage(s);
  if (s.ex.id === "traffic") reports.traffic = evaluateTraffic(s, s.ex.safePassingNm);
  return rocResultFrom(s.ex, Math.max(0, w.time - s.log.startTime), reports, cfg);
}
