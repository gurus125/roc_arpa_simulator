import { bearingOf, length, normalizeDeg, sub } from "../core/vec";
import { Target, World, vesselsInSight, visibilityNm } from "../engine/index";

/**
 * The lookout. The simulator has no view from the windows, so when a visibility is set the trainee is
 * told what the bridge would see: the visibility when it changes, each vessel as she comes into sight,
 * and when she is lost to sight again. In good visibility (no figure set) nothing is reported.
 *
 * The reports use the real positions. "In sight" is the placeholder model of engine/visibility.ts.
 */

const pad3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");

/** A bearing from the bow as the lookout would call it: "right ahead", "Green 45", "Red 120", "right astern". */
export function relativeCall(relBearing: number): string {
  const r = normalizeDeg(relBearing);
  const side = r <= 180 ? r : 360 - r;
  if (side < 2.5) return "right ahead";
  if (side > 177.5) return "right astern";
  return `${r <= 180 ? "Green" : "Red"} ${Math.round(side)}`;
}

/** How the lookout reports a vessel in sight. */
export function sightingText(w: World, t: Target): string {
  const d = sub(t.pos, w.own.pos);
  const brg = bearingOf(d);
  return `bearing ${pad3(brg)}° (${relativeCall(brg - w.own.heading)}), about ${length(d).toFixed(1)} NM`;
}

/** A vessel in sight is called lost only beyond this many times the visibility (to stop reports chattering at its edge). */
export const LOST_MARGIN = 1.1;

export class Lookout {
  private seen = new Set<number>();
  /** The visibility at the last call (null: good); undefined before the first call. */
  private last: number | null | undefined = undefined;

  /** The reports since the last call, in the order they would be made. Call after every step of the simulation. */
  step(w: World): string[] {
    const out: string[] = [];
    const vis = visibilityNm(w);
    // The visibility at the start is in the briefing and on the screen: only a change is reported.
    if (this.last !== undefined && vis !== this.last) {
      if (vis === null) out.push("BRIDGE: the visibility is good again.");
      else if (this.last === null) out.push(`BRIDGE: the visibility has closed to ${vis} NM. Rule 19 applies to vessels not in sight.`);
      else out.push(`BRIDGE: the visibility is now ${vis} NM.`);
    }
    this.last = vis;
    if (vis === null) {
      this.seen.clear();
      return out;
    }
    const now = vesselsInSight(w);
    const ids = new Set(now.map((t) => t.id));
    const fresh = now.filter((t) => !this.seen.has(t.id));
    if (fresh.length === 1) out.push(`LOOKOUT: a vessel in sight, ${sightingText(w, fresh[0]!)}.`);
    else if (fresh.length > 1) out.push(`LOOKOUT: ${fresh.length} vessels in sight: ${fresh.slice(0, 4).map((t) => sightingText(w, t)).join("; ")}${fresh.length > 4 ? "; and more" : ""}.`);
    for (const id of [...this.seen]) {
      if (ids.has(id)) continue;
      const t = w.targets.find((x) => x.id === id);
      // A vessel at the edge of the visibility is not called lost and found again with every step: she is lost
      // only once she is a tenth beyond it.
      if (t && length(sub(t.pos, w.own.pos)) <= vis * LOST_MARGIN) continue;
      this.seen.delete(id);
      // A vessel the instructor has taken away is simply gone: nothing is reported.
      if (t) out.push(`LOOKOUT: the vessel bearing ${pad3(bearingOf(sub(t.pos, w.own.pos)))}° is no longer in sight.`);
    }
    for (const t of now) this.seen.add(t.id);
    return out;
  }
}
