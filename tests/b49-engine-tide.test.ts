import { describe, expect, it } from "vitest";
import { diamondStream, streamAt, tideHeightM } from "../src/core/tide";
import { seasSpeedLoss, displacementFromLength, lossAfterSeaMargin } from "../src/core/waves";
import {
  AREA_TIDES, GOA_APPROACH, KUTCH_APPROACH, OPEN_SEA, Scenario, createWorld, currentVelocity, depthAt, setShipModel, stepWorld,
  targetTypeById, tideHeightNow, waterDepthAt,
} from "../src/engine/index";
import { validateScenario, SCENARIO_FORMAT } from "../src/train/scenario-io";

describe("tidal streams and tide in the world", () => {
  it("the real areas have three diamonds in the water and heights with springs above neaps", () => {
    for (const [id, a] of Object.entries(AREA_TIDES)) {
      expect(a.diamonds.length, id).toBe(3);
      for (const d of a.diamonds) expect(d.hours).toHaveLength(13);
      expect(a.heights.mhws).toBeGreaterThan(a.heights.mhwn);
      expect(a.heights.mlws).toBeLessThan(a.heights.mlwn);
    }
    // Slack at HW for the first diamond of each area (lag 0), strongest three hours before.
    const A = AREA_TIDES["goa"]!.diamonds[0]!;
    expect(A.hours[6]!.spring).toBe(0);
    expect(A.hours[3]!.spring).toBe(1);
    expect(A.hours[3]!.set).toBe(80);
    expect(A.hours[9]!.set).toBe(260);
  });

  it("no tide set: the water moves only with the steady current, as before", () => {
    const w = createWorld(GOA_APPROACH);
    const v = currentVelocity(w);
    expect(Math.hypot(v.e, v.n)).toBeCloseTo(0.5, 9);
    expect(tideHeightNow(w)).toBeNull();
    expect(waterDepthAt(w, { e: 5, n: 0 })).toBe(depthAt(w, { e: 5, n: 0 }));
  });

  it("with the tide set, the stream at a diamond is that diamond's, and elsewhere is weighted", () => {
    const sc: Scenario = { ...GOA_APPROACH, env: { ...GOA_APPROACH.env, current: { set: 0, drift: 0 }, tide: { hwAtStartH: -3, springs: 1 } } };
    const w = createWorld(sc);
    const ds = AREA_TIDES["goa"]!.diamonds;
    const at = currentVelocity(w, ds[0]!.pos);
    const exp = diamondStream(ds[0]!, -3, 1);
    expect(at.e).toBeCloseTo(exp.e, 9);
    expect(at.n).toBeCloseTo(exp.n, 9);
    const p = { e: 7, n: 1 };
    const mixed = currentVelocity(w, p);
    const e2 = streamAt(ds, p, -3, 1);
    expect(mixed.e).toBeCloseTo(e2.e, 9);
    // One hour on, the clock has moved one hour.
    stepWorld(w, 3600);
    const later = currentVelocity(w, ds[0]!.pos);
    const exp2 = diamondStream(ds[0]!, -2, 1);
    expect(later.e).toBeCloseTo(exp2.e, 9);
    // Streams off: heights only.
    const w2 = createWorld({ ...sc, env: { ...sc.env, tide: { hwAtStartH: -3, springs: 1, streams: false } } });
    expect(Math.hypot(currentVelocity(w2).e, currentVelocity(w2).n)).toBeLessThan(1e-9);
  });

  it("depth of water = charted depth + height of tide", () => {
    const sc: Scenario = { ...KUTCH_APPROACH, env: { ...KUTCH_APPROACH.env, tide: { hwAtStartH: 0, springs: 1 } } };
    const w = createWorld(sc);
    const p = { e: 0, n: 1 };
    const h = tideHeightM(AREA_TIDES["kutch"]!.heights, 0, 1);
    expect(h).toBeCloseTo(6.6, 9);
    expect(tideHeightNow(w)).toBeCloseTo(6.6, 9);
    expect(waterDepthAt(w, p)!).toBeCloseTo(depthAt(w, p)! + 6.6, 9);
  });

  it("a scenario's own diamonds and heights replace the area's, and are copied, not shared", () => {
    const own = { id: "X", pos: { e: 0, n: 0 }, hours: Array.from({ length: 13 }, () => ({ set: 180, spring: 2, neap: 1 })) };
    const sc: Scenario = { ...OPEN_SEA, env: { ...OPEN_SEA.env, current: { set: 0, drift: 0 }, tide: { hwAtStartH: 1, springs: 0, diamonds: [own], heights: { mhws: 3, mhwn: 2, mlwn: 1, mlws: 0 } } } };
    const w = createWorld(sc);
    expect(currentVelocity(w).n).toBeCloseTo(-1, 9);
    w.env.tide!.diamonds![0]!.hours[0]!.set = 0;
    expect(sc.env.tide!.diamonds![0]!.hours[0]!.set).toBe(180);
    expect(validateScenario({ ...sc, format: SCENARIO_FORMAT })).toEqual([]);
    expect(validateScenario({ ...sc, format: SCENARIO_FORMAT, env: { tide: { hwAtStartH: 1, springs: 3 } } }).join(" ")).toMatch(/springs/);
    expect(validateScenario({ ...sc, format: SCENARIO_FORMAT, env: { swell: { from: 200, heightM: 30 } } }).join(" ")).toMatch(/Swell/);
  });
});

describe("waves in the world", () => {
  const run = (sc: Scenario, seconds: number) => {
    const w = createWorld(sc);
    setShipModel(w, "container");
    w.own.ordered = { course: 0, speed: 20 };
    w.own.model!.motion = { u: 20, v: 0, r: 0, rudder: 0, engine: 20 };
    for (let t = 0; t < seconds; t++) stepWorld(w, 1);
    return w;
  };
  const base: Scenario = { ...OPEN_SEA, env: { ...OPEN_SEA.env, current: { set: 0, drift: 0 }, wind: { from: 0, speedKn: 0.5 } } };

  it("own ship (a model) slows in a head sea, by the speed loss of core/waves.ts", () => {
    const calm = run({ ...base, env: { ...base.env, seaState: 0 } }, 3000);
    const rough = run({ ...base, env: { ...base.env, seaState: 6 } }, 3000);
    // Calm: 20 kn less a little for the head wind of her own speed (the model's wind drag).
    expect(calm.own.speedThroughWater).toBeGreaterThan(19.7);
    const loss = lossAfterSeaMargin(seasSpeedLoss([{ fromDeg: 0, heightM: 5 }], 0, 52070.1048));
    expect(loss).toBeGreaterThan(0.1);
    expect(Math.abs(rough.own.speedThroughWater / calm.own.speedThroughWater - (1 - loss))).toBeLessThan(0.02);
  });

  it("a swell on the beam rolls her and pushes her away from it", () => {
    const w = run({ ...base, env: { ...base.env, seaState: 0, wind: undefined, swell: { from: 90, heightM: 4 } } }, 600);
    expect(w.own.model!.motion.v).toBeLessThan(-0.05);
    expect(w.own.pos.e).toBeLessThan(0);
    expect(w.own.seaway).toBeDefined();
  });

  it("a catalogue target slows too; a plain target keeps its speed", () => {
    const sc: Scenario = {
      ...base,
      env: { ...base.env, seaState: 6 },
      targets: [
        { id: 1, name: "Feeder", kind: "ship", typeId: "container-feeder", lengthM: 140, rcs: 1000, height: 20, pos: { e: 0, n: 5 }, course: 180, speed: 17, events: [] },
        { id: 2, name: "Plain", kind: "ship", rcs: 1000, height: 20, pos: { e: 3, n: 5 }, course: 180, speed: 17, events: [] },
      ],
    };
    const w = createWorld(sc);
    for (let t = 0; t < 1200; t++) stepWorld(w, 1);
    const L = targetTypeById("container-feeder")!.lengthM;
    const loss = lossAfterSeaMargin(seasSpeedLoss([{ fromDeg: 0, heightM: 5 }], 180, displacementFromLength(L)));
    expect(w.targets[0]!.motion!.stw).toBeCloseTo(17 * (1 - loss), 1);
    expect(w.targets[1]!.speed).toBe(17);
  });
});

import { RADAR_EXERCISES } from "../src/train/radar-exercises";
import { STREAM_A_33, TIDE_33, TRACK_33 } from "../src/train/nav-exercises";
import { selfTestExercise } from "../src/train/robot";
import { courseToSteer } from "../src/core/current";

describe("exercise 33: tidal streams from the diamonds", () => {
  const ex = RADAR_EXERCISES.find((e) => e.id === "radar-33")!;
  it("is set at HW-3, springs, off Mumbai; its key is worked by hand", () => {
    expect(ex.number).toBe(33);
    expect(ex.scenario.env.tide).toEqual({ hwAtStartH: -3, springs: 1 });
    // Diamond A (lag 0) at HW-3: -sin(pi x -3 / 6.21) = 0.9986, x 1.6 = 1.598, rounded 1.6 kn towards 060.
    expect(STREAM_A_33.course).toBeCloseTo(60, 6);
    expect(STREAM_A_33.speed).toBeCloseTo(1.6, 6);
    // Track 095.7 (10 E, 1 S); across 1.6 sin(60 - 95.71) = -0.934 kn; allowance asin(0.934/12) = 4.46 deg to starboard.
    expect(TRACK_33).toBeCloseTo(95.711, 2);
    const ctx = {} as never;
    const cts = ex.tasks.find((t) => t.id === "cts")!;
    expect(cts.kind === "number" && cts.truth(ctx)).toBeCloseTo(100.18, 1);
    expect(courseToSteer(TRACK_33, TIDE_33.stw, { set: 60, drift: 1.6 })!.heading).toBeCloseTo(100.18, 1);
    // Height at HW-3 springs: 6.21 h rise, HW-3 is 3.10 "hours" after LW: 6.30 twelfths -> 0.8 + 3.6 x 0.525 = 2.69 m.
    const h = ex.tasks.find((t) => t.id === "height")!;
    expect(h.kind === "number" && h.truth(ctx)).toBeCloseTo(2.69, 2);
  });
  it("the self-test: careful 100%, idle fails", () => {
    const row = selfTestExercise(ex);
    expect(row.problems, row.careful).toEqual([]);
    expect(row.ok).toBe(true);
  });
});
