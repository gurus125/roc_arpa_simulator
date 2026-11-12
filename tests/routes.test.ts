import { describe, expect, it } from "vitest";
import { MAX_ROUTE_WAYPOINTS, turnRadiusNm, waypointReached } from "../src/core/route";
import { HUNDRED_SHIPS, SCENARIOS, clearTargetRoute, createWorld, routeAhead, setTargetRoute, stepWorld, targetFromType, targetTypeById } from "../src/engine/index";
import { scenarioFromJson, scenarioToJson } from "../src/train/scenario-io";

/*
 * Expected values are worked by hand from the geometry, not taken from the functions under test:
 * - a full circle at 1 deg/s takes 360 s; at 12 kn that is 1.2 NM round, so R = 1.2 / (2 pi) = 0.190986 NM;
 * - the leg (0,0) -> (3,4) is 5 NM long; the point (4, 3.25) projects to (4*3 + 3.25*4) / 5 = 5.0 NM along it;
 * - at 12 kn a 2 NM leg takes 10 minutes.
 */
const base = { id: "r", name: "r", description: "", own: { heading: 0, speed: 0 }, coasts: [], env: {} };
const plain = (id: number, e: number, n: number, course: number, speed: number) => ({ id, name: `T${id}`, kind: "ship" as const, pos: { e, n }, course, speed, rcs: 1, height: 20, events: [] });
const typed = (id: number, typeId: string, e: number, n: number, course: number, speed: number) => ({ id, name: `T${id}`, pos: { e, n }, course, speed, events: [], ...targetFromType(targetTypeById(typeId)!) });
const run = (w: ReturnType<typeof createWorld>, seconds: number, dt = 1): void => {
  for (let i = 0; i < Math.round(seconds / dt); i++) stepWorld(w, dt);
};
const dist = (p: { e: number; n: number }, e: number, n: number): number => Math.hypot(p.e - e, p.n - n);

describe("route maths (core)", () => {
  it("turn radius is speed over rate of turn", () => {
    expect(turnRadiusNm(12, 1)).toBeCloseTo(0.190986, 5);
    expect(turnRadiusNm(24, 1)).toBeCloseTo(0.381972, 5);
    expect(turnRadiusNm(12, 0)).toBe(0);
  });
  it("a waypoint is reached inside the arrival distance, or when abeam of it or past it", () => {
    const from = { e: 0, n: 0 };
    const wp = { e: 3, n: 4 };
    expect(waypointReached({ e: 2.4, n: 3.2 }, from, wp, 0.5)).toBe(false); // 1 NM short, on the leg
    expect(waypointReached({ e: 2.4, n: 3.2 }, from, wp, 1.0)).toBe(true); // inside the arrival distance
    expect(waypointReached({ e: 4, n: 3.25 }, from, wp, 0.5)).toBe(true); // 1.25 NM off but exactly abeam
    expect(waypointReached({ e: 3.9, n: 3.2 }, from, wp, 0.5)).toBe(false); // 4.9 NM along: not yet abeam
    expect(waypointReached({ e: 6, n: 8 }, from, wp, 0.5)).toBe(true); // gone past
  });
});

describe("target routes (engine)", () => {
  it("a plain target sails the legs in turn and carries on after the last waypoint", () => {
    const w = createWorld({ ...base, targets: [{ ...plain(1, 0, 0, 90, 12), route: { points: [{ e: 0, n: 2 }, { e: 2, n: 2 }, { e: 2, n: 0 }] } }] });
    const t = w.targets[0]!;
    expect(t.course).toBeCloseTo(0, 6); // steers for the first waypoint at once, not the 090 it was given
    run(w, 600);
    expect(dist(t.pos, 0, 2)).toBeLessThan(0.1);
    run(w, 600);
    expect(dist(t.pos, 2, 2)).toBeLessThan(0.1);
    run(w, 600);
    expect(dist(t.pos, 2, 0)).toBeLessThan(0.1);
    run(w, 600);
    expect(dist(t.pos, 2, -2)).toBeLessThan(0.1);
    expect(Math.abs(t.course - 180)).toBeLessThan(2);
    expect(t.route?.next).toBe(3);
    expect(routeAhead(t)).toEqual([]);
  });
  it("a ship with a turning circle turns early and settles on the next leg", () => {
    const w = createWorld({ ...base, targets: [{ ...typed(1, "coaster", 0, 0, 0, 10), route: { points: [{ e: 0, n: 3 }, { e: 4, n: 3 }] } }] });
    const t = w.targets[0]!;
    run(w, 30 * 60, 0.5); // 18 min up the first leg, then about 12 min (2 NM) along the second
    expect(Math.abs(t.pos.n - 3)).toBeLessThan(0.05);
    expect(t.pos.e).toBeGreaterThan(1.6);
    expect(t.pos.e).toBeLessThan(2.4);
    expect(Math.abs(t.motion!.heading - 90)).toBeLessThan(2);
  });
  it("a big ship on a tight track does not skip waypoints at the start", () => {
    // VLCC at 14 kn: its wheel-over distance for a 135 degree turn is longer than these 1.5 NM legs,
    // but no waypoint counts as reached before the ship is half way along the leg to it.
    const w = createWorld({ ...base, targets: [typed(1, "vlcc", 0, 0, 0, 14)] });
    const t = w.targets[0]!;
    setTargetRoute(t, [{ e: 0, n: 1.5 }, { e: 1.06, n: 0.44 }, { e: 1.06, n: 1.94 }]);
    expect(routeAhead(t)).toHaveLength(3);
    run(w, 120); // 0.47 NM run: still short of half way (0.75 NM)
    expect(routeAhead(t)).toHaveLength(3);
    run(w, 120); // 0.93 NM run: past half way, and the wheel is over
    expect(routeAhead(t)).toHaveLength(2);
  });
  it("a ship on a track allows for the current and stays on the line", () => {
    // Hand-worked current triangle: 10 kn through the water, track 000, current setting 090 at 2 kn.
    // Allowance = asin(2 / 10) = 11.54 degrees to port, so heading 348.46; speed made good = sqrt(100 - 4) = 9.798 kn.
    const w = createWorld({ ...base, env: { current: { set: 90, drift: 2 } }, targets: [{ ...typed(1, "coaster", 0, 0, 0, 10), route: { points: [{ e: 0, n: 10 }] } }] });
    const t = w.targets[0]!;
    run(w, 15 * 60, 0.5);
    expect(Math.abs(t.pos.e)).toBeLessThan(0.03);
    expect(Math.abs(t.pos.n - 9.798 * 0.25)).toBeLessThan(0.05);
    expect(Math.abs(t.motion!.heading - 348.46)).toBeLessThan(1.5);
    expect(Math.abs(t.speed - 9.798)).toBeLessThan(0.1);
  });
  it("orders the leg's speed when the leg begins", () => {
    const w = createWorld({ ...base, targets: [{ ...plain(1, 0, 0, 0, 12), route: { points: [{ e: 0, n: 1 }, { e: 0, n: 3 }], speeds: [null, 6] } }] });
    const t = w.targets[0]!;
    run(w, 240);
    expect(t.speed).toBe(12);
    run(w, 120); // the first waypoint, 1 NM off, is passed at 5 minutes
    expect(t.speed).toBe(6);
    run(w, 540); // 15 minutes in all: 1 NM, then 10 minutes at 6 kn
    expect(dist(t.pos, 0, 2)).toBeLessThan(0.04);
  });
  it("a timed course order ends the route", () => {
    const w = createWorld({ ...base, targets: [{ ...plain(1, 0, 0, 0, 12), events: [{ atSeconds: 60, course: 270 }], route: { points: [{ e: 0, n: 5 }] } }] });
    run(w, 120);
    expect(w.targets[0]!.route).toBeUndefined();
    expect(w.targets[0]!.course).toBe(270);
  });
  it("fixed objects take no route; long routes are cut to the limit; a route can be cleared", () => {
    const w = createWorld({ ...base, targets: [{ ...plain(1, 0, 1, 0, 0), kind: "buoy" as const }, plain(2, 1, 1, 45, 10)] });
    expect(setTargetRoute(w.targets[0]!, [{ e: 1, n: 1 }])).toBe(false);
    expect(w.targets[0]!.route).toBeUndefined();
    const many = Array.from({ length: 30 }, (_, i) => ({ e: 1 + i, n: 2 }));
    expect(setTargetRoute(w.targets[1]!, many)).toBe(true);
    expect(MAX_ROUTE_WAYPOINTS).toBe(20);
    expect(w.targets[1]!.route!.points.length).toBe(20);
    expect(routeAhead(w.targets[1]!).length).toBe(20);
    clearTargetRoute(w.targets[1]!);
    expect(w.targets[1]!.route).toBeUndefined();
    expect(setTargetRoute(w.targets[1]!, [])).toBe(false);
  });
  it("100 target ships, each on its own 20-waypoint route, run together", () => {
    const targets = Array.from({ length: 100 }, (_, i) => {
      const e = -10 + (i % 10) * 2;
      const n = -10 + Math.floor(i / 10) * 2;
      // A zig-zag of 20 waypoints, half a mile apart, different for every ship.
      const points = Array.from({ length: 20 }, (_, k) => ({ e: e + (k % 2 === 0 ? 0.3 : -0.3), n: n + 0.5 * (k + 1) }));
      return { ...typed(i + 1, i % 2 === 0 ? "coaster" : "general-cargo", e, n, 0, 10), route: { points } };
    });
    const w = createWorld({ ...base, targets });
    const t0 = Date.now();
    run(w, 3600, 0.5);
    const ms = Date.now() - t0;
    expect(w.targets.length).toBe(100);
    for (const t of w.targets) {
      expect(Number.isFinite(t.pos.e) && Number.isFinite(t.pos.n)).toBe(true);
      expect(t.route!.next).toBeGreaterThanOrEqual(10); // 10 kn for an hour covers at least half of the 12 NM zig-zag
    }
    expect(ms).toBeLessThan(5000); // an hour of simulated time for 100 ships; generous for slow machines
  });
});

describe("the 100-ship scenario", () => {
  it("is in the scenario list, holds 100 ships on tracks, and all of them get under way", () => {
    expect(SCENARIOS).toContain(HUNDRED_SHIPS);
    const w = createWorld(HUNDRED_SHIPS);
    expect(w.targets).toHaveLength(100);
    expect(new Set(w.targets.map((t) => t.id)).size).toBe(100);
    const start = w.targets.map((t) => ({ ...t.pos }));
    run(w, 600);
    w.targets.forEach((t, i) => {
      expect(t.route).toBeDefined();
      expect(dist(t.pos, start[i]!.e, start[i]!.n)).toBeGreaterThan(0.3); // slowest type still makes over 0.3 NM in 10 minutes
    });
  });
});

describe("routes in scenario files", () => {
  it("a route survives saving and opening, and bad routes are refused", () => {
    const sc = { ...base, targets: [{ ...plain(1, 0, 0, 0, 12), route: { points: [{ e: 0, n: 2 }, { e: 2, n: 2 }], speeds: [null, 8] } }] };
    const back = scenarioFromJson(scenarioToJson(sc));
    expect("scenario" in back && back.scenario.targets[0]!.route).toEqual({ points: [{ e: 0, n: 2 }, { e: 2, n: 2 }], speeds: [null, 8] });
    const bad = JSON.parse(scenarioToJson(sc));
    bad.targets[0].route.points = [];
    const r1 = scenarioFromJson(JSON.stringify(bad));
    expect("errors" in r1 && r1.errors.some((e) => e.includes("route needs 1 to 20 points"))).toBe(true);
    bad.targets[0].route = { points: [{ e: 0, n: 1 }], speeds: [5, 6] };
    const r2 = scenarioFromJson(JSON.stringify(bad));
    expect("errors" in r2 && r2.errors.some((e) => e.includes("route speeds"))).toBe(true);
  });
});
