import { ArpaExercise, ScoringConfig, TaskCriterion, taskCriteria } from "./session";
import type { SessionRecord } from "./record";

/**
 * Printable marking sheets, one page per exercise, for the institute to complete. Each sheet lists
 * what the simulator checks and the value it uses now (a PLACEHOLDER unless the institute has
 * changed it under Scoring settings), with empty boxes for the institute's own tolerance, points and
 * pass mark, the items the assessor judges, and the assessor's decision and signature (STCW A-I/12
 * 8.6: the prime criterion is the assessor's judgement that the task was done safely and effectively).
 */

export interface SyllabusRefs {
  /** STCW Code Table A-II/1, use of radar and ARPA (summarised). */
  stcw: string;
  /** IMO Model Course 1.07 (2017) topics and practical sessions. */
  mc107: string;
  /** DG Shipping Training Circular 5 of 2004, ARPA course and assessment. */
  dgs: string;
}

/** Where each exercise sits in the syllabus: a summary of docs/SYLLABUS-MATRIX.md, section 5 (a draft, not reviewed). */
export const SYLLABUS_REFS: Record<string, SyllabusRefs> = {
  "arpa-1": { stcw: "ARPA: acquisition; performance and processing delays", mc107: "5.5, 6.1, 6.3", dgs: "Operating ARPA; target information" },
  "arpa-2": { stcw: "ARPA: true and relative vectors", mc107: "6.3, 6.4", dgs: "True and relative modes; errors of interpretation" },
  "arpa-3": { stcw: "Radar: other ships' changes of course and speed; ARPA: delays", mc107: "5.6, 5.7, 6.4", dgs: "Tracking limits and delays" },
  "arpa-4": { stcw: "ARPA: acquisition methods; exclusion areas", mc107: "5.5, 6.1", dgs: "Acquisition and exclusion areas" },
  "arpa-5": { stcw: "ARPA: operational warnings", mc107: "6.3", dgs: "Target information" },
  "arpa-6": { stcw: "ARPA: trial manoeuvres; Radar: collision regulations", mc107: "4.4, 7.4", dgs: "Trial manoeuvre; collision regulations" },
  "arpa-7": { stcw: "ARPA: vectors; interpretation", mc107: "6.4", dgs: "Stabilisation modes" },
  "arpa-8": { stcw: "ARPA: system tests; over-reliance", mc107: "6.5, 6.6, 6.7", dgs: "Errors in displayed data; tests; over-reliance" },
  "arpa-9": { stcw: "Radar: collision regulations", mc107: "7.1, 7.4, 7-1", dgs: "Collision regulations" },
  "radar-10": { stcw: "Radar: parallel indexing", mc107: "3.3, 3-2, 3.4", dgs: "Demonstration: parallel indexing" },
  "radar-11": { stcw: "Radar: racons and SARTs", mc107: "3.2", dgs: "-" },
  "radar-22": { stcw: "Radar: setting up and maintaining displays", mc107: "2.1, 2-1", dgs: "Demonstration: display set-up" },
  "radar-23": { stcw: "Radar: range and bearing; position", mc107: "2.2, 3.1, 3-1, 6.5, 6.7", dgs: "Demonstration: plotting own ship's position" },
  "radar-24": { stcw: "Radar: parallel indexing; ARPA: operational warnings", mc107: "3.3, 3-2, 3.4", dgs: "Demonstration: parallel indexing" },
  "radar-25": { stcw: "Radar: performance factors; collision regulations", mc107: "1.5, 6.3, 7.1, 7.4, 7-1", dgs: "Collision regulations" },
  "radar-26": { stcw: "ARPA: vectors; interpretation; Radar: collision regulations", mc107: "6.3, 6.4, 7.4", dgs: "Stabilisation modes; errors of interpretation" },
  "radar-27": { stcw: "Radar: position; keeping a planned track", mc107: "3.3, 3.4", dgs: "Demonstration: plotting own ship's position" },
  "radar-33": { stcw: "Radar: position; tidal streams and set and drift", mc107: "3.3, 3.4", dgs: "Set and drift; plotting own ship's position" },
  "radar-28": { stcw: "Radar: collision regulations", mc107: "7.1, 7.4", dgs: "Collision regulations" },
  "radar-29": { stcw: "Radar: position; search and rescue", mc107: "3.2", dgs: "-" },
  "radar-30": { stcw: "Radar: performance factors; collision regulations", mc107: "1.5, 7.2", dgs: "Collision regulations" },
  "arpa-31": { stcw: "ARPA: acquisition; performance and processing delays", mc107: "5.5, 6.1, 6.3", dgs: "Operating ARPA; target information" },
  "arpa-32": { stcw: "Radar: collision regulations; ARPA: risks of over-reliance", mc107: "6.7, 7.1, 7.4", dgs: "Collision regulations" },
};
const PLOTTING_REFS: SyllabusRefs = { stcw: "Radar: plotting; CPA and TCPA; collision regulations", mc107: "4.1-4.5, 7.4", dgs: "Manual plotting test" };

export function syllabusRefs(ex: ArpaExercise): SyllabusRefs | null {
  return SYLLABUS_REFS[ex.id] ?? (ex.group === "Plotting" ? PLOTTING_REFS : null);
}

/** What the assessor judges that the simulator does not check, by the kind of exercise. */
export function assessorItems(ex: ArpaExercise): string[] {
  const avoid = ex.tasks.some((t) => t.kind === "outcome" && (t.id === "safe" || t.id === "result" || t.id === "act" || t.id === "action"));
  const items = ["Uses the radar and ARPA controls correctly and in a sensible order"];
  if (avoid) {
    items.push(
      "Systematic observation before acting, and the situation kept under review",
      "Timing of the avoiding action (early enough), and course and speed resumed when clear",
      "Communication: clear, concise and acknowledged",
    );
  } else {
    items.push("Checks the result by another means where one is available", "Keeps the ship safe throughout");
  }
  return items;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const KIND: Record<TaskCriterion["kind"], string> = { number: "Question (value)", choice: "Question (choice)", action: "Action", outcome: "Outcome" };
const BOX = '<span class="box"></span>';

function sheet(ex: ArpaExercise, cfg: ScoringConfig): string {
  const items = taskCriteria(ex, cfg);
  const refs = syllabusRefs(ex);
  const total = items.reduce((s, i) => s + i.points, 0);
  const rows = items.map((i, k) => {
    const how = i.kind === "number" ? "within the tolerance of the real value at the moment of answering"
      : i.kind === "choice" ? "the correct choice"
      : i.kind === "action" ? "seen done during the exercise"
      : `at the end, from what happened: ${i.limit || "see the item"}`;
    const now = i.kind === "number" ? i.limit : i.kind === "outcome" ? "as stated" : "-";
    const ownTol = i.kind === "number" || i.kind === "outcome" ? BOX : "-";
    return `<tr><td>${k + 1}</td><td>${esc(i.label)}<div class="kind">${KIND[i.kind]}: ${esc(how)}</div></td><td>${esc(now)}</td><td class="fill">${ownTol}</td><td class="num">${i.points}</td><td class="fill">${BOX}</td><td class="fill">${BOX}</td></tr>`;
  }).join("");
  const assessor = assessorItems(ex).map((t, k) => `<tr><td>${String.fromCharCode(97 + k)}</td><td>${esc(t)}</td><td class="fill">${BOX}</td><td class="remarks"></td></tr>`).join("");
  const pass = cfg.passPercent === null ? "none set (the simulator shows no pass or fail)" : `${cfg.passPercent}%`;
  return `<section class="sheet">
<h1>Marking sheet: exercise ${ex.number}. ${esc(ex.title)}</h1>
<p class="draft">DRAFT for the institute to complete. The values in the column "Simulator now" are the settings in use when this sheet was printed: the simulator's PLACEHOLDERS unless the institute has changed them under Scoring settings. They are not an approved marking scheme. Training simulator: not type approved, not for navigation.</p>
<table class="who"><tr><td>Trainee</td><td></td><td>Batch</td><td></td><td>Date</td><td></td></tr><tr><td>Display / own ship</td><td></td><td>Assessor</td><td></td><td>Attempt</td><td></td></tr></table>
<p><b>Aim:</b> ${esc(ex.aim)}</p>
${refs ? `<p class="refs"><b>Syllabus (draft mapping):</b> STCW A-II/1: ${esc(refs.stcw)}. Model Course 1.07: ${esc(refs.mc107)}. DGS Circular 5/2004: ${esc(refs.dgs)}.</p>` : ""}
<h2>What the simulator checks</h2>
<table class="items"><thead><tr><th>#</th><th>Item, and how the simulator judges it</th><th>Simulator now</th><th>Institute's tolerance or limit</th><th>Points now</th><th>Institute's points</th><th>Met</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td></td><td colspan="3">Total</td><td class="num">${total}</td><td class="fill">${BOX}</td><td class="fill">${BOX}</td></tr></tfoot></table>
<h2>What the assessor judges (not checked by the simulator)</h2>
<table class="items"><thead><tr><th></th><th>Item</th><th>Met</th><th>Remarks</th></tr></thead><tbody>${assessor}
<tr><td>${String.fromCharCode(97 + assessorItems(ex).length)}</td><td>&nbsp;</td><td class="fill">${BOX}</td><td class="remarks"></td></tr></tbody></table>
<h2>Result</h2>
<table class="who"><tr><td>Pass mark now</td><td>${esc(pass)}</td><td>Institute's pass mark</td><td>${BOX} %</td></tr>
<tr><td>Simulator's score</td><td>${BOX} %</td><td>Assessor's decision</td><td>${BOX} Competent: carried out safely and effectively &nbsp; ${BOX} Not yet competent</td></tr></table>
<p class="remarksBox">Remarks:</p>
<table class="who sign"><tr><td>Assessor</td><td></td><td>Signature</td><td></td><td>Date</td><td></td></tr>
<tr><td>Marking scheme approved by (institute)</td><td colspan="5"></td></tr></table>
<p class="small">Model Course 1.07 Part E, appendix 6, gives sample checklists (one scores ten tasks 3, 2 or 1, with a sample pass of 21 out of 30). They are samples: use them only if the institute decides to. The prime criterion is the assessor's judgement (STCW A-I/12, 8.6).</p>
</section>`;
}

/** One printable page for one exercise, as a whole HTML document. */
export function markingSheetHtml(ex: ArpaExercise, cfg: ScoringConfig): string {
  return markingSheetsHtml([ex], cfg);
}

/** Printable marking sheets, one page per exercise, as one HTML document. */
export function markingSheetsHtml(exs: ArpaExercise[], cfg: ScoringConfig): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Marking sheets</title>
<style>
@page{size:A4;margin:10mm}
body{font:10.5px/1.3 system-ui,sans-serif;color:#111;margin:0}
.sheet{page-break-after:always;break-after:page;padding:2px 0}
.sheet:last-child{page-break-after:auto;break-after:auto}
h1{font-size:14px;margin:0 0 3px}h2{font-size:11.5px;margin:7px 0 2px}
p{margin:3px 0}.draft{border:1px solid #b3261e;color:#b3261e;padding:3px 6px;font-size:10px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:1px 4px;vertical-align:top;text-align:left}
th{background:#eee;font-size:10px}.num{text-align:right}.kind{color:#555;font-size:9px}
.items td:first-child{width:14px}.items td:nth-child(3){width:58px}.fill{width:56px}.remarks{min-width:150px}
.who td{height:16px}.who td:nth-child(odd){background:#f4f4f4;width:12%;font-size:10px}
.box{display:inline-block;width:11px;height:11px;border:1px solid #333;vertical-align:middle}
.items .fill .box{width:46px;height:12px}
.remarksBox{border:1px solid #888;height:36px;padding:2px 4px}
.small{color:#555;font-size:9px}.refs{font-size:10px}
</style></head><body>
${exs.map((e) => sheet(e, cfg)).join("\n")}
</body></html>`;
}

// ---------------------------------------------------------------- examinations

/**
 * A practical examination is a set of exercises worked one after the other on one display. The two sets below
 * are a PROPOSAL for the institute to change (instructor station, EXERCISES, Examinations): no syllabus or
 * circular read for this project lists the parts of the ROC or the ARPA practical examination.
 */
export const DEFAULT_EXAMS: Record<"roc" | "arpa", { name: string; parts: string[] }> = {
  roc: { name: "ROC practical examination", parts: ["radar-22", "plot-02", "plot-04", "roc-fix", "radar-10"] },
  arpa: { name: "ARPA practical examination", parts: ["arpa-1", "arpa-5", "arpa-6", "arpa-8", "arpa-31"] },
};

const escE = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export interface ExamTotal {
  /** Parts that were finished, of the parts the examination has. */
  done: number;
  of: number;
  /** Points over the parts that are marked with points (the ROC exercises give a report instead). */
  score: number;
  max: number;
  percent: number | null;
  /** Null when no pass mark is set, or when a part is missing. */
  passed: boolean | null;
}

/** The latest record of each part of one examination, in part order. */
export function examParts(records: SessionRecord[], examId: string): SessionRecord[] {
  const byPart = new Map<number, SessionRecord>();
  for (const r of records) {
    if (r.exam?.id !== examId) continue;
    const cur = byPart.get(r.exam.part);
    if (!cur || r.startedIso >= cur.startedIso) byPart.set(r.exam.part, r);
  }
  return [...byPart.values()].sort((a, b) => a.exam!.part - b.exam!.part);
}

/** Points over all the marked parts of an examination. A pass needs every part finished and the pass mark reached over all of them. */
export function examTotal(parts: SessionRecord[], cfg: ScoringConfig): ExamTotal {
  const of = parts[0]?.exam?.of ?? 0;
  const marked = parts.filter((r) => r.result);
  const score = marked.reduce((s, r) => s + r.result!.score, 0);
  const max = marked.reduce((s, r) => s + r.result!.max, 0);
  const percent = max > 0 ? (100 * score) / max : null;
  const complete = parts.length === of && of > 0;
  return { done: parts.length, of, score, max, percent, passed: cfg.passPercent === null || percent === null || !complete ? null : percent >= cfg.passPercent };
}

/** One printable page per examination found in the records: its parts, the points, and room for the assessor's decision. */
export function examSheetsHtml(records: SessionRecord[], cfg: ScoringConfig): string {
  const ids = [...new Set(records.filter((r) => r.exam).map((r) => r.exam!.id))];
  const sheets = ids.map((id) => {
    const parts = examParts(records, id);
    const first = parts[0]!;
    const t = examTotal(parts, cfg);
    const rows = Array.from({ length: t.of }, (_, i) => {
      const r = parts.find((p) => p.exam!.part === i + 1);
      if (!r) return `<tr><td>${i + 1}</td><td colspan="4">not done</td></tr>`;
      const res = r.result;
      return `<tr><td>${i + 1}</td><td>${escE(r.title)}</td><td class="num">${(r.simSeconds / 60).toFixed(0)} min</td>` +
        (res ? `<td class="num">${res.score} / ${res.max}</td><td class="num">${Math.round(res.percent)}%</td>` : `<td colspan="2">${r.summary.map(escE).join("<br>") || "report only"}</td>`) + `</tr>`;
    }).join("");
    return `<section class="sheet"><h1>${escE(first.exam!.name)}</h1>
<p class="draft">DRAFT: the parts of this examination, the tolerances and the points are placeholders set at the instructor station, not an approved examination. Training simulator, not type approved, not for navigation.</p>
<table class="who"><tr><td>Candidate(s)</td><td>${escE(first.students.join(", ") || "-")}</td><td>Batch</td><td>${escE(first.batch || "-")}</td><td>Date</td><td>${escE(first.startedIso.slice(0, 10))}</td></tr></table>
<h2>Parts</h2><table><tr><th></th><th>Exercise</th><th>Time</th><th>Points</th><th>Per cent</th></tr>${rows}
<tr><th></th><th>Total of the marked parts (${t.done} of ${t.of} parts done)</th><th></th><th class="num">${t.score} / ${t.max}</th><th class="num">${t.percent === null ? "-" : `${Math.round(t.percent)}%`}</th></tr></table>
<p>Pass mark: ${cfg.passPercent === null ? "none set (the simulator shows no pass or fail)" : `${cfg.passPercent}%: ${t.passed === null ? "not all parts done" : t.passed ? "reached" : "not reached"}`}. The score is a guide only: the assessor's decision is the prime criterion (STCW Code A-I/12, paragraph 8).</p>
<h2>Assessor</h2><table class="who"><tr><td>Decision</td><td><span class="box"></span> Competent &nbsp; <span class="box"></span> Not yet competent</td><td>Name</td><td></td><td>Signature</td><td></td></tr><tr><td>Remarks</td><td colspan="5" style="height:60px"></td></tr></table></section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Examination results</title>
<style>@page{size:A4;margin:12mm}body{font:12px/1.35 system-ui,sans-serif;color:#111;margin:0}.sheet{page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}
h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:10px 0 3px}.draft{border:1px solid #b3261e;color:#b3261e;padding:3px 6px;font-size:11px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:2px 5px;vertical-align:top;text-align:left}th{background:#eee}.num{text-align:right}
.who td:nth-child(odd){background:#f4f4f4;width:12%}.box{display:inline-block;width:11px;height:11px;border:1px solid #333;vertical-align:middle}</style></head><body>
${sheets || "<p>No examination has been taken yet.</p>"}</body></html>`;
}

// ---------------------------------------------------------------- observation checklist

/**
 * What the instructor ticks while watching a display: the things the simulator cannot judge by itself. This
 * list is a PROPOSAL for the institute to replace with its own objectives (instructor station, CLASSROOM,
 * Observe, "Checklist items"). It follows the idea of a standard sheet of objectives chosen at the briefing and
 * ticked during the exercise (Karlsson, Chalmers, 2011); the wording is ours.
 */
export const DEFAULT_OBSERVATION_ITEMS: string[] = [
  "Radar set up before use: range scale, gain, clutter and tuning checked",
  "Range scale changed to suit the situation, with a look at long range at intervals",
  "Targets plotted or acquired in good time",
  "ARPA data checked against the radar picture before it was used",
  "Risk of collision judged from the information available",
  "Action taken early, large enough to be seen, and in line with the collision regulations",
  "Effect of the action checked until the other vessel was past and clear",
  "Position monitored by radar",
  "Alerts understood and dealt with, not only acknowledged",
  "Reports to the master or the bridge team clear and in time",
  "Worked as a team: tasks shared and cross-checked",
  "Limits of the radar and the ARPA kept in mind: delays, errors, lost targets",
];
