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
}

/**
 * Reference frame.
 *  - Ground stabilised: the reference frame is the ground (world frame).
 *  - Sea stabilised: the frame drifts with the current, so charted fixed objects slide
 *    across the screen at the speed of the current, as on a real sea-stabilised display.
 */
export function frameShift(w: World, ds: DisplayState, time: number = w.time): Vec2 {
  return ds.stabilisation === "sea" ? scale(currentVelocity(w), time / 3600) : { e: 0, n: 0 };
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
 * True motion: when own ship drifts beyond 66% of the radius, reset the picture so the ship
 * reappears halfway out on the side opposite to its motion. Returns true if a reset happened.
 */
export function updateTrueMotionOrigin(w: World, ds: DisplayState): boolean {
  if (ds.motion !== "true") return false;
  const R = w.radar.controls.rangeNm;
  const ownRef = toRef(w, ds, w.own.pos);
  const off = sub(ownRef, ds.viewOrigin);
  if (length(off) <= 0.66 * R) return false;
  const v = ownRefVelocity(w, ds);
  const sp = length(v);
  if (sp < 0.05) {
    ds.viewOrigin = ownRef;
    return true;
  }
  const back = scale(v, -0.5 * R / sp);
  ds.viewOrigin = sub(ownRef, back);
  return true;
}

/** Spacing of the fixed range rings for each range scale, NM. */
export function ringInterval(rangeNm: number): number {
  if (rangeNm <= 0.25) return 0.05;
  if (rangeNm <= 0.5) return 0.1;
  if (rangeNm <= 1.5) return 0.25;
  if (rangeNm <= 3) return 0.5;
  if (rangeNm <= 6) return 1;
  if (rangeNm <= 12) return 2;
  return 4;
}

export function newDisplayState(w: World): DisplayState {
  return {
    orientation: "north-up",
    motion: "relative",
    stabilisation: "ground",
    courseUpRef: measuredHeading(w),
    viewOrigin: { ...w.own.pos },
    offCentre: { x: 0, y: 0 },
  };
}

export { normalizeDeg };
