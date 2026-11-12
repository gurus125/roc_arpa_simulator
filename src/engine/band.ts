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

/** PLACEHOLDER typical values, not from an IMO document. */
export const BAND_DATA = {
  X: { name: "X band", frequencyGHz: 9.41, wavelengthCm: 3.2, beamwidthDeg: 1.2 },
  S: { name: "S band", frequencyGHz: 3.05, wavelengthCm: 9.8, beamwidthDeg: 2.0 },
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
  medium: { name: "medium", microseconds: 0.25, prfHz: 1500, rangeDiscriminationNm: (0.25 * 150) / 1852, minRangeNm: 0.03 },
  long: { name: "long", microseconds: 0.8, prfHz: 750, rangeDiscriminationNm: (0.8 * 150) / 1852, minRangeNm: 0.07 },
};

/**
 * PLACEHOLDER typical pulse settings. With no manual choice the pulse follows the range scale
 * (short to 1.5 NM, medium to 6 NM, long beyond). IMO asks for 40 m minimum range and 40 m range
 * discrimination on the short scales.
 */
export function pulseFor(rangeScaleNm: number, manual?: "auto" | "short" | "medium" | "long"): PulseSetting {
  if (manual && manual !== "auto") return PULSES[manual];
  return rangeScaleNm <= 1.5 ? PULSES.short : rangeScaleNm <= 6 ? PULSES.medium : PULSES.long;
}

/**
 * Echo strength with a hand-chosen pulse compared with the automatic one for the range scale:
 * a longer pulse puts more energy on the target (square root of the ratio of pulse lengths).
 */
export function pulseEnergyFactor(rangeScaleNm: number, manual?: "auto" | "short" | "medium" | "long"): number {
  return Math.sqrt(pulseFor(rangeScaleNm, manual).microseconds / pulseFor(rangeScaleNm).microseconds);
}

/** Furthest range that can be measured without ambiguity at a pulse repetition frequency: c / (2 PRF), in NM. */
export function unambiguousRangeNm(prfHz: number): number {
  return 299792.458 / (2 * prfHz) / 1.852;
}
