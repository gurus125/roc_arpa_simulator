import { length, sub } from "../core/vec";
import { Target, World } from "./types";

/**
 * Visibility. The simulator has no view from the bridge windows, so visibility is a condition of the
 * exercise: the instructor (or the scenario) sets how far one can see, the trainee is told it, and a
 * lookout reports the vessels that come into sight. With no figure set the visibility is good and
 * nothing here applies.
 *
 * PLACEHOLDER model: a vessel is taken to be in sight when her range is not more than the visibility.
 * A real sighting also depends on her size and lights, the height of eye, daylight and what lies
 * between; none of that is modelled.
 */

/** The figures offered to the instructor, NM (those commonly used to describe fog and mist; a choice of this project). */
export const VISIBILITY_STEPS_NM = [5, 2, 1, 0.5, 0.25, 0.1];
export const MAX_VISIBILITY_NM = 20;

/** The visibility in force, NM, or null when it is good (no figure set). */
export function visibilityNm(w: Pick<World, "env">): number | null {
  const v = w.env.visibilityNm;
  return v !== undefined && Number.isFinite(v) && v > 0 ? v : null;
}

const isVessel = (t: Target): boolean => t.kind === "ship" || t.kind === "small-craft";

/** Whether a target is in sight from own ship: true or false when a visibility is set, null when it is good. */
export function inSight(w: World, t: Target): boolean | null {
  const v = visibilityNm(w);
  if (v === null) return null;
  return length(sub(t.pos, w.own.pos)) <= v;
}

/** The vessels in sight now, nearest first. Empty when the visibility is good (nothing is reported then). */
export function vesselsInSight(w: World): Target[] {
  const v = visibilityNm(w);
  if (v === null) return [];
  const range = (t: Target): number => length(sub(t.pos, w.own.pos));
  return w.targets.filter((t) => isVessel(t) && range(t) <= v).sort((a, b) => range(a) - range(b));
}
