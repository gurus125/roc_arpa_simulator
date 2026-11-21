/**
 * What waves do to a ship's way: the speed she loses (added resistance in a seaway) and the small sideways push of a
 * beam sea. The roll, pitch, heave and yaw are in seaway.ts.
 *
 * Speed loss: the form of Townsin and Kwon (1982) as extended by Kwon (2008):
 *   speed loss, per cent = Cmu x CF,   CF = 0.7 BN + BN^6.5 / (22 V^(2/3))
 * BN is the Beaufort number and V the displacement volume in cubic metres. CF in this form is the one given for normal
 * loading (it was checked in Hsin and others, J. Mar. Sci. Eng. 13 (2025) 42, Appendix A). Kwon's speed correction
 * (a function of the Froude number) is left out (taken as 1), and this one form is used for every type of ship:
 * PLACEHOLDERS. The direction factors Cmu are as the method is commonly quoted (head 1; bow, beam and following
 * seas as below); they have NOT been checked against Kwon's paper: PLACEHOLDER until they are.
 *
 * The method is for ships: small craft (boats under about 50 m) are not slowed by it in this simulator. A ship holds
 * her speed until the loss is more than her sea margin (SEA_MARGIN_SPEED).
 *
 * The sea a ship meets is turned into a Beaufort number through the "probable wave height" of the WMO Beaufort
 * scale: a sea of 3 m counts as force 6 whatever wind made it (a swell as well as a wind sea).
 */
import { DEG } from "./vec";

/** Probable wave height in the open sea for Beaufort force 0 to 12, metres (WMO Beaufort scale). */
export const BEAUFORT_WAVE_M = [0, 0.1, 0.2, 0.6, 1, 2, 3, 4, 5.5, 7, 9, 11.5, 14] as const;

/** The Beaufort number whose probable wave height this is, by straight lines between the table's values (0 to 12). */
export function beaufortOfWaveHeight(heightM: number): number {
  const h = Math.max(0, heightM);
  const t = BEAUFORT_WAVE_M;
  if (h >= t[12]) return 12;
  for (let b = 0; b < 12; b++) {
    const lo = t[b]!, hi = t[b + 1]!;
    if (h <= hi) return b + (h - lo) / (hi - lo);
  }
  return 12;
}

/**
 * Direction factor Cmu of the speed loss: `seaOffBowDeg` is the angle between the bow and the direction the sea comes
 * FROM (0 head sea, 180 following sea). Head (0 to 30): 1. Bow (30 to 60): (1.7 - 0.03 (BN - 4)^2) / 2. Beam (60 to
 * 150): (0.9 - 0.06 (BN - 6)^2) / 2. Following (150 to 180): (0.4 - 0.03 (BN - 8)^2) / 2. Never below 0. PLACEHOLDER
 * (see the top of this file).
 */
export function waveDirectionFactor(bn: number, seaOffBowDeg: number): number {
  const d = ((seaOffBowDeg % 360) + 360) % 360;
  const a = d > 180 ? 360 - d : d; // 0 = head sea, 180 = following sea
  const f =
    a <= 30 ? 1
    : a <= 60 ? (1.7 - 0.03 * (bn - 4) ** 2) / 2
    : a <= 150 ? (0.9 - 0.06 * (bn - 6) ** 2) / 2
    : (0.4 - 0.03 * (bn - 8) ** 2) / 2;
  return Math.max(0, f);
}

/** The most speed a ship loses to the sea in this model, as a fraction (she is taken to keep steerage way). PLACEHOLDER. */
export const MAX_WAVE_SPEED_LOSS = 0.6;

/** Fraction of her calm-water speed a ship loses in waves (0 to MAX_WAVE_SPEED_LOSS). */
export function waveSpeedLoss(bn: number, seaOffBowDeg: number, displacementM3: number): number {
  if (bn <= 0 || displacementM3 <= 0) return 0;
  const cf = 0.7 * bn + bn ** 6.5 / (22 * displacementM3 ** (2 / 3));
  return Math.min(MAX_WAVE_SPEED_LOSS, Math.max(0, (waveDirectionFactor(bn, seaOffBowDeg) * cf) / 100));
}

/** Displacement volume from the main dimensions and block coefficient, cubic metres. */
export function displacementM3(lengthM: number, beamM: number, draughtM: number, blockCoeff: number): number {
  return lengthM * beamM * draughtM * blockCoeff;
}

/** Displacement of a ship known only by her length, cubic metres: 0.006 L^3, at least 20. PLACEHOLDER (a typical fullness). */
export function displacementFromLength(lengthM: number): number {
  return Math.max(20, 0.006 * lengthM ** 3);
}

/** A train of waves: the direction it comes FROM (degrees true) and its significant height, metres. */
export interface SeaComponent {
  fromDeg: number;
  heightM: number;
}

/** Significant height of seas running together (a wind sea and a swell): their energies add, so the heights add as squares. */
export function combinedWaveHeightM(seas: SeaComponent[]): number {
  return Math.sqrt(seas.reduce((s, c) => s + c.heightM * c.heightM, 0));
}

/**
 * Speed loss in several seas at once: the Beaufort number from their combined height, and the direction factor of
 * each sea weighted by its energy (height squared).
 */
export function seasSpeedLoss(seas: SeaComponent[], headingDeg: number, displacement: number): number {
  const h = combinedWaveHeightM(seas);
  if (h <= 0) return 0;
  const bn = beaufortOfWaveHeight(h);
  let f = 0;
  for (const c of seas) f += (c.heightM * c.heightM) / (h * h) * waveDirectionFactor(bn, c.fromDeg - headingDeg);
  if (bn <= 0 || displacement <= 0) return 0;
  const cf = 0.7 * bn + bn ** 6.5 / (22 * displacement ** (2 / 3));
  return Math.min(MAX_WAVE_SPEED_LOSS, Math.max(0, (f * cf) / 100));
}

/**
 * Sea margin: a ship's service speed is set with some power in hand (commonly 15 % more power, which is about 5 % more
 * speed, as power goes with the cube of speed), so she holds her speed until the waves would cost her more than that.
 * The speed she actually loses is the loss above the margin. PLACEHOLDER: one margin for every ship.
 */
export const SEA_MARGIN_SPEED = 0.05;

/** Shortest vessel the speed loss is applied to, metres (the method is for ships). */
export const WAVE_LOSS_MIN_LENGTH_M = 50;

/** Speed lost after the sea margin is used up (0 when the waves cost less than the margin). */
export function lossAfterSeaMargin(loss: number): number {
  return Math.max(0, loss - SEA_MARGIN_SPEED);
}

/** Sideways push of a beam sea: knots per square metre of wave height for a ship 120 m long, and the most it can be. PLACEHOLDERS. */
export const WAVE_DRIFT = { knPerM2: 0.03, maxKn: 1, sizeMin: 0.4, sizeMax: 2 } as const;

/**
 * Sideways speed the waves give a ship, knots, positive to starboard: away from the side the sea comes from, greatest
 * in a beam sea, nothing in a head or following sea. Smaller ships are pushed more (120 / length, within limits).
 */
export function waveDriftKn(seas: SeaComponent[], headingDeg: number, lengthM: number): number {
  const size = Math.min(WAVE_DRIFT.sizeMax, Math.max(WAVE_DRIFT.sizeMin, 120 / Math.max(1, lengthM)));
  let v = 0;
  for (const c of seas) v -= WAVE_DRIFT.knPerM2 * c.heightM * c.heightM * size * Math.sin((c.fromDeg - headingDeg) * DEG);
  return Math.max(-WAVE_DRIFT.maxKn, Math.min(WAVE_DRIFT.maxKn, v));
}
