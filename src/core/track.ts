import { Vec2, add, length, scale, sub } from "./vec";

/** A position (NM) at a time (hours). */
export interface TimedPoint {
  t: number;
  p: Vec2;
}

export interface LinearFit {
  /** Fitted velocity, knots (NM per hour). */
  vel: Vec2;
  /** Mean time of the samples, hours. The fitted line passes through (tMean, pMean). */
  tMean: number;
  pMean: Vec2;
  /** Root-mean-square distance of the samples from the fitted line, NM. */
  rms: number;
  /** Time span covered by the samples, hours. */
  span: number;
  count: number;
}

/**
 * Least-squares straight-line motion through timed positions:
 *
 *   vel = sum((t - tMean)(p - pMean)) / sum((t - tMean)^2)
 *
 * Used by the manual-plot analysis (several observations of one target) and by the ARPA
 * tracker (a sliding window of radar plots). Returns null with fewer than two distinct times.
 */
export function fitLinearMotion(points: TimedPoint[]): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;
  let tSum = 0;
  let eSum = 0;
  let nSum = 0;
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const x of points) {
    tSum += x.t;
    eSum += x.p.e;
    nSum += x.p.n;
    tMin = Math.min(tMin, x.t);
    tMax = Math.max(tMax, x.t);
  }
  const tMean = tSum / n;
  const pMean: Vec2 = { e: eSum / n, n: nSum / n };
  let sTT = 0;
  let sTE = 0;
  let sTN = 0;
  for (const x of points) {
    const dt = x.t - tMean;
    sTT += dt * dt;
    sTE += dt * (x.p.e - pMean.e);
    sTN += dt * (x.p.n - pMean.n);
  }
  if (sTT <= 0) return null;
  const vel: Vec2 = { e: sTE / sTT, n: sTN / sTT };
  let r2 = 0;
  for (const x of points) {
    const d = sub(x.p, add(pMean, scale(vel, x.t - tMean)));
    r2 += d.e * d.e + d.n * d.n;
  }
  return { vel, tMean, pMean, rms: Math.sqrt(r2 / n), span: tMax - tMin, count: n };
}

/** Position on the fitted line at time t (hours). */
export function fitPositionAt(fit: LinearFit, t: number): Vec2 {
  return add(fit.pMean, scale(fit.vel, t - fit.tMean));
}

/** Distance of a point from where the fit puts the target at that time, NM. */
export function fitResidual(fit: LinearFit, x: TimedPoint): number {
  return length(sub(x.p, fitPositionAt(fit, x.t)));
}
