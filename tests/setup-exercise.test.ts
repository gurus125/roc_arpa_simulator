import { describe, expect, it } from "vitest";
import {
  OPEN_SEA, RADAR_WARM_UP_LIMIT_SEC, RADAR_WARM_UP_SEC, createWorld, noiseSpeckle, radarPower, radarTransmitting, setRadarTransmit, stepWorld, switchRadarOff,
  switchRadarOn, warmUpLeftSec,
} from "../src/engine/index";
import { PLACEHOLDER_SCORING, RADAR_EXERCISES, SETUP_LIMITS, selfTestExercise } from "../src/train/index";

describe("Radar power: switching on from cold, warm-up, standby and transmit (IEC 62388 6.11.1)", () => {
  it("a scenario starts switched on and transmitting", () => {
    const w = createWorld(OPEN_SEA, 62);
    expect(radarPower(w)).toBe("transmit");
    expect(radarTransmitting(w)).toBe(true);
  });
  it("from cold the radar warms up, then waits in standby; from standby it transmits at once", () => {
    const w = createWorld(OPEN_SEA, 62);
    switchRadarOff(w);
    expect(setRadarTransmit(w, true)).toBe(false); // off: cannot transmit
    switchRadarOn(w);
    expect(radarPower(w)).toBe("warming");
    expect(warmUpLeftSec(w)).toBe(RADAR_WARM_UP_SEC);
    expect(RADAR_WARM_UP_SEC).toBeLessThanOrEqual(RADAR_WARM_UP_LIMIT_SEC); // the standard: within 4 minutes
    expect(RADAR_WARM_UP_LIMIT_SEC).toBe(240);
    for (let t = 0; t < RADAR_WARM_UP_SEC - 1; t++) stepWorld(w, 1);
    expect(radarPower(w)).toBe("warming");
    expect(setRadarTransmit(w, true)).toBe(false); // still warming up
    stepWorld(w, 1);
    stepWorld(w, 1);
    expect(radarPower(w)).toBe("standby");
    expect(setRadarTransmit(w, true)).toBe(true);
    expect(radarTransmitting(w)).toBe(true); // at once: inside the 5 s the standard allows
    expect(setRadarTransmit(w, false)).toBe(true);
    expect(radarPower(w)).toBe("standby");
  });
});

describe("The setting-up exercise (Radar and ARPA Manual, 3rd edition, 6.2)", () => {
  it("noise speckle: none at a gain of 50 with the best tuning, light at 56, heavy at full gain", () => {
    // Gain factor 0.05 + 1.9 g / 100; tuning at the best gives 1; speckle = sensitivity - 1, between 0 and 1.
    const c = { ...createWorld(OPEN_SEA, 62).radar.controls, tuning: 62 };
    expect(noiseSpeckle({ ...c, gain: 50 }, 62)).toBe(0);
    expect(noiseSpeckle({ ...c, gain: 56 }, 62)).toBeCloseTo(0.114, 3);
    expect(noiseSpeckle({ ...c, gain: 100 }, 62)).toBeCloseTo(0.95, 3);
    const n56 = noiseSpeckle({ ...c, gain: 56 }, 62);
    expect(n56).toBeGreaterThanOrEqual(SETUP_LIMITS.speckleMin);
    expect(n56).toBeLessThanOrEqual(SETUP_LIMITS.speckleMax);
  });
  it("the exercise starts with the radar off and badly set", () => {
    const ex = RADAR_EXERCISES.find((x) => x.id === "radar-22")!;
    const w = createWorld(ex.scenario, 62);
    ex.setup!(null as never, w);
    expect(radarPower(w)).toBe("off");
    expect(w.radar.controls.brilliance).toBeLessThan(SETUP_LIMITS.minBrilliance);
    expect(Math.abs(w.radar.controls.tuning - 62)).toBeGreaterThan(SETUP_LIMITS.tuningTol);
    expect(w.radar.controls.stc).toBeGreaterThan(SETUP_LIMITS.clutterZero);
    expect(ex.startsSwitchedOff).toBe(true);
  });
  it("is passed by the careful robot and not by the wrong or idle ones", () => {
    const ex = RADAR_EXERCISES.find((x) => x.id === "radar-22")!;
    const row = selfTestExercise(ex);
    expect(row.problems).toEqual([]);
    expect(row.ok).toBe(true);
    expect(row.careful).toBe("100%");
  });
  it("judges by the instructor's limits when they are set, else by the placeholders", () => {
    const ex = RADAR_EXERCISES.find((x) => x.id === "radar-22")!;
    const brill = ex.tasks.find((t) => t.id === "brill")!;
    const w = createWorld(OPEN_SEA, 62);
    w.radar.controls.brilliance = 50;
    const ctx = (cfg: typeof PLACEHOLDER_SCORING) => ({ w, a: null as never, obs: null as never, cfg });
    if (brill.kind !== "action") throw new Error("brill is an action");
    expect(brill.done(ctx(PLACEHOLDER_SCORING))).toBe(true); // 50 against the placeholder 40
    expect(brill.done(ctx({ ...PLACEHOLDER_SCORING, setup: { ...SETUP_LIMITS, minBrilliance: 60 } }))).toBe(false);
  });
});
