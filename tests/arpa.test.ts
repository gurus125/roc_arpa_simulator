import { describe, expect, it } from "vitest";
import { fitLinearMotion, fitPositionAt } from "../src/core/track";
import { inSectorZone } from "../src/core/zones";
import { fromPolar, rotateVec, sub, velocityOf, add, scale, length } from "../src/core/vec";
import { OPEN_SEA, Scenario, World, createWorld, newDisplayState, stepWorld, worldToDisplayNm } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaConfig, ArpaSystem } from "../src/arpa/index";

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const EXACT: ArpaConfig = { ...ARPA_PLACEHOLDERS, bearingNoiseDeg: 0, rangeNoiseNm: 0, rangeNoiseShortNm: 0, scintillationNm: 0 };

type Tgt = Scenario["targets"][number];
function scenario(own: { heading: number; speed: number }, targets: Tgt[], current?: { set: number; drift: number }): Scenario {
  const env: Scenario["env"] = { seaState: 0 };
  if (current) env.current = current;
  return { id: "t", name: "t", description: "", own, env, coasts: [], targets };
}
const ship = (id: number, pos: { e: number; n: number }, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt => ({
  id, name: `Ship ${id}`, kind: "ship", pos, course, speed, rcs: 1, height: 20, events: [], ...extra,
});

function setup(sc: Scenario, cfg: ArpaConfig = EXACT, seed = 1): { w: World; a: ArpaSystem; rng: () => number } {
  const w = createWorld(sc, 62);
  w.radar.controls.tuning = 62;
  w.radar.shadowSectors = [];
  return { w, a: new ArpaSystem(w, cfg), rng: seeded(seed) };
}
function runTo(w: World, a: ArpaSystem, rng: () => number, seconds: number): void {
  while (w.time < seconds - 1e-9) {
    stepWorld(w, 0.5);
    a.step(w, rng);
  }
}
/** Cargo ship A from the phase 1 worked example: bears 045 at 6 NM, steering 270 at 10 kn. Own ship 000 at 12 kn. */
const shipA = (extra: Partial<Tgt> = {}): Tgt => ship(1, fromPolar(45, 6), 270, 10, extra);
const ownA = { heading: 0, speed: 12 };

// Hand calculation for ship A (own ship at the origin):
//   relative position r = (6 sin45, 6 cos45) = (4.24264, 4.24264); relative velocity v = (-10, -12)
//   TCPA = -(r.v)/|v|^2 = 93.33810 / 244 = 0.382533 h = 22.9520 min
//   CPA point = r + v*TCPA = (0.41731, -0.34776), CPA = 0.54321 NM
const A_CPA = 0.54321;
const A_TCPA0 = 22.952;

describe("core: linear track fit", () => {
  it("recovers the slope of a hand-worked three-point set", () => {
    // t = 0, 1, 2 h; e = 0, 1, 3; n = 5, 5, 5. tMean 1, eMean 4/3.
    // slope = [(-1)(-4/3) + 0 + (1)(5/3)] / 2 = 1.5 kn east; fitted e at t=2: 4/3 + 1.5 = 2.8333
    const fit = fitLinearMotion([
      { t: 0, p: { e: 0, n: 5 } }, { t: 1, p: { e: 1, n: 5 } }, { t: 2, p: { e: 3, n: 5 } },
    ])!;
    expect(fit.vel.e).toBeCloseTo(1.5, 12);
    expect(fit.vel.n).toBeCloseTo(0, 12);
    expect(fitPositionAt(fit, 2).e).toBeCloseTo(2.833333, 6);
    // residuals in e: 0-(-1/6)... fitted e = 4/3 + 1.5(t-1) -> -1/6, 4/3, 17/6; residuals 1/6, -1/3, 1/6
    expect(fit.rms).toBeCloseTo(Math.sqrt((1 / 36 + 1 / 9 + 1 / 36) / 3), 12);
  });
  it("returns null without two different times", () => {
    expect(fitLinearMotion([{ t: 1, p: { e: 0, n: 0 } }])).toBeNull();
    expect(fitLinearMotion([{ t: 1, p: { e: 0, n: 0 } }, { t: 1, p: { e: 1, n: 0 } }])).toBeNull();
  });
});

describe("core: zones and rotation", () => {
  it("rotateVec turns a bearing clockwise", () => {
    const v = rotateVec({ e: 0, n: 2 }, 90);
    expect(v.e).toBeCloseTo(2, 12);
    expect(v.n).toBeCloseTo(0, 12);
    const u = rotateVec({ e: 1, n: 0 }, 3); // bearing 090 -> 093: (cos3, -sin3)
    expect(u.e).toBeCloseTo(0.998630, 6);
    expect(u.n).toBeCloseTo(-0.052336, 6);
  });
  it("sector zones use relative bearings and wrap through the bow", () => {
    const z = { innerNm: 2, outerNm: 4, fromRel: 350, toRel: 10 };
    expect(inSectorZone(fromPolar(5, 3), 0, z)).toBe(true);
    expect(inSectorZone(fromPolar(355, 3), 0, z)).toBe(true);
    expect(inSectorZone(fromPolar(15, 3), 0, z)).toBe(false);
    expect(inSectorZone(fromPolar(5, 1.5), 0, z)).toBe(false);
    expect(inSectorZone(fromPolar(5, 4.5), 0, z)).toBe(false);
    // Heading 090: true bearing 095 is 5 degrees on the starboard bow.
    expect(inSectorZone(fromPolar(95, 3), 90, z)).toBe(true);
    expect(inSectorZone(fromPolar(5, 3), 90, z)).toBe(false);
    // from == to: a full ring
    expect(inSectorZone(fromPolar(200, 3), 0, { ...z, fromRel: 0, toRel: 0 })).toBe(true);
  });
});

describe("ARPA tracking", () => {
  it("settles on the worked-example CPA and TCPA (noise-free)", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 240);
    expect(t.est!.cpa.cpa).toBeCloseTo(A_CPA, 4);
    expect(t.est!.cpa.tcpaMinutes!).toBeCloseTo(A_TCPA0 - 4, 2);
    expect(t.est!.trueCS.course).toBeCloseTo(270, 4);
    expect(t.est!.trueCS.speed).toBeCloseTo(10, 4);
    expect(t.truthId).toBe(1);
  });

  it("shows no vector at first, then PRELIMINARY, then steady", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 30);
    expect(t.quality).toBe("acquiring");
    runTo(w, a, rng, 120);
    expect(t.quality).toBe("prelim");
    runTo(w, a, rng, 200);
    expect(t.quality).toBe("steady");
  });

  it("early CPA is less reliable than settled CPA when plots are noisy", () => {
    let early = 0;
    let late = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { w, a, rng } = setup(scenario(ownA, [shipA()]), ARPA_PLACEHOLDERS, seed);
      a.step(w, rng);
      const t = a.acquire(w, fromPolar(45, 6))!;
      runTo(w, a, rng, 20);
      early += Math.abs(t.est!.cpa.cpa - A_CPA);
      runTo(w, a, rng, 240);
      late += Math.abs(t.est!.cpa.cpa - A_CPA);
    }
    expect(early).toBeGreaterThan(3 * late);
  });

  it("lags behind a target manoeuvre (processing delay), then catches up", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA({ events: [{ atSeconds: 300, course: 300 }] })]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 320);
    const c = t.est!.trueCS.course;
    expect(Math.abs(c - 270)).toBeLessThan(Math.abs(c - 300));
    runTo(w, a, rng, 300 + ARPA_PLACEHOLDERS.windowSec + 10);
    expect(t.est!.trueCS.course).toBeCloseTo(300, 4);
  });

  it("an own-ship alteration changes the relative vector without waiting for the window", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 240);
    w.own.heading = 90; // instant alteration to 090 (test only)
    w.own.ordered.course = 90;
    runTo(w, a, rng, 242.5);
    // Hand: target (0,-10)... target velocity (-10, 0); own (12, 0) -> relative (-22, 0)
    expect(t.est!.relVel.e).toBeCloseTo(-22, 3);
    expect(t.est!.relVel.n).toBeCloseTo(0, 3);
  });
});

describe("ARPA stabilisation and sensor errors", () => {
  const buoyScenario = scenario({ heading: 0, speed: 10 }, [ship(1, { e: 0, n: 4 }, 0, 0)], { set: 90, drift: 2 });

  it("ground stabilisation needs a designated reference: buoy reference gives it zero speed; sea mode shows the reverse of the current", () => {
    const { w, a, rng } = setup(buoyScenario);
    a.step(w, rng);
    const t = a.acquire(w, { e: 0, n: 4 })!;
    expect(a.effectiveStab()).toBe("sea"); // nothing designated yet
    runTo(w, a, rng, 200);
    const s = a.estimate(w, t, "sea")!;
    // Hand: sea frame moves with the water (090, 2 kn) so the buoy moves 270 at 2 kn in it.
    expect(s.trueCS.speed).toBeCloseTo(2, 4);
    expect(s.trueCS.course).toBeCloseTo(270, 3);
    expect(a.designateGroundRef(w, t.id)).toBe(true);
    expect(a.effectiveStab()).toBe("ground");
    runTo(w, a, rng, 210);
    const g = a.estimate(w, t, "ground")!;
    expect(g.trueCS.speed).toBeCloseTo(0, 4);
    // Relative motion is the same either way: (0,0) - (2,10) = (-2,-10).
    for (const e of [g, s]) {
      expect(e.relVel.e).toBeCloseTo(-2, 3);
      expect(e.relVel.n).toBeCloseTo(-10, 3);
    }
    expect(g.cpa.cpa).toBeCloseTo(s.cpa.cpa, 6);
  });

  it("with a buoy as reference, a moving ship shows its course and speed over the ground despite a current", () => {
    // The ship's real course and speed are fixed in the scenario file (the instructor truth);
    // ground stabilisation on the buoy must reproduce them despite the 2 kn current.
    const sc = scenario({ heading: 0, speed: 10 }, [ship(1, { e: 0, n: 4 }, 0, 0), ship(2, fromPolar(45, 6), 270, 10)], { set: 90, drift: 2 });
    const { w, a, rng } = setup(sc);
    a.step(w, rng);
    const buoy = a.acquire(w, { e: 0, n: 4 })!;
    const ship2 = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 200);
    a.designateGroundRef(w, buoy.id);
    runTo(w, a, rng, 210);
    const e = a.estimate(w, ship2, "ground")!;
    const truth = a.truthOf(w, ship2)!.trueCS;
    expect(e.trueCS.speed).toBeCloseTo(truth.speed, 2);
    expect(e.trueCS.course).toBeCloseTo(truth.course, 1);
  });

  it("log error 2 kn high is cancelled by ground stabilisation on a reference; gyro error is not", () => {
    // Hand (no current): buoy apparent velocity in the sea frame equals own log error (0,2); ship ground velocity
    // (-10,2)-(0,2) = (-10,0): 270 at 10 kn. With gyro +3 the whole picture is rotated: 273 at 10 kn.
    for (const [gyro, log, course] of [[0, 2, 270], [3, 0, 273]] as const) {
      const sc = scenario(ownA, [ship(2, { e: 0, n: 5 }, 0, 0), shipA()]);
      const { w, a, rng } = setup(sc);
      w.sensors.gyroErrorDeg = gyro;
      w.sensors.logErrorKn = log;
      a.step(w, rng);
      const buoy = a.acquire(w, rotateVec({ e: 0, n: 5 }, gyro))!;
      const t = a.acquire(w, rotateVec(fromPolar(45, 6), gyro))!;
      runTo(w, a, rng, 200);
      a.designateGroundRef(w, buoy.id);
      runTo(w, a, rng, 215);
      const e = a.estimate(w, t, "ground")!;
      expect(e.trueCS.course).toBeCloseTo(course, 1);
      expect(e.trueCS.speed).toBeCloseTo(10, 1);
    }
  });

  it("losing the reference raises POOR GROUND REFERENCE, then reverts to sea stabilisation", () => {
    const sc = scenario({ heading: 0, speed: 10 }, [ship(1, { e: 0, n: 4 }, 0, 0)]);
    const { w, a, rng } = setup(sc);
    a.step(w, rng);
    const buoy = a.acquire(w, { e: 0, n: 4 })!;
    runTo(w, a, rng, 200);
    a.designateGroundRef(w, buoy.id);
    w.targets[0]!.rcs = 1e-6; // echo disappears
    runTo(w, a, rng, 200 + 60);
    expect(a.alarms.some((x) => x.kind === "groundref")).toBe(true);
    expect(a.effectiveStab()).toBe("sea");
    runTo(w, a, rng, 200 + 60 + a.cfg.poorRefCancelSec + 5);
    expect(a.settings.stabilisation).toBe("sea");
    expect(a.groundRefId).toBeNull();
  });

  it("the ARPA does not use the operator's gain, clutter or range scale", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    w.radar.controls.gain = 0;
    w.radar.controls.stc = 100;
    w.radar.controls.ftc = 100;
    w.radar.controls.rangeNm = 48;
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 200);
    expect(t.state).toBe("tracking");
    expect(t.est!.cpa.cpa).toBeCloseTo(A_CPA, 4);
  });

  it("gyro error +3: sea-stabilised true course reads 3 degrees high, CPA unchanged", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    w.sensors.gyroErrorDeg = 3;
    a.settings.stabilisation = "sea";
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(48, 6))!;
    runTo(w, a, rng, 240);
    expect(t.est!.trueCS.course).toBeCloseTo(273, 3);
    expect(t.est!.trueCS.speed).toBeCloseTo(10, 4);
    expect(t.est!.cpa.cpa).toBeCloseTo(A_CPA, 4);
  });

  it("log reading 2 kn high, sea stabilised: true vector wrong, CPA unchanged", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    w.sensors.logErrorKn = 2;
    a.settings.stabilisation = "sea";
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 240);
    // Hand: own (0,14) + relative (-10,-12) = (-10, 2): course atan2(-10,2) = 281.310, speed sqrt(104) = 10.198
    expect(t.est!.trueCS.course).toBeCloseTo(281.31, 2);
    expect(t.est!.trueCS.speed).toBeCloseTo(10.198, 3);
    expect(t.est!.cpa.cpa).toBeCloseTo(A_CPA, 4);
  });

  it("the radar picture turns with a gyro error in north-up, not in head-up", () => {
    const w = createWorld(scenario({ heading: 0, speed: 0 }, []));
    w.sensors.gyroErrorDeg = 5;
    const ds = newDisplayState(w);
    const p = worldToDisplayNm(w, ds, { e: 0, n: 3 });
    expect(p.x).toBeCloseTo(3 * Math.sin((5 * Math.PI) / 180), 9);
    expect(p.y).toBeCloseTo(3 * Math.cos((5 * Math.PI) / 180), 9);
    ds.orientation = "head-up";
    const q = worldToDisplayNm(w, ds, { e: 0, n: 3 });
    expect(q.x).toBeCloseTo(0, 9);
    expect(q.y).toBeCloseTo(3, 9);
  });
});

describe("ARPA limitations", () => {
  it("fading echoes: the track coasts and is flagged, then a LOST alarm after the miss limit", () => {
    const sc = scenario({ heading: 0, speed: 0 }, [ship(1, { e: 0, n: 3 }, 90, 5)]);
    const { w, a, rng } = setup(sc);
    a.step(w, rng);
    const t = a.acquire(w, { e: 0, n: 3 })!;
    runTo(w, a, rng, 100);
    w.targets[0]!.rcs = 0;
    runTo(w, a, rng, 100 + 2.5 * 5);
    expect(t.fading).toBe(true);
    expect(t.state).toBe("tracking");
    runTo(w, a, rng, 100 + 2.5 * (ARPA_PLACEHOLDERS.lostAfterMissedScans + 1));
    expect(t.state).toBe("lost");
    expect(a.alarms.some((x) => x.key === `lost-${t.id}`)).toBe(true);
    a.ack(w, `lost-${t.id}`);
    expect(a.tracks.length).toBe(0);
  });

  it("target swap: when the tracked echo fades, a nearby echo is taken over", () => {
    // A is stationary 3 NM ahead. B crosses close ahead of A at 12 kn. A fades as B arrives.
    const sc = scenario({ heading: 0, speed: 0 }, [ship(1, { e: 0, n: 3 }, 0, 0), ship(2, { e: -1, n: 3.1 }, 90, 12)]);
    const { w, a, rng } = setup(sc);
    a.step(w, rng);
    const t = a.acquire(w, { e: 0, n: 3 })!;
    runTo(w, a, rng, 250); // B is now about 0.18 NM from A
    w.targets[0]!.rcs = 0;
    runTo(w, a, rng, 400);
    expect(t.swaps).toBeGreaterThanOrEqual(1);
    expect(t.truthId).toBe(2);
    expect(a.events.some((e) => e.instructor && e.text.includes("TARGET SWAP"))).toBe(true);
    // ...and the track now follows B east, at the speed of B, after the window refills.
    runTo(w, a, rng, 650);
    expect(t.est!.trueCS.course).toBeCloseTo(90, 1);
  });

  it("manual acquisition on empty water is cancelled with a message", () => {
    const { w, a, rng } = setup(scenario({ heading: 0, speed: 0 }, [ship(1, { e: 0, n: 3 }, 0, 0)]));
    a.step(w, rng);
    a.acquire(w, { e: 3, n: 3 });
    runTo(w, a, rng, 2.5 * (ARPA_PLACEHOLDERS.manualAcqScans + 1));
    expect(a.tracks.length).toBe(0);
    expect(a.message?.text).toMatch(/No echo/);
  });
});

describe("ARPA automatic acquisition, guard zones and alarms", () => {
  const inbound = (): Scenario => scenario({ heading: 0, speed: 0 }, [ship(1, { e: 0, n: 6.5 }, 180, 12)]);
  const ring = { on: true, innerNm: 5.5, outerNm: 6.0, fromRel: 0, toRel: 0 };

  it("acquires a target entering the guard zone and raises a new-target alarm", () => {
    const { w, a, rng } = setup(inbound());
    a.settings.guardZones = [ring];
    a.settings.autoAcquire = true;
    runTo(w, a, rng, 140); // 6.5 - 12*140/3600 = 6.03 NM: not yet in the zone
    expect(a.tracks.length).toBe(0);
    runTo(w, a, rng, 200);
    expect(a.tracks.length).toBe(1);
    expect(a.tracks[0]!.truthId).toBe(1);
    expect(a.alarms.some((x) => x.kind === "new")).toBe(true);
  });

  it("an exclusion area stops automatic acquisition", () => {
    const { w, a, rng } = setup(inbound());
    a.settings.guardZones = [ring];
    a.settings.exclusionZones = [{ on: true, innerNm: 0, outerNm: 12, fromRel: 350, toRel: 10 }];
    a.settings.autoAcquire = true;
    runTo(w, a, rng, 300);
    expect(a.tracks.length).toBe(0);
  });

  it("with automatic acquisition off, the guard zone only raises an alarm", () => {
    const { w, a, rng } = setup(inbound());
    a.settings.guardZones = [ring];
    runTo(w, a, rng, 300);
    expect(a.tracks.length).toBe(0);
    expect(a.alarms.some((x) => x.kind === "guard")).toBe(true);
  });

  it("CPA/TCPA alarm comes on only when both limits are broken", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.settings.cpaLimitNm = 1.0;
    a.settings.tcpaLimitMin = 12;
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    // Hand: TCPA falls below 12 min at (22.952 - 12) * 60 = 657 s.
    runTo(w, a, rng, 640);
    expect(t.dangerous).toBe(false);
    runTo(w, a, rng, 680);
    expect(t.dangerous).toBe(true);
    const al = a.alarms.find((x) => x.key === `cpa-${t.id}`)!;
    a.ack(w, al.key);
    expect(a.alarms.find((x) => x.key === `cpa-${t.id}`)!.acked).toBe(true);
    a.settings.cpaLimitNm = 0.5; // CPA 0.543 is now outside the limit
    runTo(w, a, rng, 685);
    expect(a.alarms.some((x) => x.key === `cpa-${t.id}`)).toBe(false);
  });
});

describe("ARPA trial manoeuvre", () => {
  it("matches a brute-force search of the encounter", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 240);
    a.settings.trial = { on: true, course: 60, speed: 12, delayMinutes: 3 };
    a.step(w, rng); // the trial starts counting its delay now
    const row = a.trial(w).find((r) => r.trackId === t.id)!;

    // Brute force: step both ships every 0.1 s for 90 minutes. After the 3 minute delay own ship comes round to
    // 060 at her rate of turn, 2 degrees a second (the trial includes her dynamics): 30 seconds.
    let own = { ...w.own.pos };
    let tgt = { ...w.targets[0]!.pos };
    const vT = velocityOf({ course: 270, speed: 10 });
    let best = Infinity;
    let bestT = 0;
    const dt = 0.1 / 3600;
    for (let i = 0; i <= 90 * 600; i++) {
      const tm = i * dt;
      const d = length(sub(tgt, own));
      if (d < best) {
        best = d;
        bestT = tm * 60;
      }
      const vO = velocityOf({ course: tm < 3 / 60 ? 0 : Math.min(60, 2 * (tm * 3600 - 180)), speed: 12 });
      own = add(own, scale(vO, dt));
      tgt = add(tgt, scale(vT, dt));
    }
    expect(row.result.cpa).toBeCloseTo(best, 3);
    expect(Math.abs(row.result.tcpaMinutes - bestT)).toBeLessThan(0.05);
  });
});

describe("ARPA trial: delay counts down and TIME FOR ACTION", () => {
  it("raises TIME FOR ACTION once when the delay elapses, and the remaining delay falls to zero", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    a.acquire(w, fromPolar(45, 6));
    runTo(w, a, rng, 240);
    a.settings.trial = { on: true, course: 60, speed: 12, delayMinutes: 2 };
    a.step(w, rng);
    expect(a.trialRemainingMin(w)).toBeCloseTo(2, 6);
    runTo(w, a, rng, 240 + 55);
    expect(a.alarms.some((x) => x.kind === "action")).toBe(false);
    // A minute before the manoeuvre, a reminder (book, 3rd edition, 4.7.4).
    runTo(w, a, rng, 240 + 65);
    expect(a.trialRemainingMin(w)).toBeCloseTo(0.92, 1);
    expect(a.alarms.find((x) => x.kind === "action")?.key).toBe("action-1min");
    runTo(w, a, rng, 240 + 125);
    expect(a.trialRemainingMin(w)).toBe(0);
    const al = a.alarms.find((x) => x.key === "action");
    expect(al).toBeDefined();
    a.ack(w, al!.key);
    runTo(w, a, rng, 240 + 180);
    expect(a.alarms.some((x) => x.kind === "action")).toBe(false); // not raised again
    // Changing the trial restarts the delay.
    a.settings.trial = { on: true, course: 90, speed: 12, delayMinutes: 2 };
    a.step(w, rng);
    expect(a.trialRemainingMin(w)).toBeCloseTo(2, 6);
  });
});

describe("ARPA alarms from the book", () => {
  it("gyro failure: equipment malfunction alarm stays, tracks are lost, alarm clears when fixed", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 200);
    a.gyroFailed = true;
    runTo(w, a, rng, 200 + a.cfg.lostAfterMissedScans * a.scanPeriod(w) + 10);
    const al = a.alarms.find((x) => x.kind === "malfunction")!;
    expect(al).toBeDefined();
    expect(t.state).toBe("lost");
    a.ack(w, al.key);
    expect(a.alarms.some((x) => x.kind === "malfunction")).toBe(true); // acknowledged but not cleared
    a.gyroFailed = false;
    a.step(w, rng);
    expect(a.alarms.some((x) => x.kind === "malfunction")).toBe(false);
  });

  it("memory full alarm stays until a target is dropped", () => {
    const cfg: ArpaConfig = { ...EXACT, maxTracks: 2 };
    const sc = scenario({ heading: 0, speed: 0 }, [ship(1, { e: 0, n: 3 }, 0, 0), ship(2, { e: 3, n: 0 }, 0, 0), ship(3, { e: -3, n: 0 }, 0, 0)]);
    const { w, a, rng } = setup(sc, cfg);
    a.step(w, rng);
    const t1 = a.acquire(w, { e: 0, n: 3 })!;
    a.acquire(w, { e: 3, n: 0 });
    expect(a.acquire(w, { e: -3, n: 0 })).toBeNull();
    const al = a.alarms.find((x) => x.kind === "capacity")!;
    expect(al).toBeDefined();
    a.ack(w, al.key);
    a.step(w, rng);
    expect(a.alarms.some((x) => x.kind === "capacity")).toBe(true);
    a.cancel(w, t1.id);
    a.step(w, rng);
    expect(a.alarms.some((x) => x.kind === "capacity")).toBe(false);
  });

  it("WRONG ORDER alarm is raised and acknowledged away", () => {
    const { w, a } = setup(scenario(ownA, []));
    a.wrongOrder(w, "nothing selected.");
    const al = a.alarms.find((x) => x.kind === "order")!;
    expect(al.text).toContain("WRONG ORDER");
    a.ack(w, al.key);
    expect(a.alarms.length).toBe(0);
  });

  it("a settled target that turns 40 degrees raises a manoeuvre alarm; steady targets do not", () => {
    const sc = scenario(ownA, [shipA({ events: [{ atSeconds: 400, course: 230 }] }), ship(2, fromPolar(300, 5), 90, 8)]);
    const { w, a, rng } = setup(sc);
    a.step(w, rng);
    const t1 = a.acquire(w, fromPolar(45, 6))!;
    const t2 = a.acquire(w, fromPolar(300, 5))!;
    runTo(w, a, rng, 380);
    expect(a.alarms.some((x) => x.kind === "course")).toBe(false);
    runTo(w, a, rng, 700);
    expect(a.alarms.some((x) => x.kind === "course" && x.trackId === t1.id)).toBe(true);
    expect(a.alarms.some((x) => x.kind === "course" && x.trackId === t2.id)).toBe(false);
  });
});

describe("ARPA: past positions, standby, self-test, log mode", () => {
  const settled = (): ReturnType<typeof setup> => {
    const x = setup(scenario(ownA, [shipA()]));
    x.a.step(x.w, x.rng);
    x.a.acquire(x.w, fromPolar(45, 6));
    runTo(x.w, x.a, x.rng, 600);
    return x;
  };
  // Hand: own ship (0, 12 h); ship A (6 sin45 - 10 h, 6 cos45). h in hours.
  const e0 = 6 * Math.sin(Math.PI / 4);

  it("relative past positions are where the target was relative to own ship, one minute apart", () => {
    const { w, a } = settled();
    a.settings.past = { mode: "relative", points: 3, intervalMin: 1 };
    const pts = a.pastPositions(w, a.tracks[0]!);
    expect(pts.length).toBe(3);
    pts.forEach((p, i) => {
      const h = (600 - 60 * (i + 1)) / 3600;
      expect(p.e).toBeCloseTo(e0 - 10 * h, 1);
      expect(p.n).toBeCloseTo(e0 - 12 * h, 1);
    });
  });

  it("true past positions are the target's track in the water, seen from own ship now", () => {
    const { w, a } = settled();
    a.settings.past = { mode: "true", points: 3, intervalMin: 1 };
    const pts = a.pastPositions(w, a.tracks[0]!);
    const hNow = 600 / 3600;
    pts.forEach((p, i) => {
      const h = (600 - 60 * (i + 1)) / 3600;
      expect(p.e).toBeCloseTo(e0 - 10 * h, 1);
      expect(p.n).toBeCloseTo(e0 - 12 * hNow, 1); // target kept its latitude; own ship moved north
    });
  });

  it("past positions stop when there is not enough history, and are empty when off", () => {
    const { w, a } = settled();
    a.settings.past = { mode: "relative", points: 10, intervalMin: 6 };
    expect(a.pastPositions(w, a.tracks[0]!).length).toBe(1); // only 10 min of history: one 6-minute dot
    a.settings.past.mode = "off";
    expect(a.pastPositions(w, a.tracks[0]!)).toEqual([]);
  });

  it("standby clears every target and alarm; on again starts empty", () => {
    const { w, a, rng } = settled();
    expect(a.tracks.length).toBe(1);
    a.settings.standby = true;
    runTo(w, a, rng, 610);
    expect(a.tracks.length).toBe(0);
    expect(a.alarms.length).toBe(0);
    a.settings.standby = false;
    runTo(w, a, rng, 700);
    expect(a.tracks.length).toBe(0);
  });

  it("self-test passes with good inputs and fails on a gyro failure", () => {
    const { w, a } = setup(scenario(ownA, []));
    a.runSelfTest(w);
    expect(a.test!.results.every((r) => r.ok)).toBe(true);
    expect(a.test!.results[0]!.detail).toContain("TCPA 30.0");
    a.gyroFailed = true;
    a.runSelfTest(w);
    expect(a.test!.results.find((r) => r.name.startsWith("Gyro"))!.ok).toBe(false);
  });

  it("self-test is refused in standby and its display expires", () => {
    const { w, a, rng } = setup(scenario(ownA, []));
    a.settings.standby = true;
    a.runSelfTest(w);
    expect(a.test).toBeNull();
    a.settings.standby = false;
    a.runSelfTest(w);
    runTo(w, a, rng, a.cfg.testDurationSec + 2);
    expect(a.test).toBeNull();
  });

  it("bottom-track log: sea stabilised vectors are over the ground, so a buoy has no vector without a reference", () => {
    const sc = scenario({ heading: 0, speed: 10 }, [ship(1, { e: 0, n: 4 }, 0, 0)], { set: 90, drift: 2 });
    const { w, a, rng } = setup(sc);
    a.settings.logMode = "bottom";
    a.step(w, rng);
    const t = a.acquire(w, { e: 0, n: 4 })!;
    runTo(w, a, rng, 200);
    expect(a.estimate(w, t, "sea")!.trueCS.speed).toBeCloseTo(0, 3);
  });
});

describe("ARPA inputs and display control (IMO A.823(19) 3.4.7, 3.9.2, 3.11)", () => {
  const buoyInCurrent = scenario({ heading: 0, speed: 10 }, [ship(1, { e: 0, n: 4 }, 0, 0)], { set: 90, drift: 2 });

  it("manual speed input (STCW B-I/12 para 32.4): a wrong speed gives wrong true speeds but the same CPA", () => {
    // Own ship 000 at 10 kn, a stopped object dead ahead, no current. With the correct speed the object
    // shows 0 kn. With 6 kn set by hand the ARPA believes own ship does 6 kn, but the object still closes
    // at 10 kn, so it is shown steering 180 at 4 kn. The relative motion, hence CPA, does not change.
    const sc = scenario({ heading: 0, speed: 10 }, [ship(1, { e: 0, n: 6 }, 0, 0)]);
    const { w, a, rng } = setup(sc);
    a.settings.logMode = "manual";
    a.settings.manualSpeedKn = 10;
    a.step(w, rng);
    const t = a.acquire(w, { e: 0, n: 6 })!;
    runTo(w, a, rng, 200);
    expect(a.stabLabel()).toBe("SEA STAB (MAN SPD)");
    expect(a.estimate(w, t, "sea")!.trueCS.speed).toBeCloseTo(0, 3);
    const cpaRight = a.estimate(w, t, "sea")!.cpa.cpa;
    a.settings.manualSpeedKn = 6;
    runTo(w, a, rng, 420); // the new speed works through the tracker's smoothing window (180 s)
    const e = a.estimate(w, t, "sea")!;
    expect(e.trueCS.speed).toBeCloseTo(4, 3);
    expect(e.trueCS.course).toBeCloseTo(180, 1);
    expect(e.cpa.cpa).toBeCloseTo(cpaRight, 3);
  });

  it("EPFS (GNSS) speed input gives ground stabilisation without a reference target, and says so", () => {
    const { w, a, rng } = setup(buoyInCurrent);
    a.settings.logMode = "gnss";
    a.step(w, rng);
    const t = a.acquire(w, { e: 0, n: 4 })!;
    runTo(w, a, rng, 200);
    expect(a.effectiveStab()).toBe("ground");
    expect(a.stabLabel()).toBe("GND STAB (EPFS)");
    expect(t.est!.trueCS.speed).toBeCloseTo(0, 3); // a fixed mark does not move over the ground
    // Relative motion is unchanged: (0,0) - (2,10).
    expect(t.est!.relVel.e).toBeCloseTo(-2, 3);
    expect(t.est!.relVel.n).toBeCloseTo(-10, 3);
  });

  it("the stabilisation label names the input in every mode", () => {
    const { w, a, rng } = setup(buoyInCurrent);
    a.step(w, rng);
    expect(a.stabLabel()).toBe("SEA STAB (LOG)");
    a.settings.logMode = "bottom";
    expect(a.stabLabel()).toBe("GND STAB (BT LOG)");
    a.settings.logMode = "water";
    const t = a.acquire(w, { e: 0, n: 4 })!;
    runTo(w, a, rng, 200);
    a.designateGroundRef(w, t.id);
    expect(a.stabLabel()).toBe(`GND STAB (REF TGT ${t.id})`);
  });

  it("a failed speed log is indicated; CPA stays right, true speed does not", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    a.logFailed = true;
    runTo(w, a, rng, 240);
    expect(a.alarms.find((x) => x.key === "logfail")!.text).toContain("SPEED LOG INPUT ABSENT");
    expect(t.est!.cpa.cpa).toBeCloseTo(A_CPA, 3);
    // With no own speed the "true" vector is just the relative motion: (-10, -12) = 15.62 kn.
    expect(t.est!.trueCS.speed).toBeCloseTo(Math.hypot(10, 12), 2);
    a.logFailed = false;
    a.step(w, rng);
    expect(a.alarms.some((x) => x.key === "logfail")).toBe(false);
  });

  it("a guard zone warning records where the echo was", () => {
    const sc = scenario({ heading: 0, speed: 0 }, [ship(1, { e: 0, n: 5.8 }, 180, 6)]);
    const { w, a, rng } = setup(sc);
    a.settings.guardZones[0]!.on = true; // ring 5.5 to 6.0 NM
    runTo(w, a, rng, 30);
    const g = a.alarms.find((x) => x.kind === "guard")!;
    expect(g.rel!.n).toBeGreaterThan(5.5);
    expect(Math.abs(g.rel!.e)).toBeLessThan(0.05);
  });
});

describe("instructor fault injection", () => {
  it("ramps the injected errors at the set rates", () => {
    const w = createWorld(scenario({ heading: 0, speed: 10 }, []));
    w.sensors.target = { gyroErrorDeg: 3, logErrorKn: -1 };
    for (let i = 0; i < 60; i++) stepWorld(w, 1); // one minute at 1 deg/min and 1 kn/min
    expect(w.sensors.gyroErrorDeg).toBeCloseTo(1, 9);
    expect(w.sensors.logErrorKn).toBeCloseTo(-1, 9);
    for (let i = 0; i < 180; i++) stepWorld(w, 1);
    expect(w.sensors.gyroErrorDeg).toBeCloseTo(3, 9);
  });

  it("tracks survive a gyro error brought in gradually", () => {
    const { w, a, rng } = setup(scenario(ownA, [shipA()]));
    a.step(w, rng);
    const t = a.acquire(w, fromPolar(45, 6))!;
    runTo(w, a, rng, 60);
    w.sensors.target = { gyroErrorDeg: 5, logErrorKn: 0 };
    runTo(w, a, rng, 600);
    expect(t.state).toBe("tracking");
    expect(t.swaps).toBe(0);
    // Once the error is steady and the window has refilled, CPA is back to the hand value.
    expect(t.est!.cpa.cpa).toBeCloseTo(A_CPA, 3);
  });
});
