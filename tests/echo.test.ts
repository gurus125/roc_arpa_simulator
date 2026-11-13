import { describe, expect, it } from "vitest";
import { aspectFactor, echoShape, landDepthNm, targetExtents } from "../src/engine/index";

const controls = (rangeNm: number, pulse?: "short" | "medium" | "long") => ({ rangeNm, gain: 50, tuning: 50, stc: 0, ftc: 0, brilliance: 70, ...(pulse ? { pulse } : {}) });
const NM = 1852;

describe("shape of a painted echo (worked by hand)", () => {
  it("a 210 m ship is 210 m across the line of sight beam-on and 30 m end-on (beam = length / 7)", () => {
    expect(targetExtents(210, 90).acrossM).toBeCloseTo(210, 6);
    expect(targetExtents(210, 90).alongM).toBeCloseTo(30, 6);
    expect(targetExtents(210, 0).acrossM).toBeCloseTo(30, 6);
    expect(targetExtents(210, 0).alongM).toBeCloseTo(210, 6);
  });
  it("a point target paints one beamwidth wide and half a pulse length deep", () => {
    // Maker's figures (Furuno FAR-21x7 series): X band 1.23 deg (6.5 ft radiator), S band 1.8 deg (12 ft);
    // medium pulse 0.3 microseconds = 0.3 x 150 m = 45 m.
    const s = echoShape("X", controls(6), 4);
    expect(s.arcDeg).toBeCloseTo(1.23, 9);
    expect(s.depthNm).toBeCloseTo(45 / NM, 9);
    expect(echoShape("S", controls(6), 4).arcDeg).toBeCloseTo(1.8, 9); // 10 cm radar: wider beam, even with a 12 ft radiator
  });
  it("beam-on at 6 NM, a 210 m ship adds 1.08 deg to the beamwidth and 30 m to the depth", () => {
    // 210 m at 6 NM (11112 m) spans atan(210/11112) = 1.083 deg.
    const s = echoShape("X", controls(6), 6, 210, 90);
    expect(s.arcDeg).toBeCloseTo(1.23 + (210 / (6 * NM)) * (180 / Math.PI), 6);
    expect(s.arcDeg).toBeCloseTo(2.313, 2);
    expect(s.depthNm).toBeCloseTo((45 + 30) / NM, 9);
  });
  it("end-on, the same ship paints narrow and deep", () => {
    const s = echoShape("X", controls(6), 6, 210, 0);
    expect(s.arcDeg).toBeCloseTo(1.23 + (30 / (6 * NM)) * (180 / Math.PI), 6);
    expect(s.depthNm).toBeCloseTo((45 + 210) / NM, 9);
  });
  it("range discrimination: a long pulse (1.2 microseconds) paints 180 m deep, a short pulse 10.5 m", () => {
    expect(echoShape("X", controls(6, "long"), 4).depthNm).toBeCloseTo(180 / NM, 9);
    expect(echoShape("X", controls(6, "short"), 4).depthNm).toBeCloseTo(10.5 / NM, 9);
    // Two point targets 60 m apart on one bearing: one echo on long pulse, two on short pulse.
    expect(echoShape("X", controls(6, "long"), 4).depthNm * NM).toBeGreaterThan(60);
    expect(echoShape("X", controls(6, "short"), 4).depthNm * NM).toBeLessThan(60);
  });
  it("bearing discrimination: at 6 NM a 1.23 deg beam is 239 m wide, so targets 200 m apart at one range merge", () => {
    const widthM = 6 * NM * ((echoShape("X", controls(6), 6).arcDeg * Math.PI) / 180);
    expect(widthM).toBeCloseTo(238.5, 0); // 11112 m x 1.23 deg in radians
    expect(widthM).toBeGreaterThan(200);
  });
  it("echo stretch enlarges the paint in range", () => {
    expect(echoShape("X", { ...controls(6), echoStretch: true }, 4).depthNm).toBeCloseTo((45 / NM) * 1.8, 9);
  });
  it("aspect: beam-on returns more than end-on", () => {
    // IEC 62388 Table D.1, largest / smallest cross-section of the 18 ships: 5, 34, 46, 10.9, 1.4, 5.5, 7.5,
    // 20.8, 1.55, 3.26, 20.8, 7.9, 23.3, 27, 13.3, 7.2, 17.8, 100; median (10.9 + 13.3) / 2 = 12.1.
    const ratios = [10 / 2, 680 / 20, 2300 / 50, 3500 / 320, 1400 / 1000, 5500 / 1000, 2100 / 280, 100000 / 4800, 17000 / 11000, 14000 / 4300, 11000 / 530, 11000 / 1400, 14000 / 600, 27000 / 1000, 24000 / 1800, 72000 / 10000, 890000 / 50000, 1700000 / 17000].sort((x, y) => x - y);
    expect((ratios[8]! + ratios[9]!) / 2).toBeCloseTo(12.1, 1);
    // In echo strength sqrt(12) = 3.4641, averaging 1: a (1 + 2.4641 x 2/pi) = 1, a = 1 / 2.56870 = 0.38930; beam-on 1.34858.
    expect(aspectFactor(0)).toBeCloseTo(0.3893, 4);
    expect(aspectFactor(180)).toBeCloseTo(0.3893, 4);
    expect(aspectFactor(90)).toBeCloseTo(1.3486, 4);
    expect(aspectFactor(270)).toBeCloseTo(1.3486, 4);
    expect(aspectFactor(90) / aspectFactor(0)).toBeCloseTo(Math.sqrt(12), 9);
    let mean = 0;
    for (let a = 0; a < 360; a += 0.01) mean += aspectFactor(a) / 36000;
    expect(mean).toBeCloseTo(1, 3);
  });
  it("higher land paints further inland", () => {
    expect(landDepthNm(0)).toBeCloseTo(0.1, 9);
    expect(landDepthNm(60)).toBeCloseTo(0.5, 9);
    expect(landDepthNm(300)).toBeCloseTo(0.5, 9);
    expect(landDepthNm(30)).toBeCloseTo(0.3, 9);
  });
});

describe("Echo width from the vessel's real proportions", () => {
  it("a catalogue vessel paints its typical beam end-on; a vessel of no type a seventh of its length", async () => {
    const { TARGET_TYPES, TYPICAL_BEAM_M, targetFromType } = await import("../src/engine/index");
    const panamax = targetFromType(TARGET_TYPES.find((t) => t.id === "bulk-panamax")!);
    expect(panamax.beamM).toBe(32.3); // the Panama Canal's old lock limit, the class's beam
    expect(targetExtents(panamax.lengthM!, 0, panamax.beamM).acrossM).toBeCloseTo(32.3, 9);
    expect(targetExtents(225, 0).acrossM).toBeCloseTo(225 / 7, 9);
    // Every moving catalogue type has a beam, narrower than its length.
    for (const t of TARGET_TYPES.filter((x) => x.lengthM > 0)) {
      expect(TYPICAL_BEAM_M[t.id], t.id).toBeGreaterThan(0);
      expect(TYPICAL_BEAM_M[t.id]!, t.id).toBeLessThan(t.lengthM);
    }
  });
});
