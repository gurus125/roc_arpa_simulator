import { angleDiffDeg, bearingOf, length, sub } from "../core/vec";
import { courseToSteer } from "../core/current";
import { SAR, Scenario, noiseSpeckle, radarTransmitting, switchRadarOff } from "../engine/index";
import { ArpaExercise, SETUP_LIMITS, TaskCtx, targetById } from "./session";

/**
 * Radar navigation exercises asked for by IMO Model Courses 1.07 (parallel index navigation, radar
 * maps and navigation lines) and 1.08 (use of radar in search and rescue). Written from the course
 * outlines; limits and tolerances are placeholders for the academy to set.
 */

const PI_SCENARIO: Scenario = {
  id: "radar-10",
  name: "Radar 10: parallel indexing past a light",
  description: "Parallel index navigation past Point Light with a cross current.",
  own: { heading: 0, speed: 10, pos: { e: 0, n: -6 } },
  env: { seaState: 2, current: { set: 90, drift: 1.5 } },
  coasts: [{ name: "Point", closed: true, points: [{ e: 1.55, n: -0.5 }, { e: 2.6, n: -0.9 }, { e: 3.4, n: 0 }, { e: 2.7, n: 0.9 }, { e: 1.55, n: 0.45 }] }],
  hazards: [{ name: "West shoal", center: { e: -0.9, n: 0.4 }, radius: 0.3 }],
  route: [{ e: 0, n: -6 }, { e: 0, n: 3 }],
  targets: [
    { id: 1, name: "Point Light", kind: "beacon", pos: { e: 1.5, n: 0 }, course: 0, speed: 0, rcs: 0.6, height: 25, events: [] },
    { id: 2, name: "Coaster", kind: "ship", pos: { e: -3, n: 6 }, course: 150, speed: 8, rcs: 0.7, height: 14, events: [] },
  ],
};

/** The parallel index line that should run through Point Light: parallel to the 000 track, 1.5 NM to starboard. */
function piSet(c: TaskCtx): boolean {
  return c.obs.pi.some((p) => {
    if (!p.on) return false;
    const north = Math.abs(angleDiffDeg(p.bearing, 0)) <= 2 && Math.abs(p.range - 1.5) <= 0.1;
    const south = Math.abs(angleDiffDeg(p.bearing, 180)) <= 2 && Math.abs(p.range + 1.5) <= 0.1;
    return north || south;
  });
}

const EX10: ArpaExercise = {
  id: "radar-10", number: 10, group: "Radar", title: "Parallel index navigation and radar map", rangeNm: 6, safeNm: 0.5,
  aim: "Keep the ship on a planned track past a headland by parallel indexing, in a cross current.",
  scenario: PI_SCENARIO,
  track: { a: { e: 0, n: -6 }, b: { e: 0, n: 3 } },
  briefing: [
    "Planned track 000°, to pass Point Light 1.5 NM off to starboard. A shoal lies 0.9 NM to port of the track abeam of the light.",
    "Under Measure, More tools: switch on a parallel index line, bearing 000°, distance 1.5 NM (starboard).",
    "On track, the echo of Point Light slides down the index line. If the echo moves inside the line the ship is being set towards the light: alter course to bring it back.",
    "There is a current. Work out the course to steer, apply it, and keep correcting by the index line.",
    "Draw a navigation line along the edge of the shoal side (a line 0.5 NM to port of the track) as a limit. Use a ground-stabilised, north-up picture.",
  ],
  tasks: [
    { id: "pi", kind: "action", prompt: "Parallel index line set: 000°, 1.5 NM to starboard (through Point Light)", done: piSet },
    { id: "nav", kind: "action", prompt: "A navigation line drawn on the radar picture", done: (c) => c.obs.navLines >= 1 },
    {
      id: "cts", kind: "number", prompt: "Course to steer to make good 000° at the present speed", unit: "°", circular: true,
      truth: (c) => courseToSteer(0, c.w.own.speedThroughWater, c.w.env.current)?.heading ?? null, tol: () => 3,
    },
    {
      id: "xte", kind: "outcome", prompt: "Kept within 0.25 NM of the track until past the light",
      judge: (c) => ({ ok: c.obs.trackDone && c.obs.maxXte <= 0.25, detail: `${c.obs.trackDone ? "track completed" : "track NOT completed"}; furthest off track ${c.obs.maxXte.toFixed(2)} NM` }),
    },
    { id: "why", kind: "choice", prompt: "The echo of the light moves from the index line towards own ship's heading line. What is happening?", choices: ["The ship is being set towards the light", "The ship is being set away from the light", "The light has moved", "The gyro has failed"], correct: () => 0 },
  ],
  script: [],
  debrief: [
    "Why does parallel indexing work in relative motion with a stabilised picture, and what must be checked before relying on it?",
    "How would a gyro error or a wrongly identified mark affect the index line?",
    "Why do navigation lines need a ground-stabilised picture?",
    "What are the wheel-over and margin-of-safety lines you would add for a turn?",
  ],
};

const EX11: ArpaExercise = {
  id: "radar-11", number: 11, group: "Radar", title: "Search and rescue: homing on a SART", rangeNm: 12, safeNm: 0.2,
  aim: "Recognise SART and racon responses and use the radar to close a survival craft safely.",
  scenario: { ...SAR, id: "radar-11", name: "Radar 11: SART and racon" },
  briefing: [
    "A distress alert has been received. Use the 12 NM range scale on X band (a SART does not answer S band).",
    "A SART shows as a line of 12 dots along one bearing. The SART is at the dot NEAREST own ship; the others are further out along the same bearing.",
    "Do not use rain clutter (FTC) heavily or a short-range filter: it can remove the dots. Reduce gain if the dots smear.",
    "Steer for the first dot. Inside about 1 NM the dots widen into arcs and then rings: you are very close. Slow down in good time.",
    "The flash to the north-west is a racon: read its Morse letter.",
  ],
  tasks: [
    { id: "where", kind: "choice", prompt: "On the line of 12 dots, where is the survival craft?", choices: ["At the dot nearest own ship", "At the dot furthest from own ship", "In the middle of the line", "It cannot be known"], correct: () => 0 },
    { id: "rng", kind: "number", prompt: "Range of the SART now", unit: "NM", truth: (c) => (targetById(c.w, 1) ? length(sub(targetById(c.w, 1)!.pos, c.w.own.pos)) : null), tol: (cfg) => cfg.tol.rangeNm },
    { id: "brg", kind: "number", prompt: "True bearing of the SART now", unit: "°", circular: true, truth: (c) => (targetById(c.w, 1) ? bearingOf(sub(targetById(c.w, 1)!.pos, c.w.own.pos)) : null), tol: () => 3 },
    { id: "racon", kind: "choice", prompt: "Which Morse letter does the racon show?", choices: ["K (dash dot dash)", "N (dash dot)", "O (dash dash dash)", "T (dash)"], correct: () => 0 },
    { id: "band", kind: "choice", prompt: "Why is nothing seen of the SART on S band?", choices: ["A SART answers 9 GHz (X band) radar only", "S band has too short a range", "S band cannot show dots", "The SART battery is flat"], correct: () => 0 },
    {
      id: "close", kind: "outcome", prompt: "Closed the survival craft to 0.5 NM or less, at 6 kn or less when closest",
      judge: (c) => {
        const r = c.obs.minRange[1] ?? Infinity;
        const sp = c.obs.closeSpeed[1] ?? Infinity;
        return { ok: r <= 0.5 && sp <= 6, detail: `closest ${r.toFixed(2)} NM at ${Number.isFinite(sp) ? sp.toFixed(1) : "?"} kn` };
      },
    },
  ],
  script: [],
  debrief: [
    "What do the dots change into as the range closes, and why?",
    "Which radar settings can hide a SART response?",
    "What is the expected detection range of a SART for a ship's radar and for an aircraft?",
    "How would you organise the search if no SART response were seen (IAMSAR search patterns)?",
  ],
};

const SETUP_SCENARIO: Scenario = {
  id: "radar-22",
  name: "Radar 22: switching on and setting up",
  description: "Open sea, a high coast to the east, a few ships. The radar is switched off and badly set.",
  own: { heading: 0, speed: 10 },
  env: { seaState: 3, wind: { from: 45, speedKn: 18 } },
  coasts: [{ name: "Headland", closed: true, points: [{ e: 6.5, n: -6 }, { e: 9, n: -6 }, { e: 9, n: 8 }, { e: 7, n: 7 }, { e: 6, n: 2 }, { e: 6.8, n: -2 }] }],
  targets: [
    { id: 1, name: "Ship A", kind: "ship", pos: { e: -4, n: 8 }, course: 160, speed: 11, rcs: 1, height: 18, events: [] },
    { id: 2, name: "Ship B", kind: "ship", pos: { e: 2, n: -9 }, course: 10, speed: 14, rcs: 0.8, height: 15, events: [] },
    { id: 3, name: "Buoy", kind: "buoy", pos: { e: -1.5, n: 3 }, course: 0, speed: 0, rcs: 0.1, height: 3, events: [] },
  ],
};

const transmitting = (c: TaskCtx): boolean => radarTransmitting(c.w);
/** The setting-up limits in use: the instructor's, else the placeholders. */
const lim = (c: TaskCtx): typeof SETUP_LIMITS => c.cfg.setup ?? SETUP_LIMITS;
const speckleOk = (c: TaskCtx): boolean => {
  const n = noiseSpeckle(c.w.radar.controls, c.w.radar.tuningOptimum);
  return n >= lim(c).speckleMin && n <= lim(c).speckleMax;
};
const tunedOk = (c: TaskCtx): boolean => Math.abs(c.w.radar.controls.tuning - c.w.radar.tuningOptimum) <= lim(c).tuningTol;

/**
 * Switching on and setting up the radar, in the order of the Radar and ARPA Manual (Bole, Wall and
 * Norris, 3rd edition, 6.2): warm-up and standby; brilliance; sea and rain clutter and the signal
 * processing off; gain to a light speckle; tuning; a medium range scale; the performance check.
 */
const EX22: ArpaExercise = {
  id: "radar-22", number: 22, group: "Radar", title: "Switching on and setting up the radar", rangeNm: 1.5, safeNm: 1,
  aim: "Switch the radar on from cold and set it up for the best picture, in the right order, then check its performance.",
  scenario: SETUP_SCENARIO,
  setup: (_a, w) => {
    // The radar is off and has been left badly set.
    switchRadarOff(w);
    Object.assign(w.radar.controls, {
      gain: 12, stc: 70, ftc: 60, brilliance: 15, pulse: "short",
      echoStretch: true, echoAverage: true, interferenceRejection: true,
      tuning: Math.max(0, Math.min(100, Math.round(w.radar.tuningOptimum) + (w.radar.tuningOptimum > 50 ? -32 : 32))),
    });
  },
  startsSwitchedOff: true,
  briefing: [
    "The radar is switched off. Press the RADAR key to switch it on: it warms up (about 1.5 minutes here; the rules allow up to 4), then waits in STANDBY. Press the key again to transmit.",
    "Set the BRILLIANCE first, so that the picture and the graphics can be seen comfortably.",
    "Before setting the gain: SEA and RAIN to zero, and the signal processing off (under RADAR: echo stretch, echo averaging, interference rejection; the IR, ENH and SC/SC letters go dark).",
    "Set the GAIN so that a light, even speckle of noise just shows over the picture: not none, not heavy.",
    "Then the TUNING: for the greatest extent of the sea clutter, or of the land to the east. Do not trust a tuning meter alone.",
    "Use the 12 NM range scale to judge the picture. Then check the performance with the performance monitor (under RADAR).",
    "Last, use the sea clutter control as the sea needs. Answer the questions and press Finish.",
  ],
  tasks: [
    { id: "on", kind: "action", prompt: "Radar switched on, warmed up and put to transmit", done: transmitting },
    { id: "brill", kind: "action", prompt: "Brilliance raised so that the picture can be seen", done: (c) => transmitting(c) && c.w.radar.controls.brilliance >= lim(c).minBrilliance },
    {
      id: "gain", kind: "action", prompt: "Gain set to a light speckle of noise with sea and rain clutter at zero and the signal processing off",
      done: (c) => {
        const r = c.w.radar.controls;
        return transmitting(c) && speckleOk(c) && r.stc <= lim(c).clutterZero && r.ftc <= lim(c).clutterZero && !r.echoStretch && !r.echoAverage && !r.interferenceRejection;
      },
    },
    { id: "tune", kind: "action", prompt: "Tuned for the best picture", done: (c) => transmitting(c) && tunedOk(c) },
    { id: "range", kind: "action", prompt: "Picture judged on the 12 NM range scale", done: (c) => transmitting(c) && c.w.radar.controls.rangeNm === 12 },
    { id: "pm", kind: "action", prompt: "Performance checked with the performance monitor", done: (c) => c.obs.pmUsed },
    {
      id: "final", kind: "outcome", prompt: "At the end: transmitting, gain giving a light speckle, tuning right",
      judge: (c) => {
        const n = noiseSpeckle(c.w.radar.controls, c.w.radar.tuningOptimum);
        const off = c.w.radar.controls.tuning - c.w.radar.tuningOptimum;
        return { ok: transmitting(c) && speckleOk(c) && tunedOk(c), detail: `${transmitting(c) ? "transmitting" : "NOT transmitting"}; noise speckle ${n.toFixed(2)} (light is ${lim(c).speckleMin} to ${lim(c).speckleMax}); tuning ${off >= 0 ? "+" : ""}${off.toFixed(0)} from the best` };
      },
    },
    { id: "first", kind: "choice", prompt: "Once the radar is transmitting, which control is set first?", choices: ["Brilliance", "Gain", "Tuning", "Sea clutter"], correct: () => 0 },
    {
      id: "tunejudge", kind: "choice", prompt: "What should the tuning be judged on?",
      choices: ["The tuning meter alone", "The greatest extent of sea clutter, rain or land echoes, or the performance monitor", "The brightness of a strong ship's echo", "The number of echoes on the 96 NM scale"],
      correct: () => 1,
    },
  ],
  script: [],
  debrief: [
    "Why must sea clutter, rain clutter and the signal processing be at zero when the gain is set?",
    "What does a picture with no noise speckle at all tell you about the gain? And a heavy speckle?",
    "Why is a strong echo no good for judging the tuning?",
    "In fog in open water there are no echoes at all. How do you know the radar is working?",
  ],
};

export const RADAR_EXERCISES: ArpaExercise[] = [EX10, EX11, EX22];
