import { describe, expect, it } from "vitest";
import { fromPolar } from "../src/core/vec";
import {
  Scenario, THRESHOLD, World, createWorld, detectionProbability, effectiveSignal, fadeDraw, normalCdf, rainLumps, rainTexture,
  scanWedge, seaClutterProbability, seaTexture, smoothNormal,
} from "../src/engine/index";

/**
 * The texture of the picture (engine/texture.ts): spiky sea clutter, irregular rain and small echoes that fade in
 * runs, none of which may change the averages the radar is calibrated to. The expected values are worked out
 * independently: from tables of the normal distribution, from the exponential distribution in closed form, and by
 * integrating the clutter probability numerically.
 */
const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
};
const world = (env: Scenario["env"], targets: Scenario["targets"] = []): World => {
  const w = createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env, coasts: [], targets }, 62);
  w.radar.controls.tuning = 62;
  w.radar.shadowSectors = [];
  return w;
};

describe("the random pieces", () => {
  it("the normal distribution function matches the printed table", () => {
    // The approximation is good to 1.5e-7 (Abramowitz and Stegun), so six places.
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975002, 5);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
    expect(normalCdf(2.5758)).toBeCloseTo(0.995, 4);
  });

  it("a smooth normal process is standard normal at every moment and alike over a few seconds", () => {
    let sum = 0, sq = 0, n = 0, below = 0, both = 0, first = 0;
    for (let id = 1; id <= 400; id++) {
      for (let k = 0; k < 50; k++) {
        const t = k * 37.3 + id * 0.71;
        const z = smoothNormal(id, 3, t, 5);
        sum += z;
        sq += z * z;
        n++;
        const u = fadeDraw(id, t);
        if (u < 0.8) below++;
        if (u < 0.5) {
          first++;
          if (fadeDraw(id, t + 2.5) < 0.5) both++;
        }
      }
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.03);
    expect(sq / n).toBeGreaterThan(0.95);
    expect(sq / n).toBeLessThan(1.05);
    // Evenly spread: the share below 0.8 is 0.8, as for a random number.
    expect(Math.abs(below / n - 0.8)).toBeLessThan(0.012);
    // Alike one scan (2.5 s) later: below the half again far more often than the half of the time chance would give.
    expect(both / first).toBeGreaterThan(0.75);
  });
});

describe("spiky sea clutter", () => {
  const w = world({ seaState: 5, wind: { from: 0, speedKn: 20 } });

  it("each patch has its own strength, mean 1, with spikes as often as the distribution gives", () => {
    // Strength = x^1.5 / Γ(2.5) with x exponential: above 3 when x > (3 Γ(2.5))^(2/3) = 2.5148, so on e^-2.5148 = 8.1% of patches.
    let sum = 0, spikes = 0, n = 0;
    for (let i = 0; i < 200; i++) for (let j = 0; j < 200; j++) {
      const s = seaTexture(w, { e: i * 0.031 - 3, n: j * 0.123 - 12 });
      sum += s;
      if (s > 3) spikes++;
      n++;
    }
    expect(Math.abs(sum / n - 1)).toBeLessThan(0.03);
    expect(Math.abs(spikes / n - 0.0809)).toBeLessThan(0.006);
  });

  it("the patches lie in streaks along the crests, and the pattern is new on every scan", () => {
    // Sea from the north: crests run east and west. Points 0.05 NM apart east-west often share a patch; north-south never.
    let alongCrest = 0, alongSea = 0, sameNext = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const p = { e: (i % 50) * 0.37 + 0.011, n: Math.floor(i / 50) * 0.29 + 0.013 };
      const s = seaTexture(w, p);
      if (seaTexture(w, { e: p.e + 0.05, n: p.n }) === s) alongCrest++;
      if (seaTexture(w, { e: p.e, n: p.n + 0.05 }) === s) alongSea++;
      w.time += 2.5; // one turn of the antenna at 24 rpm
      if (seaTexture(w, p) === s) sameNext++;
      w.time -= 2.5;
    }
    expect(alongCrest / n).toBeGreaterThan(0.45);
    expect(alongSea).toBe(0);
    expect(sameNext).toBe(0);
  });

  it("the picture keeps the calibrated mean density of clutter, with spikes brighter than the rest", () => {
    // Expected hits on one turn: 40 trials a degree, range 5 u^2 NM with u even on 0..1, bearing even: integrate p numerically.
    let expected = 0;
    const steps = 400;
    for (let a = 0; a < 360; a += 2) {
      for (let k = 0; k < steps; k++) {
        const u = (k + 0.5) / steps;
        expected += seaClutterProbability(w, Math.max(0.07, 5 * u * u), a) / steps;
      }
    }
    expected *= 40 * 2;
    w.radar.controls.rangeNm = 6;
    let total = 0, bright = 0, dim = 0;
    const turns = 12;
    for (let s = 0; s < turns; s++) {
      w.time = s * 2.5;
      const rnd = seeded(100 + s);
      for (let a = 0; a < 360; a += 3) {
        for (const h of scanWedge(w, a, a + 3, rnd)) {
          if (h.kind !== "sea-clutter") continue;
          total++;
          if (h.strength >= 0.75) bright++;
          if (h.strength <= 0.35) dim++;
        }
      }
    }
    expect(expected).toBeGreaterThan(500);
    expect(total / turns / expected).toBeGreaterThan(0.95);
    expect(total / turns / expected).toBeLessThan(1.03);
    expect(bright).toBeGreaterThan(0);
    expect(dim).toBeGreaterThan(bright);
  });
});

describe("irregular rain", () => {
  const zone = { center: { e: 0, n: 4 }, radius: 2, intensity: 0.8 };

  it("has a ragged edge inside its circle and a heavier core; over its area the mean is 1", () => {
    const w = world({ seaState: 0, rain: [zone] });
    expect(rainTexture(w, { e: 0, n: 6.01 })).toBe(0);
    // Out to 95% of the radius on some bearings, cut short before 80% on others.
    let reach = 0, short = 0;
    for (let b = 0; b < 360; b += 5) {
      const at = (f: number) => rainTexture(w, { e: zone.center.e + fromPolar(b, f * zone.radius).e, n: zone.center.n + fromPolar(b, f * zone.radius).n });
      if (at(0.95) > 0) reach++;
      if (at(0.8) === 0) short++;
    }
    expect(reach).toBeGreaterThan(0);
    expect(short).toBeGreaterThan(0);
    let sum = 0, n = 0, inner = 0, ni = 0, outer = 0, no = 0;
    for (let i = -100; i <= 100; i++) for (let j = -100; j <= 100; j++) {
      const p = { e: (i / 100) * zone.radius, n: zone.center.n + (j / 100) * zone.radius };
      const t = rainTexture(w, p);
      if (t <= 0) continue;
      sum += t;
      n++;
      const r = Math.hypot(p.e, p.n - zone.center.n) / zone.radius;
      if (r < 0.3) { inner += t; ni++; } else if (r > 0.6) { outer += t; no++; }
    }
    expect(Math.abs(sum / n - 1)).toBeLessThan(0.1);
    expect(inner / ni).toBeGreaterThan(outer / no);
  });

  it("its lumps drift with the wind", () => {
    // Wind from 270 at 20 kn: the lumps go east at 60% of it, 12 kn, so 2 NM in 10 minutes.
    const w = world({ seaState: 0, rain: [zone], wind: { from: 270, speedKn: 20 } });
    const pts = Array.from({ length: 50 }, (_, i) => ({ e: -1.5 + (i % 10) * 0.13, n: 3 + Math.floor(i / 10) * 0.17 }));
    const before = pts.map((p) => rainLumps(w, 0, p));
    w.time = 600;
    pts.forEach((p, i) => expect(rainLumps(w, 0, { e: p.e + 2, n: p.n })).toBeCloseTo(before[i]!, 9));
    expect(pts.some((p, i) => Math.abs(rainLumps(w, 0, p) - before[i]!) > 0.05)).toBe(true);
  });

  it("the picture paints rain only inside its ragged area", () => {
    const w = world({ seaState: 0, rain: [zone] });
    w.radar.controls.rangeNm = 12;
    w.radar.controls.gain = 70;
    const hits = [] as ReturnType<typeof scanWedge>;
    const rnd = seeded(7);
    for (let a = 0; a < 360; a += 3) hits.push(...scanWedge(w, a, a + 3, rnd).filter((h) => h.kind === "rain-clutter"));
    expect(hits.length).toBeGreaterThan(20);
    for (const h of hits) expect(rainTexture(w, h.pos)).toBeGreaterThan(0);
  });
});

describe("small echoes fade in runs in a seaway", () => {
  /** A buoy at 045° placed where it is painted on about 60% of scans; the scans it is painted on, one turn every 2.5 s. */
  const run = (seaState: number): { share: number; changes: number; n: number; pd: number } => {
    const rcs = 0.02;
    const w0 = world({ seaState });
    // The range where the chance of painting is 0.6 (search outward).
    let r = 0.5;
    const pAt = (x: number) => detectionProbability(effectiveSignal(w0, { rcs, height: 3, rangeNm: x, relBearing: 45, pos: fromPolar(45, x), kind: "buoy" }));
    while (pAt(r) > 0.6) r += 0.002;
    const w = world({ seaState }, [{ id: 7, name: "Buoy", kind: "buoy", pos: fromPolar(45, r), course: 0, speed: 0, rcs, height: 3, events: [] }]);
    w.radar.controls.rangeNm = 6;
    const pd = pAt(r);
    const rnd = seeded(11);
    const seen: boolean[] = [];
    for (let s = 0; s < 1200; s++) {
      w.time = s * 2.5;
      seen.push(scanWedge(w, 44, 46, rnd).some((h) => h.kind === "target" && h.targetId === 7));
    }
    let changes = 0;
    for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1]) changes++;
    return { share: seen.filter(Boolean).length / seen.length, changes, n: seen.length, pd };
  };

  it("painted on the same share of scans as before, but in runs of several scans", () => {
    const rough = run(4);
    expect(rough.pd).toBeGreaterThan(0.55);
    expect(Math.abs(rough.share - rough.pd)).toBeLessThan(0.07);
    // Painted at random on each scan, the echo would come or go on 2 p (1 - p) of scans, about 48%.
    const independent = 2 * rough.pd * (1 - rough.pd) * rough.n;
    expect(rough.changes).toBeLessThan(0.6 * independent);
    // In a calm sea it comes and goes at random, as before.
    const calm = run(1);
    expect(calm.changes).toBeGreaterThan(0.8 * 2 * calm.pd * (1 - calm.pd) * calm.n);
    expect(THRESHOLD).toBeGreaterThan(0);
  });
});
