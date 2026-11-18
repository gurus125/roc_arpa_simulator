import { Vec2, add, angleDiffDeg, bearingOf, fromPolar, length, sub } from "../core/vec";
import { rangeBearing } from "../core/nav";
import {
  BAND_DATA, World, RadarControls, rcsForDetectionRange, shorelineDetectionNm, targetLengthM, detectionProbability, effectiveSignal, isLand, landHides, lineOfSightBlocked, rainClutterProbability,
  relativeBearing, seaClutterProbability, maskedByClutter, SIDE_LOBES, THRESHOLD, INDIRECT_MIN_SIGNAL, INDIRECT_MAX_RANGE_NM, INDIRECT_STRENGTH,
} from "../engine/index";
import { ArpaConfig } from "./config";

/** "false": a multiple, side-lobe or indirect echo of a strong, close target, or a mark of interference from another radar. */
export type PlotKind = "target" | "land" | "clutter" | "false";

/** One echo as the ARPA plot extractor reports it after one antenna revolution. */
export interface ArpaPlot {
  /** Position relative to own ship in the GYRO frame (includes gyro error and noise), NM. */
  rel: Vec2;
  kind: PlotKind;
  /** Truth, for the instructor only: ids of the targets that made this plot. Empty for land/clutter. */
  truthIds: number[];
  /**
   * A land plot that is part of an echo `landEchoMinM` or more across in range or in bearing: automatic
   * acquisition leaves it out. Only worked out when the tracker asks for it (see `landContext`).
   */
  landSized?: boolean;
}

/** One cell of coastline echo: its place on the cell grid and its position from own ship, NM. */
export interface LandCell {
  i: number;
  j: number;
  v: Vec2;
}

/**
 * The size of the land echo each cell belongs to, metres: cells that touch (sideways or cornerwise) form one
 * echo, and its size is the larger of its extent in range and its extent in bearing, each with one cell
 * added because a cell stands for a stretch of coast one cell long. Returned in the order of `cells`.
 */
export function landEchoExtentsM(cells: LandCell[], cellNm: number): number[] {
  const at = new Map<string, number>();
  cells.forEach((c, k) => at.set(`${c.i},${c.j}`, k));
  const group = cells.map(() => -1);
  const out = cells.map(() => 0);
  for (let k = 0; k < cells.length; k++) {
    if (group[k] !== -1) continue;
    const members: number[] = [];
    const stack = [k];
    group[k] = k;
    while (stack.length > 0) {
      const m = stack.pop()!;
      members.push(m);
      const c = cells[m]!;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue;
        const n = at.get(`${c.i + di},${c.j + dj}`);
        if (n !== undefined && group[n] === -1) {
          group[n] = k;
          stack.push(n);
        }
      }
    }
    const b0 = bearingOf(cells[k]!.v);
    let rMin = Infinity, rMax = -Infinity, bMin = 0, bMax = 0, rSum = 0;
    for (const m of members) {
      const r = length(cells[m]!.v);
      const b = angleDiffDeg(bearingOf(cells[m]!.v), b0);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
      bMin = Math.min(bMin, b);
      bMax = Math.max(bMax, b);
      rSum += r;
    }
    const inRange = rMax - rMin + cellNm;
    const inBearing = (((bMax - bMin) * Math.PI) / 180) * (rSum / members.length) + cellNm;
    const extentM = Math.max(inRange, inBearing) * 1852;
    for (const m of members) out[m] = extentM;
  }
  return out;
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
  landSized?: boolean;
}

/**
 * The ARPA's own view of one antenna revolution. It uses the same signal model as the PPI
 * picture but a FIXED receiver setting (config `receiver`), so the operator's display controls
 * (gain, clutter, range scale) never change what is tracked. Then it adds
 * measurement noise and the gyro error, and merges echoes that the radar cannot resolve.
 *
 * Simplification: the whole revolution is treated as one instant.
 * `wantLand(relTrue)` limits the (expensive) coastline plots to where the tracker needs them.
 * `landContext(relTrue)` names more coastline, round the acquisition zones, that is looked at only to measure
 * how large each land echo is (`landSized`); it gives no plots of its own.
 */
/**
 * Bearing error from the tilt of the antenna as the ship rolls and pitches, degrees. An antenna
 * tilted by a roll angle r about the fore-and-aft line, or a pitch angle p about the athwartships
 * line, measures the bearing of a target at relative bearing b with an error of about
 * (p² - r²) / 4 x sin 2b (angles in radians): nothing ahead, astern and abeam, most on the bows and
 * quarters. With 10° of roll this gives 0.44° at full roll and 0.22° on average, as IEC 62388:2013
 * Annex E.2.2 states for its test (and Bole, Wall and Norris 9.4: unstable platform or antenna tilt).
 */
export function antennaTiltErrorDeg(relBearingDeg: number, rollDeg: number, pitchDeg: number): number {
  const rad = Math.PI / 180;
  const r = rollDeg * rad, p = pitchDeg * rad;
  return (((p * p - r * r) / 4) * Math.sin(2 * relBearingDeg * rad)) / rad;
}

/**
 * Parallax from own ship's roll (Radar and ARPA Manual, 3rd edition, 9.4.2.3 and 9.4.3.1): the aerial, H metres
 * above the roll axis, swings sideways by H sin(roll), so a target at relative bearing theta and range R is seen
 * turned by (180 / pi) H sin(roll) cos(theta) / R degrees and nearer or further by H sin(roll) sin(theta). Roll to
 * starboard (positive) carries the aerial to starboard: a target ahead seems to move to port, one on the starboard
 * beam to come nearer. Returns the bearing error, degrees, and the range error, NM.
 */
export function rollParallax(relBearingDeg: number, rollDeg: number, rangeNm: number, heightAboveRollAxisM: number): { bearingDeg: number; rangeNm: number } {
  const rad = Math.PI / 180;
  const side = heightAboveRollAxisM * Math.sin(rollDeg * rad); // metres to starboard
  const R = Math.max(rangeNm, 0.01) * 1852;
  return { bearingDeg: -(side * Math.cos(relBearingDeg * rad)) / R / rad, rangeNm: -(side * Math.sin(relBearingDeg * rad)) / 1852 };
}

/** Scans counted for each fading target (see `Target.paint`). */
const paintScans = new WeakMap<object, number>();
/**
 * Whether a fading target is painted on this scan: the paints are spread evenly, so a target with
 * `paint` 0.5 is painted on every other scan, which is 5 out of any 10 consecutive scans (the
 * visibility IEC 62388 11.3.9 requires a tracker to keep tracking through).
 */
export function paintedThisScan(t: object, paint: number): boolean {
  const k = paintScans.get(t) ?? 0;
  paintScans.set(t, k + 1);
  return Math.floor((k + 1) * paint + 1e-9) > Math.floor(k * paint + 1e-9);
}

export function extractPlots(
  w: World,
  cfg: ArpaConfig,
  rng: () => number,
  wantLand: (relTrue: Vec2) => boolean = () => false,
  landContext: ((relTrue: Vec2) => boolean) | null = null,
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
    const sig = { rcs: t.rcs, height: t.height, rangeNm: rb.range, relBearing: relativeBearing(rb.bearing, heading), pos: t.pos, kind: t.kind };
    const e = effectiveSignal(w, sig, rx);
    if (rng() >= detectionProbability(e)) continue;
    if (maskedByClutter(w, sig, e, rx)) continue; // weaker than the sea or rain clutter around it
    if (landHides(w, t.pos, t.height)) continue; // behind land
    if (t.paint !== undefined && !paintedThisScan(t, t.paint)) continue; // a fading target is missed on some scans
    // Scintillation: the centre of a real echo wanders a little from scan to scan.
    // (IMO A.823(19) appendix 3: glint is along the length of the target; across it is negligible.)
    const along = t.speed > 0.1 ? fromPolar(t.course, gaussian(rng) * cfg.scintillationNm * (targetLengthM(t) / 200)) : { e: 0, n: 0 };
    const wander = along;
    tgt.push({ relTrue: add(sub(t.pos, w.own.pos), wander), kind: "target", truthIds: [t.id], strength: e });
    // False echoes of a strong, close target reach the tracker as they reach the picture, and can be acquired
    // (Radar and ARPA Manual, 3rd edition, 3.9). The same conditions and levels as on the picture (engine/scan.ts).
    if (!cfg.falseEchoes) continue;
    const seen = (level: number): boolean => level >= THRESHOLD / 2 && rng() < detectionProbability(level);
    if (t.rcs >= 0.8 && rb.range < 1.5) {
      // Multiple echoes at twice and three times the range, on the same bearing.
      for (const k of [2, 3]) if (seen((Math.min(e, 5) * Math.pow(0.3, k - 1)) / k)) raw.push({ relTrue: fromPolar(rb.bearing, rb.range * k), kind: "false", truthIds: [], strength: 0.4 });
    }
    for (const lobe of SIDE_LOBES) {
      // Side-lobe echoes at the target's own range, either side of it.
      const es = e * Math.pow(10, -lobe.downDb / 10);
      if (es < THRESHOLD / 2) break;
      for (const sgn of [-1, 1]) if (seen(es)) raw.push({ relTrue: fromPolar(rb.bearing + sgn * lobe.offDeg, rb.range), kind: "false", truthIds: [], strength: 0.4 });
    }
    if (e >= INDIRECT_MIN_SIGNAL && rb.range <= INDIRECT_MAX_RANGE_NM) {
      // Indirect echoes by way of own ship's funnel or mast: in the shadow sector, at the target's own range.
      for (const s of w.radar.shadowSectors) {
        const mid = (((s.from + ((((s.to - s.from) % 360) + 360) % 360) / 2) % 360) + 360) % 360;
        if (Math.abs(((sig.relBearing - mid + 540) % 360) - 180) > 20 && seen(e * INDIRECT_STRENGTH)) raw.push({ relTrue: fromPolar(heading + mid, rb.range), kind: "false", truthIds: [], strength: 0.4 });
      }
    }
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
  const landCells: LandCell[] = [];
  const landPlots: (RawPlot | null)[] = [];
  const maxR = cfg.maxRangeNm;
  for (const s of w.coastSamples) {
    // Most samples are far from any track: the cheap tests first.
    const de = s.pos.e - w.own.pos.e;
    const dn = s.pos.n - w.own.pos.n;
    if (de > maxR || de < -maxR || dn > maxR || dn < -maxR) continue;
    const v = { e: de, n: dn };
    const wanted = wantLand(v);
    if (!wanted && !(landContext && landContext(v))) continue;
    const r = length(v);
    if (r > maxR) continue;
    const ci = Math.floor(s.pos.e / cfg.landCellNm), cj = Math.floor(s.pos.n / cfg.landCellNm);
    const key = `${ci},${cj}`;
    if (cells.has(key)) continue;
    const e = effectiveSignal(w, { rcs: rcsForDetectionRange(shorelineDetectionNm(s.heightM)), height: s.heightM, rangeNm: r, relBearing: relativeBearing(bearingOf(v), heading), pos: s.pos, kind: "coast" }, rx);
    if (rng() >= detectionProbability(e)) continue;
    // With terrain, the shoreline is hidden by higher land in front of it; drawn coastlines hide what lies behind them.
    if (w.terrain ? landHides(w, s.pos, s.heightM) : lineOfSightBlocked(w, s.pos, s.edge)) continue;
    cells.add(key);
    const plot: RawPlot | null = wanted ? { relTrue: v, kind: "land", truthIds: [], strength: 1 } : null;
    if (plot) raw.push(plot);
    if (landContext) {
      landCells.push({ i: ci, j: cj, v });
      landPlots.push(plot);
    }
  }
  if (landContext) {
    // How large is the echo each land plot belongs to? (Echoes as large as land are not acquired automatically.)
    const extents = landEchoExtentsM(landCells, cfg.landCellNm);
    landPlots.forEach((p, k) => {
      if (p && extents[k]! >= cfg.landEchoMinM) p.landSized = true;
    });
  }

  // Sea clutter near own ship.
  if (w.env.seaState > 0) {
    const maxR = cfg.clutterRangeNm;
    for (let i = 0; i < cfg.clutterSamplesPerScan; i++) {
      const r = Math.max(0.05, maxR * Math.pow(rng(), 2));
      const rel = 360 * rng();
      if (rng() < seaClutterProbability(w, r, rel, rx)) {
        const at = add(w.own.pos, fromPolar(rel + heading, r));
        if (isLand(w, at) || landHides(w, at, 1)) continue; // no sea clutter on land or in its shadow
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

  // Interference from another radar: without interference rejection some of its marks get through the plot
  // extractor, anywhere on the picture and different on every scan.
  if (w.env.interference && !w.radar.controls.interferenceRejection) {
    for (let i = 0; i < cfg.interferencePlotsPerScan; i++) raw.push({ relTrue: fromPolar(360 * rng(), cfg.maxRangeNm * rng()), kind: "false", truthIds: [], strength: 0.4 });
  }

  // Measurement: gyro-referenced bearing plus noise, range plus noise. The sensor errors of the radar
  // (noise, and the tilt of the antenna as the ship rolls and pitches) are limited together to
  // bearingErrorLimitDeg; a gyro error set by the instructor comes on top.
  const g = w.sensors.gyroErrorDeg;
  const sw = w.own.seaway;
  return raw.map((p) => {
    const r0 = length(p.relTrue);
    const tb = bearingOf(p.relTrue);
    const rel = relativeBearing(tb, heading);
    // The aerial's height above the roll axis is taken as its height above the sea (the roll axis lies near the waterline).
    const par = sw ? rollParallax(rel, sw.rollDeg, r0, w.own.antennaHeight) : { bearingDeg: 0, rangeNm: 0 };
    const r = Math.max(0, r0 + par.rangeNm + gaussian(rng) * (r0 < cfg.shortPulseRangeNm ? cfg.rangeNoiseShortNm : cfg.rangeNoiseNm));
    const tilt = sw ? antennaTiltErrorDeg(rel, sw.rollDeg, sw.pitchDeg) : 0;
    const lim = cfg.bearingErrorLimitDeg;
    const err = Math.max(-lim, Math.min(lim, gaussian(rng) * cfg.bearingNoiseDeg + tilt + par.bearingDeg));
    const b = tb + g + err;
    const out: ArpaPlot = { rel: fromPolar(b, r), kind: p.kind, truthIds: p.truthIds };
    if (p.landSized) out.landSized = true;
    return out;
  });
}
