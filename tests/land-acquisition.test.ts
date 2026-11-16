import { describe, expect, it } from "vitest";
import { expandZone, inSectorZone } from "../src/core/zones";
import { fromPolar } from "../src/core/vec";
import { COASTAL, createWorld, stepWorld } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaSystem, landEchoExtentsM } from "../src/arpa/index";
import { ARPA_EXERCISES } from "../src/train/index";

/*
 * Automatic acquisition leaves out echoes as large as land (Pub. 1310, 2001, chapter 5: the sample ARPA does not
 * acquire an echo 800 m or more in range or in bearing). The 800 m is a PLACEHOLDER (ARPA_PLACEHOLDERS.landEchoMinM).
 * Smaller pieces of land, and clutter, are still acquired, and anything can still be acquired by hand.
 */

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};

describe("the size of a land echo", () => {
  const cell = 0.2; // NM: 370.4 m
  it("one cell stands for one cell's length of coast: 370 m", () => {
    expect(landEchoExtentsM([{ i: 30, j: 0, v: { e: 6, n: 0 } }], cell)[0]!).toBeCloseTo(370.4, 1);
  });
  it("two cells side by side, abeam at 6 NM: 741 m, under 800 m", () => {
    // Their centres subtend atan(0.2 / 6) = 1.909 degrees at a mean range of 6.0017 NM: 0.2000 NM across, plus one cell.
    const x = landEchoExtentsM([{ i: 30, j: 0, v: { e: 6, n: 0 } }, { i: 30, j: 1, v: { e: 6, n: 0.2 } }], cell);
    expect(x[0]!).toBeCloseTo(740.8, 0);
    expect(x[1]!).toBeCloseTo(740.8, 0);
    expect(x[0]!).toBeLessThan(ARPA_PLACEHOLDERS.landEchoMinM);
  });
  it("three in a row: 1111 m, land", () => {
    // atan(0.4 / 6) = 3.814 degrees at a mean range of 6.0056 NM: 0.3998 NM across, plus one cell: 0.5998 NM.
    const x = landEchoExtentsM([{ i: 30, j: 0, v: { e: 6, n: 0 } }, { i: 30, j: 1, v: { e: 6, n: 0.2 } }, { i: 30, j: 2, v: { e: 6, n: 0.4 } }], cell);
    expect(x[0]!).toBeCloseTo(0.5998 * 1852, -1);
    expect(x[2]!).toBeGreaterThan(ARPA_PLACEHOLDERS.landEchoMinM);
  });
  it("three in a line away from own ship: 0.4 NM deep plus one cell, 1111 m, land", () => {
    const x = landEchoExtentsM([{ i: 30, j: 0, v: { e: 6, n: 0 } }, { i: 31, j: 0, v: { e: 6.2, n: 0 } }, { i: 32, j: 0, v: { e: 6.4, n: 0 } }], cell);
    expect(x[1]!).toBeCloseTo(0.6 * 1852, 0);
  });
  it("cells that touch only at a corner are one echo; a cell two away is another", () => {
    const x = landEchoExtentsM([{ i: 30, j: 0, v: { e: 6, n: 0 } }, { i: 31, j: 1, v: { e: 6.2, n: 0.2 } }, { i: 33, j: 1, v: { e: 6.6, n: 0.2 } }], cell);
    expect(x[0]!).toBe(x[1]!);
    expect(x[2]!).toBeCloseTo(370.4, 1);
  });
});

describe("a zone made larger all round", () => {
  it("a ring grows inward and outward and stays a ring", () => {
    const z = expandZone({ innerNm: 5.5, outerNm: 6, fromRel: 0, toRel: 0 }, 0.6);
    expect(z.innerNm).toBeCloseTo(4.9, 9);
    expect(z.outerNm).toBeCloseTo(6.6, 9);
    expect(inSectorZone(fromPolar(200, 5.0), 0, z)).toBe(true);
  });
  it("a sector also grows to each side by the margin seen from its inner edge", () => {
    // Inner edge 2.5 - 0.5 = 2.0 NM; atan(0.5 / 2.0) = 14.04 degrees to each side of 300 to 060.
    const z = expandZone({ innerNm: 2.5, outerNm: 3, fromRel: 300, toRel: 60 }, 0.5);
    expect(z.innerNm).toBeCloseTo(2.0, 9);
    expect(z.outerNm).toBeCloseTo(3.5, 9);
    expect(z.fromRel).toBeCloseTo(285.96, 1);
    expect(z.toRel).toBeCloseTo(74.04, 1);
  });
  it("a sector that would reach all the way round becomes a ring", () => {
    const z = expandZone({ innerNm: 2, outerNm: 3, fromRel: 10, toRel: 0 }, 0.5);
    expect(inSectorZone(fromPolar(5, 2.5), 0, z)).toBe(true);
  });
});

describe("automatic acquisition in coastal waters", () => {
  const run = (cfgMinM: number, seconds: number, setup: (a: ArpaSystem) => void = () => {}, scenario = COASTAL) => {
    const w = createWorld(scenario, 62);
    w.radar.controls.tuning = 62;
    const a = new ArpaSystem(w, { ...ARPA_PLACEHOLDERS, landEchoMinM: cfgMinM });
    a.settings.guardZones[0]!.on = true; // the ring 5.5 to 6 NM, which crosses the coast and the island
    a.settings.autoAcquire = true;
    setup(a);
    const rng = seeded(5);
    let mostFalse = 0;
    while (w.time < seconds) {
      stepWorld(w, 0.5);
      a.step(w, rng);
      mostFalse = Math.max(mostFalse, a.tracks.filter((t) => t.truthId === null).length);
    }
    return { w, a, mostFalse };
  };

  it("the coast and the island, both far larger than 800 m, are not acquired", () => {
    expect(run(ARPA_PLACEHOLDERS.landEchoMinM, 600).mostFalse).toBe(0);
  });
  it("without the size test the coast fills the tracker", () => {
    const r = run(1e9, 600);
    expect(r.mostFalse).toBe(r.a.cfg.maxTracks);
  });
  it("a ship crossing the ring is still acquired", () => {
    // Bulk carrier H closes from 11 NM and crosses the ring after about a quarter of an hour.
    const r = run(ARPA_PLACEHOLDERS.landEchoMinM, 960);
    expect(r.a.tracks.some((t) => t.truthId === 5)).toBe(true);
  });
  it("rocks about 150 m across are acquired like ships (exercise 4), unless an exclusion area covers them", () => {
    const ex4 = ARPA_EXERCISES.find((e) => e.id === "arpa-4")!.scenario;
    expect(run(ARPA_PLACEHOLDERS.landEchoMinM, 300, () => {}, ex4).mostFalse).toBe(2);
    expect(run(ARPA_PLACEHOLDERS.landEchoMinM, 300, (a) => void (a.settings.exclusionZones[0]!.on = true), ex4).mostFalse).toBe(0);
  });
  it("with automatic acquisition off, land in the guard zone still sounds the guard zone alarm", () => {
    const r = run(ARPA_PLACEHOLDERS.landEchoMinM, 60, (a) => void (a.settings.autoAcquire = false));
    expect(r.a.alarms.some((x) => x.kind === "guard")).toBe(true);
    expect(r.a.tracks.length).toBe(0);
  });
  it("the coast can still be acquired by hand", () => {
    const w = createWorld(COASTAL, 62);
    w.radar.controls.tuning = 62;
    const a = new ArpaSystem(w);
    const rng = seeded(7);
    a.step(w, rng);
    const t = a.acquire(w, { e: 4.5, n: 0.5 })!; // the headland nearest own ship
    expect(t).toBeTruthy();
    while (w.time < 90) {
      stepWorld(w, 0.5);
      a.step(w, rng);
    }
    expect(a.tracks.some((x) => x.id === t.id && x.state === "tracking" && x.plots.length > 3)).toBe(true);
  });
});
