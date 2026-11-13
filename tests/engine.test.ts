import { describe, expect, it } from "vitest";
import {
  COASTAL, OPEN_SEA, Scenario, TrailStore, createWorld, detectionProbability, displayNmToWorld, effectiveSignal,
  lineOfSightBlocked, newDisplayState, orientationAngle, ownCogSog, radarHorizonNm, recentreTrueMotion, ringInterval,
  scanWedge, seaClutter, sensitivity, stcAttenuation, stepWorld, THRESHOLD, toRef, tuningFactor, updateTrueMotionOrigin,
  worldToDisplayNm, frameShift, gainFactor, noiseDensity, shadowFactor, minRangeNm,
} from "../src/engine/index";
import { fromPolar, length, dot, velocityOf } from "../src/core/vec";

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function lone(kind: "ship" | "buoy", rcs: number, height: number, bearing: number, range: number) {
  const sc: Scenario = {
    id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [],
    targets: [{ id: 1, name: "x", kind, pos: fromPolar(bearing, range), course: 0, speed: 0, rcs, height, events: [] }],
  };
  const w = createWorld(sc, 62);
  w.radar.controls.tuning = 62; // tuned
  w.radar.shadowSectors = [];
  return w;
}

const targetHits = (w: ReturnType<typeof createWorld>, from: number, to: number) =>
  scanWedge(w, from, to, () => 0.5).filter((h) => h.kind === "target");

describe("world motion", () => {
  it("turns at a limited rate toward the ordered course", () => {
    const w = createWorld(OPEN_SEA);
    w.own.ordered.course = 90;
    stepWorld(w, 10);
    expect(w.own.heading).toBeCloseTo(20, 6);
    for (let i = 0; i < 60; i++) stepWorld(w, 1);
    expect(w.own.heading).toBeCloseTo(90, 6);
  });
  it("changes speed at a limited rate", () => {
    const w = createWorld(OPEN_SEA);
    w.own.ordered.speed = 6;
    stepWorld(w, 10);
    expect(w.own.speedThroughWater).toBeCloseTo(11, 6);
  });
  it("moves own ship over the ground including the current", () => {
    const w = createWorld({ ...OPEN_SEA, env: { current: { set: 90, drift: 2 } } });
    w.own.speedThroughWater = 10;
    w.own.ordered.speed = 10;
    w.own.heading = 0;
    w.own.ordered.course = 0;
    const cog = ownCogSog(w);
    expect(cog.course).toBeCloseTo(11.31, 1); // atan(2/10)
    expect(cog.speed).toBeCloseTo(Math.hypot(10, 2), 6);
    for (let i = 0; i < 360; i++) stepWorld(w, 10); // one hour
    expect(w.own.pos.n).toBeCloseTo(10, 4);
    expect(w.own.pos.e).toBeCloseTo(2, 4);
  });
  it("moves targets and fires scheduled manoeuvres", () => {
    const w = createWorld(OPEN_SEA);
    const a = w.targets.find((t) => t.id === 1)!;
    expect(a.course).toBe(270);
    for (let i = 0; i < 1499; i++) stepWorld(w, 1);
    expect(a.course).toBe(270);
    for (let i = 0; i < 2; i++) stepWorld(w, 1);
    expect(a.course).toBe(300);
  });
});

describe("display frames", () => {
  it("north-up shows north at the top", () => {
    const w = createWorld(OPEN_SEA);
    const ds = newDisplayState(w);
    const p = worldToDisplayNm(w, ds, { e: 0, n: 3 });
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(3, 9);
  });
  it("head-up with heading 090 shows a target to the east dead ahead (top)", () => {
    const w = createWorld({ ...OPEN_SEA, own: { heading: 90, speed: 10 } });
    const ds = newDisplayState(w);
    ds.orientation = "head-up";
    const p = worldToDisplayNm(w, ds, { e: 3, n: 0 });
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(3, 9);
    expect(orientationAngle(ds, 90)).toBe(90);
  });
  it("head-up puts a target on the starboard beam on the right", () => {
    const w = createWorld({ ...OPEN_SEA, own: { heading: 90, speed: 10 } });
    const ds = newDisplayState(w);
    ds.orientation = "head-up";
    const p = worldToDisplayNm(w, ds, { e: 0, n: -3 }); // south of a ship heading east = starboard
    expect(p.x).toBeCloseTo(3, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });
  it("course-up keeps its reference when the heading changes", () => {
    const w = createWorld(OPEN_SEA);
    const ds = newDisplayState(w);
    ds.orientation = "course-up";
    ds.courseUpRef = 0;
    w.own.heading = 20;
    const p = worldToDisplayNm(w, ds, { e: 0, n: 3 });
    expect(p.y).toBeCloseTo(3, 9);
  });
  it("round-trips display and world positions in every mode", () => {
    const rnd = seeded(7);
    for (const orientation of ["north-up", "head-up", "course-up"] as const)
      for (const motion of ["relative", "true"] as const)
        for (const stabilisation of ["sea", "ground"] as const) {
          const w = createWorld(COASTAL);
          w.time = 1234;
          w.own.heading = 77;
          const ds = newDisplayState(w);
          Object.assign(ds, { orientation, motion, stabilisation, courseUpRef: 33 });
          recentreTrueMotion(w, ds);
          const p = { e: rnd() * 8 - 4, n: rnd() * 8 - 4 };
          const d = worldToDisplayNm(w, ds, p);
          const back = displayNmToWorld(w, ds, d.x, d.y);
          expect(back.e).toBeCloseTo(p.e, 9);
          expect(back.n).toBeCloseTo(p.n, 9);
        }
  });
  it("sea stabilised true motion: fixed objects slide with the current", () => {
    const w = createWorld({ ...COASTAL, env: { current: { set: 90, drift: 2 } } });
    const ds = newDisplayState(w);
    ds.motion = "true";
    ds.stabilisation = "sea";
    recentreTrueMotion(w, ds);
    const buoy = { e: 0, n: 5 };
    w.time = 1800; // 30 minutes
    expect(frameShift(w, ds).e).toBeCloseTo(1, 9);
    const d = worldToDisplayNm(w, ds, buoy);
    expect(d.x).toBeCloseTo(-1, 9);
    expect(d.y).toBeCloseTo(5, 9);
    ds.stabilisation = "ground";
    const g = worldToDisplayNm(w, ds, buoy);
    expect(g.x).toBeCloseTo(0, 9);
    expect(toRef(w, ds, buoy).e).toBeCloseTo(0, 9);
  });
  it("true motion resets the picture when own ship nears the edge", () => {
    const w = createWorld({ ...OPEN_SEA, own: { heading: 90, speed: 12 } });
    const ds = newDisplayState(w);
    ds.motion = "true";
    recentreTrueMotion(w, ds);
    let resets = 0;
    for (let i = 0; i < 1300; i++) {
      stepWorld(w, 1);
      if (updateTrueMotionOrigin(w, ds)) resets++;
    }
    expect(resets).toBe(1);
    const own = worldToDisplayNm(w, ds, w.own.pos);
    expect(length({ e: own.x, n: own.y })).toBeLessThan(0.66 * 6);
    expect(dot({ e: own.x, n: own.y }, velocityOf({ course: 90, speed: 12 }))).toBeLessThan(0);
  });
  it("has sensible range ring spacing", () => {
    expect(ringInterval(0.5)).toBe(0.1);
    expect(ringInterval(6)).toBe(1);
    expect(ringInterval(24)).toBe(4);
  });
});

describe("receiver controls", () => {
  it("gain and tuning behave as the handout describes", () => {
    expect(gainFactor(0)).toBeCloseTo(0.05, 9);
    expect(gainFactor(100)).toBeCloseTo(1.95, 9);
    expect(tuningFactor(62, 62)).toBeCloseTo(1, 9);
    expect(tuningFactor(20, 62)).toBeLessThan(0.3);
    expect(tuningFactor(50, 62)).toBeGreaterThan(tuningFactor(30, 62));
  });
  it("gain zero hides a large ship at 6 NM, normal gain shows it", () => {
    const w = lone("ship", 1, 20, 45, 6);
    w.radar.controls.gain = 0;
    expect(effectiveSignal(w, { rcs: 1, height: 20, rangeNm: 6, relBearing: 45, pos: w.targets[0]!.pos })).toBeLessThan(THRESHOLD);
    w.radar.controls.gain = 50;
    expect(effectiveSignal(w, { rcs: 1, height: 20, rangeNm: 6, relBearing: 45, pos: w.targets[0]!.pos })).toBeGreaterThan(THRESHOLD);
  });
  it("a detuned receiver loses weak echoes", () => {
    const w = lone("ship", 0.2, 10, 45, 8);
    const s = { rcs: 0.2, height: 10, rangeNm: 8, relBearing: 45, pos: w.targets[0]!.pos };
    const tuned = effectiveSignal(w, s);
    w.radar.controls.tuning = 10;
    expect(effectiveSignal(w, s)).toBeLessThan(tuned * 0.4);
  });
  it("excessive STC hides a small close buoy but not a large ship", () => {
    const buoy = lone("buoy", 0.015, 3, 90, 0.8);
    const sb = { rcs: 0.015, height: 3, rangeNm: 0.8, relBearing: 90, pos: buoy.targets[0]!.pos };
    expect(effectiveSignal(buoy, sb)).toBeGreaterThan(THRESHOLD);
    buoy.radar.controls.stc = 100;
    expect(effectiveSignal(buoy, sb)).toBeLessThan(THRESHOLD);
    const ship = lone("ship", 1, 20, 90, 0.8);
    ship.radar.controls.stc = 100;
    expect(effectiveSignal(ship, { rcs: 1, height: 20, rangeNm: 0.8, relBearing: 90, pos: ship.targets[0]!.pos })).toBeGreaterThan(THRESHOLD);
  });
  it("STC leaves distant echoes alone", () => {
    expect(stcAttenuation(10, 100)).toBeGreaterThan(0.9);
    expect(stcAttenuation(0.3, 100)).toBeLessThan(0.1);
  });
  it("sea clutter is strong near own ship and fades with range", () => {
    expect(seaClutter(0.5, 5)).toBeGreaterThan(THRESHOLD);
    expect(seaClutter(6, 5)).toBeLessThan(THRESHOLD * 0.1);
    expect(seaClutter(0.5, 0)).toBe(0);
  });
  it("radar horizon and ducting", () => {
    // 2.21 x (sqrt 18 + sqrt 3) = 2.21 x 5.9747 = 13.204; ducting doubles it (placeholder factor).
    expect(radarHorizonNm(18, 3, false)).toBeCloseTo(13.204, 2);
    expect(radarHorizonNm(18, 3, true)).toBeCloseTo(26.408, 2);
    const w = lone("buoy", 0.5, 3, 0, 14);
    const s = { rcs: 0.5, height: 3, rangeNm: 14, relBearing: 0, pos: w.targets[0]!.pos };
    expect(effectiveSignal(w, s)).toBe(0);
    w.env.ducting = true;
    expect(effectiveSignal(w, s)).toBeGreaterThan(0);
  });
  it("has a minimum range", () => {
    const w = lone("ship", 1, 20, 0, 0.02);
    expect(effectiveSignal(w, { rcs: 1, height: 20, rangeNm: 0.02, relBearing: 0, pos: w.targets[0]!.pos })).toBe(0);
    expect(minRangeNm(3)).toBeLessThan(minRangeNm(12));
  });
  it("shadow sector blanks a target astern", () => {
    const w = lone("ship", 1, 20, 180, 3);
    w.radar.shadowSectors = [{ from: 176, to: 184 }];
    expect(shadowFactor(w.radar, 180)).toBeLessThan(0.1);
    expect(shadowFactor(w.radar, 190)).toBe(1);
    const s = { rcs: 1, height: 20, rangeNm: 3, relBearing: 180, pos: w.targets[0]!.pos };
    expect(effectiveSignal(w, s)).toBeLessThan(THRESHOLD);
    expect(effectiveSignal(w, { ...s, relBearing: 190 })).toBeGreaterThan(THRESHOLD);
  });
  it("noise appears only when gain is too high", () => {
    const c = lone("ship", 1, 20, 0, 3);
    expect(noiseDensity(sensitivity(c.radar.controls, 62))).toBe(0);
    c.radar.controls.gain = 100;
    expect(noiseDensity(sensitivity(c.radar.controls, 62))).toBeGreaterThan(0.3);
  });
  it("detection probability is a smooth threshold", () => {
    expect(detectionProbability(0)).toBeLessThan(0.02);
    expect(detectionProbability(THRESHOLD)).toBeCloseTo(0.5, 9);
    expect(detectionProbability(2)).toBeGreaterThan(0.99);
  });
});

describe("antenna sweep", () => {
  it("paints a ship only while the sweep passes its bearing", () => {
    const w = lone("ship", 1, 20, 45, 6);
    expect(targetHits(w, 40, 50)).toHaveLength(1);
    expect(targetHits(w, 100, 110)).toHaveLength(0);
    expect(targetHits(w, 45, 50)).toHaveLength(0); // wedge is (from, to]
    expect(targetHits(w, 44, 45)).toHaveLength(1);
  });
  it("handles a wedge that wraps through north", () => {
    const w = lone("ship", 1, 20, 2, 5.5);
    expect(targetHits(w, 355, 5)).toHaveLength(1);
  });
  it("uses relative bearing, so the wedge moves with the heading", () => {
    const w = lone("ship", 1, 20, 45, 6);
    w.own.heading = 90; // ship now 45 - 90 = 315 relative
    expect(targetHits(w, 310, 320)).toHaveLength(1);
    expect(targetHits(w, 40, 50)).toHaveLength(0);
  });
  it("does not show a target outside the selected range scale", () => {
    const w = lone("ship", 1, 20, 45, 6);
    w.radar.controls.rangeNm = 3;
    expect(targetHits(w, 40, 50)).toHaveLength(0);
  });
  it("a close large ship produces multiple echoes at twice the range", () => {
    const w = lone("ship", 1, 20, 90, 1.0);
    w.radar.controls.rangeNm = 6;
    const hits = scanWedge(w, 85, 95, () => 0.1).filter((h) => h.kind === "multiple");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(length(hits[0]!.pos)).toBeCloseTo(2.0, 6);
  });
  it("sea clutter shows near own ship and STC removes it", () => {
    const sc: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 5 }, coasts: [], targets: [] };
    const w = createWorld(sc, 62);
    w.radar.controls.tuning = 62;
    w.radar.shadowSectors = [];
    const count = (): number => {
      const rnd = seeded(99);
      let n = 0;
      for (let a = 0; a < 360; a += 3) n += scanWedge(w, a, a + 3, rnd).filter((h) => h.kind === "sea-clutter").length;
      return n;
    };
    const none = count();
    expect(none).toBeGreaterThan(200);
    w.radar.controls.stc = 50;
    expect(count()).toBeLessThan(none * 0.15);
  });
  it("rain clutter appears in a rain zone and FTC reduces it", () => {
    const sc: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0, rain: [{ center: { e: 0, n: 3 }, radius: 1.5, intensity: 0.8 }] }, coasts: [], targets: [] };
    const w = createWorld(sc, 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.gain = 70;
    const count = (): number => {
      const rnd = seeded(5);
      let n = 0;
      for (let a = 0; a < 360; a += 3) n += scanWedge(w, a, a + 3, rnd).filter((h) => h.kind === "rain-clutter").length;
      return n;
    };
    const base = count();
    expect(base).toBeGreaterThan(20);
    w.radar.controls.ftc = 100;
    expect(count()).toBeLessThan(base * 0.2);
  });
  it("gain far too high floods the picture with noise", () => {
    const sc: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [], targets: [] };
    const w = createWorld(sc, 62);
    w.radar.controls.tuning = 62;
    const noise = (): number => {
      const rnd = seeded(3);
      let n = 0;
      for (let a = 0; a < 360; a += 3) n += scanWedge(w, a, a + 3, rnd).filter((h) => h.kind === "noise").length;
      return n;
    };
    expect(noise()).toBe(0);
    w.radar.controls.gain = 100;
    expect(noise()).toBeGreaterThan(50);
  });
});

describe("land and radar shadow", () => {
  const wall = (e: number): Scenario["coasts"][number] => ({ name: "w" + e, closed: false, points: [{ e, n: -1 }, { e, n: 1 }] });
  const sc: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [wall(2), wall(4)], targets: [] };
  it("a near headland blocks the echo from the land behind it", () => {
    const w = createWorld(sc, 62);
    const near = w.coastSamples.find((s) => s.edge === 0 && Math.abs(s.pos.n) < 0.3)!;
    const far = w.coastSamples.find((s) => s.edge === 1 && Math.abs(s.pos.n) < 0.3)!;
    expect(lineOfSightBlocked(w, near.pos, near.edge)).toBe(false);
    expect(lineOfSightBlocked(w, far.pos, far.edge)).toBe(true);
  });
  it("the sweep paints the near coast and not the shadowed far coast", () => {
    const w = createWorld(sc, 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.rangeNm = 6;
    const hits = scanWedge(w, 60, 120, () => 0.1).filter((h) => h.kind === "coast");
    expect(hits.length).toBeGreaterThan(10);
    expect(hits.every((h) => Math.abs(h.pos.e - 2) < 1e-9)).toBe(true);
  });
  it("coastal scenario draws land in the sweep", () => {
    const w = createWorld(COASTAL, 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.rangeNm = 12;
    let n = 0;
    const rnd = seeded(11);
    for (let a = 0; a < 360; a += 3) n += scanWedge(w, a, a + 3, rnd).filter((h) => h.kind === "coast").length;
    expect(n).toBeGreaterThan(100);
  });
});

describe("trails", () => {
  it("samples targets every 15 seconds and keeps the recent ones", () => {
    const w = createWorld(OPEN_SEA);
    const ds = newDisplayState(w);
    const trails = new TrailStore();
    for (let i = 0; i < 400; i++) {
      stepWorld(w, 1);
      trails.sample(w, ds);
    }
    const d = trails.recent(1, w.time, 3);
    expect(d.length).toBeGreaterThanOrEqual(12);
    expect(d.length).toBeLessThanOrEqual(13);
    const all = trails.recent(1, w.time, 12);
    expect(all.length).toBeGreaterThan(d.length);
    trails.clear();
    expect(trails.recent(1, w.time, 3)).toHaveLength(0);
  });
  it("relative trail of a fixed buoy points back along own ship's track", () => {
    const w = createWorld(OPEN_SEA);
    const ds = newDisplayState(w);
    const trails = new TrailStore();
    for (let i = 0; i < 300; i++) {
      stepWorld(w, 1);
      trails.sample(w, ds);
    }
    const dots = trails.recent(5, w.time, 12);
    const first = dots[0]!;
    const last = dots[dots.length - 1]!;
    // Own ship moves north, so the buoy's relative position moves south.
    expect(last.rel.n).toBeLessThan(first.rel.n);
    expect(last.rel.e).toBeCloseTo(first.rel.e, 6);
  });
});
