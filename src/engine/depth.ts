import { Vec2 } from "../core/vec";
import { packRows, unpackRows } from "./terrain";

/**
 * Approximate water depths of a real area (engine/real-depths.ts, made by scripts/make-depths.mjs from ETOPO 2022):
 * a grid of nodes in the scenario's frame (NM east and north of its origin), `cellNm` apart, row by row from the
 * south-west corner, each the depth below mean sea level in whole metres, 0 on land. The source has cells of about
 * 450 m: shoals, banks and dredged channels smaller than that are not in it, near the coast it is not reliable, and
 * there is no tide. It is shown as a guide (the echo sounder's reading and depth contours), never used to ground the
 * ship, and it is not a chart.
 */
export interface DepthGrid {
  e0: number;
  n0: number;
  cellNm: number;
  cols: number;
  rows: number;
  depths: Float32Array;
}

/** A depth grid as text: the depths packed as the land heights are (engine/terrain.ts `packRows`). */
export interface PackedDepths {
  e0: number;
  n0: number;
  cellNm: number;
  cols: number;
  rows: number;
  d: string;
}

export function packDepths(g: DepthGrid): PackedDepths {
  return { e0: g.e0, n0: g.n0, cellNm: g.cellNm, cols: g.cols, rows: g.rows, d: packRows(g.depths, g.cols, g.rows) };
}

export function unpackDepths(p: PackedDepths): DepthGrid {
  return { e0: p.e0, n0: p.n0, cellNm: p.cellNm, cols: p.cols, rows: p.rows, depths: unpackRows(p.d, p.cols, p.rows) };
}

/** The depth at a point, metres: bilinear between the four nodes round it. Null outside the grid. */
export function depthOnGrid(g: DepthGrid, p: Vec2): number | null {
  const x = (p.e - g.e0) / g.cellNm;
  const y = (p.n - g.n0) / g.cellNm;
  if (!(x >= 0 && y >= 0 && x <= g.cols - 1 && y <= g.rows - 1)) return null;
  const i = Math.min(g.cols - 2, Math.floor(x));
  const j = Math.min(g.rows - 2, Math.floor(y));
  const a = x - i;
  const b = y - j;
  const v = (ii: number, jj: number): number => g.depths[jj * g.cols + ii]!;
  return (1 - b) * ((1 - a) * v(i, j) + a * v(i + 1, j)) + b * ((1 - a) * v(i, j + 1) + a * v(i + 1, j + 1));
}

/** The depth contours drawn over the picture, metres. */
export const CONTOUR_LEVELS_M = [5, 10, 20, 30, 50, 100];

/**
 * The lines along which the depth is `levelM` metres, by marching squares over the grid (linear along each side of a
 * cell; a cell whose corners alternate is settled by the mean of its four corners). Each line is a list of points;
 * a closed line ends where it began. The level is taken a millimetre shallower so that no node lies exactly on it.
 */
export function depthContour(g: DepthGrid, levelM: number): Vec2[][] {
  const L = levelM - 1e-3;
  const { cols, rows, cellNm, e0, n0, depths } = g;
  const at = (i: number, j: number): number => depths[j * cols + i]!;
  const points = new Map<number, Vec2>();
  // Edge keys: 2k for the side from node k eastwards, 2k + 1 for the side from node k northwards.
  const east = (i: number, j: number): number => {
    const key = 2 * (j * cols + i);
    if (!points.has(key)) {
      const a = at(i, j), b = at(i + 1, j);
      points.set(key, { e: e0 + (i + (L - a) / (b - a)) * cellNm, n: n0 + j * cellNm });
    }
    return key;
  };
  const north = (i: number, j: number): number => {
    const key = 2 * (j * cols + i) + 1;
    if (!points.has(key)) {
      const a = at(i, j), b = at(i, j + 1);
      points.set(key, { e: e0 + i * cellNm, n: n0 + (j + (L - a) / (b - a)) * cellNm });
    }
    return key;
  };
  const segs: [number, number][] = [];
  for (let j = 0; j + 1 < rows; j++) {
    for (let i = 0; i + 1 < cols; i++) {
      // Corners south-west, south-east, north-east, north-west: deeper than the level or not.
      const sw = at(i, j) > L, se = at(i + 1, j) > L, ne = at(i + 1, j + 1) > L, nw = at(i, j + 1) > L;
      if (sw === se && se === ne && ne === nw) continue;
      const cut: number[] = [];
      if (sw !== se) cut.push(east(i, j)); // south side
      if (se !== ne) cut.push(north(i + 1, j)); // east side
      if (nw !== ne) cut.push(east(i, j + 1)); // north side
      if (sw !== nw) cut.push(north(i, j)); // west side
      if (cut.length === 2) {
        segs.push([cut[0]!, cut[1]!]);
        continue;
      }
      // Corners alternate (sides cut in the order south, east, north, west): the middle decides which corners join.
      const [s, e, n, w] = cut as [number, number, number, number];
      const middleDeep = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 > L;
      // Cut off the two corners that are not joined through the middle.
      const swCut = middleDeep !== sw;
      if (swCut) segs.push([s, w], [e, n]); // south-west and north-east corners cut off
      else segs.push([s, e], [n, w]); // south-east and north-west corners cut off
    }
  }
  // Join the pieces into lines through the sides they share.
  const byKey = new Map<number, number[]>();
  segs.forEach(([p, q], k) => {
    for (const key of [p, q]) {
      const l = byKey.get(key);
      if (l) l.push(k);
      else byKey.set(key, [k]);
    }
  });
  const used = new Uint8Array(segs.length);
  const follow = (from: number): number[] => {
    const keys: number[] = [];
    let cur = from;
    for (;;) {
      const next = (byKey.get(cur) ?? []).find((k) => !used[k]);
      if (next === undefined) return keys;
      used[next] = 1;
      const [p, q] = segs[next]!;
      cur = p === cur ? q : p;
      keys.push(cur);
    }
  };
  const lines: Vec2[][] = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const [p, q] = segs[k]!;
    const ahead = follow(q);
    const back = follow(p);
    const keys = [...back.reverse(), p, q, ...ahead];
    lines.push(keys.map((key) => points.get(key)!));
  }
  return lines;
}

/** The contour lines of one level, each with the box round it (west, south, east, north, NM) to leave out those off the screen. */
export interface ContourSet {
  levelM: number;
  lines: Vec2[][];
  boxes: [number, number, number, number][];
}

const contourCache = new WeakMap<DepthGrid, ContourSet[]>();
/** The contours of every level in `CONTOUR_LEVELS_M`, worked out once per grid. */
export function depthContours(g: DepthGrid): ContourSet[] {
  const hit = contourCache.get(g);
  if (hit) return hit;
  const all = CONTOUR_LEVELS_M.map((levelM) => {
    const lines = depthContour(g, levelM);
    const boxes = lines.map((l): [number, number, number, number] => [Math.min(...l.map((p) => p.e)), Math.min(...l.map((p) => p.n)), Math.max(...l.map((p) => p.e)), Math.max(...l.map((p) => p.n))]);
    return { levelM, lines, boxes };
  });
  contourCache.set(g, all);
  return all;
}

/**
 * The echo sounder's reading as the own ship data shows it: the depth of water and, when the draught is known, the
 * water under the keel. Whole metres, marked as approximate.
 */
export function echoSounderText(depthM: number | null, draughtM: number | null): string {
  if (depthM === null) return "no depth data here";
  const water = `≈ ${Math.round(depthM)} m of water`;
  if (draughtM === null || !(draughtM > 0)) return water;
  const underKeel = depthM - draughtM;
  if (underKeel <= 0) return `${water}: no more than the draught (${draughtM.toFixed(1)} m)`;
  return `${water}, ≈ ${Math.round(underKeel)} m under the keel`;
}
