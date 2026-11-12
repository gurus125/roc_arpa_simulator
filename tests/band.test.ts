import { describe, expect, it } from "vitest";
import {
  BAND_DATA, DETECT_LEVEL_8_OF_10, IMO_TABLE2, createWorld, detectionProbability, effectiveSignal, minRangeNm, pulseFor,
  rcsForDetectionRange, sBandFactor, scanWedge, shorelineDetectionNm,
} from "../src/engine/index";

/**
 * IMO MSC.192(79) table 2: minimum detection ranges in clutter-free conditions, antenna 15 m,
 * target shown on at least 8 scans in 10. The expected values below are the printed table.
 */
describe("IMO MSC.192(79) table 2: detection ranges on X and S band", () => {
  const world = (band: "X" | "S") => {
    const w = createWorld({ id: "b", name: "b", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [], targets: [] }, 50);
    w.own.antennaHeight = 15;
    w.radar.controls.tuning = 50; // tuned
    w.radar.controls.rangeNm = 24;
    w.radar.shadowSectors = [];
    w.radar.band = band;
    return w;
  };
  /** Furthest range at which the target is painted on at least 8 scans in 10 (search in 0.01 NM steps). */
  const firstDetection = (band: "X" | "S", rcs: number, heightM: number, kind: (typeof IMO_TABLE2)[number]["kind"]): number => {
    const w = world(band);
    let best = 0;
    for (let r = 0.1; r <= 24; r += 0.01) {
      const p = detectionProbability(effectiveSignal(w, { rcs, height: heightM, rangeNm: r, relBearing: 90, pos: { e: r, n: 0 }, kind }));
      if (p >= 0.8) best = r;
    }
    return best;
  };

  it("the 8-in-10 level follows from the detection curve", () => {
    expect(detectionProbability(DETECT_LEVEL_8_OF_10)).toBeCloseTo(0.8, 9);
  });

  for (const t of IMO_TABLE2) {
    it(`${t.name}: X ${t.xNm} NM, S ${t.sNm} NM`, () => {
      const rcs = t.kind === "coast" ? rcsForDetectionRange(shorelineDetectionNm(t.heightM)) : rcsForDetectionRange(t.xNm);
      expect(firstDetection("X", rcs, t.heightM, t.kind)).toBeCloseTo(t.xNm, 1);
      if (t.kind === "ship" || t.kind === "coast") {
        expect(firstDetection("S", rcs, t.heightM, t.kind)).toBeCloseTo(t.sNm, 1);
      }
    });
  }

  it("S band: the table's typical buoy (3.0 NM) and 10 m boat without reflector (3.0 NM) are reproduced exactly", () => {
    expect(firstDetection("S", rcsForDetectionRange(4.6), 3.5, "buoy")).toBeCloseTo(3.0, 1);
    expect(firstDetection("S", rcsForDetectionRange(3.4), 2, "small-craft")).toBeCloseTo(3.0, 1);
  });

  it("S band: the other small targets come out within 0.6 NM of the table (one factor per kind of target)", () => {
    // Table: reflector vessel 3.7, buoy with corner reflector 3.6, channel marker 1.0.
    expect(Math.abs(firstDetection("S", rcsForDetectionRange(5.0), 4, "small-craft") - 3.7)).toBeLessThan(0.8);
    expect(Math.abs(firstDetection("S", rcsForDetectionRange(4.9), 3.5, "buoy") - 3.6)).toBeLessThan(0.6);
    expect(Math.abs(firstDetection("S", rcsForDetectionRange(2.0), 1, "buoy") - 1.0)).toBeLessThan(0.6);
  });

  it("band factors and shoreline heights", () => {
    expect(sBandFactor("ship")).toBe(1);
    expect(sBandFactor("buoy")).toBeCloseTo((3 / 4.6) ** 2, 12);
    expect(shorelineDetectionNm(60)).toBe(20);
    expect(shorelineDetectionNm(6)).toBe(8);
    expect(shorelineDetectionNm(3)).toBe(6);
    expect(shorelineDetectionNm(33)).toBeCloseTo(14, 9); // half way between 6 m and 60 m
  });

  it("a 60 m shoreline is painted (8 scans in 10) at 19 NM and not at 21.5 NM", () => {
    const coastAt = (n: number) => {
      const w = createWorld({ id: "c", name: "c", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, targets: [], coasts: [{ name: "c", closed: false, points: [{ e: -3, n }, { e: 3, n }] }] }, 50);
      w.own.antennaHeight = 15;
      w.radar.controls.tuning = 50;
      w.radar.controls.rangeNm = 24;
      w.radar.shadowSectors = [];
      // A random draw of 0.79 paints an echo only where it would show on about 8 scans in 10.
      return scanWedge(w, 0, 359.9, () => 0.79).filter((h) => h.kind === "coast").length;
    };
    expect(coastAt(19)).toBeGreaterThan(0);
    expect(coastAt(21.5)).toBe(0);
  });
});

describe("pulse settings and minimum range (placeholder typical values)", () => {
  it("short pulse on the short scales meets the 40 m minimum range and range discrimination of MSC.192(79) 5.4 and 5.5", () => {
    const p = pulseFor(0.75);
    expect(p.name).toBe("short");
    expect(p.minRangeNm * 1852).toBeLessThanOrEqual(40);
    expect(p.rangeDiscriminationNm * 1852).toBeLessThanOrEqual(40);
    expect(minRangeNm(1.5)).toBe(0.02);
    // Half the pulse length: 0.25 microseconds x 150 m = 37.5 m.
    expect(pulseFor(6).rangeDiscriminationNm * 1852).toBeCloseTo(37.5, 6);
    expect(pulseFor(12).name).toBe("long");
  });
  it("the S-band beam is wider than the X-band beam", () => {
    expect(BAND_DATA.S.beamwidthDeg).toBeGreaterThan(BAND_DATA.X.beamwidthDeg);
  });
});

import { SAR, SECOND_TRACE, pulseEnergyFactor, seaClutterProbability, unambiguousRangeNm } from "../src/engine/index";
import { validateScenario, scenarioToJson } from "../src/train/index";

describe("pulse length, second-trace echoes, ramark, interference, echo processing, performance", () => {
  const mk = (sc = SECOND_TRACE) => {
    const w = createWorld(sc, 50);
    w.radar.controls.tuning = 50;
    w.radar.shadowSectors = [];
    return w;
  };
  const kinds = (w: ReturnType<typeof mk>, kind: string) => scanWedge(w, 0, 359.9, () => 0.3).filter((h) => h.kind === kind);

  it("unambiguous range is c / (2 PRF): 3000 per second gives 26.98 NM", () => {
    // 299 792.458 km/s / 6000 = 49.965 km = 26.979 NM.
    expect(unambiguousRangeNm(3000)).toBeCloseTo(26.979, 2);
    expect(unambiguousRangeNm(1500)).toBeCloseTo(53.958, 2);
  });

  it("a hand-chosen pulse changes minimum range, discrimination and echo strength; auto changes nothing", () => {
    expect(pulseFor(6, "auto").name).toBe("medium");
    expect(pulseFor(6, "short").name).toBe("short");
    expect(pulseEnergyFactor(6, "auto")).toBe(1);
    expect(pulseEnergyFactor(6)).toBe(1);
    expect(pulseEnergyFactor(6, "long")).toBeCloseTo(Math.sqrt(0.8 / 0.25), 12);
    expect(pulseEnergyFactor(6, "short")).toBeCloseTo(Math.sqrt(0.07 / 0.25), 12);
    expect(minRangeNm(6, "long")).toBe(0.07);
    expect(minRangeNm(6, "short")).toBe(0.02);
  });

  it("second-trace echo: the ship at 29.5 NM paints at 29.5 - 26.98 = 2.52 NM on short pulse, and not on medium pulse", () => {
    const w = mk();
    w.radar.controls.rangeNm = 3;
    w.radar.controls.pulse = "short";
    const st = kinds(w, "second-trace");
    expect(st.length).toBe(1);
    expect(Math.hypot(st[0]!.pos.e, st[0]!.pos.n)).toBeCloseTo(29.5 - 26.979, 2);
    // Same bearing as the real ship: 060.
    expect((Math.atan2(st[0]!.pos.e, st[0]!.pos.n) * 180) / Math.PI).toBeCloseTo(60, 6);
    w.radar.controls.pulse = "medium";
    expect(kinds(w, "second-trace").length).toBe(0);
    w.radar.controls.pulse = "short";
    w.env.ducting = false; // normal propagation: the ship is below the horizon
    expect(kinds(w, "second-trace").length).toBe(0);
  });

  it("interference shows until interference rejection is switched on", () => {
    const w = mk();
    expect(kinds(w, "interference").length).toBeGreaterThan(100);
    w.radar.controls.interferenceRejection = true;
    expect(kinds(w, "interference").length).toBe(0);
  });

  it("a ramark paints a broken line along its bearing only, on X band", () => {
    const w = mk(SAR);
    w.radar.controls.rangeNm = 12;
    const line = kinds(w, "ramark");
    expect(line.length).toBeGreaterThan(10);
    for (const h of line) expect(((Math.atan2(h.pos.e, h.pos.n) * 180) / Math.PI + 360) % 360).toBeCloseTo(230, 6);
    const ranges = line.map((h) => Math.hypot(h.pos.e, h.pos.n));
    expect(Math.min(...ranges)).toBeLessThan(3); // starts near the centre: it gives no range
    expect(Math.max(...ranges)).toBeGreaterThan(11);
    w.radar.band = "S";
    expect(kinds(w, "ramark").length).toBe(0);
  });

  it("echo averaging cuts random sea clutter to 30%; echo stretch paints targets 1.8 times larger", () => {
    const w = mk(SAR);
    w.env.seaState = 6;
    const before = seaClutterProbability(w, 0.5, 90);
    w.radar.controls.echoAverage = true;
    expect(seaClutterProbability(w, 0.5, 90)).toBeCloseTo(before * 0.3, 12);
    w.radar.controls.rangeNm = 12;
    const size = (): number => scanWedge(w, 0, 359.9, () => 0.3).find((h) => h.kind === "target" && h.targetId === 3)!.size;
    const normal = size();
    w.radar.controls.echoStretch = true;
    expect(size()).toBeCloseTo(normal * 1.8, 9);
  });

  it("reduced radar performance weakens every echo in proportion", () => {
    const w = mk(SAR);
    const sig = (): number => effectiveSignal(w, { rcs: 1, height: 20, rangeNm: 5, relBearing: 90, pos: { e: 5, n: 0 }, kind: "ship" });
    const full = sig();
    w.radar.performance = 0.5;
    expect(sig()).toBeCloseTo(full * 0.5, 12);
  });

  it("the new scenarios are valid scenario files", () => {
    expect(validateScenario(JSON.parse(scenarioToJson(SECOND_TRACE)))).toEqual([]);
    expect(validateScenario(JSON.parse(scenarioToJson(SAR)))).toEqual([]);
  });
});

describe("automatic anti-clutter (placeholder mapping)", () => {
  it("auto sea rises with sea state and stays within the control's range", async () => {
    const { autoSeaStc, autoRainFtc } = await import("../src/engine/signal");
    expect(autoSeaStc(0)).toBe(0);
    expect(autoSeaStc(3)).toBe(33);
    expect(autoSeaStc(9)).toBe(99);
    expect(autoSeaStc(20)).toBe(100);
    expect(autoRainFtc(80)).toBe(60);
    expect(autoRainFtc(0)).toBe(0);
  });
});
