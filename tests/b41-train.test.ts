import { describe, expect, it } from "vitest";
import { fromPolar, length, sub } from "../src/core/vec";
import { LINKED_SHIP_ID_BASE, OPEN_SEA, addRandomTraffic, addTypedTarget, createWorld, nextTargetId, stepWorld, RANDOM_TRAFFIC_DEFAULT } from "../src/engine/index";
import { ARPA_PLACEHOLDERS, ArpaSystem, extractPlots } from "../src/arpa/index";
import {
  ARPA_EXERCISES, ArpaExSession, DEFAULT_EXAMS, FOG_AT_SEC, MOB_AT_SEC, NAV_LIMITS, PLACEHOLDER_SCORING, RADAR_EXERCISES, RETURN_OPEN_NM, ROUTE_27, ScoringConfig, SessionRecord, TIME_LIMIT_ID,
  examParts, examSheetsHtml, examTotal, offRoute, taskCriteria, timeLimitMin,
} from "../src/train/index";
import { computeFix } from "../src/roc/evaluate";
import { ChartedObject, RocObservation } from "../src/roc/session";

/* Tests for the work of 18 Nov 2026. Expected values are worked by hand in the comments. */

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};
const ex = (id: string) => [...ARPA_EXERCISES, ...RADAR_EXERCISES].find((e) => e.id === id)!;
const start = (id: string, cfg: ScoringConfig = PLACEHOLDER_SCORING) => {
  const def = ex(id);
  const w = createWorld(def.scenario, 62);
  const a = new ArpaSystem(w);
  return { def, w, a, s: new ArpaExSession(def, w, a, cfg) };
};

// The three robots work exercises 27 to 31 with all the others in tests/selftest.test.ts, selftest-2 and selftest-3.

describe("a time limit", () => {
  it("is the instructor's figure if set, else the exercise's own, else none", () => {
    expect(timeLimitMin(ex("arpa-31"), PLACEHOLDER_SCORING)).toBe(NAV_LIMITS.timedAcqMin);
    expect(timeLimitMin(ex("arpa-31"), { ...PLACEHOLDER_SCORING, timeLimits: { "arpa-31": 12 } })).toBe(12);
    expect(timeLimitMin(ex("arpa-1"), PLACEHOLDER_SCORING)).toBeNull();
    expect(timeLimitMin(ex("arpa-1"), { ...PLACEHOLDER_SCORING, timeLimits: { "arpa-1": 6 } })).toBe(6);
    expect(timeLimitMin(ex("arpa-1"), { ...PLACEHOLDER_SCORING, timeLimits: { "arpa-1": null } })).toBeNull();
  });
  it("adds one marked item, shown to the candidate beforehand", () => {
    const c = taskCriteria(ex("arpa-31"), PLACEHOLDER_SCORING);
    expect(c.length).toBe(ex("arpa-31").tasks.length + 1);
    expect(c[c.length - 1]!.id).toBe(TIME_LIMIT_ID);
    expect(c[c.length - 1]!.limit).toBe("8 min");
    expect(taskCriteria(ex("arpa-1"), PLACEHOLDER_SCORING).length).toBe(ex("arpa-1").tasks.length);
  });
  it("finished at 5 minutes with a limit of 6: credited; finished at 7 minutes: not", () => {
    for (const [seconds, ok] of [[300, true], [420, false]] as const) {
      const { w, a, s } = start("arpa-1", { ...PLACEHOLDER_SCORING, timeLimits: { "arpa-1": 6 } });
      const rng = seeded(1);
      while (w.time < seconds) {
        stepWorld(w, 1);
        a.step(w, rng);
        s.step(w, a);
      }
      const item = s.finish(w, a).items.find((i) => i.id === TIME_LIMIT_ID)!;
      expect(item.ok).toBe(ok);
      expect(item.max).toBe(PLACEHOLDER_SCORING.points.safety);
    }
  });
});

describe("what the session watches", () => {
  it("distance off a route: 1.5 NM along the first leg (040) and 0.3 NM to starboard of it", () => {
    // Along 040: (sin 40, cos 40) = (0.6428, 0.7660); to starboard: (0.7660, -0.6428).
    // 1.5 x (0.6428, 0.7660) + 0.3 x (0.7660, -0.6428) = (1.1940, 0.9562).
    const { w, a, s } = start("radar-27");
    w.own.pos = { e: 1.194, n: 0.9562 };
    s.step(w, a);
    expect(s.obs.maxXte).toBeCloseTo(0.3, 3);
    expect(s.obs.trackDone).toBe(false);
    expect(offRoute(ROUTE_27, w.own.pos).xtd).toBeCloseTo(0.3, 3);
    expect(offRoute(ROUTE_27, w.own.pos).track).toBeCloseTo(40, 6);
    // Past the last waypoint, along the last leg (030): the route is done.
    const last = ROUTE_27[3]!;
    w.own.pos = { e: last.e + 0.25, n: last.n + 0.433 }; // 0.5 NM on along 030
    s.step(w, a);
    expect(s.obs.trackDone).toBe(true);
  });
  it("a separation scheme: seconds with the flow, against it and in the zone", () => {
    const run = (e: number, heading: number): ReturnType<typeof start>["s"]["obs"]["tss"] => {
      const { w, a, s } = start("radar-28");
      delete w.own.model;
      w.own.pos = { e, n: 3 };
      w.own.heading = heading;
      w.own.ordered.course = heading;
      const rng = seeded(2);
      for (let i = 0; i < 60; i++) {
        stepWorld(w, 1);
        a.step(w, rng);
        s.step(w, a);
      }
      return s.obs.tss;
    };
    // Northbound in the lane east of the zone (0.5 to 2.5 NM east of the axis).
    const good = run(1.3, 0);
    expect(good.withFlow).toBeCloseTo(60, 0);
    expect(good.against + good.zone + good.crossing).toBe(0);
    // Southbound in the same lane: against the flow.
    expect(run(1.3, 180).against).toBeCloseTo(60, 0);
    // In the separation zone.
    expect(run(0.2, 0).zone).toBeCloseTo(60, 0);
    // Heading west across the northbound lane: crossing, not against.
    const x = run(2.3, 270);
    expect(x.crossing).toBeGreaterThan(50);
    expect(x.against).toBe(0);
  });
  it("man overboard: the report is told to the trainee, and the way back is measured only after the ship has drawn away", () => {
    const { w, a, s } = start("radar-29");
    const rng = seeded(3);
    const go = (until: number, ui?: { mobAt: number }): void => {
      while (w.time < until) {
        stepWorld(w, 1);
        a.step(w, rng);
        s.step(w, a, { pi: [], navLines: 0, ...(ui ?? {}) });
      }
    };
    go(MOB_AT_SEC - 1);
    expect(s.notices.length).toBe(0);
    expect(w.targets.some((t) => t.id === 9)).toBe(false);
    go(MOB_AT_SEC + 10, { mobAt: MOB_AT_SEC + 8 });
    expect(s.notices[0]).toContain("MAN OVERBOARD");
    expect(w.targets.some((t) => t.id === 9)).toBe(true);
    expect(s.obs.mobKeyAt).toBe(MOB_AT_SEC + 8);
    // At the moment of the fall the range is 0, so the closest approach alone would prove nothing.
    expect(s.obs.minRange[9]!).toBeLessThan(0.01);
    expect(s.obs.returnRange[9]).toBeUndefined();
    // At 14 kn the ship is 0.25 NM away after 0.25 / 14 h = 64 s.
    go(MOB_AT_SEC + 80);
    expect(s.obs.returnRange[9]!).toBeGreaterThan(RETURN_OPEN_NM);
    const r = s.finish(w, a);
    expect(r.items.find((i) => i.id === "key")!.ok).toBe(true);
    expect(r.items.find((i) => i.id === "back")!.ok).toBe(false);
  });
  it("safe speed: judged from the speed over the ground after the visibility closes", () => {
    const judge = (log: [number, number][]): boolean => {
      const { w, a, s } = start("radar-30");
      s.obs.speedLog = log;
      return s.finish(w, a).items.find((i) => i.id === "speed")!.ok;
    };
    const by = FOG_AT_SEC + NAV_LIMITS.safeSpeedByMin * 60;
    expect(judge([[0, 16], [FOG_AT_SEC + 60, 12], [by - 10, NAV_LIMITS.safeSpeedKn]])).toBe(true);
    expect(judge([[0, 16], [by - 10, NAV_LIMITS.safeSpeedKn + 0.5], [by + 30, 5]])).toBe(false);
    // Slow before the visibility closed and fast after it does not count.
    expect(judge([[FOG_AT_SEC - 30, 6], [FOG_AT_SEC + 60, 16], [by, 15]])).toBe(false);
  });
});

describe("the instructor's targets", () => {
  it("a vessel of a type is added at a true bearing and range from own ship", () => {
    const w = createWorld(OPEN_SEA, 62);
    w.own.pos = { e: 2, n: 1 };
    const n = w.targets.length;
    const t = addTypedTarget(w, { name: "Sudden threat", typeId: "ferry", bearing: 90, rangeNm: 4, course: 270, speed: 18 });
    expect(w.targets.length).toBe(n + 1);
    expect(t.pos.e).toBeCloseTo(6, 9);
    expect(t.pos.n).toBeCloseTo(1, 9);
    expect(t.typeId).toBe("ferry");
    expect(t.id).toBe(Math.max(...w.targets.map((x) => x.id)));
  });
  it("in a linked exercise the other displays' own ships (ids from 9000) are left alone and their ids are not used", () => {
    const w = createWorld(OPEN_SEA, 62);
    const highest = Math.max(...w.targets.map((t) => t.id));
    w.targets.push({ ...w.targets[0]!, id: LINKED_SHIP_ID_BASE + 5, name: "OS OTHER", kind: "ship" });
    expect(nextTargetId(w)).toBe(highest + 1);
    expect(addTypedTarget(w, { name: "X", typeId: "coaster", bearing: 0, rangeNm: 3, course: 180, speed: 9 }).id).toBe(highest + 1);
    addRandomTraffic(w, { ...RANDOM_TRAFFIC_DEFAULT, count: 4, threats: 0 }, 5, true);
    expect(w.targets.some((t) => t.id === LINKED_SHIP_ID_BASE + 5)).toBe(true);
    expect(w.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft").length).toBe(5);
  });
  it("random traffic in place of the ships there leaves buoys and beacons", () => {
    const w = createWorld(OPEN_SEA, 62);
    const fixed = w.targets.filter((t) => t.kind !== "ship" && t.kind !== "small-craft").length;
    expect(fixed).toBeGreaterThan(0);
    const n = addRandomTraffic(w, { ...RANDOM_TRAFFIC_DEFAULT, count: 10, threats: 2 }, 99, true);
    expect(n).toBe(10);
    expect(w.targets.length).toBe(fixed + 10);
    expect(new Set(w.targets.map((t) => t.id)).size).toBe(w.targets.length);
  });
});

describe("the ARPA and false echoes", () => {
  const world = (rcs: number, rangeNm: number) => createWorld({ id: "t", name: "t", description: "", own: { heading: 0, speed: 0 }, env: { seaState: 0 }, coasts: [], targets: [{ id: 1, name: "S", kind: "ship", pos: fromPolar(45, rangeNm), course: 0, speed: 0, rcs, height: 20, events: [] }] }, 62);
  const falseAt = (w: ReturnType<typeof world>, cfg = ARPA_PLACEHOLDERS): number[] => {
    w.radar.controls.tuning = 62;
    const rng = seeded(8);
    const out: number[] = [];
    for (let i = 0; i < 40; i++) for (const p of extractPlots(w, cfg, rng)) if (p.kind === "false") out.push(length(p.rel));
    return out;
  };
  it("a strong ship 0.8 NM off gives multiple echoes at 1.6 and 2.4 NM, which the plot extractor passes on", () => {
    const r = falseAt(world(5, 0.8));
    expect(r.some((x) => Math.abs(x - 1.6) < 0.1)).toBe(true);
    expect(r.every((x) => Math.abs(x - 0.8) < 0.1 || Math.abs(x - 1.6) < 0.1 || Math.abs(x - 2.4) < 0.1)).toBe(true);
  });
  it("the same ship 6 NM off gives none, and none with the option off", () => {
    expect(falseAt(world(5, 6))).toEqual([]);
    expect(falseAt(world(5, 0.8), { ...ARPA_PLACEHOLDERS, falseEchoes: false })).toEqual([]);
  });
  it("interference gives false plots unless interference rejection is on", () => {
    const w = world(1, 6);
    w.env.interference = true;
    w.radar.controls.tuning = 62;
    const count = (): number => extractPlots(w, ARPA_PLACEHOLDERS, seeded(4)).filter((p) => p.kind === "false").length;
    expect(count()).toBe(ARPA_PLACEHOLDERS.interferencePlotsPerScan);
    w.radar.controls.interferenceRejection = true;
    expect(count()).toBe(0);
  });
});

describe("a fix by position lines in the ROC fix exercise", () => {
  // Own ship at the origin at the time of the fix. A (3, 4): range 5, bearing 036.87. B (-6, 8): range 10, bearing 323.13.
  const charted: ChartedObject[] = [{ id: 1, name: "A", pos: { e: 3, n: 4 } }, { id: 2, name: "B", pos: { e: -6, n: 8 } }];
  const obs = (id: number, objectId: number, timeSec: number, bearing: number, range: number, use: "both" | "range" | "bearing", ownPos = { e: 0, n: 0 }): RocObservation => ({
    id, group: 1, timeSec, bearing, range, ...(use !== "both" ? { use } : {}), objectId, ownHeading: 0, ownSpeedWater: 12,
    truth: { time: timeSec, ownPos, ownGround: { course: 0, speed: 12 }, targetPos: null, targetCourse: 0, targetSpeed: 0 },
  });
  it("two ranges only", () => {
    // The bearings are read 3 degrees wrong on purpose: they are not used.
    const r = computeFix([obs(1, 1, 0, 39.9, 5, "range"), obs(2, 2, 0, 320.1, 10, "range")], charted, 1);
    expect(r.valid).toBe(true);
    expect(r.errorNm!).toBeLessThan(0.001);
    expect(r.messages.some((m) => m.text === "Fix from 2 ranges and 0 bearings as position lines.")).toBe(true);
  });
  it("two bearings only", () => {
    // The ranges are read 0.4 NM wrong on purpose: they are not used.
    const r = computeFix([obs(1, 1, 0, 36.87, 5.4, "bearing"), obs(2, 2, 0, 323.13, 9.6, "bearing")], charted, 1);
    expect(r.valid).toBe(true);
    expect(r.errorNm!).toBeLessThan(0.002);
    // The two bearing lines cut at 73.74 degrees (36.87 + 36.87).
    expect(r.cutAngle!).toBeCloseTo(73.74, 1);
  });
  it("a running fix: a range of A, then five minutes later a range of B", () => {
    // Own ship steers north at 12 kn: 1 NM in 5 minutes. At the first reading she is at (0, -1): A is then
    // at a range of sqrt(3^2 + 5^2) = 5.831 NM. At the second she is at the origin: B at 10 NM.
    const r = computeFix([obs(1, 1, 0, 30.96, 5.831, "range", { e: 0, n: -1 }), obs(2, 2, 300, 323.13, 10, "range")], charted, 1);
    expect(r.valid).toBe(true);
    expect(r.errorNm!).toBeLessThan(0.005);
  });
  it("range and bearing of each object, as before: unchanged", () => {
    const r = computeFix([obs(1, 1, 0, 36.87, 5, "both"), obs(2, 2, 0, 323.13, 10, "both")], charted, 1);
    expect(r.errorNm!).toBeLessThan(0.002);
    expect(r.messages.some((m) => m.text.startsWith("Fix from"))).toBe(false);
  });
});

describe("a practical examination", () => {
  const rec = (id: string, exam: SessionRecord["exam"], score: number | null, max = 100, startedIso = "2026-11-18T10:00:00Z"): SessionRecord => ({
    id, exerciseId: id, title: `Exercise ${id}`, kind: score === null ? "roc" : "arpa", students: ["Asha"], batch: "B1", startedIso, simSeconds: 600, names: {}, coasts: [], frames: [], events: [],
    result: score === null ? null : ({ exerciseId: id, title: id, simSeconds: 600, items: [], score, max, percent: (100 * score) / max, passed: null, debrief: [], placeholderNote: "" }),
    summary: score === null ? ["Fix error 0.08 NM"] : [], ...(exam ? { exam } : {}),
  });
  const e = (part: number) => ({ id: "arpa-x1", name: "ARPA practical examination", part, of: 3 });
  it("the proposed parts exist as exercises", () => {
    const known = new Set([...ARPA_EXERCISES, ...RADAR_EXERCISES].map((x) => x.id));
    for (const p of [...DEFAULT_EXAMS.roc.parts, ...DEFAULT_EXAMS.arpa.parts]) expect(known.has(p) || p.startsWith("plot-") || p.startsWith("roc-"), p).toBe(true);
  });
  it("takes the latest record of each part and adds up the marked parts: 80 + 60 of 100 + 100 is 70%", () => {
    const records = [rec("a", e(1), 50, 100, "2026-11-18T09:00:00Z"), rec("a2", e(1), 80, 100, "2026-11-18T10:00:00Z"), rec("b", e(2), 60), rec("c", e(3), null), rec("other", undefined, 10)];
    const parts = examParts(records, "arpa-x1");
    expect(parts.map((p) => p.id)).toEqual(["a2", "b", "c"]);
    const t = examTotal(parts, { ...PLACEHOLDER_SCORING, passPercent: 65 });
    expect(t).toEqual({ done: 3, of: 3, score: 140, max: 200, percent: 70, passed: true });
    expect(examTotal(parts, { ...PLACEHOLDER_SCORING, passPercent: 75 }).passed).toBe(false);
    expect(examTotal(parts, PLACEHOLDER_SCORING).passed).toBeNull();
  });
  it("gives no pass while a part is missing", () => {
    const t = examTotal(examParts([rec("a", e(1), 100), rec("b", e(2), 100)], "arpa-x1"), { ...PLACEHOLDER_SCORING, passPercent: 50 });
    expect(t.done).toBe(2);
    expect(t.passed).toBeNull();
  });
  it("prints one sheet for each examination, with the parts, the total and the caution", () => {
    const html = examSheetsHtml([rec("a", e(1), 80), rec("b", e(2), 60), rec("c", e(3), null)], PLACEHOLDER_SCORING);
    expect((html.match(/<section class="sheet">/g) ?? []).length).toBe(1);
    expect(html).toContain("ARPA practical examination");
    expect(html).toContain("140 / 200");
    expect(html).toContain("Fix error 0.08 NM");
    expect(html).toContain("not type approved, not for navigation");
    expect(html).toContain("none set (the simulator shows no pass or fail)");
    expect(examSheetsHtml([], PLACEHOLDER_SCORING)).toContain("No examination has been taken yet.");
  });
});
