import { Scenario } from "../engine/index";

/**
 * Chart for the ECDIS trainer: a harbour approach from the south, with shoals, an island,
 * isolated dangers, marks and a current. Fictional. Positions in NM east/north of the datum.
 */
export const HARBOUR_APPROACH: Scenario = {
  id: "harbour-approach",
  name: "Harbour approach (ECDIS chart)",
  description: "Approach from the south to a harbour entrance between two shores. Shoals, an island bank, a wreck and a rock; current 060° at 1.5 kn. Made for the ECDIS tab: plan, check and monitor a route.",
  own: { heading: 0, speed: 12, pos: { e: 0.1, n: -9 } },
  env: { seaState: 2, current: { set: 60, drift: 1.5 } },
  coasts: [
    { name: "West shore", closed: true, points: [{ e: -10, n: 9.5 }, { e: -10, n: 6.2 }, { e: -6, n: 5.6 }, { e: -3, n: 6.4 }, { e: -1, n: 6.5 }, { e: -1.4, n: 8 }, { e: -1, n: 9.5 }] },
    { name: "East shore", closed: true, points: [{ e: 1, n: 9.5 }, { e: 1.4, n: 8 }, { e: 1, n: 6.5 }, { e: 3, n: 6.1 }, { e: 6, n: 6.8 }, { e: 10, n: 6 }, { e: 10, n: 9.5 }] },
    { name: "Island", closed: true, points: [{ e: 4, n: 1 }, { e: 5.2, n: 1.4 }, { e: 5.5, n: 0.4 }, { e: 4.6, n: -0.2 }, { e: 3.8, n: 0.2 }] },
  ],
  depths: [
    { name: "Middle Ground shoal", depthM: 4, points: [{ e: -3.5, n: 2.5 }, { e: -2, n: 3.2 }, { e: -1.2, n: 2.4 }, { e: -2, n: 1.4 }, { e: -3.2, n: 1.6 }] },
    { name: "Island bank", depthM: 8, points: [{ e: 3.2, n: -0.8 }, { e: 6.2, n: -0.6 }, { e: 6.4, n: 2 }, { e: 3.4, n: 2.2 }] },
    { name: "West flats", depthM: 5, points: [{ e: -10, n: 6.2 }, { e: -6, n: 5.6 }, { e: -3, n: 6.4 }, { e: -1, n: 6.5 }, { e: -1.2, n: 5.6 }, { e: -4, n: 4.8 }, { e: -10, n: 5 }] },
    { name: "East flats", depthM: 5, points: [{ e: 1, n: 6.5 }, { e: 3, n: 6.1 }, { e: 6, n: 6.8 }, { e: 10, n: 6 }, { e: 10, n: 5 }, { e: 5, n: 5.4 }, { e: 1.2, n: 5.6 }] },
    { name: "Outer bar", depthM: 15, points: [{ e: -1.5, n: -2 }, { e: 1.5, n: -2 }, { e: 1.5, n: -1 }, { e: -1.5, n: -1 }] },
  ],
  hazards: [
    { name: "Wreck", center: { e: 1.8, n: 3.5 }, radius: 0.15 },
    { name: "Rock", center: { e: -0.8, n: 4.4 }, radius: 0.1 },
  ],
  route: [{ e: 0, n: -8 }, { e: 0, n: -4 }, { e: 0.2, n: 3 }, { e: 0, n: 6 }, { e: 0, n: 7.6 }],
  targets: [
    { id: 1, name: "Fairway buoy", kind: "buoy", pos: { e: 0, n: -4 }, course: 0, speed: 0, rcs: 0.06, height: 4, events: [] },
    { id: 2, name: "No.1 buoy (stbd)", kind: "buoy", pos: { e: 0.5, n: 5.5 }, course: 0, speed: 0, rcs: 0.04, height: 3, events: [] },
    { id: 3, name: "No.2 buoy (port)", kind: "buoy", pos: { e: -0.5, n: 5.5 }, course: 0, speed: 0, rcs: 0.04, height: 3, events: [] },
    { id: 4, name: "Middle Ground E cardinal", kind: "buoy", pos: { e: -1.0, n: 2.4 }, course: 0, speed: 0, rcs: 0.04, height: 3, events: [] },
    { id: 5, name: "Entrance light", kind: "beacon", pos: { e: 1.2, n: 6.7 }, course: 0, speed: 0, rcs: 0.6, height: 25, events: [] },
    { id: 6, name: "Outbound tanker", kind: "ship", pos: { e: -0.1, n: 6.8 }, course: 180, speed: 8, rcs: 1.2, height: 25, events: [{ atSeconds: 1500, course: 200 }] },
    { id: 7, name: "Coaster", kind: "ship", pos: { e: 7, n: -3 }, course: 290, speed: 10, rcs: 0.6, height: 14, events: [] },
    { id: 8, name: "Fishing boat", kind: "small-craft", pos: { e: -3, n: -1 }, course: 80, speed: 5, rcs: 0.05, height: 4, events: [] },
  ],
};
