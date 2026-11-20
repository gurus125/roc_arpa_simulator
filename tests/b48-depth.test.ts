import { describe, expect, it } from "vitest";
import { positionOfLatLon } from "../src/core/nav";
import { DepthGrid, SCENARIOS, Scenario, createWorld, depthAt, depthContour, depthContours, depthGridById, depthOnGrid, echoSounderText, packDepths, unpackDepths } from "../src/engine/index";

/**
 * Approximate depths of the real areas (engine/depth.ts, ETOPO 2022 through scripts/make-depths.mjs). The expected
 * values of the grid arithmetic are worked by hand below; the real data is checked for being water where the ships
 * start and land where towns are.
 */
const grid = (cols: number, rows: number, cellNm: number, f: (i: number, j: number) => number, e0 = 0, n0 = 0): DepthGrid => {
  const depths = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) depths[j * cols + i] = f(i, j);
  return { e0, n0, cellNm, cols, rows, depths };
};

describe("depth grids", () => {
  it("pack into text and back unchanged", () => {
    const vals = [0, 0, 0, 3, 7, 8191, 0, 120, 119, 118, 5000, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 1];
    const g = grid(7, 5, 0.25, (i, j) => vals[j * 7 + i]!, -3.5, 2);
    const back = unpackDepths(packDepths(g));
    expect([...back.depths]).toEqual(vals);
    expect({ ...back, depths: null }).toEqual({ ...g, depths: null });
  });

  it("give the depth between nodes by bilinear interpolation", () => {
    // Nodes 0.5 NM apart from (1, 2): south row 0, 10, 20; north row 4, 14, 30.
    const g = grid(3, 2, 0.5, (i, j) => [[0, 10, 20], [4, 14, 30]][j]![i]!, 1, 2);
    // Middle of the first cell: the mean of 0, 10, 4 and 14.
    expect(depthOnGrid(g, { e: 1.25, n: 2.25 })).toBeCloseTo(7, 9);
    // A quarter of the way east and three quarters north in the second cell:
    // south side 10 + 0.25 x 10 = 12.5, north side 14 + 0.25 x 16 = 18, then 12.5 + 0.75 x 5.5 = 16.625.
    expect(depthOnGrid(g, { e: 1.625, n: 2.375 })).toBeCloseTo(16.625, 9);
    // On the far corner, and just outside the grid.
    expect(depthOnGrid(g, { e: 2, n: 2.5 })).toBeCloseTo(30, 9);
    expect(depthOnGrid(g, { e: 0.99, n: 2.2 })).toBeNull();
    expect(depthOnGrid(g, { e: 2.01, n: 2.2 })).toBeNull();
    expect(depthOnGrid(g, { e: 1.5, n: 2.51 })).toBeNull();
  });
});

describe("depth contours", () => {
  it("a bottom sloping evenly to the east gives one straight contour, north to south", () => {
    // Depth 10 m a cell to the east: the 15 m line is half way between the second and third columns.
    const g = grid(4, 3, 0.25, (i) => 10 * i, 5, 7);
    const lines = depthContour(g, 15);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(l).toHaveLength(3);
    for (const p of l) expect(p.e).toBeCloseTo(5 + 1.5 * 0.25, 4);
    expect(l.map((p) => p.n).sort((a, b) => a - b)).toEqual([7, 7.25, 7.5]);
  });

  it("a single deep node gives a closed diamond round it", () => {
    // 20 m in the middle of a 3 x 3 grid, dry round it: the 10 m line crosses each side half way.
    const g = grid(3, 3, 1, (i, j) => (i === 1 && j === 1 ? 20 : 0));
    const lines = depthContour(g, 10);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(l).toHaveLength(5);
    expect(l[4]).toEqual(l[0]);
    const pts = l.slice(0, 4).map((p) => `${p.e.toFixed(3)},${p.n.toFixed(3)}`).sort();
    expect(pts).toEqual(["0.500,1.000", "1.000,0.500", "1.000,1.500", "1.500,1.000"]);
    // Its area by the shoelace formula: a square of diagonal 1, area 0.5.
    let a = 0;
    for (let k = 0; k < 4; k++) a += l[k]!.e * l[k + 1]!.n - l[k + 1]!.e * l[k]!.n;
    expect(Math.abs(a / 2)).toBeCloseTo(0.5, 3);
  });

  it("a cell whose corners alternate is settled by its middle", () => {
    // South-west and north-east deep. Middle (20 + 0 + 20 + 0) / 4 = 10, deeper than the line: the deep corners join,
    // and the two shallow corners (south-east, north-west) are cut off.
    const deepMiddle = depthContour(grid(2, 2, 1, (i, j) => (i === j ? 20 : 0)), 10);
    const corner = (l: { e: number; n: number }[]): string => `${Math.round((l[0]!.e + l[1]!.e) * 2) / 4},${Math.round((l[0]!.n + l[1]!.n) * 2) / 4}`;
    expect(deepMiddle.map(corner).sort()).toEqual(["0.25,0.75", "0.75,0.25"]);
    // Middle (20 + 0 + 19 + 0) / 4 = 9.75, shallower: the deep corners (south-west, north-east) are cut off instead.
    const shallowMiddle = depthContour(grid(2, 2, 1, (i, j) => (i === 0 && j === 0 ? 20 : i === 1 && j === 1 ? 19 : 0)), 10);
    expect(shallowMiddle.map(corner).sort()).toEqual(["0.25,0.25", "0.75,0.75"]);
  });
});

describe("the real areas", () => {
  const AREAS = ["mumbai", "goa", "kochi", "kutch"];

  it("have depths, with water where the scenario ships start and land where the towns are", () => {
    const land: Record<string, [number, number]> = { mumbai: [19.12, 72.9], goa: [15.49, 73.83], kochi: [10.0, 76.3], kutch: [23.11, 70.03] };
    for (const id of AREAS) {
      expect(depthGridById(id), id).not.toBeNull();
      const sc = SCENARIOS.find((s) => s.terrain === id)!;
      const w = createWorld(sc);
      expect(w.area).toBe(id);
      const start = depthAt(w, w.own.pos)!;
      expect(start, id).toBeGreaterThan(20);
      expect(start, id).toBeLessThan(80);
      for (const t of w.targets.filter((x) => x.kind === "ship")) expect(depthAt(w, t.pos), `${id} ${t.name}`).toBeGreaterThan(0);
      const [lat, lon] = land[id]!;
      expect(depthAt(w, positionOfLatLon(w.origin, lat, lon)), id).toBe(0);
    }
  });

  it("every point of every contour lies at the contour's depth", () => {
    for (const id of AREAS) {
      const g = depthGridById(id)!;
      const sets = depthContours(g);
      expect(sets.find((s) => s.levelM === 10)!.lines.length, id).toBeGreaterThan(0);
      for (const s of sets) for (const l of s.lines) for (const p of l) expect(Math.abs(depthOnGrid(g, p)! - s.levelM)).toBeLessThan(0.01);
    }
  });

  it("are kept out of the world copy: only the area's name is in it", () => {
    const w = createWorld(SCENARIOS.find((s) => s.terrain === "goa")!);
    expect(JSON.stringify(w)).not.toMatch(/depths":\{/);
    expect(structuredClone(w).area).toBe("goa");
  });
});

describe("depth where the simulator knows it", () => {
  const drawn: Scenario = {
    id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: {}, coasts: [], targets: [],
    depths: [{ name: "Bank", points: [{ e: 1, n: 1 }, { e: 2, n: 1 }, { e: 2, n: 2 }, { e: 1, n: 2 }], depthM: 4 }],
  };
  it("a drawn scenario knows only its shallow areas", () => {
    const w = createWorld(drawn);
    expect(depthAt(w, { e: 1.5, n: 1.5 })).toBe(4);
    expect(depthAt(w, { e: 0, n: 0 })).toBeNull();
  });
  it("a shallow area drawn in a real area makes the water no deeper than it", () => {
    const sc = SCENARIOS.find((s) => s.terrain === "goa")!;
    const w = createWorld({ ...sc, depths: [{ name: "Bank", points: [{ e: -1, n: -1 }, { e: 1, n: -1 }, { e: 1, n: 1 }, { e: -1, n: 1 }], depthM: 6 }] });
    expect(depthAt(w, { e: 0, n: 0 })).toBe(6);
    expect(depthAt(w, { e: 3, n: 0 })!).toBeGreaterThan(6);
  });
  it("the echo sounder reads the water and the water under the keel", () => {
    expect(echoSounderText(null, 9)).toBe("no depth data here");
    expect(echoSounderText(45.4, null)).toBe("≈ 45 m of water");
    expect(echoSounderText(45.4, 9.5)).toBe("≈ 45 m of water, ≈ 36 m under the keel");
    expect(echoSounderText(8.2, 9.5)).toBe("≈ 8 m of water: no more than the draught (9.5 m)");
  });
});
