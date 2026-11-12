import { Vec2, angleDiffDeg, length, normalizeDeg, sub } from "../core/vec";
import { RadarControls, RadarSet, ShadowSector, TargetKind, World } from "./types";
import { pulseEnergyFactor, pulseFor, sBandFactor } from "./band";

/**
 * Simplified radar signal model, tuned so that the effects described in the ROC handout
 * show up on the screen. It is a teaching model, not a physical radar simulation.
 */

/** Display threshold: an echo stronger than this is shown. */
export const THRESHOLD = 0.35;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function gainFactor(gain: number): number {
  return 0.05 + 1.9 * (gain / 100);
}

/** Receiver response versus tuning. The best setting gives 1.0; a badly detuned set gives 0.2. */
export function tuningFactor(tuning: number, optimum: number): number {
  const x = (tuning - optimum) / 18;
  return 0.2 + 0.8 * Math.exp(-x * x);
}

export function sensitivity(c: RadarControls, optimum: number): number {
  return gainFactor(c.gain) * tuningFactor(c.tuning, optimum);
}

/**
 * Sea clutter control (STC). Reduces the gain at SHORT range, for targets and clutter alike,
 * so over-use removes small close targets as well as the clutter.
 */
export function stcAttenuation(rangeNm: number, stc: number): number {
  return Math.exp(-4 * (stc / 100) * Math.exp(-rangeNm / 2.5));
}

/** Rain clutter control (FTC) slightly weakens genuine echoes everywhere. */
/**
 * Automatic anti-clutter settings. PLACEHOLDER mapping (not from any maker's data): the sea
 * control setting chosen for a sea state, and the rain control setting for a rain intensity
 * (0-100). Like a real automatic control it is a compromise: weak echoes close in can be lost.
 */
export function autoSeaStc(seaState: number): number {
  return Math.round(clamp(seaState * 11, 0, 100));
}
export function autoRainFtc(rainIntensity: number): number {
  return Math.round(clamp(rainIntensity * 0.75, 0, 100));
}

export function ftcTargetFactor(ftc: number): number {
  return 1 - 0.3 * (ftc / 100);
}

export function ftcRainFactor(ftc: number): number {
  return 1 - 0.92 * (ftc / 100);
}

/** Sea clutter level at range (before receiver sensitivity and STC). */
export function seaClutter(rangeNm: number, seaState: number): number {
  return (seaState / 9) * 4 * Math.exp(-rangeNm / 1.2);
}

/** Rain intensity (0 to 1) at a world position. */
export function rainIntensityAt(w: World, p: Vec2): number {
  let m = 0;
  for (const z of w.env.rain) {
    if (length(sub(p, z.center)) <= z.radius) m = Math.max(m, z.intensity);
  }
  return m;
}

export function radarHorizonNm(antennaHeightM: number, targetHeightM: number, ducting: boolean): number {
  const h = 2.2 * (Math.sqrt(antennaHeightM) + Math.sqrt(targetHeightM));
  return ducting ? h * 2 : h;
}

/** Closest range at which an echo can be shown. Shorter pulse on the short range scales. */
export function minRangeNm(rangeScaleNm: number, pulse?: RadarControls["pulse"]): number {
  return pulseFor(rangeScaleNm, pulse).minRangeNm;
}

/** Raw echo strength before receiver effects. Inverse-square with range. */
export function echoStrength(rcs: number, rangeNm: number): number {
  return rcs * Math.pow(10 / Math.max(rangeNm, 0.02), 2);
}

function inSector(rel: number, s: ShadowSector): boolean {
  const width = normalizeDeg(s.to - s.from);
  return normalizeDeg(rel - s.from) <= width;
}

/** 1 normally; near zero inside a shadow sector. `relBearing` is measured from the bow. */
export function shadowFactor(radar: RadarSet, relBearing: number): number {
  for (const s of radar.shadowSectors) if (inSector(relBearing, s)) return 0.03;
  return 1;
}

export function noiseDensity(sens: number): number {
  return clamp((sens - 1.0) / 1.0, 0, 1);
}

export interface SignalInput {
  rcs: number;
  height: number;
  rangeNm: number;
  relBearing: number;
  pos: Vec2;
  /** Kind of target, for the difference between X and S band (IMO MSC.192(79) table 2). */
  kind?: TargetKind | "coast";
}

/** Effective echo level after the receiver and the operator's controls. Compare with THRESHOLD. */
export function effectiveSignal(w: World, s: SignalInput, c: RadarControls = w.radar.controls): number {
  if (s.rangeNm < minRangeNm(c.rangeNm, c.pulse)) return 0;
  if (s.rangeNm > radarHorizonNm(w.own.antennaHeight, s.height, w.env.ducting)) return 0;
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const rain = rainIntensityAt(w, s.pos);
  let e = echoStrength(s.rcs, s.rangeNm) * sens;
  e *= stcAttenuation(s.rangeNm, c.stc);
  e *= ftcTargetFactor(c.ftc);
  e *= 1 - (w.radar.band === "S" ? 0.15 : 0.5) * rain; // rain attenuates 3 cm waves far more than 10 cm
  if (w.radar.band === "S") e *= sBandFactor(s.kind); // small targets and buoys return less on 10 cm
  e *= shadowFactor(w.radar, s.relBearing);
  e *= pulseEnergyFactor(c.rangeNm, c.pulse);
  e *= w.radar.performance ?? 1;
  return e;
}

/** Probability that the echo is displayed on a given scan. Weak echoes come and go. */
export function detectionProbability(effective: number): number {
  return 1 / (1 + Math.exp(-(effective - THRESHOLD) / 0.08));
}

/**
 * Probability that sea clutter paints a speckle at this range and relative bearing on one scan.
 * Shared by the PPI picture and the ARPA plot extractor. The ARPA passes its own fixed receiver
 * setting, so the operator's gain/STC/FTC on the display do not change what the tracker sees.
 */
export function seaClutterProbability(w: World, rangeNm: number, relBearing: number, c: RadarControls = w.radar.controls): number {
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const level = seaClutter(rangeNm, w.env.seaState) * (w.radar.band === "S" ? 0.6 : 1) * sens * stcAttenuation(rangeNm, c.stc) * shadowFactor(w.radar, normalizeDeg(relBearing));
  return clamp((level - 0.8 * THRESHOLD) / THRESHOLD, 0, 1) * (c.echoAverage ? 0.3 : 1);
}

/** Probability that rain paints a speckle at this position on one scan (0 outside rain). */
export function rainClutterProbability(w: World, pos: Vec2, c: RadarControls = w.radar.controls): number {
  const inten = rainIntensityAt(w, pos);
  if (inten <= 0) return 0;
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const level = inten * 3 * sens * ftcRainFactor(c.ftc) * (w.radar.band === "S" ? 0.25 : 1);
  return clamp((level - 0.6 * THRESHOLD) / THRESHOLD, 0, 1) * 0.5 * (c.echoAverage ? 0.3 : 1);
}

export function relativeBearing(trueBearing: number, heading: number): number {
  return normalizeDeg(trueBearing - heading);
}

export { angleDiffDeg };
