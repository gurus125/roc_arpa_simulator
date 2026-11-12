import { describe, expect, it } from "vitest";
import { requiredCpaScore } from "../src/core/assess";
import { ArpaSystem } from "../src/arpa/index";
import { createWorld, stepWorld } from "../src/engine/index";
import { ArpaExSession, ArpaExercise, PLOTTING_EXERCISES, PLOT_RULES, untouchedCpa } from "../src/train/index";
import { normalizeDeg } from "../src/core/vec";

describe("result as a percentage of the required CPA (rule of the Learnmarine trainer, examples from its exercise text)", () => {
  it("closer than required: the fraction achieved", () => {
    expect(requiredCpaScore(1, 0.87)).toBe(87);
    expect(requiredCpaScore(1, 1)).toBe(100);
    expect(requiredCpaScore(1, 0)).toBe(0);
    expect(requiredCpaScore(1, 0.768)).toBe(76); // rounded down
  });
  it("wider than required: half the penalty", () => {
    expect(requiredCpaScore(1, 1.3)).toBe(85);
    expect(requiredCpaScore(1, 1.4)).toBe(80);
    expect(requiredCpaScore(1, 5)).toBe(0);
    expect(requiredCpaScore(2, 2.6)).toBe(85);
  });
});

/** Run one plotting exercise with a manoeuvre at 12 minutes: a turn (degrees, + starboard) and a speed factor. */
function attempt(ex: ArpaExercise, turn: number, speedFactor: number, atMin = PLOT_RULES.manoeuvreAtMin) {
  const w = createWorld(ex.scenario, 62);
  w.own.turnRateDegPerSec = ex.ownRates!.turnDegPerMin / 60;
  w.own.accelKnPerSec = ex.ownRates!.speedKnPerMin / 60;
  const a = new ArpaSystem(w);
  const s = new ArpaExSession(ex, w, a);
  let rngState = 5;
  const rng = (): number => {
    rngState = (rngState * 1664525 + 1013904223) % 4294967296;
    return rngState / 4294967296;
  };
  let acted = false;
  while (w.time < 75 * 60) {
    if (!acted && w.time >= atMin * 60) {
      acted = true;
      if (turn !== 0) w.own.ordered.course = normalizeDeg(ex.scenario.own.heading + turn);
      if (speedFactor !== 1) w.own.ordered.speed = ex.scenario.own.speed * speedFactor;
    }
    stepWorld(w, 1);
    a.step(w, rng);
    s.step(w, a);
  }
  const r = s.finish(w, a);
  const item = (id: string) => r.items.find((i) => i.id === id)!;
  return { result: item("result"), time: item("time"), port: item("port"), manual: item("manual") };
}

describe("manual plotting exercises", () => {
  it("ten exercises with 1 to 4 targets; own ship turns at 30 deg/min and changes speed at 3 kn/min", () => {
    expect(PLOTTING_EXERCISES).toHaveLength(10);
    expect(PLOTTING_EXERCISES.map((e) => e.scenario.targets.length)).toEqual([1, 2, 2, 2, 3, 3, 3, 1, 2, 4]);
    for (const e of PLOTTING_EXERCISES) expect(e.ownRates).toEqual({ turnDegPerMin: 30, speedKnPerMin: 3 });
  });
  for (const ex of PLOTTING_EXERCISES) {
    it(`${ex.title}: doing nothing fails; some manoeuvre at 12 min without a turn to port reaches 80%`, () => {
      expect(untouchedCpa(ex)).toBeLessThan(0.5);
      const none = attempt(ex, 0, 1);
      expect(none.result.ok).toBe(false);
      expect(none.time.ok).toBe(false);
      let best: { turn: number; f: number; detail: string } | null = null;
      search: for (const f of [1, 0.5, 0.25]) {
        for (let turn = 0; turn <= 120; turn += 5) {
          if (turn === 0 && f === 1) continue;
          const r = attempt(ex, turn, f);
          if (r.result.ok) {
            expect(r.time.ok).toBe(true);
            expect(r.port.ok).toBe(true);
            expect(r.manual.ok).toBe(true);
            best = { turn, f, detail: r.result.student };
            break search;
          }
        }
      }
      expect(best, "no passing manoeuvre found").not.toBeNull();
    });
  }
  it("a turn to port is marked; a manoeuvre before 12 minutes is marked", () => {
    const ex = PLOTTING_EXERCISES[0]!;
    expect(attempt(ex, -60, 1).port.ok).toBe(false);
    expect(attempt(ex, 60, 1, 6).time.ok).toBe(false);
  });
});
