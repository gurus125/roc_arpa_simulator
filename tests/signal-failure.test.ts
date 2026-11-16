import { describe, expect, it } from "vitest";
import { sub } from "../src/core/vec";
import { OPEN_SEA, createWorld, radarSignalsLostText, stepWorld } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaSystem } from "../src/arpa/index";
import { AisSystem } from "../src/ais/index";
import { advance, createApp } from "../src/ui/app";
import { alertRows } from "../src/ui/alerts-view";
import { arpaStatusLines } from "../src/ui/arpa-view";

/*
 * IMO MSC.192(79) 5.34: "a means should be provided to alert the user of picture freeze", and the failure of any
 * signal in use, "including gyro, log, azimuth, video, sync and heading marker", is alarmed. Section 9.5: without
 * radar signals the equipment shows the AIS targets, and a frozen radar picture is not displayed.
 * The simulator's fall-back is the same for the four radar signals: no radar picture, no plots for the tracker.
 */

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};

describe("a radar signal lost", () => {
  it("the failed signals are named in a fixed order", () => {
    expect(radarSignalsLostText({ radarSignalsLost: [] } as never)).toBe("");
    expect(radarSignalsLostText({} as never)).toBe("");
    expect(radarSignalsLostText({ radarSignalsLost: ["heading-marker", "video"] } as never)).toBe("VIDEO, HEADING MARKER");
    expect(radarSignalsLostText({ radarSignalsLost: ["azimuth", "sync"] } as never)).toBe("SYNC (TRIGGER), AZIMUTH");
  });

  it("the tracker gets no plots: every target is lost after the scans it may coast, and the failure is alarmed", () => {
    const w = createWorld(OPEN_SEA, 62);
    w.radar.controls.tuning = 62;
    const a = new ArpaSystem(w);
    const rng = seeded(3);
    a.step(w, rng);
    const t = a.acquire(w, sub(w.targets[0]!.pos, w.own.pos))!;
    while (w.time < 200) {
      stepWorld(w, 0.5);
      a.step(w, rng);
    }
    expect(t.state).toBe("tracking");
    expect(a.alarms.some((x) => x.key === "signalfail")).toBe(false);
    w.sensors.radarSignalsLost = ["video"];
    const lostAt = w.time;
    // One scan takes 60 / rpm seconds; the target is lost after lostAfterMissedScans scans without a plot.
    const scans = ARPA_PLACEHOLDERS.lostAfterMissedScans + 2;
    while (w.time < lostAt + scans * (60 / w.radar.rpm)) {
      stepWorld(w, 0.5);
      a.step(w, rng);
    }
    expect(t.state).toBe("lost");
    const al = a.alarms.find((x) => x.key === "signalfail")!;
    expect(al.text).toContain("RADAR SIGNAL LOST: VIDEO");
    expect(al.kind).toBe("malfunction");
    // A second signal fails: the same alert names both. The signals come back: the alert goes.
    w.sensors.radarSignalsLost = ["video", "azimuth"];
    stepWorld(w, 0.5);
    a.step(w, rng);
    expect(a.alarms.find((x) => x.key === "signalfail")!.text).toContain("VIDEO, AZIMUTH");
    w.sensors.radarSignalsLost = [];
    stepWorld(w, 0.5);
    a.step(w, rng);
    expect(a.alarms.some((x) => x.key === "signalfail")).toBe(false);
  });

  it("the AIS targets are still shown (MSC.192(79) 9.5)", () => {
    const w = createWorld(OPEN_SEA, 62);
    const ais = new AisSystem();
    w.sensors.radarSignalsLost = ["video", "sync"];
    stepWorld(w, 1);
    ais.step(w);
    expect(ais.targets(w, null, { cpaNm: 1, tcpaMin: 12 }).length).toBeGreaterThan(0);
  });

  it("on the display no echo is painted and what was there fades out; a frozen picture is never left", () => {
    const app = createApp(OPEN_SEA, 62);
    const rng = seeded(9);
    for (let i = 0; i < 60; i++) advance(app, 0.1, rng); // 6 s: more than two turns of the aerial
    expect(app.hits.length).toBeGreaterThan(0);
    app.world.sensors.radarSignalsLost = ["sync"];
    for (let i = 0; i < 40; i++) advance(app, 0.1, rng); // 4 s: longer than an echo stays on the screen
    expect(app.hits.length).toBe(0);
    expect(arpaStatusLines(app).some((l) => l.text === "RADAR SIGNAL LOST: SYNC (TRIGGER)")).toBe(true);
    expect(alertRows(app).some((r) => r.key === "signalfail")).toBe(true);
    app.world.sensors.radarSignalsLost = [];
    for (let i = 0; i < 40; i++) advance(app, 0.1, rng);
    expect(app.hits.length).toBeGreaterThan(0);
    expect(alertRows(app).some((r) => r.key === "signalfail")).toBe(false);
  });
});

describe("picture freeze", () => {
  it("the echoes stay where they were on the screen, nothing is added, and the alert is given", () => {
    const app = createApp(OPEN_SEA, 62);
    const rng = seeded(4);
    for (let i = 0; i < 60; i++) advance(app, 0.1, rng);
    app.world.sensors.pictureFrozen = true;
    advance(app, 0.1, rng);
    const n = app.hits.length;
    expect(n).toBeGreaterThan(0);
    const first = app.hits[0]!;
    const offset = sub(first.hit.pos, app.world.own.pos);
    const age = app.wall - first.born;
    for (let i = 0; i < 100; i++) advance(app, 0.1, rng); // 10 s: own ship at 12 kn has moved 0.033 NM
    expect(app.hits.length).toBe(n);
    expect(app.hits[0]).toBe(first);
    const now = sub(first.hit.pos, app.world.own.pos);
    expect(now.e).toBeCloseTo(offset.e, 9);
    expect(now.n).toBeCloseTo(offset.n, 9);
    expect(app.wall - first.born).toBeCloseTo(age, 6);
    expect(alertRows(app).some((r) => r.key === "picturefreeze")).toBe(true);
    expect(arpaStatusLines(app).some((l) => l.text === "PICTURE FREEZE")).toBe(true);
    // Unfrozen: the old echoes fade and the picture is painted again.
    app.world.sensors.pictureFrozen = false;
    for (let i = 0; i < 60; i++) advance(app, 0.1, rng);
    expect(app.hits.includes(first)).toBe(false);
    expect(app.hits.length).toBeGreaterThan(0);
    expect(alertRows(app).some((r) => r.key === "picturefreeze")).toBe(false);
  });
});
