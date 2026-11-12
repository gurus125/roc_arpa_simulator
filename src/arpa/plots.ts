import { Vec2, add, angleDiffDeg, bearingOf, fromPolar, length, sub } from "../core/vec";
import { rangeBearing } from "../core/nav";
import {
  BAND_DATA, World, RadarControls, rcsForDetectionRange, shorelineDetectionNm, targetLengthM, detectionProbability, effectiveSignal, lineOfSightBlocked, rainClutterProbability,
  relativeBearing, seaClutterProbability,
} from "../engine/index";
import { ArpaConfig } from "./config";

export type PlotKind = "target" | "land" | "clutter";

/** One echo as the ARPA plot extractor reports it after one antenna revolution. */
export interface ArpaPlot {
  /** Position relative to own ship in the GYRO frame (includes gyro error and noise), NM. */
  rel: Vec2;
  kind: PlotKind;
  /** Truth, for the instructor only: ids of the targets that made this plot. Empty for land/clutter. */
  truthIds: number[];
}

/** Standard normal deviate from a uniform generator (Box-Muller). */
export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface RawPlot {
  relTrue: Vec2;
  kind: PlotKind;
  truthIds: number[];
  strength: number;
}

/**
 * The ARPA's own view of one antenna revolution. It uses the same signal model as the PPI
 * picture but a FIXED receiver setting (config `receiver`), so the operator's display controls
 * (gain, clutter, range scale) never change what is tracked. Then it adds
 * measurement noise and the gyro error, and merges echoes that the radar cannot resolve.
 *
 * Simplification: the whole revolution is treated as one instant.
 * `wantLand(relTrue)` limits the (expensive) coastline plots to where the tracker needs them.
 */
export function extractPlots(
  w: World,
  cfg: ArpaConfig,
  rng: () => number,
  wantLand: (relTrue: Vec2) => boolean = () => false,
): ArpaPlot[] {
  const heading = w.own.heading;
  const raw: RawPlot[] = [];
  // Fixed ARPA receiver: independent of the operator's gain, tuning, STC, FTC and range scale.
  const rx: RadarControls = {
    ...w.radar.controls,
    rangeNm: cfg.receiver.rangeNm, gain: cfg.receiver.gain, stc: cfg.receiver.stc, ftc: cfg.receiver.ftc,
    tuning: cfg.receiver.tuning ?? w.radar.tuningOptimum,
  };

  // Targets, merged when closer than the radar's resolution.
  const tgt: RawPlot[] = [];
  for (const t of w.targets) {
    const rb = rangeBearing(w.own.pos, t.pos);
    if (rb.range > cfg.maxRangeNm) continue;
    const e = effectiveSignal(w, { rcs: t.rcs, height: t.height, rangeNm: rb.range, relBearing: relativeBearing(rb.bearing, heading), pos: t.pos, kind: t.kind }, rx);
    if (rng() >= detectionProbability(e)) continue;
    // Scintillation: the centre of a real echo wanders a little from scan to scan.
    // (IMO A.823(19) appendix 3: glint is along the length of the target; across it is negligible.)
    const along = t.speed > 0.1 ? fromPolar(t.course, gaussian(rng) * cfg.scintillationNm * (targetLengthM(t) / 200)) : { e: 0, n: 0 };
    const wander = along;
    tgt.push({ relTrue: add(sub(t.pos, w.own.pos), wander), kind: "target", truthIds: [t.id], strength: e });
  }
  tgt.sort((a, b) => b.strength - a.strength);
  // Bearing discrimination: the configured figure is for X band; the wider S-band beam merges echoes further apart.
  const beamMerge = cfg.beamwidthDeg * (BAND_DATA[w.radar.band].beamwidthDeg / BAND_DATA.X.beamwidthDeg);
  const merged: { sum: Vec2; n: number; ids: number[]; first: Vec2 }[] = [];
  for (const p of tgt) {
    const r = length(p.relTrue);
    const b = bearingOf(p.relTrue);
    const m = merged.find(
      (x) => Math.abs(length(x.first) - r) < cfg.rangeResolutionNm && Math.abs(angleDiffDeg(bearingOf(x.first), b)) < beamMerge,
    );
    if (m) {
      m.sum = { e: m.sum.e + p.relTrue.e, n: m.sum.n + p.relTrue.n };
      m.n++;
      m.ids.push(...p.truthIds);
    } else {
      merged.push({ sum: { ...p.relTrue }, n: 1, ids: [...p.truthIds], first: p.relTrue });
    }
  }
  for (const m of merged) raw.push({ relTrue: { e: m.sum.e / m.n, n: m.sum.n / m.n }, kind: "target", truthIds: m.ids, strength: 1 });

  // Coastline, one plot per small cell.
  const cells = new Set<string>();
  for (const s of w.coastSamples) {
    const v = sub(s.pos, w.own.pos);
    const r = length(v);
    if (r > cfg.maxRangeNm || !wantLand(v)) continue;
    const key = `${Math.floor(s.pos.e / cfg.landCellNm)},${Math.floor(s.pos.n / cfg.landCellNm)}`;
    if (cells.has(key)) continue;
    const e = effectiveSignal(w, { rcs: rcsForDetectionRange(shorelineDetectionNm(s.heightM)), height: s.heightM, rangeNm: r, relBearing: relativeBearing(bearingOf(v), heading), pos: s.pos, kind: "coast" }, rx);
    if (rng() >= detectionProbability(e)) continue;
    if (lineOfSightBlocked(w, s.pos, s.edge)) continue;
    cells.add(key);
    raw.push({ relTrue: v, kind: "land", truthIds: [], strength: 1 });
  }

  // Sea clutter near own ship.
  if (w.env.seaState > 0) {
    const maxR = cfg.clutterRangeNm;
    for (let i = 0; i < cfg.clutterSamplesPerScan; i++) {
      const r = Math.max(0.05, maxR * Math.pow(rng(), 2));
      const rel = 360 * rng();
      if (rng() < seaClutterProbability(w, r, rel, rx)) {
        raw.push({ relTrue: fromPolar(rel + heading, r), kind: "clutter", truthIds: [], strength: 0.5 });
      }
    }
  }
  // Rain clutter.
  if (w.env.rain.length > 0) {
    const R = cfg.clutterRangeNm;
    for (let i = 0; i < cfg.clutterSamplesPerScan / 3; i++) {
      const v = fromPolar(360 * rng(), R * Math.sqrt(rng()));
      const p = rainClutterProbability(w, { e: w.own.pos.e + v.e, n: w.own.pos.n + v.n }, rx);
      if (p > 0 && rng() < p) raw.push({ relTrue: v, kind: "clutter", truthIds: [], strength: 0.4 });
    }
  }

  // Measurement: gyro-referenced bearing plus noise, range plus noise.
  const g = w.sensors.gyroErrorDeg;
  return raw.map((p) => {
    const r0 = length(p.relTrue);
    const r = Math.max(0, r0 + gaussian(rng) * (r0 < cfg.shortPulseRangeNm ? cfg.rangeNoiseShortNm : cfg.rangeNoiseNm));
    const b = bearingOf(p.relTrue) + g + gaussian(rng) * cfg.bearingNoiseDeg;
    return { rel: fromPolar(b, r), kind: p.kind, truthIds: p.truthIds };
  });
}
