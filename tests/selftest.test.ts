import { describe, expect, it } from "vitest";
import { SELF_TEST_EXERCISES, selfTestExercise } from "../src/train/index";

describe("self-test: three robots work every exercise", () => {
  for (const ex of SELF_TEST_EXERCISES) {
    it(`${ex.number}. ${ex.title}`, () => {
      const row = selfTestExercise(ex);
      expect(row.problems).toEqual([]);
      expect(row.ok).toBe(true);
    });
  }
});

describe("the self-test notices a broken exercise", () => {
  const base = SELF_TEST_EXERCISES.find((e) => e.id === "arpa-1")!;
  it("a task that can never be done is reported", () => {
    const broken = { ...base, tasks: [...base.tasks, { id: "never", kind: "action" as const, prompt: "Impossible task", done: () => false }] };
    const row = selfTestExercise(broken);
    expect(row.ok).toBe(false);
    expect(row.problems.join(" ")).toContain("Impossible task");
  });
  it("marking that accepts a wrong answer is reported", () => {
    const broken = { ...base, tasks: base.tasks.map((t) => (t.kind === "number" ? { ...t, tol: () => 1e6 } : t)) };
    const row = selfTestExercise(broken);
    expect(row.ok).toBe(false);
    expect(row.problems.some((p) => p.startsWith("Wrong answer accepted"))).toBe(true);
  });
  it("an outcome that succeeds when nothing is done is reported", () => {
    const broken = { ...base, tasks: [...base.tasks, { id: "free", kind: "outcome" as const, prompt: "Always passes", judge: () => ({ ok: true, detail: "" }) }] };
    const row = selfTestExercise(broken);
    expect(row.problems.some((p) => p.startsWith("Idle robot passed every outcome"))).toBe(true);
  });
  it("a plotting exercise that cannot be passed is reported", () => {
    const plot = SELF_TEST_EXERCISES.find((e) => e.id === "plot-01")!;
    const broken = { ...plot, tasks: plot.tasks.map((t) => (t.id === "result" ? { ...t, kind: "outcome" as const, judge: () => ({ ok: false, detail: "never" }) } : t)) };
    expect(selfTestExercise(broken).problems[0]).toContain("No manoeuvre");
  });
});
