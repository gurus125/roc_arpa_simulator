import { World } from "../engine/index";
import { ArpaSystem } from "../arpa/index";
import { ExerciseResult } from "./session";

/** One moment of an exercise, kept for the debrief replay. Positions in NM (east, north). */
export interface Frame {
  t: number;
  own: { e: number; n: number; hdg: number; spd: number; ordC: number; ordS: number };
  tg: { id: number; e: number; n: number; c: number; s: number }[];
  /** Number of targets tracked by the ARPA and the alarms not yet acknowledged. */
  tracks: number;
  alarms: string[];
}

export interface RecordEvent {
  t: number;
  text: string;
  /** True when only the instructor should see it during the exercise (it reveals the truth). */
  instructor: boolean;
}

export interface SessionRecord {
  id: string;
  exerciseId: string;
  title: string;
  kind: "arpa" | "roc" | "free";
  students: string[];
  batch: string;
  startedIso: string;
  simSeconds: number;
  /** Target names by id, for the replay labels. */
  names: Record<number, string>;
  coasts: { e: number; n: number }[][];
  frames: Frame[];
  events: RecordEvent[];
  result: ExerciseResult | null;
  /** For ROC exercises: marks out of the maximum, as text lines. */
  summary: string[];
  /**
   * Debrief and assessment (STCW A-I/12 paragraphs 7 and 8): the trainees' own review, peer
   * comments, goals, and the assessor's decision, which is the prime criterion, not the score.
   */
  debrief?: { self: string; peer: string; goals: string };
  assessor?: { decision: "" | "competent" | "not-yet"; remarks: string; name: string };
  /** Radio messages exchanged during the exercise. */
  comms?: { t: number; from: string; text: string }[];
}

export const FRAME_INTERVAL_SEC = 10;

/** Samples the simulation every FRAME_INTERVAL_SEC and collects the ARPA's event log. */
export class Recorder {
  readonly rec: SessionRecord;
  private nextAt = 0;
  private seenEvents = 0;

  constructor(init: Pick<SessionRecord, "exerciseId" | "title" | "kind" | "students" | "batch">, w: World, nowIso: string) {
    this.rec = {
      ...init,
      id: `${nowIso}-${init.exerciseId}`,
      startedIso: nowIso,
      simSeconds: 0,
      names: Object.fromEntries(w.targets.map((t) => [t.id, t.name])),
      coasts: w.coasts.map((c) => c.points.map((p) => ({ e: +p.e.toFixed(3), n: +p.n.toFixed(3) }))),
      frames: [],
      events: [],
      result: null,
      summary: [],
    };
  }

  note(w: World, text: string, instructor = false): void {
    this.rec.events.push({ t: Math.round(w.time), text, instructor });
  }

  /** Call after every simulation step. */
  sample(w: World, a: ArpaSystem | null): void {
    this.rec.simSeconds = w.time;
    if (a) {
      for (; this.seenEvents < a.events.length; this.seenEvents++) {
        const e = a.events[this.seenEvents]!;
        this.rec.events.push({ t: Math.round(e.time), text: e.text, instructor: e.instructor });
      }
      if (this.seenEvents > a.events.length) this.seenEvents = a.events.length;
    }
    if (w.time + 1e-9 < this.nextAt) return;
    this.nextAt = w.time + FRAME_INTERVAL_SEC;
    const r3 = (x: number): number => Math.round(x * 1000) / 1000;
    for (const t of w.targets) if (!(t.id in this.rec.names)) this.rec.names[t.id] = t.name;
    this.rec.frames.push({
      t: Math.round(w.time),
      own: { e: r3(w.own.pos.e), n: r3(w.own.pos.n), hdg: Math.round(w.own.heading * 10) / 10, spd: Math.round(w.own.speedThroughWater * 10) / 10, ordC: w.own.ordered.course, ordS: w.own.ordered.speed },
      tg: w.targets.map((t) => ({ id: t.id, e: r3(t.pos.e), n: r3(t.pos.n), c: Math.round(t.course), s: Math.round(t.speed * 10) / 10 })),
      tracks: a ? a.activeCount() : 0,
      alarms: a ? a.alarms.filter((x) => !x.acked).map((x) => x.text) : [],
    });
  }
}

/** The frame in force at simulation time `t` (the last one at or before it). */
export function frameAt(rec: SessionRecord, t: number): Frame | null {
  let best: Frame | null = null;
  for (const f of rec.frames) {
    if (f.t <= t) best = f;
    else break;
  }
  return best ?? rec.frames[0] ?? null;
}

/**
 * The frame for time t with the positions of own ship and of each target moved in a straight line
 * towards the next frame, so that a slow replay runs smoothly between the 10-second samples.
 * Everything else (heading, speed, alarms) is as recorded in the frame at or before t.
 */
export function frameInterpolated(rec: SessionRecord, t: number): Frame | null {
  const a = frameAt(rec, t);
  if (!a) return null;
  const b = rec.frames[rec.frames.indexOf(a) + 1];
  if (!b || b.t <= a.t || t <= a.t) return a;
  const f = Math.min(1, (t - a.t) / (b.t - a.t));
  const mix = (p: number, q: number): number => p + (q - p) * f;
  return {
    ...a,
    own: { ...a.own, e: mix(a.own.e, b.own.e), n: mix(a.own.n, b.own.n) },
    tg: a.tg.map((x) => {
      const y = b.tg.find((z) => z.id === x.id);
      return y ? { ...x, e: mix(x.e, y.e), n: mix(x.n, y.n) } : x;
    }),
  };
}

/** Replay speeds offered to the instructor: slow motion, real time and rapid (times real time). */
export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 30, 60] as const;

const csvCell = (x: string | number): string => {
  const s = String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: (string | number)[][]): string => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** One line per exercise record: who, what, when, score. */
export function recordsCsv(records: SessionRecord[]): string {
  const rows: (string | number)[][] = [["Started", "Batch", "Students", "Exercise", "Minutes (simulated)", "Score", "Maximum", "Percent", "Result", "Assessor decision", "Assessor", "Assessor remarks"]];
  for (const r of records) {
    const res = r.result;
    rows.push([
      r.startedIso, r.batch, r.students.join(" / "), r.title, (r.simSeconds / 60).toFixed(1),
      res ? res.score : "", res ? res.max : "", res ? res.percent.toFixed(0) : "",
      res ? (res.passed === null ? "no pass mark set" : res.passed ? "pass" : "not yet") : r.summary.join("; "),
      r.assessor?.decision === "competent" ? "competent" : r.assessor?.decision === "not-yet" ? "not yet competent" : "", r.assessor?.name ?? "", r.assessor?.remarks ?? "",
    ]);
  }
  return toCsv(rows);
}

/** Item-by-item result of one record. */
export function resultCsv(r: SessionRecord): string {
  const rows: (string | number)[][] = [["Item", "Type", "Student", "Correct", "OK", "Points", "Maximum"]];
  for (const i of r.result?.items ?? []) rows.push([i.label, i.kind, i.student, i.correct, i.ok ? "yes" : "no", i.points, i.max]);
  return toCsv(rows);
}
