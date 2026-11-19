import { describe, expect, it } from "vitest";
import { ARPA_EXERCISES, ArpaExSession } from "../src/train/index";
import { ArpaSystem } from "../src/arpa/index";
import { createWorld, stepWorld } from "../src/engine/index";

/**
 * Found while building the robot student: in exercise 2 Ship F keeps own ship's course and speed, so it has no
 * relative motion. On a display own ship's speed wanders by a few hundredths of a knot, and the CPA worked from that
 * tiny difference could come out smaller than Ship D's, so "whose relative vector points at own ship" was keyed as
 * Ship F at some moments. A ship without relative motion is now left out of that question.
 */
describe("closest-ship questions ignore a ship with no relative motion", () => {
  it("exercise 2: Ship D (by design on a collision course) whatever small change of own speed", () => {
    const ex = ARPA_EXERCISES.find((e) => e.id === "arpa-2")!;
    for (const dv of [-0.08, -0.03, 0, 0.03, 0.08]) {
      for (const dc of [-0.3, 0, 0.3]) {
        const w = createWorld(ex.scenario, 62);
        w.own.speedThroughWater += dv;
        w.own.ordered.speed += dv;
        w.own.heading += dc;
        w.own.ordered.course += dc;
        for (let i = 0; i < 120; i++) stepWorld(w, 1);
        const a = new ArpaSystem(w);
        const s = new ArpaExSession(ex, w, a);
        const t = ex.tasks.find((x) => x.id === "coll")!;
        if (t.kind !== "choice") throw new Error("coll is a choice");
        expect(t.choices[t.correct(s.ctx(w, a))], `own speed ${dv} kn, course ${dc} deg`).toBe("Ship D");
      }
    }
  });
});
