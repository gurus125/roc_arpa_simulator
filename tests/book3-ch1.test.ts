import { describe, expect, it } from "vitest";
import {
  BAND_DATA, Scenario, World, createWorld, newDisplayState, pulseFor, recentreTrueMotion, ringInterval, settleDisplayModes,
  stepSpeedInput, stepWorld, targetHeading, unambiguousRangeNm, worldToDisplayNm, DisplayState,
} from "../src/engine/index";
import { fromPolar, sub } from "../src/core/vec";
import { relativeToTrueBearing } from "../src/core/plot";
import { AisSystem } from "../src/ais/index";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 1: Basic radar principles.
 * Every expected value below is the book's own figure or is worked by hand from the book's figures
 * (shown in the comments); none is taken from the simulator. See docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

describe("1.2 range as a function of time, and the scan", () => {
  // R = 150 T (R in metres, T in microseconds): half of 300 m per microsecond, because the pulse goes out and back.
  it("the simulator's range resolution uses the book's 150 m per microsecond", () => {
    // Book example: an echo 0.27 microseconds after transmission is about 40 m away (40 / 150 = 0.267).
    for (const name of ["short", "medium", "long"] as const) {
      const p = pulseFor(12, name);
      expect(p.rangeDiscriminationNm * 1852).toBeCloseTo(p.microseconds * 150, 6);
    }
  });
  it("one pulse every 667 microseconds at 1500 Hz: echoes up to about 54 NM can return before the next pulse", () => {
    // Book: 1500 Hz is one pulse every 667 microseconds; R = 150 x 667 = 100 050 m = 54.0 NM.
    // (The simulator uses the exact speed of light; the book's 150 is rounded, 0.07% high.)
    expect(unambiguousRangeNm(1500)).toBeCloseTo((150 * 666.67) / 1852, 1);
    expect(pulseFor(12, "medium").prfHz).toBe(1500);
  });
  it("the 12 NM range scale is about 148 microseconds of echo time", () => {
    // Book example: 12 x 1852 / 150 = 148.16 microseconds. The unambiguous range at every PRF of the simulator is
    // longer than the scale on which that PRF is used, so no echo inside the picture is ambiguous in normal propagation.
    expect((12 * 1852) / 150).toBeCloseTo(148.16, 2);
    for (const r of [0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24, 48, 96]) expect(unambiguousRangeNm(pulseFor(r).prfHz)).toBeGreaterThan(Math.min(r, 48));
  });
  it("horizontal beamwidth no more than 2 degrees", () => {
    // Book: beamwidth of 2 degrees or less (as narrow as 0.75 degrees for large ships).
    expect(BAND_DATA.X.beamwidthDeg).toBeLessThanOrEqual(2);
    expect(BAND_DATA.S.beamwidthDeg).toBeLessThanOrEqual(2);
  });
  it("aerial turns at a rate inside the book's typical 24 to 45 rpm", () => {
    const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: {}, coasts: [], targets: [] });
    expect(w.radar.rpm).toBeGreaterThanOrEqual(24);
    expect(w.radar.rpm).toBeLessThanOrEqual(45);
    // Book: 1500 Hz and one turn in 2 s give 3000 pulses a turn, 0.12 degrees between pulses.
    expect(360 / (1500 * 2)).toBeCloseTo(0.12, 6);
  });
  it("range rings 2 NM apart on the 12 NM scale", () => {
    expect(ringInterval(12)).toBe(2);
  });
});

describe("1.2.4.2 the picture is the echoes' range and bearing turned into x and y", () => {
  it("north-up, relative motion: x = range x sin(bearing), y = range x cos(bearing)", () => {
    const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: {}, coasts: [], targets: [] });
    const ds = newDisplayState(w);
    for (const [brg, rng] of [[30, 4], [135, 2.5], [250, 7], [330, 1]] as const) {
      const s = worldToDisplayNm(w, ds, fromPolar(brg, rng));
      expect(s.x).toBeCloseTo(rng * Math.sin((brg * Math.PI) / 180), 9);
      expect(s.y).toBeCloseTo(rng * Math.cos((brg * Math.PI) / 180), 9);
    }
  });
});

describe("1.3 bearings", () => {
  it("Figure 1.12: heading 240, relative bearing 040, true bearing 280", () => {
    expect(relativeToTrueBearing(40, 240)).toBe(280);
  });
});

describe("1.4 and 1.5: orientation with true motion", () => {
  // Book 1.5.2.1: any orientation except unstabilised head-up can be used with true motion.
  it("choosing head-up in true motion puts the picture into relative motion", () => {
    expect(settleDisplayModes({ orientation: "head-up", motion: "true" }, "orientation")).toEqual({ motion: "relative" });
  });
  it("choosing true motion in head-up turns the picture to course-up", () => {
    expect(settleDisplayModes({ orientation: "head-up", motion: "true" }, "motion")).toEqual({ orientation: "course-up" });
  });
  it("north-up and course-up can be used with true motion, and head-up with relative motion", () => {
    expect(settleDisplayModes({ orientation: "north-up", motion: "true" }, "motion")).toEqual({});
    expect(settleDisplayModes({ orientation: "course-up", motion: "true" }, "orientation")).toEqual({});
    expect(settleDisplayModes({ orientation: "head-up", motion: "relative" }, "orientation")).toEqual({});
  });
});

/*
 * Figures 1.17 to 1.19: the same four targets on the three presentations.
 * Own ship heads 000 at 10 kn through the water; the tide sets 270 at 4 kn everywhere.
 *   A  7 NM north of own ship, stopped in the water, heading 045
 *   B  8 NM east of A, heading 270 at 10 kn through the water
 *   C  5 NM north of A, heading 180 at 5 kn through the water
 *   L  a buoy 7 NM west of A, fixed to the ground
 * Worked by hand for 30 minutes (east, north, NM; own ship starts at 0, 0):
 *   own ship over the ground (-4, 10) kn -> (-2, 5)
 *   A over the ground (-4, 0) kn -> (-2, 7);  B (-14, 0) kn -> (1, 7);  C (-4, -5) kn -> (-2, 9.5);  L stays (-7, 7)
 * Relative motion (positions less own ship's):   A (0,7)->(0,2)  B (8,7)->(3,2)  C (0,12)->(0,4.5)  L (-7,7)->(-5,2)
 * True motion, sea stabilised (positions less the water's movement (-2, 0)):
 *   own ship (0,0)->(0,5)  A stays (0,7)  B (8,7)->(3,7)  C (0,12)->(0,9.5)  L (-7,7)->(-5,7)
 * True motion, ground stabilised: own ship (0,0)->(-2,5)  A (0,7)->(-2,7)  B (8,7)->(1,7)  C (0,12)->(-2,9.5)  L stays (-7,7)
 */
const FIG_1_17: Scenario = {
  id: "book3-fig1-17", name: "Book figure 1.17", description: "", coasts: [],
  own: { heading: 0, speed: 10 },
  env: { current: { set: 270, drift: 4 }, seaState: 0 },
  targets: [
    { id: 1, name: "A", kind: "ship", typeId: "general-cargo", pos: { e: 0, n: 7 }, course: 45, speed: 0, rcs: 1, height: 15, events: [] },
    { id: 2, name: "B", kind: "ship", typeId: "general-cargo", pos: { e: 8, n: 7 }, course: 270, speed: 10, rcs: 1, height: 15, events: [] },
    { id: 3, name: "C", kind: "ship", typeId: "general-cargo", pos: { e: 0, n: 12 }, course: 180, speed: 5, rcs: 1, height: 15, events: [] },
    { id: 4, name: "L", kind: "buoy", pos: { e: -7, n: 7 }, course: 0, speed: 0, rcs: 0.1, height: 4, events: [] },
  ],
};

const run30min = (ds: (w: World) => DisplayState) => {
  const w = createWorld(FIG_1_17);
  const d = ds(w);
  recentreTrueMotion(w, d);
  type P = { x: number; y: number };
  const where = (): Record<"own" | "A" | "B" | "C" | "L", P> => {
    const at = (n: string): P => worldToDisplayNm(w, d, w.targets.find((t) => t.name === n)!.pos);
    return { own: worldToDisplayNm(w, d, w.own.pos), A: at("A"), B: at("B"), C: at("C"), L: at("L") };
  };
  const at1000 = where();
  for (let i = 0; i < 3600; i++) {
    stepWorld(w, 0.5);
    stepSpeedInput(w, d, 0.5, w.own.speedThroughWater); // the log gives the right speed through the water
  }
  return { w, at1000, at1030: where() };
};
const mode = (motion: "relative" | "true", stabilisation: "sea" | "ground") => (w: World): DisplayState => ({ ...newDisplayState(w), motion, stabilisation });
const near = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 2);
  expect(p.y).toBeCloseTo(y, 2);
};

describe("figures 1.17 to 1.19: one encounter on the three presentations, after 30 minutes", () => {
  it("the vessels really move as the book says (A set 2 NM west by the tide, B and C through the water and with the tide)", () => {
    const { w } = run30min(mode("relative", "ground"));
    const pos = (n: string) => w.targets.find((t) => t.name === n)!.pos;
    expect(w.own.pos.e).toBeCloseTo(-2, 2);
    expect(w.own.pos.n).toBeCloseTo(5, 2);
    expect(pos("A").e).toBeCloseTo(-2, 2);
    expect(pos("A").n).toBeCloseTo(7, 2);
    expect(pos("B").e).toBeCloseTo(1, 2);
    expect(pos("C").n).toBeCloseTo(9.5, 2);
    expect(pos("L")).toEqual({ e: -7, n: 7 });
  });
  it("1.17 relative motion: A moves 5 NM down the heading line, C 7.5 NM, and A closes the buoy from 7 to 5 NM", () => {
    for (const stab of ["sea", "ground"] as const) {
      // In relative motion the stabilisation makes no difference: everything is drawn from own ship.
      const { at1000, at1030 } = run30min(mode("relative", stab));
      near(at1030.own, 0, 0);
      near(at1000.A, 0, 7);
      near(at1030.A, 0, 2);
      near(at1030.B, 3, 2);
      near(at1030.C, 0, 4.5);
      near(at1030.L, -5, 2);
      expect(at1030.A.x - at1030.L.x).toBeCloseTo(5, 2);
    }
  });
  it("1.18 true motion, sea stabilised: A stays put, B moves 5 NM west, C 2.5 NM south, the buoy 2 NM east", () => {
    const { at1000, at1030 } = run30min(mode("true", "sea"));
    near(at1000.own, 0, 0);
    near(at1030.own, 0, 5);
    near(at1030.A, 0, 7);
    near(at1030.B, 3, 7);
    near(at1030.C, 0, 9.5);
    near(at1030.L, -5, 7);
  });
  it("1.19 true motion, ground stabilised: the buoy stays put, A moves 2 NM west with the tide, own ship 5 NM north and 2 west", () => {
    const { at1030 } = run30min(mode("true", "ground"));
    near(at1030.own, -2, 5);
    near(at1030.L, -7, 7);
    near(at1030.A, -2, 7);
    near(at1030.B, 1, 7);
    near(at1030.C, -2, 9.5);
  });
});

describe("1.5.2.1 a plain target's bow points along its course through the water", () => {
  // A plain target (no catalogue type) is given its course and speed over the ground. Vessel C of the figures
  // makes good 4 W and 5 S (218.7 degrees, 6.40 kn) in a 270/4 tide; its course through the water is 180 at 5 kn.
  const sc: Scenario = {
    ...FIG_1_17,
    targets: [{ id: 3, name: "C", kind: "ship", ais: true, pos: { e: 0, n: 12 }, course: 180 + (Math.atan(4 / 5) * 180) / Math.PI, speed: Math.hypot(4, 5), rcs: 1, height: 15, events: [] }],
  };
  it("its heading is 180, the course through the water, not 218.7, the course over the ground", () => {
    const w = createWorld(sc);
    expect(targetHeading(w, w.targets[0]!)).toBeCloseTo(180, 6);
  });
  it("and its AIS sends that heading, with the course over the ground as its COG", () => {
    const w = createWorld(sc);
    const ais = new AisSystem();
    ais.step(w);
    const r = [...ais.reports.values()][0]!;
    expect(r.heading).toBeCloseTo(180, 6);
    expect(r.cog).toBeCloseTo(180 + (Math.atan(4 / 5) * 180) / Math.PI, 6); // 218.66
  });
  it("with no current, heading and course are the same", () => {
    const w = createWorld({ ...sc, env: { seaState: 0 } });
    expect(targetHeading(w, w.targets[0]!)).toBeCloseTo(sc.targets[0]!.course, 9);
  });
  it("a sea-stabilised true-motion picture moves the plain target's echo along that heading", () => {
    const w = createWorld(sc);
    const ds: DisplayState = { ...newDisplayState(w), motion: "true", stabilisation: "sea" };
    recentreTrueMotion(w, ds);
    const p0 = worldToDisplayNm(w, ds, w.targets[0]!.pos);
    for (let i = 0; i < 720; i++) {
      stepWorld(w, 0.5);
      stepSpeedInput(w, ds, 0.5, w.own.speedThroughWater);
    }
    const p1 = worldToDisplayNm(w, ds, w.targets[0]!.pos);
    const moved = sub({ e: p1.x, n: p1.y }, { e: p0.x, n: p0.y });
    expect(moved.e).toBeCloseTo(0, 6);
    expect(moved.n).toBeCloseTo(-0.5, 6); // 5 kn for 6 minutes, due south
  });
});
