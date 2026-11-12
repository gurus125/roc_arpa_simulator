import { Vec2, sub } from "../core/vec";
import { DisplayState, toRef } from "./display";
import { World } from "./types";

export interface TrailDot {
  time: number;
  /** Target position relative to own ship at that moment. Drawn for relative trails. */
  rel: Vec2;
  /** Target position in the reference frame at that moment. Drawn for true trails. */
  ref: Vec2;
}

export class TrailStore {
  dots = new Map<number, TrailDot[]>();
  private lastSample = -Infinity;
  readonly interval = 15;
  readonly maxAge = 31 * 60;

  clear(): void {
    this.dots.clear();
    this.lastSample = -Infinity;
  }

  sample(w: World, ds: DisplayState): void {
    if (w.time - this.lastSample < this.interval) return;
    this.lastSample = w.time;
    for (const t of w.targets) {
      let list = this.dots.get(t.id);
      if (!list) {
        list = [];
        this.dots.set(t.id, list);
      }
      list.push({ time: w.time, rel: sub(t.pos, w.own.pos), ref: toRef(w, ds, t.pos, w.time) });
      while (list.length > 0 && w.time - list[0]!.time > this.maxAge) list.shift();
    }
  }

  recent(id: number, now: number, minutes: number): TrailDot[] {
    const list = this.dots.get(id) ?? [];
    return list.filter((d) => now - d.time <= minutes * 60);
  }
}
