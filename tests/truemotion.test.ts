import { describe, expect, it } from "vitest";
import { createWorld, newDisplayState, recentreTrueMotion, stepSpeedInput, stepWorld, worldToDisplayNm } from "../src/engine/index";

/*
 * Hand-worked. Own ship steers 000 at 12 kn for 10 minutes: she really moves 2 NM north. A buoy
 * lies 5 NM ahead at the start, so 3 NM ahead at the end. A sea-stabilised true-motion display
 * moves own ship by its SPEED INPUT:
 * - right input (12 kn): own ship is drawn 2 NM up the screen and the buoy stays at 5 NM;
 * - input set by hand to 6 kn: own ship is drawn only 1 NM up, and the buoy, 3 NM ahead of her,
 *   is drawn at 4 NM: it has slid 1 NM down the screen though it is fixed;
 * - no speed input at all: own ship stays at the centre and the buoy is drawn at 3 NM.
 */
const scenario = {
  id: "tm", name: "tm", description: "", own: { heading: 0, speed: 12 }, coasts: [], env: {},
  targets: [{ id: 1, name: "Buoy", kind: "buoy" as const, pos: { e: 0, n: 5 }, course: 0, speed: 0, rcs: 0.015, height: 3, events: [] }],
};
const after10min = (inputKn: number, stab: "sea" | "ground") => {
  const w = createWorld(scenario);
  const ds = newDisplayState(w);
  ds.motion = "true";
  ds.stabilisation = stab;
  recentreTrueMotion(w, ds);
  for (let i = 0; i < 1200; i++) {
    stepWorld(w, 0.5);
    stepSpeedInput(w, ds, 0.5, inputKn);
  }
  return { own: worldToDisplayNm(w, ds, w.own.pos), buoy: worldToDisplayNm(w, ds, w.targets[0]!.pos) };
};

describe("true motion follows the speed input (sea stabilised)", () => {
  it("right speed input: own ship moves, the fixed buoy stays put", () => {
    const r = after10min(12, "sea");
    expect(r.own.y).toBeCloseTo(2, 3);
    expect(r.buoy.y).toBeCloseTo(5, 3);
    expect(r.buoy.x).toBeCloseTo(0, 6);
  });
  it("speed set too low by hand: own ship moves too little and the buoy slides down the screen", () => {
    const r = after10min(6, "sea");
    expect(r.own.y).toBeCloseTo(1, 3);
    expect(r.buoy.y).toBeCloseTo(4, 3);
  });
  it("no speed input: own ship stays at the centre and everything moves past her", () => {
    const r = after10min(0, "sea");
    expect(r.own.y).toBeCloseTo(0, 3);
    expect(r.buoy.y).toBeCloseTo(3, 3);
  });
  it("ground stabilised: the speed input makes no difference", () => {
    const r = after10min(6, "ground");
    expect(r.own.y).toBeCloseTo(2, 3);
    expect(r.buoy.y).toBeCloseTo(5, 3);
  });
});
