import { describe, expect, it } from "vitest";
import { fromPolar } from "../src/core/vec";
import { Scenario, createWorld, stepWorld } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import { AisSystem } from "../src/ais/index";
import { ARPA_EXERCISES, ArpaExSession, PLOTTING_EXERCISES, RADAR_EXERCISES } from "../src/train/index";
import { aisLocked, createApp } from "../src/ui/app";

/*
 * The AIS display has its own key and does not depend on the ARPA (IMO MSC.192(79) 5.26.3: no single AIS target is
 * taken off the display; the AIS display and the ARPA have separate status indications). Manual plotting exercises
 * lock the AIS display off, because their targets transmit AIS and its course, speed and CPA would make the plot
 * pointless.
 */

type Tgt = Scenario["targets"][number];
const ship = (id: number, brg: number, rng: number, course: number, speed: number): Tgt =>
  ({ id, name: `Ship ${id}`, kind: "ship", pos: fromPolar(brg, rng), course, speed, rcs: 1, height: 20, events: [] });
const world = (targets: Tgt[], own = { heading: 0, speed: 12 }) =>
  createWorld({ id: "a", name: "a", description: "", own, env: { seaState: 0 }, coasts: [], targets }, 62);
const LIM = { cpaNm: 1, tcpaMin: 12 };
const run = (w: ReturnType<typeof world>, ais: AisSystem, seconds: number): void => {
  const end = w.time + seconds;
  while (w.time < end - 1e-9) {
    stepWorld(w, 1);
    ais.step(w);
  }
};

describe("AIS targets with the ARPA in standby", () => {
  it("are all still given to the display", () => {
    const w = world([ship(1, 0, 5.8, 0, 12), ship(2, 90, 3, 0, 12)]);
    const a = new ArpaSystem(w);
    a.settings.standby = true;
    const ais = new AisSystem();
    run(w, ais, 1);
    expect(ais.targets(w, a, LIM).map((v) => v.report.id).sort()).toEqual([1, 2]);
  });

  it("are not activated by the ARPA's acquisition zones, which are not working in standby", () => {
    // The same zone and target as the IEC 62388 11.5 check in ais-iec.test.ts, where the ARPA is on and it is activated.
    const w = world([ship(1, 0, 5.8, 0, 12)]);
    const a = new ArpaSystem(w);
    a.settings.autoAcquire = true;
    a.settings.guardZones = [{ on: true, innerNm: 5.5, outerNm: 6, fromRel: 300, toRel: 60 }];
    a.settings.standby = true;
    const ais = new AisSystem();
    ais.settings.autoActivateNm = null;
    run(w, ais, 1);
    ais.targets(w, a, LIM);
    expect(ais.activated.has(1)).toBe(false);
    expect(ais.alarms.some((x) => x.key === "ais-new-1")).toBe(false);
    // Switch the ARPA on: the zone works again.
    a.settings.standby = false;
    ais.targets(w, a, LIM);
    expect(ais.activated.has(1)).toBe(true);
  });

  it("still raise the dangerous target alarm", () => {
    // Own ship 000 at 12 kn; a ship dead ahead at 2 NM steering 180 at 10 kn: CPA 0 in 2 / 22 h = 5.45 min, inside 1 NM and 12 min.
    const w = world([ship(1, 0, 2, 180, 10)]);
    const a = new ArpaSystem(w);
    a.settings.standby = true;
    const ais = new AisSystem();
    run(w, ais, 1);
    const v = ais.targets(w, a, LIM)[0]!;
    expect(v.cpa.cpa).toBeCloseTo(0, 3);
    expect(v.cpa.tcpaMinutes!).toBeCloseTo((2 / 22) * 60 - 1 / 60, 1);
    expect(v.dangerous).toBe(true);
    expect(ais.alarms.some((x) => x.key === "ais-cpa-1")).toBe(true);
  });

  it("are not given a trial manoeuvre: the ARPA's trial is not running in standby", () => {
    const w = world([ship(1, 45, 4, 270, 10)]);
    const a = new ArpaSystem(w);
    a.settings.trial = { on: true, course: 90, speed: 12, delayMinutes: 0 };
    const ais = new AisSystem();
    run(w, ais, 1);
    ais.activate(1, w);
    expect(ais.targets(w, a, LIM)[0]!.trial).toBeDefined();
    a.settings.standby = true;
    expect(ais.targets(w, a, LIM)[0]!.trial).toBeUndefined();
  });
});

describe("manual plotting exercises lock the AIS display off", () => {
  it("every plotting exercise has the AIS display off; no ARPA or radar exercise does", () => {
    expect(PLOTTING_EXERCISES.length).toBeGreaterThan(0);
    for (const e of PLOTTING_EXERCISES) expect(e.aisOff).toBe(true);
    for (const e of [...ARPA_EXERCISES, ...RADAR_EXERCISES]) expect(e.aisOff).toBeFalsy();
  });

  it("the briefing tells the student", () => {
    for (const e of PLOTTING_EXERCISES) expect(e.briefing.join(" ")).toMatch(/AIS display/);
  });

  it("it is needed: the plotted ships transmit AIS", () => {
    const e = PLOTTING_EXERCISES[0]!;
    const w = createWorld(e.scenario, 62);
    const ais = new AisSystem();
    ais.step(w);
    expect(ais.reports.size).toBe(e.scenario.targets.length);
  });

  it("the lock holds while the exercise runs and is released when it is finished", () => {
    const e = PLOTTING_EXERCISES[0]!;
    const app = createApp(e.scenario, 62);
    expect(aisLocked(app)).toBe(false);
    app.arpaEx = new ArpaExSession(e, app.world, app.arpa);
    expect(aisLocked(app)).toBe(true);
    app.arpaEx.finish(app.world, app.arpa);
    expect(aisLocked(app)).toBe(false);
    // An ARPA exercise does not lock it.
    const other = ARPA_EXERCISES[0]!;
    const app2 = createApp(other.scenario, 62);
    app2.arpaEx = new ArpaExSession(other, app2.world, app2.arpa);
    expect(aisLocked(app2)).toBe(false);
  });
});
