import { describe, expect, it } from "vitest";
import { ROBOT_EXERCISES, ROBOT_LEVELS, readAs, robotDirect, robotLevel } from "../src/train/robot-student";
import { ARPA_EXERCISES, PLOTTING_EXERCISES, RADAR_EXERCISES, SessionRecord, classComparison, traineeAttempts, traineeKeys, traineeNames, traineeRecords } from "../src/train/index";

/**
 * The robot student (train/robot-student.ts), worked directly on the simulation. What is checked:
 *  - it can work every exercise of the ARPA EX list, and at level 5 every item is credited;
 *  - the same level and seed give the same run;
 *  - a lower level scores lower on average, and every mistake it makes is written in its log;
 *  - its records are never counted as a trainee's.
 * The answer key itself is not checked here (the robot answers from it): the exercises' own tests do that.
 */
describe("robot student", () => {
  it("knows every exercise of the ARPA EX list, in number order", () => {
    const all = [...ARPA_EXERCISES, ...RADAR_EXERCISES, ...PLOTTING_EXERCISES];
    expect(ROBOT_EXERCISES.map((e) => e.id).sort()).toEqual(all.map((e) => e.id).sort());
    expect(ROBOT_EXERCISES.map((e) => e.number)).toEqual(Array.from({ length: all.length }, (_, i) => i + 1));
  });

  it("has five levels, from many mistakes to none", () => {
    expect(ROBOT_LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < 5; i++) {
      const lo = ROBOT_LEVELS[i - 1]!, hi = ROBOT_LEVELS[i]!;
      for (const k of ["misread", "wrongChoice", "forget", "smallAction", "lateAction", "portTurn", "setupSlip"] as const) expect(hi[k]).toBeLessThanOrEqual(lo[k]);
    }
    const top = robotLevel(5);
    expect([top.misread, top.wrongChoice, top.forget, top.smallAction, top.lateAction, top.portTurn, top.setupSlip]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(robotLevel(0).level).toBe(1);
    expect(robotLevel(9).level).toBe(5);
  });

  it("reads values as a display shows them", () => {
    // Worked by hand: courses to the whole degree (tenths when the tolerance is under 2 degrees), distances to 0.1 NM
    // (0.01 NM when the tolerance is under 0.3 NM), round the circle for courses.
    expect(readAs({ unit: "°", circular: true }, 7, 359.6)).toBe(0);
    expect(readAs({ unit: "°", circular: true }, 7, 123.4)).toBe(123);
    expect(readAs({ unit: "°" }, 1, 3.96)).toBe(4);
    expect(readAs({ unit: "°" }, 1, 3.94)).toBe(3.9);
    expect(readAs({ unit: "NM" }, 0.5, 0.8333)).toBe(0.8);
    expect(readAs({ unit: "NM" }, 0.1, 4.8361)).toBe(4.84);
    expect(readAs({ unit: "min" }, 2, 19.7000001)).toBe(19.7);
  });

  it("at level 5 works every exercise with every item credited and no mistakes", async () => {
    for (const ex of ROBOT_EXERCISES) {
      const r = await robotDirect(ex, 5, 1);
      const bad = r.result?.items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.student}`) ?? ["no result"];
      expect(bad, `${ex.number}. ${ex.title}`).toEqual([]);
      expect(r.result?.percent).toBe(100);
      expect(r.mistakes).toEqual([]);
      expect(r.log.some((l) => l.kind === "mistake")).toBe(false);
      // It pressed Finish and wrote its debrief.
      expect(r.log.some((l) => l.kind === "result")).toBe(true);
    }
  }, 120_000);

  it("gives the same run for the same level and seed", async () => {
    const ex = ROBOT_EXERCISES.find((e) => e.id === "arpa-6")!;
    const a = await robotDirect(ex, 3, 4);
    const b = await robotDirect(ex, 3, 4);
    expect(b.result?.items).toEqual(a.result?.items);
    expect(b.log).toEqual(a.log);
    expect(b.mistakes).toEqual(a.mistakes);
  }, 60_000);

  it("scores lower at a lower level, and writes down every mistake", async () => {
    const ids = ["arpa-1", "arpa-2", "arpa-5", "arpa-7", "arpa-31", "radar-22", "plot-01", "plot-08"];
    const mean: Record<number, number> = {};
    for (const level of [1, 3, 5]) {
      let sum = 0, n = 0;
      for (const id of ids) {
        for (const seed of [1, 2, 3]) {
          const r = await robotDirect(ROBOT_EXERCISES.find((e) => e.id === id)!, level, seed);
          sum += r.result?.percent ?? 0;
          n++;
          // Every mistake is in the log, in the same words; a run with no mistakes has none there.
          expect(r.log.filter((l) => l.kind === "mistake").map((l) => l.text)).toEqual(r.mistakes);
          // A run that lost marks at level 5 would be a fault of the robot, not a mistake on purpose.
          if (level === 5) expect(r.result?.percent).toBe(100);
        }
      }
      mean[level] = sum / n;
    }
    expect(mean[5]).toBe(100);
    expect(mean[3]!).toBeLessThan(mean[5]!);
    expect(mean[1]!).toBeLessThan(mean[3]!);
    expect(mean[1]!).toBeLessThan(85);
  }, 120_000);

  it("is never counted as a trainee", () => {
    const base = (id: string, students: string[], robot?: SessionRecord["robot"]): SessionRecord => ({
      id, exerciseId: "arpa-1", title: "ARPA 1", kind: "arpa", students, batch: "B1", startedIso: `2026-11-19T10:0${id}:00Z`, simSeconds: 300,
      names: {}, coasts: [], frames: [], events: [], result: null, summary: [], ...(robot ? { robot } : {}),
    });
    const recs = [base("1", ["Asha"]), base("2", ["Robot student (level 3)"], { level: 3, seed: 1 }), base("3", ["Asha"], { level: 5, seed: 2, takenOverAt: 120 })];
    expect(traineeRecords(recs).map((r) => r.id)).toEqual(["1"]);
    expect(traineeNames(recs)).toEqual(["Asha"]);
    expect(traineeKeys(recs)).toEqual([{ name: "Asha", batch: "B1" }]);
    expect(traineeAttempts(recs, "Asha").length).toBe(1);
    expect(traineeAttempts(recs, "Robot student (level 3)")).toEqual([]);
    expect(classComparison(recs, "arpa-1").map((r) => r.recId)).toEqual(["1"]);
  });
});
