import { describe, expect, it } from "vitest";
import { analysePlot, aspectOf, formatAspect } from "../src/core/plot";
import { fromPolar } from "../src/core/vec";
import { Scenario, World, clutterPulseFactor, pulseEnergyFactor, createWorld, effectiveSignal, radarHorizonNm, seaClutter, seaClutterProbability, stepWorld, CLUTTER_WINDWARD, REFRACTION_FACTOR } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaConfig, ArpaSystem, alertPriority } from "../src/arpa/index";

/**
 * Checks against A. G. Bole and W. O. Dineley, "Radar and ARPA Manual" (Heinemann Newnes, 1990).
 * Figures quoted are the book's; where the book gives a hand-plotted answer the test allows the
 * accuracy of a hand plot. Nothing here copies the book's text.
 */
describe("Radar and ARPA Manual, chapter 7: the plot and the target's aspect", () => {
  it("aspect is the relative bearing of own ship from the target, Red to port and Green to starboard", () => {
    // Target bears 124; from the target own ship bears 304. Target steering 008: 304 - 008 = 296 = 64 to port.
    expect(aspectOf(124, 8)).toBeCloseTo(-64, 9);
    // Target due east of own ship heading north: own ship is on its port beam. Heading south: starboard beam.
    expect(aspectOf(90, 0)).toBeCloseTo(-90, 9);
    expect(aspectOf(90, 180)).toBeCloseTo(90, 9);
    // Dead ahead and coming straight back at us: bow on. Dead ahead on our own course: stern on.
    expect(aspectOf(0, 180)).toBeCloseTo(0, 9);
    expect(Math.abs(aspectOf(0, 0))).toBeCloseTo(180, 9);
    expect(formatAspect(-64)).toBe("Red 64°");
    expect(formatAspect(20.4)).toBe("Green 20°");
    expect(formatAspect(0)).toBe("0° (bow on)");
    expect(formatAspect(180)).toBe("180° (stern on)");
    expect(formatAspect(null)).toBe("none");
  });

  it("Example 7.1 of the book is reproduced within the accuracy of a hand plot", () => {
    // Own ship 090 at 12 kn. Echo at 0923: 127 x 9.5 NM; 0929: 126 x 8.0; 0935: 124 x 6.5.
    // The book's plotted answer at 0935: course 008, speed 11 kn, CPA 1.0 NM in 26 min, aspect Red 65.
    // (An independent calculation of the same three points gives 005.5, 10.5 kn, 1.06 NM, 25.4 min, Red 61.)
    const a = analysePlot(
      [{ timeMinutes: 0, bearing: 127, range: 9.5 }, { timeMinutes: 6, bearing: 126, range: 8.0 }, { timeMinutes: 12, bearing: 124, range: 6.5 }],
      { course: 90, speed: 12 },
    );
    expect(Math.abs(a.targetTrue.course - 8)).toBeLessThanOrEqual(4);
    expect(Math.abs(a.targetTrue.speed - 11)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.cpa.cpa - 1.0)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(a.cpa.tcpaMinutes! - 26)).toBeLessThanOrEqual(1.5);
    expect(a.aspect).not.toBeNull();
    expect(a.aspect!).toBeLessThan(0); // Red
    expect(Math.abs(a.aspect! - -65)).toBeLessThanOrEqual(5);
  });

  it("a stopped target has no aspect", () => {
    // Own ship 000 at 12 kn; a buoy 4 NM ahead closes at 12 kn: 4.0 then 2.8 NM six minutes later.
    const a = analysePlot([{ timeMinutes: 0, bearing: 0, range: 4 }, { timeMinutes: 6, bearing: 0, range: 2.8 }], { course: 0, speed: 12 });
    expect(a.targetTrue.speed).toBeCloseTo(0, 6);
    expect(a.aspect).toBeNull();
  });
});

describe("Radar and ARPA Manual, chapter 3: detection range and sea clutter", () => {
  it("the radar horizon follows 2.21 x (sqrt h + sqrt H), heights in metres", () => {
    // The book's own figures: antenna at 16 m, horizon 2.21 x 4 = 8.84 NM; a 64 m cliff adds 2.21 x 8 = 17.68 NM.
    expect(radarHorizonNm(16, 0, false)).toBeCloseTo(8.84, 6);
    expect(radarHorizonNm(16, 64, false)).toBeCloseTo(26.52, 6);
  });
  it("sub-refraction gives about 80% of the standard range and super-refraction about 140%", () => {
    expect(REFRACTION_FACTOR).toEqual({ standard: 1, sub: 0.8, super: 1.4 });
    expect(radarHorizonNm(16, 64, false, "sub")).toBeCloseTo(21.216, 6); // 0.8 x 26.52
    expect(radarHorizonNm(16, 64, false, "super")).toBeCloseTo(37.128, 6); // 1.4 x 26.52
    expect(radarHorizonNm(16, 64, false, "standard")).toBeCloseTo(26.52, 6);
  });
  it("a target between the two horizons is lost in sub-refraction and found in super-refraction", () => {
    // Antenna 16 m, target 9 m high: standard horizon 2.21 x (4 + 3) = 15.47 NM; sub 12.38 NM; super 21.66 NM.
    const echo = (rangeNm: number, refraction: "standard" | "sub" | "super"): number => {
      const sc: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0, refraction }, coasts: [],
        targets: [{ id: 1, name: "T", kind: "ship", pos: fromPolar(0, rangeNm), course: 0, speed: 0, rcs: 50, height: 9, events: [] }] };
      const w = createWorld(sc, 62);
      w.radar.controls.tuning = 62;
      w.radar.controls.rangeNm = 24;
      w.radar.shadowSectors = [];
      w.own.antennaHeight = 16;
      return effectiveSignal(w, { rcs: 50, height: 9, rangeNm, relBearing: 0, pos: w.targets[0]!.pos });
    };
    expect(echo(14, "standard")).toBeGreaterThan(0);
    expect(echo(14, "sub")).toBe(0);
    expect(echo(18, "standard")).toBe(0);
    expect(echo(18, "super")).toBeGreaterThan(0);
  });
  it("sea clutter reaches further to windward than to leeward", () => {
    // Level = (sea state / 9) x 4 x exp(-range / (1.2 x (1 + 0.3 x windward))). At 1.2 NM in sea state 9:
    // abeam of the sea 4 e^-1 = 1.4715; into it 4 e^(-1/1.3) = 1.8535; down-sea 4 e^(-1/0.7) = 0.9586.
    expect(CLUTTER_WINDWARD).toBe(0.3);
    expect(seaClutter(1.2, 9)).toBeCloseTo(1.4715, 3);
    expect(seaClutter(1.2, 9, 1)).toBeCloseTo(1.8535, 3);
    expect(seaClutter(1.2, 9, -1)).toBeCloseTo(0.9586, 3);
  });
  it("on the picture the clutter is heavier on the windward side of own ship", () => {
    const sc: Scenario = { id: "t", name: "t", description: "", own: { heading: 0, speed: 10 }, env: { seaState: 5, wind: { from: 0, speedKn: 25 } }, coasts: [], targets: [] };
    const w = createWorld(sc, 62);
    w.radar.controls.tuning = 62;
    w.radar.shadowSectors = [];
    let ahead = 0, astern = 0, port = 0, starboard = 0;
    for (let r = 0.25; r <= 4; r += 0.25) {
      const up = seaClutterProbability(w, r, 0);
      const down = seaClutterProbability(w, r, 180);
      expect(up).toBeGreaterThanOrEqual(down);
      ahead += up;
      astern += down;
      port += seaClutterProbability(w, r, 270);
      starboard += seaClutterProbability(w, r, 90);
    }
    expect(ahead).toBeGreaterThan(astern);
    expect(port).toBeCloseTo(starboard, 9); // the same on both beams, abeam of the wind
    expect(ahead).toBeGreaterThan(port);
    expect(port).toBeGreaterThan(astern);
  });
  it("a shorter pulse returns less sea clutter, a longer pulse more", () => {
    // On the 6 NM scale the set chooses the medium pulse, 0.3 microseconds at 1500 a second. Short is 0.07 at 3000,
    // long 1.2 at 600. Clutter power goes with the energy on the sea (pulse length x PRF) times the depth of sea
    // answering (pulse length) (3rd edition 2.7.4.1, 3.6.1.6); the strength with the square root:
    //   short: sqrt((0.07 x 3000) / (0.3 x 1500) x 0.07 / 0.3) = sqrt(0.4667 x 0.2333) = 0.330
    //   long:  sqrt((1.2 x 600) / (0.3 x 1500) x 1.2 / 0.3)    = sqrt(1.6 x 4)          = 2.530
    expect(clutterPulseFactor(6)).toBe(1);
    expect(clutterPulseFactor(6, "auto")).toBe(1);
    expect(clutterPulseFactor(6, "short")).toBeCloseTo(Math.sqrt((210 / 450) * (0.07 / 0.3)), 9);
    expect(clutterPulseFactor(6, "long")).toBeCloseTo(Math.sqrt(1.6 * 4), 9);
    // On the 12 NM scale the set chooses the long pulse: short gives sqrt((210 / 720) x (0.07 / 1.2)) = 0.130.
    expect(clutterPulseFactor(12, "short")).toBeCloseTo(Math.sqrt((210 / 720) * (0.07 / 1.2)), 9);
    // A short pulse cuts the clutter more than it cuts a target; a long pulse raises it more.
    expect(clutterPulseFactor(6, "short")).toBeLessThan(pulseEnergyFactor(6, "short"));
    expect(clutterPulseFactor(6, "long")).toBeGreaterThan(pulseEnergyFactor(6, "long"));
  });
});

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
const EXACT: ArpaConfig = { ...ARPA_PLACEHOLDERS, bearingNoiseDeg: 0, rangeNoiseNm: 0, rangeNoiseShortNm: 0, scintillationNm: 0 };
function setup(sc: Scenario): { w: World; a: ArpaSystem; rng: () => number } {
  const w = createWorld(sc, 62);
  w.radar.controls.tuning = 62;
  w.radar.shadowSectors = [];
  return { w, a: new ArpaSystem(w, EXACT), rng: seeded(1) };
}
function runTo(w: World, a: ArpaSystem, rng: () => number, seconds: number): void {
  while (w.time < seconds - 1e-9) {
    stepWorld(w, 0.5);
    a.step(w, rng);
  }
}

describe("Radar and ARPA Manual, chapter 5: additional ARPA alarms", () => {
  const mark = { id: 1, name: "Beacon", kind: "buoy" as const, pos: fromPolar(0, 2), course: 0, speed: 0, rcs: 5, height: 6, events: [] };

  it("anchor watch warns when the marked stationary target has moved more than the distance set", () => {
    // Own ship stopped in a current setting 090 at 1 kn drifts 0.1 NM in 6 minutes, so a fixed mark appears to move
    // that far from where it was marked. With a 0.1 NM limit there is no warning after 3 minutes (0.05 NM), and
    // there is one after 9 minutes (0.15 NM).
    const { w, a, rng } = setup({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0, current: { set: 90, drift: 1 } }, coasts: [], targets: [mark] });
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(0, 2))!;
    runTo(w, a, rng, 240);
    expect(a.setAnchorWatch(w, t.id, 0.1)).toBe(true);
    runTo(w, a, rng, 240 + 180);
    expect(a.alarms.some((x) => x.kind === "anchor")).toBe(false);
    expect(a.anchorWatchMovedNm()!).toBeGreaterThan(0.02);
    expect(a.anchorWatchMovedNm()!).toBeLessThan(0.08);
    runTo(w, a, rng, 240 + 540);
    const alarm = a.alarms.find((x) => x.kind === "anchor");
    expect(alarm).toBeDefined();
    expect(alarm!.text).toContain("ANCHOR WATCH");
    expect(Math.abs(a.anchorWatchMovedNm()! - 0.15)).toBeLessThan(0.04);
    expect(alertPriority("anchor")).toBe("warning");
    a.clearAnchorWatch(w);
    expect(a.alarms.some((x) => x.kind === "anchor")).toBe(false);
    expect(a.settings.anchorWatch.trackId).toBeNull();
  });

  it("anchor watch stays quiet while nothing moves, and cannot be set on a target with no data", () => {
    const { w, a, rng } = setup({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [], targets: [mark] });
    a.step(w, rng);
    expect(a.setAnchorWatch(w, 99, 0.1)).toBe(false);
    const t = a.acquire(w, fromPolar(0, 2))!;
    runTo(w, a, rng, 240);
    expect(a.setAnchorWatch(w, t.id, 0.1)).toBe(true);
    runTo(w, a, rng, 240 + 600);
    expect(a.alarms.some((x) => x.kind === "anchor")).toBe(false);
    expect(a.anchorWatchMovedNm()!).toBeLessThan(0.03);
  });

  it("trial alarm names a target the trial manoeuvre would not clear, and goes when the trial is switched off", () => {
    // Own ship 000 at 12 kn; target bears 045 at 6 NM steering 270 at 10 kn: CPA 0.54 NM in 23 minutes (worked in
    // tests/arpa.test.ts). With limits of 1 NM and 30 minutes a trial of the present course and speed is not safe.
    const ship = { id: 1, name: "A", kind: "ship" as const, pos: fromPolar(45, 6), course: 270, speed: 10, rcs: 1, height: 20, events: [] };
    const { w, a, rng } = setup({ id: "t", name: "t", description: "", own: { heading: 0, speed: 12 }, env: { seaState: 0 }, coasts: [], targets: [ship] });
    a.settings.cpaLimitNm = 1;
    a.settings.tcpaLimitMin = 30;
    a.step(w, rng);
    a.acquire(w, fromPolar(45, 6));
    runTo(w, a, rng, 200);
    expect(a.alarms.some((x) => x.kind === "trial")).toBe(false);
    a.settings.trial = { on: true, course: 0, speed: 12, delayMinutes: 0 };
    runTo(w, a, rng, 206);
    const alarm = a.alarms.find((x) => x.kind === "trial");
    expect(alarm).toBeDefined();
    expect(alarm!.text).toContain("TRIAL");
    expect(alertPriority("trial")).toBe("warning");
    a.settings.trial = { on: false, course: 0, speed: 12, delayMinutes: 0 };
    runTo(w, a, rng, 212);
    expect(a.alarms.some((x) => x.kind === "trial")).toBe(false);
  });

  it("safe limit vector suppression is off until it is chosen", () => {
    const { a } = setup({ id: "t", name: "t", description: "", own: { heading: 0, speed: 12 }, env: { seaState: 0 }, coasts: [], targets: [] });
    expect(a.settings.vectorSuppress).toBe(false);
    expect(a.settings.anchorWatch.trackId).toBeNull();
  });
});
