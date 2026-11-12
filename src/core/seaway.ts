/**
 * Own ship in a seaway: how the sea makes her roll, pitch, heave and yaw, and what a rolling
 * ship does to the radar beam (STCW Code B-I/12 paragraph 5.5).
 *
 * The wave physics is standard (WMO sea state code, deep-water wave speed, encounter period,
 * a Gaussian beam). The SHIP'S RESPONSE figures are placeholders: they give motions of a
 * believable size but come from no ship's data. See RESPONSE below.
 */

/** Significant wave height for sea state 0 to 9 (WMO code 3700), metres: the middle of each band (9: its lower limit). */
export const SEA_STATE_WAVE_M = [0, 0.05, 0.3, 0.875, 1.875, 3.25, 5, 7.5, 11.5, 14] as const;

export function waveHeightM(seaState: number): number {
  const s = Math.min(9, Math.max(0, seaState));
  const lo = Math.floor(s);
  const hi = Math.min(9, lo + 1);
  return SEA_STATE_WAVE_M[lo]! + (SEA_STATE_WAVE_M[hi]! - SEA_STATE_WAVE_M[lo]!) * (s - lo);
}

/** Peak period of a fully developed wind sea of this height, seconds: about 5 x sqrt(height) (Pierson-Moskowitz). */
export function wavePeriodS(heightM: number): number {
  return 5 * Math.sqrt(Math.max(0, heightM));
}

/** Speed of a deep-water wave of this period, m/s: c = g T / (2 pi). */
export function waveSpeedMs(periodS: number): number {
  return (9.80665 * periodS) / (2 * Math.PI);
}

const KN_TO_MS = 1852 / 3600;

/**
 * Period at which a ship meets the waves, seconds. `seaOffBowDeg` is the angle between the ship's
 * head and the direction the sea comes FROM: 0 = head sea, 90 = beam sea, 180 = following sea.
 * Heading into the sea shortens the period; running with it lengthens it.
 */
export function encounterPeriodS(wavePeriod: number, shipSpeedKn: number, seaOffBowDeg: number): number {
  const c = waveSpeedMs(wavePeriod);
  if (c <= 0) return 0;
  const closing = 1 + (shipSpeedKn * KN_TO_MS * Math.cos((seaOffBowDeg * Math.PI) / 180)) / c;
  return wavePeriod / Math.max(0.2, Math.abs(closing));
}

/** Ship response, PLACEHOLDERS: degrees (or metres) of motion per metre of wave height for a ship 120 m long, and the caps. */
export const RESPONSE = {
  rollDegPerM: 3, rollMaxDeg: 30,
  pitchDegPerM: 1, pitchMaxDeg: 8,
  yawDegPerM: 0.6, yawMaxDeg: 5,
  heaveMPerM: 0.4,
  /** Smaller ships move more: factor 120 / length, kept between these limits. */
  sizeMin: 0.4, sizeMax: 1.6,
} as const;

export interface SeawayResponse {
  /** Greatest roll, pitch and yaw either side of the mean, degrees, and heave, metres. */
  rollDeg: number;
  pitchDeg: number;
  yawDeg: number;
  heaveM: number;
  /** The ship rolls at her own period; she pitches, heaves and yaws at the period of encounter. Seconds. */
  rollPeriodS: number;
  encounterPeriodS: number;
}

/** A ship's own rolling period, seconds. PLACEHOLDER: 8 s plus 1 s for every 25 m of length. */
export function rollPeriodS(lengthM: number): number {
  return 8 + lengthM / 25;
}

/**
 * Size and period of the motions for a sea state, a sea direction relative to the bow, a speed and
 * a ship's length. Rolling is greatest in a beam sea, pitching in a head or following sea, and
 * yawing with the sea on the bow or the quarter.
 */
export function seawayResponse(seaState: number, seaOffBowDeg: number, shipSpeedKn: number, lengthM: number): SeawayResponse {
  const h = waveHeightM(seaState);
  const mu = (seaOffBowDeg * Math.PI) / 180;
  const size = Math.min(RESPONSE.sizeMax, Math.max(RESPONSE.sizeMin, 120 / Math.max(1, lengthM)));
  return {
    rollDeg: Math.min(RESPONSE.rollMaxDeg, RESPONSE.rollDegPerM * h * size * Math.abs(Math.sin(mu))),
    pitchDeg: Math.min(RESPONSE.pitchMaxDeg, RESPONSE.pitchDegPerM * h * size * Math.abs(Math.cos(mu))),
    yawDeg: Math.min(RESPONSE.yawMaxDeg, RESPONSE.yawDegPerM * h * size * Math.abs(Math.sin(2 * mu))),
    heaveM: RESPONSE.heaveMPerM * h,
    rollPeriodS: rollPeriodS(lengthM),
    encounterPeriodS: encounterPeriodS(wavePeriodS(h), shipSpeedKn, seaOffBowDeg),
  };
}

/**
 * How far the radar beam is tipped off the horizon towards a relative bearing (degrees from the
 * bow) when the ship is rolled and pitched: all of the roll abeam, all of the pitch ahead and astern.
 */
export function beamTiltDeg(rollDeg: number, pitchDeg: number, relBearingDeg: number): number {
  const b = (relBearingDeg * Math.PI) / 180;
  return rollDeg * Math.sin(b) + pitchDeg * Math.cos(b);
}

/**
 * Fraction of the echo that is left when the beam is tipped `tiltDeg` off the target, for a
 * vertical beamwidth (between half-power points) of `beamwidthDeg`. Gaussian beam, out and back:
 * half the power is lost each way at half the beamwidth, so 1/4 remains there.
 */
export function verticalPatternFactor(tiltDeg: number, beamwidthDeg: number): number {
  if (beamwidthDeg <= 0) return 1;
  const x = tiltDeg / beamwidthDeg;
  return Math.pow(2, -8 * x * x);
}
