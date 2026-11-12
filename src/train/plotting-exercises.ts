import { requiredCpaScore } from "../core/assess";
import { computeCpa } from "../core/cpa";
import { Vec2, add, length, scale, sub, velocityOf } from "../core/vec";
import { Scenario, Target } from "../engine/index";
import { ArpaExercise, OutcomeTask, TaskCtx, truthCpa, truthThroughWater } from "./session";

/**
 * Collision avoidance by MANUAL radar plotting: ten exercises of one to four targets, in clear
 * and in restricted visibility. The ARPA is switched off. The student plots each target for
 * 12 minutes with the EBL, VRM and the plotting sheet, then alters course and/or speed so that
 * every target passes at the required distance.
 *
 * The form of the exercise and its marking follow the Learnmarine radar plotting trainer, which
 * the academy supplied as a reference: own ship turns at 30 deg/min and changes speed at
 * 3 kn/min; required CPA 1 NM; manoeuvre at 12 minutes; the result is the achieved CPA to the
 * most dangerous vessel as a percentage of the required CPA (see core/assess requiredCpaScore);
 * at least 80% is needed; turns to port are generally not allowed. The traffic situations are
 * our own. These figures are that trainer's, not the academy's marking scheme.
 */
export const PLOT_RULES = { requiredCpaNm: 1, manoeuvreAtMin: 12, minimumPercent: 80, turnDegPerMin: 30, speedKnPerMin: 3 };

type T = Omit<Target, "nextEvent">;

/**
 * A ship that, if nobody acts, passes own ship at `cpaNm` after `tcpaMin` minutes.
 * `side` +1 puts the closest approach to starboard of the relative track, -1 to port.
 */
function closing(id: number, name: string, own: { heading: number; speed: number }, course: number, speed: number, tcpaMin: number, cpaNm: number, side: 1 | -1 = 1): T {
  const relVel = sub(velocityOf({ course, speed }), velocityOf({ course: own.heading, speed: own.speed }));
  const unit = scale(relVel, 1 / length(relVel));
  const normal: Vec2 = { e: unit.n * side, n: -unit.e * side };
  const pos = add(scale(normal, cpaNm), scale(relVel, -tcpaMin / 60));
  return { id, name, kind: "ship", pos, course, speed, rcs: 1, height: 20, events: [] };
}

/** Achieved passing distance to the vessel that came closest, and whether every vessel is now past and clear. */
function achieved(c: TaskCtx): { nm: number; name: string; allPast: boolean } {
  const ships = c.w.targets.filter((t) => t.kind === "ship");
  const worst = ships.map((t) => ({ t, r: c.obs.minRange[t.id] ?? Infinity })).sort((x, y) => x.r - y.r)[0];
  const allPast = ships.every((t) => {
    const r = truthCpa(c.w, t.id);
    return !r || r.tcpaHours === null || r.tcpaHours <= 0;
  });
  return { nm: worst?.r ?? Infinity, name: worst?.t.name ?? "", allPast };
}

const judgeCpa: OutcomeTask["judge"] = (c) => {
  const a = achieved(c);
  const pct = requiredCpaScore(PLOT_RULES.requiredCpaNm, a.nm);
  const pending = a.allPast ? "" : " (some vessels had not yet passed: judged on the closest so far)";
  return { ok: a.allPast && pct >= PLOT_RULES.minimumPercent, detail: `closest: ${a.name} ${a.nm.toFixed(2)} NM; result ${pct}% of the required ${PLOT_RULES.requiredCpaNm} NM (at least ${PLOT_RULES.minimumPercent}% needed)${pending}` };
};
const judgeTime: OutcomeTask["judge"] = (c) => {
  const m = c.obs.manoeuvre;
  if (!m) return { ok: false, detail: "no alteration of course or speed was made" };
  return { ok: m.time >= PLOT_RULES.manoeuvreAtMin * 60 - 1, detail: `manoeuvre started at ${(m.time / 60).toFixed(1)} min` };
};
const judgeNoPort: OutcomeTask["judge"] = (c) => {
  const port = c.obs.maxTurnDeg <= -5 || (c.obs.manoeuvre?.turnDeg ?? 0) <= -5;
  return { ok: !port, detail: port ? "a turn to port was made" : "no turn to port" };
};
const judgeManual: OutcomeTask["judge"] = (c) => ({ ok: c.obs.tracked.size === 0, detail: c.obs.tracked.size === 0 ? "ARPA not used" : "targets were tracked by the ARPA" });

/** The target with the smallest CPA now (the one to report on). */
function mostDangerous(c: TaskCtx): number | null {
  const list = c.w.targets
    .filter((t) => t.kind === "ship")
    .map((t) => ({ id: t.id, r: truthCpa(c.w, t.id) }))
    .filter((x) => x.r !== null && x.r.tcpaHours !== null && x.r.tcpaHours > 0)
    .sort((x, y) => x.r!.cpa - y.r!.cpa);
  return list[0]?.id ?? null;
}

interface Def { n: number; rv: boolean; own: { heading: number; speed: number }; targets: T[] }

const make = (d: Def): ArpaExercise => {
  const id = `plot-${String(d.n).padStart(2, "0")}`;
  const count = d.targets.length;
  const title = `Manual plotting ${String(d.n).padStart(2, "0")}: ${count} target${count > 1 ? "s" : ""}${d.rv ? ", restricted visibility" : ""}`;
  const scenario: Scenario = {
    id, name: title, description: "Collision avoidance by manual radar plotting.",
    own: d.own, env: { seaState: 1 }, coasts: [], targets: d.targets,
  };
  return {
    id, number: 11 + d.n, group: "Plotting", title, rangeNm: 12, safeNm: PLOT_RULES.requiredCpaNm,
    aim: "Plot the targets by hand for 12 minutes, then alter course and/or speed so that every target passes at 1 NM.",
    scenario,
    ownRates: { turnDegPerMin: PLOT_RULES.turnDegPerMin, speedKnPerMin: PLOT_RULES.speedKnPerMin },
    setup: (a) => {
      a.settings.standby = true;
    },
    briefing: [
      `${count} target${count > 1 ? "s" : ""}${d.rv ? ", in restricted visibility (Rule 19 applies)" : ", vessels in sight of one another"}. Own ship ${String(d.own.heading).padStart(3, "0")}° at ${d.own.speed} kn. She turns at ${PLOT_RULES.turnDegPerMin}°/min and changes speed at ${PLOT_RULES.speedKnPerMin} kn/min.`,
      "The ARPA is off. Use EBL 1 and VRM 1 to take the range and bearing of each target at regular intervals (for example every 6 minutes) and plot them on a plotting sheet. Relative trails may be used.",
      "From the plot find each target's CPA, TCPA, course and speed. Enter the answers for the most dangerous target before you manoeuvre.",
      `At ${PLOT_RULES.manoeuvreAtMin} minutes, not before, alter course and/or speed so that every target passes at ${PLOT_RULES.requiredCpaNm} NM. Turns to port are generally not allowed.`,
      `Result: the achieved CPA to the vessel that comes closest, as a percentage of the required ${PLOT_RULES.requiredCpaNm} NM. Closer than required scores the fraction achieved (0.87 NM: 87%). Wider than required loses half as much (1.3 NM: 85%). At least ${PLOT_RULES.minimumPercent}% is needed.`,
      "Run until every target is past and clear, then press Finish.",
    ],
    tasks: [
      { id: "cpa0", kind: "number", prompt: "Most dangerous target: CPA if no action is taken", unit: "NM", truth: (c) => (c.obs.manoeuvre ? null : (truthCpa(c.w, mostDangerous(c) ?? -1)?.cpa ?? null)), tol: (cfg) => cfg.tol.cpaNm },
      { id: "tcpa0", kind: "number", prompt: "Most dangerous target: TCPA from now", unit: "min", truth: (c) => (c.obs.manoeuvre ? null : (truthCpa(c.w, mostDangerous(c) ?? -1)?.tcpaMinutes ?? null)), tol: (cfg) => cfg.tol.tcpaMin },
      { id: "crs0", kind: "number", prompt: "Most dangerous target: true course", unit: "°", circular: true, truth: (c) => truthThroughWater(c.w, mostDangerous(c) ?? -1)?.course ?? null, tol: (cfg) => cfg.tol.courseDeg },
      { id: "spd0", kind: "number", prompt: "Most dangerous target: true speed", unit: "kn", truth: (c) => truthThroughWater(c.w, mostDangerous(c) ?? -1)?.speed ?? null, tol: (cfg) => cfg.tol.speedKn },
      { id: "result", kind: "outcome", prompt: `Every target passed at the required ${PLOT_RULES.requiredCpaNm} NM (result at least ${PLOT_RULES.minimumPercent}%)`, judge: judgeCpa },
      { id: "time", kind: "outcome", prompt: `Manoeuvre made at ${PLOT_RULES.manoeuvreAtMin} minutes, not before`, judge: judgeTime },
      { id: "port", kind: "outcome", prompt: "No turn to port", judge: judgeNoPort },
      { id: "manual", kind: "outcome", prompt: "Worked by manual plotting (ARPA not used)", judge: judgeManual },
    ],
    script: [],
    debrief: [
      "Compare your plotted CPA, TCPA, course and speed with the correct values in the result.",
      "A wide alteration made in good time is easier for the other vessel to see than a series of small ones (Rule 8).",
      d.rv ? "In restricted visibility, Rule 19(d): avoid altering to port for a vessel forward of the beam (unless overtaking it) and avoid altering towards a vessel abeam or abaft the beam." : "In sight of one another, the give-way vessel keeps well clear and avoids crossing ahead (Rules 15 and 16).",
    ],
  };
};

const o1 = { heading: 330, speed: 17 };
const o2 = { heading: 0, speed: 12 };
const o3 = { heading: 45, speed: 15 };
const o4 = { heading: 90, speed: 10 };
const o5 = { heading: 180, speed: 14 };
const o6 = { heading: 270, speed: 12 };
const o7 = { heading: 20, speed: 16 };
const o8 = { heading: 135, speed: 13 };
const o9 = { heading: 225, speed: 11 };
const o10 = { heading: 300, speed: 15 };

const DEFS: Def[] = [
  { n: 1, rv: false, own: o1, targets: [closing(1, "Target A", o1, 255, 16, 24, 0)] },
  { n: 2, rv: false, own: o2, targets: [closing(1, "Target A", o2, 190, 14, 22, 0.2), closing(2, "Target B", o2, 285, 10, 27, 0.3)] },
  { n: 3, rv: false, own: o3, targets: [closing(1, "Target A", o3, 300, 12, 21, 0), closing(2, "Target B", o3, 45, 6, 30, 0.2, -1)] },
  { n: 4, rv: true, own: o4, targets: [closing(1, "Target A", o4, 335, 13, 23, 0.1), closing(2, "Target B", o4, 260, 9, 26, 0.3)] },
  { n: 5, rv: false, own: o5, targets: [closing(1, "Target A", o5, 5, 12, 24, 0.1), closing(2, "Target B", o5, 100, 11, 26, 0.3), closing(3, "Target C", o5, 180, 6, 32, 0.4, -1)] },
  { n: 6, rv: true, own: o6, targets: [closing(1, "Target A", o6, 20, 14, 22, 0), closing(2, "Target B", o6, 95, 10, 25, 0.3), closing(3, "Target C", o6, 190, 9, 29, 0.6, -1)] },
  { n: 7, rv: false, own: o7, targets: [closing(1, "Target A", o7, 275, 15, 23, 0.1), closing(2, "Target B", o7, 205, 12, 21, 0.4), closing(3, "Target C", o7, 20, 7, 31, 0.3, -1)] },
  { n: 8, rv: false, own: o8, targets: [closing(1, "Target A", o8, 310, 15, 20, 0)] },
  { n: 9, rv: true, own: o9, targets: [closing(1, "Target A", o9, 120, 13, 23, 0.2), closing(2, "Target B", o9, 40, 12, 25, 0.1)] },
  { n: 10, rv: false, own: o10, targets: [closing(1, "Target A", o10, 205, 14, 23, 0), closing(2, "Target B", o10, 125, 12, 21, 0.3), closing(3, "Target C", o10, 160, 10, 27, 0.5), closing(4, "Target D", o10, 300, 7, 33, 0.3, -1)] },
];

export const PLOTTING_EXERCISES: ArpaExercise[] = DEFS.map(make);

/** For tests and the instructor: the passing distance if own ship does nothing. */
export function untouchedCpa(ex: ArpaExercise): number {
  const ownV = velocityOf({ course: ex.scenario.own.heading, speed: ex.scenario.own.speed });
  return Math.min(...ex.scenario.targets.map((t) => computeCpa(t.pos, sub(velocityOf({ course: t.course, speed: t.speed }), ownV)).cpa));
}
