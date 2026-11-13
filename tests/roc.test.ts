import { describe, expect, it } from "vitest";
import { createWorld, stepWorld } from "../src/engine/index";
import { rangeBearing, crossTrackError } from "../src/core/nav";
import { fromPolar, normalizeDeg } from "../src/core/vec";
import {
  EXERCISES, ExerciseDef, PlotAnswerInput, RocSession, computeFix, evaluateClearing, evaluatePilotage, evaluatePlot,
  evaluateSetDrift, evaluateTraffic, exerciseById, identify, matchTolerance, ROC_PLACEHOLDERS,
} from "../src/roc/index";

function start(id: ExerciseDef["id"]) {
  const ex = exerciseById(id);
  const world = createWorld(ex.scenario, 62);
  world.radar.controls.tuning = 62;
  const session = new RocSession(ex, world);
  return { ex, world, session };
}

function run(world: ReturnType<typeof createWorld>, session: RocSession, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds; i++) {
    each?.();
    stepWorld(world, 1);
    session.step(world);
  }
}

/** The student sets EBL/VRM exactly on the target and reads it. */
function observeExact(world: ReturnType<typeof createWorld>, session: RocSession, targetId: number) {
  const t = world.targets.find((x) => x.id === targetId)!;
  const rb = rangeBearing(world.own.pos, t.pos);
  return session.observe(world, rb.bearing, rb.range);
}

describe("exercise definitions", () => {
  it("has all six exercises with consistent data", () => {
    expect(EXERCISES.map((e) => e.id)).toEqual(["plot", "fix", "setdrift", "clearing", "pilotage", "traffic"]);
    for (const e of EXERCISES) {
      expect(e.steps.length).toBeGreaterThan(2);
      expect(e.scenario.targets.length).toBeGreaterThan(0);
    }
  });
  it("plot scenario: ship A is the phase 1 worked example", () => {
    const { world, session } = start("plot");
    const a = session.log.initial.find((e) => e.id === 1)!;
    expect(a.cpa.cpa).toBeCloseTo(0.5432, 3);
    expect(a.cpa.tcpaMinutes).toBeCloseTo(22.95, 1);
  });
  it("traffic scenario has several ships on collision courses and several safe ones", () => {
    const { ex, session } = start("traffic");
    const danger = session.log.initial.filter((e) => !e.cpa.opening && e.cpa.cpa < ex.safePassingNm);
    const safe = session.log.initial.filter((e) => e.cpa.cpa >= ex.safePassingNm);
    expect(danger.length).toBeGreaterThanOrEqual(4);
    expect(safe.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(danger.map((e) => e.hint.situation));
    expect(kinds.has("head-on")).toBe(true);
    expect(kinds.has("crossing")).toBe(true);
  });
});

describe("matching an observation to an echo", () => {
  it("matches a target and rejects empty water", () => {
    const { world } = start("plot");
    expect(identify(world, 45, 6.0, false)?.id).toBe(1);
    expect(identify(world, 120, 6.0, false)).toBeNull();
  });
  it("tolerance grows with range", () => {
    expect(matchTolerance(1)).toBeCloseTo(0.15, 9);
    expect(matchTolerance(10)).toBeGreaterThan(0.5);
  });
  it("position fixing only matches charted objects, not ships", () => {
    const { world } = start("plot");
    expect(identify(world, 45, 6.0, true)).toBeNull();
    const f = start("fix");
    const lh = rangeBearing(f.world.own.pos, f.world.targets.find((t) => t.id === 1)!.pos);
    expect(identify(f.world, lh.bearing, lh.range, true)?.name).toBe("Lighthouse");
  });
});

describe("manual plotting exercise", () => {
  function plot(errors: { [i: number]: { b?: number; r?: number } } = {}) {
    const { ex, world, session } = start("plot");
    const times = [0, 360, 720];
    let last = 0;
    times.forEach((t, i) => {
      run(world, session, t - last);
      last = t;
      const tgt = world.targets.find((x) => x.id === 1)!;
      const rb = rangeBearing(world.own.pos, tgt.pos);
      session.observe(world, rb.bearing + (errors[i]?.b ?? 0), rb.range + (errors[i]?.r ?? 0));
    });
    return { ex, world, session };
  }
  const rightAnswer: PlotAnswerInput = {
    relativeCourse: 219.8, relativeSpeed: 15.6, trueCourse: 270, trueSpeed: 10, cpa: 0.54, tcpaMinutes: 10.95,
    risk: true, situation: "crossing-give-way",
  };

  it("exact observations reproduce the worked example", () => {
    const { ex, session } = plot();
    const r = evaluatePlot(session.observations, rightAnswer, ex.safePassingNm);
    expect(r.valid).toBe(true);
    expect(r.fromPlot!.relativeCourse).toBeCloseTo(219.806, 1);
    expect(r.fromPlot!.trueCourse).toBeCloseTo(270, 0);
    expect(r.fromPlot!.trueSpeed).toBeCloseTo(10, 1);
    expect(r.fromPlot!.cpa).toBeCloseTo(0.543, 2);
    expect(r.fromPlot!.tcpaMinutes).toBeCloseTo(22.95 - 12, 1);
    expect(r.truth!.cpa).toBeCloseTo(0.543, 2);
    expect(r.truthRisk).toBe(true);
    expect(r.truthSituation).toBe("crossing-give-way");
    expect(r.studentVsPlot!.fractionCorrect).toBe(1);
    expect(r.studentVsTruth!.fractionCorrect).toBe(1);
    expect(r.riskOk).toBe(true);
    expect(r.situationOk).toBe(true);
    expect(r.messages.some((m) => m.level === "error")).toBe(false);
  });
  it("gives the target's aspect and marks the aspect reported", () => {
    // Worked by hand. After 12 minutes own ship is at (0, 2.4) and the target at (2.243, 4.243): it bears
    // atan2(2.243, 1.843) = 050.6. From the target own ship bears 230.6; the target steers 270, so own ship is
    // 39.4 degrees on its port bow: Red 39.
    const { ex, session } = plot();
    const none = evaluatePlot(session.observations, rightAnswer, ex.safePassingNm);
    expect(none.fromPlotAspect).toBeCloseTo(-39.4, 0);
    expect(none.truthAspect).toBeCloseTo(-39.4, 0);
    expect(none.aspectVsPlotOk).toBeUndefined();
    const red = evaluatePlot(session.observations, { ...rightAnswer, aspect: -39 }, ex.safePassingNm);
    expect(red.aspectVsPlotOk).toBe(true);
    expect(red.aspectVsTruthOk).toBe(true);
    const green = evaluatePlot(session.observations, { ...rightAnswer, aspect: 39 }, ex.safePassingNm);
    expect(green.aspectVsPlotOk).toBe(false);
    const far = evaluatePlot(session.observations, { ...rightAnswer, aspect: -39 - ROC_PLACEHOLDERS.aspectToleranceDeg - 2 }, ex.safePassingNm);
    expect(far.aspectVsTruthOk).toBe(false);
  });
  it("marks wrong answers and wrong COLREG situation", () => {
    const { ex, session } = plot();
    const r = evaluatePlot(session.observations, { ...rightAnswer, cpa: 2.0, tcpaMinutes: 30, situation: "crossing-stand-on" }, ex.safePassingNm);
    expect(r.studentVsPlot!.fractionCorrect).toBeCloseTo(4 / 6, 6);
    expect(r.situationOk).toBe(false);
    expect(r.riskOk).toBe(true);
  });
  it("a misread middle observation warns that the points are not on a straight line", () => {
    const { ex, session } = plot({ 1: { b: 2.8 } });
    const r = evaluatePlot(session.observations, null, ex.safePassingNm);
    expect(r.valid).toBe(true);
    expect(r.messages.some((m) => /straight line/.test(m.text))).toBe(true);
  });
  it("an observation error makes the plot disagree with the truth", () => {
    const { ex, session } = plot({ 2: { r: 0.14 } });
    const r = evaluatePlot(session.observations, null, ex.safePassingNm);
    expect(r.valid).toBe(true);
    expect(Math.abs(r.fromPlot!.cpa - r.truth!.cpa) + Math.abs(r.fromPlot!.tcpaMinutes - r.truth!.tcpaMinutes)).toBeGreaterThan(0.05);
  });
  it("a gross misreading is caught because it does not match any echo", () => {
    const { ex, session } = plot({ 1: { b: 8 } });
    const r = evaluatePlot(session.observations, null, ex.safePassingNm);
    expect(r.valid).toBe(false);
  });
  it("is invalid with one observation, an unmatched echo, or two different targets", () => {
    const { ex, world, session } = start("plot");
    observeExact(world, session, 1);
    expect(evaluatePlot(session.observations, null, ex.safePassingNm).valid).toBe(false);
    run(world, session, 360);
    session.observe(world, 200, 2); // empty water
    const r = evaluatePlot(session.observations, null, ex.safePassingNm);
    expect(r.valid).toBe(false);
    expect(r.messages[0]!.text).toMatch(/did not match any echo/);
    session.deleteLast();
    observeExact(world, session, 3);
    expect(evaluatePlot(session.observations, null, ex.safePassingNm).messages[0]!.text).toMatch(/different targets/);
  });
  it("rejects observations taken too close together", () => {
    const { ex, world, session } = start("plot");
    observeExact(world, session, 1);
    run(world, session, 10);
    observeExact(world, session, 1);
    expect(evaluatePlot(session.observations, null, ex.safePassingNm).messages[0]!.text).toMatch(/too close together/);
  });
  it("is invalid if own ship alters course during the plot", () => {
    const { ex, world, session } = start("plot");
    observeExact(world, session, 1);
    world.own.ordered.course = 40;
    run(world, session, 360);
    observeExact(world, session, 1);
    const r = evaluatePlot(session.observations, null, ex.safePassingNm);
    expect(r.valid).toBe(false);
    expect(r.messages[0]!.text).toMatch(/altered course or speed/);
  });
  it("says no risk for a ship that passes well clear", () => {
    const { ex, world, session } = start("plot");
    for (const t of [0, 360, 720]) {
      run(world, session, t === 0 ? 0 : 360);
      observeExact(world, session, 2); // fishing vessel B, CPA 2.8 NM
    }
    const r = evaluatePlot(session.observations, { ...rightAnswer, risk: false, situation: "no-risk" }, ex.safePassingNm);
    expect(r.truthRisk).toBe(false);
    expect(r.situationOk).toBe(true);
  });
  it("finds the head-on ship (tanker C passes 0.9 NM off)", () => {
    const { ex, world, session } = start("plot");
    for (let i = 0; i < 3; i++) {
      if (i > 0) run(world, session, 240);
      observeExact(world, session, 3);
    }
    const r = evaluatePlot(session.observations, null, ex.safePassingNm);
    expect(r.truth!.cpa).toBeCloseTo(0.9, 1);
    expect(r.truthRisk).toBe(true);
    expect(r.analysis!.rangeDecreasing).toBe(true);
  });
});

describe("position fixing exercise", () => {
  it("a fix from exact range and bearing to two objects lands on the true position", () => {
    const { world, session } = start("fix");
    observeExact(world, session, 1);
    observeExact(world, session, 3);
    const f = computeFix(session.observations, session.charted, 1);
    expect(f.valid).toBe(true);
    expect(f.errorNm!).toBeLessThan(1e-6);
    expect(f.ok).toBe(true);
    expect(f.cutAngle!).toBeGreaterThan(30);
  });
  it("needs two different objects", () => {
    const { world, session } = start("fix");
    observeExact(world, session, 1);
    observeExact(world, session, 1);
    expect(computeFix(session.observations, session.charted, 1).valid).toBe(false);
  });
  it("a misread bearing gives a large error", () => {
    const { world, session } = start("fix");
    observeExact(world, session, 1);
    const t = world.targets.find((x) => x.id === 3)!;
    const rb = rangeBearing(world.own.pos, t.pos);
    session.observe(world, rb.bearing + 8, rb.range);
    const f = computeFix(session.observations, session.charted, 1);
    // The echo is still matched (within 3 degrees of the object? no: 8 degrees is too far).
    expect(f.valid ? f.errorNm! : Infinity).toBeGreaterThan(0.15);
  });
  it("warns about a poor angle of cut", () => {
    const { world, session } = start("fix");
    observeExact(world, session, 1);
    observeExact(world, session, 2); // lighthouse and B1 are roughly in line from the start position
    const f = computeFix(session.observations, session.charted, 1);
    if (f.valid) expect(f.cutAngle).toBeDefined();
  });
  it("two fixes taken while moving are brought to a common time", () => {
    const { world, session } = start("fix");
    observeExact(world, session, 1);
    run(world, session, 30);
    observeExact(world, session, 3);
    const f = computeFix(session.observations, session.charted, 1);
    expect(f.valid).toBe(true);
    expect(f.errorNm!).toBeLessThan(0.02);
  });
});

describe("set and drift exercise", () => {
  function twoFixes(skew = 0) {
    const { world, session } = start("setdrift");
    observeExact(world, session, 1);
    observeExact(world, session, 3);
    session.nextFixGroup();
    run(world, session, 900);
    observeExact(world, session, 1);
    observeExact(world, session, 3);
    if (skew) session.deleteLast();
    return { world, session };
  }
  it("recovers the current from two exact fixes", () => {
    const { world, session } = twoFixes();
    const r = evaluateSetDrift(session.observations, session.charted, world.env.current, { set: 120, drift: 2.0 });
    expect(r.valid).toBe(true);
    expect(r.fromFixes!.set).toBeCloseTo(120, 3);
    expect(r.fromFixes!.drift).toBeCloseTo(2.0, 3);
    expect(r.studentVsFixes).toEqual({ setOk: true, driftOk: true });
    expect(r.studentVsTruth).toEqual({ setOk: true, driftOk: true });
  });
  it("marks a wrong answer", () => {
    const { world, session } = twoFixes();
    const r = evaluateSetDrift(session.observations, session.charted, world.env.current, { set: 200, drift: 0.5 });
    expect(r.studentVsTruth).toEqual({ setOk: false, driftOk: false });
  });
  it("needs both fixes and a steady course between them", () => {
    const { world, session } = start("setdrift");
    observeExact(world, session, 1);
    observeExact(world, session, 3);
    expect(evaluateSetDrift(session.observations, session.charted, world.env.current, null).valid).toBe(false);
    session.nextFixGroup();
    world.own.ordered.course = 90;
    run(world, session, 600);
    observeExact(world, session, 1);
    observeExact(world, session, 3);
    const r = evaluateSetDrift(session.observations, session.charted, world.env.current, null);
    expect(r.valid).toBe(false);
    expect(r.messages[0]!.text).toMatch(/altered course or speed/);
  });
});

describe("clearing range exercise", () => {
  /** Required range from the data: lighthouse (4.4,0.6) to shoal (2.6,-2.4) + radius 0.3 + margin 0.3. */
  const required = Math.hypot(1.8, 3.0) + 0.3 + 0.3;
  it("passes with a good clearing range and a safe passage", () => {
    const { ex, world, session } = start("clearing");
    session.recordClearing(1, 4.3);
    world.own.ordered.course = 355;
    run(world, session, 7000, () => {
      if (!session.finished) world.own.ordered.course = 355;
    });
    expect(session.finished).toBe(true);
    const r = evaluateClearing(session, session.charted, ex, world.hazards);
    expect(r.requiredRange).toBeCloseTo(required, 6);
    expect(r.rangeOk).toBe(true);
    expect(r.keptOutside).toBe(true);
    expect(r.grounded).toBe(false);
    expect(r.passed).toBe(true);
  });
  it("fails if the recorded range is too small", () => {
    const { ex, world, session } = start("clearing");
    session.recordClearing(1, 2.0);
    world.own.ordered.course = 355;
    run(world, session, 7000);
    const r = evaluateClearing(session, session.charted, ex, world.hazards);
    expect(r.rangeOk).toBe(false);
    expect(r.passed).toBe(false);
  });
  it("fails if nothing was recorded", () => {
    const { ex, world, session } = start("clearing");
    world.own.ordered.course = 355;
    run(world, session, 7000);
    const r = evaluateClearing(session, session.charted, ex, world.hazards);
    expect(r.recorded).toBe(false);
    expect(r.passed).toBe(false);
  });
  it("fails if own ship runs onto the shoal", () => {
    const { ex, world, session } = start("clearing");
    session.recordClearing(1, 4.3);
    run(world, session, 4000, () => {
      if (session.finished) return;
      const rb = rangeBearing(world.own.pos, world.hazards[0]!.center);
      world.own.ordered.course = rb.bearing;
    });
    const r = evaluateClearing(session, session.charted, ex, world.hazards);
    expect(r.grounded).toBe(true);
    expect(r.passed).toBe(false);
    expect(session.finished).toBe(true);
  });
});

describe("blind pilotage exercise", () => {
  const steer = (world: ReturnType<typeof createWorld>): void => {
    // Steer for a point 1.2 NM ahead along the route, allowing for the current.
    const route = world.route;
    let seg = 0;
    let best = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const d = Math.abs(crossTrackError(world.own.pos, route[i]!, route[i + 1]!));
      const along = (world.own.pos.n - route[i]!.n) / (route[i + 1]!.n - route[i]!.n);
      if (along >= -0.05 && along <= 1.05 && d < best) {
        best = d;
        seg = i;
      }
    }
    const a = route[seg]!;
    const b = route[seg + 1]!;
    const len = Math.hypot(b.e - a.e, b.n - a.n);
    const t = { e: (b.e - a.e) / len, n: (b.n - a.n) / len };
    const along = (world.own.pos.e - a.e) * t.e + (world.own.pos.n - a.n) * t.n;
    const aim = { e: a.e + t.e * (along + 1.2), n: a.n + t.n * (along + 1.2) };
    world.own.ordered.course = rangeBearing(world.own.pos, aim).bearing;
  };
  it("a careful pilot completes the passage inside the limit", () => {
    const { world, session } = start("pilotage");
    run(world, session, 10000, () => steer(world));
    expect(session.finished).toBe(true);
    const r = evaluatePilotage(session);
    expect(r.reachedEnd).toBe(true);
    expect(r.grounded).toBe(false);
    expect(r.maxXte).toBeLessThan(ROC_PLACEHOLDERS.pilotageXteLimitNm);
    expect(r.passed).toBe(true);
  });
  it("ignoring the current fails (set onto the east bank or well off track)", () => {
    const { world, session } = start("pilotage");
    run(world, session, 10000);
    const r = evaluatePilotage(session);
    expect(r.passed).toBe(false);
    expect(r.maxXte).toBeGreaterThan(ROC_PLACEHOLDERS.pilotageXteLimitNm);
  });
  it("running aground ends the exercise at once", () => {
    const { world, session } = start("pilotage");
    world.own.ordered.course = 60;
    run(world, session, 3000);
    expect(session.log.grounded).toBe(true);
    expect(session.finished).toBe(true);
    expect(session.finishReason).toMatch(/aground/);
  });
});

describe("heavy traffic exercise", () => {
  it("doing nothing leaves ships too close and says so", () => {
    const { ex, world, session } = start("traffic");
    run(world, session, ex.durationSec! + 5);
    expect(session.finished).toBe(true);
    const r = evaluateTraffic(session, ex.safePassingNm);
    expect(r.firstAction).toBeNull();
    expect(r.allSafe).toBe(false);
    expect(r.advisories.some((a) => /no significant action/.test(a.text))).toBe(true);
    expect(r.perTarget.filter((t) => !t.safe).length).toBeGreaterThanOrEqual(3);
  });
  it("records the first significant action: direction, size, and timing against the critical ship", () => {
    const { ex, world, session } = start("traffic");
    run(world, session, 60);
    world.own.ordered.course = 60; // large alteration to starboard
    run(world, session, 30);
    const r = evaluateTraffic(session, ex.safePassingNm);
    const a = r.firstAction!;
    expect(a.kind).toBe("course");
    expect(a.direction).toBe("starboard");
    expect(a.changeDeg).toBeCloseTo(60, 6);
    expect(a.timeMin).toBeCloseTo(1, 0);
    expect(a.criticalTarget).not.toBeNull();
    expect(a.tcpaToCritical!).toBeGreaterThan(10);
  });
  it("flags a small, late alteration to port against a head-on ship", () => {
    const { ex, world, session } = start("traffic");
    run(world, session, 1100); // 18 minutes: ships 2 is close
    world.own.ordered.course = 350;
    run(world, session, 10);
    const r = evaluateTraffic(session, ex.safePassingNm);
    expect(r.firstAction!.direction).toBe("port");
    expect(r.advisories.some((a) => /only 10/.test(a.text))).toBe(true);
    expect(r.advisories.some((a) => /altered to port/.test(a.text))).toBe(true);
  });
  it("a sensible early alteration to starboard keeps everyone clear", () => {
    const { ex, world, session } = start("traffic");
    run(world, session, 120);
    world.own.ordered.course = 70;
    run(world, session, ex.durationSec!);
    const r = evaluateTraffic(session, ex.safePassingNm);
    expect(r.firstAction!.direction).toBe("starboard");
    expect(r.perTarget.every((t) => t.minRange > 0)).toBe(true);
    expect(normalizeDeg(0)).toBe(0);
  });
});

describe("session bookkeeping", () => {
  it("exports a record for the instructor", () => {
    const { world, session } = start("plot");
    observeExact(world, session, 1);
    const j = JSON.parse(JSON.stringify(session.toJSON()));
    expect(j.exercise).toBe("plot");
    expect(j.observations).toHaveLength(1);
    expect(fromPolar(0, 1).n).toBe(1);
  });
});
