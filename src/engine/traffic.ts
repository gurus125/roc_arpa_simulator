import { Vec2, add, fromPolar, length, normalizeDeg, scale, sub, velocityOf } from "../core/vec";
import { TARGET_TYPES, targetFromType, targetTypeById } from "./targets";
import { Target, World } from "./types";
import { initTargetMotion } from "./world";

/**
 * Random traffic for the instructor. The same seed gives the same ships, so an exercise can be repeated and
 * every display of a class can be given the same traffic.
 */
export interface RandomTrafficOptions {
  /** Ships in all. */
  count: number;
  /** They start between these ranges from own ship, NM. */
  minNm: number;
  maxNm: number;
  /** How many of them are put on a course that passes close to own ship if nobody acts. */
  threats: number;
  /** A threat passes within this distance, NM, in a time between these limits, minutes. */
  threatCpaNm: number;
  threatTcpaMin: [number, number];
}

export const RANDOM_TRAFFIC_DEFAULT: RandomTrafficOptions = { count: 12, minNm: 3, maxNm: 12, threats: 3, threatCpaNm: 0.5, threatTcpaMin: [15, 35] };

/** A small seeded generator (mulberry32): numbers from 0 up to 1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` vessels of catalogue types round own ship. The first `threats` of them are placed so that, on own
 * ship's present course and speed, they pass within `threatCpaNm`; the others are placed and headed at random
 * at their type's usual speed (within a quarter either way). `firstId` is the id of the first one.
 */
export function randomTraffic(
  own: { pos: Vec2; course: number; speed: number },
  o: RandomTrafficOptions,
  seed: number,
  firstId: number,
): Omit<Target, "nextEvent">[] {
  const rng = seededRandom(seed);
  const types = TARGET_TYPES.filter((t) => !t.fixed && t.speedKn > 0);
  const ownVel = velocityOf({ course: own.course, speed: own.speed });
  const out: Omit<Target, "nextEvent">[] = [];
  const n = Math.max(0, Math.floor(o.count));
  for (let i = 0; i < n; i++) {
    const type = types[Math.floor(rng() * types.length)]!;
    const speed = Math.round(type.speedKn * (0.75 + 0.5 * rng()) * 10) / 10;
    let course = Math.floor(rng() * 360);
    let rel: Vec2;
    if (i < o.threats) {
      // Chosen: the passing distance, the time, and the ship's own course. Her start follows from them.
      const cpa = o.threatCpaNm * rng();
      const tcpaH = (o.threatTcpaMin[0] + (o.threatTcpaMin[1] - o.threatTcpaMin[0]) * rng()) / 60;
      let relVel = sub(velocityOf({ course, speed }), ownVel);
      if (length(relVel) < 2) {
        // Nearly own ship's course and speed: she would never close. Turn her round.
        course = normalizeDeg(course + 180);
        relVel = sub(velocityOf({ course, speed }), ownVel);
      }
      const unit = scale(relVel, 1 / length(relVel));
      const side = rng() < 0.5 ? 1 : -1;
      rel = add(scale({ e: unit.n * side, n: -unit.e * side }, cpa), scale(relVel, -tcpaH));
    } else {
      rel = fromPolar(rng() * 360, o.minNm + (o.maxNm - o.minNm) * Math.sqrt(rng()));
    }
    out.push({
      id: firstId + i, name: `${type.name.split(",")[0]} ${firstId + i}`, ...targetFromType(type),
      pos: add(own.pos, rel), course, speed, events: [],
    });
  }
  return out;
}

/** In a linked exercise the other displays' own ships are targets with ids from this number up: they come and go with the link. */
export const LINKED_SHIP_ID_BASE = 9000;

/** The next free id for a target added by the instructor (below the ids of linked own ships). */
export function nextTargetId(w: World): number {
  return Math.max(0, ...w.targets.filter((x) => x.id < LINKED_SHIP_ID_BASE).map((x) => x.id)) + 1;
}

/** Put one vessel of a catalogue type into the world, at a true bearing and range from own ship. Returns it. */
export function addTypedTarget(w: World, o: { name: string; typeId: string; bearing: number; rangeNm: number; course: number; speed: number }): Target {
  const type = targetTypeById(o.typeId) ?? TARGET_TYPES[0]!;
  const t: Target = {
    id: nextTargetId(w), name: o.name || "Intruder", ...targetFromType(type),
    pos: add(w.own.pos, fromPolar(o.bearing, Math.max(0.1, o.rangeNm))), course: normalizeDeg(o.course), speed: type.fixed ? 0 : Math.max(0, o.speed),
    events: [], nextEvent: 0,
  };
  initTargetMotion(t);
  w.targets.push(t);
  return t;
}

/** Add random traffic round own ship (see `randomTraffic`), in place of the ships there or as well as them. Returns how many were added. */
export function addRandomTraffic(w: World, o: RandomTrafficOptions, seed: number, replace: boolean): number {
  if (replace) w.targets = w.targets.filter((t) => t.id >= LINKED_SHIP_ID_BASE || (t.kind !== "ship" && t.kind !== "small-craft"));
  const first = nextTargetId(w);
  const ships = randomTraffic({ pos: w.own.pos, course: w.own.heading, speed: w.own.speedThroughWater }, o, seed, first);
  for (const s of ships) {
    const t: Target = { ...s, nextEvent: 0 };
    initTargetMotion(t);
    w.targets.push(t);
  }
  return ships.length;
}
