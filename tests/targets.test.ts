import { describe, expect, it } from "vitest";
import { SCENARIOS, TARGET_TYPES, createWorld, orderTarget, rcsForDetectionRange, stepWorld, targetFromType, targetTypeById } from "../src/engine/index";

const base = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, coasts: [] };
const tgt = (typeId: string | null, course: number, speed: number) => ({
  id: 1, name: "T", pos: { e: 0, n: 5 }, course, speed, events: [],
  ...(typeId ? targetFromType(targetTypeById(typeId)!) : { kind: "ship" as const, rcs: 1, height: 20 }),
});
const run = (w: ReturnType<typeof createWorld>, s: number): void => {
  for (let i = 0; i < s * 2; i++) stepWorld(w, 0.5);
};

describe("target ship catalogue", () => {
  it("has more than 20 vessel types, with unique ids and sensible figures", () => {
    const vessels = TARGET_TYPES.filter((t) => !t.fixed);
    expect(vessels.length).toBeGreaterThanOrEqual(21);
    expect(new Set(TARGET_TYPES.map((t) => t.id)).size).toBe(TARGET_TYPES.length);
    for (const t of vessels) {
      expect(t.lengthM).toBeGreaterThan(5);
      expect(t.speedKn).toBeGreaterThan(0);
      expect(t.turnDegPerSec).toBeGreaterThan(0);
    }
  });
  it("echo strength follows the type's detection range", () => {
    expect(targetFromType(targetTypeById("vlcc")!).rcs).toBeCloseTo(rcsForDetectionRange(20), 9);
    expect(targetFromType(targetTypeById("fishing-boat")!).rcs).toBeLessThan(targetFromType(targetTypeById("coaster")!).rcs);
  });
  it("a catalogue ship comes round gradually; a plain target alters at once", () => {
    const w = createWorld({ ...base, env: {}, targets: [tgt("vlcc", 0, 14)] });
    orderTarget(w.targets[0]!, { course: 90 });
    run(w, 10);
    // VLCC: 0.4 deg/s, so 4 degrees after 10 s.
    expect(w.targets[0]!.course).toBeCloseTo(4, 6);
    run(w, 300);
    expect(w.targets[0]!.course).toBeCloseTo(90, 6);
    const p = createWorld({ ...base, env: {}, targets: [tgt(null, 0, 14)] });
    orderTarget(p.targets[0]!, { course: 90 });
    expect(p.targets[0]!.course).toBe(90);
  });
  it("a catalogue ship is set by the current: steering 000 at 10 kn in a 2 kn easterly set makes good 011.3 at 10.2 kn", () => {
    const w = createWorld({ ...base, env: { current: { set: 90, drift: 2 } }, targets: [tgt("coaster", 0, 10)] });
    run(w, 3600);
    const t = w.targets[0]!;
    expect(t.course).toBeCloseTo((Math.atan2(2, 10) * 180) / Math.PI, 6); // 11.31
    expect(t.speed).toBeCloseTo(Math.hypot(2, 10), 6); // 10.198
    expect(t.pos.e).toBeCloseTo(2, 6);
    expect(t.pos.n).toBeCloseTo(15, 6);
    expect(t.motion!.heading).toBe(0);
  });
  it("a plain target is not set by the current (course and speed are over the ground, as before)", () => {
    const w = createWorld({ ...base, env: { current: { set: 90, drift: 2 } }, targets: [tgt(null, 0, 10)] });
    run(w, 3600);
    expect(w.targets[0]!.pos.e).toBeCloseTo(0, 9);
    expect(w.targets[0]!.pos.n).toBeCloseTo(15, 9);
  });
  it("a beam wind blows a catalogue ship to leeward", () => {
    // Car carrier steering north at 10 kn, wind 30 kn from the west (port beam): leeway 0.05 x 30 = 1.5 kn to the east.
    const w = createWorld({ ...base, env: { wind: { from: 270, speedKn: 30 } }, targets: [tgt("car-carrier", 0, 10)] });
    run(w, 3600);
    expect(w.targets[0]!.pos.e).toBeCloseTo(1.5, 1);
  });
  it("fixed objects of the catalogue do not move", () => {
    const w = createWorld({ ...base, env: { current: { set: 90, drift: 2 } }, targets: [tgt("buoy", 0, 0)] });
    run(w, 600);
    expect(w.targets[0]!.pos).toEqual({ e: 0, n: 5 });
    expect(w.targets[0]!.motion).toBeUndefined();
  });
  it("the ship-types scenario carries one vessel of every type", () => {
    const sc = SCENARIOS.find((s) => s.id === "ship-types")!;
    expect(sc.targets.length).toBe(TARGET_TYPES.filter((t) => !t.fixed).length);
    expect(new Set(sc.targets.map((t) => t.typeId)).size).toBe(sc.targets.length);
  });
});

import { scenarioFromJson, scenarioToJson, validateScenario } from "../src/train/scenario-io";
describe("catalogue types in saved scenarios", () => {
  it("the ship-types scenario is valid and keeps its types through save and load", () => {
    const sc = SCENARIOS.find((s) => s.id === "ship-types")!;
    expect(validateScenario(JSON.parse(scenarioToJson(sc)))).toEqual([]);
    const back = scenarioFromJson(scenarioToJson(sc));
    expect("scenario" in back ? back.scenario.targets[0]?.typeId : null).toBe(sc.targets[0]!.typeId);
  });
});
