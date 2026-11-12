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
