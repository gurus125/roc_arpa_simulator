import { describe, expect, it } from "vitest";
import { Vec2, angleDiffDeg, length, scale, sub, velocityOf } from "../src/core/vec";
import { Scenario, TRAFFIC_RULES, World, createWorld, setShipBehaviour, stepTraffic, stepWorld } from "../src/engine/index";

/**
 * Other ships that keep the collision regulations (engine/traffic-rules.ts). Own ship 000° at 12 kn holds on; one
 * other ship is put on a collision course (she would pass at 0 NM after `tcpaMin` minutes) from a chosen side. The
 * expected behaviour comes from the rules in words: a give-way ship alters to starboard in good time; a stand-on ship
 * holds on until the last moment; in restricted visibility a ship alters to starboard for own ship forward of her
 * beam; "wrong" turns the first ship to act to port.
 */
const OWN = { heading: 0, speed: 12 };
/** A ship of course `course` and speed `speed` that meets own ship (passing at 0 NM) after `tcpaMin` minutes. */
function collider(course: number, speed: number, tcpaMin: number): Scenario["targets"][number] {
  const relVel = sub(velocityOf({ course, speed }), velocityOf({ course: OWN.heading, speed: OWN.speed }));
  const pos: Vec2 = scale(relVel, -tcpaMin / 60);
  return { id: 1, name: "Ship X", kind: "ship", pos, course, speed, rcs: 1, height: 20, events: [] };
}
function world(t: Scenario["targets"][number], visibilityNm?: number): World {
  const sc: Scenario = { id: "t", name: "t", description: "", own: OWN, env: { seaState: 1, ...(visibilityNm ? { visibilityNm } : {}) }, coasts: [], targets: [t] };
  return createWorld(sc, 50);
}
/** Run for `sec` seconds; returns the closest the ship came and her courses seen. */
function run(w: World, sec: number): { closest: number; courses: number[] } {
  let closest = Infinity;
  const courses: number[] = [];
  for (let i = 0; i < sec; i++) {
    stepWorld(w, 1);
    stepTraffic(w, 1);
    const t = w.targets[0]!;
    closest = Math.min(closest, length(sub(t.pos, w.own.pos)));
    if (i % 30 === 0) courses.push(t.course);
  }
  return { closest, courses };
}

describe("other ships keep the collision regulations", () => {
  it("hold: nothing changes", () => {
    const w = world(collider(90, 12, 20));
    const r = run(w, 25 * 60);
    expect(r.closest).toBeLessThan(0.1);
    expect(w.traffic).toBeUndefined();
  });

  it("a ship with own ship on her starboard side gives way: to starboard, in good time, and resumes when clear", () => {
    // Coming from own ship's port side on 090°: own ship is on her starboard side (rule 15), she gives way.
    const w = world(collider(90, 12, 20));
    setShipBehaviour(w, "rules");
    const r = run(w, 40 * 60);
    const log = w.traffic!.log.map((e) => e.text);
    expect(log[0]).toMatch(/alters \d+° to starboard.*rules 15 and 16/);
    // She acted while the TCPA was still under the limit but well before close quarters.
    expect(w.traffic!.log[0]!.t).toBeGreaterThan((20 - TRAFFIC_RULES.actTcpaMin - 0.5) * 60);
    expect(w.traffic!.log[0]!.t).toBeLessThan((20 - TRAFFIC_RULES.actTcpaMin + 1) * 60);
    // Altered to starboard (course went up from 090°), passed clear, and went back to 090°.
    expect(Math.max(...r.courses.map((c) => angleDiffDeg(c, 90)))).toBeGreaterThan(15);
    expect(r.closest).toBeGreaterThan(1.0);
    expect(log.some((t) => /past and clear: back to 090°/.test(t))).toBe(true);
    expect(Math.abs(angleDiffDeg(w.targets[0]!.course, 90))).toBeLessThan(1);
  });

  it("a stand-on ship holds on, and acts herself only at the last moment", () => {
    // Coming from own ship's starboard side on 270°: own ship is the give-way vessel and (here) does nothing.
    const w = world(collider(270, 12, 20));
    setShipBehaviour(w, "rules");
    run(w, 12 * 60);
    // At 8 minutes before the CPA she has not moved (rule 17(a)(i)).
    expect(w.traffic!.log).toEqual([]);
    expect(Math.abs(angleDiffDeg(w.targets[0]!.course, 270))).toBeLessThan(0.5);
    const r = run(w, 15 * 60);
    const first = w.traffic!.log[0]!;
    expect(first.text).toMatch(/to starboard.*rule 17/);
    expect(first.t).toBeGreaterThan((20 - TRAFFIC_RULES.lastMomentTcpaMin) * 60 - 15);
    expect(r.closest).toBeGreaterThan(0.2);
  });

  it("meeting end-on, she alters to starboard (rule 14)", () => {
    const w = world(collider(180, 12, 20));
    setShipBehaviour(w, "rules");
    run(w, 20 * 60);
    expect(w.traffic!.log[0]!.text).toMatch(/to starboard.*rule 14/);
  });

  it("in restricted visibility she alters to starboard for own ship forward of her beam (rule 19(d))", () => {
    const w = world(collider(270, 12, 20), 0.5);
    setShipBehaviour(w, "rules");
    run(w, 20 * 60);
    expect(w.traffic!.log[0]!.text).toMatch(/to starboard.*rule 19\(d\)/);
  });

  it("wrong: the first ship to act turns to port instead", () => {
    const w = world(collider(270, 12, 20), 0.5);
    setShipBehaviour(w, "wrong");
    const r = run(w, 14 * 60);
    expect(w.traffic!.wrongId).toBe(1);
    expect(w.traffic!.log[0]!.text).toMatch(/to PORT/);
    // Her course went down from 270° (a turn to port).
    expect(Math.min(...r.courses.map((c) => angleDiffDeg(c, 270)))).toBeLessThan(-15);
  });

  it("ships at anchor, on a track or with a script still to come are left alone", () => {
    const t = { ...collider(90, 12, 20), events: [{ atSeconds: 3000, course: 45 }] };
    const w = world(t);
    setShipBehaviour(w, "rules");
    run(w, 15 * 60);
    expect(w.traffic!.log).toEqual([]);
  });

  it("the behaviour is plain data, copied with the world (rewind)", () => {
    const w = world(collider(90, 12, 20));
    setShipBehaviour(w, "rules");
    run(w, 10 * 60);
    const copy = structuredClone(w);
    expect(copy.traffic).toEqual(w.traffic);
  });
});
