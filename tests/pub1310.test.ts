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
