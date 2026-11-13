import { Vec2, angleDiffDeg, bearingOf, courseSpeedOf, length, sub } from "../core/vec";
import { courseToSteer } from "../core/current";
import { latLonOf } from "../core/nav";
import {
  GOA_APPROACH, KOCHI_APPROACH, KUTCH_APPROACH, MUMBAI_APPROACH, Scenario, TARGET_TYPES, currentVelocity, setAnchorDrag, targetFromType,
} from "../engine/index";
import { ArpaExercise, TaskCtx, judgeAction, judgeSafePassing, truthCpa } from "./session";

/**
 * Radar exercises in the four real areas (real coastline and land heights; see
 * docs/RADAR-PICTURE.md). The ships, wind, current and tidal stream are invented, and the areas have
 * no depths, lights or buoys apart from the one buoy laid for exercise 24: none of this is a chart.
 * Every limit and tolerance is a placeholder for the institute to set (Instructor, Scoring settings).
 */

type Tgt = Scenario["targets"][number];
const typed = (id: string) => targetFromType(TARGET_TYPES.find((t) => t.id === id)!);
const vessel = (id: number, name: string, type: string, pos: Vec2, course: number, speed: number, extra: Partial<Tgt> = {}): Tgt =>
  ({ id, name, ...typed(type), pos, course, speed, events: [], ...extra });

const allTracked = (ids: number[]) => (c: TaskCtx): boolean => ids.every((id) => c.obs.tracked.has(id));
const cpaOf = (id: number) => (c: TaskCtx): number | null => truthCpa(c.w, id)?.cpa ?? null;
const tcpaOf = (id: number) => (c: TaskCtx): number | null => truthCpa(c.w, id)?.tcpaMinutes ?? null;
/** Own ship's latitude or longitude now, as minutes past a whole degree. */
const minutesOf = (c: TaskCtx, which: "lat" | "lon", degrees: number): number => (latLonOf(c.w.origin, c.w.own.pos)[which] - degrees) * 60;
const RAD = Math.PI / 180;

// ---------------------------------------------------------------- 23: Mumbai, radar fix with the GNSS failed

/** West tip of Malabar Hill, as the simulator's coastline has it: 18°56.9'N 072°47.5'E. */
export const MALABAR_POINT: Vec2 = { e: 16.58, n: 6.94 };
const MUMBAI_LAT = 18.9;

const EX23: ArpaExercise = {
  id: "radar-23", number: 23, group: "Radar", title: "Mumbai: radar fix with the GNSS failed", rangeNm: 12, safeNm: 1,
  aim: "Fix the ship's position by radar range and bearing when the GNSS has failed, close to a real coast, and keep clear of the land.",
  scenario: {
    ...MUMBAI_APPROACH, id: "radar-23", name: "Radar 23: Mumbai, GNSS failed",
    description: "Approaching Mumbai at 8 knots with the GNSS failed. Real coastline and land heights; invented ships.",
    own: { heading: 60, speed: 8, pos: { e: 11.5, n: 0 } },
    targets: [
      vessel(1, "Bulk carrier at anchor", "bulk-handy", { e: 12.5, n: -1.5 }, 250, 0, { atAnchor: true }),
      vessel(2, "Coaster", "coaster", { e: 9, n: -12 }, 2, 10),
      vessel(3, "Fishing boat", "fishing-boat", { e: 6, n: 4 }, 190, 5),
    ],
  },
  setup: (_a, w) => {
    w.sensors.gnssFailed = true;
  },
  briefing: [
    "The GNSS (EPFS) has failed: there is no position on the radar, on the cursor or in the AIS, and the ARPA warns EPFS INPUT ABSENT. You are closing Mumbai on 060° at 8 knots, about 6 NM off the coast.",
    "Fix the position by radar. Malabar Point, the west tip of Malabar Hill (the high ground north of Back Bay), is at 18°56.9'N 072°47.5'E and gives a strong echo. Identify it on the picture, then measure its range with the VRM and its bearing with the EBL at the same moment.",
    "Plot the fix on the chart, or work it: latitude = 18°56.9' − range × cos(bearing) minutes; longitude = 072°47.5' − range × sin(bearing) ÷ cos(18.9°) minutes.",
    "Check the fix with a second position line that crosses the first well, for example the range of the land across the harbour entrance, to the east-south-east. Fix again at intervals: the ship is closing the land.",
    "Keep the ship at least 1 NM off the land (a placeholder margin): alter course or stop before you close the coast. The simulator has no depths: off Colaba there are reefs.",
  ],
  tasks: [
    { id: "rng", kind: "number", prompt: "Range of Malabar Point now", unit: "NM", truth: (c) => length(sub(MALABAR_POINT, c.w.own.pos)), tol: (cfg) => cfg.tol.rangeNm },
    { id: "brg", kind: "number", prompt: "True bearing of Malabar Point now", unit: "°", circular: true, truth: (c) => bearingOf(sub(MALABAR_POINT, c.w.own.pos)), tol: (cfg) => cfg.tol.bearingDeg },
    { id: "lat", kind: "number", prompt: "Own ship's latitude now: minutes north of 18° (for example 51.3)", unit: "'", truth: (c) => minutesOf(c, "lat", 18), tol: (cfg) => cfg.tol.rangeNm },
    { id: "lon", kind: "number", prompt: "Own ship's longitude now: minutes east of 072° (for example 40.2)", unit: "'", truth: (c) => minutesOf(c, "lon", 72), tol: (cfg) => Math.round((100 * cfg.tol.rangeNm) / Math.cos(MUMBAI_LAT * RAD)) / 100 },
    {
      id: "best", kind: "choice", prompt: "Which gives the most reliable radar fix?",
      choices: ["Ranges of two or three well-defined points whose position lines cross at a good angle", "Bearings of two hilltops", "One bearing and the depth", "Ranges of two points almost in line with own ship"],
      correct: () => 0,
    },
    {
      id: "why", kind: "choice", prompt: "Why is a fix by radar ranges usually better than one by radar bearings?",
      choices: [
        "Ranges are measured more accurately: the beam width spreads an echo in bearing, and a heading error moves every bearing",
        "Bearings cannot be measured on a north-up picture",
        "Ranges are not affected by the pulse length",
        "Bearings can only be measured on the 24 NM range scale",
      ],
      correct: () => 0,
    },
    {
      id: "clear", kind: "outcome", prompt: "Kept at least 1 NM off the land",
      rule: () => "own ship never closer than 1 NM to the coastline",
      judge: (c) => ({ ok: c.obs.minLandNm >= 1, detail: `closest to the land ${c.obs.minLandNm.toFixed(2)} NM` }),
    },
  ],
  script: [],
  debrief: [
    "How did you identify Malabar Point on the picture, and what could you have mistaken for it?",
    "How did you check the fix, and how often did you fix as you closed the land?",
    "What else, besides the position, did the GNSS failure take away (course and speed over the ground, the AIS position)?",
    "What would you do on a real ship when the GNSS fails close to the coast?",
  ],
};

// ---------------------------------------------------------------- 24: Goa, parallel index approach and anchoring

/** Mormugao Point (west tip of the Mormugao headland) as the simulator's coastline has it: 15°24.5'N 073°47.0'E. */
export const MORMUGAO_POINT: Vec2 = { e: 16.37, n: -0.46 };
/** The planned anchor position, 15°24.0'N 073°42.0'E, and the track to it (090°). */
export const GOA_ANCHOR: Vec2 = { e: 11.6, n: -1.0 };
const GOA_START: Vec2 = { e: 5.6, n: -1.0 };
/** How far the parallel index line through Mormugao Point is from the track: the point is this far to port, NM. */
export const GOA_PI_NM = MORMUGAO_POINT.n - GOA_ANCHOR.n;
const BUOY_ID = 4;

function goaPiSet(c: TaskCtx): boolean {
  return c.obs.pi.some((p) => {
    if (!p.on) return false;
    const east = Math.abs(angleDiffDeg(p.bearing, 90)) <= 2 && Math.abs(p.range + GOA_PI_NM) <= 0.1;
    const west = Math.abs(angleDiffDeg(p.bearing, 270)) <= 2 && Math.abs(p.range - GOA_PI_NM) <= 0.1;
    return east || west;
  });
}
/** How long after the anchor is let go it starts to drag, s. */
const ANCHOR_DRAG_AFTER_SEC = 600;
/** Start the anchor dragging, if the ship is at anchor and it is not dragging already. */
const dragIfAnchored = (w: Parameters<ArpaExercise["script"][number]["run"]>[0]): void => {
  if (w.own.anchor && w.own.anchor.dragKn === 0) setAnchorDrag(w, 0.5);
};

const EX24: ArpaExercise = {
  id: "radar-24", number: 24, group: "Radar", title: "Goa: parallel index approach, anchoring and anchor watch", rangeNm: 6, safeNm: 0.5,
  aim: "Approach the Mormugao anchorage on a planned track by parallel indexing, anchor in the planned position, and keep an anchor watch with the ARPA.",
  scenario: {
    ...GOA_APPROACH, id: "radar-24", name: "Radar 24: Mormugao anchorage",
    description: "Approach to the Mormugao anchorage, Goa. Real coastline and land heights; invented ships and one buoy laid for the exercise.",
    own: { heading: 90, speed: 10, pos: { ...GOA_START } },
    env: { seaState: 2, wind: { from: 270, speedKn: 12 }, current: { set: 160, drift: 0.5 } },
    route: [{ ...GOA_START }, { ...GOA_ANCHOR }],
    targets: [
      vessel(1, "Ore carrier at anchor", "bulk-cape", { e: 12.5, n: -1.8 }, 250, 0, { atAnchor: true }),
      vessel(2, "Bulk carrier at anchor", "bulk-panamax", { e: 13.2, n: -0.4 }, 250, 0, { atAnchor: true }),
      vessel(3, "Trawler", "trawler", { e: 9, n: 5 }, 330, 6),
      { id: BUOY_ID, name: "Anchorage buoy (laid for the exercise)", ...typed("buoy"), pos: { e: 11.0, n: -1.7 }, course: 0, speed: 0, events: [], ais: false },
    ],
  },
  track: { a: { ...GOA_START }, b: { ...GOA_ANCHOR } },
  briefing: [
    "Planned track 090° to the anchor position 15°24.0'N 073°42.0'E, in the Mormugao anchorage. Mormugao Point (15°24.5'N 073°47.0'E, the west tip of the headland, a strong echo) lies ahead, 0.54 NM to port of the track line.",
    "Set a parallel index line 090°, 0.54 NM to port (PI / MAP key: bearing 090, distance −0.54; or bearing 270, distance +0.54): the echo of Mormugao Point should slide along it as you go. If the echo moves off the line, you are off the track: correct the course.",
    "There is a current. Work out the course to steer and keep correcting it by the index line.",
    "Work out the range of Mormugao Point from the anchor position and set the VRM to it. Reduce speed in good time; let go the anchor (SHIP: LET GO ANCHOR, below 1 kn over the ground) where the point's echo meets the VRM on the index line.",
    "Once at anchor, acquire the anchorage buoy (laid for the exercise, about 0.9 NM south-west of the anchor position) and set the ARPA's anchor watch on it (select the buoy's track, then Anchor watch: 'On, selected target'). Keep the watch: check the position at intervals.",
  ],
  tasks: [
    { id: "pi", kind: "action", prompt: `Parallel index line set: 090°, ${GOA_PI_NM.toFixed(2)} NM to port (through Mormugao Point)`, done: goaPiSet },
    {
      id: "cts", kind: "number", prompt: "Course to steer to make good 090° at your present speed", unit: "°", circular: true,
      truth: (c) => courseToSteer(90, Math.max(1, c.w.own.speedThroughWater), c.w.env.current)?.heading ?? null, tol: (cfg) => cfg.tol.bearingDeg,
    },
    { id: "vrm", kind: "number", prompt: "Range of Mormugao Point from the anchor position (the VRM setting)", unit: "NM", truth: () => length(sub(MORMUGAO_POINT, GOA_ANCHOR)), tol: () => 0.1 },
    {
      id: "track", kind: "outcome", prompt: "Kept within 0.25 NM of the planned track and anchored",
      rule: () => "never more than 0.25 NM off the planned track while under way, and the anchor let go",
      judge: (c) => ({ ok: c.obs.maxXte <= 0.25 && c.obs.anchorPos !== null, detail: `furthest off track ${c.obs.maxXte.toFixed(2)} NM; ${c.obs.anchorPos ? "anchored" : "NOT anchored"}` }),
    },
    {
      id: "anchored", kind: "outcome", prompt: "Anchored within 0.3 NM of the planned position",
      rule: () => "the anchor let go within 0.3 NM of 15°24.0'N 073°42.0'E",
      judge: (c) => {
        const p = c.obs.anchorPos;
        if (!p) return { ok: false, detail: "the anchor was not let go" };
        const d = length(sub(p, GOA_ANCHOR));
        return { ok: d <= 0.3, detail: `anchored ${d.toFixed(2)} NM from the planned position` };
      },
    },
    {
      id: "watch", kind: "action", prompt: "At anchor, anchor watch set on the anchorage buoy",
      done: (c) => {
        const id = c.a.settings.anchorWatch.trackId;
        return !!c.w.own.anchor && id !== null && c.a.tracks.some((t) => t.id === id && t.truthId === BUOY_ID);
      },
    },
    { id: "ack", kind: "action", prompt: "Anchor watch alarm acknowledged", done: (c) => c.a.ackedKinds.has("anchor") },
    {
      id: "drag", kind: "choice", prompt: "The anchor watch alarm sounds: the buoy's echo has moved from its mark. What is most likely, and what do you check?",
      choices: ["Own ship is dragging her anchor: check the position by other fixed marks", "The buoy has broken adrift: ignore it", "The radar range scale has changed", "The ARPA has lost the buoy: re-acquire and carry on"],
      correct: () => 0,
    },
  ],
  script: [{
    atSeconds: 0,
    when: (w) => !!w.own.anchor && w.time - w.own.anchor.since >= ANCHOR_DRAG_AFTER_SEC,
    note: `${ANCHOR_DRAG_AFTER_SEC / 60} minutes after the anchor was let go, it starts to drag (0.5 kn, with the current).`,
    run: dragIfAnchored,
  }],
  debrief: [
    "Why does a parallel index line work for a point ahead as well as for one abeam?",
    "What would a gyro error do to the index line and to the anchoring by VRM?",
    "Why is a buoy a better reference for the anchor watch than a ship at anchor?",
    "When the anchor drags, what would you do on board?",
  ],
};

// ---------------------------------------------------------------- 25: Kochi, collision avoidance in restricted visibility

const EX25: ArpaExercise = {
  id: "radar-25", number: 25, group: "Radar", title: "Kochi: collision avoidance in restricted visibility off a low coast", rangeNm: 12, safeNm: 1,
  aim: "Use radar and ARPA to avoid close-quarters situations in restricted visibility (COLREG Rule 19), with small craft in rain and a low coast ahead.",
  scenario: {
    ...KOCHI_APPROACH, id: "radar-25", name: "Radar 25: Kochi in restricted visibility",
    description: "Approach to Kochi in restricted visibility, with rain squalls. Real coastline and land heights; invented ships.",
    own: { heading: 90, speed: 12, pos: { e: 3, n: 1 } },
    env: { seaState: 3, wind: { from: 250, speedKn: 18 }, current: { set: 340, drift: 0.6 }, rain: [{ center: { e: 10.5, n: 5 }, radius: 1.6, intensity: 0.6 }] },
    targets: [
      vessel(1, "Outbound container ship", "container-pp", { e: 16.5, n: 0.75 }, 268, 12),
      vessel(2, "Inbound LNG carrier", "lng", { e: 9.5, n: -6.8 }, 22, 11),
      vessel(3, "Fishing boat A", "fishing-boat", { e: 11, n: 5.5 }, 200, 4),
      vessel(4, "Fishing boat B", "fishing-boat", { e: 14, n: -4 }, 330, 5),
      vessel(5, "Tanker at anchor", "product-tanker", { e: 13.5, n: -1.5 }, 200, 0, { atAnchor: true }),
    ],
  },
  briefing: [
    "Restricted visibility: COLREG Rule 19 applies. There are no stand-on and give-way ships: every vessel that is detected by radar alone and is coming into a close-quarters situation must be avoided in good time.",
    "Acquire the container ship and the LNG carrier, and the fishing boats when they show. There are rain squalls to the north-east: a small boat may be hidden in the rain clutter; use the rain clutter control with care.",
    "Find each ship's CPA and TCPA. Use the trial manoeuvre before you act.",
    "Take action in good time: substantial, and in line with Rule 19(d): no alteration to port for a vessel forward of the beam (other than one being overtaken), and none towards a vessel abeam or abaft the beam.",
    "Every vessel must pass at 1 NM or more (a placeholder distance). The coast ahead is low: watch when it first shows.",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "Container ship and LNG carrier tracked", done: allTracked([1, 2]) },
    { id: "cpa1", kind: "number", prompt: "CPA of the container ship", unit: "NM", truth: cpaOf(1), tol: (c) => c.tol.cpaNm },
    { id: "tcpa1", kind: "number", prompt: "TCPA of the container ship (minutes from now)", unit: "min", truth: tcpaOf(1), tol: (c) => c.tol.tcpaMin },
    { id: "cpa2", kind: "number", prompt: "CPA of the LNG carrier", unit: "NM", truth: cpaOf(2), tol: (c) => c.tol.cpaNm },
    {
      id: "rule", kind: "choice", prompt: "The container ship is fine on the bow and closing. In restricted visibility you should",
      choices: ["Make a substantial alteration to starboard in good time", "Alter to port, as she is on the starboard bow", "Hold course and speed: she should give way", "Sound one short blast and alter to port"],
      correct: () => 0,
    },
    {
      id: "coast", kind: "choice", prompt: "The low coast ahead shows late compared with a high coast. Why?",
      choices: ["Little of it rises above the radar horizon or faces the radar", "The radar is not tuned", "Rain clutter is hiding it", "The coast is further off than the chart shows"],
      correct: () => 0,
    },
    { id: "action", kind: "outcome", prompt: "Action substantial and in line with Rule 19(d)", judge: judgeAction(true) },
    { id: "safe", kind: "outcome", prompt: "Every vessel passed at 1 NM or more", judge: judgeSafePassing({ safeNm: 1 }) },
  ],
  script: [],
  debrief: [
    "When did you first know that each ship was a danger, and from what?",
    "How did the rain squall affect the picture, and which control did you use?",
    "Why does Rule 19 not let you turn to port for a vessel forward of the beam?",
    "What would you have done if the container ship had altered to port?",
  ],
};

// ---------------------------------------------------------------- 26: Gulf of Kutch, tidal stream and ground stabilisation

const EX26: ArpaExercise = {
  id: "radar-26", number: 26, group: "Radar", title: "Gulf of Kutch: tidal stream, ground stabilisation and a meeting ship", rangeNm: 12, safeNm: 1,
  aim: "Find the tidal stream with a fixed echo as the ARPA's ground reference, tell motion through the water from motion over the ground, and pass a meeting ship safely.",
  scenario: {
    ...KUTCH_APPROACH, id: "radar-26", name: "Radar 26: Gulf of Kutch with the flood stream",
    description: "Entering the Gulf of Kutch on the flood. Real coastline and land heights; invented ships and stream.",
    own: { heading: 80, speed: 12, pos: { e: -12, n: 2 } },
    targets: [
      vessel(1, "Tanker at anchor", "aframax", { e: 2, n: -2 }, 240, 0, { atAnchor: true }),
      vessel(2, "Outbound container ship", "container-pp", { e: 4, n: 6.46 }, 252, 13),
      vessel(3, "VLCC for Vadinar", "vlcc", { e: -4, n: -3.5 }, 105, 10),
      vessel(4, "Fishing boat", "fishing-boat", { e: 1, n: 7 }, 300, 4),
    ],
  },
  briefing: [
    "The flood stream is running into the gulf and getting stronger. Your ARPA is sea stabilised (gyro and log): true vectors show motion THROUGH THE WATER.",
    "Acquire the tanker at anchor, the outbound container ship and the VLCC. A ship at anchor is fixed over the ground, so sea stabilised her true vector shows the stream reversed: read the set and rate of the stream from it.",
    "Then select the tanker and choose Ground stabilisation: she becomes the fixed reference, and true vectors show motion OVER THE GROUND.",
    "Compare the vectors in the two modes. Through the water they show each ship's heading (her aspect, which the collision regulations use); over the ground they show where she is actually going.",
    "The container ship is meeting you nearly end on. Act in time, as the collision regulations require, so that every vessel passes at 1 NM or more (a placeholder distance).",
  ],
  tasks: [
    { id: "acq", kind: "action", prompt: "Tanker at anchor, container ship and VLCC tracked", done: allTracked([1, 2, 3]) },
    { id: "ref", kind: "action", prompt: "Tanker at anchor made the ground reference", done: (c) => c.obs.groundRef === 1 },
    { id: "set", kind: "number", prompt: "Set of the tidal stream now", unit: "°", circular: true, truth: (c) => courseSpeedOf(currentVelocity(c.w)).course, tol: (c) => c.tol.setDeg },
    { id: "rate", kind: "number", prompt: "Rate of the tidal stream now", unit: "kn", truth: (c) => courseSpeedOf(currentVelocity(c.w)).speed, tol: (c) => c.tol.errorKn },
    { id: "cpa", kind: "number", prompt: "CPA of the container ship", unit: "NM", truth: cpaOf(2), tol: (c) => c.tol.cpaNm },
    { id: "tcpa", kind: "number", prompt: "TCPA of the container ship (minutes from now)", unit: "min", truth: tcpaOf(2), tol: (c) => c.tol.tcpaMin },
    {
      id: "aspect", kind: "choice", prompt: "Which true vectors show another ship's heading (her aspect), as the collision regulations need?",
      choices: ["Sea stabilised (through the water)", "Ground stabilised (over the ground)", "Relative vectors", "Either: in a stream they are the same"],
      correct: () => 0,
    },
    {
      id: "refship", kind: "choice", prompt: "Why is a ship at anchor not an ideal ground reference for long?",
      choices: ["She swings round her anchor and may drag", "Her echo is too strong to track", "An ARPA cannot track a stationary target", "Her AIS shows her as moving"],
      correct: () => 0,
    },
    { id: "action", kind: "outcome", prompt: "Action large enough to be readily apparent", judge: judgeAction(false) },
    { id: "safe", kind: "outcome", prompt: "Every vessel passed at 1 NM or more", judge: judgeSafePassing({ safeNm: 1 }) },
  ],
  script: [],
  debrief: [
    "How did the tanker's true vector change when she became the ground reference, and why?",
    "Why must the course through the water, not over the ground, be used to judge the aspect?",
    "How would the picture have misled you if you had used the slow-moving fishing boat as the reference?",
    "Which rule applied to the meeting with the container ship, and what if she had not altered?",
  ],
};

export const PORT_EXERCISES: ArpaExercise[] = [EX23, EX24, EX25, EX26];
