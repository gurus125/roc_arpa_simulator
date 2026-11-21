import { ArpaSystem } from "../arpa/index";
import { Vec2, normalizeDeg } from "../core/vec";
import { World } from "../engine/index";
import { ARPA_EXERCISES } from "./arpa-exercises";
import { PLOTTING_EXERCISES } from "./plotting-exercises";
import { RADAR_EXERCISES } from "./radar-exercises";
import { ArpaExSession, ArpaExercise, ExerciseResult, NumberTask } from "./session";
import { RobotWhy } from "./robot-reasons";

/** The robot student's levels, what it does at the controls and its run (see robot-student.ts). */

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
  | { k: "whistle"; id: "doubt" | "starboard" | "port" | "astern" }
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

export function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const pad3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");
export const mm = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** A value as it would be read off the display and typed: degrees whole (tenths for small tolerances), others to 0.1 or 0.01. */
export function readAs(task: Pick<NumberTask, "unit" | "circular">, tol: number, v: number): number {
  if (task.circular || task.unit === "°") {
    const r = tol < 2 ? Math.round(v * 10) / 10 : Math.round(v);
    return task.circular ? Number((normalizeDeg(r) % 360).toFixed(1)) : r;
  }
  return tol < 0.3 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
}
export const show = (v: number): string => String(Math.round(v * 100) / 100);
/** A value with its unit: degrees and minutes of arc close up (50°, 42.2'), others after a space (0.8 NM). */
export const withUnit = (v: number, unit: string): string => `${show(v)}${unit === "°" || unit === "'" ? "" : " "}${unit}`;
