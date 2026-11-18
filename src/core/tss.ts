import { Vec2, angleDiffDeg, bearingOf, length, sub } from "./vec";
import { alongTrack, crossTrackError } from "./nav";

/**
 * A straight traffic separation scheme. The axis runs from `a` to `b` down the middle of the separation zone.
 * Each vessel keeps the separation zone on her port side (COLREG rule 10): the lane to starboard of the axis,
 * seen from `a` towards `b`, carries the traffic bound from `a` to `b`, and the other lane the opposite traffic.
 */
export interface TssScheme {
  name: string;
  a: Vec2;
  b: Vec2;
  /** Half the width of the separation zone, NM. */
  zoneHalfWidthNm: number;
  laneWidthNm: number;
}

export type TssArea = "outside" | "zone" | "lane-ab" | "lane-ba";

/** Where a point lies in the scheme, and the direction of traffic flow there (null outside the lanes). */
export function tssArea(p: Vec2, t: TssScheme): { area: TssArea; flow: number | null } {
  const len = length(sub(t.b, t.a));
  const along = alongTrack(p, t.a, t.b);
  if (len === 0 || along < 0 || along > len) return { area: "outside", flow: null };
  const x = crossTrackError(p, t.a, t.b);
  if (Math.abs(x) <= t.zoneHalfWidthNm) return { area: "zone", flow: null };
  if (Math.abs(x) > t.zoneHalfWidthNm + t.laneWidthNm) return { area: "outside", flow: null };
  const ab = bearingOf(sub(t.b, t.a));
  return x > 0 ? { area: "lane-ab", flow: ab } : { area: "lane-ba", flow: (ab + 180) % 360 };
}

/**
 * How a vessel in a lane is moving against the flow. The 45 and 135 degree limits are PLACEHOLDERS: rule 10
 * says "the general direction of traffic flow" and crossing "as nearly as practicable at right angles", and
 * gives no figures.
 */
export const TSS_LIMITS = { withFlowDeg: 45, againstFlowDeg: 135 };

export type TssConduct = "outside" | "in-zone" | "with-flow" | "crossing" | "against-flow";

export function tssConduct(p: Vec2, courseOverGround: number, t: TssScheme): TssConduct {
  const w = tssArea(p, t);
  if (w.area === "outside") return "outside";
  if (w.area === "zone" || w.flow === null) return "in-zone";
  const off = Math.abs(angleDiffDeg(courseOverGround, w.flow));
  return off <= TSS_LIMITS.withFlowDeg ? "with-flow" : off >= TSS_LIMITS.againstFlowDeg ? "against-flow" : "crossing";
}

/** The four corners of a lane or of the separation zone, for drawing: offsets from the axis in NM, starboard positive. */
export function tssStrip(t: TssScheme, fromOffsetNm: number, toOffsetNm: number): Vec2[] {
  const d = sub(t.b, t.a);
  const len = length(d) || 1;
  const right: Vec2 = { e: d.n / len, n: -d.e / len };
  const at = (base: Vec2, off: number): Vec2 => ({ e: base.e + right.e * off, n: base.n + right.n * off });
  return [at(t.a, fromOffsetNm), at(t.b, fromOffsetNm), at(t.b, toOffsetNm), at(t.a, toOffsetNm)];
}
