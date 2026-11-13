import { Vec2, angleDiffDeg, length, normalizeDeg, sub } from "../core/vec";
import { RadarControls, RadarSet, Refraction, ShadowSector, TargetKind, World } from "./types";
import { BAND_DATA, pulseEnergyFactor, pulseFor, sBandFactor } from "./band";
import { beamTiltDeg, verticalPatternFactor } from "../core/seaway";

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

/**
 * How much further sea clutter reaches straight to windward than abeam of the wind, and how much
 * less straight to leeward, as a fraction. PLACEHOLDER: the book gives the shape of the pattern
 * (Bole and Dineley 3.6.1.3 and Figure 3.38: the upwind wave fronts are steeper, so "the radial
 * extent of sea clutter echoes will be found to be greater to windward than it is to leeward"),
 * not a figure.
 */
export const CLUTTER_WINDWARD = 0.3;

/**
 * Sea clutter level at range (before receiver sensitivity and STC). `windward` is the cosine of
 * the angle between the direction looked along and the direction the sea comes from: 1 looking
 * straight into the sea, 0 abeam of it, -1 looking down-sea.
 */
export function seaClutter(rangeNm: number, seaState: number, windward = 0): number {
  return (seaState / 9) * 4 * Math.exp(-rangeNm / (1.2 * (1 + CLUTTER_WINDWARD * windward)));
}

/** Direction the sea comes from when no wind is set, degrees true (the same as world.ts uses for the ship's motion). */
const SEA_FROM_DEFAULT_DEG = 270;

/**
 * Sea clutter with the pulse in use compared with the pulse the range scale would choose. The
 * patch of sea that answers at one moment is as deep as the pulse is long, so a shorter pulse
 * returns less clutter and a longer one more (Bole and Dineley 3.6.1.6: a long pulse improves the
 * response of sea clutter as of any target; a shorter pulse is a way to combat masking).
 */
export function clutterPulseFactor(rangeScaleNm: number, pulse?: RadarControls["pulse"]): number {
  return pulseFor(rangeScaleNm, pulse).microseconds / pulseFor(rangeScaleNm).microseconds;
}

/** Rain intensity (0 to 1) at a world position. */
export function rainIntensityAt(w: World, p: Vec2): number {
  let m = 0;
  for (const z of w.env.rain) {
    if (length(sub(p, z.center)) <= z.radius) m = Math.max(m, z.intensity);
  }
  return m;
}

/**
 * Detection range compared with the standard atmosphere. Bole and Dineley, Radar and ARPA Manual:
 * in sub-refraction "something of the order of 80%" of the standard range (3.8.2.1); in
 * super-refraction "increases of some 40% are not uncommon" (3.8.3.1). Both depend on how severe
 * the conditions are, so these are typical figures, not fixed ones.
 */
export const REFRACTION_FACTOR: Record<Refraction, number> = { standard: 1, sub: 0.8, super: 1.4 };

/**
 * Theoretical detection range from the heights of the antenna and the target, NM:
 * 2.21 (sqrt(h) + sqrt(H)) with the heights in metres, for the standard atmosphere (Bole and
 * Dineley 3.8.1). Ducting carries the energy round the Earth's curve; its factor of 2 here is a
 * placeholder (the book says only "considerably extending the detection ranges").
 */
export function radarHorizonNm(antennaHeightM: number, targetHeightM: number, ducting: boolean, refraction: Refraction = "standard"): number {
  const h = 2.21 * (Math.sqrt(antennaHeightM) + Math.sqrt(targetHeightM));
  return ducting ? h * 2 : h * REFRACTION_FACTOR[refraction];
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

/** How dense the receiver noise speckle is with these controls: 0 none, 1 the whole picture. */
export function noiseSpeckle(c: RadarControls, tuningOptimum: number): number {
  return noiseDensity(sensitivity(c, tuningOptimum));
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

/**
 * 1 on an even keel. When own ship is rolled or pitched the beam is tipped off the horizon, most
 * abeam for roll and most ahead and astern for pitch, and echoes there weaken or are lost.
 */
export function seawayFactor(w: World, relBearing: number): number {
  const sw = w.own.seaway;
  if (!sw) return 1;
  return verticalPatternFactor(beamTiltDeg(sw.rollDeg, sw.pitchDeg, relBearing), BAND_DATA[w.radar.band].verticalBeamwidthDeg);
}

/** Effective echo level after the receiver and the operator's controls. Compare with THRESHOLD. */
export function effectiveSignal(w: World, s: SignalInput, c: RadarControls = w.radar.controls): number {
  if (s.rangeNm < minRangeNm(c.rangeNm, c.pulse)) return 0;
  if (s.rangeNm > radarHorizonNm(w.own.antennaHeight, s.height, w.env.ducting, w.env.refraction ?? "standard")) return 0;
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const rain = rainIntensityAt(w, s.pos);
  let e = echoStrength(s.rcs, s.rangeNm) * sens;
  e *= stcAttenuation(s.rangeNm, c.stc);
  e *= ftcTargetFactor(c.ftc);
  e *= 1 - (w.radar.band === "S" ? 0.15 : 0.5) * rain; // rain attenuates 3 cm waves far more than 10 cm
  if (w.radar.band === "S") e *= sBandFactor(s.kind); // small targets and buoys return less on 10 cm
  e *= shadowFactor(w.radar, s.relBearing);
  e *= seawayFactor(w, s.relBearing);
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
  const wind = w.env.wind;
  const seaFrom = wind && wind.speedKn > 0 ? wind.from : SEA_FROM_DEFAULT_DEG;
  const windward = Math.cos((angleDiffDeg(w.own.heading + relBearing, seaFrom) * Math.PI) / 180);
  const level = seaClutter(rangeNm, w.env.seaState, windward) * clutterPulseFactor(c.rangeNm, c.pulse) * (w.radar.band === "S" ? 0.6 : 1) * sens * stcAttenuation(rangeNm, c.stc) * shadowFactor(w.radar, normalizeDeg(relBearing));
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
