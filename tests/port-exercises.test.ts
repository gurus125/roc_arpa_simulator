import { describe, expect, it } from "vitest";
import { ArpaSystem } from "../src/arpa/index";
import { courseSpeedOf, length, rotateVec, scale, sub } from "../src/core/vec";
import { latLonOf } from "../src/core/nav";
import { GOA_ORIGIN, MUMBAI_ORIGIN, World, createWorld, letGoAnchor, scanWedge, stepWorld } from "../src/engine/index";
import { GOA_ANCHOR, GOA_PI_NM, MALABAR_POINT, MORMUGAO_POINT, PORT_EXERCISES } from "../src/train/port-exercises";
import { ArpaExSession, ArpaExercise, NumberTask, TaskCtx } from "../src/train/session";

/**
 * The four exercises in the real areas (radar 23 to 26). Every expected value below was worked
 * independently (Python, plane sailing and vector triangles), not read from the code under test.
 */
const ex = (id: string): ArpaExercise => PORT_EXERCISES.find((e) => e.id === id)!;
const numberTask = (e: ArpaExercise, id: string): NumberTask => e.tasks.find((t) => t.id === id && t.kind === "number") as NumberTask;
function start(e: ArpaExercise): { w: World; a: ArpaSystem; s: ArpaExSession; c: () => TaskCtx } {
  const w = createWorld(e.scenario, 62);
  const a = new ArpaSystem(w);
  const s = new ArpaExSession(e, w, a);
  return { w, a, s, c: () => s.ctx(w, a) };
}
const minutes = (deg: number): number => (deg - Math.floor(deg)) * 60;
const acquire = (w: World, a: ArpaSystem, id: number): void => {
  const t = w.targets.find((x) => x.id === id)!;
  a.acquire(w, rotateVec(sub(t.pos, w.own.pos), w.sensors.gyroErrorDeg));
};
function run(w: World, a: ArpaSystem, s: ArpaExSession, seconds: number, each?: () => void): void {
  const rng = () => 0.5;
  const end = w.time + seconds;
  while (w.time < end) {
    each?.();
    stepWorld(w, 1);
    a.step(w, rng);
    s.step(w, a);
  }
}

describe("radar exercises in the real areas: positions in the briefings", () => {
  it("the reference points and the anchor position are where the briefings say", () => {
    const p = latLonOf(MUMBAI_ORIGIN, MALABAR_POINT);
    expect(minutes(p.lat)).toBeCloseTo(56.94, 2); // 18°56.94'N
    expect(minutes(p.lon)).toBeCloseTo(47.524, 2); // 072°47.52'E
    const anchor = latLonOf(GOA_ORIGIN, GOA_ANCHOR);
    expect(minutes(anchor.lat)).toBeCloseTo(24.0, 2); // 15°24.0'N
    expect(minutes(anchor.lon)).toBeCloseTo(42.032, 2); // 073°42.0'E
    const m = latLonOf(GOA_ORIGIN, MORMUGAO_POINT);
    expect(minutes(m.lat)).toBeCloseTo(24.54, 2); // 15°24.5'N
    expect(minutes(m.lon)).toBeCloseTo(46.981, 2); // 073°47.0'E
    expect(ex("radar-23").briefing.join(" ")).toContain("18°56.9'N 072°47.5'E");
    expect(ex("radar-24").briefing.join(" ")).toContain("15°24.0'N 073°42.0'E");
    expect(ex("radar-24").briefing.join(" ")).toContain("15°24.5'N 073°47.0'E");
  });

  it("numbers the four exercises 23 to 26 in the Radar group, with unique task ids", () => {
    expect(PORT_EXERCISES.map((e) => [e.id, e.number, e.group])).toEqual([["radar-23", 23, "Radar"], ["radar-24", 24, "Radar"], ["radar-25", 25, "Radar"], ["radar-26", 26, "Radar"]]);
    for (const e of PORT_EXERCISES) expect(new Set(e.tasks.map((t) => t.id)).size).toBe(e.tasks.length);
  });
});

describe("radar 23: Mumbai, fix with the GNSS failed", () => {
  it("starts with the GNSS failed, and the ARPA says so", () => {
    const { w, a, s } = start(ex("radar-23"));
    expect(w.sensors.gnssFailed).toBe(true);
    run(w, a, s, 5);
    expect(a.alarms.some((x) => x.key === "gnssfail")).toBe(true);
  });

  it("answer key at the start: Malabar Point 8.60 NM, 036.2°; own ship 18°50.00'N 072°42.15'E", () => {
    const e = ex("radar-23");
    const { c } = start(e);
    expect(numberTask(e, "rng").truth(c())).toBeCloseTo(8.6006, 3);
    expect(numberTask(e, "brg").truth(c())).toBeCloseTo(36.2037, 3);
    expect(numberTask(e, "lat").truth(c())).toBeCloseTo(50.0, 3);
    expect(numberTask(e, "lon").truth(c())).toBeCloseTo(42.1505, 3);
  });

  it("the briefing's working (plane sailing from Malabar Point) gives the position to within 0.02'", () => {
    const e = ex("radar-23");
    const { w, a, s, c } = start(e);
    for (const t of [0, 600, 1200]) {
      run(w, a, s, t - w.time);
      const r = numberTask(e, "rng").truth(c())!;
      const b = (numberTask(e, "brg").truth(c())! * Math.PI) / 180;
      const lat = 56.94 - r * Math.cos(b);
      const lon = 47.52 - (r * Math.sin(b)) / Math.cos((18.9 * Math.PI) / 180);
      expect(Math.abs(lat - numberTask(e, "lat").truth(c())!)).toBeLessThan(0.02);
      expect(Math.abs(lon - numberTask(e, "lon").truth(c())!)).toBeLessThan(0.02);
    }
  });

  it("Malabar Point paints on the 12 NM range from the start position", () => {
    const { w } = start(ex("radar-23"));
    w.radar.controls.rangeNm = 12;
    // Malabar Point bears 036.2° true; own heading 060°, so about 24° on the port bow.
    const hits = scanWedge(w, 321, 351, () => 0.5).filter((h) => h.kind === "coast");
    const nearest = Math.min(...hits.map((h) => length(sub(h.pos, MALABAR_POINT))));
    expect(nearest).toBeLessThan(0.15);
  });
});

describe("radar 24: Goa, parallel index approach and anchoring", () => {
  it("answer key: course to steer 087.3°; Mormugao Point 4.80 NM from the anchor position; index line 0.54 NM to port", () => {
    const e = ex("radar-24");
    const { c } = start(e);
    // Current 160° 0.5 kn: 0.5 sin 70° = 0.470 kn across the 090 track, to starboard; at 10 kn steer asin(0.047) = 2.69° to port.
    expect(numberTask(e, "cts").truth(c())).toBeCloseTo(87.307, 2);
    expect(numberTask(e, "vrm").truth(c())).toBeCloseTo(4.8005, 3);
    expect(GOA_PI_NM).toBeCloseTo(0.54, 6);
  });

  it("accepts the index line on either side of the reversed bearing, and refuses the wrong side", () => {
    const e = ex("radar-24");
    const { c } = start(e);
    const pi = e.tasks.find((t) => t.id === "pi")!;
    if (pi.kind !== "action") throw new Error("pi is an action");
    const ctx = c();
    const check = (bearing: number, range: number): boolean => {
      ctx.obs.pi = [{ on: true, bearing, range }];
      return pi.done(ctx);
    };
    expect(check(90, -0.54)).toBe(true);
    expect(check(270, 0.54)).toBe(true);
    expect(check(90, 0.54)).toBe(false);
    expect(check(90, -0.8)).toBe(false);
  });

  it("the anchor drags ten minutes after it is let go, and the anchor watch on the buoy then gives its alarm", () => {
    const e = ex("radar-24");
    const { w, a, s } = start(e);
    w.own.pos = { ...GOA_ANCHOR };
    w.own.ordered.speed = 0;
    w.own.speedThroughWater = 0;
    expect(letGoAnchor(w)).toBe(true);
    const since = w.time;
    acquire(w, a, 4);
    run(w, a, s, 180);
    const id = a.tracks.find((t) => t.truthId === 4)!.id;
    expect(a.setAnchorWatch(w, id, 0.1)).toBe(true);
    run(w, a, s, 300);
    expect(w.own.anchor!.dragKn).toBe(0);
    expect(a.alarms.some((x) => x.kind === "anchor")).toBe(false);
    run(w, a, s, 140);
    expect(w.own.anchor!.dragKn).toBe(0.5);
    expect(s.scriptLog[0]!.time - since).toBeGreaterThanOrEqual(600);
    expect(s.scriptLog[0]!.time - since).toBeLessThan(602);
    // Dragging at 0.5 kn, own ship has moved 0.1 NM from the buoy's mark 12 minutes later.
    let alarmAt: number | null = null;
    run(w, a, s, 1200, () => {
      if (alarmAt === null && a.alarms.some((x) => x.kind === "anchor")) alarmAt = w.time - since;
    });
    expect(alarmAt).not.toBeNull();
    expect(alarmAt!).toBeGreaterThan(600 + 0.08 * 7200);
    expect(alarmAt!).toBeLessThan(600 + 0.12 * 7200);
    // Dragging is not counted as leaving the planned track, and the anchor position is where it was let go.
    expect(s.obs.maxXte).toBe(0);
    expect(s.obs.anchorPos).toEqual(GOA_ANCHOR);
  });
});

describe("radar 25: Kochi, restricted visibility", () => {
  function withTurn(course: number): ReturnType<ArpaExSession["finish"]> {
    const e = ex("radar-25");
    const { w, a, s } = start(e);
    for (const t of w.targets) acquire(w, a, t.id);
    run(w, a, s, 360);
    w.own.ordered.course = course;
    run(w, a, s, 1800);
    return s.finish(w, a);
  }
  it("a bold turn to starboard passes; a turn to port for the ships ahead is marked against Rule 19(d)", () => {
    const good = withTurn(130);
    expect(good.items.find((i) => i.id === "action")!.ok).toBe(true);
    expect(good.items.find((i) => i.id === "safe")!.ok).toBe(true);
    const port = withTurn(40);
    const action = port.items.find((i) => i.id === "action")!;
    expect(action.ok).toBe(false);
    expect(action.student).toMatch(/port/i);
  });
});

describe("radar 26: Gulf of Kutch, tidal stream", () => {
  it("answer key: the flood stream 075° at 1.21, 1.48 and 1.72 kn at 0, 15 and 30 minutes", () => {
    // 2.5 kn × sin(2π h / 12.42 h), h = 1, 1.25 and 1.5 hours after slack water.
    const e = ex("radar-26");
    const { w, a, s, c } = start(e);
    const want = [1.21147, 1.47764, 1.7202];
    for (const [i, t] of [0, 900, 1800].entries()) {
      run(w, a, s, t - w.time);
      expect(numberTask(e, "set").truth(c())).toBeCloseTo(75, 6);
      expect(numberTask(e, "rate").truth(c())).toBeCloseTo(want[i]!, 4);
    }
  });

  it("answer key at the start: the container ship's CPA 0.40 NM (passing to port) in 38.1 minutes", () => {
    const e = ex("radar-26");
    const { c } = start(e);
    expect(numberTask(e, "cpa").truth(c())).toBeCloseTo(0.39905, 3);
    expect(numberTask(e, "tcpa").truth(c())).toBeCloseTo(38.099, 1);
  });

  it("the ARPA, referenced to the tanker at anchor, gives the stream within the placeholder tolerances", () => {
    const e = ex("radar-26");
    const { w, a, s, c } = start(e);
    acquire(w, a, 1);
    run(w, a, s, 300);
    const ref = a.tracks.find((t) => t.truthId === 1)!;
    expect(a.designateGroundRef(w, ref.id)).toBe(true);
    run(w, a, s, 60);
    const g = a.groundRefVelocity()!;
    const stream = courseSpeedOf(scale(g, -1));
    const cfg = c().cfg;
    expect(Math.abs(((stream.course - numberTask(e, "set").truth(c())! + 540) % 360) - 180)).toBeLessThan(cfg.tol.setDeg);
    expect(Math.abs(stream.speed - numberTask(e, "rate").truth(c())!)).toBeLessThan(cfg.tol.errorKn);
    expect(s.obs.groundRef).toBe(1);
  });
});
