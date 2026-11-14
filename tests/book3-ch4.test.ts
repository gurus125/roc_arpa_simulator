import { describe, expect, it } from "vitest";
import { length } from "../src/core/vec";
import { trialManoeuvre } from "../src/core/trial";
import { Scenario, World, createWorld, ownTurnProfile, setShipModel, stepWorld } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaConfig, ArpaSystem } from "../src/arpa/index";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 4: Automatic radar target tracking,
 * specified facilities. Expected values are the book's figures or worked by hand, never taken from the
 * simulator. See docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};
const EXACT: ArpaConfig = { ...ARPA_PLACEHOLDERS, bearingNoiseDeg: 0, rangeNoiseNm: 0, rangeNoiseShortNm: 0, scintillationNm: 0 };
const world = (own: { heading: number; speed: number }, targets: Scenario["targets"]): World => {
  const w = createWorld({ id: "t", name: "t", description: "", own, env: { seaState: 0 }, coasts: [], targets }, 62);
  w.radar.controls.tuning = 62;
  w.radar.shadowSectors = [];
  return w;
};

describe("4.3 tracking", () => {
  it("4.3.2: after six fruitless scans the target is declared lost", () => {
    expect(ARPA_PLACEHOLDERS.lostAfterMissedScans).toBe(6);
  });
  it("4.3.1: no vector for about the first minute of tracking; full accuracy after 3 minutes", () => {
    expect(ARPA_PLACEHOLDERS.vectorAfterSec).toBe(60);
    expect(ARPA_PLACEHOLDERS.steadyAfterSec).toBe(180);
  });
  it("4.2.1: a target closing at 100 knots relative is acquired and tracked", () => {
    // Own ship 000 at 30 kn; a fast craft 4 NM ahead steering 180 at 70 kn: 100 kn relative, closing 1.667 NM a minute.
    const w = world({ heading: 0, speed: 30 }, [{ id: 1, name: "fast", kind: "ship", pos: { e: 0.5, n: 4 }, course: 180, speed: 70, rcs: 1, height: 10, events: [] }]);
    const a = new ArpaSystem(w, EXACT);
    const rng = seeded(1);
    a.step(w, rng);
    const t = a.acquire(w, { e: 0.5, n: 4 })!;
    expect(t).toBeTruthy();
    while (w.time < 100) {
      stepWorld(w, 0.5);
      a.step(w, rng);
    }
    expect(t.state).not.toBe("lost");
    expect(t.est).toBeTruthy();
    // Relative speed from the track: within the trend limits of 1 minute's tracking (IEC 62388 Table 8: 10%).
    expect(length(t.est!.relVel)).toBeGreaterThan(90);
    expect(length(t.est!.relVel)).toBeLessThan(110);
  });
});

describe("4.4.3 the trial manoeuvre includes own ship's dynamic characteristics", () => {
  // Own ship 000 at 12 kn tries 090 at once. She turns at 2 degrees a second, so she comes round on an arc of radius
  // v / w = (12 / 3600 NM a second) / (2 pi / 180 a second) = 0.0955 NM and ends 0.0955 NM north and east of where
  // she started, then runs east along that line. A buoy 2 NM east and 0.0955 NM north lies on her new track.
  const R = (12 / 3600) / ((2 * Math.PI) / 180);
  const buoy = { e: 2, n: R };
  const stopped = { course: 0, speed: 0 };
  it("with the turn: she runs straight at the buoy (CPA 0)", () => {
    const w = world({ heading: 0, speed: 12 }, []);
    const prof = ownTurnProfile(w, 90, 0, 1);
    expect(prof.dHeadingDeg.length).toBe(46); // 45 s of turning, sampled every second, plus the start
    const r = trialManoeuvre(buoy, { course: 0, speed: 12 }, stopped, { course: 90, speed: 12, delayMinutes: 0 }, prof);
    expect(r.cpa).toBeLessThan(0.002);
  });
  it("without it (turning at once) the buoy would seem to pass 0.0955 NM clear", () => {
    const r = trialManoeuvre(buoy, { course: 0, speed: 12 }, stopped, { course: 90, speed: 12, delayMinutes: 0 });
    expect(r.cpa).toBeCloseTo(R, 6);
  });
  it("a ship of a handling model comes round gradually under her autopilot, and gets there", () => {
    const w = world({ heading: 0, speed: 15 }, []);
    setShipModel(w, "container");
    for (let i = 0; i < 20; i++) stepWorld(w, 0.5);
    const prof = ownTurnProfile(w, 60, 0);
    const n = prof.dHeadingDeg.length;
    expect(prof.dHeadingDeg[n - 1]!).toBeCloseTo(60, 0);
    // Not at once: after 10 s she has turned only a little.
    expect(prof.dHeadingDeg[2]!).toBeLessThan(10);
    for (let k = 1; k < n; k++) expect(prof.dHeadingDeg[k]!).toBeGreaterThanOrEqual(prof.dHeadingDeg[k - 1]! - 1); // little overshoot back
  });
  it("the ARPA's trial uses it: the trial CPA of a target dead on the new track is near zero", () => {
    // Own ship 000 at 12 kn (simple handling, 2 degrees a second). A buoy on the line she would steer after turning to 090.
    // After 200 s of tracking own ship is 200 x 12 / 3600 = 0.667 NM further north, so the buoy is put 0.667 NM
    // further north than the line: then it lies on her track after the turn.
    const at = { e: 2.5, n: R + (200 * 12) / 3600 };
    const w = world({ heading: 0, speed: 12 }, [{ id: 1, name: "buoy", kind: "buoy", pos: at, course: 0, speed: 0, rcs: 0.5, height: 4, events: [] }]);
    const a = new ArpaSystem(w, EXACT);
    const rng = seeded(2);
    a.step(w, rng);
    const t = a.acquire(w, w.targets[0]!.pos)!;
    while (w.time < 200) {
      stepWorld(w, 0.5);
      a.step(w, rng);
    }
    a.settings.trial = { on: true, course: 90, speed: 12, delayMinutes: 0 };
    a.step(w, rng);
    const row = a.trial(w).find((x) => x.trackId === t.id)!;
    expect(row.result.cpa).toBeLessThan(0.02);
    // Turning at once would have it pass 0.0955 NM clear.
    expect(trialManoeuvre({ e: 2.5, n: R }, { course: 0, speed: 12 }, stopped, { course: 90, speed: 12, delayMinutes: 0 }).cpa).toBeCloseTo(R, 6);
  });
});

import { collisionPoints } from "../src/core/pad";
import { velocityOf } from "../src/core/vec";

describe("4.11 the predicted point of collision", () => {
  it("the faster ship has one collision point, on the target's track", () => {
    // Own ship 12 kn; target 6 NM east steering 000 at 6 kn. 144 t^2 = 36 + 36 t^2: t = 0.5774 h, point (6, 3.464).
    const p = collisionPoints({ e: 6, n: 0 }, velocityOf({ course: 0, speed: 6 }), 12);
    expect(p.length).toBe(1);
    expect(p[0]!.point.e).toBeCloseTo(6, 9);
    expect(p[0]!.point.n).toBeCloseTo(6 / Math.sqrt(3), 6);
  });
  it("the slower ship may have two, both on the target's track", () => {
    // Own 6 kn; target at (3, -8) steering 000 at 12 kn. 36 t^2 = 9 + (12 t - 8)^2: 108 t^2 - 192 t + 73 = 0,
    // t = (192 -/+ sqrt(5328)) / 216 = 0.5510 and 1.2268 h; points (3, -1.388) and (3, 6.722).
    const p = collisionPoints({ e: 3, n: -8 }, velocityOf({ course: 0, speed: 12 }), 6).sort((a, b) => a.tHours - b.tHours);
    expect(p.length).toBe(2);
    const t1 = (192 - Math.sqrt(5328)) / 216, t2 = (192 + Math.sqrt(5328)) / 216;
    expect(p[0]!.tHours).toBeCloseTo(t1, 6);
    expect(p[1]!.tHours).toBeCloseTo(t2, 6);
    for (const q of p) expect(q.point.e).toBeCloseTo(3, 9);
  });
  it("or none, when she is too slow to reach the target's track in time", () => {
    // Own 6 kn; target at (6, -6) steering 000 at 12 kn: 108 t^2 - 144 t + 72 = 0 has no real root.
    expect(collisionPoints({ e: 6, n: -6 }, velocityOf({ course: 0, speed: 12 }), 6)).toEqual([]);
  });
  it("at equal speeds the collision point lies on the perpendicular bisector of the line joining the ships", () => {
    // Target at (4, -4) steering 000 at 10 kn, own 10 kn: 80 t = 32, t = 0.4 h, point (4, 0): equidistant from both.
    const p = collisionPoints({ e: 4, n: -4 }, velocityOf({ course: 0, speed: 10 }), 10);
    expect(p.length).toBe(1);
    expect(Math.hypot(p[0]!.point.e, p[0]!.point.n)).toBeCloseTo(Math.hypot(p[0]!.point.e - 4, p[0]!.point.n + 4), 9);
  });
  it("a stopped target: the collision point is the target itself", () => {
    const p = collisionPoints({ e: 2, n: 3 }, { e: 0, n: 0 }, 10);
    expect(p.length).toBe(1);
    expect(p[0]!.point.e).toBeCloseTo(2, 9);
    expect(p[0]!.point.n).toBeCloseTo(3, 9);
  });
});
