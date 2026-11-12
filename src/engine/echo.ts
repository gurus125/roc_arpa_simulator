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
 * The beam (width) of a vessel is taken as one seventh of its length: a PLACEHOLDER ratio.
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
export function targetExtents(lengthM: number, aspectDeg: number): { alongM: number; acrossM: number } {
  const beam = lengthM * BEAM_TO_LENGTH;
  const c = Math.abs(Math.cos((aspectDeg * Math.PI) / 180));
  const s = Math.abs(Math.sin((aspectDeg * Math.PI) / 180));
  return { alongM: lengthM * c + beam * s, acrossM: lengthM * s + beam * c };
}

export function echoShape(band: "X" | "S", c: RadarControls, rangeNm: number, lengthM = 0, aspectDeg = 90): EchoShape {
  const pulseDepthNm = pulseFor(c.rangeNm, c.pulse).rangeDiscriminationNm;
  const ext = lengthM > 0 ? targetExtents(lengthM, aspectDeg) : { alongM: 0, acrossM: 0 };
  const spanDeg = rangeNm > 0 ? ((ext.acrossM / NM_METRES / rangeNm) * 180) / Math.PI : 0;
  const stretch = c.echoStretch ? 1.8 : 1;
  return { arcDeg: BAND_DATA[band].beamwidthDeg + spanDeg, depthNm: (pulseDepthNm + ext.alongM / NM_METRES) * stretch };
}

/**
 * How strongly a vessel returns at this aspect compared with its average: beam-on shows the whole
 * side, end-on only the bow or stern. PLACEHOLDER curve (0.6 end-on to 1.4 beam-on, 1.0 on average
 * near 45 degrees); not measured data.
 */
export function aspectFactor(aspectDeg: number): number {
  return 0.6 + 0.8 * Math.abs(Math.sin((aspectDeg * Math.PI) / 180));
}
