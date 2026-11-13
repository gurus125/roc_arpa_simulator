import { describe, expect, it } from "vitest";
import { ArpaExercise, PLACEHOLDER_SCORING, SELF_TEST_EXERCISES, ScoringConfig, markingSheetHtml, markingSheetsHtml, syllabusRefs, taskCriteria } from "../src/train/index";

const byId = (id: string): ArpaExercise => SELF_TEST_EXERCISES.find((e) => e.id === id)!;
const cfgCopy = (): ScoringConfig => JSON.parse(JSON.stringify(PLACEHOLDER_SCORING)) as ScoringConfig;
const escHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

describe("marking sheets", () => {
  it("every exercise has a syllabus reference and a sheet listing all of its tasks", () => {
    expect(SELF_TEST_EXERCISES.length).toBe(26);
    for (const ex of SELF_TEST_EXERCISES) {
      expect(syllabusRefs(ex), ex.id).not.toBeNull();
      const html = markingSheetHtml(ex, PLACEHOLDER_SCORING);
      expect(html).toContain(`exercise ${ex.number}. ${escHtml(ex.title)}`);
      expect(html).toContain("DRAFT for the institute to complete");
      expect(html).toContain("not type approved, not for navigation");
      for (const t of ex.tasks) expect(html, `${ex.id} ${t.id}`).toContain(escHtml(t.prompt));
      // One row per task in the first table, plus the header, total and assessor rows.
      const first = html.split("What the assessor judges")[0]!;
      expect((first.match(/<tr><td>\d+<\/td>/g) ?? []).length).toBe(ex.tasks.length);
    }
  });

  it("prints the values in use: tolerances, points, the Rule 8 and Rule 19(d) limits and the pass mark", () => {
    const html = markingSheetHtml(byId("radar-25"), PLACEHOLDER_SCORING);
    expect(html).toContain("±0.5 NM"); // CPA tolerance
    expect(html).toContain("±2 min"); // TCPA tolerance
    expect(html).toContain("a turn of at least 30° or a cut to 50% of the speed or less (Rule 8(b))");
    expect(html).toContain("Rule 19(d)");
    expect(html).toContain("none set (the simulator shows no pass or fail)");
    const cfg = cfgCopy();
    cfg.tol.cpaNm = 0.3;
    cfg.substantialTurnDeg = 40;
    cfg.passPercent = 70;
    const own = markingSheetHtml(byId("radar-25"), cfg);
    expect(own).toContain("±0.3 NM");
    expect(own).toContain("a turn of at least 40°");
    expect(own).toContain("70%");
  });

  it("states the rule of every outcome in words", () => {
    for (const ex of SELF_TEST_EXERCISES) {
      for (const c of taskCriteria(ex, PLACEHOLDER_SCORING)) {
        if (c.kind === "outcome") expect(c.limit, `${ex.id} ${c.id}`).not.toBe("");
      }
    }
    const k = taskCriteria(byId("radar-26"), PLACEHOLDER_SCORING).find((c) => c.id === "action")!;
    expect(k.limit).not.toContain("Rule 19");
    expect(taskCriteria(byId("radar-22"), PLACEHOLDER_SCORING).find((c) => c.id === "final")!.limit).toContain("0.02 to 0.25");
  });

  it("puts each exercise on its own page and escapes the text", () => {
    const all = markingSheetsHtml(SELF_TEST_EXERCISES, PLACEHOLDER_SCORING);
    expect((all.match(/<section class="sheet">/g) ?? []).length).toBe(26);
    expect(all).toContain("page-break-after:always");
    const odd: ArpaExercise = { ...byId("arpa-1"), title: "A <b> & \"C\"", tasks: [{ id: "q", kind: "choice", prompt: "<script>x</script>", choices: ["a", "b"], correct: () => 0 }] };
    const html = markingSheetHtml(odd, PLACEHOLDER_SCORING);
    expect(html).toContain("A &lt;b&gt; &amp; &quot;C&quot;");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x");
  });
});
