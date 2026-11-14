import { Vec2, angleDiffDeg, length, normalizeDeg, sub } from "../core/vec";
import { RadarControls, RadarSet, Refraction, ShadowSector, TargetKind, World } from "./types";
import { BAND_DATA, pulseEnergyFactor, pulseFor, sBandFactor } from "./band";
import { beamTiltDeg, verticalPatternFactor } from "../core/seaway";
import { lengthInsideCircle } from "../core/nav";

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
 * Sea clutter with the pulse in use compared with the pulse the range scale would choose. A longer
 * pulse puts more energy on the sea as on any target (`pulseEnergyFactor`), and the patch of sea that
 * answers at one moment is as deep as half the pulse, so its cross-section grows with the pulse length
 * as well (Radar and ARPA Manual, 3rd edition, 2.7.4.1 and 3.6.1.6). Both are ratios of power, so the
 * strength goes with their square roots: a short pulse cuts the clutter more than it cuts a target,
 * a long pulse raises it more.
 */
export function clutterPulseFactor(rangeScaleNm: number, pulse?: RadarControls["pulse"]): number {
  return pulseEnergyFactor(rangeScaleNm, pulse) * Math.sqrt(pulseFor(rangeScaleNm, pulse).microseconds / pulseFor(rangeScaleNm).microseconds);
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

/**
 * Raw echo strength before receiver effects. The received POWER of an echo falls with the fourth
 * power of range (the radar equation: 1/R^2 on the way out and 1/R^2 on the way back; Radar and ARPA
 * Manual, 3rd edition, 2.6.1). The simulator's echo strength is the square root of that power (like a
 * voltage), so it falls with the square of range: at twice the range the strength is a quarter and the
 * power a sixteenth (12 dB less). Every factor that is a ratio of POWER (target cross-section, the
 * energy of the pulse, the radar's performance, the vertical beam pattern) is therefore applied as its
 * square root, and a detection range goes with the fourth root of any of them (twice the power, 1.19
 * times the range). `rcs` in a scenario is the strength at 10 NM (see `rcsForDetectionRange`).
 */
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
  // The vertical pattern gives the share of the POWER left; the echo strength is its square root (see echoStrength).
  return Math.sqrt(verticalPatternFactor(beamTiltDeg(sw.rollDeg, sw.pitchDeg, relBearing), BAND_DATA[w.radar.band].verticalBeamwidthDeg));
}

/**
 * Interference rejection compares successive pulses and keeps only what both return, so a very weak
 * echo that is not returned by every pulse is lost with the interference (Radar and ARPA Manual, 3rd
 * edition, 2.6.5.1: it reduces the detection of real targets by a small amount, and should not be used
 * when no interference is seen). Taken as a loss of 1 dB in echo power: a PLACEHOLDER, the book gives
 * no figure.
 */
export const IR_LOSS_DB = 1;

/** Effective echo level after the receiver and the operator's controls. Compare with THRESHOLD. */
export function effectiveSignal(w: World, s: SignalInput, c: RadarControls = w.radar.controls): number {
  if (s.rangeNm < minRangeNm(c.rangeNm, c.pulse)) return 0;
  if (s.rangeNm > radarHorizonNm(w.own.antennaHeight, s.height, w.env.ducting, w.env.refraction ?? "standard")) return 0;
  const sens = sensitivity(c, w.radar.tuningOptimum);
  let e = echoStrength(s.rcs, s.rangeNm) * sens;
  e *= stcAttenuation(s.rangeNm, c.stc);
  e *= ftcTargetFactor(c.ftc);
  e *= rainPathFactor(w, s.pos); // rain on the way there and back, X band far more than S band
  if (w.radar.band === "S") e *= sBandFactor(s.kind); // small targets and buoys return less on 10 cm
  e *= shadowFactor(w.radar, s.relBearing);
  e *= seawayFactor(w, s.relBearing);
  e *= pulseEnergyFactor(c.rangeNm, c.pulse);
  // Performance is the share of the echo power left (transmitter and receiver together); see echoStrength.
  e *= Math.sqrt(w.radar.performance ?? 1);
  if (c.interferenceRejection) e *= Math.pow(10, -IR_LOSS_DB / 20);
  return e;
}

/**
 * Rain on the path: rainfall rate that an intensity of 1 stands for, mm an hour. IMO's "heavy rain" (16 mm an
 * hour; MSC.192(79), Radar and ARPA Manual, 3rd edition, 3.2.5), so 0.25 is its "light rain" (4 mm an hour).
 */
export const RAIN_RATE_AT_FULL_MM_H = 16;

/**
 * Loss of echo power through rain, dB for each NM of rain the pulse crosses, out and back together, at an
 * intensity of 1 (in proportion to the rainfall rate below that). PLACEHOLDERS: the book gives the law (the
 * loss grows with the distance through the rain, far more at 3 cm than at 10 cm: 3.7.2) but no figure. X band
 * 1.5 dB a NM is about 0.4 dB a km one way, of the order published for heavy rain at 3 cm; S band a tenth.
 */
export const RAIN_LOSS_DB_PER_NM: Record<"X" | "S", number> = { X: 1.5, S: 0.15 };

/** Distance through rain from own ship to a point, NM, weighted by the intensity of each area of rain. */
export function rainPathNm(w: World, p: Vec2): number {
  let sum = 0;
  for (const z of w.env.rain) sum += z.intensity * lengthInsideCircle(w.own.pos, p, z.center, z.radius);
  return sum;
}

/** Share of echo strength left after the rain between own ship and a point (out and back): 1 with no rain on the path. */
export function rainPathFactor(w: World, p: Vec2): number {
  const db = RAIN_LOSS_DB_PER_NM[w.radar.band] * rainPathNm(w, p);
  return Math.pow(10, -db / 20);
}

/**
 * A target weaker than the clutter in its own cell cannot be shown: whatever suppresses the clutter
 * suppresses the target with it (Radar and ARPA Manual, 3rd edition, 3.6.2 for sea clutter and 3.7.4.4 for
 * rain, where the rain control shows only what rises above the rain). `e` is the target's effective
 * signal with these controls. The rain control (FTC) is left out of the comparison, because it acts on the
 * rain and the target alike before the leading edges are kept; every other control acts on both alike.
 */
export function maskedByClutter(w: World, s: SignalInput, e: number, c: RadarControls = w.radar.controls): boolean {
  const raw = e / ftcTargetFactor(c.ftc);
  const clutter = Math.max(seaClutterLevel(w, s.rangeNm, s.relBearing, c), rainClutterLevel(w, s.pos, c, false));
  return clutter > 0 && raw < clutter;
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
/**
 * Sea clutter strength at this range and relative bearing after the receiver and the controls, on the same
 * scale as a target's effective signal. Sea clutter is less at 10 cm than at 3 cm: its power goes about
 * inversely with the wavelength (Radar and ARPA Manual, 3rd edition, 3.6.1.5), so its strength with the
 * square root of that.
 */
export function seaClutterLevel(w: World, rangeNm: number, relBearing: number, c: RadarControls = w.radar.controls): number {
  if (w.env.seaState <= 0) return 0;
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const wind = w.env.wind;
  const seaFrom = wind && wind.speedKn > 0 ? wind.from : SEA_FROM_DEFAULT_DEG;
  const windward = Math.cos((angleDiffDeg(w.own.heading + relBearing, seaFrom) * Math.PI) / 180);
  const band = w.radar.band === "S" ? Math.sqrt(BAND_DATA.X.wavelengthCm / BAND_DATA.S.wavelengthCm) : 1;
  return seaClutter(rangeNm, w.env.seaState, windward) * clutterPulseFactor(c.rangeNm, c.pulse) * band * sens * stcAttenuation(rangeNm, c.stc) * shadowFactor(w.radar, normalizeDeg(relBearing));
}

export function seaClutterProbability(w: World, rangeNm: number, relBearing: number, c: RadarControls = w.radar.controls): number {
  const level = seaClutterLevel(w, rangeNm, relBearing, c);
  return clamp((level - 0.8 * THRESHOLD) / THRESHOLD, 0, 1) * (c.echoAverage ? 0.3 : 1);
}

/** Range at which rain clutter has the strength 3 x the square root of the intensity, before the controls. A PLACEHOLDER scale. */
export const RAIN_CLUTTER_REF_NM = 2;

/**
 * Rain clutter strength at a position after the receiver and the controls (0 outside rain), on the same
 * scale as a target's effective signal. The rules are those of the Radar and ARPA Manual, 3rd edition:
 * the power goes with the rainfall rate (3.7.1.3), falls with the square of range because the volume of
 * rain in the beam grows with range (3.7.1.4), goes inversely with the square of the wavelength, so about
 * a tenth on S band (3.7.1.1), and grows with the pulse like sea clutter (3.7.4.1). The strength is the
 * square root of the power (see echoStrength). The rain in front attenuates the rain behind it; the sea
 * control acts on rain close to own ship (3.7.4.3); the rain control acts unless `withFtc` is false.
 */
export function rainClutterLevel(w: World, pos: Vec2, c: RadarControls = w.radar.controls, withFtc = true): number {
  const inten = rainIntensityAt(w, pos);
  if (inten <= 0) return 0;
  const r = Math.max(0.25, length(sub(pos, w.own.pos)));
  const sens = sensitivity(c, w.radar.tuningOptimum);
  const band = w.radar.band === "S" ? BAND_DATA.X.wavelengthCm / BAND_DATA.S.wavelengthCm : 1;
  return Math.sqrt(inten) * 3 * (RAIN_CLUTTER_REF_NM / r) * band * clutterPulseFactor(c.rangeNm, c.pulse) * sens * stcAttenuation(r, c.stc) * rainPathFactor(w, pos) * (withFtc ? ftcRainFactor(c.ftc) : 1);
}

/** Probability that rain paints a speckle at this position on one scan (0 outside rain). */
export function rainClutterProbability(w: World, pos: Vec2, c: RadarControls = w.radar.controls): number {
  const level = rainClutterLevel(w, pos, c);
  if (level <= 0) return 0;
  return clamp((level - 0.6 * THRESHOLD) / THRESHOLD, 0, 1) * 0.5 * (c.echoAverage ? 0.3 : 1);
}

export function relativeBearing(trueBearing: number, heading: number): number {
  return normalizeDeg(trueBearing - heading);
}

export { angleDiffDeg };
