import { CourseSpeed, Vec2, angleDiffDeg, bearingOf, courseSpeedOf, length, normalizeDeg, sub, velocityOf } from "../core/vec";
import { CpaResult, computeCpa } from "../core/cpa";
import { rule19Check } from "../core/colreg";
import { alongTrack, crossTrackError, distanceToSegment } from "../core/nav";
import { advanceLeg } from "../core/route";
import { tssConduct } from "../core/tss";
import { Scenario, Target, World, currentVelocity, inSight, ownGroundVelocity, radarTransmitting, visibilityNm } from "../engine/index";
import { ArpaSystem } from "../arpa/index";

/**
 * ARPA exercise sessions: what the student is asked, what the session watches, and how the
 * result is worked out. EVERY tolerance, weight and limit here is a PLACEHOLDER (the academy has
 * not supplied a marking scheme). The instructor can change them on the Instructor tab; no pass
 * mark is applied unless the instructor sets one.
 */
export interface ScoringConfig {
  tol: { cpaNm: number; tcpaMin: number; courseDeg: number; speedKn: number; rangeNm: number; errorDeg: number; errorKn: number; setDeg: number; bearingDeg: number };
  /** Points for each kind of item. */
  points: { question: number; action: number; safety: number };
  /** Percentage needed to pass, or null when the academy has not set one (then no pass/fail is shown). */
  passPercent: number | null;
  /** Rule 8(b) "large enough to be readily apparent": textbook guidance used as a placeholder. */
  substantialTurnDeg: number;
  substantialSpeedCut: number;
  /** Limits for the setting-up exercise (radar 22); left out: SETUP_LIMITS. */
  setup?: SetupLimits;
  /**
   * Time limits set by the instructor, minutes of exercise time, by exercise id. An exercise with a limit gets
   * one more marked item, "Finished within the time allowed". Left out or null: the exercise's own limit, if it has one.
   */
  timeLimits?: Record<string, number | null>;
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
  // bearingDeg: radar bearings and courses to steer.
  tol: { cpaNm: 0.5, tcpaMin: 2, courseDeg: 7, speedKn: 1.5, rangeNm: 0.5, errorDeg: 1, errorKn: 0.7, setDeg: 15, bearingDeg: 3 },
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
    /** Vessels with which a close-quarters situation was developing at that moment; with a visibility set, whether each was in sight. */
    threats: { id: number; relBearing: number; inSight?: boolean }[];
    /** The visibility then, NM, when one was set. */
    visibilityNm?: number;
    /** The trainee at the controls then, and how close each of those vessels would have passed, and when, had nothing been done. */
    by?: string;
    risk?: { id: number; name: string; cpa: number; tcpaMin: number }[];
  };
  /** Parallel index lines the student has set (latest), and navigation lines drawn (most at any time). */
  pi: { on: boolean; bearing: number; range: number }[];
  navLines: number;
  /** The performance monitor was looked at while the radar was transmitting. */
  pmUsed: boolean;
  /** Largest distance off the exercise's planned track while abeam of it and under way, NM, and whether its end was passed. */
  maxXte: number;
  trackDone: boolean;
  /** Own speed (kn) at the moment of closest approach to each real target. */
  closeSpeed: Record<number, number>;
  /** Largest alteration seen after the manoeuvre started. */
  maxTurnDeg: number;
  minSpeedRatio: number;
  /** Closest own ship came to the land (any coastline), NM. */
  minLandNm: number;
  /** Where the anchor was first let go, if it was. */
  anchorPos: Vec2 | null;
  /** Seconds own ship spent in a traffic separation scheme while under way: with the flow, crossing a lane, against the flow, in the separation zone. */
  tss: { withFlow: number; crossing: number; against: number; zone: number };
  /** Exercise time (s) at which the MOB key was pressed, or null. */
  mobKeyAt: number | null;
  /** The trainee put a route or a search pattern on the radar (most waypoints at any time). */
  routePoints: number;
  /** Own ship's speed over the ground every 10 seconds: [exercise time s, knots]. */
  speedLog: [number, number][];
  /** When each real target first had a settled track (exercise time, s), and its range then, NM. */
  trackedAt: Record<number, { t: number; rangeNm: number }>;
  /** The range scales used, in the order they were first chosen, and how often the scale was changed. */
  rangesUsed: number[];
  rangeChanges: number;
  /** Alerts raised so far, and the longest any was left unacknowledged, seconds. */
  alertsRaised: number;
  maxUnackedSec: number;
  /**
   * Coming back to a target: the closest range reached to it after it had first been more than RETURN_OPEN_NM
   * away, NM, and own speed through the water at that moment. (A person who falls overboard starts at range 0.)
   */
  returnRange: Record<number, number>;
  returnSpeed: Record<number, number>;
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
  judge: OutcomeJudge;
  /** What is checked, in words, with the limits in use (for the candidate's criteria and the marking sheet). Else the judge's own `rule`, else a general phrase. */
  rule?: (cfg: ScoringConfig) => string;
}
/** An outcome judge. A reusable one also says in words what it checks (`rule`). */
export type OutcomeJudge = ((c: TaskCtx) => { ok: boolean; detail: string }) & { rule?: (cfg: ScoringConfig) => string };
export type ArpaTask = NumberTask | ChoiceTask | ActionTask | OutcomeTask;

export interface ScriptStep {
  atSeconds: number;
  /** Shown to the instructor only. */
  note: string;
  run: (w: World, a: ArpaSystem) => void;
  /** Optional condition: the step runs at the first moment after `atSeconds` when this holds. Later steps wait for it. */
  when?: (w: World, a: ArpaSystem) => boolean;
  /** Told to the trainee when the step runs (a report from the bridge team, for example). */
  say?: string;
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
  /** Planned route of several legs, put on the radar at the start: the distance off it and its completion are observed as for `track`. */
  route?: Vec2[];
  /** Time allowed, minutes of exercise time. A PLACEHOLDER unless the instructor sets one (ScoringConfig.timeLimits). */
  timeLimitMin?: number;
  /** Optional ARPA presets applied at the start. */
  setup?: (a: ArpaSystem, w: World) => void;
  /** "Radar", "Plotting" or (default) "ARPA": the group the exercise is listed under. */
  group?: "ARPA" | "Radar" | "Plotting";
  /** Own ship with fixed rates of turn and speed change (the exercise states them), instead of a ship model. */
  ownRates?: { turnDegPerMin: number; speedKnPerMin: number };
  /** The exercise starts with the radar switched off and its controls set by `setup`: the screen shows them as set, with the automatic controls off. */
  startsSwitchedOff?: boolean;
  /** The AIS display is switched off and locked while the exercise runs (manual plotting: plot from the radar alone). */
  aisOff?: boolean;
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
  /** The trainee at the controls when the answer was given or the action done. Left out for what is judged from the whole exercise. */
  by?: string;
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

/** Distance from own ship to the nearest coastline, NM (Infinity when there is none). */
export function distanceToLandNm(w: World): number {
  let best = Infinity;
  for (const e of w.edges) best = Math.min(best, distanceToSegment(w.own.pos, e.a, e.b));
  return best;
}

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
  /** The trainee at the controls when the answer was given ("" or left out: not named). */
  by?: string;
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
  /** What the script has told the trainee, in order; `noticesShown` is how many the display has shown. */
  notices: string[] = [];
  noticesShown = 0;
  /** The trainee at the controls now (set by the display), and who was there when each action was first seen done. */
  controls = "";
  actionBy = new Map<string, string>();
  private alertKeys = new Set<string>();
  private lastRange: number | null = null;
  private routeLeg = 0;
  private nextSpeedAt = 0;
  private opened = new Set<number>();
  private nextScript = 0;
  private startCourse: number;
  private lastTime: number;
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
      minLandNm: distanceToLandNm(w), anchorPos: null,
      tss: { withFlow: 0, crossing: 0, against: 0, zone: 0 }, mobKeyAt: null, routePoints: 0, speedLog: [], returnRange: {}, returnSpeed: {},
      trackedAt: {}, rangesUsed: [], rangeChanges: 0, alertsRaised: 0, maxUnackedSec: 0,
    };
    this.lastTime = w.time;
    def.setup?.(a, w);
  }

  ctx(w: World, a: ArpaSystem): TaskCtx {
    return { w, a, obs: this.obs, cfg: this.cfg };
  }

  /** Call after every simulation step. */
  step(w: World, a: ArpaSystem, ui?: { pi: { on: boolean; bearing: number; range: number }[]; navLines: number; pmOn?: boolean; mobAt?: number | null; routePoints?: number; ctl?: string }): void {
    if (this.finished) return;
    const dt = Math.max(0, w.time - this.lastTime);
    this.lastTime = w.time;
    if (ui) {
      if (ui.mobAt !== undefined && ui.mobAt !== null && this.obs.mobKeyAt === null) this.obs.mobKeyAt = ui.mobAt;
      if (ui.ctl !== undefined) this.controls = ui.ctl;
      this.obs.routePoints = Math.max(this.obs.routePoints, ui.routePoints ?? 0);
      this.obs.pi = ui.pi.map((p) => ({ ...p }));
      this.obs.navLines = Math.max(this.obs.navLines, ui.navLines);
      if (ui.pmOn && radarTransmitting(w)) this.obs.pmUsed = true;
    }
    const tr = this.def.track;
    if (tr) {
      const along = alongTrack(w.own.pos, tr.a, tr.b);
      const len = length(sub(tr.b, tr.a));
      if (along >= 0 && along <= len && !w.own.anchor) this.obs.maxXte = Math.max(this.obs.maxXte, Math.abs(crossTrackError(w.own.pos, tr.a, tr.b)));
      if (along > len) this.obs.trackDone = true;
    }
    const rt = this.def.route;
    if (rt && rt.length >= 2) {
      // The leg being sailed moves on when own ship comes abeam of its end; the last leg is done when its end is passed.
      this.routeLeg = advanceLeg(rt, w.own.pos, this.routeLeg, 0);
      const from = rt[this.routeLeg]!, to = rt[this.routeLeg + 1]!;
      const along = alongTrack(w.own.pos, from, to);
      const len = length(sub(to, from));
      if (along >= 0 && along <= len && !w.own.anchor) this.obs.maxXte = Math.max(this.obs.maxXte, Math.abs(crossTrackError(w.own.pos, from, to)));
      if (this.routeLeg === rt.length - 2 && along > len) this.obs.trackDone = true;
    }
    const og = ownGroundVelocity(w);
    const sog = length(og);
    if (w.time >= this.nextSpeedAt) {
      this.obs.speedLog.push([Math.round(w.time), Math.round(sog * 10) / 10]);
      this.nextSpeedAt = w.time + 10;
    }
    if (sog > 1 && dt > 0) {
      for (const t of w.tss) {
        const c = tssConduct(w.own.pos, bearingOf(og), t);
        if (c === "with-flow") this.obs.tss.withFlow += dt;
        else if (c === "crossing") this.obs.tss.crossing += dt;
        else if (c === "against-flow") this.obs.tss.against += dt;
        else if (c === "in-zone") this.obs.tss.zone += dt;
      }
    }
    while (this.nextScript < this.script.length && this.script[this.nextScript]!.atSeconds <= w.time) {
      const s = this.script[this.nextScript]!;
      if (s.when && !s.when(w, a)) break;
      this.nextScript++;
      s.run(w, a);
      this.scriptLog.push({ time: w.time, note: s.note });
      if (s.say) this.notices.push(s.say);
    }
    const o = this.obs;
    const st = a.settings;
    for (const t of a.tracks) {
      if (t.truthId === null || t.state !== "tracking" || t.quality === "acquiring") continue;
      o.tracked.add(t.truthId);
      const tg = targetById(w, t.truthId);
      if (tg && !o.trackedAt[t.truthId]) o.trackedAt[t.truthId] = { t: Math.round(w.time), rangeNm: Math.round(length(sub(tg.pos, w.own.pos)) * 100) / 100 };
    }
    // The range scale in use, and the alerts: how many, and how long one was left unacknowledged.
    const rs = w.radar.controls.rangeNm;
    if (this.lastRange !== null && rs !== this.lastRange) o.rangeChanges++;
    this.lastRange = rs;
    if (!o.rangesUsed.includes(rs)) o.rangesUsed.push(rs);
    for (const al of a.alarms) {
      if (al.kind === "capacity-near") continue;
      if (!this.alertKeys.has(`${al.key}@${al.raisedAt}`)) {
        this.alertKeys.add(`${al.key}@${al.raisedAt}`);
        o.alertsRaised++;
      }
      if (!al.acked) o.maxUnackedSec = Math.max(o.maxUnackedSec, w.time - al.raisedAt);
    }
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
    o.minLandNm = Math.min(o.minLandNm, distanceToLandNm(w));
    if (w.own.anchor && !o.anchorPos) o.anchorPos = { ...w.own.anchor.pos };
    for (const t of w.targets) {
      const r = length(sub(t.pos, w.own.pos));
      if (r < (o.minRange[t.id] ?? Infinity)) {
        o.minRange[t.id] = r;
        o.closeSpeed[t.id] = w.own.speedThroughWater;
      }
      if (r > RETURN_OPEN_NM) this.opened.add(t.id);
      if (this.opened.has(t.id) && r < (o.returnRange[t.id] ?? Infinity)) {
        o.returnRange[t.id] = r;
        o.returnSpeed[t.id] = w.own.speedThroughWater;
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
        threats: threats(w, this.def.safeNm).map((id) => {
          const t = targetById(w, id)!;
          const seen = inSight(w, t);
          return { id, relBearing: normalizeDeg(bearingOf(sub(t.pos, w.own.pos)) - w.own.heading), ...(seen === null ? {} : { inSight: seen }) };
        }),
        ...(visibilityNm(w) === null ? {} : { visibilityNm: visibilityNm(w)! }),
        ...(this.controls ? { by: this.controls } : {}),
        risk: threats(w, this.def.safeNm).map((id) => {
          // As it stood on the course and speed held until now (the ordered values have just changed; the ship has not yet).
          const r = truthCpa(w, id);
          return { id, name: targetById(w, id)?.name ?? "", cpa: Math.round((r?.cpa ?? 0) * 100) / 100, tcpaMin: Math.round((r?.tcpaMinutes ?? 0) * 10) / 10 };
        }),
      };
    }
    if (o.manoeuvre) {
      if (Math.abs(turn) > Math.abs(o.maxTurnDeg)) o.maxTurnDeg = turn;
      o.minSpeedRatio = Math.min(o.minSpeedRatio, ratio);
    }
    for (const t of this.def.tasks) {
      if (t.kind === "action" && !this.actionsDone.has(t.id) && t.done(this.ctx(w, a))) {
        this.actionsDone.add(t.id);
        if (this.controls) this.actionBy.set(t.id, this.controls);
      }
    }
  }

  /** After the instructor takes the exercise back in time: scripted events later than `time` will fire again. */
  rewindTo(time: number): void {
    // Steps run in order and each one logs once, so the steps still done are the ones logged by then.
    this.scriptLog = this.scriptLog.filter((e) => e.time <= time);
    this.nextScript = this.scriptLog.length;
  }

  /** How each task will be judged, in words the candidate can read before starting (STCW A-I/12, 8.1 and 8.3). */
  criteria(): TaskCriterion[] {
    return taskCriteria(this.def, this.cfg);
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
      this.answers.set(taskId, { text: `${value} ${t.unit}`, correct: `${shown.toFixed(t.unit === "°" || t.unit === "min" ? 0 : 1)} ${t.unit} (±${t.tol(this.cfg)})`, ok: err <= t.tol(this.cfg) + 1e-9, time: w.time, ...(this.controls ? { by: this.controls } : {}) });
      return true;
    }
    if (t.kind === "choice") {
      const right = t.correct(c);
      this.answers.set(taskId, { text: t.choices[value] ?? "?", correct: t.choices[right] ?? "?", ok: value === right, time: w.time, ...(this.controls ? { by: this.controls } : {}) });
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
        return { id: t.id, label: t.prompt, kind: t.kind, student: r ? r.text : "not answered", correct: r ? r.correct : "-", ok: !!r?.ok, points: r?.ok ? max : 0, max, ...(r?.by ? { by: r.by } : {}) };
      }
      if (t.kind === "action") {
        const ok = this.actionsDone.has(t.id) || t.done(c);
        const max = this.cfg.points.action;
        const by = this.actionBy.get(t.id);
        return { id: t.id, label: t.prompt, kind: t.kind, student: ok ? "done" : "not done", correct: "done", ok, points: ok ? max : 0, max, ...(by ? { by } : {}) };
      }
      const j = t.judge(c);
      const max = this.cfg.points.safety;
      return { id: t.id, label: t.prompt, kind: t.kind, student: j.detail, correct: "", ok: j.ok, points: j.ok ? max : 0, max };
    });
    const limit = timeLimitMin(this.def, this.cfg);
    if (limit !== null) {
      const ok = w.time <= limit * 60 + 1e-6;
      const max = this.cfg.points.safety;
      items.push({ id: TIME_LIMIT_ID, label: `Finished within the time allowed (${limit} min)`, kind: "outcome", student: `finished at ${(w.time / 60).toFixed(1)} min`, correct: "", ok, points: ok ? max : 0, max });
    }
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

/** How one task is judged, in words the candidate can read, and its points. */
export interface TaskCriterion {
  id: string;
  label: string;
  kind: ArpaTask["kind"];
  criterion: string;
  /** The limit applied, short (for example "±0.5 NM"), or "" when there is none. */
  limit: string;
  points: number;
}

/** A target counts as left behind once it has been more than this far away, NM (see Observed.returnRange). */
export const RETURN_OPEN_NM = 0.25;

/** Id of the marked item a time limit adds to an exercise. */
export const TIME_LIMIT_ID = "time-limit";

/** The time allowed for an exercise, minutes: the instructor's figure if one is set, else the exercise's own, else none. */
export function timeLimitMin(def: Pick<ArpaExercise, "id" | "timeLimitMin">, cfg: ScoringConfig): number | null {
  const set = cfg.timeLimits?.[def.id];
  if (typeof set === "number" && set > 0) return set;
  return def.timeLimitMin ?? null;
}

/** How each task of an exercise will be judged with these settings (STCW A-I/12, 8.1 and 8.3). */
export function taskCriteria(def: ArpaExercise, cfg: ScoringConfig): TaskCriterion[] {
  const limit = timeLimitMin(def, cfg);
  const timed: TaskCriterion[] = limit === null ? [] : [{ id: TIME_LIMIT_ID, label: `Finished within the time allowed (${limit} min)`, kind: "outcome", criterion: `Judged at the end: Finish pressed not later than ${limit} minutes of exercise time`, limit: `${limit} min`, points: cfg.points.safety }];
  return [...def.tasks.map((t): TaskCriterion => {
    const base = { id: t.id, label: t.prompt, kind: t.kind };
    if (t.kind === "number") {
      const lim = `±${t.tol(cfg)}${t.unit === "°" || t.unit === "'" ? "" : " "}${t.unit}`;
      return { ...base, criterion: `Your value within ${lim} of the real value at the moment you answer`, limit: lim, points: cfg.points.question };
    }
    if (t.kind === "choice") return { ...base, criterion: "The correct choice", limit: "", points: cfg.points.question };
    if (t.kind === "action") return { ...base, criterion: "Done at some time during the exercise", limit: "", points: cfg.points.action };
    const rule = t.rule?.(cfg) ?? t.judge.rule?.(cfg);
    return { ...base, criterion: rule ? `Judged at the end from what happened: ${rule}` : "Judged from what actually happened, at the end", limit: rule ?? "", points: cfg.points.safety };
  }), ...timed];
}

// ---------------------------------------------------------------- reusable outcome judges

/** Every ship passed no closer than the exercise's safe distance. */
export function judgeSafePassing(def: Pick<ArpaExercise, "safeNm">): OutcomeJudge {
  const rule = (): string => `every vessel passed no closer than ${def.safeNm} NM, and none is still closing inside it at the end`;
  return Object.assign((c: TaskCtx) => {
    const ships = c.w.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft");
    const worst = ships.map((t) => ({ t, r: c.obs.minRange[t.id] ?? Infinity })).sort((x, y) => x.r - y.r)[0];
    if (!worst) return { ok: true, detail: "no ships" };
    const still = threats(c.w, def.safeNm);
    const ok = worst.r >= def.safeNm && still.length === 0;
    const more = still.length > 0 ? `; still closing inside ${def.safeNm} NM: ${still.map((id) => targetById(c.w, id)?.name).join(", ")}` : "";
    return { ok, detail: `closest: ${worst.t.name} ${worst.r.toFixed(2)} NM (needed ${def.safeNm} NM)${more}` };
  }, { rule });
}

/**
 * The avoiding action was substantial (Rule 8(b)) and, in restricted visibility, respected Rule 19(d).
 * `restrictedVisibility`: the exercise is one in which no vessel is in sight, so Rule 19(d) is applied to every
 * vessel. In any other exercise it is applied only to a vessel that was not in sight when the action was taken,
 * which can only be when the instructor or the scenario has set a visibility.
 */
export function judgeAction(restrictedVisibility: boolean): OutcomeJudge {
  const rule = (cfg: ScoringConfig): string =>
    `a turn of at least ${cfg.substantialTurnDeg}° or a cut to ${Math.round((1 - cfg.substantialSpeedCut) * 100)}% of the speed or less (Rule 8(b))` +
    (restrictedVisibility ? "; no turn to port for a vessel forward of the beam other than one being overtaken, and no turn towards a vessel abeam or abaft the beam (Rule 19(d))" : "; with a visibility set, Rule 19(d) is applied for a vessel that was not in sight when the action was taken");
  return Object.assign((c: TaskCtx) => {
    const m = c.obs.manoeuvre;
    if (!m) return { ok: false, detail: "no alteration of course or speed was made" };
    const turn = c.obs.maxTurnDeg;
    const bigTurn = Math.abs(turn) >= c.cfg.substantialTurnDeg;
    const bigCut = c.obs.minSpeedRatio <= 1 - c.cfg.substantialSpeedCut + 1e-9;
    const faults: string[] = [];
    if (!bigTurn && !bigCut) faults.push(`Action too small to be readily apparent (turn ${Math.abs(turn).toFixed(0)}°, speed to ${(c.obs.minSpeedRatio * 100).toFixed(0)}%).`);
    const unseen = restrictedVisibility ? m.threats : m.threats.filter((t) => t.inSight === false);
    if (unseen.length > 0 && Math.abs(turn) >= 5) faults.push(...rule19Check(turn, unseen.map((t) => ({ relBearing: t.relBearing }))).faults);
    const what = `${Math.abs(turn) >= 5 ? `turned ${Math.abs(turn).toFixed(0)}° to ${turn > 0 ? "starboard" : "port"}` : "no turn"}, speed to ${(c.obs.minSpeedRatio * 100).toFixed(0)}%`;
    return { ok: faults.length === 0, detail: faults.length === 0 ? what : `${what}. ${faults.join(" ")}` };
  }, { rule });
}
