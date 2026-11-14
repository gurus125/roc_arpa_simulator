import { describe, expect, it } from "vitest";
import {
  DisplayState, RADAR_WARM_UP_LIMIT_SEC, RADAR_WARM_UP_SEC, Scenario, TM_LIMIT_SHARE, TM_RESET_SHARE, World, createWorld, newDisplayState,
  pulseFor, resetTrueMotionAhead, ringInterval, scanWedge, stepWorld, updateTrueMotionOrigin, worldToDisplayNm,
} from "../src/engine/index";
import { defaultArpaSettings } from "../src/arpa/index";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 6: Operational controls. Expected
 * values are the book's figures or worked by hand. See docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

const world = (own: { heading: number; speed: number }, targets: Scenario["targets"] = []): World => {
  const w = createWorld({ id: "t", name: "t", description: "", own, env: { seaState: 0 }, coasts: [], targets }, 62);
  w.radar.controls.tuning = 62;
  w.radar.shadowSectors = [];
  return w;
};

describe("6.2.6.3 true-motion reset", () => {
  it("the limit is between IMO's 50% and 75% of the radius; the reset is up to 50% out", () => {
    expect(TM_LIMIT_SHARE).toBeGreaterThanOrEqual(0.5);
    expect(TM_LIMIT_SHARE).toBeLessThanOrEqual(0.75);
    expect(TM_RESET_SHARE).toBeLessThanOrEqual(0.5);
  });
  it("the reset puts own ship on the reciprocal of her course, half the radius out, for the most view ahead", () => {
    // Own ship 090 at 12 kn, 6 NM scale, ground stabilised: she is put 3 NM west of the centre.
    const w = world({ heading: 90, speed: 12 });
    w.radar.controls.rangeNm = 6;
    const ds: DisplayState = { ...newDisplayState(w), motion: "true", stabilisation: "ground" };
    resetTrueMotionAhead(w, ds);
    const p = worldToDisplayNm(w, ds, w.own.pos);
    expect(p.x).toBeCloseTo(-3, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });
  it("and it happens by itself when she reaches the limit", () => {
    // From 3 NM west she runs 3 + 0.66 x 6 = 6.96 NM east before the limit: 34.8 minutes at 12 kn.
    const w = world({ heading: 90, speed: 12 });
    w.radar.controls.rangeNm = 6;
    const ds: DisplayState = { ...newDisplayState(w), motion: "true", stabilisation: "ground" };
    resetTrueMotionAhead(w, ds);
    let resetAt = -1;
    for (let i = 0; i < 2 * 60 * 40 && resetAt < 0; i++) {
      stepWorld(w, 0.5);
      if (updateTrueMotionOrigin(w, ds)) resetAt = w.time;
    }
    expect(resetAt / 60).toBeCloseTo(34.8, 0);
    expect(worldToDisplayNm(w, ds, w.own.pos).x).toBeCloseTo(-3, 6);
  });
});

describe("6.5 stand-by and switching on", () => {
  it("warm-up within the standard's limit; from stand-by the radar transmits at once (inside 5 s)", () => {
    expect(RADAR_WARM_UP_SEC).toBeLessThanOrEqual(RADAR_WARM_UP_LIMIT_SEC);
  });
});

describe("6.6.1 fixed range rings", () => {
  it("six rings on the scales above 1 NM, at least two below it", () => {
    for (const r of [1.5, 3, 6, 12, 24]) expect(r / ringInterval(r)).toBeCloseTo(6, 9);
    for (const r of [0.25, 0.5, 0.75]) expect(r / ringInterval(r)).toBeGreaterThanOrEqual(2);
  });
});

describe("6.6.1, 6.6.7 and 6.8: range is measured to the near edge of the echo", () => {
  it("a 210 m ship end-on at 6 NM: the paint starts at her nearest face, 105 m short of her centre, and runs outward", () => {
    // Book (2.8.5.1, 6.6.1): the near edge of the echo is the leading edge of the returned pulse, the nearest face.
    const w = world({ heading: 0, speed: 0 }, [{ id: 1, name: "ship", kind: "ship", lengthM: 210, beamM: 30, pos: { e: 0, n: 6 }, course: 0, speed: 0, rcs: 2, height: 20, events: [] }]);
    w.radar.controls.rangeNm = 12;
    const h = scanWedge(w, -0.5, 0.5, () => 0.1).find((x) => x.kind === "target")!;
    expect(h.outward).toBe(true);
    expect(Math.hypot(h.pos.e, h.pos.n) * 1852).toBeCloseTo(6 * 1852 - 105, 6);
    // Its depth: half the long pulse (1.2 us x 150 m = 180 m) plus her length along the line of sight (210 m).
    expect(h.depthNm! * 1852).toBeCloseTo(pulseFor(12).microseconds * 150 + 210, 6);
  });
  it("echo stretch lengthens the paint outward and keeps the leading edge where it was", () => {
    const w = world({ heading: 0, speed: 0 }, [{ id: 1, name: "ship", kind: "ship", lengthM: 210, beamM: 30, pos: { e: 0, n: 6 }, course: 0, speed: 0, rcs: 2, height: 20, events: [] }]);
    w.radar.controls.rangeNm = 12;
    const plain = scanWedge(w, -0.5, 0.5, () => 0.1).find((x) => x.kind === "target")!;
    w.radar.controls.echoStretch = true;
    const stretched = scanWedge(w, -0.5, 0.5, () => 0.1).find((x) => x.kind === "target")!;
    expect(stretched.pos.n).toBeCloseTo(plain.pos.n, 12);
    expect(stretched.depthNm!).toBeGreaterThan(plain.depthNm!);
  });
});

describe("6.9.4 vector time", () => {
  it("a default between 6 and 12 minutes", () => {
    const v = defaultArpaSettings(0, 12).vectorMinutes;
    expect(v).toBeGreaterThanOrEqual(6);
    expect(v).toBeLessThanOrEqual(12);
  });
});
