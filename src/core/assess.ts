import { angleDiffDeg } from "./vec";

/**
 * Answer checking for the ROC plotting exercises.
 *
 * IMPORTANT: the tolerances below are PLACEHOLDERS. The academy handouts do not state pass
 * marks or accuracy limits. Replace them with the figures from the approved DG Shipping
 * course documents or the instructor's marking scheme.
 */
export interface Answer {
  relativeCourse: number;
  relativeSpeed: number;
  trueCourse: number;
  trueSpeed: number;
  cpa: number;
  tcpaMinutes: number;
}

export interface Tolerances {
  courseDeg: number;
  speedKn: number;
  cpaNm: number;
  tcpaMinutes: number;
}

export const PLACEHOLDER_TOLERANCES: Tolerances = {
  courseDeg: 3,
  speedKn: 0.5,
  cpaNm: 0.2,
  tcpaMinutes: 1.5,
};

export interface AnswerCheck {
  field: keyof Answer;
  student: number;
  correct: number;
  ok: boolean;
}

export function checkAnswer(
  student: Answer,
  correct: Answer,
  tol: Tolerances = PLACEHOLDER_TOLERANCES,
): { checks: AnswerCheck[]; fractionCorrect: number } {
  const within = (field: keyof Answer): boolean => {
    const s = student[field];
    const c = correct[field];
    switch (field) {
      case "relativeCourse":
      case "trueCourse":
        return Math.abs(angleDiffDeg(s, c)) <= tol.courseDeg;
      case "relativeSpeed":
      case "trueSpeed":
        return Math.abs(s - c) <= tol.speedKn;
      case "cpa":
        return Math.abs(s - c) <= tol.cpaNm;
      case "tcpaMinutes":
        return Math.abs(s - c) <= tol.tcpaMinutes;
    }
  };
  const fields: (keyof Answer)[] = ["relativeCourse", "relativeSpeed", "trueCourse", "trueSpeed", "cpa", "tcpaMinutes"];
  const checks = fields.map((field) => ({ field, student: student[field], correct: correct[field], ok: within(field) }));
  return { checks, fractionCorrect: checks.filter((c) => c.ok).length / checks.length };
}

/**
 * Result of a collision-avoidance exercise as a percentage of the required passing distance,
 * by the rule shown in the Learnmarine radar plotting trainer (supplied by the academy as a
 * reference): passing closer than required scores the fraction achieved (required 1 NM,
 * actual 0.87 NM: 87%); passing wider than required is penalised at half that rate (required
 * 1 NM, actual 1.3 NM: 85%). Whole per cent, rounded down; never below zero.
 */
export function requiredCpaScore(requiredNm: number, actualNm: number): number {
  if (requiredNm <= 0) return 0;
  const ratio = actualNm / requiredNm;
  const pct = ratio <= 1 ? ratio * 100 : 100 - ((ratio - 1) * 100) / 2;
  return Math.max(0, Math.floor(pct + 1e-9));
}
