import { targetLengthM } from "./world";
import { aspectFactor, echoShape } from "./echo";
import { Vec2, add, fromPolar, length, normalizeDeg, scale, sub } from "../core/vec";
import { footOfPerpendicular, mirrorPoint, reflectionPoint } from "../core/falseecho";
import {
  THRESHOLD, detectionProbability, effectiveSignal, noiseDensity, rainClutterProbability, rainIntensityAt,
  relativeBearing, seaClutterProbability, sensitivity, stcAttenuation,
} from "./signal";
import { World } from "./types";
import { pulseFor, rcsForDetectionRange, shorelineDetectionNm, unambiguousRangeNm } from "./band";
import { NM_M, effectiveEarthRadiusM, elevationAngle, isLandAt, landFaceDetectionNm, terrainHides, visibleLand } from "./terrain";
import { BAND_DATA } from "./band";
import { pointInPolygon } from "../core/nav";

export type HitKind =
  | "target" | "coast" | "multiple" | "sidelobe" | "sea-clutter" | "rain-clutter" | "noise" | "racon" | "sart" | "ramark" | "second-trace" | "interference"
  /** False echoes: mirror image in a structure, indirect echo by way of own ship's funnel or mast, the single echo of an overhead cable. */
  | "false" | "indirect" | "power-line";

/** An indirect echo needs a strong, close target: signal level and range limits, and its strength against the true echo. Placeholders. */
export const INDIRECT_MIN_SIGNAL = 6;
export const INDIRECT_MAX_RANGE_NM = 4;
export const INDIRECT_STRENGTH = 0.06;
/** A mirror image is this much weaker than a direct echo at the same path length; a bridge repeats itself inside this range. Placeholders. */
export const MIRROR_STRENGTH = 0.25;
export const BRIDGE_MULTIPLE_RANGE_NM = 1;
/** Spacing of the points that paint a bridge or a reflecting face, NM. */
export const STRUCTURE_SAMPLE_NM = 0.025;

/** Spacing of the 12 dots of a SART response, NM, and the range inside which a transponder answers (placeholder). */
export const SART_DOT_SPACING_NM = 0.64;
export const TRANSPONDER_RANGE_NM = 10;

/** A racon answers for part of the time only (it sweeps its frequency): seconds on and off. Placeholder. */
export const RACON_ON_SEC = 20;
export const RACON_PERIOD_SEC = 40;

/** Ranges (NM beyond the racon) painted by a Morse code: dash 0.3, dot 0.1, gap 0.1, starting 0.1 beyond the echo. */
export function raconSegments(code: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let r = 0.1;
  for (const ch of code) {
    const len = ch === "-" ? 0.3 : 0.1;
    out.push({ from: r, to: r + len });
    r += len + 0.1;
  }
  return out;
}

export interface Hit {
  /** World position (NM). */
  pos: Vec2;
  /** 0 to 1 brightness. */
  strength: number;
  kind: HitKind;
  /** Approximate size in screen pixels (used for speckle and for hits without a shape). */
  size: number;
  targetId?: number;
  /** Painted shape: angular width (degrees) and depth in range (NM). See engine/echo.ts. */
  arcDeg?: number;
  depthNm?: number;
  /** True when the paint starts at the hit's range and runs outward (land behind a shoreline); otherwise it is centred on the range. */
  outward?: boolean;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** How far inland a shoreline of this height paints, NM. PLACEHOLDER: 0.1 NM for flat land up to 0.5 NM for land of 60 m and more. */
export function landDepthNm(heightM: number): number {
  return clamp(0.1 + (0.4 * heightM) / 60, 0.1, 0.5);
}

function bearingOfVec(v: Vec2): number {
  return normalizeDeg(Math.atan2(v.e, v.n) * (180 / Math.PI));
}

function segmentParam(o: Vec2, p: Vec2, a: Vec2, b: Vec2): number | null {
  const r = sub(p, o);
  const s = sub(b, a);
  const denom = r.e * s.n - r.n * s.e;
  if (Math.abs(denom) < 1e-12) return null;
  const q = sub(a, o);
  const t = (q.e * s.n - q.n * s.e) / denom;
  const u = (q.e * r.n - q.n * r.e) / denom;
  if (u < 0 || u > 1) return null;
  return t;
}

/** True if land lies between own ship and the point (radar shadow behind headlands). */
export function lineOfSightBlocked(w: World, p: Vec2, ownEdge: number): boolean {
  for (let i = 0; i < w.edges.length; i++) {
    if (i === ownEdge) continue;
    const e = w.edges[i]!;
    const t = segmentParam(w.own.pos, p, e.a, e.b);
    if (t !== null && t > 1e-6 && t < 1 - 1e-6) return true;
  }
  return false;
}

/** Whether the point is on land: in the terrain's land mask, or inside a closed drawn coastline. */
export function isLand(w: World, p: Vec2): boolean {
  if (w.terrain) return isLandAt(w.terrain, p);
  return w.coasts.some((c) => c.closed && pointInPolygon(p, c.points));
}

/**
 * Whether land hides from the radar an object of `heightM` metres at `pos`: land between is seen at
 * an elevation as high as the object's top or higher (with the Earth's curve and the refraction of
 * the moment). With terrain, every piece of ground on the way counts; with drawn coastlines, each
 * coast crossed counts at its own height. Land within 0.08 NM of the object does not hide it.
 */
export function landHides(w: World, pos: Vec2, heightM: number): boolean {
  const re = effectiveEarthRadiusM(w.env.refraction ?? "standard", w.env.ducting);
  const ha = w.own.antennaHeight;
  if (w.terrain) return terrainHides(w.terrain, w.own.pos, pos, heightM, ha, re, Math.max(w.terrain.cellNm / 2, 0.02));
  const dist = length(sub(pos, w.own.pos));
  if (dist < 1e-6 || w.edges.length === 0) return false;
  const top = elevationAngle(heightM, dist * NM_M, ha, re);
  for (const e of w.edges) {
    const t = segmentParam(w.own.pos, pos, e.a, e.b);
    if (t === null || t <= 1e-6 || t >= 1 - 1e-6) continue;
    const dc = t * dist;
    if (dist - dc < 0.08) continue;
    if (elevationAngle(e.heightM, dc * NM_M, ha, re) >= top) return true;
  }
  return false;
}

/** Spacing of the bearings along which the land of a real area is looked at, degrees. */
export const TERRAIN_RAY_DEG = 0.25;

/**
 * Land echoes of a real area for the bearings between `start` and `start + width` (relative):
 * along each ray, the land the radar sees (terrain.ts), each piece returning by the height of the
 * face it shows, summed over the depth of the pulse. Neighbouring pieces painted on the same scan
 * are joined into one echo running outward.
 */
function terrainLandHits(w: World, start: number, width: number, rng: () => number, hits: Hit[]): void {
  const g = w.terrain;
  if (!g) return;
  const c = w.radar.controls;
  const heading = w.own.heading;
  const re = effectiveEarthRadiusM(w.env.refraction ?? "standard", w.env.ducting);
  const ha = w.own.antennaHeight;
  const step = Math.max(g.cellNm / 4, c.rangeNm / 480);
  const pulse = pulseFor(c.rangeNm, c.pulse);
  // Pieces of land within the depth of the pulse return together (half a pulse either side, to the nearest step).
  const halfWindow = Math.max(0, Math.floor((pulse.rangeDiscriminationNm + step) / 2 / step + 1e-9));
  const beam = BAND_DATA[w.radar.band].beamwidthDeg;
  const shape = echoShape(w.radar.band, c, c.rangeNm / 2);
  const k0 = Math.floor(start / TERRAIN_RAY_DEG) + 1;
  for (let k = k0; (k * TERRAIN_RAY_DEG - start) <= width + 1e-9; k++) {
    const rel = normalizeDeg(k * TERRAIN_RAY_DEG);
    const tb = normalizeDeg(rel + heading);
    const from = minRangeFloor(c.rangeNm);
    const cells = visibleLand(g, w.own.pos, tb, ha, re, from, c.rangeNm, step);
    if (cells.length === 0) continue;
    const idx = cells.map((x) => Math.round((x.rangeNm - from) / step));
    type Run = { first: number; last: number; sum: number; n: number; bucket: number };
    const st: { run: Run | null } = { run: null };
    const close = (): void => {
      const run = st.run;
      if (!run) return;
      const a = cells[run.first]!;
      const strength = run.sum / run.n;
      hits.push({
        pos: a.pos, strength, kind: "coast", size: 3, arcDeg: shape.arcDeg,
        depthNm: (cells[run.last]!.rangeNm - a.rangeNm) + step + shape.depthNm, outward: true,
      });
      st.run = null;
    };
    let lo = 0;
    let hi = 0;
    let sum = 0;
    for (let i = 0; i < cells.length; i++) {
      // Exposed height summed over the pulse: the visible pieces within half a pulse either side.
      while (hi < cells.length && idx[hi]! <= idx[i]! + halfWindow) sum += cells[hi++]!.exposedM;
      while (idx[lo]! < idx[i]! - halfWindow) sum -= cells[lo++]!.exposedM;
      const cell = cells[i]!;
      const e = effectiveSignal(w, { rcs: rcsForDetectionRange(landFaceDetectionNm(sum, cell.heightM, cell.rangeNm, beam)), height: cell.heightM, rangeNm: cell.rangeNm, relBearing: rel, pos: cell.pos, kind: "coast" });
      const painted = rng() < detectionProbability(e);
      if (!painted) {
        close();
        continue;
      }
      const strength = clamp(e / (THRESHOLD * 4), 0.35, 1);
      const bucket = Math.round(strength * 5);
      const prev = st.run;
      if (prev && idx[i]! === idx[prev.last]! + 1 && prev.bucket === bucket) {
        prev.last = i;
        prev.sum += strength;
        prev.n++;
      } else {
        close();
        st.run = { first: i, last: i, sum: strength, n: 1, bucket };
      }
    }
    close();
  }
}

/**
 * The echoes painted while the antenna sweeps from relative bearing `aFrom` to `aTo`
 * (degrees from the bow, clockwise). Everything the handout lists as an operator
 * consideration happens here: detection range, controls, clutter, shadow sectors, land
 * shadow, multiple echoes and side-lobe echoes.
 */
export function scanWedge(w: World, aFrom: number, aTo: number, rng: () => number): Hit[] {
  const hits: Hit[] = [];
  const c = w.radar.controls;
  const width = (((aTo - aFrom) % 360) + 360) % 360;
  if (width <= 0) return hits;
  const start = normalizeDeg(aFrom);
  const inWedge = (rel: number): boolean => {
    const off = (((rel - start) % 360) + 360) % 360;
    return off > 0 && off <= width;
  };
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const heading = w.own.heading;

  const emit = (
    trueBearing: number,
    range: number,
    e: number,
    kind: HitKind,
    size: number,
    id?: number,
  ): void => {
    if (range > c.rangeNm) return;
    const rel = relativeBearing(trueBearing, heading);
    if (!inWedge(rel)) return;
    if (rng() >= detectionProbability(e)) return;
    const pos = add(w.own.pos, fromPolar(trueBearing, range));
    const sh = echoShape(w.radar.band, c, range);
    const hit: Hit = { pos, strength: clamp(e / (THRESHOLD * 4), 0.35, 1), kind, size, arcDeg: sh.arcDeg, depthNm: sh.depthNm };
    if (id !== undefined) hit.targetId = id;
    hits.push(hit);
  };

  // Targets (ships, small craft, buoys, beacons).
  for (const t of w.targets) {
    const v = sub(t.pos, w.own.pos);
    const range = length(v);
    // Second-trace echo: with abnormal propagation a strong target beyond the unambiguous range
    // (set by the pulse repetition frequency) returns after the NEXT pulse has gone out, and is
    // painted at its range minus that distance, on the right bearing. Changing the pulse length
    // (and with it the PRF) moves or removes it; a real echo stays where it is.
    {
      const ru = unambiguousRangeNm(pulseFor(c.rangeNm, c.pulse).prfHz);
      if (w.env.ducting && range > ru && range - ru <= c.rangeNm) {
        const tb2 = bearingOfVec(v);
        const rel2 = relativeBearing(tb2, heading);
        const es = effectiveSignal(w, { rcs: t.rcs, height: t.height, rangeNm: range, relBearing: rel2, pos: t.pos, kind: t.kind });
        if (inWedge(rel2) && rng() < detectionProbability(es)) hits.push({ pos: add(w.own.pos, fromPolar(tb2, range - ru)), strength: 0.5, kind: "second-trace", size: 4, targetId: t.id, ...echoShape(w.radar.band, c, range - ru, targetLengthM(t), normalizeDeg((t.motion?.heading ?? t.course) - tb2), t.beamM) });
      }
    }
    if (range > c.rangeNm * 1.0) continue;
    const tb = bearingOfVec(v);
    const rel = relativeBearing(tb, heading);
    // Behind land the target is not seen, nor is anything it returns (worked out once, when needed).
    let hiddenMemo: boolean | null = null;
    const hidden = (): boolean => (hiddenMemo ??= landHides(w, t.pos, t.height));
    // Aspect: the angle between the target's heading and the line of sight. Beam-on returns more and paints wider; end-on returns less and paints deeper.
    const lenM = targetLengthM(t);
    const aspect = normalizeDeg((t.motion?.heading ?? t.course) - tb);
    const e = effectiveSignal(w, { rcs: t.rcs, height: t.height, rangeNm: range, relBearing: rel, pos: t.pos, kind: t.kind }) * (lenM > 0 ? aspectFactor(aspect) : 1);
    // A longer pulse paints a longer echo; echo stretch enlarges it further.
    const size = (3 + 4 * Math.min(1, Math.sqrt(t.rcs))) * (c.echoStretch ? 1.8 : 1) * Math.sqrt(pulseFor(c.rangeNm, c.pulse).microseconds / pulseFor(c.rangeNm).microseconds);
    if (inWedge(rel) && !hidden() && rng() < detectionProbability(e)) {
      hits.push({ pos: { ...t.pos }, strength: clamp(e / (THRESHOLD * 4), 0.35, 1), kind: "target", size, targetId: t.id, ...echoShape(w.radar.band, c, range, lenM, aspect, t.beamM) });
    }
    // Transponders answer X-band radar only (3 cm). Their response is painted outward from the echo.
    const answers = t.transponder === "sart" ? w.radar.band === "X" : (t.raconBand ?? "X") === "both" || (t.raconBand ?? "X") === w.radar.band;
    if (t.transponder && answers && range <= TRANSPONDER_RANGE_NM && inWedge(rel) && !hidden()) {
      if (t.transponder === "sart") {
        for (let i = 0; i < 12; i++) {
          const rk = range + i * SART_DOT_SPACING_NM;
          // Close to the SART the dots widen into arcs (side lobes trigger it too).
          const spread = range < 1 ? [-12, -6, 0, 6, 12] : [0];
          for (const off of spread) if (rk <= c.rangeNm) hits.push({ pos: add(w.own.pos, fromPolar(tb + off, rk)), strength: 0.9, kind: "sart", size: 4, targetId: t.id });
        }
      } else if (t.transponder === "ramark") {
        // A ramark transmits continuously: a broken line along its bearing, from near the centre to the edge. No range.
        for (let d = 0.15 * c.rangeNm; d <= c.rangeNm; d += c.rangeNm / 60) {
          if (Math.floor((d / c.rangeNm) * 30) % 2 === 0) hits.push({ pos: add(w.own.pos, fromPolar(tb, d)), strength: 0.7, kind: "ramark", size: 3, targetId: t.id });
        }
      } else if (w.time % RACON_PERIOD_SEC < RACON_ON_SEC) {
        for (const seg of raconSegments(t.raconCode ?? "-.-")) {
          for (let d = seg.from; d <= seg.to + 1e-9; d += 0.03) {
            if (range + d <= c.rangeNm) hits.push({ pos: add(w.own.pos, fromPolar(tb, range + d)), strength: 0.9, kind: "racon", size: 4, targetId: t.id });
          }
        }
      }
    }
    // Multiple echoes: a strong, close, large target returns repeated echoes at 2x and 3x range.
    if (t.rcs >= 0.8 && range < 1.5 && !hidden()) {
      for (const k of [2, 3]) {
        const rk = range * k;
        const base = Math.min(effectiveSignal(w, { rcs: t.rcs, height: t.height, rangeNm: range, relBearing: rel, pos: t.pos }), 5);
        const ek = (base * Math.pow(0.3, k - 1)) / k * stcAttenuation(rk, c.stc) / Math.max(stcAttenuation(range, c.stc), 1e-6);
        emit(tb, rk, ek, "multiple", size * 0.8, t.id);
      }
    }
    // Side-lobe echoes: arcs of weak echoes either side of a very strong, close target.
    if (e >= 8 && range <= 3 && !hidden()) {
      for (const off of [-9, 9]) emit(normalizeDeg(tb + off), range, e * 0.08, "sidelobe", 2.5, t.id);
    }
    // Indirect echo: part of the pulse goes out and back by way of own ship's funnel or mast, so a
    // strong, close target is painted a second time in the shadow sector, on the bearing of the
    // obstruction and at the target's own range.
    if (e >= INDIRECT_MIN_SIGNAL && range <= INDIRECT_MAX_RANGE_NM && !hidden()) {
      for (const s of w.radar.shadowSectors) {
        const mid = normalizeDeg(s.from + ((((s.to - s.from) % 360) + 360) % 360) / 2);
        if (Math.abs(((rel - mid + 540) % 360) - 180) > 20) emit(normalizeDeg(heading + mid), range, e * INDIRECT_STRENGTH, "indirect", 3);
      }
    }
  }

  // Man-made structures and the false echoes they give.
  for (const st of w.structures) {
    const foot = footOfPerpendicular(w.own.pos, st.a, st.b);
    const footV = sub(foot.point, w.own.pos);
    const footRange = length(footV);
    const signalAt = (pos: Vec2, rcs: number, height: number, rangeNm: number): number =>
      effectiveSignal(w, { rcs, height, rangeNm, relBearing: relativeBearing(bearingOfVec(sub(pos, w.own.pos)), heading), pos });
    if (st.kind === "power-line") {
      // An overhead cable returns only where the beam meets it at right angles: one echo, on a steady
      // bearing, closing as the ship approaches. It looks like a vessel on a collision course.
      if (foot.onSegment && footRange > 0.02) emit(bearingOfVec(footV), footRange, signalAt(foot.point, 0.2, 25, footRange), "power-line", 3);
      continue;
    }
    // A bridge or a large flat face paints as a line.
    const ab = sub(st.b, st.a);
    const n = Math.max(1, Math.round(length(ab) / STRUCTURE_SAMPLE_NM));
    for (let i = 0; i <= n; i++) {
      const p = add(st.a, scale(ab, i / n));
      const v = sub(p, w.own.pos);
      const r = length(v);
      if (r > c.rangeNm || r < 0.02) continue;
      const es = signalAt(p, 1, 20, r);
      emit(bearingOfVec(v), r, es, "coast", 3);
      // Close to a bridge the pulse bounces between ship and bridge: the part of the bridge square
      // on to the ship is painted again at twice the range, beyond the bridge.
      if (st.kind === "bridge" && foot.onSegment && footRange < BRIDGE_MULTIPLE_RANGE_NM && length(sub(p, foot.point)) < 0.15) emit(bearingOfVec(v), 2 * r, es * 0.15, "multiple", 2.5);
    }
    // Mirror images: a target on the same side as own ship is also seen by way of the face, and is
    // painted behind it, on the bearing of the reflecting point and at the length of the bent path.
    for (const t of w.targets) {
      if (!reflectionPoint(w.own.pos, t.pos, st.a, st.b)) continue;
      const image = mirrorPoint(t.pos, st.a, st.b);
      const v = sub(image, w.own.pos);
      const r = length(v);
      emit(bearingOfVec(v), r, signalAt(image, t.rcs, t.height, r) * MIRROR_STRENGTH, "false", 3);
    }
  }

  // Land. A real area with terrain: the ground the radar sees, ray by ray. Drawn coastlines: strong
  // echoes from the shoreline, but headlands cast radar shadow on what lies behind them.
  if (w.terrain) terrainLandHits(w, start, width, rng, hits);
  else for (const s of w.coastSamples) {
    const v = sub(s.pos, w.own.pos);
    const range = length(v);
    if (range > c.rangeNm) continue;
    const tb = bearingOfVec(v);
    const rel = relativeBearing(tb, heading);
    if (!inWedge(rel)) continue;
    const e = effectiveSignal(w, { rcs: rcsForDetectionRange(shorelineDetectionNm(s.heightM)), height: s.heightM, rangeNm: range, relBearing: rel, pos: s.pos, kind: "coast" });
    if (rng() >= detectionProbability(e)) continue;
    if (lineOfSightBlocked(w, s.pos, s.edge)) continue;
    // Land: the shoreline and the ground rising behind it return, so the paint runs inland from the edge (deeper for higher land).
    const land = echoShape(w.radar.band, c, range);
    hits.push({ pos: { ...s.pos }, strength: clamp(e / (THRESHOLD * 4), 0.35, 1), kind: "coast", size: 3, arcDeg: land.arcDeg, depthNm: land.depthNm + landDepthNm(s.heightM), outward: true });
  }

  // Sea clutter: a patch of speckle round own ship. STC removes it, and small close targets with it.
  if (w.env.seaState > 0) {
    const trials = Math.ceil(width * 40);
    const maxR = Math.min(c.rangeNm, 5);
    for (let i = 0; i < trials; i++) {
      const r = Math.max(minRangeFloor(c.rangeNm), maxR * Math.pow(rng(), 2));
      const rel = start + width * rng();
      const tb = normalizeDeg(rel + heading);
      const p = seaClutterProbability(w, r, rel);
      if (rng() < p) {
        const pos = add(w.own.pos, fromPolar(tb, r));
        // No sea clutter on land, nor on water in the shadow of land.
        if (isLand(w, pos) || landHides(w, pos, 1)) continue;
        hits.push({ pos, strength: 0.45, kind: "sea-clutter", size: 1.6 });
      }
    }
  }

  // Rain clutter inside rain zones. FTC reduces it.
  if (w.env.rain.length > 0) {
    const trials = Math.ceil(width * 30);
    for (let i = 0; i < trials; i++) {
      const r = c.rangeNm * rng();
      const rel = start + width * rng();
      const tb = normalizeDeg(rel + heading);
      const pos = add(w.own.pos, fromPolar(tb, r));
      if (rainIntensityAt(w, pos) <= 0) continue;
      const p = rainClutterProbability(w, pos);
      if (rng() < p) hits.push({ pos, strength: 0.4, kind: "rain-clutter", size: 1.8 });
    }
  }

  // Interference from another radar on the same band: dotted curved spokes that change every sweep.
  if (w.env.interference && !c.interferenceRejection) {
    const arms = 7;
    const phase = (w.time * 0.37) % 1;
    for (let a = 0; a < width; a += 0.7) {
      const rel = start + a;
      for (let k = 0; k < arms; k++) {
        const f = (((rel / 360) * 3 + k / arms + phase) % 1 + 1) % 1;
        if (rng() < 0.6) hits.push({ pos: add(w.own.pos, fromPolar(normalizeDeg(rel + heading), f * c.rangeNm)), strength: 0.5, kind: "interference", size: 1.8 });
      }
    }
  }

  // Receiver noise: appears when gain is set too high.
  const nd = noiseDensity(sens);
  if (nd > 0) {
    const trials = Math.ceil(width * 20 * (c.echoAverage ? 0.3 : 1));
    for (let i = 0; i < trials; i++) {
      if (rng() < nd * 0.3) {
        const r = c.rangeNm * rng();
        const rel = start + width * rng();
        hits.push({ pos: add(w.own.pos, fromPolar(normalizeDeg(rel + heading), r)), strength: 0.3, kind: "noise", size: 1.4 });
      }
    }
  }

  return hits;
}

function minRangeFloor(rangeNm: number): number {
  return rangeNm <= 3 ? 0.03 : 0.07;
}
