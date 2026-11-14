import { DEG, Vec2, add, length, normalizeDeg, scale, sub, velocityOf } from "../core/vec";
import { World } from "./types";
import { currentVelocity, measuredHeading, ownGroundVelocity, ownWaterVelocity } from "./world";

export type Orientation = "north-up" | "head-up" | "course-up";
export type Motion = "relative" | "true";
export type Stabilisation = "sea" | "ground";

export interface DisplayState {
  orientation: Orientation;
  motion: Motion;
  stabilisation: Stabilisation;
  /** Heading reference for course-up (degrees, as read from the gyro when it was set). */
  courseUpRef: number;
  /** True motion only: reference-frame position of the screen centre. */
  viewOrigin: Vec2;
  /** Relative motion: where own ship is drawn, in NM from the screen centre (off-centring). */
  offCentre: { x: number; y: number };
  /**
   * Sea stabilisation: how far, NM, the picture's frame has been carried by the difference between
   * own ship's real motion through the water and the motion the display works out from its inputs
   * (heading and log or manual speed). Zero while the speed input is right and the ship is not
   * moving sideways. See `stepSpeedInput`.
   */
  inputShift: Vec2;
}

/**
 * Reference frame.
 *  - Ground stabilised: the reference frame is the ground (world frame).
 *  - Sea stabilised: the frame drifts with the current, so charted fixed objects slide
 *    across the screen at the speed of the current, as on a real sea-stabilised display. The
 *    display moves own ship by its speed input, so a wrong speed makes them slide as well.
 */
export function frameShift(w: World, ds: DisplayState, time: number = w.time): Vec2 {
  return ds.stabilisation === "sea" ? add(scale(currentVelocity(w), time / 3600), ds.inputShift) : { e: 0, n: 0 };
}

/**
 * A sea-stabilised display moves own ship across the screen by dead reckoning: along the ship's
 * head at the speed it is given (log, or a speed set by hand). Call once every simulation step
 * with that speed. Where the ship really moves differently through the water (wrong speed input,
 * log error, no log, or sideways movement in a turn), the difference is carried into the frame,
 * and every echo slides across the true-motion picture by that much.
 */
export function stepSpeedInput(w: World, ds: DisplayState, dtSec: number, inputSpeedKn: number): void {
  const deadReckoning = velocityOf({ course: w.own.heading, speed: inputSpeedKn });
  ds.inputShift = add(ds.inputShift, scale(sub(ownWaterVelocity(w), deadReckoning), dtSec / 3600));
}

export function toRef(w: World, ds: DisplayState, p: Vec2, time: number = w.time): Vec2 {
  return sub(p, frameShift(w, ds, time));
}

export function fromRef(w: World, ds: DisplayState, p: Vec2, time: number = w.time): Vec2 {
  return add(p, frameShift(w, ds, time));
}

/** Angle (degrees true) that points to the top of the screen. */
export function orientationAngle(ds: DisplayState, heading: number): number {
  switch (ds.orientation) {
    case "north-up":
      return 0;
    case "head-up":
      return heading;
    case "course-up":
      return ds.courseUpRef;
  }
}

/**
 * Rotation that maps TRUE east/north vectors to the screen. The radar picture is stabilised by
 * the gyro, so with a gyro error every echo is drawn turned by that error in north-up and
 * course-up; head-up is not affected because bearings are taken from the ship's head.
 * Labels, EBL and the bearing scale use `orientationAngle(ds, measuredHeading(w))` instead,
 * because they are in the gyro's (measured) frame.
 */
export function screenRotation(w: World, ds: DisplayState): number {
  return orientationAngle(ds, measuredHeading(w)) - w.sensors.gyroErrorDeg;
}

/** Rotation that maps vectors in the gyro (measured) frame to the screen. */
export function measuredRotation(w: World, ds: DisplayState): number {
  return orientationAngle(ds, measuredHeading(w));
}

/** Rotate a vector given in the east/north frame into screen axes (x right, y up), in NM. */
export function toScreenNm(v: Vec2, orient: number): { x: number; y: number } {
  const t = orient * DEG;
  return { x: v.e * Math.cos(t) - v.n * Math.sin(t), y: v.e * Math.sin(t) + v.n * Math.cos(t) };
}

export function fromScreenNm(x: number, y: number, orient: number): Vec2 {
  const t = orient * DEG;
  return { e: x * Math.cos(t) + y * Math.sin(t), n: -x * Math.sin(t) + y * Math.cos(t) };
}

/** Reference-frame position of the screen centre. */
export function centreRef(w: World, ds: DisplayState): Vec2 {
  return ds.motion === "relative" ? toRef(w, ds, w.own.pos) : ds.viewOrigin;
}

/** Where a world position appears on the screen, in NM from the centre. */
export function worldToDisplayNm(w: World, ds: DisplayState, p: Vec2): { x: number; y: number } {
  const orient = screenRotation(w, ds);
  if (ds.motion === "relative") {
    const s = toScreenNm(sub(p, w.own.pos), orient);
    return { x: s.x + ds.offCentre.x, y: s.y + ds.offCentre.y };
  }
  return toScreenNm(sub(toRef(w, ds, p), ds.viewOrigin), orient);
}

export function displayNmToWorld(w: World, ds: DisplayState, x: number, y: number): Vec2 {
  const orient = screenRotation(w, ds);
  if (ds.motion === "relative") return add(w.own.pos, fromScreenNm(x - ds.offCentre.x, y - ds.offCentre.y, orient));
  const v = fromScreenNm(x, y, orient);
  return fromRef(w, ds, add(ds.viewOrigin, v));
}

/** Velocity of own ship in the reference frame (through the water if sea stabilised). */
function ownRefVelocity(w: World, ds: DisplayState): Vec2 {
  return ds.stabilisation === "sea"
    ? ownWaterVelocity(w)
    : ownGroundVelocity(w);
}

/** Put the own ship back at the screen centre (true motion). */
export function recentreTrueMotion(w: World, ds: DisplayState): void {
  ds.viewOrigin = toRef(w, ds, w.own.pos);
}

/**
 * True motion: how far own ship may run from the centre before the picture is reset, and where a reset
 * puts her, as shares of the radius. IMO lets the maker choose the limit between 50% and 75%; the reset
 * puts her on the reciprocal of her course, up to 50% out, to show the most ahead (Radar and ARPA Manual,
 * 3rd edition, 6.2.6.3).
 */
export const TM_LIMIT_SHARE = 0.66;
export const TM_RESET_SHARE = 0.5;

/**
 * True-motion reset: own ship is put half the radius out on the reciprocal of her course (through the water
 * when sea stabilised, over the ground when ground stabilised), so that the picture shows the most ahead.
 * A ship with no way on is put at the centre. Used by the TM RESET key, by a change of range scale or
 * presentation, and automatically when she reaches the limit.
 */
export function resetTrueMotionAhead(w: World, ds: DisplayState): void {
  const R = w.radar.controls.rangeNm;
  const ownRef = toRef(w, ds, w.own.pos);
  const v = ownRefVelocity(w, ds);
  const sp = length(v);
  ds.viewOrigin = sp < 0.05 ? ownRef : sub(ownRef, scale(v, -TM_RESET_SHARE * R / sp));
}

/**
 * True motion: when own ship drifts beyond the limit (66% of the radius), reset the picture so the
 * ship reappears halfway out on the side opposite to its motion. Returns true if a reset happened.
 */
export function updateTrueMotionOrigin(w: World, ds: DisplayState): boolean {
  if (ds.motion !== "true") return false;
  const R = w.radar.controls.rangeNm;
  const off = sub(toRef(w, ds, w.own.pos), ds.viewOrigin);
  if (length(off) <= TM_LIMIT_SHARE * R) return false;
  resetTrueMotionAhead(w, ds);
  return true;
}

/**
 * Head-up is unstabilised, and an unstabilised picture cannot be shown in true motion: the picture
 * turns with every yaw, so own ship's track could not be drawn across it (Radar and ARPA Manual, 3rd
 * edition, 1.5.2.1: any orientation except unstabilised head-up can be used with true motion). The
 * mode just chosen wins: choosing head-up puts the picture into relative motion; choosing true motion
 * while in head-up turns the picture to course-up, which keeps the heading up and is stabilised.
 * Returns the change made to the other mode, if any.
 */
export function settleDisplayModes(ds: Pick<DisplayState, "orientation" | "motion">, chosen: "orientation" | "motion"): Partial<Pick<DisplayState, "orientation" | "motion">> {
  if (ds.orientation !== "head-up" || ds.motion !== "true") return {};
  return chosen === "orientation" ? { motion: "relative" } : { orientation: "course-up" };
}

/** Spacing of the fixed range rings for each range scale, NM. */
export function ringInterval(rangeNm: number): number {
  if (rangeNm <= 0.25) return 0.05;
  if (rangeNm <= 0.5) return 0.1;
  if (rangeNm <= 1.5) return 0.25;
  if (rangeNm <= 3) return 0.5;
  if (rangeNm <= 6) return 1;
  if (rangeNm <= 12) return 2;
  if (rangeNm <= 24) return 4;
  if (rangeNm <= 48) return 8;
  return 16;
}

export function newDisplayState(w: World): DisplayState {
  return {
    orientation: "north-up",
    motion: "relative",
    stabilisation: "ground",
    courseUpRef: measuredHeading(w),
    viewOrigin: { ...w.own.pos },
    offCentre: { x: 0, y: 0 },
    inputShift: { e: 0, n: 0 },
  };
}

export { normalizeDeg };
