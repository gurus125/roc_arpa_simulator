import { describe, expect, it } from "vitest";
import { TIDAL_PERIOD_HOURS, tidalStreamRate } from "../src/core/current";
import { HEAVY_TRAFFIC, OPEN_SEA, createWorld, currentVelocity, stepWorld } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import { ArpaExSession, arpaExerciseById, scenarioToJson, validateScenario } from "../src/train/index";
import { advance, createApp, rewind } from "../src/ui/app";

/** Items taken from STCW Code section A-I/12 (radar simulation, paragraph 4) and IMO Model Course 6.10. */
describe("tidal stream (STCW A-I/12 4.2: model tidal streams and current)", () => {
  it("rate through the cycle: slack, maximum flood a quarter cycle later, slack, maximum ebb", () => {
    expect(tidalStreamRate(2, 0)).toBeCloseTo(0, 12);
    expect(tidalStreamRate(2, TIDAL_PERIOD_HOURS / 4)).toBeCloseTo(2, 12); // 3.105 h after slack
    expect(tidalStreamRate(2, TIDAL_PERIOD_HOURS / 2)).toBeCloseTo(0, 12);
    expect(tidalStreamRate(2, (3 * TIDAL_PERIOD_HOURS) / 4)).toBeCloseTo(-2, 12);
    // One twelfth of a cycle after slack: sin 30 degrees = half the maximum rate.
    expect(tidalStreamRate(2, TIDAL_PERIOD_HOURS / 12)).toBeCloseTo(1, 12);
  });

  it("the stream is added to the steady current and changes as the exercise runs", () => {
    const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, coasts: [], targets: [], env: { seaState: 0, current: { set: 0, drift: 1 }, tidal: { floodSet: 90, maxRateKn: 2, hoursAfterSlackAtStart: TIDAL_PERIOD_HOURS / 12 } } });
    // Start: steady 1 kn north plus 1 kn east (half of 2 kn).
    expect(currentVelocity(w).n).toBeCloseTo(1, 9);
    expect(currentVelocity(w).e).toBeCloseTo(1, 9);
    // A stopped ship drifts with it: after 6 minutes about 0.1 NM north and a little over 0.1 NM east.
    for (let i = 0; i < 360; i++) stepWorld(w, 1);
    expect(w.own.pos.n).toBeCloseTo(0.1, 6);
    expect(w.own.pos.e).toBeGreaterThan(0.1);
    expect(w.own.pos.e).toBeLessThan(0.11);
    // One sixth of a cycle later the stream is at its maximum.
    w.time = (TIDAL_PERIOD_HOURS / 6) * 3600;
    expect(currentVelocity(w).e).toBeCloseTo(2, 9);
  });
});

describe("at least 20 target ships (STCW A-I/12 4.3)", () => {
  it("the heavy traffic scenario has 22 ships with distinct ids and is a valid scenario file", () => {
    expect(HEAVY_TRAFFIC.targets.length).toBe(22);
    expect(new Set(HEAVY_TRAFFIC.targets.map((t) => t.id)).size).toBe(22);
    expect(validateScenario(JSON.parse(scenarioToJson(HEAVY_TRAFFIC)))).toEqual([]);
    const w = createWorld(HEAVY_TRAFFIC);
    for (let i = 0; i < 600; i++) stepWorld(w, 1);
    expect(w.targets.every((t) => Number.isFinite(t.pos.e) && Number.isFinite(t.pos.n))).toBe(true);
  });
});

describe("assessment criteria are available to the candidate (STCW A-I/12 8.1, 8.3)", () => {
  it("every task of every exercise has a stated criterion and points", () => {
    const def = arpaExerciseById("arpa-6")!;
    const w = createWorld(def.scenario);
    const s = new ArpaExSession(def, w, new ArpaSystem(w));
    const c = s.criteria();
    expect(c.length).toBe(def.tasks.length);
    expect(c.every((x) => x.criterion.length > 5 && x.points > 0)).toBe(true);
    expect(c.find((x) => x.label.includes("Smallest alteration"))!.criterion).toContain("±10");
  });
});

describe("taking the exercise back in time (Model Course 6.10, abort point)", () => {
  it("ships return to where they were, the ARPA starts empty, and nothing is restored in the first minute", () => {
    const app = createApp(OPEN_SEA, 62);
    const rng = () => 0.5;
    for (let i = 0; i < 300 * 10; i++) advance(app, 0.1, rng); // 5 minutes at 1x
    expect(app.world.time).toBeCloseTo(300, 3);
    const shipNow = { ...app.world.targets[0]!.pos };
    app.arpa.acquire(app.world, { e: 1, n: 1 });
    const t = rewind(app, 120)!;
    // States are kept every minute: the one in force two minutes ago is between 2 and 3 minutes old.
    expect(t).toBeGreaterThan(119);
    expect(t).toBeLessThanOrEqual(180);
    expect(app.world.time).toBeCloseTo(t, 6);
    expect(app.arpa.tracks.length).toBe(0);
    // Cargo ship A steers 270 at 10 kn: it is back east by 10 kn x the time taken back.
    expect(app.world.targets[0]!.pos.e - shipNow.e).toBeCloseTo((10 * (300 - t)) / 3600, 3);
    const fresh = createApp(OPEN_SEA, 62);
    expect(rewind(fresh, 60)).toBeNull();
  });

  it("scripted events later than the restored time fire again", () => {
    const def = arpaExerciseById("arpa-8")!; // gyro error scripted at 300 s
    const w = createWorld(def.scenario);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession(def, w, a);
    w.time = 301;
    s.step(w, a);
    expect(s.scriptLog.length).toBe(1);
    s.rewindTo(240);
    expect(s.scriptLog.length).toBe(0);
    w.sensors.target = { gyroErrorDeg: 0, logErrorKn: 0 };
    w.time = 302;
    s.step(w, a);
    expect(w.sensors.target.gyroErrorDeg).toBe(4);
  });
});
