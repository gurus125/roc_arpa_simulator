import { describe, expect, it } from "vitest";
import { analysePlot } from "../src/core/plot";
import { trialManoeuvre } from "../src/core/trial";
import { collisionPoints } from "../src/core/pad";
import { computeCpa } from "../src/core/cpa";
import { courseToSteer, setAndDrift } from "../src/core/current";
import { add, angleDiffDeg, bearingOf, courseSpeedOf, length, scale, sub, velocityOf } from "../src/core/vec";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 7: Radar plotting, including
 * collision avoidance. The book's worked Examples 7.2 to 7.12 (7.1 is in bole.test.ts). The expected values
 * are the book's answers, read off its hand plots, so the tolerances are those of a hand plot: a degree or
 * two, a tenth or two of a mile, a minute or so. An independent calculation of each is in the comments.
 */

type Obs = { timeMinutes: number; bearing: number; range: number };
const near = (got: number, want: number, tol: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol);
const nearDeg = (got: number, want: number, tol: number) => expect(Math.abs(angleDiffDeg(got, want))).toBeLessThanOrEqual(tol);

/** The common target of Examples 7.3 to 7.6: own ship 000 at 12 kn; 0923 037 x 9.5, 0929 036 x 8.0, 0935 034 x 6.5. */
const EX3: Obs[] = [{ timeMinutes: 0, bearing: 37, range: 9.5 }, { timeMinutes: 6, bearing: 36, range: 8 }, { timeMinutes: 12, bearing: 34, range: 6.5 }];
const OWN3 = { course: 0, speed: 12 };

describe("Example 7.2: only the targets manoeuvre", () => {
  // Own ship 310 at 12 kn. A: 270 at 9.0, 7.5, 6.0 NM at 0923, 0929, 0935. B: 347 x 9.5, 346 x 8.0, 344 x 6.5.
  const own = { course: 310, speed: 12 };
  it("A: collision in 24 minutes, course 040, 10 kn (hand calculation: 037, 9.7 kn)", () => {
    const a = analysePlot([{ timeMinutes: 0, bearing: 270, range: 9 }, { timeMinutes: 6, bearing: 270, range: 7.5 }, { timeMinutes: 12, bearing: 270, range: 6 }], own);
    near(a.cpa.cpa, 0, 0.1);
    near(a.cpa.tcpaMinutes!, 24, 1);
    nearDeg(a.targetTrue.course, 40, 4);
    near(a.targetTrue.speed, 10, 0.5);
  });
  it("B: CPA 1.0 NM in 25 minutes, course 226, 10.5 kn", () => {
    const b = analysePlot([{ timeMinutes: 0, bearing: 347, range: 9.5 }, { timeMinutes: 6, bearing: 346, range: 8 }, { timeMinutes: 12, bearing: 344, range: 6.5 }], own);
    near(b.cpa.cpa, 1.0, 0.15);
    near(b.cpa.tcpaMinutes!, 25, 1.5);
    nearDeg(b.targetTrue.course, 226, 4);
    near(b.targetTrue.speed, 10.5, 1);
  });
  it("then A alters course about 50 degrees to starboard, keeping her speed (from the plots of 0947 and 0953)", () => {
    const a2 = analysePlot([{ timeMinutes: 0, bearing: 253, range: 2.8 }, { timeMinutes: 6, bearing: 206, range: 1.7 }], own);
    nearDeg(a2.targetTrue.course, 40 + 50, 8);
    near(a2.targetTrue.speed, 10, 1.5);
  });
  it("and B stops", () => {
    const b2 = analysePlot([{ timeMinutes: 0, bearing: 350, range: 4.0 }, { timeMinutes: 6, bearing: 4, range: 3.1 }], own);
    near(b2.targetTrue.speed, 0, 1.5);
  });
});

describe("Examples 7.3 to 7.6: own ship manoeuvres (each taken as instantaneous, as the book says)", () => {
  const tgt = analysePlot(EX3, OWN3).targetTrue;
  // The echo at 0935, the last plot: 034 x 6.5 NM.
  const p0935 = { e: 6.5 * Math.sin((34 * Math.PI) / 180), n: 6.5 * Math.cos((34 * Math.PI) / 180) };
  const tryIt = (course: number, speed: number, delayMinutes: number) => trialManoeuvre(p0935, OWN3, tgt, { course, speed, delayMinutes });
  /** Range and bearing of the echo at 0953 after a manoeuvre at 0941. */
  const at0953 = (course: number, speed: number) => {
    const rel1 = sub(velocityOf(tgt), velocityOf(OWN3));
    const rel2 = sub(velocityOf(tgt), velocityOf({ course, speed }));
    const p = add(add(p0935, scale(rel1, 6 / 60)), scale(rel2, 12 / 60));
    return { p, bearing: bearingOf(p), range: length(p) };
  };
  it("7.3: course 60 degrees to starboard at 0935: CPA 4.4 NM 13 min later; at 0941: 3.6 NM 10 min later; at 0953 the echo 334 x 3.8", () => {
    // Hand: 4.39 NM after 13.4 min; 3.57 NM after 9.9 min; 334.5 x 3.65.
    const now = tryIt(60, 12, 0);
    near(now.cpa, 4.4, 0.2);
    near(now.tcpaMinutes, 13, 1);
    const later = tryIt(60, 12, 6);
    near(later.cpa, 3.6, 0.2);
    near(later.tcpaMinutes - 6, 10, 1);
    const e = at0953(60, 12);
    nearDeg(e.bearing, 334, 2);
    near(e.range, 3.8, 0.2);
  });
  it("7.4: speed to 3 kn at 0935: CPA 4.8 NM 24.5 min later; at 0941: 3.9 NM 19 min later; at 0953 the echo 007 x 4.0", () => {
    // Hand: 4.61 NM after 25.9 min; 3.73 NM after 19.0 min; 007.5 x 3.92.
    const now = tryIt(0, 3, 0);
    near(now.cpa, 4.8, 0.25);
    near(now.tcpaMinutes, 24.5, 1.5);
    const later = tryIt(0, 3, 6);
    near(later.cpa, 3.9, 0.25);
    near(later.tcpaMinutes - 6, 19, 1);
    const e = at0953(0, 3);
    nearDeg(e.bearing, 7, 2);
    near(e.range, 4.0, 0.2);
  });
  it("7.5: 40 degrees to starboard and 6 kn at 0935: CPA 4.4 NM 20 min later; at 0941: 3.6 NM 14.5 min later; at 0953 the echo 355 x 3.6", () => {
    // Hand: 4.34 NM after 19.7 min; 3.53 NM after 14.5 min; 355.8 x 3.58.
    const now = tryIt(40, 6, 0);
    near(now.cpa, 4.4, 0.2);
    near(now.tcpaMinutes, 20, 1);
    const later = tryIt(40, 6, 6);
    near(later.cpa, 3.6, 0.2);
    near(later.tcpaMinutes - 6, 14.5, 1);
    const e = at0953(40, 6);
    nearDeg(e.bearing, 355, 2);
    near(e.range, 3.6, 0.2);
  });
  it("7.6: resuming the original course (7.3) or speed (7.4) at 0953 gives CPA 3.5 and 2.4 NM", () => {
    // Hand: 3.40 and 2.31 NM.
    const rel0 = sub(velocityOf(tgt), velocityOf(OWN3));
    near(computeCpa(at0953(60, 12).p, rel0).cpa, 3.5, 0.2);
    near(computeCpa(at0953(0, 3).p, rel0).cpa, 2.4, 0.2);
  });
});

describe("Example 7.7: predicted points of collision", () => {
  it("own ship 000 at 10 kn; the target 037 x 10.3, 036 x 8.5, 034 x 6.7: PPCs 337 x 4.4 NM and 270 x 18.0 NM", () => {
    // Hand: 338.0 x 4.40 and 270.0 x 16.6 NM (the far point moves a long way for a small change in the target's speed).
    const a = analysePlot([{ timeMinutes: 0, bearing: 37, range: 10.3 }, { timeMinutes: 6, bearing: 36, range: 8.5 }, { timeMinutes: 12, bearing: 34, range: 6.7 }], { course: 0, speed: 10 });
    const p0 = { e: 6.7 * Math.sin((34 * Math.PI) / 180), n: 6.7 * Math.cos((34 * Math.PI) / 180) };
    const ppc = collisionPoints(p0, velocityOf(a.targetTrue), 10).map((c) => ({ b: bearingOf(c.point), r: length(c.point) })).sort((x, y) => x.r - y.r);
    expect(ppc.length).toBe(2);
    nearDeg(ppc[0]!.b, 337, 2);
    near(ppc[0]!.r, 4.4, 0.2);
    nearDeg(ppc[1]!.b, 270, 2);
    near(ppc[1]!.r, 18.0, 2);
  });
});

/** Smallest alteration from `from`, turning `dir` (+1 starboard, -1 port), that gives at least `cpaNm` (or, with `towards`, at most). */
const alterationFor = (p: { e: number; n: number }, own: { course: number; speed: number }, tgt: { course: number; speed: number }, dir: 1 | -1, cpaNm: number, towards = false): number | null => {
  for (let k = 0.1; k <= 180; k += 0.1) {
    const c = (own.course + dir * k + 360) % 360;
    const r = trialManoeuvre(p, own, tgt, { course: c, speed: own.speed, delayMinutes: 0 });
    if (towards ? r.cpa <= cpaNm : r.cpa >= cpaNm) return c;
  }
  return null;
};

describe("Example 7.9: the alteration of course for a 2 NM CPA", () => {
  it("own ship 000 at 12 kn; the target steady on 045 at 11, 9 and 7 NM at 1000, 1010, 1020: alter to 027 at 1020", () => {
    // Hand: the smallest alteration to starboard is to 025.2.
    const a = analysePlot([{ timeMinutes: 0, bearing: 45, range: 11 }, { timeMinutes: 10, bearing: 45, range: 9 }, { timeMinutes: 20, bearing: 45, range: 7 }], { course: 0, speed: 12 });
    const p = { e: 7 * Math.SQRT1_2, n: 7 * Math.SQRT1_2 };
    const c = alterationFor(p, { course: 0, speed: 12 }, a.targetTrue, 1, 2)!;
    nearDeg(c, 27, 3);
  });
});

describe("Examples 7.10 and 7.11: a light vessel in a tidal stream", () => {
  // Own ship 310 at 15 kn. The light vessel bears 296 x 10.0, 290 x 8.6, 282 x 7.4 at 0900, 0906, 0912 (7.11 gives the
  // same bearings relative: 346, 340 and 332).
  const own = { course: 310, speed: 15 };
  const obs: Obs[] = [{ timeMinutes: 0, bearing: 296, range: 10 }, { timeMinutes: 6, bearing: 290, range: 8.6 }, { timeMinutes: 12, bearing: 282, range: 7.4 }];
  const a = analysePlot(obs, own);
  it("7.11 a: the tide sets 032 at 5 kn (hand: 031, 5.3 kn)", () => {
    // The light vessel is fixed: her apparent motion is own ship's motion over the ground, reversed.
    const overGround = courseSpeedOf(scale(a.relativeVelocity, -1));
    const tide = setAndDrift(own, overGround);
    nearDeg(tide.set, 32, 3);
    near(tide.drift, 5, 0.5);
  });
  it("7.11 b and 7.10: to pass her 2 NM off to port, alter to 278 at 0912, or to 258-260 at 0924", () => {
    // Hand: 276.8 at 0912 and 258.3 at 0924.
    const p0912 = { e: 7.4 * Math.sin((282 * Math.PI) / 180), n: 7.4 * Math.cos((282 * Math.PI) / 180) };
    const p0924 = add(p0912, scale(a.relativeVelocity, 12 / 60));
    nearDeg(alterationFor(p0912, own, a.targetTrue, -1, 2, true)!, 278, 3);
    nearDeg(alterationFor(p0924, own, a.targetTrue, -1, 2, true)!, 259, 3);
  });
});

describe("Example 7.12: the course to steer to counteract the tide", () => {
  // Own ship 090 at 16 kn; a beacon bears 076 x 10.0, 070 x 8.6, 062 x 7.4 at 0900, 0906, 0912. Anchor 2 NM due south of it.
  const own = { course: 90, speed: 16 };
  const a = analysePlot([{ timeMinutes: 0, bearing: 76, range: 10 }, { timeMinutes: 6, bearing: 70, range: 8.6 }, { timeMinutes: 12, bearing: 62, range: 7.4 }], own);
  const tide = setAndDrift(own, courseSpeedOf(scale(a.relativeVelocity, -1)));
  it("a: the tide sets 184 at 5 kn (hand: 182, 5.3 kn)", () => {
    nearDeg(tide.set, 184, 3);
    near(tide.drift, 5, 0.5);
  });
  it("b: at 0912 steer 060 (hand: 059.9)", () => {
    const beacon = { e: 7.4 * Math.sin((62 * Math.PI) / 180), n: 7.4 * Math.cos((62 * Math.PI) / 180) };
    const anchorage = add(beacon, { e: 0, n: -2 });
    const steer = courseToSteer(bearingOf(anchorage), 16, tide)!;
    nearDeg(steer.heading, 60, 2);
  });
  it("c: at 3 kn she cannot hold the track against a 5 kn tide and must stem it (steer about 004)", () => {
    const beacon = { e: 7.4 * Math.sin((62 * Math.PI) / 180), n: 7.4 * Math.cos((62 * Math.PI) / 180) };
    expect(courseToSteer(bearingOf(add(beacon, { e: 0, n: -2 })), 3, tide)).toBeNull();
    nearDeg((tide.set + 180) % 360, 4, 3);
  });
});
