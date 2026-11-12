import { CourseSpeed, DEG, Vec2, add, courseSpeedOf, dot, normalizeDeg, sub, velocityOf } from "./vec";

export interface SetDrift {
  /** Direction the current flows TOWARDS, degrees true. */
  set: number;
  /** Rate of the current, knots. */
  drift: number;
}

/**
 * Current triangle. Ground velocity = water velocity + current.
 * Given the vessel's course/speed through the water and its course/speed over the ground
 * (for example from radar ranges and bearings of a fixed object), find the set and drift.
 */
export function setAndDrift(throughWater: CourseSpeed, overGround: CourseSpeed): SetDrift {
  const c = sub(velocityOf(overGround), velocityOf(throughWater));
  const cs = courseSpeedOf(c);
  return { set: cs.course, drift: cs.speed };
}

export interface CourseToSteer {
  /** Heading to steer, degrees true. */
  heading: number;
  /** Resulting speed over the ground along the desired track, knots. */
  speedOverGround: number;
  /** Degrees to steer to the right (+) or left (-) of the desired track. */
  allowance: number;
}

/**
 * Course to steer to make good a desired ground track in a known current.
 * Returns null when the current across the track is stronger than the vessel's speed
 * through the water, so the track cannot be held.
 */
export function courseToSteer(
  desiredTrack: number,
  speedThroughWater: number,
  current: SetDrift,
): CourseToSteer | null {
  const T = desiredTrack * DEG;
  const track: Vec2 = { e: Math.sin(T), n: Math.cos(T) };
  const right: Vec2 = { e: Math.cos(T), n: -Math.sin(T) };
  const cur = velocityOf({ course: current.set, speed: current.drift });
  const acrossRight = dot(cur, right);
  const s = -acrossRight / speedThroughWater;
  if (Math.abs(s) > 1 || speedThroughWater <= 0) return null;
  const alpha = Math.asin(s);
  const sog = speedThroughWater * Math.cos(alpha) + dot(cur, track);
  return {
    heading: normalizeDeg(desiredTrack + alpha / DEG),
    speedOverGround: sog,
    allowance: alpha / DEG,
  };
}

/**
 * Leeway: sideways slip caused mainly by wind. `leewayDeg` is positive when the vessel is
 * pushed to starboard of her heading, negative to port. Returns the water track.
 */
export function applyLeeway(heading: number, leewayDeg: number): number {
  return normalizeDeg(heading + leewayDeg);
}

/** Convenience: velocity over the ground from heading, speed through water and current. */
export function groundVelocity(heading: number, speedThroughWater: number, current: SetDrift): Vec2 {
  return add(
    velocityOf({ course: heading, speed: speedThroughWater }),
    velocityOf({ course: current.set, speed: current.drift }),
  );
}


/** Length of a semi-diurnal tidal cycle, hours. */
export const TIDAL_PERIOD_HOURS = 12.42;

/**
 * Rate of a simple rectilinear tidal stream, knots: zero at slack water, rising to `maxRateKn`
 * on the flood a quarter of a cycle later, zero again at the next slack and negative (ebb, the
 * reverse direction) after that. `hoursAfterSlack` is counted from slack water before the flood.
 */
export function tidalStreamRate(maxRateKn: number, hoursAfterSlack: number): number {
  return maxRateKn * Math.sin((2 * Math.PI * hoursAfterSlack) / TIDAL_PERIOD_HOURS);
}
