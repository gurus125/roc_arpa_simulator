import { describe, expect, it } from "vitest";
import { createWorld } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import { EXERCISES, RocSession, exerciseById } from "../src/roc/index";
import type { ClearingReport, FixResult, PilotageReport, PlotAnswerInput, PlotReport, SetDriftReport, TrafficReport } from "../src/roc/index";
import {
  ARPA_EXERCISES, PLOTTING_EXERCISES, ArpaExSession, DEBRIEF_STEPS, DEFAULT_OBSERVATION_ITEMS, ExerciseResult, MAX_RECORDS, OBSERVATION_STANDARDS, PLACEHOLDER_SCORING, ResultItem, RocReports, ScoringConfig, SessionRecord, Store,
  TIME_LIMIT_ID, assessorStats, checklistLines, classComparison, criteriaSnapshot, debriefPack, debriefPackHtml, decisionConflicts, evidenceDigest, evidenceHtml, evidenceOf, exerciseSheetHtml,
  exerciseSheetsHtml, lightRecord, parseChecklist, rocCriteria, rocResult, rocResultFrom, rocSheetHtml, syllabusRefs, traineeConflicts, traineeFileHtml, traineeNames, traineeResults, traineeTableHtml,
} from "../src/train/index";

/*
 * Assessment that does not rest on one instructor's memory (the work of 18 Nov 2026 on four problems reported by
 * simulator instructors: individuals in a group, subjective evaluation, inconsistent exercise sheets, debriefing
 * that depends on the instructor). The expected values are worked by hand in the comments.
 */

const item = (id: string, kind: ResultItem["kind"], ok: boolean, max: number, by?: string): ResultItem =>
  ({ id, label: `Item ${id}`, kind, student: ok ? "right" : "wrong", correct: "right", ok, points: ok ? max : 0, max, ...(by ? { by } : {}) });
const result = (items: ResultItem[], debrief: string[] = []): ExerciseResult => {
  const score = items.reduce((s, i) => s + i.points, 0), max = items.reduce((s, i) => s + i.max, 0);
  return { exerciseId: "arpa-1", title: "1. Test", simSeconds: 600, items, score, max, percent: (100 * score) / max, passed: null, debrief, placeholderNote: "" };
};
const rec = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: "r1", exerciseId: "arpa-1", title: "ARPA 1: Test", kind: "arpa", students: ["Asha", "Ravi"], batch: "B1", startedIso: "2026-11-18T10:00:00.000Z", simSeconds: 600,
  names: {}, coasts: [], frames: [], events: [], result: null, summary: [], ...over,
});
const withPass = (p: number | null): ScoringConfig => ({ ...PLACEHOLDER_SCORING, passPercent: p });

describe("the checklist and its standards", () => {
  it("every proposed item has a written standard for Yes and for No", () => {
    expect(OBSERVATION_STANDARDS.map((c) => c.item)).toEqual(DEFAULT_OBSERVATION_ITEMS);
    expect(OBSERVATION_STANDARDS).toHaveLength(12);
    for (const c of OBSERVATION_STANDARDS) {
      expect(c.yes.length).toBeGreaterThan(20);
      expect(c.no.length).toBeGreaterThan(20);
    }
    // Eight of the twelve have something the simulator can measure; reporting, teamwork, cross-checking and limits do not.
    expect(OBSERVATION_STANDARDS.filter((c) => c.evidence !== null)).toHaveLength(8);
  });
  it("the instructor's own lines: a standard after '::', the proposed standard for a proposed title, none otherwise", () => {
    expect(parseChecklist(undefined)).toBe(OBSERVATION_STANDARDS);
    const first = DEFAULT_OBSERVATION_ITEMS[0]!;
    const list = parseChecklist(["Calls the master in good time :: Called before the CPA fell below the standing orders :: Did not call", first, "Keeps a log", "  ", ":: no title"]);
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({ item: "Calls the master in good time", yes: "Called before the CPA fell below the standing orders", no: "Did not call", evidence: null });
    expect(list[1]).toEqual(OBSERVATION_STANDARDS[0]);
    expect(list[2]).toEqual({ item: "Keeps a log", yes: "", no: "", evidence: null });
  });
  it("the lines shown for editing read back to the same checklist", () => {
    expect(parseChecklist(checklistLines(OBSERVATION_STANDARDS))).toEqual(OBSERVATION_STANDARDS);
    expect(checklistLines([{ item: "Keeps a log", yes: "", no: "", evidence: null }])).toEqual(["Keeps a log"]);
  });
});

describe("who did what in a group", () => {
  const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
  const start = () => {
    const w = createWorld(def.scenario, 62);
    w.radar.controls.rangeNm = 12;
    const a = new ArpaSystem(w);
    return { w, a, s: new ArpaExSession(def, w, a) };
  };
  it("an answer, an action and the first manoeuvre carry the name of the trainee at the controls", () => {
    const { w, a, s } = start();
    s.step(w, a, { pi: [], navLines: 0, ctl: "Asha" });
    expect(s.answer(w, a, "danger", 1)).toBe(true);
    expect(s.answers.get("danger")!.by).toBe("Asha");
    // Ravi takes over and alters 40° to starboard.
    w.own.ordered.course = 40;
    s.step(w, a, { pi: [], navLines: 0, ctl: "Ravi" });
    expect(s.obs.manoeuvre!.by).toBe("Ravi");
    expect(s.answer(w, a, "crsB", 185)).toBe(true);
    const r = s.finish(w, a);
    expect(r.items.find((i) => i.id === "danger")!.by).toBe("Asha");
    expect(r.items.find((i) => i.id === "crsB")!.by).toBe("Ravi");
    // An unanswered question and an action not done belong to nobody.
    expect(r.items.find((i) => i.id === "cpaA")!.by).toBeUndefined();
    expect(r.items.find((i) => i.id === "acq")!.by).toBeUndefined();
  });
  it("the risk as it stood when the first action was taken is kept", () => {
    /*
     * Exercise 1 at the start: own ship 000° 12 kn at the origin.
     * Ship A 045° 6 NM, 270° 10 kn: relative position (4.243, 4.243), relative velocity (-10, -12), speed 15.62 kn.
     *   CPA = |4.243 x -12 - 4.243 x -10| / 15.62 = 8.485 / 15.62 = 0.54 NM.
     * Ship B (0.471, 8.988), 185° 11 kn: velocity (-0.959, -10.958), relative velocity (-0.959, -22.958), speed 22.98 kn.
     *   CPA = |0.471 x -22.958 - 8.988 x -0.959| / 22.98 = |-10.81 + 8.62| / 22.98 = 0.10 NM.
     * Ship C (-1.368, -3.759), 005° 17 kn: velocity (1.482, 16.935), relative velocity (1.482, 4.935), speed 5.15 kn.
     *   CPA = |-1.368 x 4.935 + 3.759 x 1.482| / 5.15 = |-6.75 + 5.57| / 5.15 = 0.23 NM.
     * All three are inside the exercise's safe distance of 1 NM.
     */
    const { w, a, s } = start();
    s.step(w, a, { pi: [], navLines: 0, ctl: "Asha" });
    w.own.ordered.course = 40;
    s.step(w, a, { pi: [], navLines: 0, ctl: "Asha" });
    const risk = Object.fromEntries(s.obs.manoeuvre!.risk!.map((x) => [x.name, x.cpa]));
    expect(risk).toEqual({ "Ship A": 0.54, "Ship B": 0.1, "Ship C": 0.23 });
  });
  it("time at the controls, own answers and the observations about each trainee", () => {
    // Asha has the controls for the first 4 of 10 minutes (40%), Ravi for the other 6 (60%).
    // Flagged "now" at 02:00 (Asha's time) and at 05:00 and 08:20 (Ravi's); the flag "soon" at 03:00 is not counted.
    const now = (t: number, flag: 2 | 3) => ({ t, text: "ATTENTION: x.", instructor: true, flag });
    const r = rec({
      events: [now(120, 3), now(180, 2), now(300, 3), now(500, 3)],
      controls: [{ t: 0, name: "Asha" }, { t: 240, name: "Ravi" }],
      result: result([item("q1", "number", true, 10, "Asha"), item("q2", "number", false, 10, "Asha"), item("a1", "action", true, 10, "Ravi"), item("safe", "outcome", true, 20)]),
      observations: [{ item: "x", mark: "yes", t: 100, student: "Asha" }, { item: "x", mark: "no", t: 300, student: "Ravi" }, { item: "y", mark: "yes", t: 310, student: "" }],
      assessorBy: { Ravi: { decision: "not-yet", remarks: "late" } },
    });
    const [asha, ravi] = traineeResults(r);
    expect(asha).toEqual({ name: "Asha", seconds: 240, share: 0.4, items: 2, right: 1, points: 10, max: 20, obsYes: 1, obsNo: 0, flagsNow: 1, decision: "", remarks: "" });
    expect(ravi).toEqual({ name: "Ravi", seconds: 360, share: 0.6, items: 1, right: 1, points: 10, max: 10, obsYes: 0, obsNo: 1, flagsNow: 2, decision: "not-yet", remarks: "late" });
    const html = traineeTableHtml(r);
    expect(html).toContain("<td>Asha</td><td>04:00 (40%)</td><td>1 of 2 right</td><td>10 of 20</td><td>1 yes, 0 no</td><td>1</td>");
    expect(traineeTableHtml(rec({ students: ["Asha"] }))).toBe("");
  });
  it("the trainee file lists one person's exercises, oldest first, with what was his or her own", () => {
    const r1 = rec({
      id: "a", startedIso: "2026-11-18T10:00:00.000Z", controls: [{ t: 0, name: "Asha" }, { t: 240, name: "Ravi" }],
      result: result([item("q1", "number", true, 10, "Asha"), item("q2", "number", false, 10, "Asha"), item("safe", "outcome", true, 20)]),
    });
    const r0 = rec({ id: "b", title: "RADAR 22: Setting up", startedIso: "2026-11-17T09:00:00.000Z", students: ["Asha"], result: result([item("q1", "number", true, 10, "Asha")]), assessor: { decision: "competent", remarks: "", name: "Rao" } });
    const other = rec({ id: "c", students: ["Meera"] });
    expect(traineeNames([r1, r0, other])).toEqual(["Asha", "Meera", "Ravi"]);
    const html = traineeFileHtml([r1, r0, other], "Asha");
    expect(html.indexOf("RADAR 22: Setting up")).toBeGreaterThan(0);
    expect(html.indexOf("RADAR 22: Setting up")).toBeLessThan(html.indexOf("ARPA 1: Test"));
    // Alone on the 17th: everything was her own. In the group on the 18th: 1 of 2 right, 10 of 20 points; the group scored 30 of 40 = 75%.
    expect(html).toContain("<td>all</td><td>(worked alone)</td><td>100%</td>");
    expect(html).toContain("<td>04:00 (40%)</td><td>1 of 2 right, 10 of 20 points</td><td>75%</td>");
    expect(html).toContain("Competent");
    expect(html).not.toContain("Meera");
    expect(traineeFileHtml([other], "Asha")).toContain("No recorded exercise.");
  });
});

describe("the evidence before the decision", () => {
  const flag = (t: number, level: 2 | 3) => ({ t, text: "ATTENTION: Ship B will pass at 0.10 NM in 5 min: no action taken.", instructor: true, flag: level });
  // 25 of 40 points = 62.5%, shown as 63%. One safety outcome failed. Two flags "now", one "soon". One yes, three no.
  const bad = rec({
    result: result([item("q1", "number", true, 10), item("a1", "action", true, 10), { ...item("safe", "outcome", false, 20), label: "Passed at a safe distance", student: "closest: Ship B 0.21 NM" }]),
    events: [flag(300, 3), flag(420, 3), flag(200, 2)],
    observations: [{ item: "a", mark: "yes", t: 1, student: "" }, { item: "b", mark: "no", t: 2, student: "" }, { item: "c", mark: "no", t: 3, student: "" }, { item: "d", mark: "no", t: 4, student: "" }],
  });
  // 40 of 40, nothing flagged, two yes.
  const clean = rec({ result: result([item("q1", "number", true, 10), item("a1", "action", true, 10), item("safe", "outcome", true, 20)]), observations: [{ item: "a", mark: "yes", t: 1, student: "" }, { item: "b", mark: "yes", t: 2, student: "" }] });

  it("the digest counts what the record holds", () => {
    // 20 of 40 = 50%.
    expect(evidenceDigest(bad, withPass(70))).toEqual({ percent: 50, passMark: 70, items: 3, right: 2, outcomes: 1, failedOutcomes: ["Passed at a safe distance (closest: Ship B 0.21 NM)"], urgentFlags: 2, otherFlags: 1, obsYes: 1, obsNo: 3 });
    expect(evidenceDigest(clean, withPass(null))).toEqual({ percent: 100, passMark: null, items: 3, right: 3, outcomes: 1, failedOutcomes: [], urgentFlags: 0, otherFlags: 0, obsYes: 2, obsNo: 0 });
  });
  it("'competent' against a failed outcome, urgent flags, a score below the pass mark and mostly 'no' needs a reason", () => {
    expect(decisionConflicts(bad, "competent", withPass(70))).toEqual([
      "A safety outcome was not met: Passed at a safe distance (closest: Ship B 0.21 NM).",
      "2 moments were flagged as needing attention at once.",
      "The score, 50%, is below the pass mark of 70%.",
      'The instructor\'s observations are 3 "no" against 1 "yes".',
    ]);
    expect(decisionConflicts(bad, "not-yet", withPass(70))).toEqual([]);
    expect(decisionConflicts(bad, "", withPass(70))).toEqual([]);
    // With no pass mark set the percentage is not held against the decision (two of the three items were right).
    expect(decisionConflicts(bad, "competent", withPass(null))).toHaveLength(3);
    // But fewer than half of the items right still asks for a reason: 1 of 3 here.
    const poor = rec({ result: result([item("q1", "number", true, 10), item("q2", "number", false, 10), item("q3", "number", false, 10)]) });
    expect(decisionConflicts(poor, "competent", withPass(null))).toEqual(["No pass mark is set, and 1 of the 3 marked items were right."]);
    expect(decisionConflicts(poor, "not-yet", withPass(null))).toEqual([]);
  });
  it("'not yet competent' with nothing against the trainees needs a reason too", () => {
    expect(decisionConflicts(clean, "competent", withPass(70))).toEqual([]);
    expect(decisionConflicts(clean, "not-yet", withPass(70))).toEqual(['Nothing in the record is against the trainees: every safety outcome was met, nothing was flagged as urgent, no observation is "no" and the score, 100%, reaches the pass mark.']);
    // With no pass mark, "nothing against" needs every marked item right.
    expect(decisionConflicts(clean, "not-yet", withPass(null))).toEqual(['Nothing in the record is against the trainees: every safety outcome was met, nothing was flagged as urgent, no observation is "no" and all 3 marked items were right.']);
    // An exercise with no safety outcome does not claim that one was met.
    const plain = rec({ result: result([item("q1", "number", true, 10)]) });
    expect(decisionConflicts(plain, "not-yet", withPass(null))).toEqual(['Nothing in the record is against the trainees: nothing was flagged as urgent, no observation is "no" and all 1 marked items were right.']);
    expect(evidenceHtml(plain, withPass(null))).toContain("This exercise has no item judged from what happened");
    expect(evidenceHtml(clean, withPass(null))).toContain("Every safety outcome was met (1).");
    // A record with no points and no observation gives nothing to go against.
    expect(decisionConflicts(rec(), "not-yet", withPass(70))).toEqual([]);
  });
  it("the pass mark in force when the exercise was taken is the one that counts", () => {
    // Marked when the pass mark was 50%: 50% reaches it, although the setting is 70% now.
    const old = { ...bad, criteria: { atIso: "2026-11-01T00:00:00.000Z", rows: [], passPercent: 50, timeLimitMin: null } };
    expect(decisionConflicts(old, "competent", withPass(70)).some((c) => c.includes("pass mark"))).toBe(false);
    expect(evidenceHtml(old, withPass(70))).toContain("Marked with the criteria in force on 2026-11-01: pass mark 50%, time allowed no limit.");
    // On the screen the list of criteria is folded away; in the printed report it is open.
    const rows = { ...old, criteria: { ...old.criteria, rows: [{ id: "q", label: "CPA of Ship A", kind: "number" as const, criterion: "within ±0.5 NM", limit: "±0.5 NM", points: 10 }] } };
    expect(evidenceHtml(rows, withPass(70))).toContain("<details><summary>The criteria</summary>");
    expect(evidenceHtml(rows, withPass(70), true)).toContain("<details open><summary>The criteria</summary>");
    expect(evidenceHtml(rows, withPass(70), true)).toContain("<td>CPA of Ship A</td><td>within ±0.5 NM</td><td>10</td>");
  });
  it("the same check for one trainee of a group", () => {
    const r = rec({
      controls: [{ t: 0, name: "Asha" }],
      result: result([item("q1", "number", false, 10, "Asha"), item("q2", "number", false, 10, "Asha"), item("q3", "number", true, 10, "Asha")]),
      observations: [{ item: "a", mark: "no", t: 1, student: "Asha" }],
    });
    // Asha: 1 of 3 right (less than half), one "no" and no "yes". Ravi: never at the controls, nothing observed.
    expect(traineeConflicts(r, "Asha", "competent")).toEqual(['The observations about Asha are 1 "no" against 0 "yes".', "Asha had 1 of 3 own answers and actions right."]);
    expect(traineeConflicts(r, "Ravi", "competent")).toEqual(['Ravi was never at the controls and no observation about Ravi is "yes".']);
    expect(traineeConflicts(r, "Asha", "not-yet")).toEqual([]);
    const good = rec({ controls: [{ t: 0, name: "Asha" }], result: result([item("q1", "number", true, 10, "Asha")]) });
    expect(traineeConflicts(good, "Asha", "not-yet")).toEqual(['Nothing in the record is against Asha: all 1 own answers and actions were right and no observation is "no".']);
    expect(traineeConflicts(good, "Nobody", "competent")).toEqual([]);
  });
  it("assessors side by side: how many found competent, the mean scores, and decisions against the record", () => {
    const scored = (id: string, pct: number, safe: boolean, name: string, decision: "" | "competent" | "not-yet"): SessionRecord =>
      rec({ id, result: { ...result([item("safe", "outcome", safe, 20)]), percent: pct }, assessor: { decision, name, remarks: "" } });
    const stats = assessorStats([
      scored("1", 80, true, "Rao", "competent"), scored("2", 60, true, "Rao", "competent"), scored("3", 40, false, "Rao", "not-yet"),
      scored("4", 55, false, "Iyer", "competent"), scored("5", 99, true, "Iyer", ""), scored("6", 90, true, "Iyer", "not-yet"), rec({ id: "7" }),
    ], withPass(null));
    // Rao: competent at 80 and 60 (mean 70), not yet at 40; none against the record.
    // Iyer: competent at 55 with the safety outcome failed (against), not yet at 90 with nothing against the trainees (against). The undecided one does not count.
    expect(stats).toEqual([
      { name: "Iyer", decided: 2, competent: 1, meanCompetent: 55, meanNotYet: 90, against: 2 },
      { name: "Rao", decided: 3, competent: 2, meanCompetent: 70, meanNotYet: 40, against: 0 },
    ]);
  });
});

describe("the criteria in force and the exercise sheet", () => {
  const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
  it("the snapshot holds every marked item with the limits of the day", () => {
    // Exercise 1: one action (10) and four questions (10 each): 50 points, no time limit.
    const snap = criteriaSnapshot(def, PLACEHOLDER_SCORING, "2026-11-18T10:00:00.000Z");
    expect(snap.rows.map((r) => r.id)).toEqual(["acq", "cpaA", "tcpaA", "crsB", "danger"]);
    expect(snap.rows.reduce((s, r) => s + r.points, 0)).toBe(50);
    expect(snap.rows.find((r) => r.id === "cpaA")!.limit).toBe("±0.5 NM");
    expect(snap.passPercent).toBeNull();
    expect(snap.timeLimitMin).toBeNull();
    // With a limit of 12 minutes set by the instructor: one more item worth 20, and the pass mark of the day.
    const timed = criteriaSnapshot(def, { ...withPass(60), timeLimits: { "arpa-1": 12 } }, "2026-11-18T10:00:00.000Z");
    expect(timed.rows.map((r) => r.id)).toEqual(["acq", "cpaA", "tcpaA", "crsB", "danger", TIME_LIMIT_ID]);
    expect(timed.rows.reduce((s, r) => s + r.points, 0)).toBe(70);
    expect(timed.timeLimitMin).toBe(12);
    expect(timed.passPercent).toBe(60);
  });
  it("the sheet shows the same items, limits and points as the marking, and the checklist with its standards", () => {
    const html = exerciseSheetHtml(def, PLACEHOLDER_SCORING, OBSERVATION_STANDARDS, syllabusRefs(def));
    expect(html).toContain("<h1>Exercise 1. ");
    for (const t of def.tasks) expect(html).toContain(t.prompt.replace(/&/g, "&amp;"));
    expect(html).toContain('<th colspan="3">Total</th><th class="num">50</th>');
    expect(html).toContain("within ±0.5 NM of the real value");
    expect(html).toContain("Time allowed: no limit. Safe passing distance in this exercise: 1 NM.");
    expect(html).toContain("Pass mark: none set");
    for (const c of OBSERVATION_STANDARDS) expect(html).toContain(`<td>${c.item}</td>`);
    expect(exerciseSheetHtml(def, { ...withPass(60), timeLimits: { "arpa-1": 12 } }, [], null)).toContain("Time allowed: 12 minutes of exercise time.");
    const doc = exerciseSheetsHtml([html, html]);
    expect(doc.match(/<section class="sheet">/g)).toHaveLength(2);
    expect(doc).toContain("not type approved");
  });
});

describe("points for the ROC exercises", () => {
  const none: RocReports = { plot: null, fixes: {}, setDrift: null };
  const check = (field: string, ok: boolean) => ({ field, student: 1, correct: ok ? 1 : 2, ok });
  const fix = (errorNm: number, cutAngle: number): FixResult => ({ group: 1, valid: true, messages: [], errorNm, cutAngle, ok: errorNm <= 0.15 });

  it("the sheet and the marking list the same items, and their points add up", () => {
    // Questions and values 10, an action 10, an outcome 20.
    const totals: Record<string, number> = { plot: 90, fix: 30, setdrift: 40, clearing: 50, pilotage: 50, traffic: 60 };
    for (const ex of EXERCISES) {
      const rows = rocCriteria(ex.id, PLACEHOLDER_SCORING);
      const r = rocResultFrom(ex, 0, none, PLACEHOLDER_SCORING);
      expect(r.items.map((i) => i.id)).toEqual(rows.map((x) => x.id));
      expect(r.max).toBe(totals[ex.id]);
      expect(rows.reduce((s, x) => s + x.points, 0)).toBe(totals[ex.id]);
      const html = rocSheetHtml(ex, PLACEHOLDER_SCORING, OBSERVATION_STANDARDS);
      for (const x of rows) expect(html).toContain(x.label);
      expect(html).toContain(`<th class="num">${totals[ex.id]}</th>`);
    }
  });
  it("a plot: six values, the aspect, the risk and the situation, on the first check", () => {
    const report = {
      valid: true, messages: [], truthRisk: true, riskOk: true, truthSituation: "crossing-give-way", situationOk: false, truthAspect: -30, aspectVsTruthOk: true,
      studentVsTruth: { fractionCorrect: 4 / 6, checks: [check("relativeCourse", true), check("relativeSpeed", true), check("trueCourse", false), check("trueSpeed", true), check("cpa", true), check("tcpaMinutes", false)] },
    } as unknown as PlotReport;
    const answer = { relativeCourse: 1, relativeSpeed: 1, trueCourse: 1, trueSpeed: 1, cpa: 1, tcpaMinutes: 1, risk: true, situation: "head-on", aspect: -28 } as PlotAnswerInput;
    const r = rocResultFrom(exerciseById("plot"), 900, { ...none, plot: { report, answer, by: "Asha" } }, withPass(60));
    // Right: four of the six values, the aspect and the risk. Wrong: two values and the situation. 6 of 9 at 10 points = 60 of 90 = 66.7%.
    expect(r.items.filter((i) => i.ok).map((i) => i.id)).toEqual(["relC", "relS", "trueS", "cpa", "aspect", "risk"]);
    expect([r.score, r.max]).toEqual([60, 90]);
    expect(r.percent).toBeCloseTo(66.67, 2);
    expect(r.passed).toBe(true);
    expect(r.items.every((i) => i.by === "Asha")).toBe(true);
    expect(r.items.find((i) => i.id === "aspect")).toMatchObject({ student: "Red 28°", correct: "Red 30°" });
    expect(r.items.find((i) => i.id === "situation")).toMatchObject({ student: "head-on", correct: "crossing, own ship gives way" });
    expect(r.exerciseId).toBe("roc-plot");
    // Nothing checked: nothing answered, no points.
    const blank = rocResultFrom(exerciseById("plot"), 900, none, withPass(60));
    expect([blank.score, blank.max, blank.passed]).toEqual([0, 90, false]);
    expect(blank.items.every((i) => i.student === "not answered")).toBe(true);
  });
  it("a fix: within 0.15 NM, and position lines that cut at 30° or more", () => {
    // 0.10 NM off: accepted (10). Cut of 25°: too fine (0 of 20).
    const r = rocResultFrom(exerciseById("fix"), 300, { ...none, fixes: { 1: { result: fix(0.1, 25), by: "Ravi" } } }, PLACEHOLDER_SCORING);
    expect(r.items.map((i) => [i.id, i.ok, i.points])).toEqual([["fix", true, 10], ["cut", false, 0]]);
    expect(r.items[0]).toMatchObject({ student: "0.10 NM from the real position", by: "Ravi" });
    expect(r.items[1]!.student).toBe("25°");
    expect(rocResultFrom(exerciseById("fix"), 300, { ...none, fixes: { 1: { result: fix(0.2, 60), by: "" } } }, PLACEHOLDER_SCORING).score).toBe(20);
  });
  it("set and drift: two fixes, the set and the drift", () => {
    // Fix 1 0.10 NM (right), fix 2 0.21 NM (wrong). Set 128° against 120°: 8° is inside ±10°. Drift 2.4 against 2.0 kn: 0.4 is outside ±0.3.
    const report = { valid: true, messages: [], truth: { set: 120, drift: 2 }, studentVsTruth: { setOk: true, driftOk: false } } as unknown as SetDriftReport;
    const r = rocResultFrom(exerciseById("setdrift"), 1200, { plot: null, fixes: { 1: { result: fix(0.1, 60), by: "Asha" }, 2: { result: fix(0.21, 60), by: "Ravi" } }, setDrift: { report, answer: { set: 128, drift: 2.4 }, by: "Ravi" } }, PLACEHOLDER_SCORING);
    expect(r.items.map((i) => [i.id, i.ok, i.by])).toEqual([["fix1", true, "Asha"], ["fix2", false, "Ravi"], ["set", true, "Ravi"], ["drift", false, "Ravi"]]);
    expect([r.score, r.max]).toEqual([20, 40]);
    expect(r.items[3]).toMatchObject({ student: "2.4 kn", correct: "2.0 kn" });
  });
  it("clearing range and blind pilotage", () => {
    // Recorded 2.00 NM where 1.80 was needed (right, 10); came inside it, closest 1.85 NM (0 of 20); did not ground (20).
    const clearing: ClearingReport = { messages: [], recorded: true, requiredRange: 1.8, recordedRange: 2, rangeOk: true, keptOutside: false, minRangeToObject: 1.85, minClearance: 0.25, grounded: false, passed: false };
    const c = rocResultFrom(exerciseById("clearing"), 1500, { ...none, clearing }, PLACEHOLDER_SCORING);
    expect(c.items.map((i) => [i.id, i.points])).toEqual([["range", 10], ["outside", 0], ["afloat", 20]]);
    expect(c.items[1]!.student).toBe("closest 1.85 NM from the object");
    // Reached the last waypoint (10); 0.45 NM off the track at most against a limit of 0.4 (0 of 20); afloat (20).
    const pilotage: PilotageReport = { messages: [], grounded: false, reachedEnd: true, maxXte: 0.45, meanXte: 0.1, durationMin: 30, passed: false };
    const p = rocResultFrom(exerciseById("pilotage"), 1800, { ...none, pilotage }, PLACEHOLDER_SCORING);
    expect(p.items.map((i) => [i.id, i.points])).toEqual([["end", 10], ["xte", 0], ["afloat", 20]]);
    expect([p.score, p.max]).toEqual([30, 50]);
    // No report at all (the exercise never ran): nothing is given.
    expect(rocResultFrom(exerciseById("pilotage"), 0, none, PLACEHOLDER_SCORING).score).toBe(0);
  });
  it("traffic: safe passing, action in ample time, action large enough", () => {
    const tgt = (name: string, minRange: number, initialRisk: boolean) => ({ id: 1, name, initialCpa: 0.2, initialTcpaMinutes: 20, initialRisk, situation: "head-on" as const, minRange, safe: minRange >= 1 });
    const act = (changeDeg: number, range: number, tcpa: number): TrafficReport["firstAction"] => ({ timeMin: 5, kind: "course", changeDeg, changeKn: 0, direction: "starboard", criticalTarget: "Ship 2", rangeToCritical: range, tcpaToCritical: tcpa });
    const score = (t: TrafficReport) => rocResultFrom(exerciseById("traffic"), 2400, { ...none, traffic: t }, PLACEHOLDER_SCORING);
    // All safe (20). 20° at 3 NM and 8 minutes: late (under 4 NM and under 12 min) and too small (under 30°).
    const a = score({ perTarget: [tgt("Ship 2", 1.4, true)], firstAction: act(20, 3, 8), advisories: [], safeFraction: 1, allSafe: true });
    expect(a.items.map((i) => [i.id, i.points])).toEqual([["safe", 20], ["early", 0], ["large", 0]]);
    // 40° at 5 NM and 8 minutes: in time (still 5 NM off) and large enough; but Ship 3 came to 0.60 NM.
    const b = score({ perTarget: [tgt("Ship 2", 1.4, true), tgt("Ship 3", 0.6, false)], firstAction: act(40, 5, 8), advisories: [], safeFraction: 0.5, allSafe: false });
    expect(b.items.map((i) => [i.id, i.points])).toEqual([["safe", 0], ["early", 20], ["large", 20]]);
    expect(b.items[0]!.student).toBe("too close: Ship 3 0.60 NM");
    // Nothing done with a ship on a close-quarters course: neither action item. Nothing done and nothing needed: both.
    expect(score({ perTarget: [tgt("Ship 2", 1.4, true)], firstAction: null, advisories: [], safeFraction: 1, allSafe: true }).score).toBe(20);
    expect(score({ perTarget: [tgt("Ship 2", 1.4, false)], firstAction: null, advisories: [], safeFraction: 1, allSafe: true }).score).toBe(60);
  });
  it("from a session: the traffic exercise left alone", () => {
    const ex = exerciseById("traffic");
    const w = createWorld(ex.scenario, 62);
    const s = new RocSession(ex, w);
    s.finish("Finished by the student.");
    const r = rocResult(s, w, none, PLACEHOLDER_SCORING);
    // Nobody is inside 1 NM at the start (20); ships are on close-quarters courses and nothing was done (0 and 0).
    expect(r.title).toBe("ROC: Collision avoidance in heavy traffic");
    expect(r.items.map((i) => i.points)).toEqual([20, 0, 0]);
    expect(r.debrief.length).toBeGreaterThan(1);
  });
});

describe("the debrief laid out from the record", () => {
  const events = [
    { t: 100, text: "Target 1 acquired.", instructor: false },
    { t: 240, text: "Ravi takes the controls.", instructor: false },
    { t: 300, text: "ATTENTION: Ship B will pass at 0.10 NM in 5 min: no action taken.", instructor: true, flag: 3 as const },
    { t: 330, text: "ALARM: CPA/TCPA limit: Ship B.", instructor: false },
    { t: 320, text: "INSTRUCTOR (remote): Ship A ordered to 250° same speed.", instructor: true },
  ];
  const r = rec({
    events, evidence: { action: "First action at 06:10 by Ravi: 40° to starboard." },
    result: result([
      item("q1", "number", true, 10), item("q2", "number", false, 10), { ...item("q3", "number", false, 10), student: "not answered" },
      { ...item("safe", "outcome", false, 20), label: "Passed at a safe distance", student: "closest: Ship B 0.21 NM" },
    ], ["What would you do differently?"]),
  });
  it("the key moments in time order: flags, changes at the controls, the instructor's acts, alerts, the end", () => {
    // 10 of 50 points = 20%.
    expect(debriefPack(r).timeline).toEqual([
      { t: 240, text: "Ravi takes the controls", kind: "controls" },
      { t: 300, text: "Ship B will pass at 0.10 NM in 5 min: no action taken", kind: "flag" },
      { t: 320, text: "INSTRUCTOR (remote): Ship A ordered to 250° same speed", kind: "instructor" },
      { t: 330, text: "ALARM: CPA/TCPA limit: Ship B", kind: "alert" },
      { t: 600, text: "Finished: 20%", kind: "end" },
    ]);
  });
  it("what was met, what was not, and questions written from what happened", () => {
    const p = debriefPack(r);
    expect(p.well).toEqual(["Item q1"]);
    expect(p.improve).toEqual(["Item q2: answered wrong; it was right", "Item q3: not answered", "Passed at a safe distance: closest: Ship B 0.21 NM"]);
    expect(p.questions).toEqual([
      "At 05:00: Ship B will pass at 0.10 NM in 5 min: no action taken. What did the radar show you at that moment, and what did you decide?",
      "First action at 06:10 by Ravi: 40° to starboard. What told you it was time to act, and was it early enough?",
      "Passed at a safe distance: closest: Ship B 0.21 NM. What would you do differently, and at what moment?",
      "Item q2: you gave wrong; it was right. Where did the difference come from?",
      "What would you do differently?",
    ]);
  });
  it("a clean exercise still gets a question, and a long list of alerts is cut to twelve", () => {
    const clean = debriefPack(rec({ result: result([item("q1", "number", true, 10)]) }));
    expect(clean.well).toEqual(["Item q1", "Nothing needed the instructor's attention at once during the exercise"]);
    expect(clean.questions).toEqual(["Nothing was flagged and nothing was marked wrong. Which moment of the exercise asked most of you, and why?"]);
    const many = debriefPack(rec({ events: Array.from({ length: 30 }, (_, i) => ({ t: i * 10, text: `ALARM: lost target ${i}.`, instructor: false })) }));
    expect(many.timeline.filter((x) => x.kind === "alert")).toHaveLength(12);
    expect(many.timeline[many.timeline.length - 1]).toEqual({ t: 600, text: "Finished", kind: "end" });
  });
  it("the printed pack has the five steps in order, the trainees' own view first", () => {
    expect(DEBRIEF_STEPS.map((s) => s.title)).toEqual(["The trainees' own view", "The key moments", "The facts against the criteria", "The questions", "Goals agreed"]);
    const html = debriefPackHtml({ ...r, debrief: { self: "We acted late.", peer: "", goals: "" }, debriefDone: { steps: [true, true, true, true, true], goals: "Plot sooner.", atIso: "2026-11-18T11:00:00.000Z" } });
    const at = DEBRIEF_STEPS.map((s, i) => html.indexOf(`<h2>${i + 1}. ${s.title.replace("'", "&#39;")}</h2>`));
    expect(at.every((x) => x > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain("We acted late.");
    expect(html).toContain("Plot sooner.");
    expect(html).toContain("<td>05:00</td>");
    expect(html).toContain("Not a certificate of competence");
  });
  it("the class on one exercise: the best score first", () => {
    const flagged = (t: number, level: 2 | 3) => ({ t, text: "ATTENTION: x.", instructor: true, flag: level });
    const mk = (id: string, pct: number | null, more: Partial<SessionRecord> = {}): SessionRecord => rec({ id, result: pct === null ? null : { ...result([item("q", "number", true, 10)]), percent: pct }, ...more });
    const rows = classComparison([
      mk("a", 80, { students: ["Asha", "Ravi"], events: [flagged(1, 3), flagged(2, 2), flagged(3, 2)], progress: { done: 1, of: 1, score: 8, max: 10, finished: 80, closest: { name: "Ship B", nm: 0.62 }, actedAt: 370 } }),
      mk("b", 95, { students: ["Meera"], simSeconds: 1500 }),
      mk("c", null, { students: [] }),
      mk("d", 100, { exerciseId: "arpa-2" }),
    ], "arpa-1");
    expect(rows.map((x) => x.recId)).toEqual(["b", "a", "c"]);
    expect(rows[0]).toEqual({ recId: "b", who: "Meera", date: "2026-11-18", percent: 95, minutes: 25, actedAt: null, closest: null, flagsNow: 0, flagsSoon: 0 });
    expect(rows[1]).toMatchObject({ who: "Asha / Ravi", minutes: 10, actedAt: 370, closest: { name: "Ship B", nm: 0.62 }, flagsNow: 1, flagsSoon: 2 });
    expect(rows[2]!.who).toBe("no names");
  });
});

describe("the measured facts shown beside the checklist", () => {
  const def = ARPA_EXERCISES.find((e) => e.id === "arpa-1")!;
  it("what the display has measured at the start, and after an alteration", () => {
    const w = createWorld(def.scenario, 62);
    w.radar.controls.rangeNm = 12;
    const a = new ArpaSystem(w);
    const s = new ArpaExSession(def, w, a);
    s.step(w, a, { pi: [], navLines: 0, ctl: "Asha" });
    let ev = evidenceOf(s, w, a);
    expect(ev.range).toBe("Range scales used: 12 NM; changed 0 times.");
    // All three ships will pass inside 1 NM (see the working above) and none is tracked yet. Ship B passes closest, at 0.10 NM in about 23.5 minutes.
    expect(ev.acquire).toBe("Ship A: not tracked; Ship B: not tracked; Ship C: not tracked.");
    expect(ev.risk).toMatch(/^Ship B will pass at 0\.10 NM in 2[34] min if nothing changes \(safe distance 1 NM\)\.$/);
    expect(ev.action).toBe("No alteration of course or speed.");
    expect(ev.alerts).toBe("No alerts.");
    expect(ev.position).toBe("No planned track and no land in this exercise.");
    // Ship C is the nearest, 4 NM astern.
    expect(ev.effect).toBe("Closest so far: Ship C at 4.00 NM (safe distance 1 NM).");
    w.radar.controls.rangeNm = 6;
    s.step(w, a, { pi: [], navLines: 0, ctl: "Asha" });
    w.radar.controls.rangeNm = 12;
    w.own.ordered.course = 320;
    s.step(w, a, { pi: [], navLines: 0, ctl: "Ravi" });
    ev = evidenceOf(s, w, a);
    expect(ev.range).toBe("Range scales used: 12, 6 NM; changed 2 times.");
    expect(ev.action).toMatch(/^First action at 00:00 by Ravi: 40° to port\. Then: /);
    expect(ev.action).toContain("would have passed at");
  });
  it("in a manual plotting exercise the plot is on paper: the simulator says so and does not call the ships untracked", () => {
    const plot = PLOTTING_EXERCISES[0]!;
    const w = createWorld(plot.scenario, 62);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession(plot, w, a);
    s.step(w, a, { pi: [], navLines: 0 });
    const ev = evidenceOf(s, w, a);
    expect(ev.acquire).toMatch(/^(Manual plotting: the plot is on paper and cannot be measured\. Vessels that matter: .+\.|No vessel has come near the safe distance\.)$/);
    expect(ev.acquire).not.toContain("not tracked");
  });
});

describe("older records stay in the files without their replay", () => {
  const full = (i: number): SessionRecord => rec({
    id: `r${i}`, startedIso: `2026-11-18T10:${String(i).padStart(2, "0")}:00.000Z`,
    frames: [{ t: 0, own: { e: 0, n: 0, hdg: 0, spd: 12, ordC: 0, ordS: 12 }, tg: [], tracks: 0, alarms: [] }],
    coasts: [[{ e: 1, n: 1 }]], names: { 1: "Ship A" }, comms: [{ t: 1, from: "A", text: "x" }],
    events: [{ t: 5, text: "Target 1 acquired.", instructor: false }, { t: 9, text: "ATTENTION: x.", instructor: true, flag: 3 }],
    result: result([item("q", "number", true, 10, "Asha")], ["A question"]),
    criteria: { atIso: "2026-11-18T10:00:00.000Z", rows: [{ id: "q", label: "Q", kind: "number", criterion: "c", limit: "", points: 10 }], passPercent: 60, timeLimitMin: 12 },
  });
  it("a light record keeps who, what and how it was marked, and drops the replay", () => {
    const l = lightRecord(full(1));
    expect(l.frames).toEqual([]);
    expect(l.coasts).toEqual([]);
    expect(l.comms).toBeUndefined();
    expect(l.events).toEqual([{ t: 9, text: "ATTENTION: x.", instructor: true, flag: 3 }]);
    expect(l.result!.items).toHaveLength(1);
    expect(l.result!.debrief).toEqual([]);
    expect(l.criteria).toEqual({ atIso: "2026-11-18T10:00:00.000Z", rows: [], passPercent: 60, timeLimitMin: 12 });
    expect(l.students).toEqual(["Asha", "Ravi"]);
  });
  it("the sixty-first record sends the oldest to the archive, and the history holds both", () => {
    const st = new Store(null);
    for (let i = 0; i < MAX_RECORDS + 5; i++) st.addRecord(full(i));
    expect(st.data.records).toHaveLength(MAX_RECORDS);
    expect(st.data.archive!.map((r) => r.id)).toEqual(["r4", "r3", "r2", "r1", "r0"]);
    expect(st.data.archive!.every((r) => r.frames.length === 0)).toBe(true);
    expect(st.history()).toHaveLength(MAX_RECORDS + 5);
    // The trainee file reaches the archived ones.
    expect(traineeFileHtml(st.history(), "Asha").match(/<tr><td>2026-11-18<\/td>/g)).toHaveLength(MAX_RECORDS + 5);
    // A record that comes in again leaves the archive; a deleted one leaves both.
    st.addRecord(full(2));
    expect(st.data.archive!.some((r) => r.id === "r2")).toBe(false);
    expect(st.data.records[0]!.id).toBe("r2");
    st.removeRecord("r0");
    expect(st.history().some((r) => r.id === "r0")).toBe(false);
  });
  it("when the browser's storage is full the oldest replay goes and its light copy stays", () => {
    let limit = Infinity;
    const st = new Store({ getItem: () => null, setItem: (_k, v) => { if (v.length > limit) throw new Error("full"); } });
    // A replay is the bulk of a record: 200 frames here.
    const heavy = (i: number): SessionRecord => ({ ...full(i), frames: Array.from({ length: 200 }, (_, k) => ({ t: k * 10, own: { e: 0, n: k, hdg: 0, spd: 12, ordC: 0, ordS: 12 }, tg: [], tracks: 0, alarms: [] })) });
    for (let i = 0; i < 6; i++) st.addRecord(heavy(i));
    // Room for two replays fewer than are held now, and a seventh record comes in.
    limit = JSON.stringify(st.data).length - 2 * JSON.stringify(heavy(0)).length;
    expect(st.addRecord(heavy(6))).toBe(true);
    expect(st.data.records.length).toBeLessThan(7);
    expect(st.history()).toHaveLength(7);
  });
  it("the debrief saved at the station is kept when a display sends its record again", () => {
    const st = new Store(null);
    st.addRecord({ ...full(1), debriefDone: { steps: [true, true, false, false, false], goals: "Plot sooner.", atIso: "2026-11-18T11:00:00.000Z" } });
    st.addRecord(full(1));
    expect(st.data.records[0]!.debriefDone!.goals).toBe("Plot sooner.");
  });
});
