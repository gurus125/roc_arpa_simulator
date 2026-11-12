import { fromPolar, Vec2 } from "../core/vec";
import { Coast, Scenario, Target } from "../engine/types";

export type ExerciseKind = "plot" | "fix" | "setdrift" | "clearing" | "pilotage" | "traffic";

export interface ExerciseDef {
  id: ExerciseKind;
  name: string;
  /** Module of the ROC syllabus this exercise belongs to. */
  module: "C" | "D" | "E";
  description: string;
  steps: string[];
  scenario: Scenario;
  /** Default radar range scale. */
  rangeNm: number;
  /** Suggested time between plot observations, minutes (placeholder: the handout gives no interval). */
  observationIntervalMin: number;
  /** Passing distance regarded as safe, NM (placeholder until the academy states one). */
  safePassingNm: number;
  /** Exercise ends automatically after this many simulated seconds, if set. */
  durationSec?: number;
  /** Charted object used for the clearing range exercise. */
  clearingObjectId?: number;
  /** Required margin beyond the hazard edge, NM. */
  clearingMarginNm?: number;
}

type T = Omit<Target, "nextEvent">;
const ship = (id: number, name: string, pos: Vec2, course: number, speed: number, rcs = 1, height = 20): T => ({
  id, name, kind: "ship", pos, course, speed, rcs, height, events: [],
});
const beacon = (id: number, name: string, pos: Vec2, rcs = 0.3, height = 15): T => ({
  id, name, kind: "beacon", pos, course: 0, speed: 0, rcs, height, events: [],
});

const EAST_COAST: Coast = {
  name: "East coast",
  closed: true,
  points: [
    { e: 9, n: 6 }, { e: 7, n: 6 }, { e: 5.5, n: 4 }, { e: 6, n: 2 }, { e: 4.5, n: 0.5 },
    { e: 5, n: -1.5 }, { e: 3.2, n: -3 }, { e: 4, n: -5 }, { e: 2.5, n: -7 }, { e: 6, n: -9 }, { e: 9, n: -9 },
  ],
};
const ISLAND: Coast = {
  name: "Island",
  closed: true,
  points: [{ e: -4.5, n: 4.5 }, { e: -3.5, n: 4.2 }, { e: -3, n: 5.2 }, { e: -4, n: 5.8 }],
};

/** Charted fixed objects used by the position fixing exercises. */
const CHARTED: T[] = [
  beacon(1, "Lighthouse", { e: 4.4, n: 0.6 }, 0.6, 30),
  beacon(2, "Beacon B1", { e: 2.5, n: 2.0 }, 0.25, 8),
  beacon(3, "Beacon B2", { e: 1.5, n: -2.5 }, 0.25, 8),
  beacon(4, "Tower M", { e: -3.6, n: 5.0 }, 0.4, 25),
];

const PLOT: ExerciseDef = {
  id: "plot",
  name: "Manual plotting: relative motion, CPA and TCPA",
  module: "C",
  description:
    "Plot a crossing ship from successive radar observations, find its true course and speed, CPA and TCPA, decide whether risk of collision exists, and name the COLREG situation. Own ship must hold course and speed while you plot.",
  steps: [
    "Select the target echo by setting the EBL and VRM on it (click the echo).",
    "Take the first observation. Note the time.",
    "Advance the simulation by the observation interval and take the next observation. Take at least three.",
    "Study the plotting board: does the bearing stay steady while the range falls?",
    "Work out relative course and speed, true course and speed, CPA and TCPA. Enter your answers and check.",
  ],
  rangeNm: 12,
  observationIntervalMin: 6,
  safePassingNm: 1.0,
  scenario: {
    id: "ex-plot", name: "Plotting exercise", description: "", own: { heading: 0, speed: 12 },
    env: { seaState: 2 }, coasts: [],
    targets: [
      ship(1, "Cargo ship A", fromPolar(45, 6.0), 270, 10),
      ship(2, "Fishing vessel B", fromPolar(20, 4.5), 120, 6, 0.3, 8),
      ship(3, "Tanker C", { e: -0.9, n: 8 }, 180, 10, 1.2, 25),
    ],
  },
};

const FIX: ExerciseDef = {
  id: "fix",
  name: "Position fixing by radar ranges and bearings",
  module: "E",
  description:
    "Fix own ship's position from the range and bearing of charted fixed objects. Take observations of at least two different objects, quickly, and the simulator computes the fix and tells you how far it is from the true position.",
  steps: [
    "Click an echo you can identify on the chart. The EBL and VRM jump to it.",
    "Take the observation. Check the object name it was matched to.",
    "Do the same for a second and third object. Choose objects whose bearings differ widely.",
    "Read the fix and its error on the chart. A good fix has a small error and a good angle of cut.",
  ],
  rangeNm: 6,
  observationIntervalMin: 1,
  safePassingNm: 1.0,
  scenario: {
    id: "ex-fix", name: "Position fixing", description: "", own: { heading: 0, speed: 6 },
    env: { seaState: 1 }, coasts: [EAST_COAST, ISLAND], targets: CHARTED.map((t) => ({ ...t })),
  },
};

const SETDRIFT: ExerciseDef = {
  id: "setdrift",
  name: "Set and drift from radar fixes",
  module: "C",
  description:
    "Own ship holds a steady course and speed through the water. Take a fix, wait, take a second fix, and find the set and drift of the current from the difference between the dead-reckoned position and the second fix.",
  steps: [
    "Take fix 1 from two or more charted objects.",
    "Press 'Start next fix', advance the simulation (about 15 minutes), and take fix 2.",
    "Work out the set and drift from the two fixes and own course and speed through the water. Enter the answer and check.",
  ],
  rangeNm: 6,
  observationIntervalMin: 15,
  safePassingNm: 1.0,
  scenario: {
    id: "ex-setdrift", name: "Set and drift", description: "", own: { heading: 0, speed: 8, pos: { e: 0, n: -3 } },
    env: { seaState: 1, current: { set: 120, drift: 2.0 } }, coasts: [EAST_COAST, ISLAND], targets: CHARTED.map((t) => ({ ...t })),
  },
};

const CLEARING: ExerciseDef = {
  id: "clearing",
  name: "Clearing range from a charted object",
  module: "E",
  description:
    "A shoal lies offshore. Set a clearing range on the VRM from the lighthouse so that staying outside it keeps you clear of the shoal with a margin, record it, then take own ship past the shoal keeping outside the ring.",
  steps: [
    "Find the shoal on the chart. Work out the distance from the lighthouse to the shoal, add its radius and the margin.",
    "Set the VRM to that range and press 'Record clearing range'.",
    "Steer north along the coast so that the lighthouse stays outside the VRM ring.",
    "Press 'Finish' when you have passed the shoal, or wait for the passage to end.",
  ],
  rangeNm: 6,
  observationIntervalMin: 1,
  safePassingNm: 1.0,
  clearingObjectId: 1,
  clearingMarginNm: 0.3,
  scenario: {
    id: "ex-clearing", name: "Clearing range", description: "", own: { heading: 10, speed: 8, pos: { e: -0.5, n: -8 } },
    env: { seaState: 1, current: { set: 270, drift: 0.8 } }, coasts: [EAST_COAST, ISLAND], targets: CHARTED.map((t) => ({ ...t })),
    hazards: [{ name: "Shoal", center: { e: 2.6, n: -2.4 }, radius: 0.3 }],
    route: [{ e: -0.5, n: -8 }, { e: -0.5, n: 4 }],
  },
};

const WEST_BANK: Coast = {
  name: "West bank",
  closed: true,
  points: [{ e: -9, n: 11 }, { e: -9, n: -11 }, { e: -2.2, n: -11 }, { e: -1.8, n: -5 }, { e: -2.0, n: 0 }, { e: -1.4, n: 4 }, { e: -1.8, n: 7 }, { e: -2.4, n: 11 }],
};
const EAST_BANK: Coast = {
  name: "East bank",
  closed: true,
  points: [{ e: 9, n: 11 }, { e: 2.4, n: 11 }, { e: 1.9, n: 6 }, { e: 2.3, n: 2 }, { e: 1.6, n: -3 }, { e: 2.2, n: -7 }, { e: 2.6, n: -11 }, { e: 9, n: -11 }],
};

const PILOTAGE: ExerciseDef = {
  id: "pilotage",
  name: "Blind pilotage through a channel",
  module: "E",
  description:
    "In fog, take own ship through the channel using the radar only. The planned track runs up the middle of the channel. Fix your position from the buoys and banks, keep to the track, and avoid the banks. The chart shows the plan; it does not show where you are.",
  steps: [
    "Study the planned track on the chart. Note the buoys (P = port side, S = starboard side) and the width of the channel.",
    "Use radar ranges and bearings to the buoys to fix your position and compare with the track.",
    "Steer to keep on the track. Use the VRM as a clearing line against a bank if it helps.",
    "Reach the last waypoint, or press 'Finish'. You will then see your track and the cross-track errors.",
  ],
  rangeNm: 3,
  observationIntervalMin: 1,
  safePassingNm: 1.0,
  scenario: {
    id: "ex-pilotage", name: "Blind pilotage", description: "", own: { heading: 0, speed: 8, pos: { e: 0.2, n: -8 } },
    env: { seaState: 1, current: { set: 90, drift: 0.6 } }, coasts: [WEST_BANK, EAST_BANK],
    targets: [
      beacon(1, "Buoy P1", { e: -1.5, n: -4 }, 0.2, 6),
      beacon(2, "Buoy S1", { e: 1.0, n: -4 }, 0.2, 6),
      beacon(3, "Buoy P2", { e: -1.2, n: 1.5 }, 0.2, 6),
      beacon(4, "Buoy S2", { e: 1.3, n: 1.5 }, 0.2, 6),
      beacon(5, "Buoy P3", { e: -1.0, n: 6 }, 0.2, 6),
      beacon(6, "Buoy S3", { e: 1.4, n: 6 }, 0.2, 6),
    ],
    route: [{ e: 0.2, n: -8 }, { e: 0.2, n: -3 }, { e: 0.4, n: 2 }, { e: 0.2, n: 6 }, { e: 0, n: 9.5 }],
  },
};

const TRAFFIC: ExerciseDef = {
  id: "traffic",
  name: "Collision avoidance in heavy traffic",
  module: "D",
  description:
    "Eight ships around you. Several are on collision courses. Keep a safe passing distance from all of them, act in good time, and apply COLREGs. The log records what you did and how close each ship came.",
  steps: [
    "Observe the traffic. Plot the ships you think are a danger.",
    "Decide on an alteration of course or speed that is early, large and consistent with COLREGs.",
    "Carry it out, then keep watching to confirm that risk is reducing.",
    "The exercise ends after 40 minutes, or press 'Finish'.",
  ],
  rangeNm: 12,
  observationIntervalMin: 6,
  safePassingNm: 1.0,
  durationSec: 40 * 60,
  scenario: {
    id: "ex-traffic", name: "Heavy traffic", description: "", own: { heading: 0, speed: 12 },
    env: { seaState: 2 }, coasts: [],
    targets: [
      ship(1, "Ship 1", { e: 4.4, n: 4.8 }, 270, 10),
      ship(2, "Ship 2", { e: -0.2, n: 8.4 }, 180, 11, 1.2, 25),
      ship(3, "Ship 3", { e: -5.6, n: 6.4 }, 90, 12),
      ship(4, "Ship 4", { e: -0.5, n: -3.3 }, 0, 17, 0.8, 18),
      ship(5, "Ship 5", { e: -0.4, n: 10.8 }, 140, 10, 0.9, 20),
      ship(6, "Ship 6", { e: 6.8, n: 6.7 }, 270, 7, 1.0, 22),
      ship(7, "Ship 7", { e: 2.0, n: 6.7 }, 240, 8),
      ship(8, "Ship 8", { e: -0.7, n: 5.7 }, 45, 5, 0.4, 10),
    ],
  },
};

export const EXERCISES: ExerciseDef[] = [PLOT, FIX, SETDRIFT, CLEARING, PILOTAGE, TRAFFIC];

export function exerciseById(id: ExerciseKind): ExerciseDef {
  const e = EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown exercise ${id}`);
  return e;
}
