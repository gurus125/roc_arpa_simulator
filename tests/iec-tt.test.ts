import { describe, expect, it } from "vitest";
import { angleDiffDeg, fromPolar, sub, velocityOf, add, scale, length } from "../src/core/vec";
import { computeCpa } from "../src/core/cpa";
import { Scenario, World, createWorld, stepWorld } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaConfig, ArpaSystem, Track, antennaTiltErrorDeg, paintedThisScan } from "../src/arpa/index";

/**
 * IEC 62388:2013, 11.3.14.4 to 11.3.14.7: target tracking scenarios 2 to 5 for standard ships (not
 * high-speed craft). "No sensor errors are applied" in these scenarios, so the ARPA runs without
 * measurement noise or glint. The required accuracies are the standard's:
 *  - speed within 5% or 1 kn, whichever is greater; course within 3°;
 *  - scenario 5 also: CPA within 5% of the target's range but not less than 0.1 NM under 6 NM, and
 *    within 0.3 NM over 6 NM; TCPA within 1 minute.
 */
const NO_ERRORS: ArpaConfig = { ...ARPA_PLACEHOLDERS, bearingNoiseDeg: 0, rangeNoiseNm: 0, rangeNoiseShortNm: 0, scintillationNm: 0 };
type Tgt = Scenario["targets"][number];
const tgt = (id: number, bearing: number, range: number, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt =>
  ({ id, name: `T${id}`, kind: speed === 0 ? "buoy" : "ship", pos: fromPolar(bearing, range), course, speed, rcs: 50, height: 20, events: [], ...extra });

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function setup(own: { heading: number; speed: number }, targets: Tgt[]): { w: World; a: ArpaSystem; rng: () => number } {
  const w = createWorld({ id: "tt", name: "tt", description: "", own, env: { seaState: 0 }, coasts: [], targets }, 62);
  w.radar.controls.tuning = 62;
  w.radar.shadowSectors = [];
  // Own ship without a ship model: it turns and changes speed at the rates the scenario states.
  delete w.own.model;
  w.own.turnRateDegPerSec = 10;
  w.own.accelKnPerSec = 0.5;
  return { w, a: new ArpaSystem(w, NO_ERRORS), rng: seeded(3) };
}
function run(w: World, a: ArpaSystem, rng: () => number, until: number, each?: () => void, before?: () => void): void {
  while (w.time < until - 1e-9) {
    before?.();
    stepWorld(w, 0.5);
    a.step(w, rng);
    each?.();
  }
}
/** Steer own ship round through `deg` degrees in the direction `dir` (+1 clockwise), at her turn rate. */
function turner(w: World, dir: number, deg: number): () => void {
  const start = w.own.heading;
  let turned = 0;
  let last = w.own.heading;
  return () => {
    turned += Math.abs(angleDiffDeg(w.own.heading, last));
    last = w.own.heading;
    // Keep the ordered course a little ahead of the heading in the turn's direction, until the turn is done.
    w.own.ordered.course = (360 + start + dir * Math.min(deg, turned + 20)) % 360;
  };
}
const speedOk = (got: number, want: number): boolean => Math.abs(got - want) <= Math.max(1, 0.05 * want);
const courseOk = (got: number, want: number, speed: number): boolean => speed < 1 || Math.abs(angleDiffDeg(got, want)) <= 3;

/** Acquire every target by its position now; returns its track by target id. */
function acquireAll(w: World, a: ArpaSystem): Map<number, Track> {
  const m = new Map<number, Track>();
  for (const t of w.targets) m.set(t.id, a.acquire(w, sub(t.pos, w.own.pos))!);
  return m;
}
/** Every track still tracking, and still following the target it was acquired on (no swap). */
function continuous(tracks: Map<number, Track>, w?: World): string[] {
  const bad: string[] = [];
  for (const [id, t] of tracks) {
    const at = w ? ` at ${Math.round(w.time)} s` : "";
    if (t.state !== "tracking") bad.push(`target ${id}: ${t.state}${at}`);
    else if (t.swaps > 0 || (t.firstTruthId !== null && t.truthId !== id)) bad.push(`target ${id}: swapped to ${t.truthId}${at}`);
  }
  return bad;
}
/** The first report for each target only. */
const firsts = (xs: string[]): string[] => xs.filter((x, i) => xs.findIndex((y) => y.split(":")[0] === x.split(":")[0]) === i);
/** Course and speed errors of every track, for the record. */
function errors(w: World, tracks: Map<number, Track>): string {
  return [...tracks]
    .map(([id, t]) => {
      const real = w.targets.find((x) => x.id === id)!;
      const e = t.est!;
      const dc = real.speed < 1 ? 0 : Math.abs(angleDiffDeg(e.trueCS.course, real.course));
      return `T${id} ${dc.toFixed(1)}°/${Math.abs(e.trueCS.speed - real.speed).toFixed(2)} kn`;
    })
    .join(", ");
}
function accuracy(w: World, tracks: Map<number, Track>): string[] {
  const bad: string[] = [];
  for (const [id, t] of tracks) {
    const real = w.targets.find((x) => x.id === id)!;
    const e = t.est;
    if (!e) {
      bad.push(`target ${id}: no data`);
      continue;
    }
    if (!speedOk(e.trueCS.speed, real.speed)) bad.push(`target ${id}: speed ${e.trueCS.speed.toFixed(2)} for ${real.speed}`);
    if (!courseOk(e.trueCS.course, real.course, real.speed)) bad.push(`target ${id}: course ${e.trueCS.course.toFixed(1)} for ${real.course}`);
  }
  return bad;
}

describe("IEC 62388 Annex E.2.2: antenna tilt error from roll", () => {
  it("10° of roll gives 0.44° on the bows and quarters at full roll, nothing ahead or abeam, 0.22° on average", () => {
    // (r²/4) sin 2b with r = 10° = 0.174533 rad: 0.0076154 rad = 0.4363°.
    expect(Math.abs(antennaTiltErrorDeg(45, 10, 0))).toBeCloseTo(0.4363, 3);
    expect(antennaTiltErrorDeg(0, 10, 0)).toBeCloseTo(0, 9);
    expect(antennaTiltErrorDeg(90, 10, 0)).toBeCloseTo(0, 9);
    expect(antennaTiltErrorDeg(45, 10, 0)).toBeCloseTo(-antennaTiltErrorDeg(135, 10, 0), 9);
    expect(antennaTiltErrorDeg(45, 0, 10)).toBeCloseTo(-antennaTiltErrorDeg(45, 10, 0), 9); // pitch the other way
    // Averaged over a roll cycle (roll = 10 sin wt) the error at 045 is half the peak: 0.218°.
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += Math.abs(antennaTiltErrorDeg(45, 10 * Math.sin((2 * Math.PI * i) / 1000), 0));
    expect(sum / 1000).toBeCloseTo(0.218, 2);
  });
});

describe("IEC 62388 TT scenario 2: own ship turning through 180° at 10°/s while stopped", () => {
  for (const dir of [1, -1]) {
    it(dir > 0 ? "clockwise" : "anticlockwise", () => {
      const { w, a, rng } = setup({ heading: 0, speed: 0 }, [tgt(1, 23, 8, 135, 30), tgt(2, 135, 5, 270, 20)]);
      a.step(w, rng);
      const tracks = acquireAll(w, a);
      run(w, a, rng, 150); // tracked for more than 2 minutes
      const lost: string[] = [];
      const turn = turner(w, dir, 180);
      const headings: number[] = [];
      run(w, a, rng, 150 + 18, () => {
        lost.push(...continuous(tracks, w));
        headings.push(w.own.heading);
      }, turn);
      expect(Math.abs(angleDiffDeg(w.own.heading, 180))).toBeLessThan(0.01);
      // It went round the way it was meant to: 045 on the way for clockwise, 315 for anticlockwise.
      expect(headings.some((h) => Math.abs(angleDiffDeg(h, dir > 0 ? 45 : 315)) < 5)).toBe(true);
      run(w, a, rng, 150 + 18 + 90, () => lost.push(...continuous(tracks, w)), turn);
      console.log(`IEC TT2 ${dir > 0 ? "clockwise" : "anticlockwise"}, 1.5 min after the turn: ${errors(w, tracks)}`);
      expect(firsts(lost)).toEqual([]);
      expect(accuracy(w, tracks)).toEqual([]);
    });
  }
});

describe("IEC 62388 TT scenario 3: own ship at 30 kn turning 180° while a target turns 60°", () => {
  for (const dir of [1, -1]) {
    it(dir > 0 ? "clockwise" : "anticlockwise", () => {
      const { w, a, rng } = setup({ heading: 0, speed: 30 }, [tgt(1, 23, 5, 180, 45), tgt(2, 340, 3, 0, 0), tgt(3, 180, 8, 0, 30)]);
      a.step(w, rng);
      const tracks = acquireAll(w, a);
      run(w, a, rng, 150);
      const lost: string[] = [];
      const turn = turner(w, dir, 180);
      // Target 3 turns 60° the same way at 10°/s, over 6 s.
      const t3 = w.targets.find((x) => x.id === 3)!;
      const start = w.time;
      run(w, a, rng, start + 18, () => {
        t3.course = (360 + dir * Math.min(60, (w.time - start) * 10)) % 360;
        lost.push(...continuous(tracks, w));
      }, turn);
      expect(Math.abs(angleDiffDeg(w.own.heading, 180))).toBeLessThan(0.01);
      run(w, a, rng, start + 18 + 90, () => lost.push(...continuous(tracks, w)), turn);
      console.log(`IEC TT3 ${dir > 0 ? "clockwise" : "anticlockwise"}, 1.5 min after the turns: ${errors(w, tracks)}`);
      expect(firsts(lost)).toEqual([]);
      expect(accuracy(w, tracks)).toEqual([]);
      // The adaptive window cut in for target 3, which turned, and for no other: own ship's turn alone
      // does not move a target's plots off its line when there are no sensor errors.
      expect(tracks.get(3)!.windowRestarts).toBeGreaterThan(0);
      expect(tracks.get(1)!.windowRestarts + tracks.get(2)!.windowRestarts).toBe(0);
    });
  }
});

describe("IEC 62388 TT scenario 4: a 70 kn target passing a buoy and own ship", () => {
  it("both are tracked without a swap, with course and speed right at 2, 5 and 7 minutes", () => {
    const { w, a, rng } = setup({ heading: 45, speed: 28 }, [tgt(1, 31, 2.02, 0, 0), tgt(2, 37, 7.01, 225, 70)]);
    a.step(w, rng);
    const tracks = acquireAll(w, a);
    const lost: string[] = [];
    for (const m of [2, 5, 7]) {
      run(w, a, rng, m * 60, () => lost.push(...continuous(tracks, w)));
      console.log(`IEC TT4 at ${m} min: ${errors(w, tracks)}`);
      expect(accuracy(w, tracks)).toEqual([]);
    }
    expect(firsts(lost)).toEqual([]);
    // The buoy really is about 0.5 NM from both tracks (the scenario's geometry).
    const buoy = w.targets[0]!.pos;
    const ownCpa = computeCpa(sub(buoy, fromPolar(0, 0)), scale(velocityOf({ course: 45, speed: 28 }), -1));
    expect(ownCpa.cpa).toBeGreaterThan(0.4);
    expect(ownCpa.cpa).toBeLessThan(0.6);
  });
});

describe("IEC 62388 TT scenario 5: ten targets, one fading, own ship slowing down", () => {
  it("all are tracked without a swap, and course, speed, CPA and TCPA are right at 3, 6, 11 and 14 minutes", () => {
    // Own ship 315° at 25 kn; at 7 minutes she slows to 15 kn at 0.5 kn/s. Target 6 has only 50% paint.
    const T = [
      tgt(1, 288, 4.47, 45, 20), tgt(2, 304, 5.1, 45, 30), tgt(3, 288, 6.71, 45, 40), tgt(4, 307, 7.07, 0, 0),
      tgt(5, 352, 12.0, 200, 60), tgt(6, 315, 11.0, 225, 20, { paint: 0.5 }), tgt(7, 349, 14.4, 190, 40),
      tgt(8, 318, 8.0, 0, 0), tgt(9, 318, 9.0, 0, 0), tgt(10, 318, 10.0, 0, 0),
    ];
    const { w, a, rng } = setup({ heading: 315, speed: 25 }, T);
    a.step(w, rng);
    const tracks = acquireAll(w, a); // t0: all acquired at once
    const lost: string[] = [];
    const problems: string[] = [];
    for (const m of [3, 6, 11, 14]) {
      run(w, a, rng, m * 60, () => {
        if (w.time >= 7 * 60 && w.own.ordered.speed !== 15) w.own.ordered.speed = 15;
        lost.push(...continuous(tracks, w));
      });
      problems.push(...accuracy(w, tracks).map((x) => `${m} min: ${x}`));
      console.log(`IEC TT5 at ${m} min: ${errors(w, tracks)}`);
      // CPA and TCPA against the truth, for targets still closing.
      const ownV = velocityOf({ course: w.own.heading, speed: w.own.speedThroughWater });
      for (const [id, t] of tracks) {
        const real = w.targets.find((x) => x.id === id)!;
        const rel = sub(real.pos, w.own.pos);
        const truth = computeCpa(rel, sub(velocityOf({ course: real.course, speed: real.speed }), ownV));
        if (truth.opening || truth.tcpaMinutes === null || !t.est) continue;
        const range = length(rel);
        const cpaTol = range < 6 ? Math.max(0.1, 0.05 * range) : 0.3;
        if (Math.abs(t.est.cpa.cpa - truth.cpa) > cpaTol) problems.push(`${m} min: target ${id} CPA ${t.est.cpa.cpa.toFixed(2)} for ${truth.cpa.toFixed(2)}`);
        if (Math.abs((t.est.cpa.tcpaMinutes ?? 99) - truth.tcpaMinutes) > 1) problems.push(`${m} min: target ${id} TCPA ${t.est.cpa.tcpaMinutes?.toFixed(1)} for ${truth.tcpaMinutes.toFixed(1)}`);
      }
    }
    expect(w.own.speedThroughWater).toBeCloseTo(15, 1);
    expect(firsts(lost)).toEqual([]);
    expect(problems).toEqual([]);
    void add;
  });
});

describe("IEC 62388 11.3.9: a target painted on 5 out of 10 scans", () => {
  it("a paint of 0.5 gives every other scan; 0.3 gives 3 of every 10, evenly spread", () => {
    const a = {};
    const got = Array.from({ length: 10 }, () => paintedThisScan(a, 0.5));
    expect(got).toEqual([false, true, false, true, false, true, false, true, false, true]);
    const b = {};
    const got3 = Array.from({ length: 20 }, () => paintedThisScan(b, 0.3));
    expect(got3.filter(Boolean).length).toBe(6);
    // Never more than three scans running without a paint at 0.3 (10/3 rounded up).
    let run = 0, longest = 0;
    for (const x of got3) longest = Math.max(longest, (run = x ? 0 : run + 1));
    expect(longest).toBeLessThanOrEqual(3);
  });
});

describe("Adaptive tracking window", () => {
  it("without it, a 3-minute window cannot meet TT scenario 3: the turned target's course is still far off", () => {
    const { w, rng } = setup({ heading: 0, speed: 30 }, [tgt(3, 180, 8, 0, 30)]);
    const a = new ArpaSystem(w, { ...NO_ERRORS, manoeuvreSigmas: Infinity });
    a.step(w, rng);
    const t = a.acquire(w, w.targets[0]!.pos)!;
    run(w, a, rng, 150);
    const t3 = w.targets[0]!;
    const start = w.time;
    run(w, a, rng, start + 18 + 90, () => (t3.course = Math.min(60, (w.time - start) * 10)), turner(w, 1, 180));
    expect(Math.abs(angleDiffDeg(t.est!.trueCS.course, 60))).toBeGreaterThan(10);
    expect(t.windowRestarts).toBe(0);
  });

  it("does not cut in on steady targets with the standard's sensor errors and 10° of roll", () => {
    // IEC 62388 Annex E errors (the ARPA's own defaults) on 40 ten-minute runs of two crossing targets.
    let restarts = 0;
    for (let r = 0; r < 20; r++) {
      for (const range of [3, 12]) {
        const w = createWorld({ id: "s", name: "s", description: "", own: { heading: 0, speed: 15 }, env: { seaState: 0 }, coasts: [],
          targets: [tgt(1, 30, range, 200, 18, { lengthM: 200 }), tgt(2, 300, range, 90, 12, { lengthM: 200 })] }, 62);
        w.radar.shadowSectors = [];
        const a = new ArpaSystem(w);
        const rng = seeded(101 + 7 * r + range);
        a.step(w, rng);
        const ts = w.targets.map((x) => a.acquire(w, x.pos)!);
        while (w.time < 600) {
          stepWorld(w, 0.5);
          w.own.seaway = { rollDeg: 10 * Math.sin((2 * Math.PI * w.time) / 10), pitchDeg: 0, yawDeg: 0, heaveM: 0, rollPhase: 0, encounterPhase: 0 };
          a.step(w, rng);
        }
        for (const t of ts) restarts += t.windowRestarts;
      }
    }
    expect(restarts).toBe(0);
  });
});
