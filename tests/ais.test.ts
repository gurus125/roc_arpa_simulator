import { describe, expect, it } from "vitest";
import { fromPolar, sub } from "../src/core/vec";
import { Scenario, createWorld, raconSegments, scanWedge, stepWorld, SAR, SART_DOT_SPACING_NM, newDisplayState, worldToDisplayNm, displayNmToWorld, RADAR_RANGES, ringInterval } from "../src/engine/index";
import { ArpaSystem } from "../src/arpa/index";
import { AisSystem } from "../src/ais/index";

type Tgt = Scenario["targets"][number];
const ship = (id: number, brg: number, rng: number, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt => ({ id, name: `Ship ${id}`, kind: "ship", pos: fromPolar(brg, rng), course, speed, rcs: 1, height: 20, events: [], ...extra });
const world = (targets: Tgt[]) => createWorld({ id: "a", name: "a", description: "", own: { heading: 0, speed: 12 }, env: { seaState: 0 }, coasts: [], targets }, 62);
const LIM = { cpaNm: 1, tcpaMin: 12 };
const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); };

describe("AIS reported targets", () => {
  it("ships report; buoys and small craft do not; reports come every 10 s under way", () => {
    const w = world([ship(1, 45, 6, 270, 10), { ...ship(2, 90, 3, 0, 0), kind: "buoy" }, { ...ship(3, 200, 2, 0, 5), kind: "small-craft" }]);
    const ais = new AisSystem();
    const times: number[] = [];
    for (let i = 0; i < 35; i++) {
      stepWorld(w, 1);
      ais.step(w);
      const t = ais.reports.get(1)!.time;
      if (times[times.length - 1] !== t) times.push(t);
    }
    expect([...ais.reports.keys()]).toEqual([1]);
    expect(times).toEqual([1, 11, 21, 31]);
  });

  it("CPA and TCPA of the phase 1 worked example (0.543 NM in 22.95 min), from the reported data", () => {
    const w = world([ship(1, 45, 6, 270, 10)]);
    const ais = new AisSystem();
    ais.step(w);
    const v = ais.targets(w, null, LIM)[0]!;
    expect(v.cpa.cpa).toBeCloseTo(0.54321, 4);
    expect(v.cpa.tcpaMinutes!).toBeCloseTo(22.952, 2);
    expect(v.state).toBe("sleeping");
  });

  it("between reports the position is run on at the reported course and speed", () => {
    const w = world([ship(1, 90, 5, 0, 12)]);
    const ais = new AisSystem();
    ais.step(w);
    for (let i = 0; i < 5; i++) stepWorld(w, 1); // no new report: 5 s < 10 s (fast is 14 kn)
    const v = ais.targets(w, null, LIM)[0]!;
    expect(v.ageSec).toBeCloseTo(5, 9);
    // 12 kn for 5 s = 1/60 NM north of the reported position.
    expect(v.pos.n - v.report.pos.n).toBeCloseTo(12 * 5 / 3600, 9);
  });

  it("a dangerous sleeping target is activated and alarmed with the ARPA limits", () => {
    const w = world([ship(1, 45, 6, 270, 10)]);
    const ais = new AisSystem();
    ais.step(w);
    expect(ais.targets(w, null, { cpaNm: 1, tcpaMin: 30 })[0]!.dangerous).toBe(true);
    expect(ais.activated.has(1)).toBe(true);
    expect(ais.alarms[0]!.text).toContain("DANGEROUS AIS TARGET SHIP 1");
    ais.targets(w, null, LIM); // TCPA 23 min is outside 12 min: the alarm clears
    expect(ais.alarms.length).toBe(0);
  });

  it("when a ship's AIS stops, an activated target at 10 kn is reported LOST after 60 s (IEC 62388 Table 27)", () => {
    const w = world([ship(1, 45, 6, 270, 10)]);
    const ais = new AisSystem();
    ais.step(w);
    ais.activate(1);
    w.targets[0]!.ais = false;
    for (let i = 0; i < 59; i++) { stepWorld(w, 1); ais.step(w); }
    expect(ais.targets(w, null, LIM)[0]!.lost).toBe(false);
    for (let i = 0; i < 3; i++) { stepWorld(w, 1); ais.step(w); }
    expect(ais.targets(w, null, LIM)[0]!.lost).toBe(true);
    expect(ais.alarms.some((a) => a.key === "ais-lost-1")).toBe(true);
    ais.ack("ais-lost-1");
    expect(ais.reports.size).toBe(0);
  });

  it("an AIS target is associated with the radar track of the same ship, not with another ship", () => {
    const w = world([ship(1, 45, 6, 270, 10), ship(2, 300, 5, 90, 8, { ais: false })]);
    w.radar.shadowSectors = [];
    const a = new ArpaSystem(w);
    const ais = new AisSystem();
    const rng = seeded(5);
    a.step(w, rng);
    const t1 = a.acquire(w, sub(w.targets[0]!.pos, w.own.pos))!;
    a.acquire(w, sub(w.targets[1]!.pos, w.own.pos));
    while (w.time < 200) { stepWorld(w, 0.5); a.step(w, rng); ais.step(w); }
    const views = ais.targets(w, a, LIM);
    expect(views.length).toBe(1);
    expect(views[0]!.associatedTrack).toBe(t1.id);
  });
});

describe("radar: range scales, off-centring, racon and SART", () => {
  it("has the eight IMO range scales with sensible rings", () => {
    expect([...RADAR_RANGES]).toEqual([0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24, 48, 96]);
    expect(ringInterval(0.25)).toBe(0.05);
    expect(ringInterval(0.75)).toBe(0.25);
  });

  it("off-centring moves own ship on the screen and the cursor conversion follows", () => {
    const w = world([]);
    const ds = newDisplayState(w);
    ds.offCentre = { x: -2, y: -3 };
    const p = worldToDisplayNm(w, ds, { e: 1, n: 4 });
    expect(p.x).toBeCloseTo(-1, 9);
    expect(p.y).toBeCloseTo(1, 9);
    const back = displayNmToWorld(w, ds, p.x, p.y);
    expect(back.e).toBeCloseTo(1, 9);
    expect(back.n).toBeCloseTo(4, 9);
  });

  it("Morse K (dash dot dash) fills the 2 NM response: dash 3 units, dot 1, gaps 1 (9 units of 2/9 NM), starting 60 m out", () => {
    // Book 3rd edition 3.5.2: a racon response is 20-40 microseconds, 1.5 to 3 NM; a dash is three dots, a gap one dot.
    const u = 2 / 9, d0 = 60 / 1852;
    const want = [[d0, d0 + 3 * u], [d0 + 4 * u, d0 + 5 * u], [d0 + 6 * u, d0 + 9 * u]];
    raconSegments("-.-").forEach((s, i) => {
      expect(s.from).toBeCloseTo(want[i]![0]!, 9);
      expect(s.to).toBeCloseTo(want[i]![1]!, 9);
    });
  });

  it("a SART paints 12 dots 0.64 NM apart outward from its position, on X band only", () => {
    const w = createWorld(SAR, 62);
    w.radar.controls.rangeNm = 24;
    const sart = w.targets[0]!;
    const range0 = Math.hypot(sart.pos.e, sart.pos.n);
    const dots = scanWedge(w, 0, 359.9, () => 0.5).filter((h) => h.kind === "sart").map((h) => Math.hypot(h.pos.e, h.pos.n)).sort((a, b) => a - b);
    expect(dots.length).toBe(12);
    // The first dot is 60 m beyond the craft (the time the SART takes to answer): the craft lies slightly closer.
    dots.forEach((d, i) => expect(d).toBeCloseTo(range0 + 60 / 1852 + i * SART_DOT_SPACING_NM, 6));
    w.radar.band = "S";
    expect(scanWedge(w, 0, 359.9, () => 0.5).some((h) => h.kind === "sart" || h.kind === "racon")).toBe(false);
  });

  it("a racon answers for part of the time only", () => {
    const w = createWorld(SAR, 62);
    w.radar.controls.rangeNm = 12;
    expect(scanWedge(w, 0, 359.9, () => 0.5).some((h) => h.kind === "racon")).toBe(true);
    w.time = 30;
    expect(scanWedge(w, 0, 359.9, () => 0.5).some((h) => h.kind === "racon")).toBe(false);
  });
});

describe("IEC 62388 11.5.3.1: reports repeated by an AIS shore station", () => {
  it("test g): own ship's repeats and the delayed repeats of a 24 kn target are not displayed and give no CPA/TCPA or alarms", () => {
    const w = world([ship(1, 45, 2, 270, 24)]);
    const ais = new AisSystem();
    ais.shoreRepeat = { on: true, delaySec: 30, intervalSec: 10 };
    let worstAge = 0;
    for (let i = 0; i < 300; i++) {
      stepWorld(w, 1);
      ais.step(w);
      const views = ais.targets(w, null, LIM);
      expect(views.map((v) => v.report.id)).toEqual([1]); // own ship never appears
      worstAge = Math.max(worstAge, w.time - views[0]!.report.time);
    }
    // Direct reports of a vessel faster than 23 kn come every 2 s; a repeated one would be 30 s old or more.
    expect(worstAge).toBeLessThanOrEqual(2 + 1e-9);
    const st = ais.repeatStats;
    expect(st.received).toBeGreaterThan(40);
    expect(st.used).toBe(0);
    expect(st.ownIgnored).toBeGreaterThanOrEqual(26);
    expect(st.ignored).toBe(st.received);
    expect(ais.alarms).toEqual([]);
  });

  it("a repeated report is used for a vessel heard only through the shore station, and an older one never replaces a newer", () => {
    const w = world([ship(1, 45, 2, 270, 24)]);
    const ais = new AisSystem();
    stepWorld(w, 1);
    ais.step(w);
    const direct = ais.reports.get(1)!;
    // Vessel 9 is out of direct range: only the station's repeat of it is received.
    ais.receiveRepeated(w, { ...direct, id: 9, mmsi: "419099999", name: "FAR AWAY", time: w.time - 30 });
    expect(ais.reports.get(9)!.name).toBe("FAR AWAY");
    expect(ais.repeatStats.used).toBe(1);
    ais.receiveRepeated(w, { ...direct, time: direct.time - 30, pos: { e: 50, n: 50 } });
    expect(ais.reports.get(1)!.pos).toEqual(direct.pos);
    expect(ais.repeatStats.ignored).toBe(1);
  });
});
