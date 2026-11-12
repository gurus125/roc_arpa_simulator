import { describe, expect, it } from "vitest";
import { Frame, REPLAY_SPEEDS, SessionRecord, frameInterpolated } from "../src/train/index";

/*
 * Hand-worked: between a frame at t = 0 and one at t = 10, time 2.5 is a quarter of the way,
 * so a ship that moves from (0, 0) to (0, 1) is at (0, 0.25), and one from (2, 0) to (2, -1) is at (2, -0.25).
 */
const frame = (t: number, own: [number, number], tg: [number, number, number][], alarms: string[] = []): Frame => ({
  t,
  own: { e: own[0], n: own[1], hdg: 0, spd: 12, ordC: 0, ordS: 12 },
  tg: tg.map(([id, e, n]) => ({ id, e, n, c: 180, s: 10 })),
  tracks: 0,
  alarms,
});
const rec = { frames: [frame(0, [0, 0], [[1, 2, 0]], ["CPA"]), frame(10, [0, 1], [[1, 2, -1], [2, 5, 5]])] } as unknown as SessionRecord;

describe("replay", () => {
  it("moves the ships smoothly between the recorded frames", () => {
    const f = frameInterpolated(rec, 2.5)!;
    expect(f.own.e).toBeCloseTo(0, 9);
    expect(f.own.n).toBeCloseTo(0.25, 9);
    expect(f.tg).toHaveLength(1); // the second target has not appeared yet
    expect(f.tg[0]!.e).toBeCloseTo(2, 9);
    expect(f.tg[0]!.n).toBeCloseTo(-0.25, 9);
    expect(f.alarms).toEqual(["CPA"]); // everything but the positions is as in the frame before
  });
  it("gives the recorded frame at a sample time, before the start and after the end", () => {
    expect(frameInterpolated(rec, 10)!.own.n).toBe(1);
    expect(frameInterpolated(rec, 10)!.tg).toHaveLength(2);
    expect(frameInterpolated(rec, 25)!.own.n).toBe(1);
    expect(frameInterpolated(rec, -5)!.own.n).toBe(0);
    expect(frameInterpolated({ frames: [] } as unknown as SessionRecord, 3)).toBeNull();
  });
  it("offers slow motion, real time and rapid replay", () => {
    expect(REPLAY_SPEEDS.some((v) => v < 1)).toBe(true);
    expect(REPLAY_SPEEDS).toContain(1);
    expect(REPLAY_SPEEDS.some((v) => v > 1)).toBe(true);
  });
});
