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
    expect(aspectFactor(90)).toBeCloseTo(1.4, 9);
    expect(aspectFactor(0)).toBeCloseTo(0.6, 9);
    expect(aspectFactor(180)).toBeCloseTo(0.6, 9);
    expect(aspectFactor(270)).toBeCloseTo(1.4, 9);
  });
  it("higher land paints further inland", () => {
    expect(landDepthNm(0)).toBeCloseTo(0.1, 9);
    expect(landDepthNm(60)).toBeCloseTo(0.5, 9);
    expect(landDepthNm(300)).toBeCloseTo(0.5, 9);
    expect(landDepthNm(30)).toBeCloseTo(0.3, 9);
  });
});
