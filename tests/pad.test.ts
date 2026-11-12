import { describe, expect, it } from "vitest";
import { collisionPoints, dangerAreas } from "../src/core/pad";
import { computeCpa } from "../src/core/cpa";
import { sub, velocityOf } from "../src/core/vec";

describe("PPC: potential points of collision (expected values worked by hand)", () => {
  it("head-on at equal speed: half way", () => {
    // Target 10 NM due north steering 180 at 10 kn, own 10 kn: closing 20 kn, meet in 0.5 h, 5 NM ahead.
    const p = collisionPoints({ e: 0, n: 10 }, velocityOf({ course: 180, speed: 10 }), 10);
    expect(p).toHaveLength(1);
    expect(p[0]!.tHours).toBeCloseTo(0.5, 6);
    expect(p[0]!.point.e).toBeCloseTo(0, 6);
    expect(p[0]!.point.n).toBeCloseTo(5, 6);
    expect(p[0]!.course).toBeCloseTo(0, 6);
  });
  it("crossing: a 3-4-5 triangle", () => {
    // Target 6 NM due east steering 000 at 6 kn; own 10 kn. After 0.75 h the target is 4.5 NM north of
    // its start: the point (6, 4.5) is 7.5 NM from own ship = 10 kn x 0.75 h. Course = atan(6/4.5) = 053.13.
    const p = collisionPoints({ e: 6, n: 0 }, velocityOf({ course: 0, speed: 6 }), 10);
    expect(p).toHaveLength(1);
    expect(p[0]!.tHours).toBeCloseTo(0.75, 6);
    expect(p[0]!.point.e).toBeCloseTo(6, 6);
    expect(p[0]!.point.n).toBeCloseTo(4.5, 6);
    expect(p[0]!.course).toBeCloseTo(53.13, 2);
  });
  it("own ship slower than the target: two points", () => {
    // Target 10 NM north steering 180 at 10 kn; own 6 kn. Meeting: 10 - 10t = 6t -> t = 0.625 h, 3.75 NM north.
    // Being overtaken while running away south: 10t - 10 = 6t -> t = 2.5 h, 15 NM south.
    const p = collisionPoints({ e: 0, n: 10 }, velocityOf({ course: 180, speed: 10 }), 6);
    expect(p).toHaveLength(2);
    expect(p[0]!.tHours).toBeCloseTo(0.625, 6);
    expect(p[0]!.point.n).toBeCloseTo(3.75, 6);
    expect(p[1]!.tHours).toBeCloseTo(2.5, 6);
    expect(p[1]!.point.n).toBeCloseTo(-15, 6);
  });
  it("faster target moving away: none", () => {
    expect(collisionPoints({ e: 0, n: 5 }, velocityOf({ course: 0, speed: 15 }), 10)).toHaveLength(0);
  });
});

describe("PAD: predicted area of danger (simplified hexagon)", () => {
  const rel = { e: 6, n: 0 };
  const tv = velocityOf({ course: 0, speed: 6 });
  const areas = dangerAreas(rel, tv, 10, 1);
  it("one area round the one PPC, 2 NM wide across the target's track", () => {
    expect(areas).toHaveLength(1);
    const a = areas[0]!;
    expect(a.ppc.point.n).toBeCloseTo(4.5, 6);
    // Target track runs north along e = 6: the hexagon's side corners are at e = 5 and e = 7.
    const es = a.outline.map((p) => p.e);
    expect(Math.min(...es)).toBeCloseTo(5, 6);
    expect(Math.max(...es)).toBeCloseTo(7, 6);
  });
  it("the two bounding courses each give exactly the miss distance, and lie either side of the collision course", () => {
    const a = areas[0]!;
    for (const c of a.courses) {
      const r = computeCpa(rel, sub(tv, velocityOf({ course: c, speed: 10 })));
      expect(r.cpa).toBeCloseTo(1, 3);
      expect(r.tcpaHours!).toBeGreaterThan(0);
    }
    expect(a.courses[0]).toBeLessThan(a.ppc.course);
    expect(a.courses[1]).toBeGreaterThan(a.ppc.course);
  });
  it("the PPC lies inside the area along the track", () => {
    const ns = areas[0]!.outline.map((p) => p.n);
    expect(Math.min(...ns)).toBeLessThan(4.5);
    expect(Math.max(...ns)).toBeGreaterThan(4.5);
  });
  it("no area for a stopped target or one already inside the miss distance", () => {
    expect(dangerAreas(rel, { e: 0, n: 0 }, 10, 1)).toHaveLength(0);
    expect(dangerAreas({ e: 0.5, n: 0 }, tv, 10, 1)).toHaveLength(0);
  });
});
