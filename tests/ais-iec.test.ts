import { describe, expect, it } from "vitest";
import { fromPolar, sub } from "../src/core/vec";
import { Scenario, createWorld, stepWorld } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import {
  AIS_CAPACITY, AIS_FILTER_OFF, AIS_PAST_SAMPLE_SEC, AisSystem, aisClassBIntervalSec, aisClassBLostAfterSec, aisFilterLabel, aisFilterOn, aisFilteredOut,
  aisLostAfterSec, aisReportIntervalSec, ownShipAisData, simulatedImo,
} from "../src/ais/index";

/** AIS functions checked against IEC 62388:2013 (11.5, 11.7.4, 11.9, Tables 26 and 27) and IEC 62288:2014 (5.5.6, 5.5.7). */
type Tgt = Scenario["targets"][number];
const ship = (id: number, brg: number, rng: number, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt =>
  ({ id, name: `Ship ${id}`, kind: "ship", pos: fromPolar(brg, rng), course, speed, rcs: 1, height: 20, events: [], ...extra });
const world = (targets: Tgt[], own = { heading: 0, speed: 12 }) =>
  createWorld({ id: "a", name: "a", description: "", own, env: { seaState: 0 }, coasts: [], targets }, 62);
const LIM = { cpaNm: 1, tcpaMin: 12 };
const run = (w: ReturnType<typeof world>, ais: AisSystem, seconds: number, dt = 1): void => {
  const end = w.time + seconds;
  while (w.time < end - 1e-9) {
    stepWorld(w, dt);
    ais.step(w);
  }
};

describe("IEC 62388 Table 27: Class A reporting intervals and lost target times", () => {
  it("reporting intervals", () => {
    expect(aisReportIntervalSec(0, true, false)).toBe(180); // at anchor
    expect(aisReportIntervalSec(2.5, true, false)).toBe(180); // at anchor, not faster than 3 kn
    expect(aisReportIntervalSec(4, true, false)).toBe(10); // at anchor but moving faster than 3 kn
    expect(aisReportIntervalSec(12, false, false)).toBe(10);
    expect(aisReportIntervalSec(12, false, true)).toBeCloseTo(10 / 3, 9);
    expect(aisReportIntervalSec(14, false, false)).toBe(10);
    expect(aisReportIntervalSec(18, false, false)).toBe(6);
    expect(aisReportIntervalSec(18, false, true)).toBe(2);
    expect(aisReportIntervalSec(30, false, false)).toBe(2);
  });
  it("lost target times", () => {
    expect(aisLostAfterSec(0, true)).toBe(18 * 60);
    expect(aisLostAfterSec(10, false)).toBe(60);
    expect(aisLostAfterSec(18, false)).toBe(36);
    expect(aisLostAfterSec(30, false)).toBe(30);
  });
  it("a ship at 30 kn reports every 2 s and is lost 30 s after its last report", () => {
    const w = world([ship(1, 45, 8, 180, 30)]);
    const ais = new AisSystem();
    run(w, ais, 1);
    ais.activate(1, w);
    run(w, ais, 5);
    expect(ais.reports.get(1)!.intervalSec).toBe(2);
    w.targets[0]!.ais = false;
    const last = ais.reports.get(1)!.time;
    run(w, ais, 30 - (w.time - last) - 1);
    expect(ais.targets(w, null, LIM)[0]!.lost).toBe(false);
    run(w, ais, 2);
    expect(ais.targets(w, null, LIM)[0]!.lost).toBe(true);
  });
});

describe("IEC 62288 5.5.7 and 5.5.11: rate of turn and the turn indicator", () => {
  it("a catalogue vessel turning reports its rate of turn; a plain target reports none", () => {
    const w = world([ship(1, 45, 6, 270, 10, { typeId: "general-cargo" }), ship(2, 300, 6, 90, 10)]);
    const ais = new AisSystem();
    run(w, ais, 20);
    expect(Math.abs(ais.reports.get(1)!.rot!)).toBeLessThan(0.5);
    expect(ais.reports.get(2)!.rot).toBeNull();
    // Order the catalogue ship to alter to starboard: while it turns, its rate of turn is positive and it reports
    // at the shorter interval for a vessel changing course (3 1/3 s at up to 14 kn).
    w.targets[0]!.motion!.orderedCourse = 330;
    run(w, ais, 20);
    const r = ais.reports.get(1)!;
    expect(r.rot!).toBeGreaterThan(2);
    expect(r.intervalSec).toBeCloseTo(10 / 3, 9);
  });
});

describe("IEC 62388 11.5.2 (Table 26) and IEC 62288 5.5.6: capacity and automatic activation", () => {
  it("20 targets can be activated; a caution comes at 19 and the 21st is refused with a warning", () => {
    expect(AIS_CAPACITY).toEqual({ activated: 20, total: 120 });
    const ships = Array.from({ length: 22 }, (_, i) => ship(i + 1, (i * 16) % 360, 8 + (i % 3), (i * 37) % 360, 10));
    const w = world(ships);
    const ais = new AisSystem();
    run(w, ais, 1);
    for (let id = 1; id <= 18; id++) expect(ais.activate(id, w)).toBe(true);
    ais.targets(w, null, { cpaNm: 0.01, tcpaMin: 1 });
    expect(ais.alarms.some((a) => a.key === "ais-cap-near-act")).toBe(false);
    ais.activate(19, w);
    ais.targets(w, null, { cpaNm: 0.01, tcpaMin: 1 });
    expect(ais.alarms.some((a) => a.key === "ais-cap-near-act")).toBe(true);
    expect(ais.activate(20, w)).toBe(true);
    expect(ais.activate(21, w)).toBe(false);
    expect(ais.activated.size).toBe(20);
    expect(ais.alarms.some((a) => a.key === "ais-cap-act")).toBe(true);
    ais.ack("ais-cap-act");
    expect(ais.alarms.some((a) => a.key === "ais-cap-act")).toBe(false);
  });

  it("sleeping targets within the set range are activated automatically", () => {
    const w = world([ship(1, 45, 5, 0, 12), ship(2, 300, 9, 0, 12)]);
    const ais = new AisSystem();
    ais.settings.autoActivateNm = 6;
    run(w, ais, 1);
    ais.targets(w, null, LIM);
    expect(ais.activated.has(1)).toBe(true);
    expect(ais.activated.has(2)).toBe(false);
  });

  it("a sleeping target in an acquisition zone is activated with a new target warning, when automatic acquisition is on", () => {
    const w = world([ship(1, 0, 5.8, 0, 12), ship(2, 90, 3, 0, 12)]);
    const a = new ArpaSystem(w);
    a.settings.autoAcquire = true;
    a.settings.guardZones = [{ on: true, innerNm: 5.5, outerNm: 6, fromRel: 300, toRel: 60 }];
    const ais = new AisSystem();
    run(w, ais, 1);
    ais.targets(w, a, LIM);
    expect(ais.activated.has(1)).toBe(true);
    expect(ais.activated.has(2)).toBe(false);
    expect(ais.alarms.filter((x) => x.key === "ais-new-1")).toHaveLength(1);
    ais.targets(w, a, LIM);
    expect(ais.alarms.filter((x) => x.key === "ais-new-1")).toHaveLength(1); // once only
  });
});

describe("IEC 62288 5.5.7.1: past positions of activated AIS targets", () => {
  it("true past positions lie on the target's track over the ground; relative ones on its relative track", () => {
    // Own ship 000 at 12 kn; target from 045 at 6 NM steering 270 at 10 kn. Positions one and two minutes ago.
    const w = world([ship(1, 45, 6, 270, 10)]);
    const ais = new AisSystem();
    run(w, ais, 1);
    ais.activate(1, w);
    run(w, ais, 300, 0.5);
    const tgt = w.targets[0]!;
    const tru = ais.pastPositions(w, 1, "true", 2, 1);
    expect(tru).toHaveLength(2);
    // One minute ago the target was 10/60 NM further east; own ship is where it is now. Samples are 30 s apart,
    // and the run-on position at a sample can be up to one reporting interval old, so allow 0.04 NM.
    const want1 = sub({ e: tgt.pos.e + 10 / 60, n: tgt.pos.n }, w.own.pos);
    expect(Math.hypot(tru[0]!.e - want1.e, tru[0]!.n - want1.n)).toBeLessThan(0.04);
    const rel = ais.pastPositions(w, 1, "relative", 2, 1);
    // Relative: one minute ago it was also 0.2 NM further north relative to own ship (own ship has run 12/60 NM north since).
    const want1r = { e: want1.e, n: want1.n + 12 / 60 };
    expect(Math.hypot(rel[0]!.e - want1r.e, rel[0]!.n - want1r.n)).toBeLessThan(0.04);
    expect(ais.pastPositions(w, 1, "off", 2, 1)).toEqual([]);
    ais.sleep(1);
    expect(ais.pastPositions(w, 1, "true", 2, 1)).toEqual([]); // sleeping targets have none
    expect(AIS_PAST_SAMPLE_SEC).toBe(30);
  });
});

describe("IEC 62388 11.9.2.1: the trial manoeuvre includes activated AIS targets", () => {
  it("an activated AIS target that the trial would not clear gives a trial warning; the warning goes when the trial clears it", () => {
    // The phase 1 worked example: CPA 0.54 NM. Trial of the present course and speed with limits of 1 NM and 30 min.
    const w = world([ship(1, 45, 6, 270, 10)]);
    const a = new ArpaSystem(w);
    const ais = new AisSystem();
    run(w, ais, 1);
    ais.activate(1, w);
    const lim = { cpaNm: 1, tcpaMin: 30 };
    a.settings.trial = { on: true, course: 0, speed: 12, delayMinutes: 0 };
    const v = ais.targets(w, a, lim)[0]!;
    expect(v.trial).toBeDefined();
    expect(v.trial!.result.cpa).toBeCloseTo(0.543, 2);
    expect(v.trial!.dangerous).toBe(true);
    expect(ais.alarms.some((x) => x.key === "ais-trial-1")).toBe(true);
    // A bold alteration to starboard, to 090, clears the target.
    a.settings.trial = { on: true, course: 90, speed: 12, delayMinutes: 0 };
    const v2 = ais.targets(w, a, lim)[0]!;
    expect(v2.trial!.dangerous).toBe(false);
    expect(ais.alarms.some((x) => x.key === "ais-trial-1")).toBe(false);
    a.settings.trial = { on: false, course: 90, speed: 12, delayMinutes: 0 };
    expect(ais.targets(w, a, lim)[0]!.trial).toBeUndefined();
  });
});

describe("IEC 62388 Table 27: Class B reporting intervals and lost target times", () => {
  it("carrier sense (CS) and self-organised (SO) stations", () => {
    // [speed kn, CS interval, CS lost, SO interval, SO lost], read from the table.
    const rows = [[1, 180, 1080, 180, 1080], [2, 180, 1080, 180, 1080], [10, 30, 180, 30, 180], [14, 30, 180, 30, 180], [18, 30, 180, 15, 90], [23, 30, 180, 15, 90], [30, 30, 180, 5, 30]] as const;
    for (const [sog, csIv, csLost, soIv, soLost] of rows) {
      expect(aisClassBIntervalSec(sog, "B-CS")).toBe(csIv);
      expect(aisClassBLostAfterSec(sog, "B-CS")).toBe(csLost);
      expect(aisClassBIntervalSec(sog, "B-SO")).toBe(soIv);
      expect(aisClassBLostAfterSec(sog, "B-SO")).toBe(soLost);
    }
  });
  it("a small craft with AIS reports as class B every 30 s, and sends no status, rate of turn, IMO number or voyage data", () => {
    const w = world([{ ...ship(1, 45, 3, 180, 8), kind: "small-craft", ais: true, aisStatic: { destination: "HARBOUR" } }]);
    const ais = new AisSystem();
    run(w, ais, 1);
    const r0 = ais.reports.get(1)!;
    expect(r0.cls).toBe("B-CS");
    expect([r0.navStatus, r0.rot, r0.imo, r0.destination, r0.eta, r0.draughtM]).toEqual(["", null, null, null, null, null]);
    expect(r0.posAccuracy).toBe("low");
    run(w, ais, 29);
    expect(ais.reports.get(1)!.time).toBe(r0.time);
    run(w, ais, 1.5);
    expect(ais.reports.get(1)!.time).toBeGreaterThan(r0.time);
    expect(ais.reports.get(1)!.lostAfterSec).toBe(180);
  });
});

describe("IEC 62388 11.6.1: further AIS data on request, MISSING where it is not sent", () => {
  it("a class A ship sends an IMO number with a valid check digit, its type, and the voyage data the scenario gives", () => {
    // Check digit worked independently: digits 1 to 6 times 7, 6, 5, 4, 3, 2; the last digit of the sum.
    // The textbook example 9074729: 9x7 + 0x6 + 7x5 + 4x4 + 7x3 + 2x2 = 139, so the check digit is 9.
    const check = (imo: string): boolean => [7, 6, 5, 4, 3, 2].reduce((s, k, i) => s + k * Number(imo[i]), 0) % 10 === Number(imo[6]);
    expect(check("9074729")).toBe(true);
    for (const id of [1, 2, 7, 33, 120]) {
      expect(simulatedImo(id)).toMatch(/^9\d{6}$/);
      expect(check(simulatedImo(id))).toBe(true);
    }
    const w = world([
      ship(1, 45, 8, 180, 12, { typeId: "bulk-handy", aisStatic: { destination: "Rotterdam", eta: "14 NOV 1530 UTC", draughtM: 9.4 } }),
      ship(2, 90, 8, 270, 12, { aisStatic: { imo: null, navStatus: null } }),
    ]);
    const ais = new AisSystem();
    run(w, ais, 1);
    const a = ais.reports.get(1)!;
    expect([a.cls, a.shipType, a.destination, a.eta, a.draughtM, a.lengthM, a.posAccuracy]).toEqual(["A", "Cargo", "Rotterdam", "14 NOV 1530 UTC", 9.4, 170, "high"]);
    expect(a.imo).toBe(simulatedImo(1));
    const b = ais.reports.get(2)!;
    expect([b.imo, b.navStatus, b.destination, b.eta, b.draughtM, b.shipType]).toEqual([null, "", null, null, null, "Cargo"]);
  });
  it("own ship's AIS data: position, COG and SOG over the ground, heading", () => {
    const w = world([], { heading: 90, speed: 10 });
    const o = ownShipAisData(w);
    expect([o.cls, o.cog, o.heading]).toEqual(["A", 90, 90]);
    expect(o.sog).toBeCloseTo(10, 9);
    expect(o.navStatus).toBe("Under way using engine");
  });
});

describe("IEC 62388 11.5.3: filter for sleeping AIS targets", () => {
  // Own ship 000 at 12 kn. Ship 1: 8 NM ahead, coming down at 10 kn (CPA 0, TCPA 21.8 min).
  // Ship 2: 2 NM on the beam, same course and speed (never closes: CPA undefined, opening).
  // Ship 3: 4 NM at 045, stopped (CPA 2.83 NM at 045 x 4 sin 45 = ... worked below). Ship 4: class B, 3 NM at 300, 6 kn, heading 120.
  const setup = () => {
    const w = world([
      ship(1, 0, 8, 180, 10), ship(2, 90, 2, 0, 12), ship(3, 45, 4, 0, 0),
      { ...ship(4, 300, 3, 120, 6), kind: "small-craft", ais: true },
    ]);
    const ais = new AisSystem();
    run(w, ais, 1);
    const views = new Map(ais.targets(w, null, LIM).map((v) => [v.report.id, v]));
    return { w, ais, views };
  };
  const hidden = (views: Map<number, ReturnType<AisSystem["targets"]>[number]>, f: typeof AIS_FILTER_OFF, sel: number | null = null): number[] =>
    [...views.values()].filter((v) => aisFilteredOut(v, f, sel)).map((v) => v.report.id).sort();

  it("by range, by CPA/TCPA and by speed; a class alone does not filter", () => {
    const { views } = setup();
    expect(aisFilterOn(AIS_FILTER_OFF)).toBe(false);
    expect(hidden(views, AIS_FILTER_OFF)).toEqual([]);
    expect(hidden(views, { ...AIS_FILTER_OFF, rangeNm: 3.5 })).toEqual([1, 3]);
    // Ship 3 (stopped, 4 NM at 045 while own ship runs north): CPA = 4 sin 45 = 2.83 NM, at 4 cos 45 / 12 h = 14.1 min.
    // Ship 2 keeps station on the beam: no CPA, so it counts as not closing.
    expect(hidden(views, { ...AIS_FILTER_OFF, cpaNm: 2 })).toEqual([2, 3]);
    expect(hidden(views, { ...AIS_FILTER_OFF, cpaNm: 3 })).toEqual([2]);
    expect(hidden(views, { ...AIS_FILTER_OFF, tcpaMin: 12 })).toEqual([1, 2, 3]);
    expect(hidden(views, { ...AIS_FILTER_OFF, tcpaMin: 20 })).toEqual([1, 2]);
    expect(hidden(views, { ...AIS_FILTER_OFF, minSpeedKn: 0.5 })).toEqual([3]);
    // Class B only: the class narrows the other criteria; alone it does nothing.
    expect(aisFilterOn({ ...AIS_FILTER_OFF, classes: "B" })).toBe(false);
    expect(hidden(views, { ...AIS_FILTER_OFF, classes: "B" })).toEqual([]);
    expect(hidden(views, { ...AIS_FILTER_OFF, classes: "B", rangeNm: 1 })).toEqual([4]);
    expect(aisFilterLabel({ ...AIS_FILTER_OFF, classes: "B", rangeNm: 6, cpaNm: 2 })).toBe("RNG>6 CPA>2 CLASS B ONLY");
  });
  it("activated, dangerous, lost and selected targets are always drawn", () => {
    const { w, ais, views } = setup();
    const f = { ...AIS_FILTER_OFF, rangeNm: 1 };
    expect(hidden(views, f)).toEqual([1, 2, 3, 4]);
    expect(hidden(views, f, 2)).toEqual([1, 3, 4]); // the selected target
    ais.activate(3, w);
    const v2 = new Map(ais.targets(w, null, LIM).map((v) => [v.report.id, v]));
    expect(hidden(v2, f)).toEqual([1, 2, 4]);
    // With a CPA limit of 1 NM over 30 minutes ship 1 is dangerous (CPA 0), and dangerous targets are activated and drawn.
    const v3 = new Map(ais.targets(w, null, { cpaNm: 1, tcpaMin: 30 }).map((v) => [v.report.id, v]));
    expect(v3.get(1)!.dangerous).toBe(true);
    expect(hidden(v3, f)).toEqual([2, 4]);
  });
});
