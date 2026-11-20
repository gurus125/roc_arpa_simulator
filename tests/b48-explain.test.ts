import { describe, expect, it } from "vitest";
import { ArpaExercise, DirectHost, ROBOT_EXERCISES, explainTask } from "../src/train/index";
import { resultHtml } from "../src/ui/train-ui";

/**
 * The trainee's own debrief (b48): each answer keeps the reason for the correct answer, worked from the display at the
 * moment it was given; every other item gets its reason at Finish; the result shows them under "Why", except in an
 * examination.
 */
const ex = (id: string): ArpaExercise => ROBOT_EXERCISES.find((e) => e.id === id)!;
function session(id: string): DirectHost {
  const h = new DirectHost(ex(id), 3);
  h.s.explain = (t, c) => explainTask(ex(id), t, c);
  return h;
}

describe("the working behind the trainee's answers", () => {
  it("an ARPA answer keeps the reason and the working from the ARPA's data at that moment", async () => {
    const h = session("arpa-1");
    for (const id of [1, 2, 3]) await h.act({ k: "acquire", target: id });
    await h.wait(200);
    // A wrong answer on purpose: the reason is for the correct one.
    expect(h.s.answer(h.w, h.a, "cpaA", 3.3)).toBe(true);
    const a = h.s.answers.get("cpaA")!;
    expect(a.ok).toBe(false);
    expect(a.why?.title).toMatch(/^CPA of Ship A from the ARPA data: \d/);
    expect(a.why?.look).toMatch(/TARGET DATA/);
    const work = a.why!.working!.join("\n");
    expect(work).toMatch(/CPA = range × sin\(angle\)/);
    expect(work).toMatch(/The value checked: .* credited within ±/);
    // Kept as it was: later changes on the screen do not alter it.
    const saved = JSON.stringify(a.why);
    await h.wait(120);
    expect(JSON.stringify(h.s.answers.get("cpaA")!.why)).toBe(saved);
    const r = h.s.finish(h.w, h.a);
    const item = r.items.find((i) => i.id === "cpaA")!;
    expect(JSON.stringify(item.why)).toBe(saved);
    // Items not answered, actions and outcomes get their reason at Finish.
    expect(r.items.find((i) => i.id === "danger")!.why?.reason).toMatch(/smallest CPA/);
    expect(r.items.find((i) => i.id === "acq")!.why?.rule).toMatch(/Rule 7/);
  });

  it("without steady data the reason says what to do", async () => {
    const h = session("arpa-1");
    await h.wait(30);
    expect(h.s.answer(h.w, h.a, "cpaA", 1)).toBe(true);
    expect(h.s.answers.get("cpaA")!.why!.reason).toMatch(/not tracked with steady data/);
  });

  it("a plotting answer is worked from a perfect plot, with the triangle for course and speed", async () => {
    const h = session("plot-01");
    await h.wait(360);
    expect(h.s.answer(h.w, h.a, "crs0", 100)).toBe(true);
    const w = h.s.answers.get("crs0")!.why!;
    const work = w.working!.join("\n");
    expect(work).toMatch(/O, first plot at/);
    expect(work).toMatch(/W to A = W to O \+ O to A/);
    // The course the triangle gives is the target's real course (255°, plotting exercise 1).
    expect(work).toMatch(/so her course is 255°/);
  });

  it("the radar fix is worked from the range and bearing of Malabar Point", async () => {
    const h = session("radar-23");
    await h.wait(10);
    expect(h.s.answer(h.w, h.a, "lat", 50)).toBe(true);
    const work = h.s.answers.get("lat")!.why!.working!.join("\n");
    expect(work).toMatch(/Malabar Point 18°56\.9'N/);
    expect(work).toMatch(/minutes north of 18° = \d+\.\d/);
  });

  it("the result shows the working under each item, but not in an examination", async () => {
    const h = session("arpa-5");
    for (const id of [1, 2, 3, 4]) await h.act({ k: "acquire", target: id });
    await h.wait(200);
    h.s.answer(h.w, h.a, "who", 1);
    const r = h.s.finish(h.w, h.a);
    const html = resultHtml(r);
    expect(html).toMatch(/<tr class="whyRow">/);
    expect(html).toMatch(/Why, and what is right/);
    expect(html).toMatch(/dangerous-target alarm/);
    expect(resultHtml(r, { working: false })).not.toMatch(/whyRow/);
  });
});
