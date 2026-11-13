import { bearingOf, fromPolar, normalizeDeg, sub, velocityOf, courseSpeedOf } from "../core/vec";
import { trialManoeuvre } from "../core/trial";
import { bowCrossing } from "../core/bcr";
import { COASTAL, Scenario, World, ownCogSog, ownGroundVelocity } from "../engine/index";
import {
  ArpaExercise, ArpaTask, TaskCtx, judgeAction, judgeSafePassing, targetById, truthCpa, truthThroughWater,
} from "./session";

/**
 * The nine ARPA exercises. They follow the usual ARPA course sequence (setting up, acquisition,
 * vectors, history, zones, alarms, trial manoeuvre, stabilisation, errors and limitations,
 * collision avoidance in restricted visibility). The academy's own exercise sheets were not
 * available when these were written: titles, traffic and questions are to be checked against them
 * (see docs/PHASE5-INSTRUCTOR-CHECK.md). Passing distances and tolerances are placeholders.
 */

type Tgt = Scenario["targets"][number];
const ship = (id: number, name: string, brg: number, rng: number, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt => ({
  id, name, kind: "ship", pos: fromPolar(brg, rng), course, speed, rcs: 1, height: 20, events: [], ...extra,
});
const open = (id: string, name: string, own: { heading: number; speed: number }, targets: Tgt[], env: Scenario["env"] = { seaState: 2 }): Scenario => ({
  id, name, description: name, own, env, coasts: [], targets,
});

const ships = (w: World): Tgt[] => w.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft");
const allTracked = (ids: number[]) => (c: TaskCtx): boolean => ids.every((id) => c.obs.tracked.has(id));
const cpaOf = (id: number) => (c: TaskCtx): number | null => truthCpa(c.w, id)?.cpa ?? null;
const tcpaOf = (id: number) => (c: TaskCtx): number | null => truthCpa(c.w, id)?.tcpaMinutes ?? null;

/** Index (in `ids`) of the target with the smallest real CPA still to come. */
function mostDangerous(c: TaskCtx, ids: number[]): number {
  let best = 0;
  let bestCpa = Infinity;
  ids.forEach((id, i) => {
    const r = truthCpa(c.w, id);
    if (r && r.tcpaMinutes !== null && r.tcpaMinutes > 0 && r.cpa < bestCpa) {
      bestCpa = r.cpa;
      best = i;
    }
  });
  return best;
}

/**
 * Smallest alteration to starboard (in 10 degree steps, made now, speed unchanged) that makes every
 * ship pass at `safeNm` or more. Uses the core trial manoeuvre with the real target data.
 */
export function minimalStarboardAlteration(w: World, safeNm: number): number | null {
  const own = ownCogSog(w);
  for (let k = 10; k <= 150; k += 10) {
    const ok = ships(w).every((t) => {
      const r = trialManoeuvre(sub(t.pos, w.own.pos), own, { course: t.course, speed: t.speed }, { course: normalizeDeg(own.course + k), speed: own.speed, delayMinutes: 0 });
      return r.cpa >= safeNm;
    });
    if (ok) return k;
  }
  return null;
}

const q = {
  cpa: (id: string, name: string, tid: number): ArpaTask => ({ id, kind: "number", prompt: `CPA of ${name} from the ARPA data`, unit: "NM", truth: cpaOf(tid), tol: (c) => c.tol.cpaNm }),
  tcpa: (id: string, name: string, tid: number): ArpaTask => ({ id, kind: "number", prompt: `TCPA of ${name} (minutes from now)`, unit: "min", truth: tcpaOf(tid), tol: (c) => c.tol.tcpaMin }),
  course: (id: string, name: string, tid: number, what = "true course"): ArpaTask => ({
    id, kind: "number", prompt: `${name}: ${what}`, unit: "°", circular: true, truth: (c) => targetById(c.w, tid)?.course ?? null, tol: (c) => c.tol.courseDeg,
  }),
  speed: (id: string, name: string, tid: number): ArpaTask => ({ id, kind: "number", prompt: `${name}: true speed`, unit: "kn", truth: (c) => targetById(c.w, tid)?.speed ?? null, tol: (c) => c.tol.speedKn }),
};

// ---------------------------------------------------------------- 1
const EX1: ArpaExercise = {
  id: "arpa-1", number: 1, title: "Setting up and manual acquisition", rangeNm: 12, safeNm: 1,
  aim: "Set up the display, acquire targets by hand, wait for the data to settle and read it.",
  scenario: open("arpa-1", "ARPA 1: open water, three ships", { heading: 0, speed: 12 }, [
    ship(1, "Ship A", 45, 6, 270, 10),
    ship(2, "Ship B", 3, 9, 185, 11),
    ship(3, "Ship C", 200, 4, 5, 17),
  ]),
  briefing: [
    "Check the radar picture first: range scale 12 NM, gain and tuning correct.",
    "On the ARPA tab choose Acquire and click each of the three ship echoes.",
    "Do not use the data while a track is PRELIMINARY. Wait until it is steady (about 3 minutes).",
    "Select each target and read its data, then answer the questions.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "All three ships acquired and tracked until steady", done: allTracked([1, 2, 3]) },
    q.cpa("cpaA", "Ship A", 1),
    q.tcpa("tcpaA", "Ship A", 1),
    q.course("crsB", "Ship B", 2),
    { id: "danger", kind: "choice", prompt: "Which ship will pass closest?", choices: ["Ship A", "Ship B", "Ship C"], correct: (c) => mostDangerous(c, [1, 2, 3]) },
  ],
  script: [],
  debrief: [
    "How long did each track take before its data stopped changing? Why must early CPA/TCPA not be trusted?",
    "Which checks of the radar picture come before using the ARPA at all?",
    "What happens to a target that is never acquired when automatic acquisition is off?",
  ],
};

// ---------------------------------------------------------------- 2
const EX2: ArpaExercise = {
  id: "arpa-2", number: 2, title: "True and relative vectors, vector time", rangeNm: 12, safeNm: 1,
  aim: "Use both vector modes and the vector time, and understand what each one shows.",
  scenario: open("arpa-2", "ARPA 2: vectors", { heading: 40, speed: 14 }, [
    // D: on a collision course from the port bow. E: stopped. F: same course and speed as own ship.
    ship(1, "Ship D", 350, 8, 106.7, 12),
    ship(2, "Ship E", 80, 5, 0, 0),
    ship(3, "Ship F", 130, 2.5, 40, 14),
    ship(4, "Ship G", 20, 10, 250, 9),
  ]),
  briefing: [
    "Acquire all four ships and let the tracks settle.",
    "Look at RELATIVE vectors: a vector pointing at own ship means collision risk. Lengthen the vector time until the vectors reach own ship's position.",
    "Change to TRUE vectors: they show each ship's course and speed. Own ship gets a vector too.",
    "Notice which targets have no vector in each mode, and why.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "All four ships tracked", done: allTracked([1, 2, 3, 4]) },
    { id: "rel", kind: "action", prompt: "Relative vectors used", done: (c) => c.obs.vecRelUsed },
    { id: "tru", kind: "action", prompt: "True vectors used", done: (c) => c.obs.vecTrueUsed },
    { id: "coll", kind: "choice", prompt: "Whose relative vector points at own ship (smallest CPA)?", choices: ["Ship D", "Ship E", "Ship F", "Ship G"], correct: (c) => mostDangerous(c, [1, 2, 3, 4]) },
    { id: "stop", kind: "choice", prompt: "Which ship has NO true vector, and what does that mean?", choices: ["Ship D: it is turning", "Ship E: it is stopped", "Ship F: it is on our course", "Ship G: it is too far"], correct: () => 1 },
    { id: "same", kind: "choice", prompt: "Which ship has NO relative vector, and what does that mean?", choices: ["Ship D: it is stopped", "Ship E: it is stopped", "Ship F: same course and speed as own ship", "Ship G: it is opening"], correct: () => 2 },
    q.course("crsD", "Ship D", 1),
    q.speed("spdD", "Ship D", 1),
  ],
  script: [],
  debrief: [
    "Why can a stopped ship still be a collision risk although it has no true vector?",
    "Which vector mode shows risk of collision directly? Which shows aspect?",
    "What is wrong with choosing a very short vector time in open water?",
  ],
};

// ---------------------------------------------------------------- 3
const EX3: ArpaExercise = {
  id: "arpa-3", number: 3, title: "Past positions and a target's manoeuvre", rangeNm: 12, safeNm: 1,
  aim: "Use the history display to see what a target has been doing, and see how late the ARPA shows a manoeuvre.",
  scenario: open("arpa-3", "ARPA 3: history", { heading: 0, speed: 12 }, [
    ship(1, "Ship H", 60, 8, 250, 13, { events: [{ atSeconds: 420, course: 295 }] }),
    ship(2, "Ship J", 320, 7, 150, 10),
    ship(3, "Ship K", 10, 10, 180, 8),
  ]),
  briefing: [
    "Acquire the three ships. When the tracks are steady switch on past positions (true, 1 minute apart).",
    "Evenly spaced dots in a straight line: steady course and speed. A bend or a change of spacing: the target has manoeuvred.",
    "One ship alters course during the exercise. Watch how long the vector takes to show the new course (processing delay). An alarm tells you when the ARPA has noticed.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "All three ships tracked", done: allTracked([1, 2, 3]) },
    { id: "past", kind: "action", prompt: "Past positions displayed", done: (c) => c.obs.pastUsed },
    { id: "who", kind: "choice", prompt: "Which ship altered course?", choices: ["Ship H", "Ship J", "Ship K", "None"], correct: (c) => ((targetById(c.w, 1)?.nextEvent ?? 0) > 0 ? 0 : 3) },
    {
      id: "newcrs", kind: "number", prompt: "New course of the ship that altered (answer when its vector has settled again)", unit: "°", circular: true,
      truth: (c) => ((targetById(c.w, 1)?.nextEvent ?? 0) > 0 ? targetById(c.w, 1)!.course : null), tol: (c) => c.tol.courseDeg,
    },
    q.cpa("cpaH", "Ship H after its alteration", 1),
  ],
  script: [],
  debrief: [
    "How many minutes passed between the ship's alteration and a reliable new vector?",
    "During that time, which information on the screen could you still trust?",
    "What is the difference between true and relative past positions?",
  ],
};

// ---------------------------------------------------------------- 4
const EX4: ArpaExercise = {
  id: "arpa-4", number: 4, title: "Automatic acquisition, guard zones and exclusion areas", rangeNm: 12, safeNm: 0.5,
  aim: "Set guard zones and automatic acquisition in coastal waters, and keep land and clutter out with exclusion areas.",
  scenario: { ...COASTAL, id: "arpa-4", name: "ARPA 4: coastal waters" },
  briefing: [
    "Switch Guard 1 on (ring 5.5 to 6 NM) and tick automatic acquisition.",
    "Land echoes entering the zone are acquired too and fill the memory. Set an exclusion area over the coast (Exclude 1), cancel the false targets and watch the difference.",
    "A target that first appears INSIDE the guard ring is not acquired: acquire it by hand.",
    "Acknowledge the new-target alarms.",
  ],
  tasks: [
    { id: "guard", kind: "action", prompt: "Guard zone switched on", done: (c) => c.obs.guardUsed },
    { id: "auto", kind: "action", prompt: "Automatic acquisition used", done: (c) => c.obs.autoAcqUsed },
    { id: "excl", kind: "action", prompt: "Exclusion area set", done: (c) => c.obs.exclusionUsed },
    { id: "ships", kind: "action", prompt: "Coaster G and Bulk carrier H tracked", done: allTracked([4, 5]) },
    { id: "ack", kind: "action", prompt: "Alarms acknowledged", done: (c) => c.obs.acks >= 1 },
    { id: "why", kind: "choice", prompt: "A small boat appears for the first time between own ship and the guard ring. What happens?", choices: ["It is acquired automatically", "The guard alarm sounds", "Nothing: it must be seen and acquired by hand", "It is shown as LOST"], correct: () => 2 },
  ],
  script: [],
  debrief: [
    "Why is automatic acquisition not a substitute for watching the radar picture?",
    "What is the risk of an exclusion area that is too large?",
    "What does the memory-full alarm mean for new dangerous targets?",
  ],
};

// ---------------------------------------------------------------- 5
const EX5: ArpaExercise = {
  id: "arpa-5", number: 5, title: "CPA/TCPA limits, alarms and bow crossing", rangeNm: 12, safeNm: 2,
  aim: "Set safe limits, respond to the dangerous-target alarm and use the bow crossing data.",
  scenario: open("arpa-5", "ARPA 5: alarms", { heading: 0, speed: 15 }, [
    ship(1, "Ship L", 40, 9, 285, 12),
    ship(2, "Ship M", 300, 8, 95, 6),
    ship(3, "Ship N", 192, 5, 12, 15.5),
    ship(4, "Ship P", 100, 7, 20, 10),
  ]),
  briefing: [
    "Set the CPA limit to 2.0 NM and the TCPA limit to 20 minutes.",
    "Acquire all four ships. A target that will pass inside BOTH limits gives the dangerous-target alarm: red triangle, flashing, with sound.",
    "Acknowledge the alarm, then read that target's data, including bow crossing range and time (BCR/BCT).",
  ],
  tasks: [
    { id: "lim", kind: "action", prompt: "Limits set to CPA 2.0 NM and TCPA 20 min", done: (c) => Math.abs(c.obs.cpaLimit - 2) < 1e-6 && Math.abs(c.obs.tcpaLimit - 20) < 1e-6 },
    { id: "acq", kind: "action", prompt: "All four ships tracked", done: allTracked([1, 2, 3, 4]) },
    { id: "ack", kind: "action", prompt: "Dangerous-target alarm acknowledged", done: (c) => c.obs.acks >= 1 },
    { id: "who", kind: "choice", prompt: "Which ship gives the dangerous-target alarm (inside both limits)?", choices: ["Ship L", "Ship M", "Ship N", "Ship P"], correct: () => 0 },
    {
      id: "bcr", kind: "number", prompt: "Bow crossing range (BCR) of Ship L", unit: "NM",
      truth: (c) => {
        const t = targetById(c.w, 1);
        if (!t) return null;
        const b = bowCrossing(sub(t.pos, c.w.own.pos), sub(velocityOf({ course: t.course, speed: t.speed }), ownGroundVelocity(c.w)), courseSpeedOf(ownGroundVelocity(c.w)).course);
        return b ? b.rangeNm : null;
      },
      tol: (c) => c.tol.rangeNm,
    },
    { id: "ast", kind: "choice", prompt: "Ship N is overtaking from astern with CPA near zero but gives no alarm yet. Why?", choices: ["It is not tracked", "Its TCPA is longer than the TCPA limit", "Overtaking ships never alarm", "The CPA limit is too large"], correct: () => 1 },
  ],
  script: [],
  debrief: [
    "How would you choose CPA and TCPA limits for open sea and for a traffic lane?",
    "Why does the alarm need BOTH limits to be broken? What does that hide?",
    "A target passing ahead at 1 NM and one passing astern at 1 NM have the same CPA. How does BCR help?",
  ],
};

// ---------------------------------------------------------------- 6
const EX6: ArpaExercise = {
  id: "arpa-6", number: 6, title: "Trial manoeuvre", rangeNm: 12, safeNm: 2,
  aim: "Use the trial manoeuvre to find an alteration that clears every target, then carry it out.",
  scenario: open("arpa-6", "ARPA 6: trial manoeuvre", { heading: 0, speed: 14 }, [
    ship(1, "Ship Q", 42, 9, 276, 13),
    ship(2, "Ship R", 75, 6, 350, 11),
    ship(3, "Ship S", 330, 9, 170, 9),
  ]),
  briefing: [
    "Visibility is good and the ships are in sight. Ship Q is crossing from starboard on a collision course: own ship gives way.",
    "Acquire all three ships. Switch the trial on (it starts with present course and speed).",
    "Try alterations to starboard until every target clears by 2 NM or more. Check that the new course does not create a problem with Ship R.",
    "Answer the question, switch the trial off, then make the alteration with the Course control. Resume course when Ship Q is past and clear.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "All three ships tracked", done: allTracked([1, 2, 3]) },
    { id: "trial", kind: "action", prompt: "Trial manoeuvre used", done: (c) => c.obs.trialUsed },
    {
      id: "alt", kind: "number", prompt: "Smallest alteration to starboard, to the nearest 10°, made now, that clears every ship by 2 NM", unit: "°",
      truth: (c) => (c.obs.manoeuvre ? null : minimalStarboardAlteration(c.w, 2)), tol: () => 10,
    },
    { id: "act", kind: "outcome", prompt: "Action taken, large enough to be readily apparent (timing: the assessor judges)", judge: judgeAction(false) },
    { id: "safe", kind: "outcome", prompt: "Every ship passed at 2 NM or more", judge: (c) => judgeSafePassing(EX6)(c), rule: (cfg) => judgeSafePassing(EX6).rule?.(cfg) ?? "" },
  ],
  script: [],
  debrief: [
    "What does the trial manoeuvre assume about the other ships and about own ship's turn?",
    "Why must the trial be checked against ALL tracked targets, not only the dangerous one?",
    "Why must the trial display never be left on by mistake?",
  ],
};

// ---------------------------------------------------------------- 7
const EX7: ArpaExercise = {
  id: "arpa-7", number: 7, title: "Sea and ground stabilisation in a current", rangeNm: 12, safeNm: 1,
  aim: "See the difference between motion through the water and over the ground, and find the set and drift.",
  scenario: open(
    "arpa-7", "ARPA 7: current", { heading: 0, speed: 10 },
    [
      { id: 1, name: "Light float", kind: "buoy", pos: { e: 1.5, n: 4.5 }, course: 0, speed: 0, rcs: 0.3, height: 6, events: [] },
      ship(2, "Ship T", 320, 7, 110, 12),
    ],
    { seaState: 2, current: { set: 70, drift: 2.5 } },
  ),
  briefing: [
    "There is a current. The ARPA starts sea stabilised: true vectors show motion THROUGH THE WATER.",
    "Acquire the light float and Ship T. Sea stabilised, the float seems to move: its true vector is the reverse of the set and drift.",
    "Select the light float and choose Ground stabilisation: it becomes the fixed reference. True vectors now show motion OVER THE GROUND.",
    "Collision avoidance uses sea-stabilised data (aspect). Navigation past fixed dangers uses ground-stabilised data.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "Light float and Ship T tracked", done: allTracked([1, 2]) },
    { id: "seaC", kind: "number", prompt: "Ship T: course through the water (sea stabilised)", unit: "°", circular: true, truth: (c) => truthThroughWater(c.w, 2)?.course ?? null, tol: (c) => c.tol.courseDeg },
    { id: "ref", kind: "action", prompt: "Light float designated as the ground reference", done: (c) => c.obs.groundRef === 1 },
    q.course("gndC", "Ship T", 2, "course over the ground (ground stabilised)"),
    { id: "set", kind: "number", prompt: "Set of the current", unit: "°", circular: true, truth: (c) => c.w.env.current.set, tol: (c) => c.tol.setDeg },
    { id: "drift", kind: "number", prompt: "Drift of the current", unit: "kn", truth: (c) => c.w.env.current.drift, tol: (c) => c.tol.errorKn },
  ],
  script: [],
  debrief: [
    "Which stabilisation shows a target's aspect correctly? Why does that matter for the collision regulations?",
    "What would happen to every true vector if the reference target were a slow-moving boat instead of a fixed mark?",
    "What does the POOR GROUND REFERENCE alarm tell you to do?",
  ],
};

// ---------------------------------------------------------------- 8
const EX8: ArpaExercise = {
  id: "arpa-8", number: 8, title: "Sensor errors and ARPA limitations", rangeNm: 6, safeNm: 0.5,
  aim: "Recognise wrong gyro and log inputs, a lost target, and what the ARPA cannot tell you.",
  scenario: open("arpa-8", "ARPA 8: errors and limitations", { heading: 0, speed: 12 }, [
    ship(1, "Ship U", 30, 5.5, 200, 10),
    { id: 2, name: "Fishing boat V", kind: "small-craft", pos: { e: -2, n: 1.5 }, course: 290, speed: 13, rcs: 0.03, height: 4, events: [] },
    { id: 3, name: "Beacon W", kind: "beacon", pos: { e: 3, n: 4 }, course: 0, speed: 0, rcs: 0.5, height: 15, events: [] },
  ]),
  briefing: [
    "Acquire the ship, the fishing boat and the beacon. Note the heading and log readouts and the beacon's data while everything is correct.",
    "During the exercise a sensor input will go wrong. The ARPA gives NO alarm for a wrong gyro or log: compare readouts (heading against the course steered, a fixed mark's true vector, the log against expected speed).",
    "The fishing boat's echo is weak and it is opening: watch for FADE and LOST and acknowledge the alarm.",
    "Run the ARPA self-test once.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "Ship U and Beacon W tracked", done: allTracked([1, 3]) },
    { id: "test", kind: "action", prompt: "Self-test run", done: (c) => c.obs.tests >= 1 },
    { id: "ack", kind: "action", prompt: "An alarm acknowledged (lost target)", done: (c) => c.obs.acks >= 1 },
    {
      id: "which", kind: "choice", prompt: "Which input is wrong now?", choices: ["Gyro (heading)", "Speed log", "Both", "Neither"],
      correct: (c) => {
        const g = Math.abs(c.w.sensors.gyroErrorDeg) > 0.5;
        const l = Math.abs(c.w.sensors.logErrorKn) > 0.3;
        return g && l ? 2 : g ? 0 : l ? 1 : 3;
      },
    },
    {
      id: "gyro", kind: "number", prompt: "Gyro error (+ if the gyro reads high). Answer when it has stopped changing", unit: "°",
      truth: (c) => (c.w.sensors.target && Math.abs(c.w.sensors.gyroErrorDeg - c.w.sensors.target.gyroErrorDeg) < 0.05 && Math.abs(c.w.sensors.gyroErrorDeg) > 0.5 ? c.w.sensors.gyroErrorDeg : null),
      tol: (c) => c.tol.errorDeg,
    },
    { id: "cpaerr", kind: "choice", prompt: "With a steady gyro error, which ARPA data stays correct?", choices: ["True course of targets", "CPA and TCPA", "True bearings", "Nothing"], correct: () => 1 },
  ],
  script: [
    { atSeconds: 300, note: "Gyro error +4° brought in (1°/min).", run: (w) => { w.sensors.target = { gyroErrorDeg: 4, logErrorKn: w.sensors.target?.logErrorKn ?? 0 }; } },
  ],
  debrief: [
    "How did you notice the gyro error? How long did the vectors take to settle after it stopped changing?",
    "Why were CPA and TCPA still right while the true courses were wrong?",
    "The fishing boat was lost. What would you do on a real bridge when a tracked target is lost?",
    "Which faults does the ARPA detect by itself and which can only the operator find?",
  ],
};

// ---------------------------------------------------------------- 9
const EX9: ArpaExercise = {
  id: "arpa-9", number: 9, title: "Collision avoidance in restricted visibility", rangeNm: 12, safeNm: 2,
  aim: "Make a full appraisal of several ships by ARPA and take action that complies with Rule 19.",
  scenario: open(
    "arpa-9", "ARPA 9: restricted visibility", { heading: 0, speed: 12 },
    [
      ship(1, "Ship X", 25, 9, 232, 11),
      ship(2, "Ship Y", 330, 10, 150, 8),
      ship(3, "Ship Z", 160, 4, 0, 12),
      ship(4, "Ship AA", 95, 8, 60, 9),
    ],
    { seaState: 3, rain: [{ center: { e: 2, n: 5 }, radius: 2.5, intensity: 0.5 }] },
  ),
  briefing: [
    "Visibility is 0.5 NM. No ship is in sight: every decision is made on radar information alone (Rule 19).",
    "Acquire all ships and make a full appraisal: CPA, TCPA, course, speed and aspect of each.",
    "Use the trial manoeuvre before acting. Rule 19(d): avoid altering to port for a vessel forward of the beam (unless overtaking it), and avoid altering towards a vessel abeam or abaft the beam.",
    "Take action in ample time, large enough to be seen on another ship's radar. Keep checking until all ships are past and clear, then resume course.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "All four ships tracked", done: allTracked([1, 2, 3, 4]) },
    { id: "who", kind: "choice", prompt: "With which ship is a close-quarters situation developing (smallest CPA)?", choices: ["Ship X", "Ship Y", "Ship Z", "Ship AA"], correct: (c) => (c.obs.manoeuvre ? 0 : mostDangerous(c, [1, 2, 3, 4])) },
    { id: "trial", kind: "action", prompt: "Trial manoeuvre used before acting", done: (c) => c.obs.trialUsed },
    { id: "act", kind: "outcome", prompt: "Action complied with Rule 19(d) and was large enough (Rule 8)", judge: judgeAction(true) },
    { id: "safe", kind: "outcome", prompt: "Every ship passed at 2 NM or more", judge: (c) => judgeSafePassing(EX9)(c), rule: (cfg) => judgeSafePassing(EX9).rule?.(cfg) ?? "" },
  ],
  script: [],
  debrief: [
    "Which rules of Section II (vessels in sight) did NOT apply here, and why?",
    "Why would an alteration to port have been dangerous with Ship X?",
    "Ship Z was abaft the beam on the starboard side. How did that limit the action?",
    "Would a reduction of speed alone have been enough? What would it look like on the other ships' radars?",
  ],
};

export const ARPA_EXERCISES: ArpaExercise[] = [EX1, EX2, EX3, EX4, EX5, EX6, EX7, EX8, EX9];
export const arpaExerciseById = (id: string): ArpaExercise | undefined => ARPA_EXERCISES.find((e) => e.id === id);

/** Relative bearing of a target from own bow, degrees (helper for reports). */
export const relBearingOf = (w: World, id: number): number | null => {
  const t = targetById(w, id);
  return t ? normalizeDeg(bearingOf(sub(t.pos, w.own.pos)) - w.own.heading) : null;
};
