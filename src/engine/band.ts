import { TargetKind } from "./types";

/**
 * Radar band data and the IMO detection-range table.
 *
 * TABLE 2 of IMO resolution MSC.192(79) ("Minimum detection ranges in clutter-free conditions",
 * antenna 15 m above the sea, target shown on at least 8 of 10 scans) is entered below exactly as
 * printed. The simulator's echo strengths are CALIBRATED to it: `rcsForDetectionRange` gives the
 * echo strength at which a target is first seen on 8 scans in 10 at the stated range, with the
 * receiver tuned and the gain at its middle setting.
 *
 * BAND_DATA and PULSES are NOT from an IMO document: they are typical values for a merchant-ship
 * radar, entered as placeholders for the instructor to replace with those of the academy's set.
 */
export interface StandardTarget {
  name: string;
  /** Height above sea level, metres. */
  heightM: number;
  /** Minimum detection range, NM. */
  xNm: number;
  sNm: number;
  kind: TargetKind | "coast";
}

export const IMO_TABLE2: StandardTarget[] = [
  { name: "Shoreline rising to 60 m", heightM: 60, xNm: 20, sNm: 20, kind: "coast" },
  { name: "Shoreline rising to 6 m", heightM: 6, xNm: 8, sNm: 8, kind: "coast" },
  { name: "Shoreline rising to 3 m", heightM: 3, xNm: 6, sNm: 6, kind: "coast" },
  { name: "SOLAS ship over 5,000 gross tonnage", heightM: 10, xNm: 11, sNm: 11, kind: "ship" },
  { name: "SOLAS ship over 500 gross tonnage", heightM: 5, xNm: 8, sNm: 8, kind: "ship" },
  { name: "Small vessel with IMO radar reflector", heightM: 4, xNm: 5.0, sNm: 3.7, kind: "small-craft" },
  { name: "Navigation buoy with corner reflector", heightM: 3.5, xNm: 4.9, sNm: 3.6, kind: "buoy" },
  { name: "Typical navigation buoy", heightM: 3.5, xNm: 4.6, sNm: 3.0, kind: "buoy" },
  { name: "Small vessel of 10 m, no radar reflector", heightM: 2, xNm: 3.4, sNm: 3.0, kind: "small-craft" },
  { name: "Typical channel marker (note 3)", heightM: 1, xNm: 2.0, sNm: 1.0, kind: "buoy" },
];

/** Echo level at which a target is painted on 8 scans in 10 (see detectionProbability: 0.35 + 0.08 ln 4). */
export const DETECT_LEVEL_8_OF_10 = 0.35 + 0.08 * Math.log(4);

/** Echo strength ("rcs" in a scenario) that gives first detection at `rangeNm` on X band, gain 50, tuned. */
export function rcsForDetectionRange(rangeNm: number): number {
  return (DETECT_LEVEL_8_OF_10 * rangeNm * rangeNm) / 100;
}

/**
 * S-band echo strength as a fraction of the X-band strength, by kind of target. From the ratios
 * of Table 2 (range ratio squared): ships and shorelines 1; small vessel without reflector
 * (3.0/3.4)^2; typical buoy (3.0/4.6)^2. Beacons are taken as fixed structures, like a shoreline.
 */
export function sBandFactor(kind: TargetKind | "coast" | undefined): number {
  switch (kind) {
    case "small-craft":
      return (3.0 / 3.4) ** 2;
    case "buoy":
      return (3.0 / 4.6) ** 2;
    default:
      return 1;
  }
}

/** Shoreline detection range for a coast of the given height, between the three rows of Table 2 (X and S alike). */
export function shorelineDetectionNm(heightM: number): number {
  if (heightM >= 60) return 20;
  if (heightM >= 6) return 8 + ((heightM - 6) / 54) * 12;
  if (heightM >= 3) return 6 + ((heightM - 3) / 3) * 2;
  return 6 * Math.max(heightM, 0) / 3;
}

/**
 * Radar set data from a maker's published specification (Furuno FAR-2117 / FAR-2127 / FAR-2137S
 * series brochure): X band 9410 MHz with the 6.5 ft radiator XN20AF (horizontal beamwidth 1.23 deg,
 * vertical 20 deg); S band 3050 MHz with the 12 ft radiator SN36AF (1.8 deg, 25 deg). One real
 * set, taken as typical; it is not an IMO requirement. Wavelength = speed of light / frequency.
 */
export const BAND_DATA = {
  X: { name: "X band", frequencyGHz: 9.41, wavelengthCm: 3.2, beamwidthDeg: 1.23, verticalBeamwidthDeg: 20 },
  S: { name: "S band", frequencyGHz: 3.05, wavelengthCm: 9.8, beamwidthDeg: 1.8, verticalBeamwidthDeg: 25 },
} as const;

export interface PulseSetting {
  name: "short" | "medium" | "long";
  microseconds: number;
  /** Pulse repetition frequency, per second. */
  prfHz: number;
  /** Two targets on the same bearing closer than this merge: half the pulse length (150 m per microsecond), NM. */
  rangeDiscriminationNm: number;
  /** Nearest range at which an echo can be shown, NM. */
  minRangeNm: number;
}

const PULSES: Record<PulseSetting["name"], PulseSetting> = {
  short: { name: "short", microseconds: 0.07, prfHz: 3000, rangeDiscriminationNm: (0.07 * 150) / 1852, minRangeNm: 0.02 },
  medium: { name: "medium", microseconds: 0.3, prfHz: 1500, rangeDiscriminationNm: (0.3 * 150) / 1852, minRangeNm: 0.03 },
  long: { name: "long", microseconds: 1.2, prfHz: 600, rangeDiscriminationNm: (1.2 * 150) / 1852, minRangeNm: 0.1 },
};

/**
 * Pulse lengths and repetition rates from the same maker's specification (Furuno FAR-21x7 series:
 * 0.07 microseconds at 3000 Hz, 0.3 at 1500 Hz, 1.2 at 600 Hz; the set has three more steps in
 * between, not modelled). With no manual choice the pulse follows the range scale (short to
 * 1.5 NM, medium to 6 NM, long beyond), which is within the choices that set offers on each scale.
 * The minimum ranges here are PLACEHOLDERS (the set's specification gives 22 m on the shortest
 * scale). IMO asks for 40 m minimum range and 40 m range discrimination on the short scales.
 * No minimum range is less than half the pulse length (150 m a microsecond), because the radar cannot
 * receive while it is still transmitting (Radar and ARPA Manual, 3rd edition, 2.3.3.1): 0.1 NM for the
 * long pulse (1.2 microseconds is 180 m).
 */
export function pulseFor(rangeScaleNm: number, manual?: "auto" | "short" | "medium" | "long"): PulseSetting {
  if (manual && manual !== "auto") return PULSES[manual];
  return rangeScaleNm <= 1.5 ? PULSES.short : rangeScaleNm <= 6 ? PULSES.medium : PULSES.long;
}

/**
 * Energy the radar puts on a target in one sweep of the beam across it, as a multiple of the energy
 * with the automatic pulse for the range scale. The energy is the peak power x the pulse length x the
 * number of pulses that strike the target (beamwidth x PRF / (6 x rpm)); with the same power, beam and
 * rotation, it goes with pulse length x PRF (Radar and ARPA Manual, 3rd edition, 2.3.3.3).
 */
export function pulseEnergyRatio(rangeScaleNm: number, manual?: "auto" | "short" | "medium" | "long"): number {
  const energy = (p: PulseSetting): number => targetEnergyWs(1, p.microseconds, pulsesOnTarget(1, p.prfHz, 24));
  return energy(pulseFor(rangeScaleNm, manual)) / energy(pulseFor(rangeScaleNm));
}

/** Mean transmitted power, watts: peak power x pulse length / pulse repetition interval. */
export function meanPowerW(peakW: number, pulseMicroseconds: number, prfHz: number): number {
  return peakW * pulseMicroseconds * 1e-6 * prfHz;
}

/**
 * Pulses that strike a point target while the beam sweeps across it: the time the beam dwells on it
 * (beamwidth / degrees turned a second) x the PRF.
 */
export function pulsesOnTarget(beamwidthDeg: number, prfHz: number, rpm: number): number {
  return (beamwidthDeg / ((rpm * 360) / 60)) * prfHz;
}

/** Energy sent towards a point target in one sweep of the beam, watt seconds: peak power x pulse length x pulses on target. */
export function targetEnergyWs(peakW: number, pulseMicroseconds: number, pulses: number): number {
  return peakW * pulseMicroseconds * 1e-6 * pulses;
}

/**
 * Echo strength with a hand-chosen pulse compared with the automatic one. The simulator's echo
 * strength goes with the square root of the energy returned (see `echoStrength`), so this is the
 * square root of `pulseEnergyRatio`.
 */
export function pulseEnergyFactor(rangeScaleNm: number, manual?: "auto" | "short" | "medium" | "long"): number {
  return Math.sqrt(pulseEnergyRatio(rangeScaleNm, manual));
}

/** Furthest range that can be measured without ambiguity at a pulse repetition frequency: c / (2 PRF), in NM. */
export function unambiguousRangeNm(prfHz: number): number {
  return 299792.458 / (2 * prfHz) / 1.852;
}
