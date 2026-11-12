import { TARGET_TYPES, targetFromType } from "./targets";
import { fromPolar } from "../core/vec";
import { Coast, Scenario } from "./types";

/** Open sea. Cargo ship A reproduces the worked example on the phase 1 instructor sheet. */
export const OPEN_SEA: Scenario = {
  id: "open-sea",
  name: "Open sea traffic",
  description:
    "Own ship 000 at 12 kn. Cargo ship A crosses from starboard (worked example: CPA 0.54 NM). Tanker B approaches nearly head-on. Ferry C overtakes from astern. Small craft and a buoy test your controls.",
  own: { heading: 0, speed: 12 },
  env: { seaState: 3 },
  coasts: [],
  targets: [
    {
      id: 1, name: "Cargo ship A", kind: "ship", pos: fromPolar(45, 6.0), course: 270, speed: 10,
      rcs: 1.0, height: 20, events: [{ atSeconds: 1500, course: 300 }],
    },
    { id: 2, name: "Tanker B", kind: "ship", pos: { e: 0.4, n: 9 }, course: 185, speed: 11, rcs: 1.2, height: 25, events: [] },
    { id: 3, name: "Ferry C", kind: "ship", pos: { e: -0.9, n: -3.0 }, course: 0, speed: 16, rcs: 0.8, height: 18, events: [] },
    { id: 4, name: "Fishing boat D", kind: "small-craft", pos: fromPolar(300, 3.5), course: 20, speed: 4, rcs: 0.05, height: 5, events: [] },
    { id: 5, name: "Buoy E", kind: "buoy", pos: fromPolar(80, 2.2), course: 0, speed: 0, rcs: 0.015, height: 3, events: [] },
    { id: 6, name: "Yacht F", kind: "small-craft", pos: fromPolar(330, 1.6), course: 90, speed: 5, rcs: 0.02, height: 8, events: [] },
  ],
};

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

/** Coast with headlands, an island, a beacon and buoys. Shows radar shadow behind land. */
export const COASTAL: Scenario = {
  id: "coastal",
  name: "Coastal waters",
  description:
    "A coastline to starboard with headlands that cast radar shadow, an island to port, a lighthouse and buoys. A current sets north-east, so sea and ground stabilised displays differ.",
  own: { heading: 0, speed: 10 },
  env: { seaState: 2, current: { set: 45, drift: 1.5 } },
  coasts: [EAST_COAST, ISLAND],
  targets: [
    { id: 1, name: "Lighthouse", kind: "beacon", pos: { e: 4.4, n: 0.6 }, course: 0, speed: 0, rcs: 0.6, height: 30, events: [] },
    { id: 2, name: "Buoy 1", kind: "buoy", pos: { e: 2.5, n: 2.0 }, course: 0, speed: 0, rcs: 0.015, height: 3, events: [] },
    { id: 3, name: "Buoy 2", kind: "buoy", pos: { e: 1.5, n: -2.5 }, course: 0, speed: 0, rcs: 0.015, height: 3, events: [] },
    { id: 4, name: "Coaster G", kind: "ship", pos: { e: -2, n: 3 }, course: 160, speed: 9, rcs: 0.5, height: 12, events: [] },
    { id: 5, name: "Bulk carrier H", kind: "ship", pos: { e: 1, n: 11 }, course: 190, speed: 12, rcs: 1.1, height: 22, events: [] },
    { id: 6, name: "Pilot boat J", kind: "small-craft", pos: { e: -1.2, n: -1.5 }, course: 30, speed: 14, rcs: 0.04, height: 4, events: [] },
  ],
};

/** Search and rescue: a survival craft with a SART, a racon buoy and a ship on scene. */
export const SAR: Scenario = {
  id: "sar",
  name: "Search and rescue (SART and racon)",
  description: "A survival craft with a SART lies about 7 NM to the north-east; its radar echo is too weak to see, but the SART paints 12 dots on an X-band radar. A racon buoy (Morse K) lies to the north-west. Home on the first dot; inside about 1 NM the dots become arcs.",
  own: { heading: 20, speed: 14 },
  env: { seaState: 3 },
  coasts: [],
  targets: [
    { id: 1, name: "Survival craft (SART)", kind: "small-craft", pos: fromPolar(50, 7), course: 200, speed: 0.5, rcs: 0.004, height: 1, events: [], transponder: "sart", ais: false },
    { id: 2, name: "Racon buoy K", kind: "buoy", pos: fromPolar(320, 5), course: 0, speed: 0, rcs: 0.05, height: 5, events: [], transponder: "racon", raconCode: "-.-" },
    { id: 3, name: "On-scene vessel", kind: "ship", pos: fromPolar(80, 9), course: 300, speed: 10, rcs: 1, height: 20, events: [] },
    { id: 4, name: "Ramark beacon", kind: "beacon", pos: fromPolar(230, 8), course: 0, speed: 0, rcs: 0.3, height: 12, events: [], transponder: "ramark" },
  ],
};

/** Abnormal propagation: a large ship far beyond the picture shows as a second-trace echo on short pulse. */
export const SECOND_TRACE: Scenario = {
  id: "second-trace",
  name: "Second-trace echo (abnormal propagation)",
  description: "Super-refraction. A very large ship lies 29.5 NM away on 060°, far outside the 3 NM picture. Select SHORT pulse (high PRF): it appears as a false echo at about 2.5 NM on 060°. Change to medium pulse: the false echo goes, because the PRF changed. A real echo would stay. Another radar is also causing interference: use interference rejection.",
  own: { heading: 0, speed: 8 },
  env: { seaState: 1, ducting: true, interference: true },
  coasts: [],
  targets: [
    { id: 1, name: "Very large ship (29.5 NM)", kind: "ship", pos: fromPolar(60, 29.5), course: 240, speed: 0, rcs: 8, height: 45, events: [], lengthM: 330 },
    { id: 2, name: "Coaster", kind: "ship", pos: fromPolar(300, 2), course: 90, speed: 6, rcs: 0.6, height: 12, events: [] },
  ],
};

/** Twenty-two ships in a crossing area: STCW A-I/12 asks for at least 20 target ships. */
export const HEAVY_TRAFFIC: Scenario = {
  id: "heavy-traffic",
  name: "Heavy traffic (22 ships)",
  description: "Twenty-two ships on crossing and reciprocal courses within 12 NM, with a tidal stream. Use the 12 NM range scale. The ARPA tracks 20 at most: decide which targets matter.",
  own: { heading: 45, speed: 13 },
  env: { seaState: 3, tidal: { floodSet: 90, maxRateKn: 2, hoursAfterSlackAtStart: 2 } },
  coasts: [],
  targets: Array.from({ length: 22 }, (_, i) => ({
    id: i + 1,
    name: `Ship ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? "2" : ""}`,
    kind: "ship" as const,
    pos: fromPolar((i * 53 + 11) % 360, 3.5 + ((i * 7) % 17) * 0.5),
    course: (i * 97 + 30) % 360,
    speed: 6 + ((i * 5) % 11),
    rcs: 0.5 + ((i * 3) % 7) * 0.1,
    height: 12 + (i % 5) * 3,
    events: i % 6 === 0 ? [{ atSeconds: 600 + i * 40, course: (i * 97 + 70) % 360 }] : [],
  })),
};

/** One vessel of every catalogue type, each at its typical speed, with wind and current acting on them. */
const VESSEL_TYPES = TARGET_TYPES.filter((t) => !t.fixed);
export const SHIP_TYPES_TRAFFIC: Scenario = {
  id: "ship-types",
  name: `Ship types (${VESSEL_TYPES.length} vessels)`,
  description: `One vessel of each of the ${VESSEL_TYPES.length} catalogue types, each at its usual speed, with a current and a fresh wind. Large ships show further off and turn slowly; small craft show late. Use the 12 NM range scale. The ARPA tracks 20 at most.`,
  own: { heading: 0, speed: 14 },
  env: { seaState: 3, current: { set: 70, drift: 1.5 }, wind: { from: 250, speedKn: 20 } },
  coasts: [],
  targets: VESSEL_TYPES.map((t, i) => ({
    id: i + 1,
    name: t.name.split(",")[0]!,
    ...targetFromType(t),
    pos: fromPolar((i * 47 + 20) % 360, 3 + ((i * 5) % 19) * 0.5),
    course: (i * 83 + 200) % 360,
    speed: t.speedKn,
    events: i % 4 === 0 ? [{ atSeconds: 480 + i * 20, course: ((i * 83 + 200) % 360) + 40 }] : [],
  })),
};

/**
 * One hundred ships at once, each steering its own programmed track of six waypoints. Shows that the
 * simulator carries 100 targets together (STCW Code A-I/12 asks a radar simulator for at least 20).
 */
export const HUNDRED_SHIPS: Scenario = {
  id: "hundred-ships",
  name: "Traffic: 100 ships on programmed tracks",
  description:
    "One hundred ships within 24 NM, each steering its own track from waypoint to waypoint. A crowded picture: practise picking out the ships that matter and setting sensible CPA limits. The ARPA tracks only as many as its capacity allows.",
  own: { heading: 0, speed: 12 },
  env: { seaState: 2 },
  coasts: [],
  targets: Array.from({ length: 100 }, (_, i) => {
    const t = VESSEL_TYPES[i % VESSEL_TYPES.length]!;
    const pos = fromPolar((i * 37 + 5) % 360, 2 + ((i * 13) % 45) * 0.5);
    const course0 = (i * 71) % 360;
    const bend = i % 2 === 0 ? 40 : -40;
    const points: { e: number; n: number }[] = [];
    let at = pos;
    for (let k = 0; k < 6; k++) {
      const step = fromPolar(course0 + k * bend, 3);
      at = { e: at.e + step.e, n: at.n + step.n };
      points.push(at);
    }
    return { id: i + 1, name: `${t.name.split(",")[0]!} ${i + 1}`, ...targetFromType(t), pos, course: course0, speed: t.speedKn, events: [], route: { points } };
  }),
};

export const SCENARIOS: Scenario[] = [OPEN_SEA, COASTAL, SAR, SECOND_TRACE, HEAVY_TRAFFIC, SHIP_TYPES_TRAFFIC, HUNDRED_SHIPS];
