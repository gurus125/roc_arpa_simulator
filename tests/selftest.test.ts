import { describe, expect, it } from "vitest";
import { SELF_TEST_EXERCISES, selfTestExercise } from "../src/train/index";

/**
 * The self-test, part 1 of 3: three robots work exercises 1 to 10 (of the list SELF_TEST_EXERCISES). The list is
 * cut in three files so that the test runner can work them side by side on a computer with several cores.
 */
describe("self-test: three robots work every exercise", () => {
  for (const ex of SELF_TEST_EXERCISES.slice(0, 10)) {
    it(`${ex.number}. ${ex.title}`, () => {
      const row = selfTestExercise(ex);
      expect(row.problems).toEqual([]);
      expect(row.ok).toBe(true);
    });
  }
});
