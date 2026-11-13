import { Vec2, add, fromPolar } from "../core/vec";
import { REFRACTION_FACTOR } from "./signal";
import { shorelineDetectionNm } from "./band";
import { Refraction } from "./types";

/**
 * Land heights, and what of the land a radar can see.
 *
 * A real area carries a grid of ground heights (from a digital elevation model) and a land mask
 * (from the coastline). The radar's view of it is worked out ray by ray along each bearing, with
 * the Earth's curve and the bending of the beam in the atmosphere:
 *
 *   - a point of height h at distance d is seen at the elevation angle (h - d^2 / 2Re - ha) / d
 *     (small angles; ha the antenna height, Re the effective radius of the Earth, 4/3 of the real
 *     radius in the standard atmosphere);
 *   - land is hidden (in radar shadow) when nearer land is seen at a higher angle;
 *   - each piece of land that shows returns according to the height of the face it shows to the
 *     radar ("exposed" height): the whole height for land rising from the water, only the part
 *     above the line that grazes the nearer land for land behind it. Flat land far off shows almost
 *     no face and returns little; a hillside facing the radar returns strongly. This is the
 *     constant-gamma idea of land clutter (return in proportion to the area seen face-on).
 *
 * The strength of a face is taken from IEC 62388:2013 Tables 2 and D.7, which give a shoreline's
 * radar cross-section in proportion to its height (2 500, 5 000 and 50 000 m^2 for shorelines
 * rising to 3, 6 and 60 m) and its range of first detection (6, 8 and 20 NM).
 */

/** Mean radius of the Earth, metres. */
export const EARTH_RADIUS_M = 6371000;
export const NM_M = 1852;

export interface TerrainGrid {
  /** Position of height node (0, 0), the south-west corner, in the scenario's frame, NM. */
  e0: number;
  n0: number;
  /** Spacing of the height nodes, NM. */
  cellNm: number;
  /** Number of height nodes east-west and north-south. */
  cols: number;
  rows: number;
  /** Ground height at each node, metres, row by row from the south. */
  heights: Float32Array;
  /** Land (1) or water (0) in each mask cell, row by row from the south. The mask cells are `cellNm / maskScale` square and cover the area between the outer nodes. */
  mask: Uint8Array;
  maskScale: number;
}

/** Number of mask cells east-west and north-south, and their size, NM. */
export function maskSize(g: TerrainGrid): { cols: number; rows: number; cellNm: number } {
  return { cols: (g.cols - 1) * g.maskScale, rows: (g.rows - 1) * g.maskScale, cellNm: g.cellNm / g.maskScale };
}

/** Whether the point is land. Outside the grid there is no land. */
export function isLandAt(g: TerrainGrid, p: Vec2): boolean {
  const m = maskSize(g);
  const i = Math.floor((p.e - g.e0) / m.cellNm);
  const j = Math.floor((p.n - g.n0) / m.cellNm);
  if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) return false;
  return g.mask[j * m.cols + i] === 1;
}

/** Ground height at the point from the nodes round it (bilinear), metres; 0 outside the grid. */
export function groundHeightM(g: TerrainGrid, p: Vec2): number {
  const x = (p.e - g.e0) / g.cellNm;
  const y = (p.n - g.n0) / g.cellNm;
  if (x < 0 || y < 0 || x > g.cols - 1 || y > g.rows - 1) return 0;
  const i = Math.min(g.cols - 2, Math.floor(x));
  const j = Math.min(g.rows - 2, Math.floor(y));
  const fx = x - i;
  const fy = y - j;
  const h = g.heights;
  const a = h[j * g.cols + i]!;
  const b = h[j * g.cols + i + 1]!;
  const c = h[(j + 1) * g.cols + i]!;
  const d = h[(j + 1) * g.cols + i + 1]!;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Height of the land at the point, metres, or null over water. */
export function landHeightAt(g: TerrainGrid, p: Vec2): number | null {
  return isLandAt(g, p) ? Math.max(0, groundHeightM(g, p)) : null;
}

/**
 * Effective radius of the Earth for the radar beam, metres: 4/3 of the real radius in the standard
 * atmosphere. Sub- and super-refraction and ducting scale the radar horizon by the factors used for
 * detection ranges (signal.ts); the horizon goes as the square root of the radius, so the radius
 * goes as the square of the factor.
 */
export function effectiveEarthRadiusM(refraction: Refraction = "standard", ducting = false): number {
  const f = ducting ? 2 : REFRACTION_FACTOR[refraction];
  return EARTH_RADIUS_M * (4 / 3) * f * f;
}

/** Elevation angle, radians (small angles), at which a point of height `hM` at `dM` metres is seen from an antenna `haM` above the sea. */
export function elevationAngle(hM: number, dM: number, haM: number, reM: number): number {
  return (hM - (dM * dM) / (2 * reM) - haM) / dM;
}

export interface VisibleLand {
  rangeNm: number;
  pos: Vec2;
  heightM: number;
  /** Height of the face this piece of land shows to the radar, metres. */
  exposedM: number;
}

/**
 * The land the radar sees along one true bearing, between two ranges, sampled every `stepNm`.
 * Land hidden by nearer land is left out.
 */
export function visibleLand(g: TerrainGrid, own: Vec2, trueBearing: number, haM: number, reM: number, fromNm: number, toNm: number, stepNm: number): VisibleLand[] {
  const out: VisibleLand[] = [];
  let thetaMax = -Infinity;
  const n = Math.floor((toNm - fromNm) / stepNm + 1e-9);
  for (let k = 0; k <= n; k++) {
    const r = fromNm + k * stepNm;
    const p = add(own, fromPolar(trueBearing, r));
    const h = landHeightAt(g, p);
    if (h === null) continue;
    const d = r * NM_M;
    const th = elevationAngle(h, d, haM, reM);
    if (th <= thetaMax) continue;
    const exposed = thetaMax === -Infinity ? h : Math.min(h, (th - thetaMax) * d);
    thetaMax = th;
    out.push({ rangeNm: r, pos: p, heightM: h, exposedM: exposed });
  }
  return out;
}

/**
 * Whether land hides something of height `heightM` at `pos` from the radar: some land between is
 * seen at an elevation as high as the object's top or higher. The last `clearNm` before the object
 * is not counted (an object alongside a quay is not hidden by the quay).
 */
export function terrainHides(g: TerrainGrid, own: Vec2, pos: Vec2, heightM: number, haM: number, reM: number, stepNm: number, clearNm = 0.08): boolean {
  const de = pos.e - own.e;
  const dn = pos.n - own.n;
  const dist = Math.hypot(de, dn);
  if (dist < 1e-6) return false;
  const top = elevationAngle(heightM, dist * NM_M, haM, reM);
  const end = dist - clearNm;
  for (let r = stepNm; r < end; r += stepNm) {
    const p = { e: own.e + (de * r) / dist, n: own.n + (dn * r) / dist };
    const h = landHeightAt(g, p);
    if (h === null) continue;
    if (elevationAngle(h, r * NM_M, haM, reM) >= top) return true;
  }
  return false;
}

/**
 * Radar cross-section of the reference shorelines per metre of their height, m^2: IEC 62388 Table D.7
 * gives 2 500, 5 000 and 50 000 m^2 for shorelines rising to 3, 6 and 60 m, which is 833 m^2 a metre.
 */
export const SHORELINE_RCS_PER_M = 2500 / 3;

/**
 * How strongly land returns compared with the reference shoreline of IEC 62388 Tables 2 and D.7
 * (land reflectivity, the "gamma" of the constant-gamma model, as a ratio). PLACEHOLDER. Table 2 is
 * the least a radar with the smallest antenna must do; with 1 a cliff rising to 60 m is first seen at
 * 20 NM, as Table 2 asks. 10 brings the first detection of substantial land close to the radar
 * horizon, as the Radar and ARPA Manual (3rd edition, 3.8.1) treats it, and as the simulator's ships
 * of the larger catalogue types already are. To be checked by an instructor against a real set on
 * these coasts.
 */
export const LAND_REFLECTIVITY = 10;

/**
 * Range of first detection of one piece of land, NM. Its radar cross-section is the reflectivity
 * times the area of the face it shows: the exposed height times the width of the beam at that
 * range. That is compared with the reference shoreline of the same height (Table D.7: 833 m^2 a
 * metre of height; Table 2: its range of first detection, which carries the effect of the height
 * on the way the echo comes back over the sea), and the range scaled by the fourth root of the
 * ratio of the cross-sections (the radar equation). For the reference itself, a 60 m cliff at
 * 20 NM in a 1.23° beam with a reflectivity of 1, this gives 19.8 NM.
 */
export function landFaceDetectionNm(exposedM: number, heightM: number, rangeNm: number, beamwidthDeg: number, reflectivity = LAND_REFLECTIVITY): number {
  const e = Math.max(0, exposedM);
  const h = Math.max(0.5, heightM);
  if (e <= 0) return 0;
  const sigma = reflectivity * e * rangeNm * NM_M * ((beamwidthDeg * Math.PI) / 180);
  return shorelineDetectionNm(h) * Math.pow(sigma / (SHORELINE_RCS_PER_M * h), 0.25);
}

// ---------------------------------------------------------------- packing

/** A terrain grid as it is kept in the source: heights and mask packed into text (see packTerrain). */
export interface PackedTerrain {
  e0: number;
  n0: number;
  cellNm: number;
  cols: number;
  rows: number;
  maskScale: number;
  /** Heights, whole metres: per row, each the difference from the one before it, packed in bytes (see packTerrain), in base 64. */
  h: string;
  /** Mask: per row, the lengths of alternate runs of water and land, starting with water, in base 64. */
  m: string;
}

const toBase64 = (bytes: number[]): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(s);
};
const fromBase64 = (text: string): Uint8Array => {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};
const zig = (v: number): number => (v >= 0 ? 2 * v : -2 * v - 1);
const unzig = (z: number): number => (z % 2 === 0 ? z / 2 : -(z + 1) / 2);

/**
 * Pack a grid. Heights are rounded to whole metres (0 to 8 191). In each row every height is
 * written as its difference from the one before, in tokens:
 *   00aaabbb          two differences, each -4 to 3 (a then b);
 *   01xxxxxx          one difference, -32 to 31;
 *   10xxxxxx          a run of 1 to 64 differences of 0;
 *   11xxxxxx xxxxxxxx one difference, -8 192 to 8 191.
 * (Differences are folded to whole numbers: 0, -1, 1, -2, 2 ... become 0, 1, 2, 3, 4 ...)
 * The mask is written per row as run lengths, 7 bits a byte.
 */
export function packTerrain(g: TerrainGrid): PackedTerrain {
  const hb: number[] = [];
  for (let j = 0; j < g.rows; j++) {
    const d: number[] = [];
    let prev = 0;
    for (let i = 0; i < g.cols; i++) {
      const v = Math.max(0, Math.min(8191, Math.round(g.heights[j * g.cols + i]!)));
      d.push(v - prev);
      prev = v;
    }
    let i = 0;
    while (i < d.length) {
      if (d[i] === 0 && (i + 1 >= d.length || d[i + 1] === 0)) {
        let n = 0;
        while (i < d.length && d[i] === 0 && n < 64) {
          n++;
          i++;
        }
        hb.push(0x80 | (n - 1));
        continue;
      }
      const z = zig(d[i]!);
      if (i + 1 < d.length && z < 8 && zig(d[i + 1]!) < 8) {
        hb.push((z << 3) | zig(d[i + 1]!));
        i += 2;
      } else if (z < 64) {
        hb.push(0x40 | z);
        i++;
      } else {
        hb.push(0xc0 | (z >> 8), z & 0xff);
        i++;
      }
    }
  }
  const m = maskSize(g);
  const mb: number[] = [];
  const varint = (x: number): void => {
    while (x >= 0x80) {
      mb.push((x & 0x7f) | 0x80);
      x >>>= 7;
    }
    mb.push(x);
  };
  for (let j = 0; j < m.rows; j++) {
    let cur = 0;
    let run = 0;
    for (let i = 0; i < m.cols; i++) {
      const v = g.mask[j * m.cols + i] ? 1 : 0;
      if (v === cur) run++;
      else {
        varint(run);
        cur = v;
        run = 1;
      }
    }
    varint(run);
  }
  return { e0: g.e0, n0: g.n0, cellNm: g.cellNm, cols: g.cols, rows: g.rows, maskScale: g.maskScale, h: toBase64(hb), m: toBase64(mb) };
}

export function unpackTerrain(p: PackedTerrain): TerrainGrid {
  const heights = new Float32Array(p.cols * p.rows);
  const hb = fromBase64(p.h);
  let k = 0;
  for (let j = 0; j < p.rows; j++) {
    let prev = 0;
    let i = 0;
    while (i < p.cols) {
      const b = hb[k++]!;
      if ((b & 0xc0) === 0) {
        prev += unzig(b >> 3);
        heights[j * p.cols + i++] = prev;
        prev += unzig(b & 7);
        heights[j * p.cols + i++] = prev;
      } else if ((b & 0xc0) === 0x40) {
        prev += unzig(b & 0x3f);
        heights[j * p.cols + i++] = prev;
      } else if ((b & 0xc0) === 0x80) {
        const n = (b & 0x3f) + 1;
        for (let q = 0; q < n; q++) heights[j * p.cols + i++] = prev;
      } else {
        prev += unzig(((b & 0x3f) << 8) | hb[k++]!);
        heights[j * p.cols + i++] = prev;
      }
    }
  }
  const g: TerrainGrid = { e0: p.e0, n0: p.n0, cellNm: p.cellNm, cols: p.cols, rows: p.rows, heights, mask: new Uint8Array(0), maskScale: p.maskScale };
  const m = maskSize(g);
  const mask = new Uint8Array(m.cols * m.rows);
  const mb = fromBase64(p.m);
  let q = 0;
  const varint = (): number => {
    let x = 0;
    let shift = 0;
    for (;;) {
      const b = mb[q++]!;
      x |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return x;
      shift += 7;
    }
  };
  for (let j = 0; j < m.rows; j++) {
    let i = 0;
    let cur = 0;
    while (i < m.cols) {
      const run = varint();
      if (cur === 1) mask.fill(1, j * m.cols + i, j * m.cols + i + run);
      i += run;
      cur = 1 - cur;
    }
  }
  g.mask = mask;
  return g;
}
