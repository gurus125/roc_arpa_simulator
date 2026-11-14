import { describe, expect, it } from "vitest";
import { angleOfCut } from "../src/core/nav";
import { ROC_PLACEHOLDERS } from "../src/roc/evaluate";
import { ARPA_PLACEHOLDERS, antennaTiltErrorDeg, rollParallax } from "../src/arpa/index";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapters 8 (navigation techniques) and 9 (ARPA
 * accuracy and errors). Expected values are the book's figures or worked by hand. See
 * docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

describe("8.3 position fixing", () => {
  it("8.3.1.2: lines cutting at less than 30 degrees are avoided; the simulator warns below 30", () => {
    expect(ROC_PLACEHOLDERS.minAngleOfCut).toBe(30);
    expect(angleOfCut(0, 90)).toBe(90);
    expect(angleOfCut(10, 170)).toBe(20); // 160 degrees apart: the lines cross at 20
    expect(angleOfCut(350, 20)).toBe(30);
  });
  it("8.3.2: ranges are better than bearings: 1% of 12 NM is 222 m, while 2.5 degrees at 12 NM spans about 970 m", () => {
    expect(0.01 * 12 * 1852).toBeCloseTo(222, 0);
    expect(12 * 1852 * (2.5 * Math.PI) / 180).toBeCloseTo(970, -1);
  });
});

describe("9.4 errors generated in the radar installation", () => {
  it("9.4.2.2: antenna tilt: 7.5 degrees of roll gives about 0.25 degrees of bearing error at 45 degrees off the bow, none ahead or abeam", () => {
    // Exact: 45 - atan(tan 45 cos 7.5) = 0.246 degrees.
    const exact = 45 - (Math.atan(Math.tan((45 * Math.PI) / 180) * Math.cos((7.5 * Math.PI) / 180)) * 180) / Math.PI;
    expect(Math.abs(antennaTiltErrorDeg(45, 7.5, 0))).toBeCloseTo(exact, 2);
    expect(antennaTiltErrorDeg(0, 7.5, 0)).toBeCloseTo(0, 12);
    expect(antennaTiltErrorDeg(90, 7.5, 0)).toBeCloseTo(0, 12);
    // Quadrantal: opposite signs at 45 and 135; the same for a roll either way (it goes with the square).
    expect(Math.sign(antennaTiltErrorDeg(45, 7.5, 0))).toBe(-Math.sign(antennaTiltErrorDeg(135, 7.5, 0)));
    expect(antennaTiltErrorDeg(45, -7.5, 0)).toBeCloseTo(antennaTiltErrorDeg(45, 7.5, 0), 12);
  });
  it("9.4.2.3: parallax from the roll: (180 / pi) H sin(roll) cos(bearing) / R degrees, greatest ahead and astern", () => {
    // Aerial 18 m above the roll axis, rolled 10 degrees, target dead ahead at 1 NM: 57.296 x 18 x 0.17365 / 1852 = 0.0967 degrees.
    const ahead = rollParallax(0, 10, 1, 18);
    expect(Math.abs(ahead.bearingDeg)).toBeCloseTo((180 / Math.PI) * 18 * Math.sin((10 * Math.PI) / 180) / 1852, 6);
    expect(ahead.rangeNm).toBeCloseTo(0, 12);
    expect(rollParallax(90, 10, 1, 18).bearingDeg).toBeCloseTo(0, 12);
  });
  it("9.4.3.1: range change from the roll: H sin(roll) sin(bearing), greatest abeam", () => {
    // 18 x sin 10 = 3.13 m on the beam.
    expect(Math.abs(rollParallax(90, 10, 1, 18).rangeNm * 1852)).toBeCloseTo(18 * Math.sin((10 * Math.PI) / 180), 6);
  });
  it("9.4.1: glint along the target's length; the simulator uses IEC's 30 m for a 200 m ship, the book a sixth of the length (33 m)", () => {
    expect(ARPA_PLACEHOLDERS.scintillationNm * 1852).toBeGreaterThan(25);
    expect(ARPA_PLACEHOLDERS.scintillationNm * 1852).toBeLessThan(200 / 6 * 1.1);
  });
  it("9.4.5: a log error of 0.4 kn moves a plot 15.5 m in 75 s", () => {
    expect(((0.4 * 75) / 3600) * 1852).toBeCloseTo(15.4, 1);
  });
});
