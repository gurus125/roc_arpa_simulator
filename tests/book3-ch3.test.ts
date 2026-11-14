import { describe, expect, it } from "vitest";
import { Scenario, World, clutterPulseFactor, createWorld, pulseEnergyFactor, scanWedge } from "../src/engine/index";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 3: Target detection. Expected values
 * are the book's own figures, or worked by hand from its rules (shown in the comments), never taken from the
 * simulator. See docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

describe("3.6.1.6 pulse length and sea clutter", () => {
  it("a short pulse cuts sea clutter more than it cuts a target; a long pulse raises it more", () => {
    // Clutter power goes with the energy on the sea and with the depth of sea answering (half the pulse); a target's
    // only with the energy. Hand, 6 NM scale (medium pulse 0.3 us at 1500 Hz): short 0.07 us at 3000 Hz.
    expect(clutterPulseFactor(6, "short") / pulseEnergyFactor(6, "short")).toBeCloseTo(Math.sqrt(0.07 / 0.3), 9);
    expect(clutterPulseFactor(6, "long") / pulseEnergyFactor(6, "long")).toBeCloseTo(Math.sqrt(1.2 / 0.3), 9);
  });
});

describe("3.6.3.4 rotation-to-rotation correlation (echo averaging)", () => {
  // A target whose echo comes and goes is shown less often; a steady one is not touched.
  const sc = (rcs: number): Scenario => ({
    id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [],
    targets: [{ id: 1, name: "buoy", kind: "buoy", pos: { e: 0, n: 2 }, course: 0, speed: 0, rcs, height: 3, events: [] }],
  });
  const paintedShare = (w: World): number => {
    let s = 7, n = 0;
    const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let i = 0; i < 4000; i++) if (scanWedge(w, 355, 365, rng).some((h) => h.kind === "target")) n++;
    return n / 4000;
  };
  const world = (rcs: number, avg: boolean): World => {
    const w = createWorld(sc(rcs), 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.gain = 50;
    w.radar.controls.stc = 0;
    w.radar.controls.echoAverage = avg;
    w.radar.shadowSectors = [];
    return w;
  };
  it("a marginal echo painted on about half the scans is painted on about a quarter with echo averaging", () => {
    // A buoy (no aspect effect); rcs chosen so the echo sits at the display threshold at 2 NM: 0.35 = rcs x (10/2)^2.
    const rcs = 0.35 / 25;
    const off = paintedShare(world(rcs, false)), on = paintedShare(world(rcs, true));
    expect(off).toBeCloseTo(0.5, 1);
    expect(on).toBeCloseTo(off * off, 1);
  });
  it("a strong steady echo is painted every scan either way", () => {
    expect(paintedShare(world(1, false))).toBe(1);
    expect(paintedShare(world(1, true))).toBe(1);
  });
});

import {
  DETECT_LEVEL_8_OF_10, RAIN_CLUTTER_REF_NM, RAIN_LOSS_DB_PER_NM, SART_DOT_SPACING_NM, SIDE_LOBES, THRESHOLD, effectiveSignal, maskedByClutter,
  minRangeNm, pulseFor, rainClutterLevel, rainPathFactor, raconSegments, seaClutterLevel, transponderSpreadDeg, RACON_LENGTH_NM,
} from "../src/engine/index";
import { lengthInsideCircle } from "../src/core/nav";

const base = (targets: Scenario["targets"] = [], env: Scenario["env"] = { seaState: 0 }): World => {
  const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env, coasts: [], targets }, 62);
  w.radar.controls.tuning = 62;
  w.radar.controls.gain = 50;
  w.radar.controls.stc = 0;
  w.radar.controls.ftc = 0;
  w.radar.shadowSectors = [];
  return w;
};
const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};

describe("3.2.4 minimum detection range (Example 3.1)", () => {
  it("half the shortest pulse: 0.1 microseconds gives 15 m; the simulator's short pulse (0.07) 10.5 m, and its minimum range lies between that and IMO's 40 m", () => {
    expect((0.1 / 2) * 300).toBeCloseTo(15, 9);
    const short = pulseFor(0.75);
    expect(minRangeNm(0.75) * 1852).toBeGreaterThanOrEqual((short.microseconds / 2) * 300);
    expect(minRangeNm(0.75) * 1852).toBeLessThanOrEqual(40);
  });
});

describe("3.6.1 sea clutter", () => {
  it("higher waves: clutter stronger and further out", () => {
    const w3 = base([], { seaState: 3 }), w5 = base([], { seaState: 5 });
    for (const r of [0.5, 1, 2]) expect(seaClutterLevel(w5, r, 90)).toBeGreaterThan(seaClutterLevel(w3, r, 90));
  });
  it("3.6.1.5: clutter power goes about inversely with the wavelength, so S band clutter strength is sqrt(3.2 / 9.8) = 0.571 of X band", () => {
    const x = base([], { seaState: 5 }), s = base([], { seaState: 5 });
    s.radar.band = "S";
    expect(seaClutterLevel(s, 1, 90) / seaClutterLevel(x, 1, 90)).toBeCloseTo(Math.sqrt(3.2 / 9.8), 9);
  });
});

describe("3.6.2 and 3.7.4.4: a target weaker than the clutter around it cannot be shown", () => {
  // Rain at 2 NM ahead, 0.5 NM across. Two buoys inside it: one weaker than the rain, one stronger.
  const rain = [{ center: { e: 0, n: 2 }, radius: 0.5, intensity: 0.5 }];
  const buoy = (id: number, rcs: number) => ({ id, name: `b${id}`, kind: "buoy" as const, pos: { e: 0, n: 2 }, course: 0, speed: 0, rcs, height: 3, events: [] });
  const painted = (rcs: number, ftc: number): number => {
    const w = base([buoy(1, rcs)], { seaState: 0, rain });
    w.radar.controls.ftc = ftc;
    const rng = seeded(3);
    let n = 0;
    for (let i = 0; i < 400; i++) if (scanWedge(w, 355, 365, rng).some((h) => h.kind === "target")) n++;
    return n;
  };
  it("the rain at the buoys is about 2 in strength; a buoy of strength 1 there is never shown, not even with the rain control at full", () => {
    const w = base([], { seaState: 0, rain });
    // Hand: sqrt(0.5) x 3 x (2 NM ref / 2 NM) = 2.121, less the loss through 0.5 NM of rain at half intensity:
    // 1.5 dB x 0.5 x 0.5 = 0.375 dB, x 0.958 = 2.032.
    expect(rainClutterLevel(w, { e: 0, n: 2 }, w.radar.controls, false)).toBeCloseTo(Math.sqrt(0.5) * 3 * Math.pow(10, -0.375 / 20), 6);
    const weak = 1 / 25; // strength 1 at 2 NM: rcs x (10 / 2)^2
    expect(painted(weak, 0)).toBe(0);
    expect(painted(weak, 100)).toBe(0);
  });
  it("a buoy stronger than the rain is shown, and with the rain control the rain itself goes", () => {
    const strong = 5 / 25;
    expect(painted(strong, 100)).toBeGreaterThan(390);
    const w = base([], { seaState: 0, rain });
    w.radar.controls.ftc = 100;
    expect(rainClutterLevel(w, { e: 0, n: 2 })).toBeLessThan(0.6 * THRESHOLD); // 2.03 x 0.08 = 0.16: no rain speckle
  });
  it("the same rule in sea clutter", () => {
    // Sea state 9, 0.5 NM on the starboard beam, the sea from the west (down-sea): clutter 4 x e^(-0.5 / (1.2 x 0.7)) = 2.206.
    const w = base([], { seaState: 9 });
    expect(seaClutterLevel(w, 0.5, 90)).toBeCloseTo(4 * Math.exp(-0.5 / 0.84), 6);
    const at = (rcs: number) => ({ rcs, height: 3, rangeNm: 0.5, relBearing: 90, pos: { e: 0.5, n: 0 }, kind: "buoy" as const });
    // A buoy of strength 1.6 (rcs 0.004 x 400) is masked; one of strength 4 (0.01 x 400) is not.
    expect(maskedByClutter(w, at(0.004), effectiveSignal(w, at(0.004)))).toBe(true);
    expect(maskedByClutter(w, at(0.01), effectiveSignal(w, at(0.01)))).toBe(false);
    // The sea control lowers clutter and target alike: the weaker buoy stays masked at any setting.
    for (const stc of [20, 50, 80, 100]) {
      w.radar.controls.stc = stc;
      expect(maskedByClutter(w, at(0.004), effectiveSignal(w, at(0.004)))).toBe(true);
    }
  });
});

describe("3.7 precipitation", () => {
  it("the path through a circle of rain (core geometry)", () => {
    expect(lengthInsideCircle({ e: 0, n: 0 }, { e: 0, n: 10 }, { e: 0, n: 5 }, 2)).toBeCloseTo(4, 12);
    expect(lengthInsideCircle({ e: 0, n: 0 }, { e: 0, n: 5 }, { e: 0, n: 5 }, 2)).toBeCloseTo(2, 12);
    expect(lengthInsideCircle({ e: 0, n: 0 }, { e: 0, n: 10 }, { e: 1, n: 5 }, 2)).toBeCloseTo(2 * Math.sqrt(3), 12);
    expect(lengthInsideCircle({ e: 0, n: 0 }, { e: 0, n: 10 }, { e: 3, n: 5 }, 2)).toBe(0);
  });
  it("3.7.2, 3.7.5.1: a target beyond the rain loses echo on the way through it, far more on X band than on S band", () => {
    const rain = [{ center: { e: 0, n: 3 }, radius: 1, intensity: 1 }];
    const x = base([], { seaState: 0, rain }), s = base([], { seaState: 0, rain });
    s.radar.band = "S";
    // 2 NM of heavy rain: X band 2 x 1.5 = 3 dB, strength x 0.708; S band 0.3 dB, x 0.966.
    expect(rainPathFactor(x, { e: 0, n: 6 })).toBeCloseTo(Math.pow(10, -(2 * RAIN_LOSS_DB_PER_NM.X) / 20), 9);
    expect(rainPathFactor(s, { e: 0, n: 6 })).toBeCloseTo(Math.pow(10, -(2 * RAIN_LOSS_DB_PER_NM.S) / 20), 9);
    expect(rainPathFactor(x, { e: 4, n: 6 })).toBe(1); // a target off to the side: the line passes 1.66 NM from the rain's centre
  });
  it("3.7.1: rain clutter power goes with the rainfall rate and falls with the square of range; S band about a tenth", () => {
    // Two small showers on one bearing, so that the rain on the way is negligible.
    const w = base([], { seaState: 0, rain: [{ center: { e: 0, n: 2 }, radius: 0.01, intensity: 1 }, { center: { e: 0, n: 4 }, radius: 0.01, intensity: 0.25 }] });
    const near = rainClutterLevel(w, { e: 0, n: 2 }), far = rainClutterLevel(w, { e: 0, n: 4 });
    // Power: x 1/4 for the rate (strength x 1/2) and x 1/4 for twice the range (strength x 1/2): strength x 1/4.
    expect(far / near).toBeCloseTo(0.25, 2);
    expect(near).toBeCloseTo(3 * (RAIN_CLUTTER_REF_NM / 2), 1);
    w.radar.band = "S";
    // Power with the inverse square of the wavelength: (3.2 / 9.8)^2 = 0.107, about a tenth.
    expect((rainClutterLevel(w, { e: 0, n: 2 }) / near) ** 2).toBeCloseTo((3.2 / 9.8) ** 2, 2);
  });
  it("3.7.4.1: a short pulse cuts rain clutter as it does sea clutter", () => {
    const w = base([], { seaState: 0, rain: [{ center: { e: 0, n: 2 }, radius: 0.01, intensity: 1 }] });
    w.radar.controls.rangeNm = 6;
    const auto = rainClutterLevel(w, { e: 0, n: 2 });
    w.radar.controls.pulse = "short";
    expect(rainClutterLevel(w, { e: 0, n: 2 }) / auto).toBeCloseTo(clutterPulseFactor(6, "short"), 9);
  });
  it("3.7.4.3: the sea control acts on rain close to own ship", () => {
    const w = base([], { seaState: 0, rain: [{ center: { e: 0, n: 0.5 }, radius: 0.3, intensity: 1 }] });
    const before = rainClutterLevel(w, { e: 0, n: 0.5 });
    w.radar.controls.stc = 80;
    expect(rainClutterLevel(w, { e: 0, n: 0.5 })).toBeLessThan(before);
  });
});

describe("3.5 racons and SARTs", () => {
  it("3.5.2: the whole racon response is 1.5 to 3 NM long (20 to 40 microseconds), starting just beyond the mark", () => {
    expect(RACON_LENGTH_NM).toBeGreaterThanOrEqual(1.5);
    expect(RACON_LENGTH_NM).toBeLessThanOrEqual(3);
    const seg = raconSegments("-.-");
    expect(seg[seg.length - 1]!.to - seg[0]!.from).toBeCloseTo(RACON_LENGTH_NM, 9);
    expect(seg[0]!.from * 1852).toBeLessThanOrEqual(100); // the book: at most about 100 m
  });
  it("3.5.6: beyond about 1 NM a SART paints dots; inside it the side lobes trigger it and the dots become arcs; very close, circles", () => {
    expect(transponderSpreadDeg(1.2)).toEqual([0]);
    // At 0.5 NM the margin is 20 log(30 / 0.5) = 35.6 dB: lobes 30, 32 and 34 dB down, to 17 degrees each side.
    const half = transponderSpreadDeg(0.5);
    expect(Math.max(...half)).toBe(17);
    expect(Math.min(...half)).toBe(-17);
    // Inside 30 x 10^(-50/20) = 0.095 NM every bearing.
    expect(transponderSpreadDeg(0.09).length).toBe(360);
  });
  it("a SART at 0.5 NM paints its 12 rings of dots as arcs", () => {
    const w = base([{ id: 1, name: "sart", kind: "small-craft", pos: { e: 0, n: 0.5 }, course: 0, speed: 0, rcs: 0.001, height: 1, events: [], transponder: "sart" }]);
    w.radar.controls.rangeNm = 12;
    const hits = scanWedge(w, -0.5, 359.4, () => 0.5).filter((h) => h.kind === "sart");
    const first = hits.filter((h) => Math.abs(Math.hypot(h.pos.e, h.pos.n) - (0.5 + 60 / 1852)) < 0.005);
    expect(first.length).toBe(35); // -17 to +17 degrees
    expect(hits.length).toBe(35 * 12);
    expect(SART_DOT_SPACING_NM).toBeCloseTo(0.6, 1);
  });
  it("3.5.3.3: the rain control and interference rejection mutilate a racon; off tune it is not shown", () => {
    const racon = { id: 1, name: "K", kind: "buoy" as const, pos: { e: 0, n: 3 }, course: 0, speed: 0, rcs: 0.05, height: 5, events: [], transponder: "racon" as const, raconCode: "-.-" };
    const count = (f: (w: World) => void) => {
      const w = base([racon]);
      w.radar.controls.rangeNm = 12;
      f(w);
      return scanWedge(w, -0.5, 359.4, () => 0.5).filter((h) => h.kind === "racon").length;
    };
    const clean = count(() => {});
    expect(clean).toBeGreaterThan(50);
    expect(count((w) => (w.radar.controls.ftc = 100))).toBeLessThan(clean * 0.35);
    expect(count((w) => (w.radar.controls.interferenceRejection = true))).toBeLessThan(clean * 0.6);
    expect(count((w) => (w.radar.controls.tuning = 62 + 30))).toBe(0);
  });
});

describe("3.9 false echoes", () => {
  it("3.9.4: side echoes lie at the target's own range either side of it, more of them the stronger and closer the echo", () => {
    // A strong buoy (strength 1 at 10 NM) at 0.25 NM: strength 1 x (10 / 0.25)^2 = 1600. Out and back through a lobe
    // L dB down leaves 1600 x 10^(-L/10): 30 dB 1.6, 32 dB 1.01, 34 dB 0.64, 36 dB 0.40 (painted), 38 dB 0.25 (not).
    const w = base([{ id: 1, name: "b", kind: "buoy", pos: { e: 0, n: 0.25 }, course: 0, speed: 0, rcs: 1, height: 3, events: [] }]);
    const side = scanWedge(w, 0, 359.99, () => 0.5).filter((h) => h.kind === "sidelobe");
    expect(side.length).toBe(8);
    for (const h of side) expect(Math.hypot(h.pos.e, h.pos.n)).toBeCloseTo(0.25, 9);
    expect(SIDE_LOBES[0]!.downDb).toBe(30);
    // At 2 NM the same buoy (strength 25) has none: 25 x 10^-3 = 0.025.
    const far = base([{ id: 1, name: "b", kind: "buoy", pos: { e: 0, n: 2 }, course: 0, speed: 0, rcs: 1, height: 3, events: [] }]);
    expect(scanWedge(far, 0, 359.99, () => 0.5).some((h) => h.kind === "sidelobe")).toBe(false);
  });
  it("3.9.3: multiple echoes are more likely with a long pulse on a short range scale", () => {
    const sc = [{ id: 1, name: "big", kind: "ship" as const, pos: { e: 1.2, n: 0 }, course: 0, speed: 0, rcs: 1, height: 20, events: [] }];
    const n = (pulse: "auto" | "long") => {
      let k = 0;
      for (let i = 0; i < 200; i++) {
        const w = base(sc);
        w.radar.controls.rangeNm = 3;
        w.radar.controls.pulse = pulse;
        k += scanWedge(w, 80, 100, seeded(i + 1)).filter((h) => h.kind === "multiple").length;
      }
      return k;
    };
    expect(n("long")).toBeGreaterThan(n("auto"));
  });
});

describe("IMO detection standard (Table 3.1) still holds with all of the above", () => {
  it("the calibration level is the 8-scans-in-10 level", () => {
    expect(DETECT_LEVEL_8_OF_10).toBeGreaterThan(THRESHOLD);
  });
});
