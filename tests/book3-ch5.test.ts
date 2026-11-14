import { describe, expect, it } from "vitest";
import { AIS_RANGE_NM, AisSystem, aisClassBIntervalSec, aisReportIntervalSec } from "../src/ais/index";
import { Scenario, World, createWorld, landHides, orderTarget, stepWorld } from "../src/engine/index";

/*
 * Radar and ARPA Manual, 3rd edition (Bole, Wall, Norris, 2014), chapter 5: AIS. Expected values are the
 * book's own figures. See docs/BOOK-CHECK-RADAR-ARPA-MANUAL.md.
 */

const world = (targets: Scenario["targets"], coasts: Scenario["coasts"] = []): World =>
  createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts, targets }, 62);

describe("Table 5.1: dynamic data reporting intervals", () => {
  it("Class A: at anchor 3 min; 0-14 kn 10 s (3.3 s turning); 14-23 kn 6 s (2 s turning); over 23 kn 2 s", () => {
    expect(aisReportIntervalSec(0, true, false)).toBe(180);
    expect(aisReportIntervalSec(10, false, false)).toBe(10);
    expect(aisReportIntervalSec(10, false, true)).toBeCloseTo(3.33, 2);
    expect(aisReportIntervalSec(18, false, false)).toBe(6);
    expect(aisReportIntervalSec(18, false, true)).toBe(2);
    expect(aisReportIntervalSec(30, false, false)).toBe(2);
  });
  it("Class B: under 2 kn 3 min; over 2 kn 30 s", () => {
    expect(aisClassBIntervalSec(1, "B-CS")).toBe(180);
    expect(aisClassBIntervalSec(8, "B-CS")).toBe(30);
  });
});

describe("5.3.2: Class B sends no rate of turn and no navigational status", () => {
  it("a Class B report has neither", () => {
    const w = world([{ id: 1, name: "yacht", kind: "small-craft", ais: true, aisClass: "B-CS", pos: { e: 1, n: 1 }, course: 0, speed: 5, rcs: 0.05, height: 3, events: [] }]);
    const ais = new AisSystem();
    ais.step(w);
    const r = ais.reports.get(1)!;
    expect(r.rot).toBeNull();
    expect(r.navStatus).toBe("");
  });
});

describe("Table 5.4: range of AIS", () => {
  it("typically 20 to 40 NM for Class A and 10 NM for Class B", () => {
    expect(AIS_RANGE_NM.A).toBeGreaterThanOrEqual(20);
    expect(AIS_RANGE_NM.A).toBeLessThanOrEqual(40);
    expect(AIS_RANGE_NM.B).toBe(10);
  });
  it("a Class B vessel 12 NM off is not received; a Class A ship there is", () => {
    const w = world([
      { id: 1, name: "yacht", kind: "small-craft", ais: true, aisClass: "B-CS", pos: { e: 0, n: 12 }, course: 0, speed: 5, rcs: 0.05, height: 3, events: [] },
      { id: 2, name: "ship", kind: "ship", ais: true, pos: { e: 0, n: -12 }, course: 0, speed: 10, rcs: 1, height: 20, events: [] },
    ]);
    const ais = new AisSystem();
    ais.step(w);
    expect(ais.reports.has(1)).toBe(false);
    expect(ais.reports.has(2)).toBe(true);
  });
});

describe("5.5.2: AIS reaches round land that hides a ship from the radar (the fjord effect)", () => {
  it("a ship behind a headland is hidden from the radar but its AIS is received", () => {
    const w = world(
      [{ id: 1, name: "ship", kind: "ship", ais: true, pos: { e: 0, n: 6 }, course: 180, speed: 10, rcs: 1, height: 20, events: [] }],
      [{ name: "headland", closed: true, heightM: 120, points: [{ e: -2, n: 2.5 }, { e: 2, n: 2.5 }, { e: 2, n: 3.5 }, { e: -2, n: 3.5 }] }],
    );
    expect(landHides(w, w.targets[0]!.pos, 20)).toBe(true);
    const ais = new AisSystem();
    ais.step(w);
    expect(ais.reports.has(1)).toBe(true);
  });
});

describe("Table 5.4: a change of course shows on AIS at once, from the target's compass", () => {
  it("the reported heading starts to change within seconds of the target putting her helm over", () => {
    const w = world([{ id: 1, name: "ship", kind: "ship", typeId: "general-cargo", ais: true, pos: { e: 0, n: 6 }, course: 180, speed: 12, rcs: 1, height: 20, events: [] }]);
    const ais = new AisSystem();
    for (let i = 0; i < 20; i++) {
      stepWorld(w, 0.5);
      ais.step(w);
    }
    orderTarget(w.targets[0]!, { course: 270 });
    for (let i = 0; i < 24; i++) {
      stepWorld(w, 0.5);
      ais.step(w);
    }
    // 12 s later: the heading has moved off 180 and the rate of turn is reported.
    expect(Math.abs(ais.reports.get(1)!.heading - 180)).toBeGreaterThan(2);
    expect(Math.abs(ais.reports.get(1)!.rot ?? 0)).toBeGreaterThan(0);
  });
});
