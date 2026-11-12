import { describe, expect, it } from "vitest";
import { analysePlot } from "../src/core/plot";
import { bowCrossing } from "../src/core/bcr";

/**
 * Worked examples from a published radar plotting text (answers there are graphical, so the
 * comparison tolerances are those of a plotting sheet), plus exact values from an independent
 * Python calculation done with the same inputs.
 */
describe("book worked example 1 (chapter 36)", () => {
  // Own ship 340 at 15 kn. 0800: target 020 at 12 M. 0812: 017 at 9 M.
  const r = analysePlot(
    [{ timeMinutes: 0, bearing: 20, range: 12 }, { timeMinutes: 12, bearing: 17, range: 9 }],
    { course: 340, speed: 15 },
  );

  it("agrees with the book answers to plotting-sheet accuracy", () => {
    expect(r.cpa.cpa).toBeGreaterThan(1.8); // book: 1.9 M
    expect(r.cpa.cpa).toBeLessThan(2.0);
    expect(Math.abs(r.cpa.tcpaMinutes! - 35)).toBeLessThan(1); // book: 35 min after 0812
    expect(Math.abs(r.targetTrue.course - 273)).toBeLessThan(1);
    expect(Math.abs(r.targetTrue.speed - 12.5)).toBeLessThan(0.2);
  });

  it("matches the exact independent (Python) values", () => {
    expect(r.targetTrue.course).toBeCloseTo(273.4238, 3);
    expect(r.targetTrue.speed).toBeCloseTo(12.5171, 3);
    expect(r.cpa.cpa).toBeCloseTo(1.85385, 4);
    expect(r.cpa.tcpaMinutes!).toBeCloseTo(34.6626, 3);
  });
});

describe("bow crossing range and time", () => {
  it("hand case: own ship north; target 3 E, 6 N moving (-6, -6) kn crosses the bow at 3 NM after 30 min", () => {
    // Crossing line is e = 0: t = 3/6 = 0.5 h, position (0, 6 - 3) = (0, 3).
    const b = bowCrossing({ e: 3, n: 6 }, { e: -6, n: -6 }, 0)!;
    expect(b.rangeNm).toBeCloseTo(3, 9);
    expect(b.minutes).toBeCloseTo(30, 9);
  });

  it("crossing astern or already past gives null", () => {
    expect(bowCrossing({ e: 3, n: -6 }, { e: -6, n: -6 }, 0)).toBeNull(); // crosses astern
    expect(bowCrossing({ e: -3, n: 6 }, { e: -6, n: -6 }, 0)).toBeNull(); // moving away from the line
    expect(bowCrossing({ e: 3, n: 6 }, { e: 0, n: -6 }, 0)).toBeNull(); // parallel track
  });

  it("matches a brute-force search along the relative track (own course 037)", () => {
    const own = 37;
    const r = { e: 5.0, n: 3.0 };
    const v = { e: -9.0, n: -1.5 };
    const u = { e: Math.sin((own * Math.PI) / 180), n: Math.cos((own * Math.PI) / 180) };
    let found: { range: number; min: number } | null = null;
    let prev = r.e * u.n - r.n * u.e; // cross product = signed distance from the course line
    const dt = 1e-5;
    for (let i = 1; i < 200000; i++) {
      const t = i * dt;
      const p = { e: r.e + v.e * t, n: r.n + v.n * t };
      const cr = p.e * u.n - p.n * u.e;
      if (Math.sign(cr) !== Math.sign(prev) && p.e * u.e + p.n * u.n > 0) {
        found = { range: Math.hypot(p.e, p.n), min: t * 60 };
        break;
      }
      prev = cr;
    }
    const b = bowCrossing(r, v, own)!;
    expect(found).not.toBeNull();
    // Independent Python calculation of the same case: 3.10263 NM after 20.8853 min.
    expect(found!.range).toBeCloseTo(3.10263, 3);
    expect(b.rangeNm).toBeCloseTo(found!.range, 3);
    expect(b.minutes).toBeCloseTo(found!.min, 3);
  });
});
