import { CourseSpeed, Vec2, angleDiffDeg, bearingOf, courseSpeedOf, length, normalizeDeg, sub, velocityOf } from "../core/vec";
import { CpaResult, computeCpa } from "../core/cpa";
import { rule19Check } from "../core/colreg";
import { alongTrack, crossTrackError } from "../core/nav";
import { Scenario, Target, World, currentVelocity, ownGroundVelocity, radarTransmitting } from "../engine/index";
import { ArpaSystem } from "../arpa/index";

/**
 * ARPA exercise sessions: what the student is asked, what the session watches, and how the
 * result is worked out. EVERY tolerance, weight and limit here is a PLACEHOLDER (the academy has
 * not supplied a marking scheme). The instructor can change them on the Instructor tab; no pass
 * mark is applied unless the instructor sets one.
 */
export interface ScoringConfig {
  tol: { cpaNm: number; tcpaMin: number; courseDeg: number; speedKn: number; rangeNm: number; errorDeg: number; errorKn: number; setDeg: number };
  /** Points for each kind of item. */
  points: { question: number; action: number; safety: number };
  /** Percentage needed to pass, or null when the academy has not set one (then no pass/fail is shown). */
  passPercent: number | null;
  /** Rule 8(b) "large enough to be readily apparent": textbook guidance used as a placeholder. */
  substantialTurnDeg: number;
  substantialSpeedCut: number;
  /** Limits for the setting-up exercise (radar 22); left out: SETUP_LIMITS. */
  setup?: SetupLimits;
}

export interface SetupLimits {
  /** Noise speckle (0 none to 1 the whole picture) that counts as "a light, even speckle". */
  speckleMin: number;
  speckleMax: number;
  /** Largest acceptable difference from the best tuning, on the 0 to 100 tuning scale. */
  tuningTol: number;
  /** Brilliance at or above which the picture can be seen (10 to 100). */
  minBrilliance: number;
  /** Sea and rain clutter at or below this count as at zero effect. */
  clutterZero: number;
}

/**
 * Limits for the setting-up exercise. PLACEHOLDERS: the books describe how to judge each setting
 * (a light, even background speckle for the gain; the greatest extent of clutter, rain or land
 * echoes, or the performance monitor, for the tuning), not a figure. The instructor can change
 * them with the scoring settings.
 */
export const SETUP_LIMITS: SetupLimits = { speckleMin: 0.02, speckleMax: 0.25, tuningTol: 6, minBrilliance: 40, clutterZero: 5 };

export const PLACEHOLDER_SCORING: ScoringConfig = {
  // Sized so that data read from a settled track (which carries the ARPA's own noise) is accepted.
  tol: { cpaNm: 0.5, tcpaMin: 2, courseDeg: 7, speedKn: 1.5, rangeNm: 0.5, errorDeg: 1, errorKn: 0.7, setDeg: 15 },
  points: { question: 10, action: 10, safety: 20 },
  passPercent: null,
  substantialTurnDeg: 30,
  substantialSpeedCut: 0.5,
};

export interface Observed {
  /** Real targets that have had a settled track (ids). */
  tracked: Set<number>;
  autoAcqUsed: boolean;
  guardUsed: boolean;
  exclusionUsed: boolean;
  trialUsed: boolean;
  vecTrueUsed: boolean;
  vecRelUsed: boolean;
  pastUsed: boolean;
  /** Real target id used as the ground reference, when one was designated. */
  groundRef: number | null;
  acks: number;
  tests: number;
  cpaLimit: number;
  tcpaLimit: number;
  /** Closest range reached to each real target, NM. */
  minRange: Record<number, number>;
  /** First own-ship manoeuvre (ordered course changed by 5 degrees or more, or speed by 1 kn or more). */
  manoeuvre: null | {
    time: number;
    turnDeg: number;
    speedFrom: number;
    speedTo: number;
    /** Vessels with which a close-quarters situation was developing at that moment. */
    threats: { id: number; relBearing: number }[];
  };
  /** Parallel index lines the student has set (latest), and navigation lines drawn (most at any time). */
  pi: { on: boolean; bearing: number; range: number }[];
  navLines: number;
  /** The performance monitor was looked at while the radar was transmitting. */
  pmUsed: boolean;
  /** Largest distance off the exercise's planned track while abeam of it, NM, and whether its end was passed. */
  maxXte: number;
  trackDone: boolean;
  /** Own speed (kn) at the moment of closest approach to each real target. */
  closeSpeed: Record<number, number>;
  /** Largest alteration seen after the manoeuvre started. */
  maxTurnDeg: number;
  minSpeedRatio: number;
}

export interface TaskCtx {
  w: World;
  a: ArpaSystem;
  obs: Observed;
  cfg: ScoringConfig;
}

interface TaskBase {
  id: string;
  prompt: string;
}
export interface NumberTask extends TaskBase {
  kind: "number";
  unit: string;
  /** Correct value now (null = cannot be answered yet). */
  truth: (c: TaskCtx) => number | null;
  tol: (cfg: ScoringConfig) => number;
  /** True for courses and bearings (compare round the circle). */
  circular?: boolean;
}
export interface ChoiceTask extends TaskBase {
  kind: "choice";
  choices: string[];
  correct: (c: TaskCtx) => number;
}
export interface ActionTask extends TaskBase {
  kind: "action";
  done: (c: TaskCtx) => boolean;
}
/** Judged at the end from what happened. */
export interface OutcomeTask extends TaskBase {
  kind: "outcome";
  judge: (c: TaskCtx) => { ok: boolean; detail: string };
}
export type ArpaTask = NumberTask | ChoiceTask | ActionTask | OutcomeTask;

export interface ScriptStep {
  atSeconds: number;
  /** Shown to the instructor only. */
  note: string;
  run: (w: World, a: ArpaSystem) => void;
}

export interface ArpaExercise {
  id: string;
  number: number;
  title: string;
  aim: string;
  scenario: Scenario;
  rangeNm: number;
  /** Passing distance (NM) used for safety outcomes and "dangerous" in this exercise. Placeholder. */
  safeNm: number;
  briefing: string[];
  tasks: ArpaTask[];
  script: ScriptStep[];
  debrief: string[];
  /** Planned track to keep (for parallel index exercises): from a to b. */
  track?: { a: Vec2; b: Vec2 };
  /** Optional ARPA presets applied at the start. */
  setup?: (a: ArpaSystem, w: World) => void;
  /** "Radar", "Plotting" or (default) "ARPA": the group the exercise is listed under. */
  group?: "ARPA" | "Radar" | "Plotting";
  /** Own ship with fixed rates of turn and speed change (the exercise states them), instead of a ship model. */
  ownRates?: { turnDegPerMin: number; speedKnPerMin: number };
  /** The exercise starts with the radar switched off and its controls set by `setup`: the screen shows them as set, with the automatic controls off. */
  startsSwitchedOff?: boolean;
}

export interface ResultItem {
  id: string;
  label: string;
  kind: ArpaTask["kind"];
  student: string;
  correct: string;
  ok: boolean;
  points: number;
  max: number;
}
export interface ExerciseResult {
  exerciseId: string;
  title: string;
  simSeconds: number;
  items: ResultItem[];
  score: number;
  max: number;
  percent: number;
  /** null when no pass mark has been set. */
  passed: boolean | null;
  debrief: string[];
  placeholderNote: string;
}

// ---------------------------------------------------------------- truth helpers (instructor side)

export const targetById = (w: World, id: number): Target | undefined => w.targets.find((t) => t.id === id);

/** Real CPA/TCPA of a target now (both ships over the ground). */
export function truthCpa(w: World, id: number): CpaResult | null {
  const t = targetById(w, id);
  if (!t) return null;
  const rv = sub(velocityOf({ course: t.course, speed: t.speed }), ownGroundVelocity(w));
  return computeCpa(sub(t.pos, w.own.pos), rv);
}

/** Target's real course and speed through the water (what a sea-stabilised ARPA should show). */
export function truthThroughWater(w: World, id: number): CourseSpeed | null {
  const t = targetById(w, id);
  if (!t) return null;
  return courseSpeedOf(sub(velocityOf({ course: t.course, speed: t.speed }), currentVelocity(w)));
}

export function relPosOf(w: World, id: number): Vec2 | null {
  const t = targetById(w, id);
  return t ? sub(t.pos, w.own.pos) : null;
}

/** Real ships whose CPA is inside `nm` and still to come. */
export function threats(w: World, nm: number): number[] {
  return w.targets
    .filter((t) => t.kind === "ship" || t.kind === "small-craft")
    .filter((t) => {
      const c = truthCpa(w, t.id);
      return !!c && c.tcpaMinutes !== null && c.tcpaMinutes > 0 && c.cpa < nm && t.speed > 0.1;
    })
    .map((t) => t.id);
}

// ---------------------------------------------------------------- the session

interface AnswerRec {
  text: string;
  correct: string;
  ok: boolean;
  time: number;
}

export class ArpaExSession {
  readonly def: ArpaExercise;
  readonly cfg: ScoringConfig;
  readonly obs: Observed;
  answers = new Map<string, AnswerRec>();
  /** Sticky: an action counts once it has been seen done. */
  actionsDone = new Set<string>();
  finished: ExerciseResult | null = null;
  /** Instructor log of scripted events that have fired. */
  scriptLog: { time: number; note: string }[] = [];
  private nextScript = 0;
  private startCourse: number;
  private startSpeed: number;
  private script: ScriptStep[];

  constructor(def: ArpaExercise, w: World, a: ArpaSystem, cfg: ScoringConfig = PLACEHOLDER_SCORING) {
    this.def = def;
    this.cfg = cfg;
    this.script = [...def.script].sort((x, y) => x.atSeconds - y.atSeconds);
    this.startCourse = w.own.ordered.course;
    this.startSpeed = w.own.ordered.speed;
    this.obs = {
      tracked: new Set(), autoAcqUsed: false, guardUsed: false, exclusionUsed: false, trialUsed: false, vecTrueUsed: false,
      vecRelUsed: false, pastUsed: false, groundRef: null, acks: 0, tests: 0, cpaLimit: a.settings.cpaLimitNm,
      tcpaLimit: a.settings.tcpaLimitMin, minRange: {}, manoeuvre: null, maxTurnDeg: 0, minSpeedRatio: 1,
      pi: [], navLines: 0, pmUsed: false, maxXte: 0, trackDone: false, closeSpeed: {},
    };
    def.setup?.(a, w);
  }

  ctx(w: World, a: ArpaSystem): TaskCtx {
    return { w, a, obs: this.obs, cfg: this.cfg };
  }

  /** Call after every simulation step. */
  step(w: World, a: ArpaSystem, ui?: { pi: { on: boolean; bearing: number; range: number }[]; navLines: number; pmOn?: boolean }): void {
    if (this.finished) return;
    if (ui) {
      this.obs.pi = ui.pi.map((p) => ({ ...p }));
      this.obs.navLines = Math.max(this.obs.navLines, ui.navLines);
      if (ui.pmOn && radarTransmitting(w)) this.obs.pmUsed = true;
    }
    const tr = this.def.track;
    if (tr) {
      const along = alongTrack(w.own.pos, tr.a, tr.b);
      const len = length(sub(tr.b, tr.a));
      if (along >= 0 && along <= len) this.obs.maxXte = Math.max(this.obs.maxXte, Math.abs(crossTrackError(w.own.pos, tr.a, tr.b)));
      if (along > len) this.obs.trackDone = true;
    }
    while (this.nextScript < this.script.length && this.script[this.nextScript]!.atSeconds <= w.time) {
      const s = this.script[this.nextScript++]!;
      s.run(w, a);
      this.scriptLog.push({ time: w.time, note: s.note });
    }
    const o = this.obs;
    const st = a.settings;
    for (const t of a.tracks) if (t.truthId !== null && t.state === "tracking" && t.quality !== "acquiring") o.tracked.add(t.truthId);
    if (st.autoAcquire) o.autoAcqUsed = true;
    if (st.guardZones.some((z) => z.on)) o.guardUsed = true;
    if (st.exclusionZones.some((z) => z.on)) o.exclusionUsed = true;
    if (st.trial.on) o.trialUsed = true;
    if (!st.standby && a.tracks.length > 0) {
      if (st.vectorMode === "true") o.vecTrueUsed = true;
      else o.vecRelUsed = true;
      if (st.past.mode !== "off") o.pastUsed = true;
    }
    if (a.effectiveStab() === "ground" && a.groundRefId !== null) {
      const r = a.tracks.find((t) => t.id === a.groundRefId);
      if (r && r.truthId !== null) o.groundRef = r.truthId;
    }
    o.acks = a.ackCount;
    o.tests = a.testCount;
    o.cpaLimit = st.cpaLimitNm;
    o.tcpaLimit = st.tcpaLimitMin;
    for (const t of w.targets) {
      const r = length(sub(t.pos, w.own.pos));
      if (r < (o.minRange[t.id] ?? Infinity)) {
        o.minRange[t.id] = r;
        o.closeSpeed[t.id] = w.own.speedThroughWater;
      }
    }
    const turn = angleDiffDeg(w.own.ordered.course, this.startCourse);
    const ratio = this.startSpeed > 0 ? w.own.ordered.speed / this.startSpeed : 1;
    if (!o.manoeuvre && (Math.abs(turn) >= 5 || Math.abs(w.own.ordered.speed - this.startSpeed) >= 1)) {
      o.manoeuvre = {
        time: w.time,
        turnDeg: turn,
        speedFrom: this.startSpeed,
        speedTo: w.own.ordered.speed,
        threats: threats(w, this.def.safeNm).map((id) => ({ id, relBearing: normalizeDeg(bearingOf(sub(targetById(w, id)!.pos, w.own.pos)) - w.own.heading) })),
      };
    }
    if (o.manoeuvre) {
      if (Math.abs(turn) > Math.abs(o.maxTurnDeg)) o.maxTurnDeg = turn;
      o.minSpeedRatio = Math.min(o.minSpeedRatio, ratio);
    }
    for (const t of this.def.tasks) {
      if (t.kind === "action" && !this.actionsDone.has(t.id) && t.done(this.ctx(w, a))) this.actionsDone.add(t.id);
    }
  }

  /** After the instructor takes the exercise back in time: scripted events later than `time` will fire again. */
  rewindTo(time: number): void {
    this.nextScript = this.script.findIndex((s) => s.atSeconds > time);
    if (this.nextScript < 0) this.nextScript = this.script.length;
    this.scriptLog = this.scriptLog.filter((e) => e.time <= time);
  }

  /** How each task will be judged, in words the candidate can read before starting (STCW A-I/12, 8.1 and 8.3). */
  criteria(): { label: string; criterion: string; points: number }[] {
    return this.def.tasks.map((t) => {
      if (t.kind === "number") return { label: t.prompt, criterion: `Your value within ±${t.tol(this.cfg)} ${t.unit} of the real value at the moment you answer`, points: this.cfg.points.question };
      if (t.kind === "choice") return { label: t.prompt, criterion: "The correct choice", points: this.cfg.points.question };
      if (t.kind === "action") return { label: t.prompt, criterion: "Done at some time during the exercise", points: this.cfg.points.action };
      return { label: t.prompt, criterion: "Judged from what actually happened, at the end", points: this.cfg.points.safety };
    });
  }

  /** Record the student's answer to a number or choice task. Returns false when it cannot be answered yet. */
  answer(w: World, a: ArpaSystem, taskId: string, value: number): boolean {
    const t = this.def.tasks.find((x) => x.id === taskId);
    if (!t || this.finished) return false;
    const c = this.ctx(w, a);
    if (t.kind === "number") {
      const truth = t.truth(c);
      if (truth === null || !Number.isFinite(value)) return false;
      const err = t.circular ? Math.abs(angleDiffDeg(value, truth)) : Math.abs(value - truth);
      const shown = t.circular ? normalizeDeg(truth) : truth;
      this.answers.set(taskId, { text: `${value} ${t.unit}`, correct: `${shown.toFixed(t.unit === "°" || t.unit === "min" ? 0 : 1)} ${t.unit} (±${t.tol(this.cfg)})`, ok: err <= t.tol(this.cfg) + 1e-9, time: w.time });
      return true;
    }
    if (t.kind === "choice") {
      const right = t.correct(c);
      this.answers.set(taskId, { text: t.choices[value] ?? "?", correct: t.choices[right] ?? "?", ok: value === right, time: w.time });
      return true;
    }
    return false;
  }

  finish(w: World, a: ArpaSystem): ExerciseResult {
    if (this.finished) return this.finished;
    const c = this.ctx(w, a);
    const items: ResultItem[] = this.def.tasks.map((t) => {
      if (t.kind === "number" || t.kind === "choice") {
        const r = this.answers.get(t.id);
        const max = this.cfg.points.question;
        return { id: t.id, label: t.prompt, kind: t.kind, student: r ? r.text : "not answered", correct: r ? r.correct : "-", ok: !!r?.ok, points: r?.ok ? max : 0, max };
      }
      if (t.kind === "action") {
        const ok = this.actionsDone.has(t.id) || t.done(c);
        const max = this.cfg.points.action;
        return { id: t.id, label: t.prompt, kind: t.kind, student: ok ? "done" : "not done", correct: "done", ok, points: ok ? max : 0, max };
      }
      const j = t.judge(c);
      const max = this.cfg.points.safety;
      return { id: t.id, label: t.prompt, kind: t.kind, student: j.detail, correct: "", ok: j.ok, points: j.ok ? max : 0, max };
    });
    const score = items.reduce((s, i) => s + i.points, 0);
    const max = items.reduce((s, i) => s + i.max, 0);
    const percent = max > 0 ? (100 * score) / max : 0;
    this.finished = {
      exerciseId: this.def.id,
      title: `${this.def.number}. ${this.def.title}`,
      simSeconds: w.time,
      items,
      score,
      max,
      percent,
      passed: this.cfg.passPercent === null ? null : percent >= this.cfg.passPercent,
      debrief: this.def.debrief,
      placeholderNote: "Tolerances and points are placeholders, not an approved marking scheme.",
    };
    return this.finished;
  }
}

// ---------------------------------------------------------------- reusable outcome judges

/** Every ship passed no closer than the exercise's safe distance. */
export function judgeSafePassing(def: Pick<ArpaExercise, "safeNm">): OutcomeTask["judge"] {
  return (c) => {
    const ships = c.w.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft");
    const worst = ships.map((t) => ({ t, r: c.obs.minRange[t.id] ?? Infinity })).sort((x, y) => x.r - y.r)[0];
    if (!worst) return { ok: true, detail: "no ships" };
    const still = threats(c.w, def.safeNm);
    const ok = worst.r >= def.safeNm && still.length === 0;
    const more = still.length > 0 ? `; still closing inside ${def.safeNm} NM: ${still.map((id) => targetById(c.w, id)?.name).join(", ")}` : "";
    return { ok, detail: `closest: ${worst.t.name} ${worst.r.toFixed(2)} NM (needed ${def.safeNm} NM)${more}` };
  };
}

/** The avoiding action was substantial (Rule 8(b)) and, in restricted visibility, respected Rule 19(d). */
export function judgeAction(restrictedVisibility: boolean): OutcomeTask["judge"] {
  return (c) => {
    const m = c.obs.manoeuvre;
    if (!m) return { ok: false, detail: "no alteration of course or speed was made" };
    const turn = c.obs.maxTurnDeg;
    const bigTurn = Math.abs(turn) >= c.cfg.substantialTurnDeg;
    const bigCut = c.obs.minSpeedRatio <= 1 - c.cfg.substantialSpeedCut + 1e-9;
    const faults: string[] = [];
    if (!bigTurn && !bigCut) faults.push(`Action too small to be readily apparent (turn ${Math.abs(turn).toFixed(0)}°, speed to ${(c.obs.minSpeedRatio * 100).toFixed(0)}%).`);
    if (restrictedVisibility && Math.abs(turn) >= 5) faults.push(...rule19Check(turn, m.threats.map((t) => ({ relBearing: t.relBearing }))).faults);
    const what = `${Math.abs(turn) >= 5 ? `turned ${Math.abs(turn).toFixed(0)}° to ${turn > 0 ? "starboard" : "port"}` : "no turn"}, speed to ${(c.obs.minSpeedRatio * 100).toFixed(0)}%`;
    return { ok: faults.length === 0, detail: faults.length === 0 ? what : `${what}. ${faults.join(" ")}` };
  };
}
