import { describe, expect, it } from "vitest";
import { angleDiffDeg, fromPolar, sub, velocityOf } from "../src/core/vec";
import { Scenario, World, createWorld, stepWorld } from "../src/engine/index";
import {
  ARPA_PLACEHOLDERS, ArpaConfig, ArpaSystem, LOST_SYMBOL_SEC, alarmToneOn, alertPriority, capacityCautionAt, warningToneOn,
} from "../src/arpa/index";
import { ownOutline, ownShipSymbol } from "../src/ui/view";

/**
 * Checks against IEC 62388:2013 (shipborne radar) and IEC 62288:2014 (presentation of
 * navigation-related information). Figures quoted are the standards'; nothing copies their text.
 */
function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
const EXACT: ArpaConfig = { ...ARPA_PLACEHOLDERS, bearingNoiseDeg: 0, rangeNoiseNm: 0, rangeNoiseShortNm: 0, scintillationNm: 0 };
const ship = (id: number, bearing: number, range: number, course: number, speed: number) =>
  ({ id, name: `T${id}`, kind: "ship" as const, pos: fromPolar(bearing, range), course, speed, rcs: 50, height: 20, events: [] });
function world(own: { heading: number; speed: number }, targets: Scenario["targets"]): World {
  const w = createWorld({ id: "t", name: "t", description: "", own, env: { seaState: 0 }, coasts: [], targets }, 62);
  w.radar.controls.tuning = 62;
  w.radar.controls.rangeNm = 12;
  w.radar.shadowSectors = [];
  return w;
}
function runTo(w: World, a: ArpaSystem, rng: () => number, seconds: number, rollDeg = 0): void {
  while (w.time < seconds - 1e-9) {
    stepWorld(w, 0.5);
    // TT scenario 1 is run with own ship rolling 10° each way (here with a 10 s period); the roll tilts the antenna.
    if (rollDeg > 0) w.own.seaway = { rollDeg: rollDeg * Math.sin((2 * Math.PI * w.time) / 10), pitchDeg: 0, yawDeg: 0, heaveM: 0, rollPhase: 0, encounterPhase: 0 };
    a.step(w, rng);
  }
}

describe("IEC 62288 Annex A: own ship's symbol", () => {
  it("the outline is drawn to scale, with the bow tapering over the forward fifth", () => {
    // A ship 185.2 m by 37.04 m is 0.1 NM by 0.02 NM: at 1000 pixels to the mile, 100 by 20 pixels.
    const got = ownOutline({ lengthM: 185.2, beamM: 37.04 }, 1000)!;
    const want = [{ x: -10, y: -50 }, { x: -10, y: 30 }, { x: 0, y: 50 }, { x: 10, y: 30 }, { x: 10, y: -50 }];
    expect(got).toHaveLength(5);
    want.forEach((q, i) => {
      expect(got[i]!.x).toBeCloseTo(q.x, 9);
      expect(got[i]!.y).toBeCloseTo(q.y, 9);
    });
  });
  it("no outline when the beam would show smaller than 3 mm, or the ship's size is not known", () => {
    // 3 mm at 96 pixels to the inch is 11.3 pixels. A beam of 18.52 m at 1000 pixels to the mile is 10 pixels.
    expect(ownShipSymbol.minBeamPx).toBeCloseTo((3 / 25.4) * 96, 1);
    expect(ownShipSymbol.beamLineHalfPx).toBeGreaterThanOrEqual((5 / 25.4) * 96);
    expect(ownOutline({ lengthM: 185.2, beamM: 18.52 }, 1000)).toBeNull();
    expect(ownOutline({ lengthM: 185.2, beamM: 18.52 }, 1200)).not.toBeNull(); // 12 pixels
    expect(ownOutline(null, 5000)).toBeNull();
  });
});

describe("IEC 62288 Table 2 and IEC 62388 11.3.5: alert priorities and their audible signals", () => {
  it("only a CPA/TCPA violation is an alarm; nearly full capacity is a caution; the rest are warnings", () => {
    expect(alertPriority("cpa")).toBe("alarm");
    expect(alertPriority("ais-cpa")).toBe("alarm");
    for (const k of ["lost", "ais-lost", "new", "guard", "capacity", "malfunction"] as const) expect(alertPriority(k)).toBe("warning");
    expect(alertPriority("capacity-near")).toBe("caution");
  });
  it("the capacity caution comes at a nominal 95%", () => {
    // The standard's own example: a capacity of 40 gives the caution at 38 targets.
    expect(capacityCautionAt(40)).toBe(38);
    expect(capacityCautionAt(20)).toBe(19);
    expect(capacityCautionAt(30)).toBe(28);
  });
  it("an alarm gives three short signals, repeated every 8 seconds", () => {
    // Signals of 0.2 s with 0.2 s between: on during 0-0.2, 0.4-0.6 and 0.8-1.0 of each cycle.
    for (const t of [0, 0.1, 0.45, 0.55, 0.85, 0.95]) expect(alarmToneOn(t)).toBe(true);
    for (const t of [0.25, 0.35, 0.65, 0.75, 1.05, 1.3, 4, 7.9]) expect(alarmToneOn(t)).toBe(false);
    expect(alarmToneOn(8.1)).toBe(true);
    expect(alarmToneOn(8.45)).toBe(true);
    expect(alarmToneOn(-1)).toBe(false);
  });
  it("a warning gives two short signals, once", () => {
    for (const t of [0, 0.1, 0.45, 0.55]) expect(warningToneOn(t)).toBe(true);
    for (const t of [0.25, 0.35, 0.65, 0.85, 1, 8.1, -1]) expect(warningToneOn(t)).toBe(false);
  });
});

describe("IEC 62388 11.3.5 and IEC 62288 5.6.4: capacity caution and the lost target warning", () => {
  it("a caution is raised when the tracker is nearly full, and goes when a target is dropped", () => {
    // With room for 4 targets the caution comes at floor(0.95 x 4) = 3.
    const cfg: ArpaConfig = { ...EXACT, maxTracks: 4 };
    const w = world({ heading: 0, speed: 10 }, [ship(1, 30, 5, 180, 10), ship(2, 90, 6, 270, 8), ship(3, 300, 7, 100, 12)]);
    const a = new ArpaSystem(w, cfg);
    const rng = seeded(1);
    a.step(w, rng);
    a.acquire(w, fromPolar(30, 5));
    a.acquire(w, fromPolar(90, 6));
    runTo(w, a, rng, 10);
    expect(a.alarms.some((x) => x.kind === "capacity-near")).toBe(false);
    const third = a.acquire(w, sub(w.targets[2]!.pos, w.own.pos))!;
    runTo(w, a, rng, 20);
    const caution = a.alarms.find((x) => x.kind === "capacity-near");
    expect(caution).toBeDefined();
    expect(caution!.text).toContain("3 of 4");
    expect(a.alarms.some((x) => x.kind === "capacity")).toBe(false);
    a.cancel(w, third.id);
    runTo(w, a, rng, 26);
    expect(a.alarms.some((x) => x.kind === "capacity-near")).toBe(false);
  });

  it("with the lost target warning off there is no warning, and the lost symbol goes after a minute", () => {
    const w = world({ heading: 0, speed: 10 }, [ship(1, 30, 5, 180, 10)]);
    const a = new ArpaSystem(w, EXACT);
    const rng = seeded(1);
    a.settings.lostWarning = false;
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(30, 5))!;
    runTo(w, a, rng, 120);
    expect(a.tracks.some((x) => x.id === t.id && x.state === "tracking")).toBe(true);
    w.targets.splice(0, 1); // the ship is gone: no more echoes
    runTo(w, a, rng, 120 + 60);
    const lost = a.tracks.find((x) => x.id === t.id);
    expect(lost?.state).toBe("lost");
    expect(a.alarms.some((x) => x.kind === "lost")).toBe(false);
    runTo(w, a, rng, 120 + 60 + LOST_SYMBOL_SEC + 30);
    expect(a.tracks.some((x) => x.id === t.id)).toBe(false);
  });

  it("with the warning on (the usual state) a lost target gives a warning and stays until acknowledged", () => {
    const w = world({ heading: 0, speed: 10 }, [ship(1, 30, 5, 180, 10)]);
    const a = new ArpaSystem(w, EXACT);
    const rng = seeded(1);
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(30, 5))!;
    runTo(w, a, rng, 120);
    w.targets.splice(0, 1);
    runTo(w, a, rng, 120 + 60 + LOST_SYMBOL_SEC + 30);
    expect(a.alarms.some((x) => x.kind === "lost")).toBe(true);
    expect(a.tracks.find((x) => x.id === t.id)?.state).toBe("lost");
  });
});

/**
 * IEC 62388:2013, 11.3.14.3, TT scenario 1 (Tables 12 to 14). Own ship 000 at 20 kn. Three targets are
 * acquired at 0 s (target 2), 45 s (target 3) and 90 s (target 1) and measured 1 minute and 3 minutes
 * after their acquisition; the scenario is repeated 20 times and the 95% values are compared with
 * Table 14. The standard's simulator adds the sensor errors of its Annex E and 10 degrees of roll; here
 * the simulator's own ARPA runs with its normal sensor noise (glint, bearing and range noise), with no
 * Table 14 (checked against the page itself): at 1 minute relative course, relative speed, CPA, TCPA; at 3
 * minutes relative course, relative speed, true course, true speed, CPA, TCPA. Since 13 Nov 2026 the ARPA's
 * sensor errors are those of Annex E (src/arpa/config.ts), and the run adds 10 degrees of roll, which tilts
 * the antenna (antennaTiltErrorDeg in src/arpa/plots.ts), as the standard's run does.
 */
const TT1 = [
  { id: 1, speed: 28.3, course: 45, range: 9.5, bearing: 270, acquireAt: 90, one: [11, 1.5, 1.5, 1.8], three: [3, 0.8, 5, 0.8, 0.4, 0.5] },
  { id: 2, speed: 22.4, course: 27, range: 1.12, bearing: 333, acquireAt: 0, one: [11, 1.5, 1, 1], three: [3, 0.8, 3, 0.8, 0.3, 0.5] },
  { id: 3, speed: 15.3, course: 293, range: 9.25, bearing: 45, acquireAt: 45, one: [11, 1.5, 1, 1], three: [3, 0.8, 2.5, 0.8, 0.4, 0.5] },
];
const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))]!;

export function runTtScenario1(runs: number): { one: number[][][]; three: number[][][] } {
  const one = TT1.map(() => [[], [], [], []] as number[][]);
  const three = TT1.map(() => [[], [], [], [], [], []] as number[][]);
  for (let r = 0; r < runs; r++) {
    const w = world({ heading: 0, speed: 20 }, TT1.map((t) => ship(t.id, t.bearing, t.range, t.course, t.speed)));
    const a = new ArpaSystem(w);
    const rng = seeded(7919 * (r + 1));
    a.step(w, rng);
    const order = [...TT1].sort((x, y) => x.acquireAt - y.acquireAt);
    const tracks = new Map<number, ReturnType<ArpaSystem["acquire"]>>();
    const measure = (k: number, mins: 1 | 3): void => {
      const def = TT1[k]!;
      const e = tracks.get(def.id)?.est;
      const tgt = w.targets.find((x) => x.id === def.id)!;
      const rel = sub(tgt.pos, w.own.pos);
      const relV = sub(velocityOf({ course: def.course, speed: def.speed }), velocityOf({ course: 0, speed: 20 }));
      const tcpaTrue = (-(rel.e * relV.e + rel.n * relV.n) / (relV.e ** 2 + relV.n ** 2)) * 60;
      const cpaTrue = Math.hypot(rel.e + (relV.e * tcpaTrue) / 60, rel.n + (relV.n * tcpaTrue) / 60);
      const relCourse = (Math.atan2(relV.e, relV.n) * 180) / Math.PI;
      const big = 999; // no estimate at all counts as a miss of every limit
      const out = mins === 1 ? one[k]! : three[k]!;
      const vals = e
        ? mins === 1
          ? [Math.abs(angleDiffDeg(e.relCS.course, relCourse)), Math.abs(e.relCS.speed - Math.hypot(relV.e, relV.n)), Math.abs(e.cpa.cpa - cpaTrue), Math.abs((e.cpa.tcpaMinutes ?? big) - tcpaTrue)]
          : [Math.abs(angleDiffDeg(e.relCS.course, relCourse)), Math.abs(e.relCS.speed - Math.hypot(relV.e, relV.n)), Math.abs(angleDiffDeg(e.trueCS.course, def.course)), Math.abs(e.trueCS.speed - def.speed), Math.abs(e.cpa.cpa - cpaTrue), Math.abs((e.cpa.tcpaMinutes ?? big) - tcpaTrue)]
        : new Array(mins === 1 ? 4 : 6).fill(big);
      vals.forEach((v, i) => out[i]!.push(v));
    };
    // The times of Table 13: acquisitions and the 1 minute and 3 minute measurements, in order.
    const events = order.flatMap((t) => [
      { at: t.acquireAt, run: () => void tracks.set(t.id, a.acquire(w, sub(w.targets.find((x) => x.id === t.id)!.pos, w.own.pos))) },
      { at: t.acquireAt + 60, run: () => measure(TT1.indexOf(t), 1) },
      { at: t.acquireAt + 180, run: () => measure(TT1.indexOf(t), 3) },
    ]).sort((x, y) => x.at - y.at);
    for (const ev of events) {
      runTo(w, a, rng, ev.at, 10);
      ev.run();
    }
  }
  return { one, three };
}

describe("IEC 62388 11.3.14.3: TT scenario 1 (20 runs, 95% values against Table 14)", () => {
  const { one, three } = runTtScenario1(20);
  TT1.forEach((def, k) => {
    it(`target ${def.id}`, () => {
      const got1 = one[k]!.map(p95);
      const got3 = three[k]!.map(p95);
      console.log(`IEC TT1 target ${def.id}: 1 min ${got1.map((x) => x.toFixed(2)).join(" / ")} limits ${def.one.join(" / ")} | 3 min ${got3.map((x) => x.toFixed(2)).join(" / ")} limits ${def.three.join(" / ")}`);
      def.one.forEach((lim, i) => expect(got1[i]).toBeLessThanOrEqual(lim));
      def.three.forEach((lim, i) => expect(got3[i]).toBeLessThanOrEqual(lim));
    });
  });
});
