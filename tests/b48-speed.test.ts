import { describe, expect, it } from "vitest";
import { distanceToSegment } from "../src/core/nav";
import { ARPA_PLACEHOLDERS } from "../src/arpa/index";
import { extractPlots } from "../src/arpa/plots";
import { SCENARIOS, createWorld, seaClutterProbability, seaClutterSampler } from "../src/engine/index";
import { distanceToLandNm } from "../src/train/index";

/**
 * The shortcuts taken for speed (rs-b48) give exactly the answers of the long way round: the sea clutter worked
 * with its constants taken out of the loop, the ARPA looking only at the coastline near its tracks and zones, and
 * the distance to the land found through squares.
 */
const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
};
const AREAS = ["mumbai", "goa", "kochi", "kutch"];

describe("shortcuts that change nothing", () => {
  it("the sea clutter sampler gives seaClutterProbability to the last digit", () => {
    const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 37, speed: 10 }, env: { seaState: 6, wind: { from: 300, speedKn: 25 } }, coasts: [], targets: [] });
    for (const [stc, avg, band] of [[0, false, "X"], [40, true, "S"]] as const) {
      w.radar.controls.stc = stc;
      w.radar.controls.echoAverage = avg;
      w.radar.band = band;
      const at = seaClutterSampler(w);
      const rnd = seeded(3);
      for (let i = 0; i < 2000; i++) {
        const r = 6 * rnd(), b = 360 * rnd();
        expect(at(r, b)).toBe(seaClutterProbability(w, r, b));
      }
    }
  });

  it("the distance to the land through squares is the distance to the nearest edge", () => {
    for (const id of AREAS) {
      const w = createWorld(SCENARIOS.find((s) => s.terrain === id)!);
      const rnd = seeded(11);
      for (let i = 0; i < 300; i++) {
        w.own.pos = { e: -30 + 60 * rnd(), n: -30 + 60 * rnd() };
        let brute = Infinity;
        for (const e of w.edges) brute = Math.min(brute, distanceToSegment(w.own.pos, e.a, e.b));
        expect(distanceToLandNm(w), `${id} at ${w.own.pos.e.toFixed(2)}, ${w.own.pos.n.toFixed(2)}`).toBe(brute);
      }
    }
  });

  it("the ARPA's plots are the same whether it looks at the whole coastline or only near its tracks and zones", () => {
    const cfg = ARPA_PLACEHOLDERS;
    for (const id of ["kutch", "mumbai"]) {
      const w = createWorld(SCENARIOS.find((s) => s.terrain === id)!);
      const rnd = seeded(5);
      let land = 0;
      for (let trial = 0; trial < 20; trial++) {
        // Own ship 2 to 5 NM off a piece of the coast, the points of interest on the coastline round her.
        const at = w.coastSamples[Math.floor(rnd() * w.coastSamples.length)]!.pos;
        w.own.pos = { e: at.e + 2 + 3 * rnd(), n: at.n - 2 - 3 * rnd() };
        const pts = Array.from({ length: 6 }, () => {
          const s = w.coastSamples[Math.floor(rnd() * w.coastSamples.length)]!.pos;
          return Math.hypot(s.e - w.own.pos.e, s.n - w.own.pos.n) < 12 ? { e: s.e - w.own.pos.e, n: s.n - w.own.pos.n } : { e: -6 + 12 * rnd(), n: -6 + 12 * rnd() };
        });
        const ring = trial % 2 === 0 ? 3 + 3 * rnd() : 0;
        const want = (v: { e: number; n: number }): boolean => pts.some((p) => Math.hypot(p.e - v.e, p.n - v.n) < 0.6) || (ring > 0 && Math.hypot(v.e, v.n) < ring && Math.hypot(v.e, v.n) > ring - 1);
        const boxes = pts.map((p): [number, number, number, number] => [p.e - 0.6, p.n - 0.6, p.e + 0.6, p.n + 0.6]);
        if (ring > 0) boxes.push([-ring, -ring, ring, ring]);
        const all = extractPlots(w, cfg, seeded(100 + trial), want, null);
        const near = extractPlots(w, cfg, seeded(100 + trial), want, null, boxes);
        expect(near).toEqual(all);
        land += all.filter((p) => p.kind === "land").length;
      }
      expect(land, id).toBeGreaterThan(20);
    }
    // A box far larger than the ARPA's range (a zone widened by a huge margin) is cut to it; one that cannot be
    // worked out (not a number) means the whole coastline, as without boxes.
    const w = createWorld(SCENARIOS.find((s) => s.terrain === "goa")!);
    const all = (v: { e: number; n: number }): boolean => Math.hypot(v.e, v.n) < 8;
    const plain = extractPlots(w, cfg, seeded(9), all, null);
    expect(extractPlots(w, cfg, seeded(9), all, null, [[-1e9, -1e9, 1e9, 1e9]])).toEqual(plain);
    expect(extractPlots(w, cfg, seeded(9), all, null, [[Number.NaN, 0, 1, 1]])).toEqual(plain);
  });
});
