import { CourseSpeed, Vec2, add, courseSpeedOf, sub, velocityOf } from "./vec";

/**
 * The vector triangle: V_target_true = V_own + V_target_relative.
 * Everything in the ROC "relative motion" module reduces to this identity.
 */

/** Relative velocity of the target as seen from own ship. */
export function relativeVelocity(own: CourseSpeed, targetTrue: CourseSpeed): Vec2 {
  return sub(velocityOf(targetTrue), velocityOf(own));
}

/** Relative course and speed of the target (what the radar trail shows). */
export function relativeCourseSpeed(own: CourseSpeed, targetTrue: CourseSpeed): CourseSpeed {
  return courseSpeedOf(relativeVelocity(own, targetTrue));
}

/** Recover the target's TRUE course and speed from own ship and the relative motion. */
export function trueFromRelative(own: CourseSpeed, relativeVel: Vec2): CourseSpeed {
  return courseSpeedOf(add(velocityOf(own), relativeVel));
}
