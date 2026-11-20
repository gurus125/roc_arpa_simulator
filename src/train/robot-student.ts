import { ArpaSystem, alertPriority, nextToAcknowledge } from "../arpa/index";
import { rule19Check } from "../core/colreg";
import { computeCpa } from "../core/cpa";
import { courseToSteer } from "../core/current";
import { crossTrackError } from "../core/nav";
import { advanceLeg } from "../core/route";
import { expandingSquare, williamsonHeadings } from "../core/search";
import { trialManoeuvre } from "../core/trial";
import { CourseSpeed, Vec2, add, angleDiffDeg, bearingOf, courseSpeedOf, fromPolar, length, normalizeDeg, rotateVec, scale, sub, velocityOf } from "../core/vec";
import {
  RADAR_RANGES, World, createWorld, letGoAnchor, measuredHeading, noiseSpeckle, ownGroundVelocity, ownTurnProfile, radarPower, radarTransmitting,
  setRadarTransmit, setShipModel, stepWorld, switchRadarOn,
} from "../engine/index";
import { ARPA_EXERCISES } from "./arpa-exercises";
import { FOG_AT_SEC, MOB_AT_SEC, ROUTE_27 } from "./nav-exercises";
import { PLOTTING_EXERCISES, PLOT_RULES } from "./plotting-exercises";
import { GOA_ANCHOR, GOA_PI_NM, MALABAR_POINT } from "./port-exercises";
import { RADAR_EXERCISES } from "./radar-exercises";
import { ArpaExSession, ArpaExercise, ExerciseResult, NumberTask, distanceToLandNm, threats, truthCpa } from "./session";
import { PlotWork, ReasonCtx, RobotWhy, choiceWhy, ctsLines, dataLine, encounterLine, f1, f2, planWhy, readNumber } from "./robot-reasons";

export type { RobotWhy } from "./robot-reasons";

/**
 * The robot student: works the exercises of the ARPA EX list at the controls, as a trainee of a chosen level
 * would, so that an instructor can watch an exercise being done and see how the marking answers to good and
 * poor work.
 *
 * It is NOT a model of how real trainees learn or err. What it reads and what it does:
 *  - It looks at the radar picture and the ARPA's data, and answers each question with the value the
 *    exercise checks against (rounded as it would be read off the display). Manual plotting it works from
 *    its own EBL and VRM readings. So a level 5 robot shows what full marks look like; it proves nothing
 *    about the answer key itself (the exercises' own tests do that).
 *  - Its avoiding action is chosen with the ARPA's trial manoeuvre (manual plotting: its own plot), the
 *    smallest alteration to starboard of at least 30 degrees that clears every ship with a margin.
 *  - At levels 1 to 4 it makes mistakes on purpose, by chance: misread values, wrong choices, steps of the
 *    briefing forgotten, action too small, too late or to port, alarms left unacknowledged, sloppy steering
 *    and radar settings. Each mistake is written in its log, so the result can be compared with what it did.
 *  - It explains itself (train/robot-reasons.ts): before each answer and decision it writes why, the rule behind
 *    it and the working with the numbers on the screen; after each mistake, what was wrong and what is right.
 *    With TEACH on, the #demo display stops at each of these until NEXT is pressed.
 *
 * The chances and sizes of the mistakes (ROBOT_LEVELS) are chosen for the demonstration. They are not
 * measured from trainees and are not part of any marking scheme.
 *
 * The same robot works the simulator two ways: through the screen's own controls on the #demo display
 * (ui/robot-ui.ts), and directly on the simulation (DirectHost, below) for the tests.
 */

// ---------------------------------------------------------------- levels

export interface RobotLevel {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  about: string;
  /** Chance that a number is misread (typed 1.6 to 3 times the tolerance off). */
  misread: number;
  /** Chance of a wrong choice. */
  wrongChoice: number;
  /** Chance that a step of the briefing is forgotten. */
  forget: number;
  /** Seconds it takes to start something (least, most). */
  hesitate: [number, number];
  /** Chances that the avoiding action is too small (15 to 20 degrees), late (3 to 6 minutes), or to port. */
  smallAction: number;
  lateAction: number;
  portTurn: number;
  /** Seconds before an alert is acknowledged (least, most). */
  ackDelay: [number, number];
  /** How often it looks at the steering, seconds, and how much of the needed correction it applies. */
  steerEvery: number;
  steerGain: number;
  /** Chance that a radar setting (gain, tuning) is left wrong. */
  setupSlip: number;
}

/** The five levels. Every figure is chosen for the demonstration (see above), not measured. */
export const ROBOT_LEVELS: RobotLevel[] = [
  { level: 1, name: "Beginner", about: "Makes many mistakes: misreads, forgets steps, acts late, too little or the wrong way.", misread: 0.5, wrongChoice: 0.45, forget: 0.35, hesitate: [12, 30], smallAction: 0.45, lateAction: 0.45, portTurn: 0.25, ackDelay: [40, 110], steerEvery: 120, steerGain: 0.45, setupSlip: 0.6 },
  { level: 2, name: "Weak", about: "Often wrong: a third of the answers, a forgotten step now and then, poor timing.", misread: 0.32, wrongChoice: 0.3, forget: 0.22, hesitate: [8, 20], smallAction: 0.35, lateAction: 0.35, portTurn: 0.12, ackDelay: [20, 60], steerEvery: 90, steerGain: 0.6, setupSlip: 0.4 },
  { level: 3, name: "Average", about: "Mostly right, with the odd slip and an action that is sometimes late or small.", misread: 0.18, wrongChoice: 0.18, forget: 0.1, hesitate: [4, 12], smallAction: 0.2, lateAction: 0.2, portTurn: 0.04, ackDelay: [10, 30], steerEvery: 60, steerGain: 0.8, setupSlip: 0.2 },
  { level: 4, name: "Good", about: "Nearly always right; an occasional misreading.", misread: 0.07, wrongChoice: 0.07, forget: 0.03, hesitate: [2, 6], smallAction: 0.05, lateAction: 0.05, portTurn: 0, ackDelay: [5, 15], steerEvery: 40, steerGain: 0.95, setupSlip: 0.05 },
  { level: 5, name: "Excellent", about: "Does everything the briefing asks, in good time, with no mistakes.", misread: 0, wrongChoice: 0, forget: 0, hesitate: [1, 3], smallAction: 0, lateAction: 0, portTurn: 0, ackDelay: [3, 8], steerEvery: 30, steerGain: 1, setupSlip: 0 },
];
export const robotLevel = (n: number): RobotLevel => ROBOT_LEVELS[Math.min(5, Math.max(1, Math.round(n))) - 1]!;

/** The exercises of the ARPA EX list, in number order: the ones the robot can work. */
export const ROBOT_EXERCISES: ArpaExercise[] = [...ARPA_EXERCISES, ...RADAR_EXERCISES, ...PLOTTING_EXERCISES].sort((a, b) => a.number - b.number);

// ---------------------------------------------------------------- what it does at the controls

/** One thing done at the controls. Positions are in the scenario's frame, NM. */
export type RobotAction =
  | { k: "open" }
  | { k: "run" }
  | { k: "acquire"; target: number }
  | { k: "select"; target: number }
  | { k: "measure"; target?: number; at?: Vec2 }
  | { k: "vectors"; mode: "true" | "relative" }
  | { k: "past"; mode: "off" | "true" | "relative" }
  | { k: "limits"; cpa: number; tcpa: number }
  | { k: "zone"; which: "guard" | "exclusion"; on: boolean }
  | { k: "autoAcquire"; on: boolean }
  | { k: "trial"; on: boolean; course?: number; speed?: number; delay?: number }
  | { k: "course"; deg: number }
  | { k: "speed"; kn: number }
  | { k: "helm"; deg: number }
  | { k: "autopilot"; course: number }
  | { k: "ack" }
  | { k: "selfTest" }
  | { k: "groundRef" }
  | { k: "anchorWatch" }
  | { k: "pi"; index: number; bearing: number; range: number; on: boolean }
  | { k: "navLine"; points: Vec2[] }
  | { k: "radarKey" }
  | { k: "control"; id: "gain" | "stc" | "ftc" | "tuning" | "brill"; value: number }
  | { k: "processing"; id: "echoStretch" | "echoAvg" | "irOn"; on: boolean }
  | { k: "range"; nm: number }
  | { k: "pm"; on: boolean }
  | { k: "letGo" }
  | { k: "mob" }
  | { k: "search"; size: number; course: number }
  | { k: "answer"; task: string; value: number }
  | { k: "finish" }
  | { k: "debrief"; text: string };

export type RobotLogKind = "read" | "think" | "why" | "do" | "answer" | "mistake" | "result";
export interface RobotLogEntry {
  /** Exercise time, s. */
  t: number;
  kind: RobotLogKind;
  text: string;
  /** The reason (for "why") or the lesson (for "mistake"). */
  why?: RobotWhy;
}

/** What the robot can see. */
export interface RobotView {
  w: World;
  a: ArpaSystem;
  s: ArpaExSession;
  /** The track selected on the display. */
  selected: number | null;
  /** The man overboard mark. */
  mob: { pos: Vec2; time: number } | null;
  /** EBL 1 bearing (true) and VRM 1 range, when both are on. */
  measured: { bearing: number; range: number } | null;
}

/** The display (or the direct simulation) the robot works. */
export interface RobotHost {
  view(): RobotView;
  /** Let the clock run for `sec` seconds of exercise time. */
  wait(sec: number): Promise<void>;
  /** Do one thing at the controls (the clock runs at normal speed meanwhile). */
  act(a: RobotAction): Promise<void>;
  /** Alerts shown and not yet acknowledged (cautions are never acknowledged). */
  alerts(): { key: string; text: string; raisedAt: number; priority: "alarm" | "warning" | "caution"; acked: boolean }[];
  log(e: RobotLogEntry): void;
  /** True once Stop or Take over has been pressed. */
  stopRequested(): boolean;
  /**
   * Called with each reason or lesson before the robot goes on. The screen host holds the robot (and the clock)
   * here until NEXT is pressed when TEACH is on; left out, the robot never stops.
   */
  teach?(e: RobotLogEntry): Promise<void>;
}

export class RobotStopped extends Error {
  constructor() {
    super("The robot student was stopped.");
  }
}

export interface RobotRun {
  exerciseId: string;
  level: number;
  seed: number;
  result: ExerciseResult | null;
  /** The mistakes made on purpose, in words. */
  mistakes: string[];
  stopped: boolean;
}

function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");
const mm = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** A value as it would be read off the display and typed: degrees whole (tenths for small tolerances), others to 0.1 or 0.01. */
export function readAs(task: Pick<NumberTask, "unit" | "circular">, tol: number, v: number): number {
  if (task.circular || task.unit === "°") {
    const r = tol < 2 ? Math.round(v * 10) / 10 : Math.round(v);
    return task.circular ? Number((normalizeDeg(r) % 360).toFixed(1)) : r;
  }
  return tol < 0.3 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
}
const show = (v: number): string => String(Math.round(v * 100) / 100);
/** A value with its unit: degrees and minutes of arc close up (50°, 42.2'), others after a space (0.8 NM). */
const withUnit = (v: number, unit: string): string => `${show(v)}${unit === "°" || unit === "'" ? "" : " "}${unit}`;

// ---------------------------------------------------------------- the brain

class Brain {
  readonly mistakes: string[] = [];
  private readonly rng: () => number;
  private ackAt = new Map<string, number>();
  private steerJob: { every: number; next: number; fn: () => Promise<void> } | null = null;
  private busy = false;
  private plot = new Map<number, { t: number; rel: Vec2; bearing: number; range: number }[]>();
  /** The target the plotting answers are about. */
  plotFocus: number | null = null;
  /** Reasons and lessons not yet stepped through (TEACH). */
  private toTeach: RobotLogEntry[] = [];
  /** Explanations given once a run. */
  private told = new Set<string>();
  /** Extra avoiding action already taken while monitoring. */
  private extra = 0;
  /** The ships the avoiding action was taken for. */
  private riskIds: number[] = [];

  constructor(readonly ex: ArpaExercise, readonly host: RobotHost, readonly lv: RobotLevel, seed: number) {
    this.rng = lcg(seed * 7919 + lv.level * 104729 + ex.number * 31);
  }

  get v(): RobotView {
    return this.host.view();
  }
  get w(): World {
    return this.v.w;
  }
  get a(): ArpaSystem {
    return this.v.a;
  }
  get s(): ArpaExSession {
    return this.v.s;
  }
  now(): number {
    return this.w.time;
  }
  rand(a: number, b: number): number {
    return a + (b - a) * this.rng();
  }
  chance(p: number): boolean {
    return p > 0 && this.rng() < p;
  }

  log(kind: RobotLogKind, text: string): void {
    this.host.log({ t: this.now(), kind, text });
  }
  think(text: string): void {
    this.log("think", text);
  }
  /**
   * Write why: the reason for what comes next, its rule and its working. `once` gives it only the first time in a
   * run; `stop: false` never stops for it with TEACH (for what repeats).
   */
  explain(why: RobotWhy, o: { once?: string; stop?: boolean } = {}): void {
    if (o.once) {
      if (this.told.has(o.once)) return;
      this.told.add(o.once);
    }
    const e: RobotLogEntry = { t: this.now(), kind: "why", text: why.title, why };
    this.host.log(e);
    if (o.stop !== false) this.toTeach.push(e);
  }
  /** Step through the reasons and lessons written since the robot last did something. */
  async flush(): Promise<void> {
    while (this.toTeach.length > 0) {
      const e = this.toTeach.shift()!;
      if (this.host.teach) await this.host.teach(e);
      this.checkStop();
    }
  }
  /**
   * A mistake made on purpose, with what was wrong and what is right. A lesson with a `once` key is given (and
   * stopped at) only the first time; the same kind of mistake again is logged without it.
   */
  mistake(text: string, lesson?: Omit<RobotWhy, "title">, once?: string): void {
    this.mistakes.push(text);
    const teachIt = lesson && !(once && this.told.has(once));
    if (once) this.told.add(once);
    const e: RobotLogEntry = { t: this.now(), kind: "mistake", text, ...(teachIt ? { why: { title: `Mistake: ${text}`, ...lesson } } : {}) };
    this.host.log(e);
    if (teachIt) this.toTeach.push(e);
  }
  /** False (and a mistake logged, with why the step matters) when this level forgets the step. */
  maybe(step: string, matters: string): boolean {
    if (!this.chance(this.lv.forget)) return true;
    this.mistake(`Forgot to ${step}.`, { reason: matters });
    return false;
  }
  /** What the reasons can see. */
  rc(): ReasonCtx {
    return {
      ex: this.ex, w: this.w, a: this.a, measured: this.v.measured,
      name: (id) => this.name(id),
      track: (id) => this.track(id),
      plot: () => this.plotWork(),
      trial: (course, speed, delayMin) => this.trialRows(course, speed, delayMin),
    };
  }
  checkStop(): void {
    if (this.host.stopRequested()) throw new RobotStopped();
  }

  async act(a: RobotAction, text: string): Promise<void> {
    this.checkStop();
    await this.flush();
    this.log(a.k === "answer" ? "answer" : "do", text);
    await this.host.act(a);
  }

  /** Let time pass, doing what has to be done meanwhile (alarms, steering). */
  async idle(sec: number): Promise<void> {
    const end = this.now() + sec;
    while (this.now() < end - 1e-6) {
      this.checkStop();
      await this.flush();
      await this.host.wait(Math.min(5, end - this.now()));
      await this.duties();
    }
  }
  async until(cond: () => boolean, maxSec: number, stepSec = 5): Promise<boolean> {
    const end = this.now() + maxSec;
    while (!cond()) {
      if (this.now() >= end - 1e-6) return false;
      await this.idle(Math.min(stepSec, end - this.now()));
    }
    return true;
  }
  async hesitate(): Promise<void> {
    await this.idle(this.rand(this.lv.hesitate[0], this.lv.hesitate[1]));
  }

  private async duties(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.ackDuty();
      const j = this.steerJob;
      if (j && this.now() >= j.next) {
        j.next = this.now() + j.every;
        await j.fn();
      }
    } finally {
      this.busy = false;
    }
  }
  private async ackDuty(): Promise<void> {
    const next = nextToAcknowledge(this.host.alerts());
    if (!next) return;
    const key = `${next.key}@${next.raisedAt}`;
    let at = this.ackAt.get(key);
    if (at === undefined) {
      at = next.raisedAt + this.rand(this.lv.ackDelay[0], this.lv.ackDelay[1]);
      this.ackAt.set(key, at);
      this.log("read", `Alert: ${next.text}`);
      if (at - next.raisedAt > 45) {
        this.mistake(`Left the alert "${next.text.replace(/\.$/, "")}" unacknowledged for ${Math.round(at - next.raisedAt)} s.`, {
          reason: "An alarm is there to make the watchkeeper look at once. Left sounding, it shows nobody has seen it, and it can hide the next alarm.",
          rule: "Acknowledge an alarm promptly, then deal with its cause.",
        }, "lateAck");
      }
    }
    if (this.now() >= at) {
      this.explain({
        title: "Acknowledge the alarm",
        reason: `"${next.text.replace(/\.$/, "")}". Acknowledging tells the system the alarm has been seen; then I look at what raised it.`,
        look: "ALARM ACK key, or Ack in the alarm list.",
      }, { once: "ack" });
      await this.act({ k: "ack" }, "ALARM ACK");
    }
  }
  /** Look at the steering every `every` seconds (null: stop). */
  steer(every: number | null, fn?: () => Promise<void>): void {
    this.steerJob = every === null || !fn ? null : { every, next: this.now(), fn };
  }

  // ---- reading the picture
  target(id: number): World["targets"][number] | undefined {
    return this.w.targets.find((t) => t.id === id);
  }
  name(id: number): string {
    return this.target(id)?.name ?? `target ${id}`;
  }
  track(id: number): ArpaSystem["tracks"][number] | undefined {
    return this.a.tracks.find((t) => t.truthId === id && t.state === "tracking");
  }
  steady(ids: number[]): boolean {
    return ids.every((id) => this.track(id)?.quality === "steady");
  }
  ships(): number[] {
    return this.w.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft").map((t) => t.id);
  }
  /** Tracked ships (with data) that will pass inside `nm` and have not yet passed. */
  arpaRisks(nm: number): { id: number; name: string; cpa: number; tcpa: number; relBearing: number }[] {
    const out: { id: number; name: string; cpa: number; tcpa: number; relBearing: number }[] = [];
    for (const t of this.a.tracks) {
      if (t.state !== "tracking" || !t.est || t.quality === "acquiring" || t.truthId === null) continue;
      const tg = this.target(t.truthId);
      if (!tg || (tg.kind !== "ship" && tg.kind !== "small-craft")) continue;
      const c = t.est.cpa;
      if (c.tcpaMinutes === null || c.tcpaMinutes <= 0 || c.cpa >= nm) continue;
      out.push({ id: tg.id, name: tg.name, cpa: c.cpa, tcpa: c.tcpaMinutes, relBearing: normalizeDeg(bearingOf(t.est.rel) - measuredHeading(this.w)) });
    }
    return out;
  }
  /** The part of the line from a to b that lies on the picture (within 85% of the range scale of own ship), as its two ends. */
  onScreen(a: Vec2, b: Vec2): Vec2[] {
    const r = 0.85 * this.w.radar.controls.rangeNm;
    const inside: Vec2[] = [];
    for (let i = 0; i <= 100; i++) {
      const p = add(a, scale(sub(b, a), i / 100));
      if (length(sub(p, this.w.own.pos)) <= r) inside.push(p);
    }
    return inside.length >= 2 ? [inside[0]!, inside[inside.length - 1]!] : [a, b];
  }
  /** A range scale on which a point is well inside the picture. */
  async rangeFor(p: Vec2): Promise<void> {
    const d = length(sub(p, this.w.own.pos));
    const want = RADAR_RANGES.find((s) => s >= 0.75 && s * 0.85 >= d) ?? 48;
    if (this.w.radar.controls.rangeNm * 0.85 < d) await this.act({ k: "range", nm: want }, `Range ${want} NM, so that it is on the picture`);
  }
  done(actionId: string): boolean {
    return this.s.actionsDone.has(actionId);
  }
  truthOf(taskId: string): number | null {
    const t = this.ex.tasks.find((x) => x.id === taskId);
    return t && t.kind === "number" ? t.truth(this.s.ctx(this.w, this.a)) : null;
  }

  // ---- the steps
  async begin(): Promise<void> {
    await this.act({ k: "open" }, `Opens exercise ${this.ex.number}: ${this.ex.title}`);
    this.log("read", this.ex.aim);
    for (const b of this.ex.briefing.slice(0, 2)) this.log("read", b);
    this.explain(planWhy(this.ex));
  }
  async run(): Promise<void> {
    await this.act({ k: "run" }, "RUN: the exercise clock starts");
    await this.hesitate();
  }

  async acquire(ids: number[]): Promise<void> {
    const todo = ids.filter((id) => !this.track(id) && this.target(id));
    if (todo.length > 0) {
      this.explain({
        title: `Acquire ${todo.map((id) => this.name(id)).join(", ")}`,
        reason: "The ARPA gives a target's CPA, TCPA, course and speed, and alarms for her, only once it tracks her. Every ship that could come close is acquired, the nearest and closing ones first.",
        look: "ARPA: ACQUIRE, then click on each echo.",
        rule: "Rule 7: proper use of radar, with systematic observation of the ships detected, to judge risk of collision.",
      }, { once: "acquire" });
    }
    for (const id of ids) {
      if (this.track(id) || !this.target(id)) continue;
      if (!this.maybe(`acquire ${this.name(id)}`, "A ship that is not acquired has no CPA or TCPA on the ARPA and never gives a dangerous-target alarm: she can come close without the ARPA saying anything.")) continue;
      await this.rangeFor(this.target(id)!.pos);
      await this.act({ k: "acquire", target: id }, `Acquires ${this.name(id)}`);
      await this.idle(this.rand(0.5, 1.5) * (this.lv.level >= 4 ? 1 : 2));
    }
  }
  async waitSteady(ids: number[], maxSec = 300): Promise<void> {
    const want = ids.filter((id) => this.a.tracks.some((t) => t.truthId === id && t.state === "tracking"));
    if (want.length === 0) return;
    this.explain({
      title: "Wait for steady data",
      reason: "A new track's first data are rough. The ARPA needs about a minute to show a trend and about three minutes before the vectors, CPA and TCPA are steady. Values read earlier can be far out.",
      look: "While a track is preliminary its data carry a ? and its light in the target list is orange; green when steady.",
    }, { once: "steady" });
    this.think(`Waiting for steady data on ${want.map((id) => this.name(id)).join(", ")} (about 3 minutes from acquisition).`);
    // A weaker trainee reads before the data has settled.
    if (this.lv.level <= 2 && this.chance(0.5)) {
      await this.until(() => want.every((id) => (this.track(id)?.quality ?? "acquiring") !== "acquiring"), maxSec);
      this.mistake("Read the data while the vectors were still preliminary (dashed).", {
        reason: "Preliminary data come from too few plots: course, speed, CPA and TCPA can all be well out, and the answers or decisions taken from them with them.",
        rule: "Wait for steady data (about three minutes after acquisition) before relying on them.",
      });
      return;
    }
    await this.until(() => this.steady(want), maxSec);
    this.log("read", this.trackSummary(want));
  }
  trackSummary(ids: number[]): string {
    return ids
      .map((id) => {
        const t = this.track(id);
        if (!t?.est) return `${this.name(id)}: no data`;
        const c = t.est.cpa;
        return `${this.name(id)} CPA ${c.cpa.toFixed(1)} NM TCPA ${c.tcpaMinutes === null ? "---" : c.tcpaMinutes.toFixed(0)} min, ${pad3(t.est.trueCS.course)}° ${t.est.trueCS.speed.toFixed(1)} kn`;
      })
      .join("; ");
  }

  /**
   * Answer a question. A number is read off the screen as a trainee would (the ARPA's data, the own ship data, the
   * EBL and VRM, the robot's own plot: see robot-reasons.ts), or taken from `value`; the exercise's key is used only
   * to know whether the question can be answered yet, and when nothing on the screen gives the value.
   */
  async answer(taskId: string, value?: number): Promise<boolean> {
    const t = this.ex.tasks.find((x) => x.id === taskId);
    if (!t || this.s.answers.has(taskId) || this.s.finished) return false;
    const c = this.s.ctx(this.w, this.a);
    if (t.kind === "number") {
      const truth = t.truth(c);
      if (truth === null && value === undefined) return false;
      const reading = value === undefined ? readNumber(this.rc(), t) : null;
      const raw = value ?? reading?.value ?? truth;
      if (raw === null) return false;
      const tol = t.tol(this.s.cfg);
      let v = readAs(t, tol, raw);
      const why = reading?.why ?? {
        title: "",
        reason: "There are no steady data on the screen for this (the target is not tracked, or the value is not shown): the answer is the best that can be judged from the picture.",
      };
      this.explain({ ...why, title: `${t.prompt}: ${withUnit(v, t.unit)}` });
      let slip = "";
      const was = v;
      if (this.chance(this.lv.misread)) {
        const off = (this.rng() < 0.5 ? -1 : 1) * (1.6 + 1.4 * this.rng()) * tol;
        v = readAs(t, tol, t.circular ? normalizeDeg(v + off) : Math.max(0, v + off));
        if (Math.abs(t.circular ? angleDiffDeg(v, was) : v - was) > tol) slip = `Misread "${t.prompt}": typed ${show(v)} ${t.unit}, the display showed about ${show(was)} ${t.unit}.`;
        else v = was;
      }
      await this.act({ k: "answer", task: taskId, value: v }, `Answers "${t.prompt}": ${withUnit(v, t.unit)}`);
      if (slip) {
        this.mistake(slip, {
          reason: `The display shows about ${withUnit(was, t.unit)}, but ${withUnit(v, t.unit)} was typed. An answer is credited only within ${withUnit(tol, t.unit)} of the right value (a placeholder tolerance), so this one is lost.`,
          rule: "Read the value twice before entering it, and check that it is the right target, the right field and the right unit.",
        });
      }
      return true;
    }
    if (t.kind === "choice") {
      const right = t.correct(c);
      let pick = right;
      if (this.chance(this.lv.wrongChoice) && t.choices.length > 1) pick = (right + 1 + Math.floor(this.rng() * (t.choices.length - 1))) % t.choices.length;
      const why = choiceWhy(this.rc(), t, right);
      if (pick === right) this.explain({ ...why, title: `${t.prompt} ${t.choices[right]}` });
      await this.act({ k: "answer", task: taskId, value: pick }, `Answers "${t.prompt}": ${t.choices[pick]}`);
      if (pick !== right) this.mistake(`Chose "${t.choices[pick]}" for "${t.prompt}".`, { ...why, reason: `The right answer is "${t.choices[right]}". ${why.reason}` });
      return true;
    }
    return false;
  }
  async answerAll(ids: string[]): Promise<void> {
    for (const id of ids) await this.answer(id);
  }
  /** Answer as soon as each number can be answered (within `maxSec`). */
  async answerWhenReady(ids: string[], maxSec: number): Promise<void> {
    const left = new Set(ids);
    const end = this.now() + maxSec;
    while (left.size > 0 && this.now() < end) {
      for (const id of [...left]) if (this.truthOf(id) !== null && (await this.answer(id))) left.delete(id);
      if (left.size > 0) await this.idle(10);
    }
  }

  async order(course: number | null, speed: number | null, why: string): Promise<void> {
    const o = this.w.own.ordered;
    if (course !== null && Math.abs(angleDiffDeg(course, o.course)) >= 0.5) await this.act({ k: "course", deg: normalizeDeg(Math.round(course)) % 360 }, `Autopilot course ${pad3(course)}°${why ? `: ${why}` : ""}`);
    if (speed !== null && Math.abs(speed - o.speed) >= 0.25) await this.act({ k: "speed", kn: Math.round(speed * 2) / 2 }, `Engine: speed ${Math.round(speed * 2) / 2} kn${why && course === null ? `: ${why}` : ""}`);
  }

  async setLimits(cpa: number, tcpa: number): Promise<void> {
    this.explain({
      title: `CPA limit ${cpa} NM, TCPA limit ${tcpa} min`,
      reason: `The ARPA gives the dangerous-target alarm for any tracked ship that will pass inside ${cpa} NM within ${tcpa} minutes. Set before acquiring, the alarm works from the start. These are the briefing's limits.`,
      look: "VRM / ARPA panel: CPA LIM and TCPA LIM.",
      rule: "The limits suit the waters and the ship: wider in open sea, closer in a busy lane.",
    });
    if (!this.maybe(`set the CPA/TCPA limits to ${cpa} NM / ${tcpa} min`, "With the limits not set as the briefing asks, the dangerous-target alarm comes too late, or not at all, for the ship that matters.")) return;
    await this.act({ k: "limits", cpa, tcpa }, `CPA limit ${cpa} NM, TCPA limit ${tcpa} min`);
  }
  async groundRef(id: number): Promise<void> {
    this.explain({
      title: `Ground stabilisation on ${this.name(id)}`,
      reason: `${this.name(id)} does not move over the ground. Taken as the reference, her apparent movement is treated as the current and removed: true vectors then show motion over the ground, where each ship is really going.`,
      look: "Select the target, then ARPA: Ground stabilisation. The label changes from SEA STAB to GND STAB (REF TGT).",
      rule: "The reference must be a fixed echo, small and isolated: a buoy, a beacon, a rock.",
    });
    if (!this.maybe(`make ${this.name(id)} the ground reference`, "Without a ground reference the true vectors stay through the water: the set and drift, and each ship's motion over the ground, cannot be read.")) return;
    if (!this.track(id)) await this.acquire([id]);
    await this.until(() => !!this.track(id), 60);
    await this.act({ k: "select", target: id }, `Selects ${this.name(id)}`);
    await this.act({ k: "groundRef" }, `Stabilisation: GROUND, ${this.name(id)} as the fixed reference`);
  }

  // ---- collision avoidance with the ARPA's trial manoeuvre
  /** The trial's predicted closest approaches for a course and speed, as the ARPA shows them (nothing is changed). */
  trialRows(course: number, speed: number, delayMin = 1): { name: string; cpa: number; tcpa: number }[] {
    const st = this.a.settings;
    const saved = { ...st.trial };
    st.trial = { on: false, course: normalizeDeg(course), speed, delayMinutes: delayMin };
    try {
      return this.a.trial(this.w).map((r) => {
        const tr = this.a.tracks.find((t) => t.id === r.trackId);
        return { name: tr?.truthId != null ? this.name(tr.truthId) : `track ${r.trackId}`, cpa: r.result.cpa, tcpa: r.result.tcpaMinutes };
      });
    } finally {
      st.trial = saved;
    }
  }
  private clears(rows: { cpa: number; tcpa: number }[], nm: number): boolean {
    return rows.every((r) => r.cpa >= nm || r.tcpa <= 0.01);
  }
  async showTrial(course: number, speed: number): Promise<void> {
    this.explain({
      title: `Check with the trial manoeuvre: ${pad3(course)}° at ${speed} kn`,
      reason: "The trial shows, before anything is changed, the CPA every tracked ship would have with the new course and speed, allowing for own ship's turn and a delay before it starts. It checks that the action works for every ship, not only the dangerous one.",
      look: "ARPA: TRIAL on, course, speed and a 1 minute delay; the picture shows TRIAL and the predicted vectors.",
      rule: "Switch the trial off afterwards: a trial picture left on can be taken for the real one.",
    }, { once: "trial" });
    if (!this.maybe("check the action with the trial manoeuvre first", "Without the trial the alteration is a guess: it may not clear the dangerous ship, or may bring another one close.")) return;
    await this.act({ k: "trial", on: true, course: normalizeDeg(Math.round(course)) % 360, speed, delay: 1 }, `Trial manoeuvre: ${pad3(course)}° at ${speed} kn, starting in 1 minute`);
    await this.idle(4);
    const rows = this.trialRows(course, speed);
    this.log("read", `Trial shows: ${rows.map((r) => `${r.name} ${r.cpa.toFixed(1)} NM`).join(", ") || "no tracked targets"}`);
    await this.act({ k: "trial", on: false }, "Trial off");
  }

  /**
   * Take avoiding action for the ships that will pass inside `safeNm`: the smallest alteration to starboard
   * (at least `minTurn`) that the trial shows clearing every tracked ship by `safeNm` and a margin, keeping
   * to Rule 19(d) in restricted visibility; a speed reduction with it when no turn alone is enough.
   */
  async avoid(o: { safeNm: number; restricted: boolean; minTurn?: number; maxTurn?: number }): Promise<boolean> {
    const risks = this.arpaRisks(o.safeNm);
    if (risks.length === 0) {
      this.think(`No tracked ship will pass inside ${o.safeNm} NM: no action is needed yet.`);
      return false;
    }
    this.riskIds = risks.map((r) => r.id);
    this.think(`Close-quarters situation developing: ${risks.map((r) => `${r.name} CPA ${r.cpa.toFixed(1)} NM in ${r.tcpa.toFixed(0)} min`).join("; ")}.`);
    const rc = this.rc();
    const tracked = this.ships().filter((id) => this.track(id));
    this.explain({
      title: `Close quarters developing with ${risks.map((r) => r.name).join(" and ")}: action is needed`,
      reason: o.restricted
        ? "The visibility is restricted and the ships are known by radar alone, so Rule 19 applies: no ship is stand-on or give-way. Every ship coming into a close-quarters situation must be avoided, in ample time."
        : "The ships are in sight of one another, so the steering and sailing rules for ships in sight decide who gives way.",
      look: "The target list: every ship's CPA and TCPA, from steady tracks.",
      rule: o.restricted
        ? "Rule 19(d): action in ample time; so far as possible, no alteration to port for a ship forward of the beam (unless she is being overtaken), and none towards a ship abeam or abaft the beam."
        : "Rules 15 and 16: the ship with the other on her starboard side keeps out of the way, early and substantially, and avoids crossing ahead of her.",
      working: [
        `The passing distance this exercise asks for: ${o.safeNm} NM (a placeholder).`,
        ...tracked.map((id) => dataLine(rc, id)),
        ...risks.map((r) => encounterLine(rc, r.id, o.restricted)),
      ],
    });
    const base = { course: this.w.own.ordered.course, speed: this.w.own.ordered.speed };
    const margin = 0.3;
    const rows: string[] = [];
    const tryRow = (turn: number, speed: number): { ok: boolean; r19: boolean } => {
      const tr = this.trialRows(base.course + turn, speed);
      const ok = this.clears(tr, o.safeNm + margin);
      const r19 = !o.restricted || rule19Check(turn, risks).ok;
      const close = tr.filter((x) => x.cpa < o.safeNm + margin && x.tcpa > 0.01).map((x) => x.name);
      rows.push(`${turn}° to starboard (${pad3(base.course + turn)}°)${speed !== base.speed ? ` at ${speed} kn` : ""}: ${tr.map((x) => `${x.name} ${x.cpa.toFixed(1)}`).join(", ")} NM ${ok ? (r19 ? "→ clears every ship" : "→ clears, but not in line with Rule 19(d)") : `→ ${close.join(", ")} inside ${f1(o.safeNm + margin)} NM`}`);
      return { ok, r19 };
    };
    let plan: { turn: number; speed: number; clears: boolean } | null = null;
    for (let turn = o.minTurn ?? 30; turn <= (o.maxTurn ?? 90); turn += 10) {
      const x = tryRow(turn, base.speed);
      if (!x.ok || !x.r19) continue;
      plan = { turn, speed: base.speed, clears: true };
      break;
    }
    if (!plan) {
      // No turn alone does it: a large turn with the speed halved.
      for (let turn = o.minTurn ?? 30; turn <= (o.maxTurn ?? 90); turn += 10) {
        const sp = Math.round(base.speed / 2);
        const ok = tryRow(turn, sp).ok;
        if (ok || turn + 10 > (o.maxTurn ?? 90)) {
          plan = { turn, speed: sp, clears: ok };
          break;
        }
      }
    }
    if (!plan) plan = { turn: o.maxTurn ?? 90, speed: base.speed, clears: false };
    this.think(`Plan: ${plan.turn > 0 ? `alter ${plan.turn}° to starboard` : "hold the course"}${plan.speed !== base.speed ? `, speed to ${plan.speed} kn` : ""}.`);
    this.explain({
      title: `Decision: ${plan.turn}° to starboard, to ${pad3(base.course + plan.turn)}°${plan.speed !== base.speed ? `, and speed down to ${plan.speed} kn` : ""}`,
      reason: `I try alterations to starboard in 10° steps, from ${o.minTurn ?? 30}°, with the trial on every tracked ship (starting in 1 minute, with own ship's turn allowed for), and take the first that clears them all by ${o.safeNm} NM with a ${margin} NM margin for the time the turn takes and the errors in the data${o.restricted ? ", and keeps to Rule 19(d)" : ""}${plan.speed !== base.speed ? ". No turn alone was enough, so the speed comes down as well" : ""}. At least 30°, so that the other ships see it at once on their radar.${plan.clears ? "" : " None of those tried clears every ship: this is the best of them, and I will watch closely and do more once she is steady."}`,
      rule: "Rule 8: action in good time, large enough to be readily apparent to another ship watching by radar, not a series of small alterations; then checked until every ship is past and clear. To starboard: it takes own ship away from ships ahead and to starboard, and agrees with what they are expected to do.",
      working: rows,
    });
    // A weaker trainee may act too little, to port, or late.
    let turn = plan.turn;
    const r = this.rng();
    if (r < this.lv.portTurn) {
      turn = -(30 + 10 * Math.floor(this.rng() * 2));
      this.mistake(`Altered to port (${-turn}°) instead of to starboard.`, {
        reason: `The trial and the rules called for ${plan.turn}° to starboard. A turn to port for a ship forward of the beam can meet her own turn to starboard and bring both ships together.`,
        rule: o.restricted ? "Rule 19(d)(i): avoid an alteration to port for a vessel forward of the beam, other than one being overtaken." : "Rules 14, 15 and 17: in a meeting or crossing the give-way action is to starboard; a turn to port for a ship on the port side is to be avoided.",
      });
    } else if (r < this.lv.portTurn + this.lv.smallAction && turn > 0) {
      turn = 15 + 5 * Math.floor(this.rng() * 2);
      this.mistake(`Altered only ${turn}°: too small to be readily apparent on another ship's radar (Rule 8).`, {
        reason: `The trial showed ${plan.turn}° was needed to clear every ship. ${turn}° is hard to see on the other ship's radar, does not give the passing distance, and invites a second alteration later.`,
        rule: "Rule 8(b): an alteration large enough to be readily apparent; a succession of small alterations should be avoided.",
      });
    }
    const course = normalizeDeg(base.course + turn);
    await this.showTrial(course, plan.speed);
    if (this.chance(this.lv.lateAction)) {
      const wait = this.rand(180, 360);
      this.mistake(`Waited ${Math.round(wait / 60)} minutes more before acting: the action was late.`, {
        reason: `With the TCPA only ${Math.round(Math.min(...risks.map((x) => x.tcpa)))} minutes, every minute of waiting needs a bigger alteration later, and leaves the other ship less time to understand it.`,
        rule: "Rule 8(a) and Rule 19(d): avoiding action is taken in ample time.",
      });
      await this.idle(wait);
    } else await this.hesitate();
    await this.order(course, plan.speed !== base.speed ? plan.speed : null, "avoiding action");
    return true;
  }

  /** Every ship past and clear: no tracked ship will pass inside `nm`, and none on the picture is still closing inside it. */
  clearOfAll(nm: number): boolean {
    return this.arpaRisks(nm).length === 0 && threats(this.w, nm).length === 0;
  }
  allPast(): boolean {
    return this.ships().every((id) => {
      const c = truthCpa(this.w, id);
      return !c || c.tcpaMinutes === null || c.tcpaMinutes <= 0;
    });
  }

  /** Watch the ships go past; take more action if one would still pass too close; resume when clear if asked. */
  async monitor(o: { safeNm: number; maxSec: number; resume?: { course: number; speed: number }; restricted?: boolean }): Promise<void> {
    const end = this.now() + o.maxSec;
    let resumed = !o.resume;
    let steadySince: number | null = null;
    this.explain({
      title: "Watch until every ship is past and clear",
      reason: "The action is not finished until every ship is finally past and clear. While own ship turns, the ARPA's data are disturbed, so I judge again only once she is steady on her new course and the tracks have settled (about 3 minutes).",
      rule: "Rule 8(d): check that the action works until the other vessel is finally past and clear.",
    }, { once: "monitor" });
    this.think("Watching the ships pass, ready to do more.");
    while (this.now() < end) {
      await this.idle(30);
      // More action only once own ship is steady on her new course and the tracks have settled again (the data
      // are disturbed while she turns), and only when the trial on the course she is steering still shows a ship too close.
      const w = this.w;
      const steadyNow = Math.abs(angleDiffDeg(measuredHeading(w), w.own.ordered.course)) < 3 && Math.abs(w.own.speedThroughWater - w.own.ordered.speed) < 1;
      steadySince = steadyNow ? (steadySince ?? this.now()) : null;
      if (steadySince !== null && this.now() - steadySince >= 180 && this.lv.level >= 3 && this.extra < 2) {
        const close = this.trialRows(w.own.ordered.course, w.own.ordered.speed, 0).filter((r) => r.cpa < o.safeNm && r.tcpa > 0.01 && r.tcpa < 25);
        if (close.length > 0) {
          this.extra++;
          steadySince = null;
          this.think(`${close[0]!.name} would still pass at ${close[0]!.cpa.toFixed(1)} NM: more action is needed.`);
          this.explain({
            title: "More action: a further 20° to starboard",
            reason: `Steady on the new course, the data show ${close[0]!.name} would still pass at ${close[0]!.cpa.toFixed(1)} NM, inside ${o.safeNm} NM. The first action was not enough, so more is taken, the same way.`,
            rule: "Rule 8(d): if the action is not resulting in a safe passing distance, more action is taken.",
            working: this.trialRows(w.own.ordered.course, w.own.ordered.speed, 0).map((x) => `On ${pad3(w.own.ordered.course)}°: ${x.name} CPA ${x.cpa.toFixed(1)} NM in ${x.tcpa.toFixed(0)} min`),
          });
          await this.order(normalizeDeg(w.own.ordered.course + 20), null, "a further 20° to starboard");
          continue;
        }
      }
      if (!this.clearOfAll(o.safeNm + 0.3)) continue;
      const past = this.riskIds.every((id) => (truthCpa(this.w, id)?.tcpaMinutes ?? 0) <= 0);
      if (!past) continue;
      if (!resumed && o.resume) {
        resumed = true;
        const back = this.trialRows(o.resume.course, o.resume.speed, 0);
        if (this.clears(back, o.safeNm + 0.5)) {
          this.think("All past and clearing: back to the original course.");
          this.explain({
            title: `Resume the original course, ${pad3(o.resume.course)}°`,
            reason: `The ships the action was for are past their closest approach, and the trial on the original course shows no ship would come inside ${o.safeNm} NM with a 0.5 NM margin.`,
            rule: "Come back only when the ships are past and clear, and check first that the old course does not create a new close-quarters situation.",
            working: back.map((x) => `On ${pad3(o.resume!.course)}°: ${x.name} ${x.tcpa > 0.01 ? `CPA ${x.cpa.toFixed(1)} NM` : "past"}`),
          });
          await this.order(o.resume.course, o.resume.speed, "resuming");
          continue;
        }
        this.think("Not yet clear enough to resume the course: holding on.");
      }
      this.think("Every ship is past and clear.");
      return;
    }
  }

  // ---- manual plotting with the EBL and VRM
  async observe(ids: number[]): Promise<void> {
    this.explain({
      title: "Plot each target with the EBL and VRM",
      reason: "With the ARPA off, the only data are bearings and ranges taken by hand. EBL 1 through the middle of the echo gives its true bearing, VRM 1 on its near edge its range. Each pair goes on the plotting sheet with the time; two or more plots a known time apart show how the target moves.",
      look: "EBL / CURSOR panel: EBL 1 and VRM 1, read BRG and RNG.",
      rule: "Rule 7(b): proper use of radar includes radar plotting, or an equivalent systematic watch, of the ships detected.",
    }, { once: "observe" });
    for (const id of ids) {
      if (!this.target(id)) continue;
      await this.act({ k: "measure", target: id }, `EBL and VRM on ${this.name(id)}`);
      const m = this.v.measured;
      if (!m) continue;
      const list = this.plot.get(id) ?? [];
      list.push({ t: this.now(), rel: fromPolar(m.bearing, m.range), bearing: m.bearing, range: m.range });
      this.plot.set(id, list);
      this.log("read", `Plot ${this.name(id)} at ${mm(this.now())}: ${m.bearing.toFixed(1)}° ${m.range.toFixed(2)} NM`);
    }
  }
  /** What the plot says of a target: its relative motion, CPA and TCPA (from now) and its true course and speed. */
  solve(id: number): { rel: Vec2; relVel: Vec2; cpa: number; tcpa: number; trueCS: CourseSpeed } | null {
    const p = this.plot.get(id);
    if (!p || p.length < 2) return null;
    const a = p[0]!, b = p[p.length - 1]!;
    if (b.t - a.t < 120) return null;
    const relVel = scale(sub(b.rel, a.rel), 3600 / (b.t - a.t));
    const rel = add(b.rel, scale(relVel, (this.now() - b.t) / 3600));
    const c = computeCpa(rel, relVel);
    const ownV = velocityOf({ course: measuredHeading(this.w), speed: this.w.own.speedThroughWater });
    return { rel, relVel, cpa: c.cpa, tcpa: c.tcpaMinutes ?? 0, trueCS: courseSpeedOf(add(relVel, ownV)) };
  }
  /** The plot of the target the answers are about, for the reasons. */
  plotWork(): PlotWork | null {
    const id = this.plotFocus;
    if (id === null) return null;
    const p = this.plot.get(id);
    const s = this.solve(id);
    if (!p || !s) return null;
    const a = p[0]!, b = p[p.length - 1]!;
    return {
      id, name: this.name(id), first: { t: a.t, bearing: a.bearing, range: a.range }, last: { t: b.t, bearing: b.bearing, range: b.range },
      rel: s.rel, relVel: s.relVel, own: { course: measuredHeading(this.w), speed: this.w.own.speedThroughWater }, trueCS: s.trueCS,
    };
  }

  async finish(): Promise<ExerciseResult | null> {
    await this.act({ k: "finish" }, "Finish exercise");
    const r = this.s.finished;
    if (!r) return null;
    const bad = r.items.filter((i) => !i.ok);
    const text = [
      `Robot student, level ${this.lv.level} (${this.lv.name}).`,
      bad.length === 0 ? "Every item was credited." : `Not credited: ${bad.map((i) => `${i.label} (${i.student})`).join("; ")}.`,
      this.mistakes.length === 0 ? "No mistakes were made on purpose." : `Mistakes made on purpose at this level: ${this.mistakes.join(" ")}`,
    ].join(" ");
    await this.act({ k: "debrief", text }, "Writes the debrief notes and saves them");
    this.log("result", `Result ${r.score} of ${r.max} (${r.percent.toFixed(0)}%).${bad.length > 0 ? ` Not credited: ${bad.map((i) => i.label).join("; ")}.` : " Every item credited."}`);
    return r;
  }
}

// ---------------------------------------------------------------- the exercises

type Script = (b: Brain) => Promise<void>;

/** Avoiding-action exercises: appraise, act with the trial, watch them pass, finish. */
const avoidance = (o: { ids: number[]; safeNm: number; restricted: boolean; before?: string[]; after?: string[]; ground?: number; resume?: boolean; maxSec?: number; turnMax?: number }): Script => async (b) => {
  await b.begin();
  await b.run();
  await b.acquire(o.ids);
  await b.waitSteady(o.ids, 300);
  if (o.ground !== undefined) {
    await b.groundRef(o.ground);
    await b.idle(60);
  }
  for (const id of o.before ?? []) await b.answer(id);
  if (o.restricted) {
    b.explain({
      title: "Restricted visibility: Rule 19",
      reason: "No ship is in sight, so the rules for ships in sight of one another (stand-on, give-way) do not apply. Each ship detected by radar alone is judged by her CPA and TCPA; if a close-quarters situation is developing, own ship acts, in ample time, whatever the other does.",
      rule: "Rule 19(d): avoid altering to port for a ship forward of the beam (unless she is being overtaken), and avoid altering towards a ship abeam or abaft the beam. Rule 19(b), (e): safe speed, engines ready.",
    }, { once: "r19" });
  }
  const resume = o.resume ? { course: b.w.own.ordered.course, speed: b.w.own.ordered.speed } : undefined;
  await b.avoid({ safeNm: o.safeNm, restricted: o.restricted, ...(o.turnMax ? { maxTurn: o.turnMax } : {}) });
  for (const id of o.after ?? []) await b.answer(id);
  await b.monitor({ safeNm: o.safeNm, maxSec: o.maxSec ?? 2400, ...(resume ? { resume } : {}), restricted: o.restricted });
  await b.finish();
};

/** Manual plotting: observations at 0, 6 and 12 minutes, answers from the plot, the manoeuvre at 12 minutes. */
const plotting: Script = async (b) => {
  await b.begin();
  await b.run();
  const ids = b.ships();
  b.think("The ARPA is off: plotting by hand with EBL 1 and VRM 1, every 6 minutes.");
  await b.observe(ids);
  await b.until(() => b.now() >= 360, 400);
  await b.observe(ids);
  const sol = ids.map((id) => ({ id, s: b.solve(id) })).filter((x) => x.s !== null) as { id: number; s: NonNullable<ReturnType<Brain["solve"]>> }[];
  for (const x of sol) b.log("read", `Plot: ${b.name(x.id)} CPA ${x.s.cpa.toFixed(2)} NM in ${x.s.tcpa.toFixed(1)} min, course ${pad3(x.s.trueCS.course)}° speed ${x.s.trueCS.speed.toFixed(1)} kn`);
  const worst = sol.filter((x) => x.s.tcpa > 0).sort((p, q) => p.s.cpa - q.s.cpa)[0];
  if (worst) {
    b.think(`${b.name(worst.id)} is the most dangerous: answering from the plot.`);
    b.explain({
      title: `The most dangerous target: ${b.name(worst.id)}`,
      reason: "From the plot, each target's relative track gives her CPA; the one that will come closest, soonest, is the most dangerous. The answers are for her.",
      working: sol.map((x) => `${b.name(x.id)}: CPA ${f2(x.s.cpa)} NM, TCPA ${f1(x.s.tcpa)} min (from the plot)`),
    });
    b.plotFocus = worst.id;
    await b.answer("cpa0");
    await b.answer("tcpa0");
    await b.answer("crs0");
    await b.answer("spd0");
  }
  // The manoeuvre: at 12 minutes, not before (a weak trainee may jump the gun).
  const early = b.chance(b.lv.lateAction * 0.6);
  await b.until(() => b.now() >= (early ? 600 : 720), 800);
  if (!early) await b.observe(ids);
  else {
    b.mistake("Manoeuvred at 10 minutes, before the 12 minutes the exercise sets.", {
      reason: "The exercise sets the manoeuvre at 12 minutes, after three plots. Acting at 10 minutes uses a shorter plot (less accurate) and loses the timing item.",
      rule: "Plot long enough to be sure of each target's motion before acting; here, the exercise's 12 minutes.",
    });
  }
  const own = { course: b.w.own.ordered.course, speed: b.w.own.ordered.speed };
  // The result is the closest passing distance as a share of the required 1 NM, and passing wide is marked down
  // too: aim for a little over 1 NM to the target that comes closest.
  const aim = PLOT_RULES.requiredCpaNm * 1.15, least = PLOT_RULES.requiredCpaNm * 1.06;
  const closest = (turn: number, speed: number): number => {
    const prof = ownTurnProfile(b.w, turn, speed - own.speed);
    let min = Infinity;
    for (const id of ids) {
      const s = b.solve(id);
      if (!s) continue;
      const r = trialManoeuvre(s.rel, { course: measuredHeading(b.w), speed: b.w.own.speedThroughWater }, s.trueCS, { course: normalizeDeg(own.course + turn), speed, delayMinutes: 0 }, prof);
      if (r.tcpaMinutes > 0.01) min = Math.min(min, r.cpa);
    }
    return min;
  };
  let plan: { turn: number; speed: number; cpa: number } | null = null;
  const rows: string[] = [];
  for (const speed of [own.speed, Math.round(own.speed * 0.75), Math.round(own.speed / 2)]) {
    for (let turn = speed === own.speed ? 20 : 0; turn <= 120; turn += 5) {
      const c = closest(turn, speed);
      if (c < least) {
        if (turn % 10 === 0) rows.push(`${turn}° to starboard${speed !== own.speed ? ` at ${speed} kn` : ""}: closest ${Number.isFinite(c) ? f2(c) : "--"} NM, under ${f2(least)} NM`);
        continue;
      }
      rows.push(`${turn}° to starboard${speed !== own.speed ? ` at ${speed} kn` : ""}: closest ${f2(c)} NM, enough`);
      // The smallest such turn, unless it passes far wider than needed while a slower speed would do better.
      if (!plan || Math.abs(c - aim) < Math.abs(plan.cpa - aim) - 0.1) plan = { turn, speed, cpa: c };
      break;
    }
    if (plan && Math.abs(plan.cpa - aim) < 0.15) break;
  }
  plan ??= { turn: 90, speed: Math.round(own.speed / 2), cpa: closest(90, Math.round(own.speed / 2)) };
  b.think(`From the plot: ${plan.turn > 0 ? `${plan.turn}° to starboard` : "no turn"}${plan.speed !== own.speed ? `${plan.turn > 0 ? " and" : ","} speed ${plan.speed} kn` : ""}: the closest target then passes at about ${Number.isFinite(plan.cpa) ? plan.cpa.toFixed(2) : "--"} NM.`);
  const rv = b.ex.title.includes("restricted");
  b.explain({
    title: `Decision at 12 minutes: ${plan.turn > 0 ? `${plan.turn}° to starboard, to ${pad3(own.course + plan.turn)}°` : "no turn"}${plan.speed !== own.speed ? `${plan.turn > 0 ? " and" : ","} speed ${plan.speed} kn` : ""}`,
    reason: `For each alteration I work, from the plot, how close every target would then pass (allowing for own ship turning at ${PLOT_RULES.turnDegPerMin}°/min and changing speed at ${PLOT_RULES.speedKnPerMin} kn/min). I take the smallest turn to starboard that passes every target at ${f2(least)} NM or more (${PLOT_RULES.requiredCpaNm} NM, and a little for the errors of a hand plot), aiming at about ${f2(aim)} NM: the result is marked down for passing closer than ${PLOT_RULES.requiredCpaNm} NM, and (half as much) for passing wider. A slower speed is tried when a turn alone passes far too wide or not wide enough.`,
    rule: rv
      ? "Rule 19(d): no alteration to port for a ship forward of the beam, none towards a ship abeam or abaft. Rule 8: large and in good time."
      : "Rules 8, 15 and 16: early and substantial action by the give-way ship, avoiding crossing ahead of the other.",
    working: [...rows, `Chosen: the closest target then passes at about ${Number.isFinite(plan.cpa) ? f2(plan.cpa) : "--"} NM (aim ${f2(aim)} NM).`],
  });
  let turn = plan.turn;
  const r = b.rand(0, 1);
  if (r < b.lv.portTurn) {
    turn = -30;
    b.mistake("Altered 30° to port.", {
      reason: `The plot called for ${plan.turn}° to starboard. A turn to port is not allowed in this exercise, and for a ship forward of the beam it can meet her own turn to starboard.`,
      rule: rv ? "Rule 19(d)(i): avoid altering to port for a vessel forward of the beam." : "Rules 14 to 17: the give-way action is to starboard.",
    });
  } else if (r < b.lv.portTurn + b.lv.smallAction && plan.turn >= 20) {
    turn = Math.max(10, plan.turn - 20);
    b.mistake(`Altered only ${turn}° instead of the ${plan.turn}° the plot called for.`, {
      reason: `The plot showed ${plan.turn}° was needed for ${PLOT_RULES.requiredCpaNm} NM. ${turn}° leaves the closest target nearer than required and is harder to see on her radar.`,
      rule: "Rule 8(b): an alteration large enough to be readily apparent.",
    });
  }
  await b.order(normalizeDeg(own.course + turn), plan.speed !== own.speed ? plan.speed : null, "the manoeuvre at 12 minutes");
  let nextObs = b.now() + 360;
  const end = b.now() + 63 * 60;
  while (!b.allPast() && b.now() < end) {
    await b.idle(30);
    if (b.now() >= nextObs) {
      nextObs += 360;
      await b.observe(ids);
    }
  }
  await b.idle(30);
  await b.finish();
};

const SCRIPTS: Record<string, Script> = {
  "arpa-1": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    await b.waitSteady([1, 2, 3]);
    await b.answerAll(["cpaA", "tcpaA", "crsB", "danger"]);
    await b.finish();
  },
  "arpa-2": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3, 4]);
    b.explain({
      title: "Relative vectors first",
      reason: "A relative vector shows where a ship will be, relative to own ship, after the vector time. Extended, it is her relative track: if it points at own ship (the centre), she is on a collision course. This shows risk at a glance.",
      look: "VRM / ARPA panel: Vector REL; the vector time (6 min) sets how long the lines are.",
    });
    await b.act({ k: "vectors", mode: "relative" }, "Vectors: RELATIVE");
    await b.waitSteady([1, 2, 3, 4]);
    b.think("Relative vectors: the one pointing at own ship has the smallest CPA; no relative vector means she moves as we do.");
    await b.answerAll(["coll", "same"]);
    if (b.maybe("look at the true vectors", "Only true vectors show each ship's own course and speed (her aspect): which way she is heading, and whether she is stopped.")) {
      b.explain({
        title: "Now true vectors",
        reason: "A true vector shows a ship's own course and speed: where she is heading (her aspect), which the collision rules need. Own ship gets a vector too. A ship that is stopped has none.",
        look: "Vector TRUE.",
      });
      await b.act({ k: "vectors", mode: "true" }, "Vectors: TRUE");
      await b.idle(15);
      b.think("True vectors: a ship with no true vector is stopped in the water.");
    }
    await b.answerAll(["stop", "crsD", "spdD"]);
    b.explain({ title: "Back to relative vectors", reason: "For keeping watch, relative vectors show who is on a collision course; true vectors are looked at to judge each ship's aspect.", look: "Vector REL." }, { stop: false });
    await b.act({ k: "vectors", mode: "relative" }, "Back to relative vectors");
    await b.finish();
  },
  "arpa-3": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    await b.waitSteady([1, 2, 3]);
    if (b.maybe("switch on past positions", "Without past positions a ship's alteration shows only when her vector has already swung, and the history that shows it happening is lost.")) {
      b.explain({
        title: "Past positions on: true, 5 dots a minute apart",
        reason: "Past positions show where each ship was over the last minutes. Dots in a straight line, evenly spaced: steady course and speed. A bend: she is altering course. Closer or wider spacing: she is changing speed.",
        look: "VRM / ARPA panel: PAST.",
      });
      await b.act({ k: "past", mode: "true" }, "Past positions: TRUE, 5 dots 1 minute apart");
    }
    b.think("Watching the dots for a bend or a change of spacing.");
    if (await b.until(() => b.truthOf("newcrs") !== null, 1200, 10)) {
      await b.idle(60);
      b.think("Ship H's dots are bending: she has altered course. Waiting for her vector to settle again.");
      b.explain({
        title: "Ship H has altered: wait for her vector to settle",
        reason: "The ARPA smooths each track over several minutes, so after an alteration its vector swings round slowly. Her new course and CPA can only be trusted once the dots run straight again and the vector has stopped moving (a couple of minutes).",
        look: "Her past position dots and her vector.",
      });
      await b.idle(150);
    }
    await b.answerAll(["who", "newcrs", "cpaH"]);
    await b.finish();
  },
  "arpa-4": async (b) => {
    await b.begin();
    await b.run();
    b.explain({
      title: "Guard zone, automatic acquisition and an exclusion area",
      reason: "A guard ring (here 5.5 to 6 NM) catches every echo that crosses into it from outside: the ARPA acquires it and sounds a new-target alarm. The rocks to the north-east are small enough to be taken for ships, so an exclusion area over them keeps them out.",
      look: "ARPA menu: Guard 1, Auto acquisition, Exclude 1.",
      rule: "Automatic acquisition helps but does not replace the watchkeeper's look-out on the radar picture.",
    });
    if (b.maybe("switch on the guard zone", "Without the guard zone nothing is acquired automatically: ships entering the area are not tracked until someone notices them.")) await b.act({ k: "zone", which: "guard", on: true }, "Guard 1 on (ring 5.5 to 6 NM)");
    if (b.maybe("tick automatic acquisition", "The guard zone alone only alarms; with automatic acquisition the ships it catches are tracked as well.")) await b.act({ k: "autoAcquire", on: true }, "Automatic acquisition on");
    if (b.maybe("set the exclusion area over the rocks", "Without it the rocks are acquired as false targets, filling the list and hiding real ships among them.")) await b.act({ k: "zone", which: "exclusion", on: true }, "Exclude 1 on, over the rocks to the north-east");
    b.explain({
      title: `Acquire ${b.name(4)} by hand`,
      reason: "She is already inside the guard ring, so she will never cross it: the guard zone cannot acquire her. Only a look at the picture finds her.",
    });
    await b.acquire([4]);
    b.think("Waiting for ships to come into the guard ring; acknowledging the new-target alarms.");
    await b.until(() => b.done("ships") && b.done("ack"), 1000, 10);
    await b.acquire([4, 5]);
    await b.until(() => b.done("ships"), 300, 10);
    await b.answer("why");
    await b.finish();
  },
  "arpa-5": async (b) => {
    await b.begin();
    await b.run();
    await b.setLimits(2, 20);
    await b.acquire([1, 2, 3, 4]);
    await b.waitSteady([1, 2, 3, 4]);
    await b.answerWhenReady(["bcr"], 300);
    b.think("Waiting for the dangerous-target alarm.");
    await b.until(() => b.done("ack"), 900, 10);
    await b.answerAll(["who", "ast"]);
    await b.finish();
  },
  "arpa-6": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    await b.waitSteady([1, 2, 3]);
    await b.answer("alt");
    // The alteration it found with the trial (as it typed it) is where its avoiding action starts.
    const typed = parseFloat(b.s.answers.get("alt")?.text ?? "");
    await b.avoid({ safeNm: 2, restricted: false, minTurn: Math.max(30, Number.isFinite(typed) ? typed : 30) });
    await b.monitor({ safeNm: 2, maxSec: 2400 });
    await b.finish();
  },
  "arpa-7": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2]);
    await b.waitSteady([1, 2]);
    b.think("Sea stabilised: the light float has a true vector, the reverse of the set and drift.");
    b.explain({
      title: "Sea stabilised: the light float seems to move",
      reason: "Sea stabilised, the ARPA knows own ship's motion only through the water (gyro and log). The current carries everything, so a fixed float seems to drift the opposite way: its 'true' vector is the current reversed.",
      working: [
        dataLine(b.rc(), 1),
        ...(() => {
          const t = b.track(1);
          return t?.est ? [`Reversed: ${pad3(t.est.trueCS.course)}° − 180° = ${pad3(t.est.trueCS.course + 180)}° at ${f1(t.est.trueCS.speed)} kn: the set and drift of the current, as near as the float's track shows it.`] : [];
        })(),
      ],
    });
    await b.answer("seaC");
    await b.groundRef(1);
    await b.idle(150);
    b.think("Ground stabilised: the float is still; Ship T's vector now shows her course over the ground.");
    await b.answerAll(["gndC", "set", "drift"]);
    await b.finish();
  },
  "arpa-8": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3]);
    b.explain({
      title: "Run the ARPA self-test",
      reason: "The self-test checks the ARPA's own processing against known test targets. It cannot check the gyro and log that feed it: those only the watchkeeper can check.",
      look: "ARPA menu: Self-test.",
    });
    if (b.maybe("run the ARPA self-test", "The self-test is the only check that the ARPA's own tracking and calculation are working.")) await b.act({ k: "selfTest" }, "ARPA self-test");
    await b.waitSteady([1, 3]);
    b.think("Comparing the heading with the course made good and watching the beacon's true vector.");
    b.explain({
      title: "Watch the inputs: heading, speed and a fixed mark",
      reason: "A wrong gyro or log gives no alarm. With no current here, HDG should equal COG and STW should equal SOG; and Beacon W, which is fixed, should have no true vector. Any difference means a wrong input.",
      look: "OWN SHIP DATA: HDG, COG, STW, SOG; Beacon W's vector.",
    });
    if (await b.until(() => b.truthOf("gyro") !== null, 900, 10)) b.think("The fixed beacon shows a true vector and the heading disagrees: the gyro reads high.");
    await b.answerAll(["which", "gyro", "cpaerr"]);
    await b.until(() => b.done("ack"), 240, 10);
    await b.finish();
  },
  "arpa-9": avoidance({ ids: [1, 2, 3, 4], safeNm: 2, restricted: true, before: ["who"], resume: true }),
  "radar-10": async (b) => {
    await b.begin();
    const tr = b.ex.track;
    b.explain({
      title: "Parallel index line: 000°, 1.5 NM to starboard",
      reason: "On the planned track (000°) Point Light passes 1.5 NM to starboard. A line drawn parallel to the track, 1.5 NM to starboard of own ship, is where the light's echo must stay. It moves down the line as the ship goes on; if it leaves the line, the ship has left the track by the same amount.",
      look: "MENU, PI / MAP: parallel index line 1, bearing 000, distance 1.5 (starboard).",
      rule: "Parallel indexing works with a stabilised picture and a correctly identified mark; it shows cross-track error directly, without plotting fixes.",
    });
    if (b.maybe("set the parallel index line", "Without the index line the distance off track can only be found by fixing again and again; the line shows it at a glance.")) await b.act({ k: "pi", index: 0, bearing: 0, range: 1.5, on: true }, "PI 1: 000°, 1.5 NM to starboard, through Point Light");
    if (tr && b.maybe("draw a navigation line", "The navigation line marks the track (or a limit) on the radar picture, so a drift towards the shoal is seen early.")) {
      b.explain({ title: "A navigation line along the track", reason: "Drawn on a ground-stabilised, north-up picture, it stays fixed to the ground: the ship's position against it shows at once whether she is on the track or drifting towards the shoal." }, { stop: false });
      await b.act({ k: "navLine", points: b.onScreen(tr.a, tr.b) }, "Draws the planned track as a navigation line");
    }
    await b.run();
    await b.answer("cts");
    b.explain({
      title: "How I keep on the track",
      reason: `Steer the course to steer, then every ${b.lv.steerEvery} s compare the light's echo with the index line (the distance off track) and correct the course: a few degrees towards the track for each tenth of a mile off, never more than 15°.`,
      working: (() => {
        const cts = courseToSteer(0, Math.max(1, b.w.own.speedThroughWater), b.w.env.current)?.heading ?? 0;
        const k = Math.round(6 * b.lv.steerGain);
        return [
          `Course to steer for the current: ${pad3(cts)}°.`,
          `Correction: about ${k}° towards the track for each 0.1 NM off it, at most 15°.`,
          `For example, the light's echo 0.1 NM inside the index line (own ship 0.1 NM to starboard of the track): steer ${pad3(cts - k)}° until it is back on the line.`,
        ];
      })(),
    });
    b.steer(b.lv.steerEvery, async () => {
      const w = b.w;
      const cts = courseToSteer(0, Math.max(1, w.own.speedThroughWater), w.env.current)?.heading ?? 0;
      const xte = tr ? crossTrackError(w.own.pos, tr.a, tr.b) : w.own.pos.e;
      await b.order(cts - Math.max(-15, Math.min(15, xte * 60 * b.lv.steerGain)), null, "");
    });
    await b.idle(60);
    await b.answer("why");
    await b.until(() => b.s.obs.trackDone, 4200, 10);
    b.steer(null);
    await b.finish();
  },
  "radar-11": async (b) => {
    await b.begin();
    await b.run();
    b.think("A line of 12 dots: a SART. The survival craft is at the dot nearest own ship.");
    await b.answerAll(["where", "racon", "band"]);
    await b.idle(20);
    const sart = b.target(1);
    if (sart) {
      await b.rangeFor(sart.pos);
      await b.act({ k: "measure", target: 1 }, "EBL and VRM on the nearest dot of the SART");
    }
    await b.answerAll(["rng", "brg"]);
    b.explain({
      title: "Home on the SART, slowing down as I close",
      reason: "Steer straight for the dot nearest own ship and keep it on the heading line. Inside about 3 NM slow down (5 kn, then 4 inside 1 NM): the craft is small, people may be in the water, and own ship must be able to stop close to it.",
      look: "As the range closes the dots grow into arcs and then circles: own ship is very near.",
    });
    b.steer(b.lv.steerEvery / 2, async () => {
      const t = b.target(1);
      if (!t) return;
      const rel = sub(t.pos, b.w.own.pos);
      const d = length(rel);
      await b.order(bearingOf(rel), d < 1 ? 4 : d < 3 ? 5 : null, d < 3 ? "slowing down to close the craft" : "homing on the SART");
    });
    await b.until(() => (b.s.obs.minRange[1] ?? Infinity) <= 0.3, 6000, 10);
    b.steer(null);
    await b.finish();
  },
  "radar-22": async (b) => {
    await b.begin();
    await b.run();
    b.explain({
      title: "Switch on: warm-up, standby, transmit",
      reason: "The RADAR key switches the radar on; the transmitter needs to warm up before it may transmit, then waits in STANDBY. The key again starts transmitting.",
      look: "The RADAR key; the screen shows WARMING UP, then STANDBY.",
    });
    await b.act({ k: "radarKey" }, "RADAR key: switches on; it warms up");
    await b.until(() => radarPower(b.w) === "standby", 200, 5);
    await b.act({ k: "radarKey" }, "RADAR key again: transmit");
    await b.answer("first");
    if (b.maybe("raise the brilliance first", "With the brilliance low the noise and the echoes cannot be seen, so the gain and the tuning are set blind.")) await b.act({ k: "control", id: "brill", value: 70 }, "Brilliance up to 70");
    b.explain({
      title: "Sea and rain clutter to zero, signal processing off",
      reason: "The gain is set by the noise speckle. Sea and rain clutter controls, and the processing (echo stretch, averaging, interference rejection), all change what is shown, so they are taken out first; otherwise the gain is set wrongly and weak echoes are lost.",
      look: "GAIN / CLUTTER: SEA and RAIN to 0; under RADAR: ENH, SC/SC and IR off (their letters go dark).",
    });
    await b.act({ k: "control", id: "stc", value: 0 }, "Sea clutter to zero");
    await b.act({ k: "control", id: "ftc", value: 0 }, "Rain clutter to zero");
    for (const id of ["echoStretch", "echoAvg", "irOn"] as const) {
      if (id === "irOn" && !b.maybe("switch off the interference rejection", "With interference rejection on, the noise speckle is thinned out and the gain is then set too high.")) continue;
      await b.act({ k: "processing", id, on: false }, `${id === "echoStretch" ? "Echo stretch" : id === "echoAvg" ? "Echo averaging" : "Interference rejection"} off`);
    }
    const c = b.w.radar.controls;
    const opt = b.w.radar.tuningOptimum;
    const gainFor = (tuning: number, want: number): number => {
      let best = 50, err = Infinity;
      for (let g = 0; g <= 100; g++) {
        const e = Math.abs(noiseSpeckle({ ...c, gain: g, tuning }, opt) - want);
        if (e < err) {
          err = e;
          best = g;
        }
      }
      return best;
    };
    b.think("Gain up until a light, even speckle of noise just shows.");
    b.explain({
      title: "Gain to a light speckle of noise",
      reason: "A light, even speckle of noise means the receiver is just sensitive enough for the weakest echoes. With no speckle at all, weak echoes are lost; with heavy speckle they are hidden in the noise.",
      look: "The picture beyond the sea clutter, on a medium range scale.",
    });
    await b.act({ k: "control", id: "gain", value: gainFor(c.tuning, 0.1) }, "Gain to a light speckle");
    b.think("Tuning for the greatest extent of the sea clutter and the land to the east.");
    b.explain({
      title: "Tune for the most clutter and land",
      reason: "Sweep the tuning through and stop where the sea clutter and the land to the east show furthest and strongest. That is where the receiver matches the transmitter; a strong ship's echo looks bright even when the tuning is off.",
      look: "GAIN / CLUTTER: TUNE; the TUNE meter is only a guide.",
    });
    let tune = Math.round(opt);
    if (b.chance(b.lv.setupSlip)) {
      tune = Math.max(0, Math.min(100, tune + (b.rand(0, 1) < 0.5 ? -1 : 1) * Math.round(b.rand(9, 14))));
      b.mistake(`Left the tuning at ${tune}, off the best: judged it on a strong echo instead of the clutter.`, {
        reason: "A strong echo saturates and looks bright whatever the tuning, so it cannot show the best point. Mistuned, every weak echo is weaker still and may be lost.",
        rule: "Judge the tuning on the greatest extent of sea clutter, rain or land, or with the performance monitor.",
      });
    }
    await b.act({ k: "control", id: "tuning", value: Math.max(0, Math.min(100, tune + (tune > 50 ? -8 : 8))) }, "Tuning: sweeping through");
    await b.act({ k: "control", id: "tuning", value: tune }, "Tuning: best picture");
    let gain = gainFor(tune, 0.1);
    if (b.chance(b.lv.setupSlip)) {
      gain = gainFor(tune, 0.45);
      b.mistake("Set the gain too high: a heavy speckle of noise over the picture.", {
        reason: "Heavy noise hides weak echoes among the speckle, and the ARPA can take noise for targets.",
        rule: "A light, even speckle just showing: no more.",
      });
    }
    b.explain({ title: "Gain checked again", reason: "Tuning changes the strength of everything shown, so the speckle is checked once more after it." }, { stop: false });
    await b.act({ k: "control", id: "gain", value: gain }, "Gain checked again after tuning");
    if (b.maybe("go to the 12 NM range scale", "On a very short scale the picture cannot be judged: the coast and ships far off do not show.")) {
      b.explain({ title: "12 NM range scale", reason: "A medium range scale shows the coast, the ships and the noise together, so the whole set-up can be judged." }, { stop: false });
      await b.act({ k: "range", nm: 12 }, "Range 12 NM to judge the picture");
    }
    if (b.maybe("check the performance monitor", "In open water with nothing about, a picture without echoes looks the same whether the radar works or not: the monitor proves it does.")) {
      b.explain({
        title: "Performance monitor",
        reason: "The monitor sends a known test signal and shows it as arcs on the picture. If they look as they should, the transmitter and receiver are working properly; weak arcs mean lost performance.",
        look: "Under RADAR: performance monitor (MON).",
      });
      await b.act({ k: "pm", on: true }, "Performance monitor on");
      await b.idle(12);
      b.think("The performance monitor's arcs are as they should be.");
      await b.act({ k: "pm", on: false }, "Performance monitor off");
    }
    b.explain({
      title: "Sea clutter set for the sea, last",
      reason: "Only now is the sea clutter control raised, just enough to break up the clutter close round own ship while small echoes in it still show. Too much wipes out small boats near the ship.",
      look: "GAIN / CLUTTER: SEA.",
    });
    await b.act({ k: "control", id: "stc", value: 20 }, "Sea clutter set for the sea");
    const n = noiseSpeckle(b.w.radar.controls, opt);
    if (n < 0.04 || n > 0.22) await b.act({ k: "control", id: "gain", value: gainFor(b.w.radar.controls.tuning, 0.1) }, "Gain touched up");
    await b.answer("tunejudge");
    await b.idle(10);
    await b.finish();
  },
  "radar-23": async (b) => {
    await b.begin();
    await b.run();
    b.think("No GNSS: fixing by radar range and bearing of Malabar Point.");
    b.explain({
      title: "Fix by radar on Malabar Point",
      reason: "With the GNSS failed the position must come from the radar. Malabar Point is charted, high and well defined, so its echo can be identified with confidence. Its range and bearing, taken together, fix the ship.",
      look: "The high ground north of Back Bay; its west tip.",
    });
    await b.rangeFor(MALABAR_POINT);
    await b.act({ k: "measure", at: MALABAR_POINT }, "EBL and VRM on Malabar Point");
    const m = b.v.measured;
    if (m) b.log("read", `Malabar Point ${m.bearing.toFixed(1)}° ${m.range.toFixed(2)} NM`);
    await b.answer("rng");
    await b.answer("brg");
    b.think("Working the fix: latitude 18°56.9' less range × cos(bearing); longitude 072°47.5' less range × sin(bearing) ÷ cos(lat).");
    await b.answerAll(["lat", "lon", "best", "why"]);
    await b.until(() => b.now() >= 900 || distanceToLandNm(b.w) < 2.6, 1200, 10);
    b.explain({
      title: "Stand off the land: course 240°",
      reason: `The ship is closing the coast at 8 kn and is now about ${f1(distanceToLandNm(b.w))} NM off. With no GNSS and no depths shown here, I turn away in good time to keep well outside the 1 NM margin.`,
      rule: "Keep a margin of safety from the land that allows for the uncertainty of a radar fix.",
    });
    await b.order(240, null, "standing off the land");
    await b.idle(300);
    await b.finish();
  },
  "radar-24": async (b) => {
    await b.begin();
    b.explain({
      title: `Parallel index line: 090°, ${GOA_PI_NM.toFixed(2)} NM to port`,
      reason: `On the planned track (090°) Mormugao Point lies ${GOA_PI_NM.toFixed(2)} NM to port of the track line. A line parallel to the track at that distance is where its echo must stay as the ship approaches; any movement off the line is the ship leaving the track.`,
      look: "MENU, PI / MAP: bearing 090, distance −0.54 (port).",
    });
    if (b.maybe("set the parallel index line", "Without the index line the distance off the planned track is not seen until a fix is worked: in an approach that is too slow.")) await b.act({ k: "pi", index: 0, bearing: 90, range: -GOA_PI_NM, on: true }, `PI 1: 090°, ${GOA_PI_NM.toFixed(2)} NM to port, through Mormugao Point`);
    await b.run();
    await b.answerAll(["vrm", "cts"]);
    b.explain({
      title: "The approach: keep on the line, slow down, let go at the VRM",
      reason: "Steer the course to steer and correct by the index line. The anchor must go down with almost no way on, so the speed comes off in steps: 6 kn inside 3 NM, 3 kn inside 1.2 NM, then astern to stop. Let go when the point's echo meets the VRM ring and the ship is below 1 kn over the ground.",
      rule: "Plan the speed reduction: a ship carries her way a long distance.",
    });
    const w = (): World => b.w;
    b.steer(Math.min(30, b.lv.steerEvery), async () => {
      const x = w();
      if (x.own.anchor) return;
      const togo = GOA_ANCHOR.e - x.own.pos.e;
      const cts = courseToSteer(90, Math.max(1, x.own.speedThroughWater), x.env.current)?.heading ?? 90;
      const course = normalizeDeg(cts + Math.max(-15, Math.min(15, (x.own.pos.n - GOA_ANCHOR.n) * 60 * b.lv.steerGain)));
      const speed = togo <= 0.25 ? (x.own.speedThroughWater > 0.5 ? -5 : 0) : togo <= 1.2 ? 3 : togo <= 3 ? 6 : null;
      await b.order(course, speed, togo <= 0.25 ? "taking the way off" : togo <= 3 ? "reducing speed for the anchorage" : "");
      if (Math.abs(togo) < 0.3 && length(ownGroundVelocity(x)) < 1) await b.act({ k: "letGo" }, "LET GO ANCHOR");
    });
    await b.until(() => !!b.w.own.anchor, 6000, 5);
    b.steer(null);
    if (b.w.own.anchor) {
      b.think("Anchored. Anchor watch on the anchorage buoy.");
      b.explain({
        title: "Anchor watch on the anchorage buoy",
        reason: "At anchor the ship should stay put. The ARPA's anchor watch marks a fixed echo and alarms if its range or bearing from own ship changes by more than a set amount: that is own ship moving, dragging her anchor. A moored buoy is a good mark; a ship at anchor is not (she swings).",
        look: "Select the buoy's track, then Anchor watch: On, selected target.",
      });
      await b.acquire([4]);
      await b.waitSteady([4], 300);
      if (b.track(4) && b.maybe("set the anchor watch", "Without the anchor watch a dragging anchor is found only at the next position check, or when the ship is already in danger.")) {
        await b.act({ k: "select", target: 4 }, `Selects ${b.name(4)}`);
        await b.act({ k: "anchorWatch" }, "Anchor watch on the selected target");
        if (b.a.settings.anchorWatch.trackId === null) {
          await b.idle(30);
          await b.act({ k: "anchorWatch" }, "Anchor watch: again");
        }
      }
      await b.until(() => b.done("ack"), 1500, 10);
      if (b.done("ack")) b.think("The buoy has moved from its mark: we are dragging. Checking by other fixed marks.");
    }
    await b.answer("drag");
    await b.finish();
  },
  "radar-25": avoidance({ ids: [1, 2, 3, 4, 5], safeNm: 1, restricted: true, before: ["cpa1", "tcpa1", "cpa2", "rule", "coast"] }),
  "radar-26": avoidance({ ids: [1, 2, 3, 4], safeNm: 1, restricted: false, ground: 1, before: ["set", "rate", "cpa", "tcpa", "aspect", "refship"] }),
  "radar-27": async (b) => {
    await b.begin();
    await b.run();
    await b.answerAll(["side", "xtdmean"]);
    b.explain({
      title: "How I keep on the route",
      reason: `For the leg I am on, work out the course to steer for the current and steer it; every ${Math.min(30, b.lv.steerEvery)} s look at the XTD and steer a little towards the track when off it. Half a mile before each waypoint, change to the next leg: a ship takes time to turn, so the turn starts early.`,
      look: "EBL / CURSOR panel: the next waypoint, its bearing and distance, and XTD (S = starboard of the leg, P = port).",
      working: ctsLines(b.rc(), 40),
    });
    b.steer(Math.min(30, b.lv.steerEvery), async () => {
      const x = b.w;
      const leg = advanceLeg(ROUTE_27, x.own.pos, 0, 0.5);
      const track = bearingOf(sub(ROUTE_27[leg + 1]!, ROUTE_27[leg]!));
      const xtd = crossTrackError(x.own.pos, ROUTE_27[leg]!, ROUTE_27[leg + 1]!);
      const cts = courseToSteer(track, Math.max(1, x.own.speedThroughWater), x.env.current)?.heading ?? track;
      await b.order(normalizeDeg(cts - Math.max(-25, Math.min(25, xtd * 150 * b.lv.steerGain))), null, "");
    });
    await b.idle(60);
    await b.answer("cts");
    await b.until(() => b.s.obs.trackDone, 3600, 10);
    b.steer(null);
    await b.finish();
  },
  "radar-28": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3, 8]);
    await b.waitSteady([1, 2], 240);
    await b.answer("cpa");
    await b.answerAll(["lane", "ferry", "cross"]);
    b.think("The ferry crosses from starboard: own ship gives way (rule 15). A turn would take us across the lane, so we slow down.");
    let speed = 5;
    const tried: string[] = [];
    for (const sp of [8, 6, 5, 4]) {
      const rows = b.trialRows(b.w.own.ordered.course, sp);
      const ok = rows.every((r) => r.cpa >= 0.8 || r.tcpa <= 0.01);
      tried.push(`${sp} kn: ${rows.filter((r) => r.tcpa > 0.01).map((r) => `${r.name} ${r.cpa.toFixed(1)}`).join(", ")} NM ${ok ? "→ every ship 0.8 NM or more" : "→ not enough"}`);
      if (ok) {
        speed = sp;
        break;
      }
    }
    b.explain({
      title: `Decision: give way to the ferry by slowing to ${speed} kn`,
      reason: "The ferry is crossing from starboard with risk of collision, so own ship keeps out of her way. A turn to starboard would take us across our lane towards the ships coming up astern and the slow ship ahead; slowing down lets the ferry cross ahead with room, and keeps us in the lane with the flow. The slowest speed tried first that clears every ship is taken.",
      rule: "Rule 15 (crossing) and Rule 16 (early and substantial action); Rule 8: a large reduction of speed is as apparent as an alteration; Rule 10: keep in the lane.",
      working: [dataLine(b.rc(), 1), ...tried],
    });
    await b.showTrial(b.w.own.ordered.course, speed);
    if (b.chance(b.lv.lateAction)) {
      b.mistake("Slowed down late.", {
        reason: "The ferry is fast (18 kn): every minute of delay brings her much closer, and a late reduction leaves her too little room to cross.",
        rule: "Rule 16: the give-way vessel takes early and substantial action.",
      });
      await b.idle(b.rand(120, 240));
    }
    await b.order(null, speed, "giving way to the ferry");
    await b.until(() => (truthCpa(b.w, 1)?.tcpaMinutes ?? 0) <= 0 && b.now() >= 900, 1200, 10);
    b.think("The ferry is past and clear: back to 12 knots, following the slow ship's progress.");
    b.explain({
      title: "Resume 12 kn",
      reason: "The ferry is past her closest approach and opening. Back to the passage speed, keeping an eye on the slow ship ahead in our lane.",
      working: [dataLine(b.rc(), 1), dataLine(b.rc(), 2)],
    });
    await b.order(null, 12, "resuming speed");
    await b.until(() => b.now() >= 1800 && b.clearOfAll(0.5), 1200, 10);
    await b.finish();
  },
  "radar-29": async (b) => {
    await b.begin();
    await b.run();
    await b.answer("recip");
    b.think("Keeping a look-out.");
    await b.until(() => !!b.target(9), MOB_AT_SEC + 60, 1);
    b.log("read", "LOOK-OUT: MAN OVERBOARD, STARBOARD SIDE!");
    const react = b.lv.level >= 4 ? b.rand(1, 4) : b.rand(b.lv.hesitate[0], b.lv.hesitate[1] * 1.6);
    await b.idle(react);
    if (react > 30) {
      b.mistake(`Pressed MOB ${Math.round(react)} s after the report.`, {
        reason: `At 14 kn the ship runs about 7 m every second: ${Math.round(react)} s puts the mark about ${Math.round(react * 7.2)} m from where the person went in, and a person in the water gives no radar echo.`,
        rule: "Mark the position the moment the report is heard.",
      });
    }
    b.explain({
      title: "MOB key at once",
      reason: "A person in the water gives no radar echo and is soon lost from sight. The MOB key marks the ship's position at that moment on the radar: it is the datum for coming back and for any search.",
      look: "SHIP CONTROL, or the own ship keys in the menu: MOB.",
    });
    await b.act({ k: "mob" }, "MOB key: the position is marked");
    const course0 = b.w.own.ordered.course;
    const wh = williamsonHeadings(course0, "starboard");
    b.explain({
      title: "Williamson turn: hard a-starboard",
      reason: `The person fell from the starboard side: hard a-starboard swings the stern and propeller away from him. The Williamson turn then brings the ship back along her own track: at ${pad3(wh.first)}° (60° off) hard a-port, then steady on the reciprocal, ${pad3(wh.reciprocal)}°.`,
      rule: "The Williamson turn is slower than some, but returns the ship to her track: good at night or in poor visibility, when the person cannot be seen.",
    });
    await b.act({ k: "helm", deg: 35 }, "Hard a-starboard (Williamson turn)");
    await b.answerAll(["rudder", "shift"]);
    await b.until(() => Math.abs(angleDiffDeg(measuredHeading(b.w), course0)) >= 60, 300, 1);
    await b.act({ k: "helm", deg: -35 }, `Heading ${pad3(wh.first)}°: hard a-port`);
    await b.until(() => Math.abs(angleDiffDeg(measuredHeading(b.w), wh.reciprocal)) <= 25, 600, 1);
    await b.act({ k: "autopilot", course: wh.reciprocal }, `Steady on ${pad3(wh.reciprocal)}°, back along the track`);
    await b.order(null, 8, "reducing speed");
    b.explain({
      title: "Lay an expanding square from the MOB mark",
      reason: "If the person is not seen on the way back, the search starts at the datum (the MOB mark) and spreads out from it. An expanding square covers the area round a datum that is known well, as here.",
      look: "MENU, PI / MAP: search pattern, datum MOB mark, expanding square, spacing 0.5 NM.",
    });
    if (b.maybe("lay a search pattern from the MOB mark", "Without a pattern ready, a search after a failed return starts late and covers the area unevenly.")) await b.act({ k: "search", size: 0.5, course: wh.reciprocal }, "Expanding square from the MOB mark, spacing 0.5 NM");
    await b.answer("legs");
    b.steer(15, async () => {
      const m = b.v.mob;
      if (!m) return;
      const rel = sub(m.pos, b.w.own.pos);
      const d = length(rel);
      const sp = d > 1 ? 8 : d > 0.4 ? 4 : d > 0.07 ? 2 : 0;
      await b.order(d > 0.05 ? bearingOf(rel) : null, sp, d > 1 ? "" : "closing the mark slowly");
    });
    await b.until(() => (b.s.obs.returnRange[9] ?? Infinity) <= 0.05 || (b.v.mob !== null && length(sub(b.v.mob.pos, b.w.own.pos)) <= 0.05), 2700, 5);
    b.steer(null);
    b.think("Back at the position. A person in the water gives no echo: the look-out searches.");
    await b.finish();
  },
  "radar-30": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([4]);
    await b.answerAll(["factors", "r19", "rain"]);
    await b.until(() => b.now() >= FOG_AT_SEC, FOG_AT_SEC + 10, 1);
    b.log("read", "The visibility has closed in.");
    b.explain({
      title: "Visibility closed: down to 5 kn",
      reason: "Fishing boats are reported in the rain ahead and the rain hides small echoes on X band. At 16 kn the ship would cover the distance at which a boat might first be seen in a few minutes, and could not stop in it. 5 kn gives time to see, to act and to stop. The exercise asks for 8 kn or less within 8 minutes (placeholders).",
      rule: "Rule 6: a safe speed, so that the ship can stop within a distance suited to the conditions; Rule 19(b): engines ready for immediate manoeuvre.",
    });
    if (b.chance(b.lv.lateAction)) {
      b.mistake("Kept the speed up for several minutes after the visibility closed.", {
        reason: "At full speed in fog with boats about that the radar may not show, the ship cannot stop or turn in the distance she can see.",
        rule: "Rule 6 and Rule 19(b): safe speed at once when the visibility closes.",
      });
      await b.idle(b.rand(300, 600));
    } else await b.hesitate();
    await b.order(null, 5, "safe speed in restricted visibility (rule 6)");
    await b.until(() => b.w.own.pos.n > 7.5 || (b.now() >= FOG_AT_SEC + 900 && b.clearOfAll(0.5) && b.allPast()), 4200, 10);
    await b.finish();
  },
  "arpa-31": async (b) => {
    await b.begin();
    await b.run();
    await b.acquire([1, 2, 3, 4, 5, 6]);
    await b.waitSteady([1, 2, 3, 4, 5, 6], 260);
    await b.answerAll(["which", "cpa", "tcpa", "brg", "rng"]);
    await b.finish();
  },
};
for (const ex of PLOTTING_EXERCISES) SCRIPTS[ex.id] = plotting;

/** Work one exercise with the robot. Ends with Finish pressed (or stopped). */
export async function runRobotStudent(ex: ArpaExercise, host: RobotHost, level: number, seed: number): Promise<RobotRun> {
  const lv = robotLevel(level);
  const b = new Brain(ex, host, lv, seed);
  const script = SCRIPTS[ex.id];
  const run: RobotRun = { exerciseId: ex.id, level: lv.level, seed, result: null, mistakes: b.mistakes, stopped: false };
  if (!script) throw new Error(`The robot student has no plan for exercise ${ex.id}.`);
  b.log("read", `Robot student, level ${lv.level} (${lv.name}): ${lv.about}`);
  try {
    await script(b);
    run.result = host.view().s.finished;
  } catch (e) {
    if (e instanceof RobotStopped) run.stopped = true;
    else throw e;
  }
  return run;
}

// ---------------------------------------------------------------- working the simulation directly (tests)

/**
 * The robot working the simulation directly, without a screen: each action does to the world, the ARPA and
 * the session what the matching control on the display does, then the clock runs a second.
 */
export class DirectHost implements RobotHost {
  readonly w: World;
  readonly a: ArpaSystem;
  readonly s: ArpaExSession;
  readonly logs: RobotLogEntry[] = [];
  private selected: number | null = null;
  private mob: { pos: Vec2; time: number } | null = null;
  private ebl: { bearing: number; range: number } | null = null;
  private ui = { pi: [] as { on: boolean; bearing: number; range: number }[], navLines: 0, pmOn: false, mobAt: null as number | null, routePoints: 0 };
  private rng: () => number;

  constructor(readonly ex: ArpaExercise, seed = 11) {
    this.rng = lcg(seed);
    const w = createWorld(ex.scenario, 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.rangeNm = ex.rangeNm;
    if (ex.ownRates) {
      w.own.turnRateDegPerSec = ex.ownRates.turnDegPerMin / 60;
      w.own.accelKnPerSec = ex.ownRates.speedKnPerMin / 60;
    } else setShipModel(w, "container");
    this.w = w;
    this.a = new ArpaSystem(w);
    this.s = new ArpaExSession(ex, w, this.a);
    this.a.step(w, this.rng);
  }

  view(): RobotView {
    return { w: this.w, a: this.a, s: this.s, selected: this.selected, mob: this.mob, measured: this.ebl };
  }
  private advance(sec: number): void {
    const n = Math.max(1, Math.round(sec));
    for (let i = 0; i < n; i++) {
      stepWorld(this.w, 1);
      if (!radarTransmitting(this.w)) this.a.settings.standby = true;
      this.a.step(this.w, this.rng);
      this.s.step(this.w, this.a, this.ui);
    }
  }
  async wait(sec: number): Promise<void> {
    this.advance(sec);
  }
  alerts(): ReturnType<RobotHost["alerts"]> {
    return this.a.alarms.filter((x) => !x.acked).map((x) => ({ key: x.key, text: x.text, raisedAt: x.raisedAt, priority: alertPriority(x.kind), acked: false })).filter((x) => x.priority !== "caution");
  }
  log(e: RobotLogEntry): void {
    this.logs.push(e);
  }
  stopRequested(): boolean {
    return false;
  }
  private trackOf(id: number): number | null {
    return this.a.tracks.find((t) => t.truthId === id && t.state === "tracking")?.id ?? null;
  }

  async act(x: RobotAction): Promise<void> {
    const w = this.w, a = this.a, s = a.settings;
    switch (x.k) {
      case "open":
      case "run":
        break;
      case "acquire": {
        const t = w.targets.find((q) => q.id === x.target);
        if (t) {
          const tr = a.acquire(w, rotateVec(sub(t.pos, w.own.pos), w.sensors.gyroErrorDeg));
          if (tr) this.selected = tr.id;
        }
        break;
      }
      case "select":
        this.selected = this.trackOf(x.target) ?? this.selected;
        break;
      case "measure": {
        const p = x.at ?? w.targets.find((q) => q.id === x.target)?.pos;
        if (p) {
          const rel = sub(p, w.own.pos);
          this.ebl = { bearing: Math.round(normalizeDeg(bearingOf(rel)) * 10) / 10, range: Math.round(length(rel) * 100) / 100 };
        }
        break;
      }
      case "vectors":
        s.vectorMode = x.mode;
        break;
      case "past":
        s.past = { mode: x.mode, points: 5, intervalMin: 1 };
        break;
      case "limits":
        s.cpaLimitNm = x.cpa;
        s.tcpaLimitMin = x.tcpa;
        break;
      case "zone":
        (x.which === "guard" ? s.guardZones : s.exclusionZones)[0]!.on = x.on;
        break;
      case "autoAcquire":
        s.autoAcquire = x.on;
        break;
      case "trial":
        s.trial = x.on ? { on: true, course: x.course ?? s.trial.course, speed: x.speed ?? s.trial.speed, delayMinutes: x.delay ?? 6 } : { ...s.trial, on: false };
        break;
      case "course":
        w.own.ordered.course = normalizeDeg(x.deg);
        break;
      case "speed":
        w.own.ordered.speed = x.kn;
        break;
      case "helm":
        if (w.own.model) {
          w.own.model.steering = "hand";
          w.own.model.rudderOrder = x.deg;
        }
        break;
      case "autopilot":
        if (w.own.model) {
          w.own.model.steering = "auto";
          w.own.model.rudderOrder = 0;
        }
        w.own.ordered.course = normalizeDeg(x.course);
        break;
      case "ack": {
        const next = nextToAcknowledge(this.alerts());
        if (next) a.ack(w, next.key);
        break;
      }
      case "selfTest":
        a.runSelfTest(w);
        break;
      case "groundRef":
        if (this.selected !== null) a.designateGroundRef(w, this.selected);
        break;
      case "anchorWatch":
        if (this.selected !== null) a.setAnchorWatch(w, this.selected, 0.1);
        break;
      case "pi":
        this.ui.pi[x.index] = { on: x.on, bearing: x.bearing, range: x.range };
        break;
      case "navLine":
        if (x.points.length >= 2) this.ui.navLines++;
        break;
      case "radarKey": {
        const p = radarPower(w);
        if (p === "off") switchRadarOn(w);
        else if (p !== "warming") setRadarTransmit(w, p === "standby");
        if (radarTransmitting(w)) s.standby = false;
        break;
      }
      case "control": {
        const c = w.radar.controls;
        if (x.id === "brill") c.brilliance = x.value;
        else c[x.id] = x.value;
        break;
      }
      case "processing": {
        const c = w.radar.controls;
        if (x.id === "echoStretch") c.echoStretch = x.on;
        else if (x.id === "echoAvg") c.echoAverage = x.on;
        else c.interferenceRejection = x.on;
        break;
      }
      case "range":
        w.radar.controls.rangeNm = x.nm;
        break;
      case "pm":
        this.ui.pmOn = x.on;
        break;
      case "letGo":
        if (letGoAnchor(w)) w.own.ordered.speed = 0;
        break;
      case "mob":
        this.mob = { pos: { ...w.own.pos }, time: w.time };
        this.ui.mobAt = w.time;
        break;
      case "search":
        this.ui.routePoints = expandingSquare(this.mob?.pos ?? w.own.pos, x.course, x.size, 10).length;
        break;
      case "answer":
        this.s.answer(w, a, x.task, x.value);
        break;
      case "finish":
        this.s.finish(w, a);
        return;
      case "debrief":
        return;
    }
    this.advance(1);
  }
}

/** Work one exercise directly (no screen) and return what happened. */
export async function robotDirect(ex: ArpaExercise, level: number, seed: number): Promise<RobotRun & { log: RobotLogEntry[] }> {
  const host = new DirectHost(ex, seed);
  const r = await runRobotStudent(ex, host, level, seed);
  return { ...r, log: host.logs };
}

