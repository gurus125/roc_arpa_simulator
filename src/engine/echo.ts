import { BAND_DATA, pulseFor } from "./band";
import { RadarControls } from "./types";

/**
 * Shape of a painted echo. A radar cannot paint anything narrower than its horizontal beamwidth
 * or shorter in range than half its pulse length, so:
 *
 *   angular width  = beamwidth + the angle the target itself spans across the line of sight
 *   depth in range = half the pulse length in space (150 m per microsecond) + the target's depth along the line of sight
 *
 * From this follow range discrimination (two targets on one bearing merge when closer than the
 * pulse depth), bearing discrimination (two targets at one range merge when closer in bearing
 * than the beamwidth), the sideways stretch of echoes with range, and the change of an echo's
 * shape with the target's aspect.
 *
 * The beam (width) of a vessel is its catalogue type's typical beam (engine/targets.ts), or, for a
 * vessel of no type, one seventh of its length (a PLACEHOLDER ratio).
 */
export const NM_METRES = 1852;
export const BEAM_TO_LENGTH = 1 / 7;

export interface EchoShape {
  /** Angular width of the paint, degrees. */
  arcDeg: number;
  /** Depth of the paint in range, NM. */
  depthNm: number;
}

/** Extent of a vessel along and across the line of sight, metres, for a given aspect (angle between its heading and the line of sight). */
export function targetExtents(lengthM: number, aspectDeg: number, beamM?: number): { alongM: number; acrossM: number } {
  const beam = beamM ?? lengthM * BEAM_TO_LENGTH;
  const c = Math.abs(Math.cos((aspectDeg * Math.PI) / 180));
  const s = Math.abs(Math.sin((aspectDeg * Math.PI) / 180));
  return { alongM: lengthM * c + beam * s, acrossM: lengthM * s + beam * c };
}

export function echoShape(band: "X" | "S", c: RadarControls, rangeNm: number, lengthM = 0, aspectDeg = 90, beamM?: number): EchoShape {
  const pulseDepthNm = pulseFor(c.rangeNm, c.pulse).rangeDiscriminationNm;
  const ext = lengthM > 0 ? targetExtents(lengthM, aspectDeg, beamM) : { alongM: 0, acrossM: 0 };
  const spanDeg = rangeNm > 0 ? ((ext.acrossM / NM_METRES / rangeNm) * 180) / Math.PI : 0;
  const stretch = c.echoStretch ? 1.8 : 1;
  return { arcDeg: BAND_DATA[band].beamwidthDeg + spanDeg, depthNm: (pulseDepthNm + ext.alongM / NM_METRES) * stretch };
}

/**
 * How strongly a vessel returns at this aspect compared with its average: beam-on shows the whole
 * side, end-on only the bow or stern (IEC 62388 Table D.1: "stern and bow aspects provide the least
 * RCS value"). The spread is that of the 18 measured ships of Table D.1: the median of their ratios of
 * largest to smallest cross-section is 12 (11 dB). The simulator's echo strength goes with the square
 * root of a cross-section (its strengths are calibrated to detection ranges, and a range goes with
 * the fourth root of a cross-section, a strength here with the square of a range), so the factor
 * runs from a to a x 3.46, with a set so that it averages 1 over all aspects: 0.39 end-on, 1.35
 * beam-on. The shape between (in proportion to the sine of the aspect) is a simplification.
 */
export const ASPECT_SPREAD = Math.sqrt(12);
const ASPECT_A = 1 / (1 + ((ASPECT_SPREAD - 1) * 2) / Math.PI);
export function aspectFactor(aspectDeg: number): number {
  return ASPECT_A * (1 + (ASPECT_SPREAD - 1) * Math.abs(Math.sin((aspectDeg * Math.PI) / 180)));
}
