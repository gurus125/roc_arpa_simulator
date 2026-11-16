import { describe, expect, it } from "vitest";
import { analysePlot } from "../src/core/plot";

/**
 * A worked example from "Radar Navigation and Maneuvering Board Manual", Pub. 1310, seventh
 * edition (a United States government publication), chapter 3, Example 1: determination of the
 * closest point of approach. The answers are the book's, found by plotting on a manoeuvring board,
 * so the calculation is allowed the accuracy of such a plot.
 */
describe("Pub. 1310, chapter 3, Example 1: closest point of approach", () => {
  it("is reproduced within plotting accuracy", () => {
    // Own ship on course 070. Other ship M: 1000 bearing 050 at 9.0 miles; 1006 bearing 049 at 7.5; 1012 bearing 047 at 6.0.
    // Book: direction of relative movement 236, speed of relative movement 15 knots, CPA 0.9 mile bearing 326,
    // reached at 1036, which is 24 minutes after the last plot.
    const a = analysePlot(
      [{ timeMinutes: 0, bearing: 50, range: 9.0 }, { timeMinutes: 6, bearing: 49, range: 7.5 }, { timeMinutes: 12, bearing: 47, range: 6.0 }],
      { course: 70, speed: 15 },
    );
    expect(Math.abs(a.relativeCourseSpeed.course - 236)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.relativeCourseSpeed.speed - 15)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.cpa.cpa - 0.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a.cpa.tcpaMinutes! - 24)).toBeLessThanOrEqual(1);
    expect(a.cpa.opening).toBe(false);
    // The CPA lies at right angles to the relative movement line: 236 + 90 = 326.
    expect(Math.abs(((a.relativeCourseSpeed.course + 90) % 360) - 326)).toBeLessThanOrEqual(2);
  });
});

describe("Pub. 1310, chapter 3, Example 6: a contact dead in the water", () => {
  it("shows a relative movement opposite to own ship's course at about own ship's speed, and almost no true speed", () => {
    // Own ship 340 at 20 kn. 1200: 017 at 22.8 miles; 1218: 029 at 17.4; 1236: 046 at 14.4. The book's answer: the
    // relative movement line runs opposite to own ship's course, so the contact is dead in the water or a fixed
    // object, and "small observational and plotting errors will frequently indicate a small value of true speed".
    // (An independent straight-line fit of the three points gives relative movement 162.6 at 20.6 kn and a true speed of 1.1 kn.)
    const a = analysePlot(
      [{ timeMinutes: 0, bearing: 17, range: 22.8 }, { timeMinutes: 18, bearing: 29, range: 17.4 }, { timeMinutes: 36, bearing: 46, range: 14.4 }],
      { course: 340, speed: 20 },
    );
    expect(Math.abs(a.relativeCourseSpeed.course - 160)).toBeLessThanOrEqual(3);
    expect(Math.abs(a.relativeCourseSpeed.speed - 20)).toBeLessThanOrEqual(1);
    expect(a.targetTrue.speed).toBeLessThan(1.5);
    expect(a.targetTrue.speed).toBeCloseTo(1.11, 1);
  });
});

import { fromPolar } from "../src/core/vec";
import { trialManoeuvre } from "../src/core/trial";
import { bowCrossing } from "../src/core/bcr";
import { apparentWind, createWorld, unambiguousRangeNm } from "../src/engine/index";

/*
 * More worked answers from Pub. 1310, added on 16 Nov 2026 when the book was read chapter by chapter
 * (docs/BOOK-CHECK-PUB1310.md). Every expected value is the book's own answer, found by plotting, so each
 * is allowed plotting accuracy. Ranges given in yards use the manoeuvring board's 2,000 yards to the mile.
 */

describe("Pub. 1310, chapter 3, Example 5: course to pass astern at 3 miles (own ship the slower)", () => {
  it("starboard to 030 at 15 knots gives the book's 3.0 miles", () => {
    // Own ship 340 at 15 kn; other ship 249 at 25 kn; CPA 1.5 miles bearing 310 if nothing is done. Action when the
    // range is 6.0 miles. By hand: the direction of relative movement is 218.3, so the CPA bears 308.3; the angle at
    // own ship between the CPA and the other ship at 6.0 miles is acos(1.5 / 6.0) = 75.5, so she then bears 023.8.
    const r = trialManoeuvre(fromPolar(23.8, 6.0), { course: 340, speed: 15 }, { course: 249, speed: 25 }, { course: 30, speed: 15, delayMinutes: 0 });
    expect(Math.abs(r.cpa - 3.0)).toBeLessThanOrEqual(0.15);
    // Holding 340 she would pass at the book's 1.5 miles.
    const hold = trialManoeuvre(fromPolar(23.8, 6.0), { course: 340, speed: 15 }, { course: 249, speed: 25 }, { course: 340, speed: 15, delayMinutes: 0 });
    expect(Math.abs(hold.cpa - 1.5)).toBeLessThanOrEqual(0.05);
  });
});

describe("Pub. 1310, chapter 3, Example 8: closest point of approach from the geographical plot", () => {
  it("CPA 2.2 miles bearing 001", () => {
    // Own ship 000 at 10 kn. Other ship from own ship's successive positions: 0200 074 at 7.3; 0206 071 at 6.3; 0212 067 at 5.3.
    const a = analysePlot(
      [{ timeMinutes: 0, bearing: 74, range: 7.3 }, { timeMinutes: 6, bearing: 71, range: 6.3 }, { timeMinutes: 12, bearing: 67, range: 5.3 }],
      { course: 0, speed: 10 },
    );
    expect(Math.abs(a.cpa.cpa - 2.2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(((a.relativeCourseSpeed.course + 90) % 360) - 1)).toBeLessThanOrEqual(2);
  });
});

describe("Pub. 1310, chapter 6, manoeuvring board Example 2: course and speed of the other ship", () => {
  it("course 099, speed 27 knots, speed of relative movement 21 knots", () => {
    // Own ship 150 at 18 kn. Other ship: 1100 255 at 20,000 yards; 1107 260 at 15,700; 1114 270 at 11,200.
    const a = analysePlot(
      [{ timeMinutes: 0, bearing: 255, range: 10.0 }, { timeMinutes: 7, bearing: 260, range: 7.85 }, { timeMinutes: 14, bearing: 270, range: 5.6 }],
      { course: 150, speed: 18 },
    );
    expect(Math.abs(a.relativeCourseSpeed.speed - 21)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(a.targetTrue.course - 99)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.targetTrue.speed - 27)).toBeLessThanOrEqual(0.6);
  });
});

describe("Pub. 1310, chapter 6, manoeuvring board Example 6: course to pass ahead at 3,000 yards", () => {
  it("the other ship is on a collision course, steering 287 at 10 knots", () => {
    // Own ship 190 at 12 kn. Other ship: 1730 153 at 20,000 yards; 1736 153 at 16,700 yards.
    const a = analysePlot([{ timeMinutes: 0, bearing: 153, range: 10.0 }, { timeMinutes: 6, bearing: 153, range: 8.35 }], { course: 190, speed: 12 });
    expect(a.constantBearingDecreasingRange).toBe(true);
    expect(a.cpa.cpa).toBeLessThan(0.05);
    expect(Math.abs(a.relativeCourseSpeed.speed - 16.5)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a.targetTrue.course - 287)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.targetTrue.speed - 10)).toBeLessThanOrEqual(0.2);
  });
  it("altering to 212 when the range is 13,000 yards gives CPA 3,000 yards bearing 076, 28 minutes later", () => {
    const r = trialManoeuvre(fromPolar(153, 6.5), { course: 190, speed: 12 }, { course: 287, speed: 10 }, { course: 212, speed: 12, delayMinutes: 0 });
    expect(Math.abs(r.cpa - 1.5)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r.cpaBearing - 76)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(r.tcpaMinutes - 28)).toBeLessThanOrEqual(1);
  });
});

describe("Pub. 1310, chapter 6, manoeuvring board Example 10: true and relative wind", () => {
  it("a true wind from 315 at 20 knots is felt at 30 knots from 040 relative on a ship steering 240 at 18 knots", () => {
    const w = createWorld({ id: "w", name: "w", description: "", own: { heading: 240, speed: 18 }, env: { seaState: 0, wind: { from: 315, speedKn: 20 } }, coasts: [], targets: [] }, 62);
    const rw = apparentWind(w, 240, { e: 18 * Math.sin((240 * Math.PI) / 180), n: 18 * Math.cos((240 * Math.PI) / 180) })!;
    expect(Math.abs(rw.fromRel - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(rw.speedKn - 30)).toBeLessThanOrEqual(0.5);
  });
});

describe("Pub. 1310, chapter 4: a second-trace echo moves when the pulse repetition rate is changed", () => {
  it("shown at 7.5 miles at 2000 pulses a second and at 3 miles at 1800: the same true range of 48 miles", () => {
    // The true range is the range shown plus half the distance the wave travels between pulses.
    const at2000 = 7.5 + unambiguousRangeNm(2000);
    const at1800 = 3.0 + unambiguousRangeNm(1800);
    expect(at2000).toBeCloseTo(48, 0);
    expect(Math.abs(at2000 - at1800)).toBeLessThan(0.05);
  });
});

describe("Pub. 1310, appendix C, rapid radar plotting problem 2", () => {
  // Own ship 000 at 12 kn, 12-mile range scale. Contact: 0410 035 at 11.1; 0416 031 at 9.2; 0422 025 at 7.3.
  const obs = [{ timeMinutes: 0, bearing: 35, range: 11.1 }, { timeMinutes: 6, bearing: 31, range: 9.2 }, { timeMinutes: 12, bearing: 25, range: 7.3 }];
  const a = analysePlot(obs, { course: 0, speed: 12 });
  it("relative movement 234 at 20 knots; CPA 3.5 miles bearing 324 at 0441", () => {
    expect(Math.abs(a.relativeCourseSpeed.course - 234)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.relativeCourseSpeed.speed - 20)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(a.cpa.cpa - 3.5)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(a.cpa.tcpaMinutes! - 19)).toBeLessThanOrEqual(1);
  });
  it("true course 270 at 16 knots", () => {
    expect(Math.abs(a.targetTrue.course - 270)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.targetTrue.speed - 16)).toBeLessThanOrEqual(0.5);
  });
  it("the contact crosses dead ahead at 4.3 miles (the bow crossing range)", () => {
    // From the three plotted positions, fitted by hand: the last fitted position and the relative velocity.
    const last = fromPolar(25, 7.3);
    const bc = bowCrossing(last, a.relativeVelocity, 0)!;
    expect(Math.abs(bc.rangeNm - 4.3)).toBeLessThanOrEqual(0.1);
  });
});
