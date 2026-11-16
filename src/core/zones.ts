import { Vec2, bearingOf, length, normalizeDeg } from "./vec";

/**
 * An annular sector round own ship, used for ARPA guard (acquisition) zones and exclusion
 * areas. Bearings are RELATIVE to own ship's heading (degrees clockwise from the bow), so the
 * zone turns with the ship. The sector runs clockwise from `fromRel` to `toRel`; when the two
 * are equal the zone is a full ring.
 */
export interface SectorZone {
  innerNm: number;
  outerNm: number;
  fromRel: number;
  toRel: number;
}

/**
 * The zone made larger by `marginNm` all round: inward, outward and, for a sector, to each side (the
 * margin taken at the zone's inner edge, where it subtends the largest angle). A sector that would
 * then reach all the way round becomes a full ring.
 */
export function expandZone(z: SectorZone, marginNm: number): SectorZone {
  const innerNm = Math.max(0, z.innerNm - marginNm);
  const outerNm = z.outerNm + marginNm;
  const width = normalizeDeg(z.toRel - z.fromRel);
  if (width === 0) return { innerNm, outerNm, fromRel: z.fromRel, toRel: z.fromRel };
  const side = (Math.atan2(marginNm, Math.max(innerNm, marginNm)) * 180) / Math.PI;
  if (width + 2 * side >= 360) return { innerNm, outerNm, fromRel: 0, toRel: 0 };
  return { innerNm, outerNm, fromRel: normalizeDeg(z.fromRel - side), toRel: normalizeDeg(z.toRel + side) };
}

/** True when a position relative to own ship lies inside the zone. */
export function inSectorZone(relPos: Vec2, heading: number, z: SectorZone): boolean {
  const r = length(relPos);
  if (r < z.innerNm || r > z.outerNm) return false;
  const from = normalizeDeg(z.fromRel);
  const width = normalizeDeg(z.toRel - z.fromRel);
  if (width === 0) return true;
  const rb = normalizeDeg(bearingOf(relPos) - heading);
  return normalizeDeg(rb - from) <= width;
}
