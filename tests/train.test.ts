import { describe, expect, it } from "vitest";
import { bowCrossing } from "../src/core/bcr";
import { rule19Check } from "../src/core/colreg";
import { courseSpeedOf, fromPolar, normalizeDeg, rotateVec, sub } from "../src/core/vec";
import { SCENARIOS, World, createWorld, setShipModel, stepWorld } from "../src/engine/index";
import { ArpaSystem, Track } from "../src/arpa/index";
import {
  ARPA_EXERCISES, ArpaExSession, PLACEHOLDER_SCORING, SCENARIO_FORMAT, arpaExerciseById, minimalStarboardAlteration, scenarioFromJson,
  scenarioToJson, truthCpa, validateScenario,
} from "../src/train/index";

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** A student station: world, ARPA (with its normal noise) and the exercise session. */
function station(id: string, seed = 7): { w: World; a: ArpaSystem; s: ArpaExSession; run: (to: number) => void; acquireAll: () => void; track: (truthId: number) => Track } {
  const def = arpaExerciseById(id)!;
  const w = createWorld(def.scenario, 62);
  w.radar.controls.tuning = 62;
  const a = new ArpaSystem(w);
  const s = new ArpaExSession(def, w, a);
  const rng = seeded(seed);
  const run = (to: number): void => {
    while (w.time < to - 1e-9) {
      stepWorld(w, 0.5);
      a.step(w, rng);
      s.step(w, a);
    }
  };
  a.step(w, rng);
  return {
    w, a, s, run,
    acquireAll: () => {
      for (const t of w.targets) a.acquire(w, rotateVec(sub(t.pos, w.own.pos), w.sensors.gyroErrorDeg));
    },
    track: (truthId) => a.tracks.find((t) => t.truthId === truthId && t.state === "tracking")!,
  };
}

describe("core: Rule 19(d) check", () => {
  it("port turn for a vessel forward of the beam is a fault; starboard is not", () => {
    expect(rule19Check(-40, [{ relBearing: 30 }]).ok).toBe(false);
    expect(rule19Check(40, [{ relBearing: 30 }]).ok).toBe(true);
    expect(rule19Check(-40, [{ relBearing: 330 }]).ok).toBe(false);
  });
  it("port turn is allowed for a vessel being overtaken", () => {
    expect(rule19Check(-40, [{ relBearing: 10, beingOvertaken: true }]).ok).toBe(true);
  });
  it("turning towards a vessel abeam or abaft the beam is a fault", () => {
    expect(rule19Check(40, [{ relBearing: 120 }]).ok).toBe(false); // starboard quarter, turn to starboard
    expect(rule19Check(-40, [{ relBearing: 120 }]).ok).toBe(true);
    expect(rule19Check(-40, [{ relBearing: 240 }]).ok).toBe(false); // port quarter, turn to port
    expect(rule19Check(40, [{ relBearing: 90 }]).ok).toBe(false); // exactly abeam to starboard
  });
  it("a speed change alone is never a Rule 19(d) fault", () => {
    expect(rule19Check(0, [{ relBearing: 30 }, { relBearing: 200 }]).ok).toBe(true);
  });
});

describe("scenario files", () => {
  it("every built-in exercise scenario round-trips through JSON and validates", () => {
    for (const ex of ARPA_EXERCISES) {
      const text = scenarioToJson(ex.scenario);
      expect(validateScenario(JSON.parse(text))).toEqual([]);
      const back = scenarioFromJson(text);
      expect("scenario" in back).toBe(true);
      if ("scenario" in back) expect(back.scenario.targets.length).toBe(ex.scenario.targets.length);
    }
  });
  it("reports readable problems", () => {
    const bad = { format: SCENARIO_FORMAT, id: "x", name: "x", own: { heading: 400, speed: 10 }, coasts: [], targets: [{ id: 1, name: "a", kind: "submarine", pos: { e: 0, n: 1 }, course: 10, speed: 5, rcs: 1, height: 3, events: [] }, { id: 1 }] };
    const errs = validateScenario(bad);
    expect(errs.some((e) => e.includes("heading"))).toBe(true);
    expect(errs.some((e) => e.includes("kind"))).toBe(true);
    expect(errs.some((e) => e.includes("used twice"))).toBe(true);
    expect(scenarioFromJson("{not json")).toHaveProperty("errors");
    expect(validateScenario({ format: "other" }).length).toBeGreaterThan(2);
  });
  it("keeps a target's AIS class and further AIS data, and checks them", () => {
    const sc = SCENARIOS.find((x) => x.id === "open-sea")!;
    const back = scenarioFromJson(scenarioToJson(sc));
    if (!("scenario" in back)) throw new Error("did not validate");
    const a = back.scenario.targets.find((t) => t.id === 1)!;
    expect(a.aisStatic).toEqual({ destination: "SINGAPORE", eta: "16 NOV 0600 UTC", draughtM: 8.6, shipType: "Cargo" });
    expect(back.scenario.targets.find((t) => t.id === 4)!.ais).toBe(true);
    const bad = JSON.parse(scenarioToJson(sc));
    bad.targets[0].aisClass = "C";
    bad.targets[1].aisStatic = { draughtM: 99 };
    bad.targets[2].paint = 1.5;
    const errs = validateScenario(bad);
    expect(errs.some((e) => e.includes("aisClass"))).toBe(true);
    expect(errs.some((e) => e.includes("aisStatic"))).toBe(true);
    expect(errs.some((e) => e.includes("paint"))).toBe(true);
  });
  it("keeps a real area's terrain and origin, and checks them", () => {
    for (const id of ["mumbai-approach", "goa-approach", "kochi-approach", "kutch-approach"]) {
      const sc = SCENARIOS.find((x) => x.id === id)!;
      const back = scenarioFromJson(scenarioToJson(sc));
      if (!("scenario" in back)) throw new Error(`${id} did not validate`);
      expect(back.scenario.terrain).toBe(sc.terrain);
      expect(back.scenario.origin).toEqual(sc.origin);
    }
    const bad = JSON.parse(scenarioToJson(SCENARIOS.find((x) => x.id === "goa-approach")!));
    bad.terrain = "atlantis";
    bad.origin = { lat: 95, lon: 0 };
    const errs = validateScenario(bad);
    expect(errs.some((e) => e.includes("terrain"))).toBe(true);
    expect(errs.some((e) => e.includes("origin"))).toBe(true);
  });
});

describe("ARPA exercises: structure", () => {
  it("nine exercises, numbered 1 to 9, with unique task ids, briefing and debrief", () => {
    expect(ARPA_EXERCISES.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const ex of ARPA_EXERCISES) {
      expect(new Set(ex.tasks.map((t) => t.id)).size).toBe(ex.tasks.length);
      expect(ex.briefing.length).toBeGreaterThan(1);
      expect(ex.debrief.length).toBeGreaterThan(1);
    }
  });
  it("doing nothing scores zero and no pass/fail is given without a pass mark", () => {
    const { w, a, s, run } = station("arpa-1");
    run(60);
    const r = s.finish(w, a);
    expect(r.score).toBe(0);
    expect(r.passed).toBeNull();
    expect(new ArpaExSession(arpaExerciseById("arpa-1")!, w, a, { ...PLACEHOLDER_SCORING, passPercent: 50 }).finish(w, a).passed).toBe(false);
  });
});

describe("ARPA exercises worked by a careful student (answers read off the ARPA, noise on)", () => {
  it("exercise 1: acquisition and data", () => {
    const { w, a, s, run, acquireAll, track } = station("arpa-1");
    acquireAll();
    run(360);
    const A = track(1).est!;
    const B = track(2).est!;
    expect(s.answer(w, a, "cpaA", A.cpa.cpa)).toBe(true);
    s.answer(w, a, "tcpaA", A.cpa.tcpaMinutes!);
    s.answer(w, a, "crsB", B.trueCS.course);
    s.answer(w, a, "danger", 1);
    const r = s.finish(w, a);
    expect(r.items.filter((i) => !i.ok).map((i) => i.id)).toEqual([]);
    expect(r.percent).toBe(100);
  });

  it("exercise 2: Ship D is on a collision course (independent check of the scenario)", () => {
    const { w } = station("arpa-2");
    expect(truthCpa(w, 1)!.cpa).toBeLessThan(0.05);
    expect(truthCpa(w, 3)!.tcpaMinutes).toBeNull(); // same course and speed: no relative motion
  });

  it("exercise 3: the new course can only be answered after the alteration", () => {
    const { w, a, s, run, acquireAll, track } = station("arpa-3");
    acquireAll();
    run(300);
    expect(s.answer(w, a, "newcrs", 295)).toBe(false);
    a.settings.past = { mode: "true", points: 5, intervalMin: 1 };
    run(900);
    expect(a.alarms.some((x) => x.kind === "course")).toBe(true);
    s.answer(w, a, "newcrs", track(1).est!.trueCS.course);
    s.answer(w, a, "who", 0);
    s.answer(w, a, "cpaH", track(1).est!.cpa.cpa);
    const r = s.finish(w, a);
    expect(r.items.filter((i) => !i.ok).map((i) => i.id)).toEqual([]);
  });

  it("exercise 5: limits, alarm and bow crossing range", () => {
    const { w, a, s, run, acquireAll, track } = station("arpa-5");
    a.settings.cpaLimitNm = 2;
    a.settings.tcpaLimitMin = 20;
    acquireAll();
    run(900);
    const al = a.alarms.find((x) => x.kind === "cpa");
    expect(al?.trackId).toBe(track(1).id);
    a.ack(w, al!.key);
    const e = track(1).est!;
    s.answer(w, a, "bcr", bowCrossing(e.rel, e.relVel, a.ownCourseSpeed(w).course)!.rangeNm);
    s.answer(w, a, "who", 0);
    s.answer(w, a, "ast", 1);
    run(905);
    expect(s.finish(w, a).percent).toBe(100);
  });

  it("exercise 6: 40 degrees is not enough (Ship R), 60 degrees clears everything", () => {
    for (const [turn, safe] of [[40, false], [60, true]] as const) {
      const { w, a, s, run, acquireAll } = station("arpa-6");
      acquireAll();
      run(240);
      a.settings.trial = { on: true, course: 60, speed: 14, delayMinutes: 1 };
      run(250);
      a.settings.trial.on = false;
      expect(minimalStarboardAlteration(w, 2)).toBe(50);
      s.answer(w, a, "alt", 50);
      w.own.ordered.course = turn;
      run(2400);
      const r = s.finish(w, a);
      expect(r.items.find((i) => i.id === "alt")!.ok).toBe(true);
      expect(r.items.find((i) => i.id === "act")!.ok).toBe(true);
      expect(r.items.find((i) => i.id === "safe")!.ok).toBe(safe);
    }
  });

  it("exercise 7: sea and ground data, set and drift from the light float", () => {
    const { w, a, s, run, acquireAll, track } = station("arpa-7");
    acquireAll();
    run(300);
    s.answer(w, a, "seaC", track(2).est!.trueCS.course);
    // Sea stabilised, a fixed mark's true vector is the reverse of the current.
    const f = track(1).est!.trueCS;
    s.answer(w, a, "set", normalizeDeg(f.course + 180));
    s.answer(w, a, "drift", f.speed);
    a.designateGroundRef(w, track(1).id);
    run(330);
    s.answer(w, a, "gndC", track(2).est!.trueCS.course);
    const r = s.finish(w, a);
    expect(r.items.filter((i) => !i.ok).map((i) => i.id)).toEqual([]);
  });

  it("exercise 8: the gyro error is scripted, found from the heading readout, and the weak boat is lost", () => {
    const { w, a, s, run, acquireAll } = station("arpa-8");
    acquireAll();
    a.runSelfTest(w);
    run(280);
    s.answer(w, a, "which", 3);
    expect(s.answer(w, a, "gyro", 4)).toBe(false); // not in yet
    run(700);
    expect(w.sensors.gyroErrorDeg).toBeCloseTo(4, 6);
    const lost = a.alarms.find((x) => x.kind === "lost");
    expect(lost).toBeDefined();
    a.ack(w, lost!.key);
    const headingReadout = normalizeDeg(w.own.heading + w.sensors.gyroErrorDeg); // what the HDG readout shows
    s.answer(w, a, "gyro", headingReadout - w.own.ordered.course);
    s.answer(w, a, "which", 0);
    s.answer(w, a, "cpaerr", 1);
    run(705);
    const r = s.finish(w, a);
    expect(r.items.filter((i) => !i.ok).map((i) => i.id)).toEqual([]);
  });

  it("exercise 9: starboard 50 passes; port 50 breaks Rule 19(d); no action fails", () => {
    const outcome = (turn: number | null): { act: boolean; safe: boolean; detail: string } => {
      const { w, a, s, run, acquireAll } = station("arpa-9");
      acquireAll();
      run(360);
      if (turn !== null) w.own.ordered.course = normalizeDeg(turn);
      run(2400);
      const r = s.finish(w, a);
      return { act: r.items.find((i) => i.id === "act")!.ok, safe: r.items.find((i) => i.id === "safe")!.ok, detail: r.items.find((i) => i.id === "act")!.student };
    };
    expect(outcome(50)).toMatchObject({ act: true, safe: true });
    const port = outcome(-50);
    expect(port.act).toBe(false);
    expect(port.detail).toContain("19(d)(i)");
    expect(outcome(null)).toMatchObject({ act: false, safe: false });
    expect(outcome(15).act).toBe(false); // too small to be readily apparent
  });

  it("exercise 9 with each ship model (as the screen runs it): starboard 50 still passes, no action still fails", () => {
    for (const type of ["container", "bulk", "tanker", "coaster"]) {
      const outcome = (turn: number | null): { act: boolean; safe: boolean } => {
        const { w, a, s, run, acquireAll } = station("arpa-9");
        setShipModel(w, type);
        acquireAll();
        run(360);
        if (turn !== null) w.own.ordered.course = normalizeDeg(turn);
        run(2400);
        const r = s.finish(w, a);
        return { act: r.items.find((i) => i.id === "act")!.ok, safe: r.items.find((i) => i.id === "safe")!.ok };
      };
      expect(outcome(50), type).toMatchObject({ act: true, safe: true });
      expect(outcome(null), type).toMatchObject({ act: false, safe: false });
    }
  });

  it("exercise 4: guard zone, automatic acquisition and exclusion area in coastal waters", () => {
    const { w, a, s, run } = station("arpa-4");
    // Guard ring 5.5 to 6 NM, the coast to starboard excluded, automatic acquisition on.
    a.settings.guardZones[0]!.on = true;
    a.settings.exclusionZones[0]!.on = true;
    a.settings.autoAcquire = true;
    // Coaster G is already inside the ring, so it is never auto-acquired: acquire it by hand.
    const g = w.targets.find((t) => t.id === 4)!;
    a.acquire(w, sub(g.pos, w.own.pos));
    run(1000); // Bulk carrier H closes from 11 NM and is picked up as it crosses the ring
    const n = a.alarms.find((x) => x.kind === "new");
    if (n) a.ack(w, n.key);
    s.answer(w, a, "why", 2);
    run(1005);
    const r = s.finish(w, a);
    expect(r.items.filter((i) => !i.ok).map((i) => i.id)).toEqual([]);
    void courseSpeedOf; void fromPolar;
  });
});

import { DEFAULT_PIN, Recorder, Store, STORE_KEY, frameAt, pairKey, recordsCsv, resultCsv, toCsv } from "../src/train/index";

describe("records, replay frames and the store", () => {
  const memory = (): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  };

  it("the recorder samples every 10 s and frameAt returns the frame in force", () => {
    const { w, a, s, run } = station("arpa-1");
    const rec = new Recorder({ exerciseId: "arpa-1", title: "t", kind: "arpa", students: ["A", "B"], batch: "X" }, w, "2026-01-01T00:00:00Z");
    for (let t = 1; t <= 65; t++) {
      run(t);
      rec.sample(w, a);
    }
    expect(rec.rec.frames.map((f) => f.t)).toEqual([1, 11, 21, 31, 41, 51, 61]);
    expect(frameAt(rec.rec, 35)!.t).toBe(31);
    // Own ship steams 000 at 12 kn: after 61 s it is 12 * 61 / 3600 = 0.2033 NM north.
    expect(frameAt(rec.rec, 61)!.own.n).toBeCloseTo(0.203, 3);
    expect(rec.rec.names[1]).toBe("Ship A");
    void s;
  });

  it("CSV quoting and the record exports", () => {
    expect(toCsv([["a,b", 'say "hi"', 3]])).toBe('"a,b","say ""hi""",3\r\n');
    const { w, a, s, run } = station("arpa-1");
    run(30);
    const rec = new Recorder({ exerciseId: "arpa-1", title: "1. Setting up", kind: "arpa", students: ["Asha", "Ravi"], batch: "B1" }, w, "2026-01-01T00:00:00Z");
    rec.sample(w, a);
    rec.rec.result = s.finish(w, a);
    const csv = recordsCsv([rec.rec]);
    expect(csv.split("\r\n")[1]).toContain("Asha / Ravi");
    expect(csv.split("\r\n")[1]).toContain("no pass mark set");
    expect(resultCsv(rec.rec).split("\r\n").length).toBe(rec.rec.result.items.length + 2);
  });

  it("the store keeps batches, assignments, PIN, records and pair time", () => {
    const kv = memory();
    const st = new Store(kv);
    expect(st.checkPin(DEFAULT_PIN)).toBe(true);
    expect(st.setPin("12")).toBe(false);
    expect(st.setPin("4321")).toBe(true);
    const b = st.addBatch("Batch 7")!;
    expect(st.addBatch("batch 7")).toBeNull();
    st.setStudents(b.id, ["Asha", " Ravi ", "Asha", ""]);
    st.setAssigned(b.id, ["arpa-1", "arpa-2", "arpa-1"]);
    st.addPairTime(["Ravi", "Asha"], 5400);
    st.addPairTime(["asha", "ravi "], 1800);
    st.save();
    const again = new Store(kv);
    expect(again.checkPin("4321")).toBe(true);
    expect(again.data.batches[0]!.students).toEqual(["Asha", "Ravi"]);
    expect(again.data.batches[0]!.assigned).toEqual(["arpa-1", "arpa-2"]);
    expect(again.pairHours(["Asha", "Ravi"])).toBeCloseTo(2, 9); // 7200 s
    expect(pairKey(["B", "a"])).toBe("a + b");
  });

  it("a damaged store starts empty instead of failing, and a full store drops the oldest records", () => {
    const kv = memory();
    kv.map.set(STORE_KEY, "{broken");
    expect(new Store(kv).data.batches).toEqual([]);
    let allow = 2500;
    const small = { getItem: () => null, setItem: (_k: string, v: string) => { if (v.length > allow) throw new Error("full"); } };
    const st = new Store(small);
    const mk = (i: number) => ({ id: `r${i}`, exerciseId: "x", title: "x".repeat(300), kind: "arpa" as const, students: [], batch: "", startedIso: "", simSeconds: 0, names: {}, coasts: [], frames: [], events: [], result: null, summary: [] });
    for (let i = 0; i < 8; i++) st.addRecord(mk(i));
    expect(st.data.records[0]!.id).toBe("r7");
    expect(st.data.records.length).toBeLessThan(8);
    allow = 0;
    expect(st.addRecord(mk(99))).toBe(false);
  });
});

describe("capacity and performance", () => {
  it("the ARPA tracks 20 targets at once and reports memory full for the 21st", () => {
    const targets = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, kind: "ship" as const, pos: fromPolar(i * 14 + 5, 4 + (i % 5)), course: (i * 37) % 360, speed: 6 + (i % 7), rcs: 1, height: 20, events: [] }));
    const w = createWorld({ id: "cap", name: "cap", description: "", own: { heading: 0, speed: 12 }, env: { seaState: 0 }, coasts: [], targets }, 62);
    w.radar.controls.tuning = 62;
    w.radar.shadowSectors = [];
    const a = new ArpaSystem(w);
    const rng = seeded(11);
    a.step(w, rng);
    let refused = 0;
    for (const t of w.targets) if (!a.acquire(w, sub(t.pos, w.own.pos))) refused++;
    expect(a.cfg.maxTracks).toBe(20);
    expect(refused).toBe(5);
    expect(a.alarms.some((x) => x.kind === "capacity")).toBe(true);
    // 25 targets on the screen, 20 tracked: ten simulated minutes must run far faster than real time.
    const t0 = Date.now();
    while (w.time < 600) {
      stepWorld(w, 0.5);
      a.step(w, rng);
    }
    const wallSeconds = (Date.now() - t0) / 1000;
    expect(a.activeCount()).toBeGreaterThanOrEqual(18);
    expect(wallSeconds).toBeLessThan(20); // 600 simulated seconds: at least 30 times faster than real time
  });
});

import { RADAR_EXERCISES, REMOTE_ID_BASE, applyRemoteShips, remoteId } from "../src/train/index";
import { courseToSteer } from "../src/core/current";

describe("linked own-ship stations", () => {
  const mk = () => createWorld({ id: "j", name: "j", description: "", own: { heading: 0, speed: 10 }, env: { seaState: 0 }, coasts: [], targets: [] }, 62);

  it("another display's own ship appears as a ship target with AIS, is updated, and is run on between reports", () => {
    const w = mk();
    const r = { station: "SAB12", name: "OS Meera", e: 3, n: 4, cog: 90, sog: 12, at: 1000 };
    const res = applyRemoteShips(w, [r], 1000);
    const id = remoteId("SAB12");
    expect(id).toBeGreaterThanOrEqual(REMOTE_ID_BASE);
    expect(res.added).toEqual([id]);
    const t = w.targets[0]!;
    expect(t).toMatchObject({ name: "OS Meera", kind: "ship", course: 90, speed: 12, ais: true });
    // Three seconds later with no new report: 12 kn east for 3 s = 0.01 NM.
    applyRemoteShips(w, [r], 4000);
    expect(w.targets.length).toBe(1);
    expect(w.targets[0]!.pos.e).toBeCloseTo(3.01, 6);
    expect(w.targets[0]!.pos.n).toBeCloseTo(4, 9);
  });

  it("a display that stops reporting is removed after 10 s; scenario targets are never touched", () => {
    const w = mk();
    w.targets.push({ id: 1, name: "Scenario ship", kind: "ship", pos: { e: 1, n: 1 }, course: 0, speed: 5, rcs: 1, height: 20, events: [], nextEvent: 0 });
    const r = { station: "S1", name: "OS A", e: 0, n: 5, cog: 180, sog: 10, at: 0 };
    applyRemoteShips(w, [r], 5000);
    expect(w.targets.length).toBe(2);
    const res = applyRemoteShips(w, [r], 10001);
    expect(res.removed).toEqual([remoteId("S1")]);
    expect(w.targets.map((t) => t.name)).toEqual(["Scenario ship"]);
  });

  it("two stations that exchange reports see each other closing head-on at the right range", () => {
    // Station A at the origin steering 000 at 10 kn; station B 6 NM north steering 180 at 10 kn.
    const a = mk();
    const b = mk();
    b.own.pos = { e: 0, n: 6 };
    b.own.heading = 180;
    b.own.ordered.course = 180;
    let now = 0;
    for (let s = 0; s < 360; s++) {
      stepWorld(a, 1);
      stepWorld(b, 1);
      now += 1000;
      applyRemoteShips(a, [{ station: "B", name: "OS B", e: b.own.pos.e, n: b.own.pos.n, cog: 180, sog: 10, at: now }], now);
      applyRemoteShips(b, [{ station: "A", name: "OS A", e: a.own.pos.e, n: a.own.pos.n, cog: 0, sog: 10, at: now }], now);
    }
    // Closing at 20 kn for 6 minutes = 2 NM: range 4 NM, seen the same from both.
    const ra = Math.hypot(a.targets[0]!.pos.e - a.own.pos.e, a.targets[0]!.pos.n - a.own.pos.n);
    const rb = Math.hypot(b.targets[0]!.pos.e - b.own.pos.e, b.targets[0]!.pos.n - b.own.pos.n);
    expect(ra).toBeCloseTo(4, 6);
    expect(rb).toBeCloseTo(4, 6);
  });
});

describe("radar exercises 10 and 11", () => {
  const stationFor = (id: string) => {
    const def = RADAR_EXERCISES.find((e) => e.id === id)!;
    const w = createWorld(def.scenario, 62);
    const a = new ArpaSystem(w);
    const s = new ArpaExSession(def, w, a);
    const rng = seeded(3);
    const ui = { pi: [{ on: false, bearing: 0, range: 1 }], navLines: 0 };
    const run = (to: number): void => {
      while (w.time < to - 1e-9) {
        stepWorld(w, 0.5);
        a.step(w, rng);
        s.step(w, a, ui);
      }
    };
    return { w, a, s, run, ui };
  };

  it("exercise 10: steering the course to steer keeps the track; steering 000 is set off it", () => {
    for (const correct of [true, false]) {
      const { w, a, s, run, ui } = stationFor("radar-10");
      ui.pi[0] = { on: true, bearing: 0, range: 1.5 };
      ui.navLines = 1;
      // Hand: current 090 at 1.5 kn across a 000 track at 10 kn: steer asin(1.5/10) = 8.63 to port = 351.37.
      const cts = courseToSteer(0, 10, w.env.current)!.heading;
      expect(cts).toBeCloseTo(351.37, 1);
      s.answer(w, a, "cts", 351);
      s.answer(w, a, "why", 0);
      if (correct) {
        w.own.heading = cts;
        w.own.ordered.course = cts;
      }
      run(3500);
      const r = s.finish(w, a);
      expect(r.items.find((i) => i.id === "pi")!.ok).toBe(true);
      expect(r.items.find((i) => i.id === "nav")!.ok).toBe(true);
      expect(r.items.find((i) => i.id === "cts")!.ok).toBe(true);
      expect(r.items.find((i) => i.id === "xte")!.ok).toBe(correct);
    }
  });

  it("exercise 10: the wrong parallel index line is not accepted", () => {
    const { w, a, s, run, ui } = stationFor("radar-10");
    ui.pi[0] = { on: true, bearing: 0, range: -1.5 }; // port side: wrong side
    run(10);
    expect(s.finish(w, a).items.find((i) => i.id === "pi")!.ok).toBe(false);
  });

  it("exercise 11: homing on the SART and slowing down passes; passing at full speed does not", () => {
    for (const slow of [true, false]) {
      const { w, a, s, run } = stationFor("radar-11");
      const sart = w.targets[0]!;
      const brg = (): number => ((Math.atan2(sart.pos.e - w.own.pos.e, sart.pos.n - w.own.pos.n) * 180) / Math.PI + 360) % 360;
      s.answer(w, a, "rng", 7);
      s.answer(w, a, "brg", brg());
      for (const [id, v] of [["where", 0], ["racon", 0], ["band", 0]] as const) s.answer(w, a, id, v);
      for (let t = 0; t < 3000; t += 10) {
        w.own.ordered.course = brg();
        const range = Math.hypot(sart.pos.e - w.own.pos.e, sart.pos.n - w.own.pos.n);
        if (slow && range < 1.5) w.own.ordered.speed = 4;
        if (slow && range < 0.15) w.own.ordered.speed = 0;
        run(t + 10);
      }
      const r = s.finish(w, a);
      expect(r.items.filter((i) => i.id !== "close").every((i) => i.ok)).toBe(true);
      expect(r.items.find((i) => i.id === "close")!.ok).toBe(slow);
    }
  });
});
