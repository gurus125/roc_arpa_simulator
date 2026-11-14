import { describe, expect, it } from "vitest";
import {
  BAND_DATA, DETECT_LEVEL_8_OF_10, IR_LOSS_DB, Scenario, World, createWorld, echoShape, effectiveSignal, landFaceDetectionNm,
  meanPowerW, minRangeNm, pulseEnergyRatio, pulseFor, pulsesOnTarget, rainClutterProbability, rcsForDetectionRange,
  seaClutterProbability, seawayFactor, shadowFactor, targetEnergyWs,
} from "../src/engine/index";
import { verticalPatternFactor } from "../src/core/seaway";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 2: The radar system, technical
 * principles. Expected values are the book's own figures, or worked by hand from its rules (shown in the
 * comments), never taken from the simulator. See docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

const C = 299_792_458; // m/s
const empty: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [], targets: [] };
const world = (band: "X" | "S" = "X"): World => {
  const w = createWorld(empty, 62);
  w.radar.controls.tuning = 62; // tuned
  w.radar.controls.gain = 50; // middle: the calibrated setting
  w.radar.controls.stc = 0;
  w.radar.controls.ftc = 0;
  w.radar.band = band;
  w.radar.shadowSectors = [];
  return w;
};
const strength = (w: World, rcs: number, rangeNm: number, relBearing = 90) =>
  effectiveSignal(w, { rcs, height: 10, rangeNm, relBearing, pos: { e: rangeNm, n: 0 }, kind: "ship" });
/** Furthest range at which the echo is painted on 8 scans in 10, found by bisection on the simulator's echo. */
const detectionRange = (w: World, rcs: number): number => {
  let lo = 0.5, hi = 15;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (strength(w, rcs, mid) >= DETECT_LEVEL_8_OF_10) lo = mid;
    else hi = mid;
  }
  return lo;
};

describe("2.3.2 frequencies", () => {
  it("X band within 9.2-9.5 GHz (about 3 cm), S band within 2.9-3.1 GHz (about 10 cm)", () => {
    expect(BAND_DATA.X.frequencyGHz).toBeGreaterThanOrEqual(9.2);
    expect(BAND_DATA.X.frequencyGHz).toBeLessThanOrEqual(9.5);
    expect(BAND_DATA.S.frequencyGHz).toBeGreaterThanOrEqual(2.9);
    expect(BAND_DATA.S.frequencyGHz).toBeLessThanOrEqual(3.1);
  });
  it("wavelength = speed of light / frequency", () => {
    for (const b of [BAND_DATA.X, BAND_DATA.S]) expect(b.wavelengthCm).toBeCloseTo((C / (b.frequencyGHz * 1e9)) * 100, 1);
  });
});

describe("2.3.3.1 and 2.3.3.2 pulse length and PRF", () => {
  it("pulse lengths within the book's 0.05 to 1.3 microseconds; PRFs between its 500 (long pulse) and 3000 per second", () => {
    for (const n of ["short", "medium", "long"] as const) {
      const p = pulseFor(6, n);
      expect(p.microseconds).toBeGreaterThanOrEqual(0.05);
      expect(p.microseconds).toBeLessThanOrEqual(1.3);
      expect(p.prfHz).toBeGreaterThanOrEqual(500);
      expect(p.prfHz).toBeLessThanOrEqual(3000);
    }
  });
  it("short pulses with a high PRF on the short scales, long pulses with a low PRF on the long scales (Table 2.3)", () => {
    const scales = [0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24, 48];
    for (let i = 1; i < scales.length; i++) {
      expect(pulseFor(scales[i]!).microseconds).toBeGreaterThanOrEqual(pulseFor(scales[i - 1]!).microseconds);
      expect(pulseFor(scales[i]!).prfHz).toBeLessThanOrEqual(pulseFor(scales[i - 1]!).prfHz);
    }
  });
  it("no minimum range shorter than half the pulse length: 1 microsecond is 300 m long, so at least 150 m", () => {
    for (const n of ["short", "medium", "long"] as const) expect(minRangeNm(6, n) * 1852).toBeGreaterThanOrEqual(pulseFor(6, n).microseconds * 150);
  });
});

describe("2.3.3.3 power and energy (the book's worked example)", () => {
  it("25 kW, 0.25 microseconds at 1000 Hz: mean power 6.25 W", () => {
    expect(meanPowerW(25_000, 0.25, 1000)).toBeCloseTo(6.25, 9);
  });
  it("24 rpm and a 1 degree beam: 144 degrees a second, 6.9 ms on the target, about 7 pulses", () => {
    expect(pulsesOnTarget(1, 1000, 24)).toBeCloseTo(1000 / 144, 9); // 6.94
  });
  it("effective energy about 43 mW s: 6.25 W x 6.9 ms", () => {
    expect(targetEnergyWs(25_000, 0.25, pulsesOnTarget(1, 1000, 24)) * 1000).toBeCloseTo(43.4, 1);
  });
  it("energy goes up with pulse length and with PRF: the simulator's long pulse puts 1.6 times the medium pulse's energy on a target", () => {
    // Hand: (1.2 us x 600 Hz) / (0.3 us x 1500 Hz) = 720 / 450 = 1.6; short: (0.07 x 3000) / 450 = 0.467.
    expect(pulseEnergyRatio(6, "long")).toBeCloseTo(1.6, 9);
    expect(pulseEnergyRatio(6, "short")).toBeCloseTo(210 / 450, 9);
    expect(pulseEnergyRatio(6, "medium")).toBe(1);
  });
  it("and the detection range goes with the fourth root of that energy", () => {
    const w = world();
    const rcs = rcsForDetectionRange(6);
    const auto = detectionRange(w, rcs);
    w.radar.controls.rangeNm = 6;
    w.radar.controls.pulse = "long";
    expect(detectionRange(w, rcs) / auto).toBeCloseTo(Math.pow(1.6, 0.25), 3); // 1.125
  });
});

describe("2.5.1.4 and 2.5.2 the aerial", () => {
  it("Example 2.1: a 2 degree beam at 9.4 GHz needs an aerial about 1.12 m wide (beamwidth = 70 x wavelength / width)", () => {
    expect((70 * 0.032) / 2).toBeCloseTo(1.12, 2);
  });
  it("Example 2.2: a 3.8 m S-band aerial at 9.87 cm gives about 1.82 degrees", () => {
    expect((70 * 0.0987) / 3.8).toBeCloseTo(1.82, 2);
  });
  it("the simulator's beamwidths (from a maker: 6.5 ft X-band and 12 ft S-band aerials) agree with that rule within 10%", () => {
    const rule = (wavelengthCm: number, feet: number) => (70 * wavelengthCm / 100) / (feet * 0.3048);
    expect(BAND_DATA.X.beamwidthDeg / rule(BAND_DATA.X.wavelengthCm, 6.5)).toBeGreaterThan(0.9);
    expect(BAND_DATA.X.beamwidthDeg / rule(BAND_DATA.X.wavelengthCm, 6.5)).toBeLessThan(1.1);
    expect(BAND_DATA.S.beamwidthDeg / rule(BAND_DATA.S.wavelengthCm, 12)).toBeGreaterThan(0.9);
    expect(BAND_DATA.S.beamwidthDeg / rule(BAND_DATA.S.wavelengthCm, 12)).toBeLessThan(1.1);
  });
  it("horizontal beamwidth under 2 degrees; vertical beamwidth at least 20 degrees, for rolling and pitching", () => {
    for (const b of [BAND_DATA.X, BAND_DATA.S]) {
      expect(b.beamwidthDeg).toBeLessThan(2);
      expect(b.verticalBeamwidthDeg).toBeGreaterThanOrEqual(20);
    }
  });
  it("rolling: at half the vertical beamwidth off the target, half the power is lost each way (a quarter left, 6 dB)", () => {
    const w = world();
    w.own.seaway = { rollDeg: 10, pitchDeg: 0, yawDeg: 0, heaveM: 0, rollPhase: 0, encounterPhase: 0 };
    expect(verticalPatternFactor(10, 20)).toBeCloseTo(0.25, 9);
    // The echo strength is the square root of the power left: 0.5 on the beam (rolled 10 degrees), 1 dead ahead.
    expect(seawayFactor(w, 90)).toBeCloseTo(0.5, 9);
    expect(seawayFactor(w, 0)).toBeCloseTo(1, 9);
  });
});

describe("2.6.1 the radar equation: echo power goes with 1 / R^4", () => {
  it("doubling the range leaves a sixteenth of the power (12 dB, 0.063)", () => {
    const w = world();
    const s3 = strength(w, 1, 3), s6 = strength(w, 1, 6);
    // The simulator's strength is the square root of the power (like a voltage).
    expect((s6 / s3) ** 2).toBeCloseTo(1 / 16, 9);
    expect(10 * Math.log10((s3 / s6) ** 2)).toBeCloseTo(12.04, 2);
  });
  it("half the power (a 3 dB loss) cuts the detection range to the fourth root of a half (0.84); twice the power gives 1.19 times", () => {
    const w = world();
    const rcs = rcsForDetectionRange(8);
    const full = detectionRange(w, rcs);
    expect(full).toBeCloseTo(8, 3);
    w.radar.performance = 0.5;
    expect(detectionRange(w, rcs) / full).toBeCloseTo(Math.pow(0.5, 0.25), 3);
    w.radar.performance = 0.1; // 10 dB
    expect(detectionRange(w, rcs) / full).toBeCloseTo(Math.pow(0.1, 0.25), 3); // 0.56
  });
  it("a land face of twice the cross-section is detected 1.19 times further off (fourth root of 2)", () => {
    const a = landFaceDetectionNm(100, 30, 8, 1.23);
    const b = landFaceDetectionNm(200, 30, 8, 1.23);
    expect(b / a).toBeCloseTo(Math.pow(2, 0.25), 9);
  });
});

describe("2.6.5.1 interference rejection", () => {
  it("costs weak echoes a little: with the placeholder 1 dB, the detection range is 0.944 of normal", () => {
    const w = world();
    const rcs = rcsForDetectionRange(8);
    const off = detectionRange(w, rcs);
    w.radar.controls.interferenceRejection = true;
    expect(IR_LOSS_DB).toBe(1);
    expect(detectionRange(w, rcs) / off).toBeCloseTo(Math.pow(10, -1 / 40), 3);
  });
});

describe("2.8.5 the paint of a point target", () => {
  it("1 microsecond is 150 m deep at any range; the width is one beamwidth, so it grows with range", () => {
    const c = { ...world().radar.controls, rangeNm: 12, pulse: "long" as const, echoStretch: false };
    const near = echoShape("X", c, 2, 0, 0);
    const far = echoShape("X", c, 10, 0, 0);
    expect(near.depthNm * 1852).toBeCloseTo(1.2 * 150, 6);
    expect(far.depthNm).toBeCloseTo(near.depthNm, 12);
    expect(near.arcDeg).toBeCloseTo(BAND_DATA.X.beamwidthDeg, 9);
    expect(far.arcDeg).toBeCloseTo(BAND_DATA.X.beamwidthDeg, 9);
  });
  it("wider than it is deep far off, deeper than it is wide close in (the book's 10 NM and 2 NM cases)", () => {
    const c = { ...world().radar.controls, rangeNm: 12, pulse: "long" as const, echoStretch: false };
    const widthM = (r: number) => r * 1852 * (echoShape("X", c, r, 0, 0).arcDeg * Math.PI) / 180;
    expect(widthM(10)).toBeGreaterThan(echoShape("X", c, 10, 0, 0).depthNm * 1852); // 398 m against 180 m
    expect(widthM(2)).toBeLessThan(echoShape("X", c, 2, 0, 0).depthNm * 1852); // 80 m against 180 m
  });
  it("bearing discrimination example: a 1.5 degree beam spans 485 m at 10 NM and 48.5 m at 1 NM", () => {
    expect(10 * 1852 * 1.5 * (Math.PI / 180)).toBeCloseTo(485, 0);
    expect(1 * 1852 * 1.5 * (Math.PI / 180)).toBeCloseTo(48.5, 1);
  });
  it("IMO: 40 m range discrimination and 2.5 degree bearing discrimination on the 1.5 NM scale and below", () => {
    for (const r of [0.25, 0.5, 0.75, 1.5]) expect(pulseFor(r).rangeDiscriminationNm * 1852).toBeLessThanOrEqual(40);
    expect(BAND_DATA.X.beamwidthDeg).toBeLessThanOrEqual(2.5);
    expect(BAND_DATA.S.beamwidthDeg).toBeLessThanOrEqual(2.5);
  });
});

describe("Table 2.1: X band and S band compared", () => {
  it("small targets return less on S band", () => {
    const x = world("X"), s = world("S");
    const buoy = (w: World) => effectiveSignal(w, { rcs: 0.1, height: 3, rangeNm: 2, relBearing: 90, pos: { e: 2, n: 0 }, kind: "buoy" });
    expect(buoy(s)).toBeLessThan(buoy(x));
  });
  it("less sea clutter on S band", () => {
    const x = world("X"), s = world("S");
    x.env.seaState = s.env.seaState = 5;
    expect(seaClutterProbability(s, 1, 90)).toBeLessThan(seaClutterProbability(x, 1, 90));
  });
  it("less rain clutter and less loss in rain on S band", () => {
    const x = world("X"), s = world("S");
    for (const w of [x, s]) w.env.rain = [{ center: { e: 3, n: 0 }, radius: 2, intensity: 0.3 }];
    expect(rainClutterProbability(s, { e: 3, n: 0 })).toBeLessThan(rainClutterProbability(x, { e: 3, n: 0 }));
    expect(strength(s, 1, 3) / strength(world("S"), 1, 3)).toBeGreaterThan(strength(x, 1, 3) / strength(world("X"), 1, 3));
  });
  it("the S-band beam is wider", () => {
    expect(BAND_DATA.S.beamwidthDeg).toBeGreaterThan(BAND_DATA.X.beamwidthDeg);
  });
});

describe("2.10.1 siting of the aerial", () => {
  it("the simulator's shadow sector (astern, the funnel) is clear of the arc from ahead to 22.5 degrees abaft either beam", () => {
    const w = createWorld(empty);
    for (const s of w.radar.shadowSectors) {
      for (let rel = s.from; rel <= s.to; rel += 0.5) expect(rel > 112.5 && rel < 247.5).toBe(true);
    }
  });
  it("a weak target (a buoy with no reflector) at 1 NM is lost in the shadow sector; a large ship there still shows", () => {
    const w = createWorld(empty, 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.gain = 50;
    w.radar.controls.stc = 0;
    expect(shadowFactor(w.radar, 180)).toBeLessThan(1);
    const sig = (detectNm: number) => effectiveSignal(w, { rcs: rcsForDetectionRange(detectNm), height: 5, rangeNm: 1, relBearing: 180, pos: { e: 0, n: -1 }, kind: "ship" });
    expect(sig(4.6)).toBeLessThan(DETECT_LEVEL_8_OF_10); // typical buoy of IMO Table 2
    expect(sig(11)).toBeGreaterThan(DETECT_LEVEL_8_OF_10); // ship over 5000 gt
  });
  it("aerial height within the book's best 13 to 20 m", () => {
    const w = createWorld(empty);
    expect(w.own.antennaHeight).toBeGreaterThanOrEqual(13);
    expect(w.own.antennaHeight).toBeLessThanOrEqual(20);
  });
});
