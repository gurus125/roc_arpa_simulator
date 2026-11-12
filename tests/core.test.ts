import { describe, expect, it } from "vitest";
import {
  analysePlot, applyLeeway, checkAnswer, classifyEncounter, computeCpa, courseToSteer, fromPolar,
  groundVelocity, normalizeDeg, relativeCourseSpeed, relativeVelocity, setAndDrift, trialManoeuvre,
  trueFromRelative, velocityOf, angleDiffDeg, bearingOf,
} from "../src/index";

/**
 * Reference values come from an independent Python script (and a brute-force time search),
 * not from the code under test.
 *
 * Worked example 1: own ship 000 at 12 kn. Target true course 270, speed 10 kn,
 * first seen bearing 045, range 6.0 NM.
 */
const own = { course: 0, speed: 12 };
const tgt = { course: 270, speed: 10 };
const r0 = fromPolar(45, 6.0);

describe("angles and vectors", () => {
  it("normalises and differences angles", () => {
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(725)).toBe(5);
    expect(angleDiffDeg(350, 10)).toBe(-20);
    expect(angleDiffDeg(10, 350)).toBe(20);
  });
  it("round-trips polar and cartesian", () => {
    for (const b of [0, 37, 90, 181, 270, 359]) {
      expect(bearingOf(fromPolar(b, 3.3))).toBeCloseTo(b, 9);
    }
    const v = velocityOf({ course: 90, speed: 10 });
    expect(v.e).toBeCloseTo(10, 9);
    expect(v.n).toBeCloseTo(0, 9);
  });
});

describe("relative motion and the vector triangle", () => {
  it("matches the worked example", () => {
    const rel = relativeCourseSpeed(own, tgt);
    expect(rel.course).toBeCloseTo(219.8056, 3);
    expect(rel.speed).toBeCloseTo(15.6205, 3);
  });
  it("recovers true course and speed from the relative vector", () => {
    const back = trueFromRelative(own, relativeVelocity(own, tgt));
    expect(back.course).toBeCloseTo(270, 9);
    expect(back.speed).toBeCloseTo(10, 9);
  });
});

describe("CPA and TCPA", () => {
  it("matches the worked example", () => {
    const r = computeCpa(r0, relativeVelocity(own, tgt));
    expect(r.cpa).toBeCloseTo(0.5432, 3);
    expect(r.tcpaMinutes).toBeCloseTo(22.952, 2);
    expect(r.cpaBearing).toBeCloseTo(129.806, 2);
    expect(r.opening).toBe(false);
    expect(r.currentRange).toBeCloseTo(6, 9);
  });
  it("head-on gives CPA 0", () => {
    const r = computeCpa({ e: 0, n: 5 }, relativeVelocity({ course: 0, speed: 10 }, { course: 180, speed: 10 }));
    expect(r.cpa).toBeCloseTo(0, 9);
    expect(r.tcpaMinutes).toBeCloseTo(15, 9);
  });
  it("reports opening targets with negative TCPA", () => {
    // Target 1 NM east, 2 NM north, moving due north at 5 kn: it passed abeam 24 minutes ago at 1 NM.
    const r = computeCpa({ e: 1, n: 2 }, { e: 0, n: 5 });
    expect(r.opening).toBe(true);
    expect(r.tcpaMinutes!).toBeCloseTo(-24, 9);
    expect(r.cpa).toBeCloseTo(1, 9);
    expect(r.cpaBearing).toBeCloseTo(90, 9);
  });
  it("handles no relative motion (same course and speed)", () => {
    const r = computeCpa({ e: 1, n: 1 }, { e: 0, n: 0 });
    expect(r.tcpaMinutes).toBeNull();
    expect(r.cpa).toBeCloseTo(Math.SQRT2, 9);
  });
  it("agrees with a brute-force time search on random closing encounters", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const pos = fromPolar(rnd() * 360, 1 + rnd() * 10);
      const o = { course: rnd() * 360, speed: 3 + rnd() * 20 };
      const t = { course: rnd() * 360, speed: 3 + rnd() * 20 };
      const rv = relativeVelocity(o, t);
      const a = computeCpa(pos, rv);
      if (a.opening || a.tcpaHours === null) continue;
      let best = Infinity;
      for (let h = 0; h <= 6; h += 0.0005) {
        best = Math.min(best, Math.hypot(pos.e + rv.e * h, pos.n + rv.n * h));
      }
      expect(a.cpa).toBeCloseTo(best, 2);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe("trial manoeuvre", () => {
  it("immediate turn to 040 (reference 1.811 NM at 17.20 min)", () => {
    const r = trialManoeuvre(r0, own, tgt, { course: 40, speed: 12, delayMinutes: 0 });
    expect(r.cpa).toBeCloseTo(1.8115, 3);
    expect(r.tcpaMinutes).toBeCloseTo(17.197, 2);
    expect(r.cpaBearing).toBeCloseTo(332.573, 1);
    expect(r.beforeManoeuvre).toBe(false);
  });
  it("same turn after a 3 minute delay (reference 1.509 NM at 18.03 min)", () => {
    const r = trialManoeuvre(r0, own, tgt, { course: 40, speed: 12, delayMinutes: 3 });
    expect(r.cpa).toBeCloseTo(1.5092, 3);
    expect(r.tcpaMinutes).toBeCloseTo(18.032, 2);
  });
  it("turn to 090 (reference 4.243 NM)", () => {
    const r = trialManoeuvre(r0, own, tgt, { course: 90, speed: 12, delayMinutes: 0 });
    expect(r.cpa).toBeCloseTo(4.2426, 3);
  });
  it("speed reduction to 6 kn after 2 minutes (reference 1.284 NM at 29.42 min)", () => {
    const r = trialManoeuvre(r0, own, tgt, { course: 0, speed: 6, delayMinutes: 2 });
    expect(r.cpa).toBeCloseTo(1.2837, 3);
    expect(r.tcpaMinutes).toBeCloseTo(29.419, 2);
  });
  it("a trial equal to present course and speed changes nothing", () => {
    const base = computeCpa(r0, relativeVelocity(own, tgt));
    const r = trialManoeuvre(r0, own, tgt, { course: 0, speed: 12, delayMinutes: 5 });
    expect(r.cpa).toBeCloseTo(base.cpa, 6);
    expect(r.tcpaMinutes).toBeCloseTo(base.tcpaMinutes!, 6);
  });
});

describe("COLREG hints (Rules 13-17)", () => {
  it("head-on", () => {
    const h = classifyEncounter({ e: 0, n: 5 }, { course: 0, speed: 10 }, { course: 180, speed: 10 });
    expect(h.situation).toBe("head-on");
    expect(h.ownRole).toBe("both-give-way");
    expect(h.rule).toBe(14);
  });
  it("crossing with target on own starboard: give way", () => {
    const h = classifyEncounter(fromPolar(45, 5), own, tgt);
    expect(h.situation).toBe("crossing");
    expect(h.ownRole).toBe("give-way");
    expect(h.rule).toBe(15);
  });
  it("crossing with target on own port: stand on", () => {
    const h = classifyEncounter(fromPolar(315, 5), own, { course: 90, speed: 10 });
    expect(h.situation).toBe("crossing");
    expect(h.ownRole).toBe("stand-on");
    expect(h.rule).toBe(17);
  });
  it("own ship overtaking", () => {
    const h = classifyEncounter({ e: 0, n: 1 }, { course: 0, speed: 15 }, { course: 0, speed: 8 });
    expect(h.situation).toBe("overtaking");
    expect(h.ownRole).toBe("give-way");
    expect(h.rule).toBe(13);
  });
  it("own ship overtaken", () => {
    const h = classifyEncounter({ e: 0, n: -1 }, { course: 0, speed: 8 }, { course: 0, speed: 15 });
    expect(h.situation).toBe("overtaken");
    expect(h.ownRole).toBe("stand-on");
  });
  it("nearly end-on beyond tolerance is crossing, not head-on", () => {
    const h = classifyEncounter(fromPolar(20, 5), own, { course: 200, speed: 10 });
    expect(h.situation).toBe("crossing");
  });
});

describe("current, set and drift, course to steer", () => {
  it("course to steer for track 000, STW 10, current 090 at 2 kn", () => {
    const s = courseToSteer(0, 10, { set: 90, drift: 2 })!;
    expect(s.heading).toBeCloseTo(348.463, 2);
    expect(s.speedOverGround).toBeCloseTo(9.798, 2);
    expect(s.allowance).toBeCloseTo(-11.537, 2);
  });
  it("round trip: steering that heading makes good the track", () => {
    const cur = { set: 135, drift: 1.7 };
    const s = courseToSteer(250, 11, cur)!;
    const g = groundVelocity(s.heading, 11, cur);
    expect(bearingOf(g)).toBeCloseTo(250, 6);
    expect(Math.hypot(g.e, g.n)).toBeCloseTo(s.speedOverGround, 6);
  });
  it("returns null when the current is too strong to hold the track", () => {
    expect(courseToSteer(0, 3, { set: 90, drift: 5 })).toBeNull();
  });
  it("finds set and drift from heading/STW and COG/SOG (reference 79.42, 1.855)", () => {
    const sd = setAndDrift({ course: 0, speed: 10 }, { course: 10, speed: 10.5 });
    expect(sd.set).toBeCloseTo(79.422, 2);
    expect(sd.drift).toBeCloseTo(1.855, 2);
  });
  it("applies leeway", () => {
    expect(applyLeeway(90, 5)).toBe(95);
    expect(applyLeeway(2, -5)).toBe(357);
  });
});

describe("manual plot analysis (ROC core)", () => {
  // Observations generated from the worked example (reference bearings and ranges).
  const obs = [
    { timeMinutes: 0, bearing: 45.0, range: 6.0 },
    { timeMinutes: 6, bearing: 46.82255812671838, range: 4.446614552294267 },
    { timeMinutes: 12, bearing: 50.592146529597585, range: 2.9025440484771785 },
  ];
  it("recovers relative motion, true motion, CPA and TCPA", () => {
    const a = analysePlot(obs, own);
    expect(a.relativeCourseSpeed.course).toBeCloseTo(219.806, 2);
    expect(a.relativeCourseSpeed.speed).toBeCloseTo(15.62, 2);
    expect(a.targetTrue.course).toBeCloseTo(270, 2);
    expect(a.targetTrue.speed).toBeCloseTo(10, 2);
    expect(a.cpa.cpa).toBeCloseTo(0.5432, 3);
    expect(a.cpa.tcpaMinutes).toBeCloseTo(22.952 - 12, 2);
    expect(a.riskOfCollision).toBe(true);
    expect(a.constantBearingDecreasingRange).toBe(false);
  });
  it("flags constant bearing, decreasing range", () => {
    const a = analysePlot(
      [
        { timeMinutes: 0, bearing: 0, range: 6 },
        { timeMinutes: 6, bearing: 0, range: 4 },
        { timeMinutes: 12, bearing: 0, range: 2 },
      ],
      { course: 0, speed: 10 },
    );
    expect(a.constantBearingDecreasingRange).toBe(true);
    expect(a.cpa.cpa).toBeCloseTo(0, 6);
    expect(a.targetTrue.course).toBeCloseTo(180, 6);
    expect(a.targetTrue.speed).toBeCloseTo(10, 6);
  });
  it("tolerates small observation errors", () => {
    const noisy = obs.map((o, i) => ({ ...o, bearing: o.bearing + (i - 1) * 0.3, range: o.range + (i === 1 ? 0.03 : 0) }));
    const a = analysePlot(noisy, own);
    expect(Math.abs(angleDiffDeg(a.targetTrue.course, 270))).toBeLessThan(5);
    expect(Math.abs(a.cpa.cpa - 0.5432)).toBeLessThan(0.3);
  });
  it("needs two observations at different times", () => {
    expect(() => analysePlot([obs[0]!], own)).toThrow();
    expect(() => analysePlot([obs[0]!, { ...obs[0]! }], own)).toThrow();
  });
});

describe("answer checking", () => {
  const correct = { relativeCourse: 219.8, relativeSpeed: 15.6, trueCourse: 270, trueSpeed: 10, cpa: 0.54, tcpaMinutes: 23 };
  it("accepts answers within tolerance, including across north", () => {
    const r = checkAnswer({ ...correct, relativeCourse: 221, trueCourse: 271 }, correct);
    expect(r.fractionCorrect).toBe(1);
    const n = checkAnswer({ ...correct, trueCourse: 359 }, { ...correct, trueCourse: 1 });
    expect(n.checks.find((c) => c.field === "trueCourse")!.ok).toBe(true);
  });
  it("marks wrong fields", () => {
    const r = checkAnswer({ ...correct, cpa: 1.5, tcpaMinutes: 40 }, correct);
    expect(r.fractionCorrect).toBeCloseTo(4 / 6, 9);
  });
});
