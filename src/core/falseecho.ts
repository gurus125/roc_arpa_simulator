import { Vec2, add, dot, scale, sub } from "./vec";

/**
 * Geometry of false radar echoes from man-made structures (STCW Code B-I/12, paragraph 6).
 * NM, flat east/north frame. A structure is the straight line from `a` to `b`.
 */

/** Foot of the perpendicular from `p` onto the line a-b, and whether it lies between a and b. */
export function footOfPerpendicular(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; onSegment: boolean } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return { point: { ...a }, onSegment: true };
  const k = dot(sub(p, a), ab) / l2;
  return { point: add(a, scale(ab, k)), onSegment: k >= 0 && k <= 1 };
}

/** Mirror image of `p` in the line a-b. */
export function mirrorPoint(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const f = footOfPerpendicular(p, a, b).point;
  return add(p, scale(sub(f, p), 2));
}

/** Which side of the line a-b the point is on: +1 to the left of a->b, -1 to the right, 0 on the line. */
export function sideOfLine(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  return Math.sign(ab.e * ap.n - ab.n * ap.e);
}

/**
 * Point on the face a-b where a radar pulse from `from` is mirrored to `to` (angle of incidence =
 * angle of reflection): where the straight line from `from` to the mirror image of `to` cuts the
 * face. Null when the two are not on the same side of the face, or the point falls outside a-b.
 */
export function reflectionPoint(from: Vec2, to: Vec2, a: Vec2, b: Vec2): Vec2 | null {
  const s1 = sideOfLine(from, a, b);
  if (s1 === 0 || s1 !== sideOfLine(to, a, b)) return null;
  const image = mirrorPoint(to, a, b);
  const d = sub(image, from);
  const ab = sub(b, a);
  const den = d.e * ab.n - d.n * ab.e;
  if (den === 0) return null;
  const af = sub(a, from);
  const k = (af.e * d.n - af.n * d.e) / den; // position along a->b
  if (k < 0 || k > 1) return null;
  return add(a, scale(ab, k));
}
