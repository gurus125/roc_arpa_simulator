import { Vec2, angleDiffDeg, bearingOf, fromPolar, length, sub } from "../core/vec";
import { courseToSteer } from "../core/current";
import { advanceLeg, routeLegs } from "../core/route";
import { crossTrackError } from "../core/nav";
import { TssScheme } from "../core/tss";
import { Scenario, TARGET_TYPES, cameBackAt, targetFromType } from "../engine/index";
import { ArpaExercise, OutcomeJudge, TaskCtx, judgeAction, judgeSafePassing, truthCpa } from "./session";

/**
 * Exercises added on 18 Nov 2026: monitoring a planned route, a traffic separation scheme, man overboard and
 * search patterns, safe speed in restricted visibility, and a timed ARPA acquisition test. Added on 20 Nov 2026:
 * exercise 32, a ship that keeps coming.
 *
 * EVERY limit below is a PLACEHOLDER for the institute to set. No rule or standard gives these figures: they
 * were chosen only so that the exercises can be worked and marked. The questions are on the collision
 * regulations (rules 6, 10, 15 and 19) and on the search patterns of the IAMSAR Manual, volume III, in our
 * own words.
 */
export const NAV_LIMITS = {
  /** Exercise 27: greatest distance off the planned route, NM. */
  routeXteNm: 0.25,
  /** Exercise 28: seconds in all that own ship may be in the separation zone or going against the flow of a lane. */
  tssGraceSec: 30,
  /** Exercise 29: the MOB key pressed within this many seconds of the report. */
  mobKeySec: 30,
  /** Exercise 29: own ship brought back to within this distance of the person, NM, at not more than this speed, knots. */
  mobCloseNm: 0.1,
  mobSpeedKn: 5,
  /** Exercise 30: the speed to come down to, knots, within this many minutes of the visibility closing. */
  safeSpeedKn: 8,
  safeSpeedByMin: 8,
  /** Exercise 31: minutes allowed (a track needs about three minutes to settle). */
  timedAcqMin: 8,
  /** Exercise 32: passing distance, NM; after she first comes back, a further alteration of this many degrees or the
   * speed brought down to this share, within this many minutes. Not needed if she never came within twice the
   * passing distance after own ship's first action. */
  keepsComingSafeNm: 1,
  againTurnDeg: 20,
  againSpeedShare: 0.6,
  againWithinMin: 6,
};

type Tgt = Scenario["targets"][number];
const typed = (id: string) => targetFromType(TARGET_TYPES.find((t) => t.id === id)!);
const vessel = (id: number, name: string, type: string, pos: Vec2, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt =>
  ({ id, name, ...typed(type), pos, course, speed, events: [], ...extra });
const buoy = (id: number, name: string, pos: Vec2): Tgt => ({ id, name, kind: "buoy", pos, course: 0, speed: 0, rcs: 0.02, height: 3, events: [] });
const allTracked = (ids: number[]) => (c: TaskCtx): boolean => ids.every((id) => c.obs.tracked.has(id));

// ---------------------------------------------------------------- 27: monitoring a planned route

/** Three legs: 040° for 3 NM, 090° for 2.5 NM, 030° for 2.5 NM. */
export const ROUTE_27: Vec2[] = [{ e: 0, n: 0 }, fromPolar(40, 3), { e: fromPolar(40, 3).e + 2.5, n: fromPolar(40, 3).n }, { e: fromPolar(40, 3).e + 2.5 + fromPolar(30, 2.5).e, n: fromPolar(40, 3).n + fromPolar(30, 2.5).n }];

/** Distance off the leg of a route that own ship is on now, NM (starboard positive), and that leg's track. */
export function offRoute(route: Vec2[], pos: Vec2): { xtd: number; leg: number; track: number } {
  const leg = advanceLeg(route, pos, 0, 0);
  return { xtd: crossTrackError(pos, route[leg]!, route[leg + 1]!), leg, track: routeLegs(route)[leg]!.bearing };
}

const EX27: ArpaExercise = {
  id: "radar-27", number: 27, group: "Radar", title: "Monitoring a planned route on the radar", rangeNm: 6, safeNm: 0.5,
  aim: "Keep the ship on a planned route of three legs with the radar: the route on the picture, the distance off the track, and the course to steer in a current.",
  scenario: {
    id: "radar-27", name: "Radar 27: a route of three legs", description: "A route of three legs past two buoys, with the current setting across it.",
    own: { heading: 40, speed: 12 }, env: { seaState: 2, current: { set: 110, drift: 1.5 } }, coasts: [],
    targets: [
      buoy(1, "Buoy No. 1", { e: ROUTE_27[1]!.e + 0.3, n: ROUTE_27[1]!.n + 0.25 }),
      buoy(2, "Buoy No. 2", { e: ROUTE_27[2]!.e + 0.1, n: ROUTE_27[2]!.n - 0.35 }),
      vessel(3, "Coaster", "coaster", { e: 7.5, n: 7.5 }, 250, 9),
    ],
  },
  route: ROUTE_27,
  briefing: [
    "The planned route is on the radar: three legs, 040° for 3 NM, 090° for 2.5 NM and 030° for 2.5 NM. Use true motion or relative motion, north-up, ground stabilised, on the 6 NM range scale.",
    "A current sets across the route. The EBL / CURSOR panel shows the next waypoint with its bearing and distance, and XTD: how far the ship is off the leg, S to starboard of it, P to port. Steer so that XTD stays small.",
    `Keep within ${NAV_LIMITS.routeXteNm} NM of the route (a placeholder limit) and alter course in good time at each waypoint: a ship does not turn at once.`,
    "Check the route against the radar: buoy No. 1 should pass close to starboard at the first waypoint and buoy No. 2 close to starboard at the second.",
    "Press Finish when the last waypoint is passed.",
  ],
  tasks: [
    { id: "cts", kind: "number", prompt: "Course to steer now to make good the track of the leg you are on", unit: "°", circular: true, truth: (c) => courseToSteer(offRoute(ROUTE_27, c.w.own.pos).track, Math.max(1, c.w.own.speedThroughWater), c.w.env.current)?.heading ?? null, tol: (cfg) => cfg.tol.courseDeg },
    { id: "side", kind: "choice", prompt: "On the first leg (040°) with the current setting 110°, where does the ship go if she steers 040°?", choices: ["To starboard of the track", "To port of the track", "She stays on the track but goes faster", "She stays on the track but goes slower"], correct: () => 0 },
    { id: "xtdmean", kind: "choice", prompt: "The panel shows XTD 0.20 S. What does it mean?", choices: ["The ship is 0.2 NM to starboard of the leg: steer to port of the track to come back", "The next waypoint is 0.2 NM to starboard", "The ship must alter 20° to starboard", "The current is 0.2 kn to starboard"], correct: () => 0 },
    { id: "kept", kind: "outcome", prompt: `Kept within ${NAV_LIMITS.routeXteNm} NM of the route`, rule: () => `never more than ${NAV_LIMITS.routeXteNm} NM off the leg being sailed`, judge: (c) => ({ ok: c.obs.maxXte <= NAV_LIMITS.routeXteNm, detail: `greatest distance off the route ${c.obs.maxXte.toFixed(2)} NM` }) },
    { id: "done", kind: "outcome", prompt: "Route completed: the last waypoint passed", rule: () => "the end of the last leg passed", judge: (c) => ({ ok: c.obs.trackDone, detail: c.obs.trackDone ? "last waypoint passed" : "the last waypoint was not reached" }) },
  ],
  script: [],
  debrief: [
    "How did you know the route on the radar was in the right place? What would a wrong position input do to it?",
    "Why is the distance off the track from the radar route only as good as the ship's position and the ground stabilisation?",
    "How early did you start each turn, and why?",
  ],
};

// ---------------------------------------------------------------- 28: traffic separation scheme

/** Axis north to south; own ship is bound north, so her lane is the one east of the separation zone. */
export const TSS_28: TssScheme = { name: "Exercise scheme", a: { e: 0, n: -2 }, b: { e: 0, n: 16 }, zoneHalfWidthNm: 0.5, laneWidthNm: 2 };

const judgeLane: OutcomeJudge = Object.assign((c: TaskCtx) => {
  const t = c.obs.tss;
  const bad = t.against + t.zone;
  return { ok: t.withFlow > 60 && bad <= NAV_LIMITS.tssGraceSec, detail: `with the flow ${Math.round(t.withFlow / 60)} min; against the flow ${Math.round(t.against)} s; in the separation zone ${Math.round(t.zone)} s` };
}, { rule: () => `in a lane with the flow, and not more than ${NAV_LIMITS.tssGraceSec} s in all in the separation zone or against the flow` });

const EX28: ArpaExercise = {
  id: "radar-28", number: 28, group: "Radar", title: "Traffic separation scheme with dense traffic", rangeNm: 6, safeNm: 0.5,
  aim: "Take the ship through a traffic separation scheme in dense traffic: the correct lane, the flow of traffic, a crossing vessel and a slower ship ahead (rule 10 with rules 13 and 15).",
  scenario: {
    id: "radar-28", name: "Radar 28: traffic separation scheme", description: "A traffic separation scheme running north and south, with traffic in both lanes, a crossing ferry and fishing boats.",
    own: { heading: 0, speed: 12, pos: { e: 1.3, n: 0 } }, env: { seaState: 2 }, coasts: [], tss: [TSS_28],
    targets: [
      vessel(1, "Ferry (crossing)", "ferry", { e: 8.8, n: 5.0 }, 270, 18),
      vessel(2, "Bulk carrier (slow, ahead)", "bulk-handy", { e: 1.95, n: 2.5 }, 0, 7),
      vessel(3, "Container ship (astern)", "container-feeder", { e: 0.7, n: -3.5 }, 0, 15),
      vessel(4, "Tanker (southbound)", "product-tanker", { e: -1.2, n: 9 }, 180, 13),
      vessel(5, "Coaster (southbound)", "coaster", { e: -1.9, n: 5 }, 180, 9),
      vessel(6, "Cargo ship (southbound)", "general-cargo", { e: -1.0, n: 14 }, 180, 12),
      vessel(7, "Fishing boat (in the zone)", "fishing-boat", { e: 0.1, n: 6 }, 90, 0.5),
      vessel(8, "Cargo ship (ahead, northbound)", "general-cargo", { e: 1.2, n: 7 }, 0, 12),
    ],
  },
  briefing: [
    "The scheme runs north and south and is drawn on the radar: the separation zone in the middle, a lane 2 NM wide either side, and an arrow for the flow in each lane. Own ship is bound north at 12 knots.",
    "Stay in the lane for northbound traffic and go with the flow. Keep out of the separation zone.",
    "Acquire the ships. A ferry is crossing the lanes from the east; a slower ship is ahead in your lane; a faster one is coming up astern. Rule 10 does not take away any other rule: decide who gives way in each case and act in good time, staying in your lane if you can.",
    `Pass every vessel at ${0.5} NM or more (a placeholder). Press Finish when the ferry and the slow ship are past and clear.`,
  ],
  tasks: [
    { id: "trk", kind: "action", prompt: "The crossing ferry and the slow ship ahead tracked", done: allTracked([1, 2]) },
    { id: "cpa", kind: "number", prompt: "Ferry: CPA if nobody acts", unit: "NM", truth: (c) => (c.obs.manoeuvre ? null : (truthCpa(c.w, 1)?.cpa ?? null)), tol: (cfg) => cfg.tol.cpaNm },
    { id: "lane", kind: "choice", prompt: "Bound north in this scheme, which lane does own ship use?", choices: ["The lane east of the separation zone: the zone is kept on her port side", "The lane west of the separation zone", "Either lane, if it is clear", "The separation zone itself, as it has no traffic"], correct: () => 0 },
    { id: "ferry", kind: "choice", prompt: "The ferry is crossing from own ship's starboard side with risk of collision. Who keeps out of the way?", choices: ["Own ship: rule 15 applies, a traffic lane gives no right of way", "The ferry, because own ship is following a traffic lane", "Both must alter to port", "Neither: each keeps her course and speed"], correct: () => 0 },
    { id: "cross", kind: "choice", prompt: "How should a vessel that has to cross the lanes do it?", choices: ["On a heading as nearly as practicable at right angles to the flow", "At a small angle to the flow, to stay in the lane longer", "Along the separation zone until a gap appears", "Against the flow of the nearer lane"], correct: () => 0 },
    { id: "kept", kind: "outcome", prompt: "Kept in the northbound lane with the flow, clear of the separation zone", judge: judgeLane },
    { id: "safe", kind: "outcome", prompt: "Every vessel passed at a safe distance", judge: judgeSafePassing({ safeNm: 0.5 }) },
  ],
  script: [],
  debrief: [
    "Why does a traffic lane give no right of way over a crossing vessel?",
    "You gave way to the ferry: by an alteration of course, of speed, or both? What limited your choice in the lane?",
    "What must a vessel overtaking in a lane watch for, with the lane's edge and the separation zone close by?",
  ],
};

// ---------------------------------------------------------------- 29: man overboard and search patterns

/** The moment the look-out reports the man overboard, seconds. */
export const MOB_AT_SEC = 120;
const MOB_ID = 9;

const EX29: ArpaExercise = {
  id: "radar-29", number: 29, group: "Radar", title: "Man overboard: the MOB mark, the turn back and a search pattern", rangeNm: 3, safeNm: 0.2,
  aim: "Mark a man overboard at once, bring the ship back to the position, and lay a search pattern on the radar from the datum.",
  scenario: {
    id: "radar-29", name: "Radar 29: man overboard", description: "Open sea. Two minutes after the start a man falls overboard.",
    own: { heading: 350, speed: 14 }, env: { seaState: 2 }, coasts: [],
    targets: [vessel(1, "Cargo ship", "general-cargo", fromPolar(60, 7), 240, 11)],
  },
  briefing: [
    "Own ship 350° at 14 knots in open water. Some time after the start the look-out reports a man overboard.",
    "At the report: press MOB at once (ship control, or the own ship keys in the menu). It marks the ship's position at that moment on the radar. A person in the water gives no radar echo: the mark is all you have.",
    "Turn back. A Williamson turn brings the ship onto the reciprocal of her course, back along her own track: hard over to the side the person fell; when the heading has changed 60°, hard over the other way; steady on the reciprocal course. Reduce speed as you come back to the mark.",
    `Bring the ship back to within ${NAV_LIMITS.mobCloseNm} NM of the person at not more than ${NAV_LIMITS.mobSpeedKn} knots (placeholders).`,
    "Then lay a search pattern from the MOB mark, as you would if the person were not sighted: MENU, PI / MAP, search pattern, datum \"MOB mark\", expanding square, with a track spacing of your choice.",
  ],
  tasks: [
    { id: "key", kind: "outcome", prompt: `MOB key pressed within ${NAV_LIMITS.mobKeySec} s of the report`, rule: () => `the MOB key pressed not more than ${NAV_LIMITS.mobKeySec} s after the report`, judge: (c) => {
      const at = c.obs.mobKeyAt;
      const late = at === null ? Infinity : at - MOB_AT_SEC;
      return { ok: late >= 0 && late <= NAV_LIMITS.mobKeySec, detail: at === null ? "the MOB key was not pressed" : late < 0 ? "the MOB key was pressed before the report" : `pressed ${Math.round(late)} s after the report` };
    } },
    { id: "rudder", kind: "choice", prompt: "The person fell from the starboard side. What is the first rudder order?", choices: ["Hard a-starboard: the stern swings away from the person", "Hard a-port: to turn away from the person", "Midships and stop engines", "Full astern, rudder amidships"], correct: () => 0 },
    { id: "shift", kind: "choice", prompt: "In a Williamson turn, when is the rudder put hard over the other way?", choices: ["When the heading has changed 60° from the original course", "When the heading has changed 180°", "As soon as the ship starts to turn", "When the speed has dropped to half"], correct: () => 0 },
    { id: "recip", kind: "number", prompt: "Course to steady on after the turn (the reciprocal of 350°)", unit: "°", circular: true, truth: () => 170, tol: () => 2 },
    { id: "legs", kind: "choice", prompt: "An expanding square search has a track spacing S. How long are its first four legs?", choices: ["S, S, 2S, 2S", "S, 2S, 3S, 4S", "S, S, S, S", "2S, 2S, 4S, 4S"], correct: () => 0 },
    { id: "back", kind: "outcome", prompt: `Back to within ${NAV_LIMITS.mobCloseNm} NM of the person at ${NAV_LIMITS.mobSpeedKn} kn or less`, rule: () => `closest approach to the person ${NAV_LIMITS.mobCloseNm} NM or less, at ${NAV_LIMITS.mobSpeedKn} kn or less`, judge: (c) => {
      const r = c.obs.returnRange[MOB_ID] ?? Infinity;
      const sp = c.obs.returnSpeed[MOB_ID] ?? Infinity;
      return { ok: r <= NAV_LIMITS.mobCloseNm && sp <= NAV_LIMITS.mobSpeedKn, detail: Number.isFinite(r) ? `came back to ${r.toFixed(2)} NM at ${sp.toFixed(1)} kn` : "the ship did not come back" };
    } },
    { id: "pattern", kind: "action", prompt: "A search pattern laid on the radar", done: (c) => c.obs.routePoints >= 5 },
  ],
  script: [{
    atSeconds: MOB_AT_SEC, note: "Man overboard from the starboard side: a person in the water at own ship's position (no radar echo).",
    say: "LOOK-OUT: MAN OVERBOARD, STARBOARD SIDE!",
    run: (w) => {
      w.targets.push({ id: MOB_ID, name: "Person in the water", kind: "small-craft", pos: { ...w.own.pos }, course: 0, speed: 0, rcs: 0.00001, height: 0.2, events: [], nextEvent: 0, ais: false });
    },
  }],
  debrief: [
    "How far did the ship travel between the report and the MOB key? What does that distance mean for the search?",
    "Why does the Williamson turn suit a man overboard at night or in poor visibility, although it is not the quickest turn?",
    "When would you choose a sector search instead of an expanding square?",
  ],
};

// ---------------------------------------------------------------- 30: safe speed in restricted visibility

/** The moment the visibility closes, seconds. */
export const FOG_AT_SEC = 180;
/** The visibility from then on, NM (a figure for this exercise). */
export const FOG_VISIBILITY_NM = 0.8;

const judgeSafeSpeed: OutcomeJudge = Object.assign((c: TaskCtx) => {
  const by = FOG_AT_SEC + NAV_LIMITS.safeSpeedByMin * 60;
  const hit = c.obs.speedLog.find(([t, kn]) => t >= FOG_AT_SEC && t <= by && kn <= NAV_LIMITS.safeSpeedKn);
  const at = c.obs.speedLog.filter(([t]) => t <= by).pop();
  return { ok: !!hit, detail: hit ? `down to ${hit[1].toFixed(1)} kn ${((hit[0] - FOG_AT_SEC) / 60).toFixed(1)} min after the visibility closed` : `still ${at ? at[1].toFixed(1) : "?"} kn ${NAV_LIMITS.safeSpeedByMin} min after the visibility closed` };
}, { rule: () => `speed over the ground down to ${NAV_LIMITS.safeSpeedKn} kn or less within ${NAV_LIMITS.safeSpeedByMin} min of the visibility closing` });

const EX30: ArpaExercise = {
  id: "radar-30", number: 30, group: "Radar", title: "Safe speed in restricted visibility", rangeNm: 6, safeNm: 0.5,
  aim: "Judge a safe speed when the visibility closes in rain with small craft about: what the radar can and cannot show, and how far the ship needs to stop.",
  scenario: {
    id: "radar-30", name: "Radar 30: safe speed", description: "Full sea speed towards a rain area with fishing boats in it.",
    own: { heading: 0, speed: 16 }, env: { seaState: 3, rain: [{ center: { e: 0.5, n: 5.5 }, radius: 2.5, intensity: 0.8 }] }, coasts: [],
    targets: [
      vessel(1, "Fishing boat A", "fishing-boat", { e: 0.6, n: 4.6 }, 270, 3),
      vessel(2, "Fishing boat B", "fishing-boat", { e: -0.9, n: 6.0 }, 180, 1),
      vessel(3, "Fishing boat C", "fishing-boat", { e: 1.6, n: 6.8 }, 200, 2),
      vessel(4, "Tanker", "product-tanker", { e: -4, n: 11 }, 165, 13),
    ],
  },
  briefing: [
    "Own ship 000° at 16 knots, sea speed. A rain area lies ahead and fishing boats were reported in it. On X band the rain hides small echoes and weakens every echo beyond it.",
    "A few minutes after the start the bridge reports that the visibility has closed. From then on rule 19 applies: a safe speed for the conditions, engines ready for immediate manoeuvre.",
    `Bring the speed down. For this exercise the safe speed is taken as ${NAV_LIMITS.safeSpeedKn} knots or less, reached within ${NAV_LIMITS.safeSpeedByMin} minutes (placeholders: on board it is the master's judgement of the ship, the traffic and how far the radar can be relied on).`,
    "Use the radar to find the boats: try S band, a shorter pulse, the rain clutter control and a shorter range scale. Pass every vessel at 0.5 NM or more.",
    "Press Finish when the fishing boats are past and clear.",
  ],
  tasks: [
    { id: "factors", kind: "choice", prompt: "Which of these must a vessel with radar take into account in deciding her safe speed (rule 6)?", choices: ["That small vessels and other floating objects may not be detected at an adequate range", "That radar makes full speed safe in any visibility", "Only the range scale in use", "Only the number of targets being tracked"], correct: () => 0 },
    { id: "r19", kind: "choice", prompt: "In restricted visibility a power-driven vessel shall have her engines:", choices: ["Ready for immediate manoeuvre", "Stopped", "At full sea speed to clear the area quickly", "On slow ahead at all times"], correct: () => 0 },
    { id: "rain", kind: "choice", prompt: "Why may a fishing boat inside the rain not be seen on X band?", choices: ["Her echo is weaker than the rain clutter round her, and the rain weakens it further", "Rain bends the radar beam upwards over her", "X band cannot see wooden boats", "The rain clutter control removes all small echoes"], correct: () => 0 },
    { id: "speed", kind: "outcome", prompt: `Speed down to ${NAV_LIMITS.safeSpeedKn} kn or less within ${NAV_LIMITS.safeSpeedByMin} min of the visibility closing`, judge: judgeSafeSpeed },
    { id: "safe", kind: "outcome", prompt: "Every vessel passed at 0.5 NM or more", judge: judgeSafePassing({ safeNm: 0.5 }) },
  ],
  // The visibility closes to 0.8 NM: the bridge reports it (see train/lookout.ts), and from then on vessels within it are reported as they come into sight.
  script: [{ atSeconds: FOG_AT_SEC, note: "The visibility closes to 0.8 NM (reported to the trainee).", run: (w) => void (w.env.visibilityNm = FOG_VISIBILITY_NM) }],
  debrief: [
    "At 16 knots, how far does this ship travel before she is stopped? How does that compare with the range at which you first saw the nearest boat?",
    "Which radar settings helped most in the rain, and what did each cost you?",
    "What else does rule 19 ask for when a vessel is detected by radar alone forward of the beam?",
  ],
};

// ---------------------------------------------------------------- 32: a ship that keeps coming

/** Exercise 32: own ship acted again after the ship that keeps coming first came back. */
const judgeActAgain: OutcomeJudge = Object.assign((c: TaskCtx) => {
  const L = NAV_LIMITS;
  const back = cameBackAt(c.w);
  const closest = c.obs.minRange[1] ?? Infinity;
  if (back === null) {
    return c.obs.manoeuvre
      ? { ok: true, detail: "she never came back: own ship's action kept her clear" }
      : { ok: false, detail: "own ship took no action, so she never needed to come back" };
  }
  const at = <T>(log: [number, T][], t: number): T | undefined => log.filter(([x]) => x <= t).pop()?.[1];
  const course0 = at(c.obs.courseLog, back), speed0 = at(c.obs.speedLog, back);
  const by = back + L.againWithinMin * 60;
  const turned = c.obs.courseLog.find(([t, deg]) => t > back && t <= by && course0 !== undefined && Math.abs(angleDiffDeg(deg, course0)) >= L.againTurnDeg);
  const slowed = c.obs.speedLog.find(([t, kn]) => t > back && t <= by && speed0 !== undefined && kn <= speed0 * L.againSpeedShare);
  const hit = [turned, slowed].filter((x): x is [number, number] => !!x).sort((a, b) => a[0] - b[0])[0];
  if (hit) {
    const what = hit === turned ? `course changed ${Math.round(Math.abs(angleDiffDeg(hit[1], course0!)))}°` : `speed down to ${hit[1].toFixed(1)} kn`;
    return { ok: true, detail: `${what}, ${((hit[0] - back) / 60).toFixed(1)} min after she first came back` };
  }
  if (closest >= 2 * L.keepsComingSafeNm) return { ok: true, detail: `she came back but never closer than ${closest.toFixed(1)} NM: no more action was needed` };
  return { ok: false, detail: `no further action within ${L.againWithinMin} min of her coming back (she came to ${closest.toFixed(2)} NM)` };
}, { rule: () => `after she first comes back: a further alteration of ${NAV_LIMITS.againTurnDeg}° or more, or the speed down to ${Math.round(NAV_LIMITS.againSpeedShare * 100)}% or less, within ${NAV_LIMITS.againWithinMin} min (not needed if she never comes within ${2 * NAV_LIMITS.keepsComingSafeNm} NM)` });

const EX32: ArpaExercise = {
  id: "arpa-32", number: 32, title: "A ship that keeps coming", rangeNm: 12, safeNm: NAV_LIMITS.keepsComingSafeNm,
  aim: "Give way in good time, and keep watching after the action: when the other ship keeps coming back, recognise it on the ARPA, sound the doubt signal and act again, boldly, until she is past and clear.",
  scenario: {
    id: "arpa-32", name: "ARPA 32: a ship that keeps coming", description: "Open sea, good visibility. A bulk carrier crosses from starboard on a collision course; her officer is not keeping a proper look-out.",
    own: { heading: 0, speed: 12 }, env: { seaState: 2 }, coasts: [],
    traffic: "careless", trafficShip: 1,
    targets: [
      vessel(1, "Ship K", "bulk-handy", { e: 4.4, n: 4.4 }, 270, 12),
      vessel(2, "Ship L", "container-feeder", fromPolar(330, 10), 180, 14),
      vessel(3, "Fishing boat", "fishing-boat", { e: -2, n: 2.2 }, 0, 3),
    ],
  },
  briefing: [
    "Own ship 000° at 12 knots, open sea, good visibility: the ships are in sight of one another. Ship K, a bulk carrier, is crossing from starboard on a collision course.",
    "Acquire the ships and appraise them. Own ship gives way to Ship K: act early and substantially, to starboard, so as to pass astern of her.",
    "Her officer is not keeping a proper look-out. Do not take your action as the end of it: keep watching her CPA and TCPA and her vector. If she comes back towards you, she is not doing what you expect.",
    "Then sound at least five short and rapid blasts (VHF/SIGNAL, 5 SHORT) and act again, boldly: a larger alteration, or slow down or stop. Small corrections will not do.",
    `Pass every vessel at ${NAV_LIMITS.keepsComingSafeNm} NM or more. Press Finish when Ship K is past and clear.`,
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "Ship K, Ship L and the fishing boat tracked", done: allTracked([1, 2, 3]) },
    { id: "who", kind: "choice", prompt: "Ship K is crossing from starboard. Who keeps out of the way?", choices: ["Own ship: Ship K is on her starboard side (Rule 15)", "Ship K: she is the larger ship", "Both: each alters to starboard", "Neither: both hold their course"], correct: () => 0 },
    { id: "act", kind: "outcome", prompt: "First action large enough to be readily apparent (timing: the assessor judges)", judge: judgeAction(false) },
    { id: "again", kind: "outcome", prompt: "Acted again when Ship K came back", judge: judgeActAgain, rule: (cfg) => judgeActAgain.rule?.(cfg) ?? "" },
    { id: "doubt", kind: "action", prompt: "Five short blasts sounded when Ship K came back", done: (c) => {
      const back = cameBackAt(c.w);
      return back !== null && c.obs.signals.some((s) => s.id === "doubt" && s.t >= back);
    } },
    { id: "rule", kind: "choice", prompt: "You have given way, but Ship K keeps coming back towards you. What do the rules ask of you now?", choices: ["Take further action, boldly, and keep checking until she is past and clear: slow down or stop if need be (Rules 2 and 8)", "Hold your new course: you have done your part", "Turn to port across her bow", "Call her on VHF and wait for her answer before doing anything"], correct: () => 0 },
    { id: "sig", kind: "choice", prompt: "Which sound signal says you are in doubt about another ship's intentions?", choices: ["At least five short and rapid blasts (Rule 34(d))", "One short blast", "Two prolonged blasts", "Three short blasts"], correct: () => 0 },
    { id: "safe", kind: "outcome", prompt: `Every vessel passed at ${NAV_LIMITS.keepsComingSafeNm} NM or more`, judge: (c) => judgeSafePassing(EX32)(c), rule: (cfg) => judgeSafePassing(EX32).rule?.(cfg) ?? "" },
  ],
  script: [],
  debrief: [
    "How did you first see that Ship K was coming back: her vector, her CPA, or her bearing? How long after she turned?",
    "Why is a succession of small alterations a poor answer to a ship that keeps coming?",
    "When would you have stopped the ship? What does that cost you, and what does it give you?",
    "What could you have tried on VHF, and why must that not delay your action?",
  ],
};

// ---------------------------------------------------------------- 31: timed ARPA acquisition

const TIMED_IDS = [1, 2, 3, 4, 5, 6];

const EX31: ArpaExercise = {
  id: "arpa-31", number: 31, title: "Timed test: acquire, assess and report", rangeNm: 12, safeNm: 1,
  aim: "Against the clock: acquire every target, wait for steady data, and report the most dangerous one.",
  scenario: {
    id: "arpa-31", name: "ARPA 31: timed acquisition", description: "Six ships within 10 NM.",
    own: { heading: 20, speed: 14 }, env: { seaState: 2 }, coasts: [],
    targets: [
      vessel(1, "Ship A", "container-feeder", fromPolar(60, 8.5), 265, 16),
      vessel(2, "Ship B", "general-cargo", fromPolar(350, 9), 185, 11),
      vessel(3, "Ship C", "product-tanker", fromPolar(110, 6), 330, 12),
      vessel(4, "Ship D", "coaster", fromPolar(300, 5), 60, 8),
      vessel(5, "Ship E", "bulk-handy", fromPolar(25, 10), 205, 13),
      vessel(6, "Ship F", "ferry", fromPolar(150, 7), 10, 19),
    ],
  },
  timeLimitMin: NAV_LIMITS.timedAcqMin,
  briefing: [
    `A timed test: ${NAV_LIMITS.timedAcqMin} minutes of exercise time (a placeholder; the instructor can set another). The time left is shown with the questions.`,
    "Acquire all six ships. Do not report from preliminary data: a track needs about three minutes before its CPA, TCPA, course and speed are steady.",
    "Report the target with the smallest CPA, then press Finish before the time is up.",
  ],
  tasks: [
    { id: "all", kind: "action", prompt: "All six targets acquired and tracked steadily", done: allTracked(TIMED_IDS) },
    { id: "held", kind: "outcome", prompt: "All six targets being tracked when Finish was pressed", rule: () => "a steady track on each of the six ships at the end", judge: (c) => {
      const n = TIMED_IDS.filter((id) => c.a.tracks.some((t) => t.truthId === id && t.state === "tracking" && t.quality !== "acquiring")).length;
      return { ok: n === TIMED_IDS.length, detail: `${n} of ${TIMED_IDS.length} tracked at the end` };
    } },
    { id: "which", kind: "choice", prompt: "Which ship has the smallest CPA?", choices: TIMED_IDS.map((id) => `Ship ${"ABCDEF"[id - 1]}`), correct: (c) => {
      let best = 0, cpa = Infinity;
      TIMED_IDS.forEach((id, i) => {
        const r = truthCpa(c.w, id);
        if (r && r.tcpaMinutes !== null && r.tcpaMinutes > 0 && r.cpa < cpa) {
          cpa = r.cpa;
          best = i;
        }
      });
      return best;
    } },
    { id: "cpa", kind: "number", prompt: "Ship A: CPA", unit: "NM", truth: (c) => truthCpa(c.w, 1)?.cpa ?? null, tol: (cfg) => cfg.tol.cpaNm },
    { id: "tcpa", kind: "number", prompt: "Ship A: TCPA from now", unit: "min", truth: (c) => truthCpa(c.w, 1)?.tcpaMinutes ?? null, tol: (cfg) => cfg.tol.tcpaMin },
    { id: "brg", kind: "number", prompt: "Ship F: true bearing now", unit: "°", circular: true, truth: (c) => {
      const t = c.w.targets.find((x) => x.id === 6);
      return t ? bearingOf(sub(t.pos, c.w.own.pos)) : null;
    }, tol: (cfg) => cfg.tol.bearingDeg },
    { id: "rng", kind: "number", prompt: "Ship F: range now", unit: "NM", truth: (c) => {
      const t = c.w.targets.find((x) => x.id === 6);
      return t ? length(sub(t.pos, c.w.own.pos)) : null;
    }, tol: (cfg) => cfg.tol.rangeNm },
  ],
  script: [],
  debrief: [
    "Which target did you acquire first, and why?",
    "How did you know a track's data had become steady?",
    "What would you have reported if the time had run out before the data settled?",
  ],
};

export const NAV_RADAR_EXERCISES: ArpaExercise[] = [EX27, EX28, EX29, EX30];
export const NAV_ARPA_EXERCISES: ArpaExercise[] = [EX31, EX32];
