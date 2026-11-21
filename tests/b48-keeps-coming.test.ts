import { describe, expect, it } from "vitest";
import { computeCpa } from "../src/core/cpa";
import { Vec2, scale, sub, velocityOf } from "../src/core/vec";
import { KEEPS_COMING, Scenario, World, cameBackAt, createWorld, ownGroundVelocity, setShipBehaviour, stepTraffic, stepWorld } from "../src/engine/index";
import { ArpaExercise, DirectHost, ROBOT_EXERCISES, robotDirect } from "../src/train/index";

/**
 * A ship that keeps coming (engine/traffic-rules.ts, modes "careless" and "hunting"), and exercise 32. Own ship 000°
 * at 12 kn; Ship K crosses from starboard on 270° at 12 kn so as to meet her (CPA 0) after 22 minutes. The expected
 * behaviour is the one written in the briefing: she holds on until own ship acts, then comes back towards her in
 * corrections no larger, no more often and no more in number than the limits, and gives up when own ship stops.
 */
const OWN = { heading: 0, speed: 12 };
function collider(id: number, course: number, speed: number, tcpaMin: number, name = "Ship K"): Scenario["targets"][number] {
  const relVel = sub(velocityOf({ course, speed }), velocityOf({ course: OWN.heading, speed: OWN.speed }));
  const pos: Vec2 = scale(relVel, -tcpaMin / 60);
  return { id, name, kind: "ship", pos, course, speed, rcs: 1, height: 20, events: [] };
}
const world = (targets: Scenario["targets"]): World =>
  createWorld({ id: "t", name: "t", description: "", own: OWN, env: { seaState: 1 }, coasts: [], targets }, 50);
const cpaOf = (w: World, id: number): number => {
  const t = w.targets.find((x) => x.id === id)!;
  return computeCpa(sub(t.pos, w.own.pos), sub(velocityOf({ course: t.course, speed: t.speed }), ownGroundVelocity(w))).cpa;
};
/** Run `sec` seconds; own ship turns to `turn` at 5 minutes (and stops at `stopAt`, if given). */
function run(w: World, sec: number, turn: number, stopAt?: number): void {
  for (let s = 0; s < sec; s++) {
    if (s === 300) w.own.ordered.course = turn;
    if (stopAt !== undefined && s === stopAt) w.own.ordered.speed = 0;
    stepWorld(w, 1);
    stepTraffic(w, 1);
  }
}
const corrections = (w: World): { t: number; deg: number }[] =>
  w.traffic!.log.filter((e) => e.back).map((e) => ({ t: e.t, deg: Number(/(\d+)° to/.exec(e.text)![1]) }));

describe("a ship that keeps coming", () => {
  it("careless: holds on until own ship acts, then edges back, a little at a time, three times at most", () => {
    const w = world([collider(1, 270, 12, 22)]);
    setShipBehaviour(w, "careless", 1);
    // Before own ship acts: nothing (she is already on a collision course).
    run(w, 300, 0);
    expect(corrections(w)).toEqual([]);
    run(w, 2400, 50);
    const c = corrections(w);
    expect(c.length).toBeGreaterThan(0);
    expect(c.length).toBeLessThanOrEqual(KEEPS_COMING.careless.maxCorrections);
    for (const x of c) expect(x.deg).toBeLessThanOrEqual(KEEPS_COMING.careless.maxTurnDeg);
    for (let i = 1; i < c.length; i++) expect(c[i]!.t - c[i - 1]!.t).toBeGreaterThanOrEqual(KEEPS_COMING.careless.lookEverySec - 1);
    expect(cameBackAt(w)).toBe(c[0]!.t);
  });

  it("each correction brings her closer to own ship's track (the CPA falls)", () => {
    const w = world([collider(1, 270, 12, 22)]);
    setShipBehaviour(w, "careless", 1);
    let before = 0, after = 0;
    for (let s = 0; s < 1500; s++) {
      if (s === 300) w.own.ordered.course = 50;
      const n = corrections(w).length;
      stepWorld(w, 1);
      stepTraffic(w, 1);
      if (n === 0 && corrections(w).length === 1) before = cpaOf(w, 1);
      // Once she has come round to the new course (half a degree a second, or her own turn rate), well after the order.
      if (corrections(w).length === 1 && after === 0 && w.time > cameBackAt(w)! + 90) after = cpaOf(w, 1);
    }
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it("hunting: larger corrections, every minute, up to six", () => {
    const w = world([collider(1, 270, 12, 22)]);
    setShipBehaviour(w, "hunting", 1);
    run(w, 2400, 90);
    const c = corrections(w);
    expect(c.length).toBeGreaterThan(KEEPS_COMING.careless.maxCorrections);
    expect(c.length).toBeLessThanOrEqual(KEEPS_COMING.hunting.maxCorrections);
    for (const x of c) expect(x.deg).toBeLessThanOrEqual(KEEPS_COMING.hunting.maxTurnDeg);
    for (let i = 1; i < c.length; i++) expect(c[i]!.t - c[i - 1]!.t).toBeGreaterThanOrEqual(KEEPS_COMING.hunting.lookEverySec - 1);
  });

  it("gives up when own ship has nearly stopped", () => {
    const w = world([collider(1, 270, 12, 22)]);
    setShipBehaviour(w, "hunting", 1);
    run(w, 2400, 50, 420);
    expect(w.traffic!.log.some((e) => /holds her course: own ship has nearly stopped/.test(e.text))).toBe(true);
    const stoppedAt = w.traffic!.log.find((e) => /nearly stopped/.test(e.text))!.t;
    expect(corrections(w).every((c) => c.t < stoppedAt)).toBe(true);
  });

  it("with no ship chosen, the one that would come closest keeps coming; the others hold on", () => {
    const w = world([collider(1, 270, 12, 22, "Ship K"), { ...collider(2, 200, 10, 25, "Ship M"), pos: { e: 3, n: 9 } }]);
    setShipBehaviour(w, "careless");
    run(w, 1800, 50);
    expect(w.traffic!.chase!.id).toBe(1);
    expect(w.traffic!.log[0]!.text).toMatch(/Ship K is the ship that keeps coming/);
    expect(w.targets.find((t) => t.id === 2)!.course).toBe(200);
  });

  it("is plain data, copied with the world (rewind)", () => {
    const w = world([collider(1, 270, 12, 22)]);
    setShipBehaviour(w, "careless", 1);
    run(w, 700, 50);
    expect(structuredClone(w).traffic).toEqual(w.traffic);
  });
});

describe("exercise 32: a ship that keeps coming", () => {
  const ex = (): ArpaExercise => ROBOT_EXERCISES.find((e) => e.id === "arpa-32")!;
  const item = (h: DirectHost, id: string) => h.s.finished!.items.find((i) => i.id === id)!;

  it("is set up with the careless ship, Ship K, crossing from starboard on a collision course", () => {
    const e = ex();
    expect(e.number).toBe(32);
    expect(e.scenario.traffic).toBe("careless");
    expect(e.scenario.trafficShip).toBe(1);
    const w = createWorld(e.scenario);
    expect(cpaOf(w, 1)).toBeLessThan(0.1);
  });

  it("the robot student at level 5 gives way, sees her come back, sounds five short blasts, acts again: full marks", async () => {
    const r = await robotDirect(ex(), 5, 1);
    expect(r.result?.percent).toBe(100);
    expect(r.log.some((l) => /five short blasts/.test(l.text))).toBe(true);
  });

  it("one alteration and nothing more is not enough", async () => {
    const h = new DirectHost(ex(), 2);
    for (const id of [1, 2, 3]) await h.act({ k: "acquire", target: id });
    await h.wait(300);
    await h.act({ k: "course", deg: 40 });
    await h.wait(1500);
    h.s.finish(h.w, h.a);
    expect(cameBackAt(h.w)).not.toBeNull();
    expect(item(h, "act").ok).toBe(true);
    expect(item(h, "again").ok).toBe(false);
    expect(item(h, "doubt").ok).toBe(false);
    expect(item(h, "safe").ok).toBe(false);
  });

  it("five short blasts before she came back do not count; a bold first action may need no second", async () => {
    const h = new DirectHost(ex(), 2);
    for (const id of [1, 2, 3]) await h.act({ k: "acquire", target: id });
    await h.wait(240);
    await h.act({ k: "whistle", id: "doubt" });
    await h.act({ k: "course", deg: 90 });
    await h.wait(1800);
    h.s.finish(h.w, h.a);
    expect(item(h, "doubt").ok).toBe(false);
    expect(item(h, "again").ok).toBe(true);
    expect(item(h, "again").student).toMatch(/never closer than|never came back/);
    expect(item(h, "safe").ok).toBe(true);
  });
});
