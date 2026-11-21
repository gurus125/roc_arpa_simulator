/**
 * Tidal streams from a table of "tidal diamonds" and the height of the tide by the rule of twelfths, as a navigator
 * works them from a chart:
 *
 *  - A diamond gives, for each hour from six hours before high water at the reference port to six hours after, the
 *    direction the stream runs TOWARDS and its rate at springs and at neaps. Between springs and neaps the rate is
 *    found in proportion (`springs` 0 = neaps, 1 = springs); between whole hours, and between diamonds, the stream is
 *    interpolated (by its east and north parts, so that a stream turning through north is handled).
 *  - Between diamonds the stream is weighted by the inverse square of the distance to each (the usual smooth choice;
 *    a navigator would take the nearest diamond).
 *  - Height of tide: the rule of twelfths. In the six "hours" of the rise the tide makes 1, 2, 3, 3, 2 and 1 twelfths of
 *    the range; the fall is the same in reverse. The tidal cycle here is 12.42 hours, so each of these "hours" is a
 *    sixth of half a cycle (about 62 minutes).
 */
import { TIDAL_PERIOD_HOURS } from "./current";
import { Vec2, add, length, scale, sub, velocityOf } from "./vec";

/** One hour of a diamond: the direction the stream runs TOWARDS (degrees true) and its rate at springs and neaps, knots. */
export interface StreamHour {
  set: number;
  spring: number;
  neap: number;
}

/** A tidal diamond: its letter, its position (NM east and north of the area's origin) and 13 hours, HW-6 to HW+6. */
export interface TidalDiamond {
  id: string;
  pos: Vec2;
  hours: StreamHour[];
}

/** Hours from the high water nearest in time: the tidal clock folded into -6.21 to +6.21 (half a cycle either side). */
export function hoursFromNearestHw(hoursFromHw: number): number {
  const p = TIDAL_PERIOD_HOURS;
  let o = ((hoursFromHw % p) + p) % p;
  if (o > p / 2) o -= p;
  return o;
}

/** The stream of one diamond, knots east and north, at `hoursFromHw` (any value; folded to the nearest HW) and `springs` (0 neaps, 1 springs). */
export function diamondStream(d: TidalDiamond, hoursFromHw: number, springs: number): Vec2 {
  const at = (k: number): Vec2 => {
    const h = d.hours[Math.max(0, Math.min(d.hours.length - 1, k))]!;
    return velocityOf({ course: h.set, speed: Math.max(0, h.neap + (h.spring - h.neap) * springs) });
  };
  const x = Math.max(-6, Math.min(6, hoursFromNearestHw(hoursFromHw))) + 6;
  const k = Math.floor(x);
  const f = x - k;
  if (f < 1e-9) return at(k);
  return add(scale(at(k), 1 - f), scale(at(k + 1), f));
}

/** The stream at a point, knots east and north: the diamonds weighted by the inverse square of their distance. */
export function streamAt(diamonds: TidalDiamond[], p: Vec2, hoursFromHw: number, springs: number): Vec2 {
  if (diamonds.length === 0) return { e: 0, n: 0 };
  let we = 0, wn = 0, wsum = 0;
  for (const d of diamonds) {
    const s = diamondStream(d, hoursFromHw, springs);
    const dist = length(sub(p, d.pos));
    if (dist < 1e-6) return s;
    const w = 1 / (dist * dist);
    we += w * s.e;
    wn += w * s.n;
    wsum += w;
  }
  return { e: we / wsum, n: wn / wsum };
}

/** Heights of the tide above chart datum at the reference port, metres: mean high and low water at springs and at neaps. */
export interface TideHeights {
  mhws: number;
  mhwn: number;
  mlwn: number;
  mlws: number;
}

/** The rule of twelfths: twelfths of the range made by the end of each "hour" of the rise. */
export const TWELFTHS = [0, 1, 3, 6, 9, 11, 12] as const;

/** Fraction of the range risen `x` "hours" (0 to 6) after low water, by the rule of twelfths, straight lines within each hour. */
export function twelfthsFraction(x: number): number {
  const c = Math.max(0, Math.min(6, x));
  const k = Math.min(5, Math.floor(c));
  return (TWELFTHS[k]! + (TWELFTHS[k + 1]! - TWELFTHS[k]!) * (c - k)) / 12;
}

/** Height of tide above chart datum, metres, at `hoursFromHw` (folded to the nearest HW) and `springs` (0 neaps, 1 springs). */
export function tideHeightM(t: TideHeights, hoursFromHw: number, springs: number): number {
  const hw = t.mhwn + (t.mhws - t.mhwn) * springs;
  const lw = t.mlwn + (t.mlws - t.mlwn) * springs;
  const half = TIDAL_PERIOD_HOURS / 2;
  const o = hoursFromNearestHw(hoursFromHw);
  const frac = o <= 0 ? twelfthsFraction(((o + half) / half) * 6) : 1 - twelfthsFraction((o / half) * 6);
  return lw + (hw - lw) * frac;
}
