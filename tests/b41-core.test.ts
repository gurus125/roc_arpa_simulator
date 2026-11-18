import { describe, expect, it } from "vitest";
import { fixFromPositionLines, positionLineDirection, angleOfCut, PositionLine } from "../src/core/nav";
import { expandingSquare, sectorSearch, williamsonHeadings } from "../src/core/search";
import { TssScheme, tssArea, tssConduct, tssStrip } from "../src/core/tss";
import { length, sub, velocityOf } from "../src/core/vec";
import { computeCpa } from "../src/core/cpa";
import { pulseFor, prfChoices, pulseEnergyRatio, unambiguousRangeNm, randomTraffic, RANDOM_TRAFFIC_DEFAULT, seededRandom } from "../src/engine/index";

/*
 * Expected values here are worked by hand (3-4-5 triangles, equilateral triangles, the definition of each
 * quantity), not taken from the functions under test.
 */

describe("a fix from position lines", () => {
  // Own ship at the origin. A is at (3, 4): range 5, bearing atan(3/4) = 036.87. B is at (-6, 8): range 10, bearing 323.13.
  const A = { e: 3, n: 4 }, B = { e: -6, n: 8 };
  it("two ranges: the crossing nearer the dead reckoning", () => {
    const lines: PositionLine[] = [{ kind: "range", object: A, value: 5 }, { kind: "range", object: B, value: 10 }];
    const p = fixFromPositionLines(lines, { e: 0.4, n: -0.3 })!;
    expect(p.e).toBeCloseTo(0, 6);
    expect(p.n).toBeCloseTo(0, 6);
  });
  it("two circles cross twice: A (3, 4) and C (3, -4), both at 5 NM, cross at (0, 0) and at (6, 0)", () => {
    const lines: PositionLine[] = [{ kind: "range", object: A, value: 5 }, { kind: "range", object: { e: 3, n: -4 }, value: 5 }];
    const west = fixFromPositionLines(lines, { e: 1, n: 0.2 })!;
    const east = fixFromPositionLines(lines, { e: 5, n: 0.2 })!;
    expect(west.e).toBeCloseTo(0, 6);
    expect(west.n).toBeCloseTo(0, 6);
    expect(east.e).toBeCloseTo(6, 6);
    expect(east.n).toBeCloseTo(0, 6);
  });
  it("two bearings", () => {
    const lines: PositionLine[] = [{ kind: "bearing", object: A, value: 36.8699 }, { kind: "bearing", object: B, value: 323.1301 }];
    const p = fixFromPositionLines(lines, { e: 1, n: 1 })!;
    expect(p.e).toBeCloseTo(0, 4);
    expect(p.n).toBeCloseTo(0, 4);
  });
  it("a range of one object and a bearing of another", () => {
    const p = fixFromPositionLines([{ kind: "range", object: A, value: 5 }, { kind: "bearing", object: B, value: 323.1301 }], { e: 0.5, n: 0.5 })!;
    expect(length(p)).toBeLessThan(1e-4);
  });
  it("three ranges that do not quite meet: the point with the least squares of the misses", () => {
    // Objects due north, east and west at 10 NM, each range read 0.3 NM too long. By symmetry the east and west
    // errors cancel in the east direction; all three lines are 0.3 out along their own radius. Minimising
    // (n + 0.3)^2 for the north object (its line is n = -0.3) with the east and west circles, which near the origin
    // are the lines e = -0.3 and e = +0.3: the best e is 0 and the best n is -0.3 (to first order).
    const p = fixFromPositionLines([
      { kind: "range", object: { e: 0, n: 10 }, value: 10.3 }, { kind: "range", object: { e: 10, n: 0 }, value: 10.3 }, { kind: "range", object: { e: -10, n: 0 }, value: 10.3 },
    ], { e: 0.1, n: 0.1 })!;
    expect(p.e).toBeCloseTo(0, 6);
    expect(p.n).toBeCloseTo(-0.3, 1);
  });
  it("lines that run the same way give no fix; one line gives no fix", () => {
    expect(fixFromPositionLines([{ kind: "bearing", object: { e: 0, n: 5 }, value: 0 }, { kind: "bearing", object: { e: 0, n: 9 }, value: 0 }], { e: 0, n: 0 })).toBeNull();
    expect(fixFromPositionLines([{ kind: "range", object: A, value: 5 }], { e: 0, n: 0 })).toBeNull();
  });
  it("the angle of cut: a range circle runs at right angles to the bearing of its object", () => {
    // From the origin A bears 036.87: its range circle runs 126.87 there; a bearing line of B runs 323.13.
    const dA = positionLineDirection({ kind: "range", object: A, value: 5 }, { e: 0, n: 0 });
    expect(((dA % 180) + 180) % 180).toBeCloseTo(126.87, 1);
    // 323.13 is the same line as 143.13: 143.13 - 126.87 = 16.26 degrees.
    expect(angleOfCut(dA, 323.1301)).toBeCloseTo(16.26, 1);
    // The range and the bearing of one object always cut at 90.
    expect(angleOfCut(dA, 36.8699)).toBeCloseTo(90, 3);
  });
});

describe("search patterns", () => {
  it("expanding square, spacing 1 NM, first course north: legs 1, 1, 2, 2, 3, 3, turning to starboard", () => {
    const p = expandingSquare({ e: 0, n: 0 }, 0, 1, 6);
    const want = [[0, 0], [0, 1], [1, 1], [1, -1], [-1, -1], [-1, 2], [2, 2]];
    expect(p.length).toBe(7);
    p.forEach((q, i) => {
      expect(q.e).toBeCloseTo(want[i]![0]!, 9);
      expect(q.n).toBeCloseTo(want[i]![1]!, 9);
    });
  });
  it("expanding square from another datum on a first course of 090: the same shape turned", () => {
    const p = expandingSquare({ e: 5, n: 5 }, 90, 0.5, 4);
    const want = [[5, 5], [5.5, 5], [5.5, 4.5], [4.5, 4.5], [4.5, 5.5]];
    p.forEach((q, i) => {
      expect(q.e).toBeCloseTo(want[i]![0]!, 9);
      expect(q.n).toBeCloseTo(want[i]![1]!, 9);
    });
  });
  it("sector search, radius 2 NM, first course north: three equilateral triangles through the datum", () => {
    const h = Math.sqrt(3); // 2 sin 60
    const p = sectorSearch({ e: 0, n: 0 }, 0, 2);
    const want = [[0, 0], [0, 2], [h, 1], [-h, -1], [-h, 1], [h, -1], [0, -2], [0, 0]];
    expect(p.length).toBe(8);
    p.forEach((q, i) => {
      expect(q.e).toBeCloseTo(want[i]![0]!, 9);
      expect(q.n).toBeCloseTo(want[i]![1]!, 9);
    });
    // Every turning point is one radius from the datum, and the whole pattern is nine radii long.
    for (const q of p.slice(1, 7)) expect(length(q)).toBeCloseTo(2, 9);
    let total = 0;
    for (let i = 1; i < p.length; i++) total += length(sub(p[i]!, p[i - 1]!));
    expect(total).toBeCloseTo(18, 9);
  });
  it("Williamson turn from 350 for a casualty to port: 290 first, then steady on 170", () => {
    expect(williamsonHeadings(350, "port")).toEqual({ first: 290, reciprocal: 170 });
    expect(williamsonHeadings(350, "starboard")).toEqual({ first: 50, reciprocal: 170 });
  });
});

describe("a traffic separation scheme", () => {
  // Axis from (0, 0) north to (0, 10); separation zone 0.5 NM either side; lanes 2 NM wide.
  const t: TssScheme = { name: "T", a: { e: 0, n: 0 }, b: { e: 0, n: 10 }, zoneHalfWidthNm: 0.5, laneWidthNm: 2 };
  it("the northbound lane is east of the zone, the southbound lane west of it", () => {
    expect(tssArea({ e: 1.5, n: 5 }, t)).toEqual({ area: "lane-ab", flow: 0 });
    expect(tssArea({ e: -1.5, n: 5 }, t)).toEqual({ area: "lane-ba", flow: 180 });
    expect(tssArea({ e: 0.3, n: 5 }, t).area).toBe("zone");
    expect(tssArea({ e: 2.6, n: 5 }, t).area).toBe("outside");
    expect(tssArea({ e: 1.5, n: -0.1 }, t).area).toBe("outside");
    expect(tssArea({ e: 1.5, n: 10.1 }, t).area).toBe("outside");
  });
  it("conduct: with the flow, crossing, against it, in the zone", () => {
    expect(tssConduct({ e: 1.5, n: 5 }, 10, t)).toBe("with-flow");
    expect(tssConduct({ e: 1.5, n: 5 }, 270, t)).toBe("crossing");
    expect(tssConduct({ e: 1.5, n: 5 }, 185, t)).toBe("against-flow");
    expect(tssConduct({ e: -1.5, n: 5 }, 185, t)).toBe("with-flow");
    expect(tssConduct({ e: 0, n: 5 }, 0, t)).toBe("in-zone");
    expect(tssConduct({ e: 9, n: 5 }, 0, t)).toBe("outside");
  });
  it("the corners of the northbound lane", () => {
    expect(tssStrip(t, 0.5, 2.5)).toEqual([{ e: 0.5, n: 0 }, { e: 0.5, n: 10 }, { e: 2.5, n: 10 }, { e: 2.5, n: 0 }]);
  });
});

describe("pulse repetition frequency chosen by hand", () => {
  it("the range measured without ambiguity is c / (2 PRF): 80.9 NM at 1000 a second, 27.0 NM at 3000", () => {
    // 299,792.458 km/s / 2000 = 149.896 km = 80.94 NM; / 6000 = 49.965 km = 26.98 NM.
    expect(unambiguousRangeNm(1000)).toBeCloseTo(80.94, 1);
    expect(unambiguousRangeNm(3000)).toBeCloseTo(26.98, 1);
  });
  it("a PRF is offered only while pulse length x PRF stays within the long pulse's 1.2 us x 600", () => {
    // Duty limit 720 (us x Hz). Short 0.07 us: 3000 gives 210. Medium 0.3 us: 1500 gives 450, 3000 gives 900. Long 1.2 us: 1000 gives 1200.
    expect(prfChoices("short")).toEqual([600, 1000, 1500, 3000]);
    expect(prfChoices("medium")).toEqual([600, 1000, 1500]);
    expect(prfChoices("long")).toEqual([600]);
  });
  it("a chosen PRF replaces the pulse's own, and one that is not allowed is ignored", () => {
    expect(pulseFor(6, "medium").prfHz).toBe(1500);
    expect(pulseFor(6, "medium", 600).prfHz).toBe(600);
    expect(pulseFor(6, "medium", 3000).prfHz).toBe(1500);
    expect(pulseFor(24, "auto", 1000).prfHz).toBe(600);
  });
  it("the energy on a target goes with the PRF: the medium pulse at 600 instead of 1500 gives 0.4 of it", () => {
    expect(pulseEnergyRatio(6, "medium", 600)).toBeCloseTo(0.4, 9);
    expect(pulseEnergyRatio(6, "medium")).toBeCloseTo(1, 9);
  });
});

describe("random traffic", () => {
  const own = { pos: { e: 2, n: -3 }, course: 40, speed: 12 };
  const o = { ...RANDOM_TRAFFIC_DEFAULT, count: 15, threats: 4, minNm: 3, maxNm: 10 };
  it("the same seed gives the same ships; another seed gives others", () => {
    expect(randomTraffic(own, o, 77, 1)).toEqual(randomTraffic(own, o, 77, 1));
    expect(randomTraffic(own, o, 78, 1)).not.toEqual(randomTraffic(own, o, 77, 1));
  });
  it("gives the number asked for, numbered from the first id, inside the ring", () => {
    const ships = randomTraffic(own, o, 5, 30);
    expect(ships.length).toBe(15);
    expect(ships.map((s) => s.id)).toEqual(Array.from({ length: 15 }, (_, i) => 30 + i));
    for (const s of ships.slice(4)) {
      const r = length(sub(s.pos, own.pos));
      expect(r).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(r).toBeLessThanOrEqual(10 + 1e-9);
    }
  });
  it("the threats pass within the distance set, in the time set, if nobody acts", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const s of randomTraffic(own, o, seed, 1).slice(0, 4)) {
        const r = computeCpa(sub(s.pos, own.pos), sub(velocityOf({ course: s.course, speed: s.speed }), velocityOf({ course: own.course, speed: own.speed })));
        expect(r.cpa).toBeLessThanOrEqual(o.threatCpaNm + 1e-6);
        expect(r.tcpaMinutes!).toBeGreaterThanOrEqual(o.threatTcpaMin[0] - 1e-6);
        expect(r.tcpaMinutes!).toBeLessThanOrEqual(o.threatTcpaMin[1] + 1e-6);
      }
    }
  });
  it("the generator's numbers lie from 0 up to 1 and are spread", () => {
    const r = seededRandom(9);
    const xs = Array.from({ length: 2000 }, () => r());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});
