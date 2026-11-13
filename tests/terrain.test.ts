import { describe, expect, it } from "vitest";
import { fromPolar } from "../src/core/vec";
import {
  EARTH_RADIUS_M, LAND_REFLECTIVITY, PackedTerrain, SHORELINE_RCS_PER_M, TerrainGrid, effectiveEarthRadiusM, elevationAngle, groundHeightM, isLandAt,
  landFaceDetectionNm, packTerrain, terrainHides, unpackTerrain, visibleLand,
} from "../src/engine/terrain";
import { REAL_TERRAIN } from "../src/engine/real-terrain";
import { SCENARIOS, Scenario, World, createWorld, isLand, landHides, scanWedge, shorelineHeightM } from "../src/engine/index";
import { ArpaSystem, extractPlots, ARPA_PLACEHOLDERS } from "../src/arpa/index";

/** A test grid: 0.1 NM nodes over e -1..31, n -10..10; land and heights from the functions given. */
function grid(height: (e: number, n: number) => number, land: (e: number, n: number) => boolean): TerrainGrid {
  const cellNm = 0.1, maskScale = 2, e0 = -1, n0 = -10;
  const cols = 321, rows = 201;
  const heights = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) heights[j * cols + i] = height(e0 + i * cellNm, n0 + j * cellNm);
  const mcols = (cols - 1) * maskScale, mrows = (rows - 1) * maskScale, mc = cellNm / maskScale;
  const mask = new Uint8Array(mcols * mrows);
  for (let j = 0; j < mrows; j++) for (let i = 0; i < mcols; i++) mask[j * mcols + i] = land(e0 + (i + 0.5) * mc, n0 + (j + 0.5) * mc) ? 1 : 0;
  return { e0, n0, cellNm, cols, rows, heights, mask, maskScale };
}
const RE = effectiveEarthRadiusM();
const own = { e: 0, n: 0 };

describe("Earth's curve and refraction", () => {
  it("the effective radius is 4/3 of the Earth's, and goes with the square of the horizon factor", () => {
    expect(RE).toBeCloseTo((6371000 * 4) / 3, 0); // 8 494 667 m
    expect(effectiveEarthRadiusM("sub")).toBeCloseTo(RE * 0.64, 0); // horizon x 0.8
    expect(effectiveEarthRadiusM("super")).toBeCloseTo(RE * 1.96, 0); // horizon x 1.4
    expect(effectiveEarthRadiusM("standard", true)).toBeCloseTo(RE * 4, 0); // ducting: horizon x 2
    expect(EARTH_RADIUS_M).toBe(6371000);
  });
  it("the sea horizon from 16 m is 8.9 NM, as the book's 2.21 x sqrt(16) = 8.84 NM", () => {
    // Distance at which the sea surface (height 0) is seen highest: sqrt(2 Re h) = sqrt(2 x 8 494 667 x 16) = 16 487 m.
    let best = -Infinity, at = 0;
    for (let d = 1000; d < 40000; d += 10) {
      const th = elevationAngle(0, d, 16, RE);
      if (th > best) [best, at] = [th, d];
    }
    expect(at / 1852).toBeCloseTo(8.9, 1);
    expect(Math.abs(at / 1852 - 2.21 * 4) / 8.84).toBeLessThan(0.01);
  });
  it("elevation of a 60 m cliff top 20 NM off, from 15 m: (60 - 80.75 - 15) / 37 040 rad", () => {
    // Drop of the Earth's surface at 37 040 m: 37 040^2 / (2 x 8 494 667) = 80.754 m.
    expect(elevationAngle(60, 37040, 15, RE)).toBeCloseTo((60 - 80.754 - 15) / 37040, 7);
  });
});

describe("What land the radar sees", () => {
  // An island 2 NM east, 0.5 NM across, 40 m high; the mainland from 10 NM east, rising 10 m per 0.1 NM to 300 m.
  const g = grid(
    (e, n) => (e >= 2 && e <= 2.5 && Math.abs(n) <= 0.25 ? 40 : e >= 10 ? Math.min(300, (e - 10) * 100) : 0),
    (e, n) => (e >= 2 && e <= 2.5 && Math.abs(n) <= 0.25) || e >= 10,
  );
  it("land and heights read back from the grid", () => {
    expect(isLandAt(g, { e: 2.2, n: 0 })).toBe(true);
    expect(isLandAt(g, { e: 5, n: 0 })).toBe(false);
    expect(isLandAt(g, { e: 40, n: 0 })).toBe(false); // outside the grid: no land
    expect(groundHeightM(g, { e: 10.55, n: 3 })).toBeCloseTo(55, 6); // between nodes 10.5 (50 m) and 10.6 (60 m)
  });
  it("the near face of the island shows its whole height; the land behind it, in its shadow, does not show", () => {
    const seen = visibleLand(g, own, 90, 18, RE, 0.05, 20, 0.05);
    const first = seen[0]!;
    expect(first.rangeNm).toBeCloseTo(2, 6);
    expect(first.exposedM).toBeCloseTo(40, 6);
    // The island's flat top beyond its first edge is lower in angle (40 m is above the 18 m antenna): hidden.
    expect(seen.filter((x) => x.rangeNm > 2 && x.rangeNm <= 2.5)).toEqual([]);
    // The mainland shows only where it rises above the line over the island's top, seen at
    // (40 - 0.81 - 18) / 3704 = 0.0057215 rad. At 11.6 NM (21 483 m, ground 160 m, drop 27.17 m) the
    // top is at (160 - 27.17 - 18) / 21 483 = 0.005345 rad: hidden. At 11.7 NM (21 668 m, 170 m, drop
    // 27.64 m): (170 - 27.64 - 18) / 21 668 = 0.005739 rad: it shows. So the first piece is at 11.7 NM.
    const main = seen.filter((x) => x.rangeNm >= 10);
    expect(main[0]!.rangeNm).toBeCloseTo(11.7, 6);
  });
  it("without the island the mainland shows from its foot", () => {
    const g2 = grid((e) => (e >= 10 ? Math.min(300, (e - 10) * 100) : 0), (e) => e >= 10);
    const seen = visibleLand(g2, own, 90, 18, RE, 0.05, 20, 0.05);
    // The first sample on land (10.0 or, rounding, 10.05 NM) shows its whole height from the water.
    expect(Math.abs(seen[0]!.rangeNm - 10)).toBeLessThan(0.06);
    expect(seen[0]!.exposedM).toBeCloseTo(seen[0]!.heightM, 6);
    // The slope rises faster than the line of sight (100 m a mile from 18 m up): every sample on it shows.
    const onLand = Array.from({ length: 400 }, (_, k) => 0.05 + k * 0.05).filter((r) => r <= 13 + 1e-9 && isLandAt(g2, { e: r, n: 0 })).length;
    expect(seen.filter((x) => x.rangeNm <= 13 + 1e-9).length).toBe(onLand);
  });
  it("a ship behind the island is hidden; a tall one far behind shows over it", () => {
    // Behind the island at 3 NM, 20 m: the island top is seen at (40 - 0.81 - 18) / 3704 = 0.00572 rad;
    // the ship top at (20 - 1.82 - 18) / 5556 = 0.00003 rad: hidden.
    expect(terrainHides(g, own, { e: 3, n: 0 }, 20, 18, RE, 0.05)).toBe(true);
    // Off the island's line, it is not.
    expect(terrainHides(g, own, { e: 3, n: 1 }, 20, 18, RE, 0.05)).toBe(false);
    // A 120 m mast at 3 NM: (120 - 1.82 - 18) / 5556 = 0.0180 rad, above the island: shows.
    expect(terrainHides(g, own, { e: 3, n: 0 }, 120, 18, RE, 0.05)).toBe(false);
  });
});

describe("How strongly land returns (IEC 62388 Tables 2 and D.7)", () => {
  it("the reference: a 60 m cliff at 20 NM with a reflectivity of 1 is first seen at 19.8 NM", () => {
    // Face 60 m x beam 37 040 m x 1.23 deg (0.021468 rad) = 60 x 795.2 = 47 710 m^2; Table D.7: 50 000 m^2;
    // 20 NM x (47 710 / 50 000)^(1/4) = 20 x 0.98835 = 19.77 NM.
    expect(SHORELINE_RCS_PER_M * 60).toBeCloseTo(50000, 6);
    expect(landFaceDetectionNm(60, 60, 20, 1.23, 1)).toBeCloseTo(19.77, 2);
  });
  it("the same 6 m and 3 m shorelines at their Table 2 ranges come out close to them", () => {
    // 6 m at 8 NM: 6 x 14 816 x 0.021468 = 1 908 m^2 against 5 000: 8 x (0.3817)^(1/4) = 6.29 NM.
    expect(landFaceDetectionNm(6, 6, 8, 1.23, 1)).toBeCloseTo(6.29, 2);
    // 3 m at 6 NM: 3 x 11 112 x 0.021468 = 715.6 m^2 against 2 500: 6 x (0.28626)^(1/4) = 6 x 0.73146 = 4.389 NM.
    expect(landFaceDetectionNm(3, 3, 6, 1.23, 1)).toBeCloseTo(4.389, 2);
  });
  it("land showing little face (flat land far off) returns little; the placeholder reflectivity is 10", () => {
    expect(LAND_REFLECTIVITY).toBe(10);
    expect(landFaceDetectionNm(0, 5, 3, 1.23)).toBe(0);
    expect(landFaceDetectionNm(0.1, 5, 3, 1.23)).toBeLessThan(landFaceDetectionNm(5, 5, 3, 1.23) / 2);
  });
});

describe("Packing the terrain into the source", () => {
  it("what is unpacked is what was packed (heights to the metre, land mask exactly)", () => {
    let s = 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
    // Smooth hills, sea runs, a few cliffs and spikes, up to 3 000 m.
    const g = grid(
      (e, n) => (e < 5 ? 0 : Math.round(Math.max(0, 200 * Math.sin(e) * Math.cos(n) + (rnd() < 0.02 ? 2500 : 0) + (e > 20 ? 300 : 0)))),
      (e, n) => e >= 5 && (e - 15) ** 2 + n * n > 4,
    );
    const back = unpackTerrain(packTerrain(g));
    expect(Array.from(back.heights)).toEqual(Array.from(g.heights));
    expect(Array.from(back.mask)).toEqual(Array.from(g.mask));
  });
  it("heights above 8 191 m and below 0 are cut", () => {
    const g = grid((e) => (e < 0 ? -5 : 9000), () => true);
    const back = unpackTerrain(packTerrain(g));
    expect(back.heights[0]).toBe(0);
    expect(back.heights[back.heights.length - 1]).toBe(8191);
  });
});

describe("The real areas", () => {
  it("Mumbai, Goa, Kochi and the Gulf of Kutch have heights and land, the highest ground where it should be", () => {
    const top: Record<string, number> = {};
    for (const [id, p] of Object.entries(REAL_TERRAIN) as [string, PackedTerrain][]) {
      const g = unpackTerrain(p);
      top[id] = g.heights.reduce((a, b) => Math.max(a, b), 0);
      expect(g.mask.some((x) => x === 1)).toBe(true);
      expect(g.mask.some((x) => x === 0)).toBe(true);
    }
    expect(Object.keys(top).sort()).toEqual(["goa", "kochi", "kutch", "mumbai"]);
    // The Western Ghats behind Goa rise above 800 m; Mumbai's hills to under 500 m.
    expect(top["goa"]).toBeGreaterThan(800);
    expect(top["mumbai"]).toBeGreaterThan(300);
    expect(top["mumbai"]).toBeLessThan(600);
  });
  it("every real-area scenario starts with own ship and every ship on the water, none hidden", () => {
    for (const sc of SCENARIOS.filter((x) => x.terrain)) {
      const w = createWorld(sc);
      expect(w.terrain, sc.id).toBeTruthy();
      expect(isLand(w, w.own.pos), sc.id).toBe(false);
      for (const t of w.targets) {
        expect(isLand(w, t.pos), `${sc.id} ${t.name}`).toBe(false);
        expect(landHides(w, t.pos, t.height), `${sc.id} ${t.name}`).toBe(false);
      }
    }
  });
  it("the shoreline takes its height from the ground behind it", () => {
    const w = createWorld(SCENARIOS.find((x) => x.id === "goa-approach")!);
    const heights = w.coastSamples.map((s) => s.heightM);
    expect(Math.max(...heights)).toBeGreaterThan(50);
    expect(shorelineHeightM(w.terrain!, { e: -20, n: 0 })).toBe(0); // open sea
  });
});

describe("The picture and the ARPA with land", () => {
  const seeded = (seed: number) => {
    let s = seed;
    return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  };
  // Own ship at the origin in sea state 4; an island 1.5 NM east, 0.4 NM across, 60 m high.
  const base = (targets: Scenario["targets"]): World => {
    const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 4 }, coasts: [], targets });
    w.terrain = grid((e, n) => (Math.hypot(e - 1.7, n) <= 0.2 ? 60 : 0), (e, n) => Math.hypot(e - 1.7, n) <= 0.2);
    w.radar.controls.rangeNm = 3;
    w.radar.shadowSectors = [];
    return w;
  };
  const ship = (id: number, pos: { e: number; n: number }, height: number) =>
    ({ id, name: `S${id}`, kind: "ship" as const, pos, course: 0, speed: 0, rcs: 1, height, events: [] });

  it("land echoes lie on land, and there is no sea clutter on the island or in its shadow", () => {
    const w = base([]);
    const rng = seeded(2);
    const hits = [] as ReturnType<typeof scanWedge>;
    for (let a = 0; a < 360; a += 2) hits.push(...scanWedge(w, a, a + 2, rng));
    const coast = hits.filter((h) => h.kind === "coast");
    expect(coast.length).toBeGreaterThan(0);
    for (const h of coast) expect(isLand(w, h.pos)).toBe(true);
    const clutter = hits.filter((h) => h.kind === "sea-clutter");
    expect(clutter.length).toBeGreaterThan(50);
    for (const h of clutter) {
      expect(isLand(w, h.pos)).toBe(false);
      expect(landHides(w, h.pos, 1)).toBe(false);
    }
    // Behind the island (bearing 090, 2.0 to 3 NM) there is no clutter at all.
    expect(clutter.filter((h) => Math.abs(h.pos.n) < 0.1 && h.pos.e > 2).length).toBe(0);
  });
  it("a ship behind the island is not painted and gives the ARPA no plot; one beside it is and does", () => {
    const w = base([ship(1, { e: 2.6, n: 0 }, 15), ship(2, fromPolar(60, 2.6), 15)]);
    const rng = seeded(3);
    const painted = new Set<number>();
    for (let k = 0; k < 5; k++) for (let a = 0; a < 360; a += 2) for (const h of scanWedge(w, a, a + 2, rng)) if (h.kind === "target") painted.add(h.targetId!);
    expect([...painted]).toEqual([2]);
    const plots = Array.from({ length: 5 }, () => extractPlots(w, ARPA_PLACEHOLDERS, rng)).flat();
    const ids = new Set(plots.flatMap((p) => p.truthIds));
    expect(ids.has(1)).toBe(false);
    expect(ids.has(2)).toBe(true);
    void ArpaSystem;
  });
  it("with drawn coastlines a ship behind a 60 m island is hidden, one behind a 3 m islet is not", () => {
    const island = (x: number, h: number) => ({ name: "i", closed: true, heightM: h, points: [{ e: x, n: -0.2 }, { e: x + 0.4, n: -0.2 }, { e: x + 0.4, n: 0.2 }, { e: x, n: 0.2 }] });
    const w = createWorld({ id: "c", name: "c", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [island(1.5, 60), { ...island(1.5, 3), points: island(1.5, 3).points.map((p) => ({ e: p.e, n: p.n + 3 })) }], targets: [] });
    expect(landHides(w, { e: 3, n: 0 }, 15)).toBe(true);
    // The islet at n = 3: a ship beyond it, on the same bearing, at twice the range. Islet top seen at
    // (3 - 0.06 - 18) / (3 NM) < 0; the ship's 15 m top at (15 - 0.2 - 18) / (6 NM): higher, so it shows.
    const beyond = { e: 2 * 1.5 + 0.2, n: 2 * 3 };
    expect(landHides(w, beyond, 15)).toBe(false);
    expect(isLand(w, { e: 1.7, n: 0 })).toBe(true);
    expect(isLand(w, { e: 1, n: 0 })).toBe(false);
  });
});
