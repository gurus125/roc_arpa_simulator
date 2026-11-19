import { traineeResults } from "./assess";
import { SessionRecord, bookmarks } from "./record";

/**
 * Performance history: what one trainee has done over time, and what a batch has done of the exercises
 * assigned to it. Worked from the records (the full ones and the older ones kept without their replay).
 *
 * A line through the scores of different exercises is not a measure of progress by itself: exercises differ in
 * difficulty. The fair comparison is the same exercise attempted again, which is what "change" below gives.
 */

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** One recorded exercise a trainee took part in. */
export interface AttemptRow {
  recId: string;
  /** When it was started (ISO date and time). */
  date: string;
  exerciseId: string;
  title: string;
  /** The score of the exercise, per cent, rounded; null when it gave no points. In a group this is the group's score. */
  percent: number | null;
  /** Worked alone. In a group, `own` is what was answered or done while this trainee had the controls. */
  alone: boolean;
  own: { right: number; items: number } | null;
  /** Moments flagged as needing attention at once (alone: in the exercise; in a group: while this trainee had the controls). */
  flagsNow: number;
  /** The assessor's decision about this trainee if there is one, otherwise the decision for the group. */
  decision: "" | "competent" | "not-yet";
  /** The examination it was a part of, if any. */
  exam?: string;
}

/** Every recorded exercise of one trainee, oldest first. */
export function traineeAttempts(records: SessionRecord[], name: string): AttemptRow[] {
  return records.filter((r) => r.students.includes(name)).sort((a, b) => a.startedIso.localeCompare(b.startedIso)).map((r) => {
    const alone = r.students.length === 1;
    const t = traineeResults(r).find((x) => x.name === name);
    const own = t?.decision ? t.decision : "";
    return {
      recId: r.id, date: r.startedIso, exerciseId: r.exerciseId, title: r.title,
      percent: r.result ? Math.round(r.result.percent) : null,
      alone, own: alone || !t ? null : { right: t.right, items: t.items },
      flagsNow: alone ? bookmarks(r).filter((b) => b.flag === 3).length : t?.flagsNow ?? 0,
      decision: own || r.assessor?.decision || "",
      ...(r.exam ? { exam: r.exam.name } : {}),
    };
  });
}

/** One exercise as a trainee has done it: how often, and the first, best and latest score. */
export interface ExerciseProgress {
  exerciseId: string;
  title: string;
  attempts: number;
  first: number | null;
  best: number | null;
  latest: number | null;
  /** Latest score less the first, when the exercise was scored at least twice; otherwise null. */
  change: number | null;
  /** Found competent at one attempt at least. */
  competent: boolean;
}

/** The attempts grouped by exercise, in the order each exercise was first attempted. */
export function exerciseProgress(rows: AttemptRow[]): ExerciseProgress[] {
  const by = new Map<string, AttemptRow[]>();
  for (const r of rows) by.set(r.exerciseId, [...(by.get(r.exerciseId) ?? []), r]);
  return [...by].map(([exerciseId, list]) => {
    const scored = list.map((r) => r.percent).filter((p): p is number => p !== null);
    return {
      exerciseId, title: list[list.length - 1]!.title, attempts: list.length,
      first: scored[0] ?? null, best: scored.length > 0 ? Math.max(...scored) : null, latest: scored[scored.length - 1] ?? null,
      change: scored.length >= 2 ? scored[scored.length - 1]! - scored[0]! : null,
      competent: list.some((r) => r.decision === "competent"),
    };
  });
}

export interface ProgressSummary {
  attempts: number;
  exercises: number;
  /** Mean of the latest score of each scored exercise, rounded; null when nothing was scored. */
  meanLatest: number | null;
  /** Exercises found competent at least once. */
  competent: number;
  /** Exercises attempted again whose latest score is above, or below, the first. */
  improved: number;
  fell: number;
}

export function progressSummary(rows: AttemptRow[]): ProgressSummary {
  const ex = exerciseProgress(rows);
  const latest = ex.map((e) => e.latest).filter((p): p is number => p !== null);
  return {
    attempts: rows.length, exercises: ex.length,
    meanLatest: latest.length > 0 ? Math.round(latest.reduce((a, b) => a + b, 0) / latest.length) : null,
    competent: ex.filter((e) => e.competent).length,
    improved: ex.filter((e) => e.change !== null && e.change > 0).length,
    fell: ex.filter((e) => e.change !== null && e.change < 0).length,
  };
}

// ---------------------------------------------------------------- the chart

/** Where the chart puts things, in the units of its viewBox. */
export const CHART = { width: 640, height: 200, left: 40, right: 68, top: 16, bottom: 30 };

/** The position of a score (0 to 100) and of the i-th of n attempts in the chart. */
export const chartY = (percent: number): number => CHART.top + (1 - Math.min(100, Math.max(0, percent)) / 100) * (CHART.height - CHART.top - CHART.bottom);
export const chartX = (i: number, n: number): number => (n <= 1 ? (CHART.left + CHART.width - CHART.right) / 2 : CHART.left + (i / (n - 1)) * (CHART.width - CHART.left - CHART.right));

/**
 * The scored attempts as a line chart, oldest first, evenly spaced: one series, so no legend; the value of the
 * latest attempt at the end of the line; the pass mark, if one is set, as a labelled rule. Each point names its
 * exercise, date and score when the pointer rests on it, and the table beside the chart gives every value.
 * The colours come from the page (--viz1, --text, --muted, --line, --panel) with values for white paper as the
 * fallback: the blue is the first step of a palette checked for both surfaces. Returns "" with nothing scored.
 */
export function progressSvg(rows: AttemptRow[], passMark: number | null): string {
  const pts = rows.filter((r) => r.percent !== null);
  if (pts.length === 0) return "";
  const n = pts.length;
  const xy = pts.map((r, i) => ({ x: chartX(i, n), y: chartY(r.percent!), r }));
  const f = (v: number): string => v.toFixed(1);
  const x0 = CHART.left, x1 = CHART.width - CHART.right;
  const grid = [0, 50, 100].map((v) => `<line x1="${x0}" x2="${x1}" y1="${f(chartY(v))}" y2="${f(chartY(v))}" stroke="var(--line, #d9d9d6)" stroke-width="1"/>` +
    `<text x="${x0 - 6}" y="${f(chartY(v) + 4)}" text-anchor="end" fill="var(--muted, #52514e)">${v}%</text>`).join("");
  const last = xy[n - 1]!;
  // The pass mark: a rule across the plot, named in the margin at its right end unless the value written at
  // the end of the line is in the way (the words under the chart name it in any case).
  const pass = passMark === null ? "" :
    `<line x1="${x0}" x2="${x1}" y1="${f(chartY(passMark))}" y2="${f(chartY(passMark))}" stroke="var(--muted, #52514e)" stroke-width="1"/>` +
    (Math.abs(chartY(passMark) - last.y) >= 14 ? `<text x="${x1 + 9}" y="${f(chartY(passMark) + 4)}" fill="var(--muted, #52514e)">pass ${passMark}%</text>` : "");
  const line = n > 1 ? `<polyline fill="none" stroke="var(--viz1, #2a78d6)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${xy.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}"/>` : "";
  const dots = xy.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="4" fill="var(--viz1, #2a78d6)" stroke="var(--panel, #ffffff)" stroke-width="2"/>`).join("");
  // A target larger than the dot, so that the pointer need not land on it exactly.
  const hits = xy.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="12" fill="transparent"><title>${esc(p.r.date.slice(0, 10))}: ${esc(p.r.title)}, ${p.r.percent}%</title></circle>`).join("");
  const end = `<text x="${f(last.x + 9)}" y="${f(last.y + 4)}" fill="var(--text, #0b0b0b)" font-weight="600">${last.r.percent}%</text>`;
  const day = (r: AttemptRow): string => esc(r.date.slice(0, 10));
  const dates = n > 1
    ? `<text x="${x0}" y="${CHART.height - 8}" fill="var(--muted, #52514e)">${day(pts[0]!)}</text><text x="${x1}" y="${CHART.height - 8}" text-anchor="end" fill="var(--muted, #52514e)">${day(pts[n - 1]!)}</text>`
    : `<text x="${f(last.x)}" y="${CHART.height - 8}" text-anchor="middle" fill="var(--muted, #52514e)">${day(pts[0]!)}</text>`;
  const label = `Score at each of ${n} scored attempt${n === 1 ? "" : "s"}, oldest first: ${n === 1 ? `${pts[0]!.percent}%` : `first ${pts[0]!.percent}%, latest ${pts[n - 1]!.percent}%`}.`;
  return `<svg class="viz" viewBox="0 0 ${CHART.width} ${CHART.height}" role="img" aria-label="${esc(label)}" style="width:100%;max-width:${CHART.width}px;height:auto;font:11px system-ui,sans-serif;font-variant-numeric:tabular-nums">${grid}${pass}${line}${dots}${end}${dates}${hits}</svg>`;
}

const DECISION: Record<string, string> = { competent: "Competent", "not-yet": "Not yet competent", "": "-" };
const pct = (p: number | null): string => (p === null ? "-" : `${p}%`);
const signed = (c: number | null): string => (c === null ? "-" : c > 0 ? `+${c}` : String(c));

/** One trainee's progress: a line of figures, the chart, each exercise, and every attempt. */
export function progressHtml(rows: AttemptRow[], name: string, passMark: number | null): string {
  if (rows.length === 0) return `<p class="small">No recorded exercise for ${esc(name)} yet.</p>`;
  const s = progressSummary(rows);
  const ex = exerciseProgress(rows);
  const svg = progressSvg(rows, passMark);
  return `<p><b>${esc(name)}</b>: ${s.attempts} attempt${s.attempts === 1 ? "" : "s"} at ${s.exercises} exercise${s.exercises === 1 ? "" : "s"}; ` +
    `mean of the latest scores ${pct(s.meanLatest)}; found competent in ${s.competent}; attempted again and better in ${s.improved}, worse in ${s.fell}.</p>` +
    (svg ? `<p class="small" style="margin-bottom:2px">Score at each attempt, oldest first${passMark === null ? "" : `; the rule across the chart is the pass mark, ${passMark}%`}. Different exercises differ in difficulty: compare an exercise with itself in the table below.</p>${svg}` : `<p class="small">No scored attempt yet.</p>`) +
    `<table class="res phx"><thead><tr><th>Exercise</th><th>Attempts</th><th>First</th><th>Best</th><th>Latest</th><th>Change</th><th>Competent</th></tr></thead><tbody>` +
    ex.map((e) => `<tr><td>${esc(e.title)}</td><td>${e.attempts}</td><td>${pct(e.first)}</td><td>${pct(e.best)}</td><td>${pct(e.latest)}</td><td>${signed(e.change)}</td><td>${e.competent ? "yes" : "-"}</td></tr>`).join("") +
    `</tbody></table><table class="res pha"><thead><tr><th>Date</th><th>Exercise</th><th>Score</th><th>Own answers and actions</th><th>Flagged "now"</th><th>Decision</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td>${esc(r.date.slice(0, 10))}</td><td>${esc(r.title)}${r.exam ? ` <span class="small">(${esc(r.exam)})</span>` : ""}</td><td>${pct(r.percent)}</td>` +
      `<td>${r.alone ? "worked alone" : r.own && r.own.items > 0 ? `${r.own.right} of ${r.own.items} right` : "none at the controls"}</td><td>${r.flagsNow}</td><td>${DECISION[r.decision]}</td></tr>`).join("") +
    `</tbody></table>`;
}

// ---------------------------------------------------------------- a batch against its exercises

export interface MatrixRow {
  name: string;
  /** For each exercise, in the order given: attempts, the best score, and whether found competent. */
  cells: { attempts: number; best: number | null; competent: boolean }[];
  /** How many of the exercises have been attempted. */
  done: number;
}

/** Each trainee of a batch against a list of exercises. */
export function batchMatrix(records: SessionRecord[], students: string[], exerciseIds: string[]): MatrixRow[] {
  return students.map((name) => {
    const ex = new Map(exerciseProgress(traineeAttempts(records, name)).map((e) => [e.exerciseId, e]));
    const cells = exerciseIds.map((id) => {
      const e = ex.get(id);
      return { attempts: e?.attempts ?? 0, best: e?.best ?? null, competent: e?.competent ?? false };
    });
    return { name, cells, done: cells.filter((c) => c.attempts > 0).length };
  });
}

/** The batch against its exercises as a table: the best score of each trainee in each exercise, bold where found competent. */
export function batchMatrixHtml(rows: MatrixRow[], exercises: { id: string; label: string }[]): string {
  if (rows.length === 0 || exercises.length === 0) return '<p class="small">Choose a batch with trainees and assigned exercises.</p>';
  const short = (label: string): string => (/^(\d+)\. /.exec(label)?.[1] ?? label.replace(/^ROC: /, "").slice(0, 14));
  return `<div style="overflow-x:auto"><table class="res" id="bmTable"><thead><tr><th>Trainee</th>${exercises.map((e) => `<th title="${esc(e.label)}">${esc(short(e.label))}</th>`).join("")}<th>Done</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td>${esc(r.name)}</td>${r.cells.map((c) => `<td>${c.attempts === 0 ? "-" : c.competent ? `<b>${c.best === null ? "done" : `${c.best}%`}</b>` : c.best === null ? "done" : `${c.best}%`}</td>`).join("")}<td>${r.done} of ${exercises.length}</td></tr>`).join("") +
    `</tbody></table></div><p class="small">The best score of each trainee in each exercise assigned to the batch; bold: found competent by the assessor; a dash: not attempted. The number at the head of a column is the exercise's number.</p>`;
}
