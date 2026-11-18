import { World } from "../engine/index";
import { ArpaSystem } from "../arpa/index";
import { DEFAULT_OBSERVATION_ITEMS, SyllabusRefs } from "./marking";
import { RecordEvent, SessionRecord, bookmarks, controlsShare } from "./record";
import { ArpaExSession, ArpaExercise, ScoringConfig, TaskCriterion, distanceToLandNm, taskCriteria, timeLimitMin, truthCpa } from "./session";

/**
 * Assessment that does not rest on one instructor's memory and opinion: the evidence the simulator has is put
 * beside each judgement, the same sheet and the same written standards are used every time, each trainee of a
 * group gets a result of his or her own, and the debrief is laid out from what happened. The assessor still
 * decides (STCW Code A-I/12, paragraph 8).
 *
 * It answers four difficulties of simulator assessment raised for this project on 18 Nov 2026: individuals in a
 * group, subjective evaluation, exercise sheets without consistent criteria, and debriefing that depends on the
 * instructor. The remedy follows what T. Karlsson's interview study recommends (Chalmers, 2011): stated
 * objectives, one sheet of them ticked during the exercise, and a structured debrief. Every written standard and
 * every rule below is a PROPOSAL for the institute to replace with its own.
 */

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const mmss = (sec: number): string => `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------- the checklist, with a written standard for each item

/** What the simulator can measure about a checklist item. */
export type EvidenceKey = "setup" | "range" | "acquire" | "risk" | "action" | "effect" | "position" | "alerts";

export interface ChecklistItem {
  item: string;
  /** What "Yes" looks like, and what "No" looks like. */
  yes: string;
  no: string;
  /** The measured facts shown beside it, if the simulator has any. */
  evidence: EvidenceKey | null;
}

const STANDARDS: Omit<ChecklistItem, "item">[] = [
  { evidence: "setup", yes: "Before relying on the picture: a range scale that suits the situation, gain set for a light speckle, sea and rain clutter no higher than needed, tuning checked.", no: "Used the picture as found. Echoes were lost to low gain or high clutter and it was not noticed." },
  { evidence: "range", yes: "Changed the range scale as the situation changed, and looked at a longer range at intervals for early warning.", no: "Stayed on one range scale throughout, or missed a vessel that a longer or shorter scale would have shown." },
  { evidence: "acquire", yes: "Every vessel that mattered was plotted or tracked early enough for steady data before a decision was needed.", no: "A vessel that mattered was plotted or acquired late, or not at all." },
  { evidence: null, yes: "Compared the vectors and data with the movement of the echo, the trails or a plot before acting on them, and did not act on preliminary data.", no: "Acted on the ARPA data alone, or on data still marked preliminary." },
  { evidence: "risk", yes: "Named the vessels with risk of collision, and the one that mattered most, from the change of bearing, the CPA and the TCPA.", no: "Did not identify the risk, or named the wrong vessel." },
  { evidence: "action", yes: "Acted in ample time, with one alteration large enough to be seen by the other vessel, as the collision regulations require for the situation.", no: "Acted late, or by a series of small alterations, or against the regulations for the situation." },
  { evidence: "effect", yes: "Watched the result of the action until the other vessel was finally past and clear, then resumed.", no: "Did not check the result, or resumed while the other vessel was still closing." },
  { evidence: "position", yes: "Kept a check on the ship's position by radar at intervals that suited the distance from danger.", no: "No check of the position by radar, or the ship left her track or closed the land without it being noticed." },
  { evidence: "alerts", yes: "Looked at what each alert meant and dealt with the cause before or as it was acknowledged.", no: "Acknowledged alerts without dealing with them, or left them unacknowledged." },
  { evidence: null, yes: "Reported what mattered, at the time it mattered, in words that could not be misunderstood.", no: "Did not report, reported late, or reported so that the listener had to ask." },
  { evidence: null, yes: "Shared the tasks, said what each was doing, and checked each other's readings.", no: "One trainee did everything, or readings were used without a check." },
  { evidence: null, yes: "Allowed for the delay of the tracker after a manoeuvre, for errors of the inputs and for targets that may be lost or not detected.", no: "Treated the displayed data as exact and complete." },
];

/** The proposed checklist with its standards (the titles are DEFAULT_OBSERVATION_ITEMS). */
export const OBSERVATION_STANDARDS: ChecklistItem[] = DEFAULT_OBSERVATION_ITEMS.map((item, i) => ({ item, ...STANDARDS[i]! }));

/**
 * The checklist in use. A line of the instructor's list is "item", or "item :: what Yes looks like :: what No
 * looks like". An item with the title of a proposed one and no standards of its own keeps the proposed standards.
 */
export function parseChecklist(lines: string[] | undefined): ChecklistItem[] {
  if (!lines || lines.length === 0) return OBSERVATION_STANDARDS;
  return lines.map((line) => {
    const [item = "", yes = "", no = ""] = line.split("::").map((x) => x.trim());
    const std = OBSERVATION_STANDARDS.find((s) => s.item === item);
    return { item, yes: yes || std?.yes || "", no: no || std?.no || "", evidence: std?.evidence ?? null };
  }).filter((c) => c.item !== "");
}

/** The checklist as lines for the instructor to edit: "item :: what Yes looks like :: what No looks like". */
export function checklistLines(items: ChecklistItem[]): string[] {
  return items.map((c) => (c.yes || c.no ? `${c.item} :: ${c.yes} :: ${c.no}` : c.item));
}

// ---------------------------------------------------------------- the measured facts

const isVessel = (kind: string): boolean => kind === "ship" || kind === "small-craft";

/** What the simulator has measured so far in an exercise, as one short line for each subject. For the instructor only: it uses the real positions. */
export function evidenceOf(s: ArpaExSession, w: World, a: ArpaSystem): Record<EvidenceKey, string> {
  const o = s.obs;
  const c = w.radar.controls;
  const safe = s.def.safeNm;
  const vessels = w.targets.filter((t) => isVessel(t.kind));
  const mattered = vessels.filter((t) => (o.minRange[t.id] ?? Infinity) < safe * 2 || (() => {
    const r = truthCpa(w, t.id);
    return !!r && r.cpa < safe && r.tcpaMinutes !== null && r.tcpaMinutes > 0;
  })());
  // In a manual plotting exercise the ARPA is off and the plot is on paper: nothing of it can be measured.
  const manual = s.def.group === "Plotting" || !!s.def.aisOff;
  const acquire = mattered.length === 0 ? "No vessel has come near the safe distance."
    : manual ? `Manual plotting: the plot is on paper and cannot be measured. Vessels that matter: ${mattered.slice(0, 4).map((t) => t.name).join(", ")}.`
    : mattered.slice(0, 4).map((t) => {
      const at = o.trackedAt[t.id];
      return at ? `${t.name}: tracked from ${mmss(at.t)}, at ${at.rangeNm.toFixed(1)} NM` : `${t.name}: not tracked`;
    }).join("; ") + ".";
  const worst = vessels.map((t) => ({ t, r: truthCpa(w, t.id) })).filter((x) => x.r && x.r.tcpaMinutes !== null && x.r.tcpaMinutes > 0).sort((x, y) => x.r!.cpa - y.r!.cpa)[0];
  const risk = worst && worst.r!.cpa < safe ? `${worst.t.name} will pass at ${worst.r!.cpa.toFixed(2)} NM in ${worst.r!.tcpaMinutes!.toFixed(0)} min if nothing changes (safe distance ${safe} NM).` : `As things stand no vessel will pass inside the safe distance of ${safe} NM.`;
  const m = o.manoeuvre;
  const action = !m ? "No alteration of course or speed."
    : `First action at ${mmss(m.time)}${m.by ? ` by ${m.by}` : ""}: ${Math.abs(m.turnDeg) >= 5 ? `${Math.abs(Math.round(m.turnDeg))}° to ${m.turnDeg > 0 ? "starboard" : "port"}` : `speed ${m.speedFrom} to ${m.speedTo} kn`}.` +
      (m.risk && m.risk.length > 0 ? ` Then: ${m.risk.slice(0, 2).map((r) => `${r.name} would have passed at ${r.cpa.toFixed(2)} NM in ${r.tcpaMin.toFixed(0)} min`).join("; ")}.` : " No vessel was then closing inside the safe distance.");
  const near = vessels.map((t) => ({ name: t.name, nm: o.minRange[t.id] ?? Infinity })).sort((x, y) => x.nm - y.nm)[0];
  const effect = near && Number.isFinite(near.nm) ? `Closest so far: ${near.name} at ${near.nm.toFixed(2)} NM (safe distance ${safe} NM).` : "No vessels.";
  const pi = o.pi.filter((p) => p.on).length;
  const land = distanceToLandNm(w);
  const position = [
    s.def.route || s.def.track ? `Greatest distance off the planned track ${o.maxXte.toFixed(2)} NM.` : "",
    pi > 0 ? `${pi} parallel index line${pi === 1 ? "" : "s"} set.` : "",
    Number.isFinite(land) && land < 50 ? `Closest to the land ${o.minLandNm.toFixed(2)} NM.` : "",
  ].filter(Boolean).join(" ") || "No planned track and no land in this exercise.";
  return {
    setup: `Range ${c.rangeNm} NM, gain ${Math.round(c.gain)}, sea ${Math.round(c.stc)}, rain ${Math.round(c.ftc)}, tuning ${Math.round(c.tuning)} (best ${Math.round(w.radar.tuningOptimum)}).`,
    range: `Range scales used: ${o.rangesUsed.join(", ")} NM; changed ${o.rangeChanges} time${o.rangeChanges === 1 ? "" : "s"}.`,
    acquire,
    risk,
    action,
    effect,
    position,
    alerts: o.alertsRaised === 0 ? "No alerts." : `${o.alertsRaised} alert${o.alertsRaised === 1 ? "" : "s"}; ${a.alarms.filter((x) => !x.acked && x.kind !== "capacity-near").length} not acknowledged now; the longest was left ${Math.round(o.maxUnackedSec)} s.`,
  };
}

// ---------------------------------------------------------------- each trainee of a group

export interface TraineeResult {
  name: string;
  /** Time at the controls, seconds, and as a share of the exercise (0 to 1). */
  seconds: number;
  share: number;
  /** Questions answered and actions done while this trainee was at the controls: how many, how many right, and the points. */
  items: number;
  right: number;
  points: number;
  max: number;
  /** The instructor's observations about this trainee by name. */
  obsYes: number;
  obsNo: number;
  /** Moments flagged as needing attention at once while this trainee had the controls. */
  flagsNow: number;
  decision: "" | "competent" | "not-yet";
  remarks: string;
}

/** What each trainee of the group did in one recorded exercise. Empty when nobody was named. */
export function traineeResults(rec: SessionRecord): TraineeResult[] {
  const shares = controlsShare(rec);
  const marks = bookmarks(rec).filter((b) => b.flag === 3);
  // Who had the controls at a given time: the last name written at or before it.
  const at = (t: number): string => (rec.controls ?? []).filter((c) => c.t <= t).pop()?.name ?? "";
  return rec.students.map((name) => {
    const seconds = shares.find((s) => s.name === name)?.seconds ?? 0;
    const mine = (rec.result?.items ?? []).filter((i) => i.by === name);
    const obs = (rec.observations ?? []).filter((o) => o.student === name);
    const d = rec.assessorBy?.[name];
    return {
      name, seconds, share: rec.simSeconds > 0 ? seconds / rec.simSeconds : 0,
      items: mine.length, right: mine.filter((i) => i.ok).length, points: mine.reduce((s, i) => s + i.points, 0), max: mine.reduce((s, i) => s + i.max, 0),
      obsYes: obs.filter((o) => o.mark === "yes").length, obsNo: obs.filter((o) => o.mark === "no").length,
      flagsNow: marks.filter((b) => at(b.t) === name).length,
      decision: d?.decision ?? "", remarks: d?.remarks ?? "",
    };
  });
}

/** The result of each trainee of a group as a table (nothing for one trainee alone). */
export function traineeTableHtml(rec: SessionRecord): string {
  if (rec.students.length < 2) return "";
  const rows = traineeResults(rec).map((t) => `<tr><td>${esc(t.name)}</td><td>${mmss(t.seconds)} (${Math.round(t.share * 100)}%)</td><td>${t.items > 0 ? `${t.right} of ${t.items} right` : "none"}</td><td>${t.points} of ${t.max}</td><td>${t.obsYes + t.obsNo > 0 ? `${t.obsYes} yes, ${t.obsNo} no` : "-"}</td><td>${t.flagsNow}</td></tr>`).join("");
  return `<h2>Each trainee</h2><table class="res"><thead><tr><th>Trainee</th><th>At the controls</th><th>Own answers and actions</th><th>Points</th><th>Observations</th><th>Flagged "now" while at the controls</th></tr></thead><tbody>${rows}</tbody></table>
<p class="small">Own answers and actions are those given or done while that trainee had the controls. What is judged from the whole exercise belongs to the group. A moment flagged while one trainee had the controls may have grown from what was done, or not done, before the changeover: look at it in the replay.</p>`;
}

/** Every trainee named in the records, in alphabetical order. */
export function traineeNames(records: SessionRecord[]): string[] {
  return [...new Set(records.flatMap((r) => r.students))].sort((a, b) => a.localeCompare(b));
}

const DECISION: Record<string, string> = { competent: "Competent", "not-yet": "Not yet competent", "": "-" };

/** One trainee's file: every recorded exercise he or she took part in, oldest first, as a page to print. */
export function traineeFileHtml(records: SessionRecord[], name: string): string {
  const mine = records.filter((r) => r.students.includes(name)).sort((a, b) => a.startedIso.localeCompare(b.startedIso));
  const rows = mine.map((r) => {
    const t = traineeResults(r).find((x) => x.name === name)!;
    const alone = r.students.length === 1;
    const group = r.result ? `${Math.round(r.result.percent)}%` : "report";
    const own = alone ? "(worked alone)" : t.items > 0 ? `${t.right} of ${t.items} right, ${t.points} of ${t.max} points` : "nothing answered at the controls";
    const decision = alone ? DECISION[r.assessor?.decision ?? ""] : DECISION[t.decision] !== "-" ? DECISION[t.decision] : `${DECISION[r.assessor?.decision ?? ""]} (group)`;
    return `<tr><td>${esc(r.startedIso.slice(0, 10))}</td><td>${esc(r.title)}${r.exam ? `<br><span class="s">${esc(r.exam.name)}, part ${r.exam.part} of ${r.exam.of}</span>` : ""}</td><td>${esc(r.students.filter((n) => n !== name).join(", ") || "-")}</td>` +
      `<td>${alone ? "all" : `${mmss(t.seconds)} (${Math.round(t.share * 100)}%)`}</td><td>${own}</td><td>${group}</td><td>${t.obsYes + t.obsNo > 0 ? `${t.obsYes} yes, ${t.obsNo} no` : "-"}</td><td>${alone ? bookmarks(r).filter((b) => b.flag === 3).length : t.flagsNow}</td><td>${esc(decision ?? "-")}${t.remarks ? `<br><span class="s">${esc(t.remarks)}</span>` : ""}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Trainee file: ${esc(name)}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font:12px/1.35 system-ui,sans-serif;color:#111;margin:0}h1{font-size:16px;margin:0 0 4px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:2px 5px;vertical-align:top;text-align:left}th{background:#eee}.s{color:#555;font-size:10.5px}
.draft{border:1px solid #b3261e;color:#b3261e;padding:3px 6px;font-size:11px}</style></head><body>
<h1>Trainee file: ${esc(name)}</h1>
<p class="draft">Training simulator record, not a certificate of competence. Points and limits are placeholders unless the institute has set its own. "At the controls" is the name chosen on the display. The assessor's decision is the prime criterion (STCW Code A-I/12, paragraph 8).</p>
<table><tr><th>Date</th><th>Exercise</th><th>With</th><th>At the controls</th><th>Own answers and actions</th><th>Group result</th><th>Observations about ${esc(name)}</th><th>Flagged "now" while at the controls</th><th>Decision</th></tr>
${rows || '<tr><td colspan="9">No recorded exercise.</td></tr>'}</table></body></html>`;
}

// ---------------------------------------------------------------- the evidence before the decision

export interface Digest {
  percent: number | null;
  passMark: number | null;
  /** Marked items, and how many were right. */
  items: number;
  right: number;
  /** Items judged from what happened (safety outcomes): how many the exercise has, and those that failed (their labels with what happened). */
  outcomes: number;
  failedOutcomes: string[];
  /** Moments flagged "now" and "soon" during the exercise. */
  urgentFlags: number;
  otherFlags: number;
  obsYes: number;
  obsNo: number;
}

export function evidenceDigest(rec: SessionRecord, cfg: ScoringConfig): Digest {
  const marks = bookmarks(rec);
  return {
    percent: rec.result ? Math.round(rec.result.percent) : null,
    passMark: rec.criteria ? rec.criteria.passPercent : cfg.passPercent,
    items: rec.result?.items.length ?? 0,
    right: rec.result?.items.filter((i) => i.ok).length ?? 0,
    outcomes: (rec.result?.items ?? []).filter((i) => i.kind === "outcome").length,
    failedOutcomes: (rec.result?.items ?? []).filter((i) => i.kind === "outcome" && !i.ok).map((i) => `${i.label}${i.student ? ` (${i.student})` : ""}`),
    urgentFlags: marks.filter((m) => m.flag === 3).length,
    otherFlags: marks.filter((m) => m.flag === 2).length,
    obsYes: (rec.observations ?? []).filter((o) => o.mark === "yes").length,
    obsNo: (rec.observations ?? []).filter((o) => o.mark === "no").length,
  };
}

/** The evidence set out for the assessor before the decision: the score, the safety outcomes, the flags, the observations, the measured facts, and the criteria that were in force. */
export function evidenceHtml(rec: SessionRecord, cfg: ScoringConfig, criteriaOpen = false): string {
  const d = evidenceDigest(rec, cfg);
  const lines: string[] = [];
  if (d.percent !== null) lines.push(`Score: <b>${d.percent}%</b>, ${d.right} of ${d.items} marked items right${d.passMark === null ? " (no pass mark has been set)" : ` (pass mark ${d.passMark}%: ${d.percent >= d.passMark ? "reached" : "not reached"})`}.`);
  else lines.push("This exercise gave a report and no points.");
  if (rec.result) lines.push(d.outcomes === 0 ? "This exercise has no item judged from what happened (no safety outcome)." : d.failedOutcomes.length === 0 ? `Every safety outcome was met (${d.outcomes}).` : `Safety outcomes not met: <b>${d.failedOutcomes.map(esc).join("; ")}</b>.`);
  lines.push(d.urgentFlags + d.otherFlags === 0 ? "Nothing was flagged during the exercise." : `Flagged during the exercise: <b>${d.urgentFlags}</b> needing attention at once, ${d.otherFlags} soon.`);
  lines.push(d.obsYes + d.obsNo === 0 ? "The instructor ticked no observation." : `Instructor's observations: ${d.obsYes} yes, ${d.obsNo} no.`);
  const measured = rec.evidence ? `<p><b>Measured (as it stood at the end):</b></p><ul>${Object.values(rec.evidence).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const c = rec.criteria;
  const criteria = c ? `<p>Marked with the criteria in force on ${esc(c.atIso.slice(0, 10))}: pass mark ${c.passPercent === null ? "none" : `${c.passPercent}%`}, time allowed ${c.timeLimitMin === null ? "no limit" : `${c.timeLimitMin} min`}.</p>` +
    (c.rows.length > 0 ? `<details${criteriaOpen ? " open" : ""}><summary>The criteria</summary><table class="res"><tbody>${c.rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.criterion)}</td><td>${r.points}</td></tr>`).join("")}</tbody></table></details>` : "") : "";
  return `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>${measured}${criteria}`;
}

/**
 * Where a decision goes against the record. The assessor may still decide so, with the reason written down:
 * these are not rules of competence, only a check that the same evidence is weighed every time.
 */
export function decisionConflicts(rec: SessionRecord, decision: "" | "competent" | "not-yet", cfg: ScoringConfig): string[] {
  const d = evidenceDigest(rec, cfg);
  const out: string[] = [];
  if (decision === "competent") {
    for (const f of d.failedOutcomes) out.push(`A safety outcome was not met: ${f}.`);
    if (d.urgentFlags > 0) out.push(`${d.urgentFlags} moment${d.urgentFlags === 1 ? " was" : "s were"} flagged as needing attention at once.`);
    if (d.percent !== null && d.passMark !== null && d.percent < d.passMark) out.push(`The score, ${d.percent}%, is below the pass mark of ${d.passMark}%.`);
    // With no pass mark set, fewer than half of the marked items right is still worth a written reason.
    if (d.passMark === null && d.items > 0 && d.right * 2 < d.items) out.push(`No pass mark is set, and ${d.right} of the ${d.items} marked items were right.`);
    if (d.obsNo > d.obsYes) out.push(`The instructor's observations are ${d.obsNo} "no" against ${d.obsYes} "yes".`);
  } else if (decision === "not-yet") {
    const scoreOk = d.percent === null || (d.passMark !== null ? d.percent >= d.passMark : d.right === d.items);
    const clean = d.failedOutcomes.length === 0 && d.urgentFlags === 0 && d.obsNo === 0 && scoreOk;
    if (clean && (rec.result || d.obsYes > 0)) out.push(`Nothing in the record is against the trainees: ${d.outcomes > 0 ? "every safety outcome was met, " : ""}nothing was flagged as urgent, no observation is "no"` +
      (d.percent !== null ? (d.passMark !== null ? ` and the score, ${d.percent}%, reaches the pass mark` : ` and all ${d.items} marked items were right`) : "") + ".");
  }
  return out;
}

/** The same check for the decision about one trainee of a group. */
export function traineeConflicts(rec: SessionRecord, name: string, decision: "" | "competent" | "not-yet"): string[] {
  const t = traineeResults(rec).find((x) => x.name === name);
  if (!t) return [];
  const out: string[] = [];
  if (decision === "competent") {
    if (t.obsNo > t.obsYes) out.push(`The observations about ${name} are ${t.obsNo} "no" against ${t.obsYes} "yes".`);
    if (t.items > 0 && t.right * 2 < t.items) out.push(`${name} had ${t.right} of ${t.items} own answers and actions right.`);
    if (rec.simSeconds > 0 && t.seconds === 0 && t.obsYes === 0) out.push(`${name} was never at the controls and no observation about ${name} is "yes".`);
  } else if (decision === "not-yet") {
    if (t.items > 0 && t.right === t.items && t.obsNo === 0) out.push(`Nothing in the record is against ${name}: all ${t.items} own answers and actions were right and no observation is "no".`);
  }
  return out;
}

export interface AssessorStat {
  name: string;
  decided: number;
  competent: number;
  /** Mean score of the exercises found competent, and of those found not yet competent. */
  meanCompetent: number | null;
  meanNotYet: number | null;
  /** Decisions that go against the record (see decisionConflicts). */
  against: number;
}

/** How each assessor has decided, so that a strict and a lenient marker can be seen side by side. */
export function assessorStats(records: SessionRecord[], cfg: ScoringConfig): AssessorStat[] {
  const by = new Map<string, SessionRecord[]>();
  for (const r of records) {
    if (!r.assessor || r.assessor.decision === "") continue;
    const n = r.assessor.name.trim() || "(no name)";
    by.set(n, [...(by.get(n) ?? []), r]);
  }
  const mean = (xs: number[]): number | null => (xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length));
  return [...by].map(([name, list]) => ({
    name, decided: list.length, competent: list.filter((r) => r.assessor!.decision === "competent").length,
    meanCompetent: mean(list.filter((r) => r.assessor!.decision === "competent" && r.result).map((r) => r.result!.percent)),
    meanNotYet: mean(list.filter((r) => r.assessor!.decision === "not-yet" && r.result).map((r) => r.result!.percent)),
    against: list.filter((r) => decisionConflicts(r, r.assessor!.decision, cfg).length > 0).length,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- the debrief, laid out from what happened

export interface DebriefPack {
  /** The key moments, in time order. */
  timeline: { t: number; text: string; kind: "flag" | "controls" | "instructor" | "alert" | "end" }[];
  well: string[];
  improve: string[];
  /** Questions to ask, written from what happened, then the exercise's own. */
  questions: string[];
}

const short = (e: RecordEvent): string => e.text.replace(/^ATTENTION: /, "").replace(/\.$/, "");

export function debriefPack(rec: SessionRecord): DebriefPack {
  const timeline: DebriefPack["timeline"] = [];
  for (const e of rec.events) {
    if (e.flag) timeline.push({ t: e.t, text: short(e), kind: "flag" });
    else if (/takes the controls\.$/.test(e.text)) timeline.push({ t: e.t, text: e.text.replace(/\.$/, ""), kind: "controls" });
    else if (/^INSTRUCTOR/.test(e.text)) timeline.push({ t: e.t, text: e.text.replace(/\.$/, ""), kind: "instructor" });
    else if (/^(ALARM|WARNING): /.test(e.text)) timeline.push({ t: e.t, text: e.text.replace(/\.$/, ""), kind: "alert" });
  }
  timeline.sort((a, b) => a.t - b.t);
  // Many alerts make a long list: the flags and the instructor's acts are all kept, the alerts thinned to the first twelve.
  let alerts = 0;
  const kept = timeline.filter((x) => x.kind !== "alert" || ++alerts <= 12);
  kept.push({ t: Math.round(rec.simSeconds), text: rec.result ? `Finished: ${Math.round(rec.result.percent)}%` : "Finished", kind: "end" });

  const items = rec.result?.items ?? [];
  const well = items.filter((i) => i.ok).map((i) => i.label);
  const improve = items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.kind === "outcome" ? i.student : i.student === "not answered" || i.student === "not done" ? i.student : `answered ${i.student}; it was ${i.correct}`}`);
  const urgent = bookmarks(rec).filter((b) => b.flag === 3);
  if (rec.result && urgent.length === 0) well.push("Nothing needed the instructor's attention at once during the exercise");

  const questions: string[] = [];
  for (const b of urgent.slice(0, 3)) questions.push(`At ${mmss(b.t)}: ${short(b)}. What did the radar show you at that moment, and what did you decide?`);
  if (rec.evidence?.["action"] && !/^No alteration/.test(rec.evidence["action"])) questions.push(`${rec.evidence["action"]} What told you it was time to act, and was it early enough?`);
  else if (rec.evidence?.["action"]) questions.push("Own ship's course and speed were not altered. Was that a decision? What were you watching to be sure it was safe?");
  for (const i of items.filter((x) => x.kind === "outcome" && !x.ok).slice(0, 2)) questions.push(`${i.label}: ${i.student}. What would you do differently, and at what moment?`);
  for (const i of items.filter((x) => x.kind === "number" && !x.ok && x.student !== "not answered").slice(0, 2)) questions.push(`${i.label}: you gave ${i.student}; it was ${i.correct}. Where did the difference come from?`);
  if (questions.length === 0) questions.push("Nothing was flagged and nothing was marked wrong. Which moment of the exercise asked most of you, and why?");
  for (const q of rec.result?.debrief ?? []) questions.push(q);
  return { timeline: kept, well, improve, questions };
}

/** The steps of the guided debrief, in order. The trainees speak first; the facts come after. */
export const DEBRIEF_STEPS: { title: string; guide: string }[] = [
  { title: "The trainees' own view", guide: "Ask the trainees to say what happened and what they would change, before anything is shown. Read their own notes. No blame: the talk is about events, not persons." },
  { title: "The key moments", guide: "Go to each bookmark in the replay. Ask what the radar showed and what was decided, before saying what the record shows." },
  { title: "The facts against the criteria", guide: "Go through what was met and what was not, item by item, with the values. The criteria are the ones given at the briefing." },
  { title: "The questions", guide: "Ask the questions written from this exercise, then the exercise's own questions." },
  { title: "Goals agreed", guide: "Agree with the trainees one or two things to do differently next time, and write them down." },
];

/** The debrief pack as a page to print: the key moments, what was met and what was not, the questions, the goals. */
export function debriefPackHtml(rec: SessionRecord): string {
  const p = debriefPack(rec);
  const li = (xs: string[]): string => (xs.length > 0 ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>-</p>");
  const who = traineeResults(rec).filter((t) => t.seconds > 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Debrief pack</title>
<style>@page{size:A4;margin:12mm}body{font:12.5px/1.4 system-ui,sans-serif;color:#111;margin:0}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:12px 0 3px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:2px 5px;vertical-align:top;text-align:left}th{background:#eee}.flag{font-weight:600}ul{margin:2px 0 2px 18px;padding:0}
.draft{border:1px solid #b3261e;color:#b3261e;padding:3px 6px;font-size:11px}.g{color:#555}</style></head><body>
<h1>Debrief: ${esc(rec.title)}</h1>
<p>${esc(rec.students.join(" / ") || "no names")} &nbsp; ${esc(rec.startedIso.slice(0, 16).replace("T", " "))} &nbsp; ${mmss(rec.simSeconds)} of exercise time${who.length > 1 ? ` &nbsp; At the controls: ${who.map((t) => `${esc(t.name)} ${mmss(t.seconds)}`).join(", ")}` : ""}</p>
<p class="draft">Made by the simulator from the record of this exercise, as an aid to the instructor. Limits are placeholders unless the institute has set its own. Not a certificate of competence.</p>
${DEBRIEF_STEPS.map((s, i) => `<h2>${i + 1}. ${esc(s.title)}</h2><p class="g">${esc(s.guide)}</p>` + (
    i === 0 ? `<p>${rec.debrief ? esc([rec.debrief.self, rec.debrief.peer].filter(Boolean).join(" / ")) || "No notes were entered by the trainees." : "No notes were entered by the trainees."}</p>`
    : i === 1 ? `<table><tr><th>Time</th><th>What happened</th></tr>${p.timeline.map((t) => `<tr><td>${mmss(t.t)}</td><td class="${t.kind === "flag" ? "flag" : ""}">${esc(t.text)}</td></tr>`).join("")}</table>`
    : i === 2 ? `<p><b>Met</b></p>${li(p.well)}<p><b>Not met</b></p>${li(p.improve)}${rec.evidence ? `<p><b>Measured (as it stood at the end)</b></p>${li(Object.values(rec.evidence))}` : ""}`
    : i === 3 ? li(p.questions)
    : `<p>${esc(rec.debriefDone?.goals || rec.debrief?.goals || "")}</p><p style="height:50px;border:1px solid #999"></p>`)).join("")}
</body></html>`;
}

// ---------------------------------------------------------------- the class on one exercise

export interface ClassRow {
  recId: string;
  who: string;
  date: string;
  percent: number | null;
  minutes: number;
  /** When own ship's course or speed was first altered, exercise time in seconds, or null. */
  actedAt: number | null;
  closest: { name: string; nm: number } | null;
  flagsNow: number;
  flagsSoon: number;
}

/** Every recorded attempt at one exercise, the best score first, for a debrief of the whole class. */
export function classComparison(records: SessionRecord[], exerciseId: string): ClassRow[] {
  return records.filter((r) => r.exerciseId === exerciseId).map((r) => {
    const marks = bookmarks(r);
    return {
      recId: r.id, who: r.students.join(" / ") || "no names", date: r.startedIso.slice(0, 10), percent: r.result ? Math.round(r.result.percent) : null, minutes: Math.round(r.simSeconds / 60),
      actedAt: r.progress?.actedAt ?? null, closest: r.progress?.closest ?? null, flagsNow: marks.filter((m) => m.flag === 3).length, flagsSoon: marks.filter((m) => m.flag === 2).length,
    };
  }).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.flagsNow - b.flagsNow);
}

// ---------------------------------------------------------------- the criteria in force, and one sheet for every exercise

/** The criteria and limits an exercise is being marked with, to keep in its record. */
export function criteriaSnapshot(def: ArpaExercise, cfg: ScoringConfig, atIso: string): NonNullable<SessionRecord["criteria"]> {
  return { atIso, rows: taskCriteria(def, cfg), passPercent: cfg.passPercent, timeLimitMin: timeLimitMin(def, cfg) };
}

/** What goes on the standard sheet of an exercise. */
export interface SheetData {
  heading: string;
  aim: string;
  refs: SyllabusRefs | null;
  briefing: string[];
  rows: TaskCriterion[];
  timeLimitMin: number | null;
  safeNm: number;
  debrief: string[];
  /** A note under the table of marked items, if any. */
  note?: string;
}

/**
 * The standard sheet of one exercise, the same form for all: its objective, what the simulator measures and
 * the limits in use, what the instructor observes and the standard for each item, and the pass standard. It is
 * made from the data that does the marking, so the sheet and the marking cannot differ.
 */
export function sheetHtml(d: SheetData, cfg: ScoringConfig, checklist: ChecklistItem[]): string {
  const kind: Record<TaskCriterion["kind"], string> = { number: "A value", choice: "A choice", action: "An action", outcome: "Judged from what happened" };
  return `<section class="sheet"><h1>${esc(d.heading)}</h1>
<p class="draft">Exercise sheet made by the simulator from the criteria it marks with. The limits and points are placeholders unless the institute has set its own; the instructor's items and their standards are a proposal. Training simulator, not type approved, not for navigation.</p>
<h2>1. Objective</h2><p>${esc(d.aim)}</p>
${d.refs ? `<p class="s">STCW A-II/1: ${esc(d.refs.stcw)}. Model Course 1.07: ${esc(d.refs.mc107)}. DG Shipping Circular 5 of 2004: ${esc(d.refs.dgs)}. (A draft mapping, not reviewed.)</p>` : ""}
<h2>2. Briefing</h2><ol>${d.briefing.map((b) => `<li>${esc(b)}</li>`).join("")}</ol>
<h2>3. What the simulator measures</h2>
<table><tr><th></th><th>Item</th><th>Kind</th><th>How it is judged</th><th>Points</th></tr>
${d.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.label)}</td><td>${kind[r.kind]}</td><td>${esc(r.criterion)}</td><td class="num">${r.points}</td></tr>`).join("")}
<tr><th></th><th colspan="3">Total</th><th class="num">${d.rows.reduce((s, r) => s + r.points, 0)}</th></tr></table>
${d.note ? `<p>${esc(d.note)}</p>` : ""}
<p>Time allowed: ${d.timeLimitMin === null ? "no limit" : `${d.timeLimitMin} minutes of exercise time`}. Safe passing distance in this exercise: ${d.safeNm} NM.</p>
<h2>4. What the instructor observes</h2>
<table><tr><th>Item</th><th>Yes</th><th>No</th></tr>${checklist.map((c) => `<tr><td>${esc(c.item)}</td><td>${esc(c.yes)}</td><td>${esc(c.no)}</td></tr>`).join("")}</table>
<h2>5. Standard</h2>
<p>Pass mark: ${cfg.passPercent === null ? "none set (the simulator shows no pass or fail)" : `${cfg.passPercent}% of the points`}. The score is a guide: the assessor decides, on the measured items, the observations and the debrief (STCW Code A-I/12, paragraph 8). In a group, each trainee is assessed on what was done while he or she was at the controls and on the observations about him or her.</p>
<h2>6. Debrief questions</h2><ol>${d.debrief.map((b) => `<li>${esc(b)}</li>`).join("")}</ol></section>`;
}

/** The standard sheet of a marked radar, plotting or ARPA exercise. */
export function exerciseSheetHtml(ex: ArpaExercise, cfg: ScoringConfig, checklist: ChecklistItem[], refs: SyllabusRefs | null): string {
  return sheetHtml({
    heading: `Exercise ${ex.number}. ${ex.title}`, aim: ex.aim, refs, briefing: ex.briefing, rows: taskCriteria(ex, cfg), timeLimitMin: timeLimitMin(ex, cfg), safeNm: ex.safeNm, debrief: ex.debrief,
  }, cfg, checklist);
}

/** One or more exercise sheets as a document to print, one exercise to a page. */
export function exerciseSheetsHtml(sheets: string[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Exercise sheets</title>
<style>@page{size:A4;margin:11mm}body{font:11.5px/1.35 system-ui,sans-serif;color:#111;margin:0}.sheet{page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}
h1{font-size:15px;margin:0 0 3px}h2{font-size:12.5px;margin:9px 0 2px}p{margin:3px 0}ol{margin:2px 0 2px 20px;padding:0}.s{color:#555;font-size:10.5px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:2px 5px;vertical-align:top;text-align:left}th{background:#eee}.num{text-align:right}
.draft{border:1px solid #b3261e;color:#b3261e;padding:3px 6px;font-size:10.5px}</style></head><body>${sheets.join("")}</body></html>`;
}

