import { Vec2, add, bearingOf, dot, length, scale, sub, velocityOf } from "./vec";
import { computeCpa } from "./cpa";

/**
 * Collision-danger graphics for an ARPA display.
 *
 * PPC (potential point of collision): the point own ship would reach, at her PRESENT SPEED, at the
 * same moment as the target, if the target holds its course and speed. There are none, one or two.
 *
 * PAD (predicted area of danger): the area around a PPC that own ship must keep out of to pass
 * the target at not less than the chosen miss distance. Makers draw this in different ways
 * (ellipse or hexagon). This is a SIMPLIFIED training PAD: a hexagon laid along the target's
 * track, as wide as twice the miss distance, reaching between the two own-ship courses that
 * would give exactly that miss distance (one passing ahead of the target, one astern).
 *
 * All positions are relative to own ship NOW (east/north, NM); velocities in knots; time in hours.
 */
export interface CollisionPoint {
  /** Position of the PPC relative to own ship now, NM. */
  point: Vec2;
  /** Time to reach it, hours. */
  tHours: number;
  /** Own ship course to steer for it, degrees. */
  course: number;
}

const EPS = 1e-9;

export function collisionPoints(rel: Vec2, targetVel: Vec2, ownSpeed: number): CollisionPoint[] {
  // |rel + vt t| = s t   =>   (vt.vt - s^2) t^2 + 2 (rel.vt) t + rel.rel = 0
  const a = dot(targetVel, targetVel) - ownSpeed * ownSpeed;
  const b = 2 * dot(rel, targetVel);
  const c = dot(rel, rel);
  if (c < EPS) return [];
  const ts: number[] = [];
  if (Math.abs(a) < EPS) {
    if (Math.abs(b) > EPS) ts.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const q = Math.sqrt(disc);
    ts.push((-b - q) / (2 * a), (-b + q) / (2 * a));
  }
  return ts
    .filter((t) => t > EPS && Number.isFinite(t))
    .sort((x, y) => x - y)
    .filter((t, i, arr) => i === 0 || Math.abs(t - arr[i - 1]!) > 1e-6)
    .map((t) => {
      const point = add(rel, scale(targetVel, t));
      return { point, tHours: t, course: bearingOf(point) };
    });
}

export interface DangerArea {
  ppc: CollisionPoint;
  /** Own-ship courses that pass the target at exactly the miss distance, either side of the collision course. */
  courses: [number, number];
  /** Six corners of the hexagon, relative to own ship now, NM. */
  outline: Vec2[];
}

/** Miss distance (NM) if own ship steers `course` at `ownSpeed`; Infinity if the target is then opening. */
function missOn(rel: Vec2, targetVel: Vec2, ownSpeed: number, course: number): number {
  const r = computeCpa(rel, sub(targetVel, velocityOf({ course, speed: ownSpeed })));
  return r.tcpaHours === null || r.tcpaHours < 0 ? Infinity : r.cpa;
}

export function dangerAreas(rel: Vec2, targetVel: Vec2, ownSpeed: number, missNm: number): DangerArea[] {
  const out: DangerArea[] = [];
  const speed = length(targetVel);
  if (speed < EPS || missNm <= 0 || length(rel) <= missNm) return out;
  const along = scale(targetVel, 1 / speed);
  const across = { e: along.n, n: -along.e };
  for (const ppc of collisionPoints(rel, targetVel, ownSpeed)) {
    const bound = (dir: 1 | -1): number | null => {
      // Walk away from the collision course until the miss distance is reached, then bisect.
      let lo = 0;
      for (let d = 0.25; d <= 120; d += 0.25) {
        if (missOn(rel, targetVel, ownSpeed, ppc.course + dir * d) >= missNm) {
          let hi = d;
          for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            if (missOn(rel, targetVel, ownSpeed, ppc.course + dir * mid) >= missNm) hi = mid;
            else lo = mid;
          }
          return ppc.course + dir * hi;
        }
        lo = d;
      }
      return null;
    };
    const c1 = bound(-1);
    const c2 = bound(1);
    if (c1 === null || c2 === null) continue;
    // Where own ship is at the closest approach on each bounding course, measured along the target's track from the PPC.
    const alongAt = (course: number): number => {
      const ov = velocityOf({ course, speed: ownSpeed });
      const t = computeCpa(rel, sub(targetVel, ov)).tcpaHours ?? 0;
      return dot(sub(scale(ov, t), ppc.point), along);
    };
    const lo = Math.min(alongAt(c1), alongAt(c2), -missNm);
    const hi = Math.max(alongAt(c1), alongAt(c2), missNm);
    const at = (a: number, x: number): Vec2 => add(ppc.point, add(scale(along, a), scale(across, x)));
    const sh = Math.min(missNm, (hi - lo) / 2);
    out.push({
      ppc,
      courses: [((c1 % 360) + 360) % 360, ((c2 % 360) + 360) % 360],
      outline: [at(hi, 0), at(hi - sh, missNm), at(lo + sh, missNm), at(lo, 0), at(lo + sh, -missNm), at(hi - sh, -missNm)],
    });
  }
  return out;
}
