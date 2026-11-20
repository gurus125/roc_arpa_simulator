import { describe, expect, it } from "vitest";
import { computeCpa, cpaWorking } from "../src/core/cpa";
import { markFixWorking } from "../src/core/nav";
import { DirectHost, ROBOT_EXERCISES, RobotLogEntry, robotDirect, runRobotStudent } from "../src/train/robot-student";

/**
 * The robot student explains itself (b47): the core helpers its working uses, worked by hand, and the reasons it
 * gives: one before every answer and decision, with the value it then types, and a lesson after each mistake.
 */
describe("cpaWorking: the CPA worked as on a plotting sheet", () => {
  it("matches a hand-worked closing target", () => {
    // Target bearing 000°, 10 NM; relative motion towards 200° at 20 kn. The line from her to own ship runs 180°,
    // so the angle is 20°: CPA = 10 sin 20° = 3.4202 NM; run = 10 cos 20° = 9.3969 NM; TCPA = 9.3969 / 20 × 60 = 28.191 min.
    const rel = { e: 0, n: 10 };
    const v = { e: 20 * Math.sin((200 * Math.PI) / 180), n: 20 * Math.cos((200 * Math.PI) / 180) };
    const k = cpaWorking(rel, v);
    expect(k.rangeNm).toBeCloseTo(10, 9);
    expect(k.bearingDeg).toBeCloseTo(0, 9);
    expect(k.relCourseDeg).toBeCloseTo(200, 9);
    expect(k.relSpeedKn).toBeCloseTo(20, 9);
    expect(k.angleDeg).toBeCloseTo(20, 9);
    expect(k.cpaNm).toBeCloseTo(3.4202, 4);
    expect(k.runToCpaNm).toBeCloseTo(9.3969, 4);
    expect(k.tcpaMin!).toBeCloseTo(28.191, 3);
  });

  it("matches a hand-worked opening target, and agrees with computeCpa", () => {
    // Bearing 090°, 4 NM; relative motion towards 045° at 10 kn. Line to own ship 270°: angle 135°, opening.
    // CPA = 4 sin 135° = 2.8284; run = 4 cos 135° = −2.8284 NM; TCPA = −2.8284 / 10 × 60 = −16.97 min.
    const rel = { e: 4, n: 0 };
    const v = { e: 10 * Math.SQRT1_2, n: 10 * Math.SQRT1_2 };
    const k = cpaWorking(rel, v);
    expect(k.angleDeg).toBeCloseTo(135, 9);
    expect(k.cpaNm).toBeCloseTo(2.8284, 4);
    expect(k.tcpaMin!).toBeCloseTo(-16.97, 2);
    const c = computeCpa(rel, v);
    expect(k.cpaNm).toBeCloseTo(c.cpa, 9);
    expect(k.tcpaMin!).toBeCloseTo(c.tcpaMinutes!, 9);
  });

  it("a collision course has a zero angle and CPA", () => {
    const k = cpaWorking({ e: 6 * Math.SQRT1_2, n: 6 * Math.SQRT1_2 }, { e: -12 * Math.SQRT1_2, n: -12 * Math.SQRT1_2 });
    expect(k.angleDeg).toBeCloseTo(0, 6);
    expect(k.cpaNm).toBeCloseTo(0, 6);
    expect(k.tcpaMin!).toBeCloseTo(30, 6);
  });
});

describe("markFixWorking: a fix from one mark's range and bearing", () => {
  it("matches a hand-worked plane sailing fix", () => {
    // Mark 18°56.9'N 072°47.5'E bears 060° at 6 NM. d.lat = −6 cos 60° = −3.0'; departure = −6 sin 60° = −5.1962 NM;
    // cos(18°56.9') = cos 18.9483° = 0.94581, so d.long = −5.1962 / 0.94581 = −5.4939'.
    // Own ship: 18°53.9'N 072°42.006'E.
    const f = markFixWorking({ lat: 18 + 56.9 / 60, lon: 72 + 47.5 / 60 }, 60, 6);
    expect(f.dLatMin).toBeCloseTo(-3, 6);
    expect(f.depNm).toBeCloseTo(-5.1962, 4);
    expect(f.dLonMin).toBeCloseTo(-5.4939, 3);
    expect((f.lat - 18) * 60).toBeCloseTo(53.9, 6);
    expect((f.lon - 72) * 60).toBeCloseTo(42.006, 2);
  });
});

/** A direct host that records when the robot stops to teach, in the same timeline as its log. */
class TeachHost extends DirectHost {
  readonly timeline: string[] = [];
  override log(e: RobotLogEntry): void {
    super.log(e);
    this.timeline.push(`${e.kind}:${e.text}`);
  }
  async teach(e: RobotLogEntry): Promise<void> {
    this.timeline.push(`TEACH:${e.text}`);
  }
}

describe("the robot's reasons", () => {
  it("before every answer it gives the reason, with the value it then types; numbers are read off the screen", async () => {
    for (const ex of ROBOT_EXERCISES) {
      const r = await robotDirect(ex, 5, 1);
      const log = r.log;
      log.forEach((l, i) => {
        if (l.kind !== "answer") return;
        // The last reason before the answer is about this question, and its title ends with the answer given.
        const why = [...log.slice(0, i)].reverse().find((x) => x.kind === "why");
        const given = l.text.replace(/^Answers "(.*)": /, "");
        expect(why, `${ex.id}: ${l.text}`).toBeDefined();
        expect(why!.text.endsWith(given), `${ex.id}: "${why!.text}" against "${given}"`).toBe(true);
        expect(why!.why!.reason.length).toBeGreaterThan(20);
        // At level 5 every number comes from something on the screen (or the plot), never from the fallback.
        expect(why!.why!.reason, `${ex.id}: ${l.text}`).not.toMatch(/no steady data on the screen/);
      });
    }
  }, 120_000);

  it("the working agrees with the answer typed", async () => {
    const checked = { cpa: 0, crs: 0, lat: 0 };
    for (const id of ["arpa-1", "radar-25", "plot-01", "plot-07", "radar-23"]) {
      const r = await robotDirect(ROBOT_EXERCISES.find((e) => e.id === id)!, 5, 1);
      for (const w of r.log.filter((l) => l.kind === "why" && l.why?.working)) {
        const lines = w.why!.working!.join("\n");
        // A CPA answer: the CPA worked out in the working rounds to the value given.
        const cpa = /CPA = range × sin\(angle\) = .* = (\d+\.\d+) NM/.exec(lines);
        const ans = /: (\d+(?:\.\d+)?) NM$/.exec(w.text);
        if (cpa && ans && /CPA/.test(w.text) && !/TCPA/.test(w.text)) {
          expect(Math.abs(Number(cpa[1]) - Number(ans[1]))).toBeLessThanOrEqual(0.051);
          checked.cpa++;
        }
        // A true course from the plot: the triangle's course is the one given.
        const crs = /so her course is (\d{3})°/.exec(lines);
        const ansCrs = /true course: (\d+(?:\.\d+)?)°$/.exec(w.text);
        if (crs && ansCrs) {
          expect(Math.abs(((Number(crs[1]) - Number(ansCrs[1]) + 540) % 360) - 180)).toBeLessThanOrEqual(1);
          checked.crs++;
        }
        // The radar fix: the latitude worked is the one given.
        const lat = /minutes north of 18° = (\d+\.\d)/.exec(lines);
        const ansLat = /\(for example 51\.3\): (\d+(?:\.\d+)?)'$/.exec(w.text);
        if (lat && ansLat) {
          expect(Number(lat[1])).toBeCloseTo(Number(ansLat[1]), 1);
          checked.lat++;
        }
      }
    }
    // Each kind of check was made (arpa-1 and radar-25 CPAs, the two plots' CPA and course, the fix).
    expect(checked.cpa).toBeGreaterThanOrEqual(5);
    expect(checked.crs).toBe(2);
    expect(checked.lat).toBe(1);
  }, 60_000);

  it("explains its plan, its avoiding action and the trial it used", async () => {
    const r = await robotDirect(ROBOT_EXERCISES.find((e) => e.id === "arpa-9")!, 5, 1);
    const whys = r.log.filter((l) => l.kind === "why");
    expect(whys[0]!.text).toBe("My plan for exercise 9");
    const decision = whys.find((l) => /^Decision: \d+° to starboard/.test(l.text));
    expect(decision).toBeDefined();
    expect(decision!.why!.rule).toMatch(/Rule 8/);
    // The working lists the trial for each alteration tried, the last one the one chosen.
    const rows = decision!.why!.working!;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[rows.length - 1]).toMatch(/clears every ship/);
    expect(rows[rows.length - 1]!.startsWith(decision!.text.replace(/^Decision: (\d+)°.*/, "$1°"))).toBe(true);
    expect(whys.some((l) => /Restricted visibility: Rule 19/.test(l.text))).toBe(true);
  }, 60_000);

  it("after a mistake it says what was wrong and what is right", async () => {
    let seen = 0;
    for (const id of ["arpa-1", "arpa-2", "arpa-5", "arpa-9", "plot-01", "radar-22", "radar-29"]) {
      for (const seed of [1, 2, 3]) {
        const r = await robotDirect(ROBOT_EXERCISES.find((e) => e.id === id)!, 1, seed);
        for (const m of r.log.filter((l) => l.kind === "mistake")) {
          // Every mistake but a repeat of a late acknowledgement carries its lesson.
          if (/unacknowledged/.test(m.text) && !m.why) continue;
          expect(m.why, `${id}/${seed}: ${m.text}`).toBeDefined();
          expect(m.why!.title).toBe(`Mistake: ${m.text}`);
          expect(m.why!.reason.length).toBeGreaterThan(20);
          seen++;
        }
        // A wrong choice names the right answer.
        for (const m of r.log.filter((l) => l.kind === "mistake" && l.text.startsWith("Chose"))) expect(m.why!.reason).toMatch(/^The right answer is "/);
      }
    }
    expect(seen).toBeGreaterThan(10);
  }, 120_000);

  it("with TEACH it stops at each reason before it acts on it", async () => {
    const ex = ROBOT_EXERCISES.find((e) => e.id === "arpa-1")!;
    const host = new TeachHost(ex, 1);
    const run = await runRobotStudent(ex, host, 5, 1);
    expect(run.result?.percent).toBe(100);
    const tl = host.timeline;
    const whys = tl.filter((x) => x.startsWith("why:"));
    // Every reason is stepped through, in order.
    expect(tl.filter((x) => x.startsWith("TEACH:")).map((x) => x.slice(6))).toEqual(whys.map((x) => x.slice(4)));
    // Each answer comes after the stop at its reason.
    tl.forEach((x, i) => {
      if (!x.startsWith("answer:")) return;
      const lastWhy = tl.slice(0, i).map((y, j) => ({ y, j })).reverse().find((z) => z.y.startsWith("why:"))!;
      expect(tl.slice(lastWhy.j, i).some((y) => y === `TEACH:${lastWhy.y.slice(4)}`)).toBe(true);
    });
  }, 60_000);
});
