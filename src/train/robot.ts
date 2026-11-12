import { ArpaSystem } from "../arpa/index";
import { courseToSteer } from "../core/current";
import { bearingOf, length, normalizeDeg, rotateVec, sub } from "../core/vec";
import { World, createWorld, setShipModel, stepWorld } from "../engine/index";
import { ARPA_EXERCISES } from "./arpa-exercises";
import { PLOTTING_EXERCISES } from "./plotting-exercises";
import { RADAR_EXERCISES } from "./radar-exercises";
import { ArpaExSession, ArpaExercise, ExerciseResult } from "./session";

/**
 * Self-test of the exercises: a robot works every exercise three times and the results are
 * compared with what should happen.
 *
 *  1. CAREFUL robot: does what the briefing asks (acquires, sets limits, uses the trial, takes
 *     avoiding action ...) and answers every question from the exercise's own answer key.
 *     Expected: every item marked correct, 100%.
 *  2. WRONG robot: does the same but gives answers that are clearly wrong.
 *     Expected: every question marked wrong.
 *  3. IDLE robot: does nothing at all.
 *     Expected: no question or action credited; where the exercise judges an outcome, it fails.
 *
 * What this proves: every exercise starts, runs to the end without an error, can be completed,
 * and the marking tells right from wrong. What it does NOT prove: that the answer key itself is
 * good seamanship (the robot's answers come from that key). The unit tests check the key against
 * values read off the ARPA and worked by hand; a qualified instructor must still judge the content.
 */
export interface SelfTestRow {
  id: string;
  title: string;
  ok: boolean;
  /** What each robot got, and anything that was not as expected. */
  careful: string;
  wrong: string;
  idle: string;
  problems: string[];
  simMinutes: number;
}

interface Kit {
  w: World;
  a: ArpaSystem;
  s: ArpaExSession;
  ex: ArpaExercise;
  acquireAll: () => void;
  acquire: (targetId: number) => void;
  trackOf: (targetId: number) => number | null;
  /** Parallel index lines and navigation lines "set on the screen". */
  ui: { pi: { on: boolean; bearing: number; range: number }[]; navLines: number };
}
interface Plan {
  steps: { at: number; run: (k: Kit) => void }[];
  /** Runs every 20 s. */
  every?: (k: Kit) => void;
  finishAt: number;
  /** Finish early when this becomes true. */
  done?: (k: Kit) => boolean;
}

const trial = (course: number, speed: number) => (k: Kit): void => {
  k.a.settings.trial = { on: true, course, speed, delayMinutes: 1 };
};
const trialOff = (k: Kit): void => {
  k.a.settings.trial.on = false;
};
const all = { at: 1, run: (k: Kit): void => k.acquireAll() };

/** What a careful student does in each exercise, taken from its briefing. */
const PLANS: Record<string, Plan> = {
  "arpa-1": { steps: [all], finishAt: 400 },
  "arpa-2": {
    steps: [all, { at: 200, run: (k) => void (k.a.settings.vectorMode = "true") }, { at: 260, run: (k) => void (k.a.settings.vectorMode = "relative") }],
    finishAt: 420,
  },
  "arpa-3": { steps: [all, { at: 300, run: (k) => void (k.a.settings.past = { mode: "true", points: 5, intervalMin: 1 }) }], finishAt: 900 },
  "arpa-4": {
    steps: [
      { at: 0, run: (k) => {
        k.a.settings.guardZones[0]!.on = true;
        k.a.settings.exclusionZones[0]!.on = true;
        k.a.settings.autoAcquire = true;
      } },
      { at: 1, run: (k) => k.acquire(4) },
    ],
    finishAt: 1000,
  },
  "arpa-5": {
    steps: [{ at: 0, run: (k) => {
      k.a.settings.cpaLimitNm = 2;
      k.a.settings.tcpaLimitMin = 20;
    } }, all],
    finishAt: 905,
  },
  "arpa-6": { steps: [all, { at: 240, run: trial(60, 14) }, { at: 250, run: trialOff }, { at: 260, run: (k) => void (k.w.own.ordered.course = 60) }], finishAt: 2400 },
  "arpa-7": {
    steps: [all, { at: 300, run: (k) => {
      const id = k.trackOf(1);
      if (id !== null) k.a.designateGroundRef(k.w, id);
    } }],
    finishAt: 340,
  },
  "arpa-8": { steps: [all, { at: 2, run: (k) => void k.a.runSelfTest(k.w) }], finishAt: 705 },
  "arpa-9": {
    steps: [all, { at: 300, run: (k) => trial(normalizeDeg(k.ex.scenario.own.heading + 50), k.ex.scenario.own.speed)(k) }, { at: 350, run: trialOff },
      { at: 360, run: (k) => void (k.w.own.ordered.course = normalizeDeg(k.ex.scenario.own.heading + 50)) }],
    finishAt: 2400,
  },
  "radar-10": {
    steps: [{ at: 0, run: (k) => {
      k.ui.pi = [{ on: true, bearing: 0, range: 1.5 }];
      k.ui.navLines = 1;
    } }],
    // Steer the course that makes good 000, and correct for the distance off the track as the index line shows it.
    every: (k) => {
      const cts = courseToSteer(0, Math.max(1, k.w.own.speedThroughWater), k.w.env.current)?.heading ?? 0;
      k.w.own.ordered.course = normalizeDeg(cts - Math.max(-15, Math.min(15, k.w.own.pos.e * 60)));
    },
    finishAt: 4200,
    done: (k) => k.s.obs.trackDone,
  },
  "radar-11": {
    // Home on the survival craft (the first dot), slowing down in good time.
    steps: [],
    every: (k) => {
      const t = k.w.targets.find((x) => x.id === 1);
      if (!t) return;
      const rel = sub(t.pos, k.w.own.pos);
      k.w.own.ordered.course = bearingOf(rel);
      if (length(rel) < 3) k.w.own.ordered.speed = 5;
    },
    finishAt: 6000,
    done: (k) => (k.s.obs.minRange[1] ?? Infinity) <= 0.3,
  },
};

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Mode = "careful" | "wrong" | "idle";

/** Run one exercise with one robot. `manoeuvre` is used by the plotting exercises: turn (deg, + starboard) and speed factor at 12 min. */
function runOne(ex: ArpaExercise, mode: Mode, manoeuvre?: { turn: number; speed: number }): { result: ExerciseResult; minutes: number } {
  const w = createWorld(ex.scenario, 62);
  w.radar.controls.tuning = 62;
  if (ex.ownRates) {
    w.own.turnRateDegPerSec = ex.ownRates.turnDegPerMin / 60;
    w.own.accelKnPerSec = ex.ownRates.speedKnPerMin / 60;
  } else setShipModel(w, "container");
  const a = new ArpaSystem(w);
  const s = new ArpaExSession(ex, w, a);
  const rng = lcg(11);
  const acquire = (id: number): void => {
    const t = w.targets.find((x) => x.id === id);
    if (t) a.acquire(w, rotateVec(sub(t.pos, w.own.pos), w.sensors.gyroErrorDeg));
  };
  const kit: Kit = {
    w, a, s, ex, acquire,
    acquireAll: () => w.targets.forEach((t) => acquire(t.id)),
    trackOf: (id) => a.tracks.find((t) => t.truthId === id && t.state === "tracking")?.id ?? null,
    ui: { pi: [], navLines: 0 },
  };
  const plotting = ex.group === "Plotting";
  const plan: Plan = PLANS[ex.id] ?? { steps: [], finishAt: plotting ? 75 * 60 : 600 };
  const active = mode !== "idle";
  const answered = new Set<string>();
  const answerNumbers = (): void => {
    for (const t of ex.tasks) {
      if (t.kind !== "number" || answered.has(t.id)) continue;
      const truth = t.truth(s.ctx(w, a));
      if (truth === null) continue;
      const off = mode === "wrong" ? (t.circular ? 90 : 5 * t.tol(s.cfg) + 3) : 0;
      if (s.answer(w, a, t.id, truth + off)) answered.add(t.id);
    }
  };
  let next = 0;
  let tick = 0;
  let acted = false;
  a.step(w, rng);
  while (w.time < plan.finishAt) {
    if (active) {
      while (next < plan.steps.length && plan.steps[next]!.at <= w.time) plan.steps[next++]!.run(kit);
      if (w.time >= tick) {
        tick = w.time + 20;
        plan.every?.(kit);
        // Acknowledge whatever alarm is showing, and answer what can be answered now.
        for (const al of a.alarms) if (!al.acked) a.ack(w, al.key);
        if (w.time >= 60) answerNumbers();
      }
      if (plotting && manoeuvre && !acted && w.time >= 12 * 60) {
        acted = true;
        answerNumbers();
        if (manoeuvre.turn !== 0) w.own.ordered.course = normalizeDeg(ex.scenario.own.heading + manoeuvre.turn);
        if (manoeuvre.speed !== 1) w.own.ordered.speed = ex.scenario.own.speed * manoeuvre.speed;
      }
      if (plan.done?.(kit)) break;
    }
    stepWorld(w, 1);
    a.step(w, rng);
    s.step(w, a, kit.ui);
  }
  if (active) {
    answerNumbers();
    for (const t of ex.tasks) {
      if (t.kind !== "choice") continue;
      const right = t.correct(s.ctx(w, a));
      s.answer(w, a, t.id, mode === "wrong" ? (right + 1) % t.choices.length : right);
    }
  }
  return { result: s.finish(w, a), minutes: w.time / 60 };
}

/** A manoeuvre at 12 minutes, without a turn to port, that passes a plotting exercise. */
function findManoeuvre(ex: ArpaExercise): { turn: number; speed: number } | null {
  for (const speed of [1, 0.5, 0.25]) {
    for (let turn = 0; turn <= 120; turn += 5) {
      if (turn === 0 && speed === 1) continue;
      const r = runOne(ex, "careful", { turn, speed }).result;
      if (r.items.filter((i) => i.kind === "outcome").every((i) => i.ok)) return { turn, speed };
    }
  }
  return null;
}

export const SELF_TEST_EXERCISES: ArpaExercise[] = [...ARPA_EXERCISES, ...RADAR_EXERCISES, ...PLOTTING_EXERCISES];

/** Work one exercise with the three robots and compare with what should happen. */
export function selfTestExercise(ex: ArpaExercise): SelfTestRow {
  const problems: string[] = [];
  const row: SelfTestRow = { id: ex.id, title: `${ex.number}. ${ex.title}`, ok: false, careful: "", wrong: "", idle: "", problems, simMinutes: 0 };
  try {
    let manoeuvre: { turn: number; speed: number } | undefined;
    if (ex.group === "Plotting") {
      const m = findManoeuvre(ex);
      if (!m) problems.push("No manoeuvre at 12 minutes (starboard turns up to 120°, speed down to a quarter) passes this exercise.");
      else manoeuvre = m;
    }
    const careful = runOne(ex, "careful", manoeuvre);
    row.simMinutes = careful.minutes;
    const bad = careful.result.items.filter((i) => !i.ok);
    row.careful = `${Math.round(careful.result.percent)}%${manoeuvre ? ` (${manoeuvre.turn > 0 ? `starboard ${manoeuvre.turn}°` : "no turn"}${manoeuvre.speed !== 1 ? `, speed x${manoeuvre.speed}` : ""})` : ""}`;
    for (const i of bad) problems.push(`Careful robot not credited: "${i.label}" (${i.student}).`);

    const wrong = runOne(ex, "wrong", manoeuvre).result;
    const questions = wrong.items.filter((i) => i.kind === "number" || i.kind === "choice");
    const slipped = questions.filter((i) => i.ok);
    row.wrong = `${questions.length - slipped.length} of ${questions.length} wrong answers rejected`;
    for (const i of slipped) problems.push(`Wrong answer accepted: "${i.label}" (${i.student}).`);

    const idle = runOne(ex, "idle").result;
    const credited = idle.items.filter((i) => i.ok && i.kind !== "outcome");
    const outcomes = idle.items.filter((i) => i.kind === "outcome");
    row.idle = `${Math.round(idle.percent)}%`;
    for (const i of credited) problems.push(`Idle robot credited: "${i.label}".`);
    if (outcomes.length > 0 && outcomes.every((i) => i.ok)) problems.push("Idle robot passed every outcome: doing nothing should not succeed.");
  } catch (e) {
    problems.push(`Error while running: ${e instanceof Error ? e.message : String(e)}`);
  }
  row.ok = problems.length === 0;
  return row;
}
