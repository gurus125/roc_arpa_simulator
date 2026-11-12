import { describe, expect, it } from "vitest";
import { SHIP_TYPES, ShipMotion, ShipType, autopilotRudder, rudderRate, stepShip } from "../src/core/shipmodel";

const KN = 0.514444;
const DT = 0.5;

/** Integrate the ship's track through the water. Returns positions in metres (x east, y north), heading in degrees. */
function run(type: ShipType, start: ShipMotion, heading0: number, seconds: number, orders: (t: number, m: ShipMotion, hdg: number) => { rudder: number; speed: number }, until?: (m: ShipMotion, hdg: number, t: number) => boolean) {
  let m = { ...start };
  let hdg = heading0;
  let x = 0;
  let y = 0;
  let dist = 0;
  let t = 0;
  let maxX = 0;
  while (t < seconds) {
    m = stepShip(type, m, orders(t, m, hdg), null, DT);
    hdg += m.r * DT;
    const h = (hdg * Math.PI) / 180;
    const vx = (m.u * Math.sin(h) + m.v * Math.cos(h)) * KN;
    const vy = (m.u * Math.cos(h) - m.v * Math.sin(h)) * KN;
    x += vx * DT;
    y += vy * DT;
    dist += Math.hypot(vx, vy) * DT;
    maxX = Math.max(maxX, x);
    t += DT;
    if (until?.(m, hdg, t)) break;
  }
  return { m, hdg, x, y, dist, t, maxX };
}
const atSpeed = (type: ShipType, kn: number): ShipMotion => ({ u: kn, v: 0, r: 0, rudder: 0, engine: kn });

describe("own-ship model against the IMO manoeuvrability criteria (resolution MSC.137(76))", () => {
  for (const type of SHIP_TYPES) {
    const L = type.lengthM;
    const full = type.maxSpeedKn;
    it(`${type.name}: turning circle, 35 deg rudder: advance <= 4.5 L, tactical diameter <= 5 L`, () => {
      const at90 = run(type, atSpeed(type, full), 0, 3000, () => ({ rudder: 35, speed: full }), (_m, h) => h >= 90);
      const at180 = run(type, atSpeed(type, full), 0, 3000, () => ({ rudder: 35, speed: full }), (_m, h) => h >= 180);
      expect(at90.y / L).toBeLessThanOrEqual(4.5); // advance
      expect(at90.y / L).toBeGreaterThan(1.5); // and not absurdly tight
      expect(at180.x / L).toBeLessThanOrEqual(5); // tactical diameter
      expect(at180.x / L).toBeGreaterThan(2);
    });
    it(`${type.name}: initial turning, 10 deg rudder: heading changes 10 deg within 2.5 L`, () => {
      const r = run(type, atSpeed(type, full), 0, 3000, () => ({ rudder: 10, speed: full }), (_m, h) => h >= 10);
      expect(r.dist / L).toBeLessThanOrEqual(2.5);
    });
    it(`${type.name}: full astern stop from full ahead: track reach <= 15 L, and more than 3 L`, () => {
      const r = run(type, atSpeed(type, full), 0, 6000, () => ({ rudder: 0, speed: -0.45 * full }), (m) => m.u <= 0);
      expect(r.dist / L).toBeLessThanOrEqual(15);
      expect(r.dist / L).toBeGreaterThan(3);
    });
    it(`${type.name}: steady turning radius equals L / (K' x rudder) (Nomoto), and speed is lost in the turn`, () => {
      const r = run(type, atSpeed(type, full), 0, 4000, () => ({ rudder: 20, speed: full }));
      const radius = (r.m.u * KN) / ((r.m.r * Math.PI) / 180);
      expect(radius).toBeCloseTo(L / (type.kPrime * ((20 * Math.PI) / 180)), 0);
      expect(r.m.u).toBeLessThan(0.9 * full);
      expect(r.m.v).toBeLessThan(0); // slides outwards (to port in a starboard turn)
    });
    it(`${type.name}: settles at the ordered speed ahead and astern; engine stopped gives a long run-on`, () => {
      expect(run(type, atSpeed(type, 0), 0, 6000, () => ({ rudder: 0, speed: 0.6 * full })).m.u).toBeCloseTo(0.6 * full, 1);
      expect(run(type, atSpeed(type, 0), 0, 6000, () => ({ rudder: 0, speed: -0.25 * full })).m.u).toBeCloseTo(-0.25 * full, 1);
      const coast = run(type, atSpeed(type, full), 0, 300, () => ({ rudder: 0, speed: 0 }));
      expect(coast.m.u).toBeGreaterThan(0.3 * full); // still making way 5 minutes after stopping the engine
    });
    it(`${type.name}: autopilot takes up a new course 60 deg away with little overshoot`, () => {
      let maxH = 0;
      const r = run(type, atSpeed(type, 0.8 * full), 0, 1500, (_t, m, h) => ({ rudder: autopilotRudder(type, 60 - h, m.r, m.u), speed: 0.8 * full }), (_m, h) => {
        maxH = Math.max(maxH, h);
        return false;
      });
      expect(r.hdg).toBeCloseTo(60, 0);
      expect(maxH).toBeLessThan(66);
    });
  }
  it("hard over to hard over (-35 to +35) takes 28 s with one steering gear unit and 18 s with two", () => {
    const type = SHIP_TYPES[0]!;
    const time = (rate?: number): number => {
      let m = { ...atSpeed(type, 10), rudder: -35 };
      let t = 0;
      while (m.rudder < 35 - 1e-9) {
        m = stepShip(type, m, { rudder: 35, speed: 10, ...(rate === undefined ? {} : { rudderRateDegPerSec: rate }) }, null, 0.25);
        t += 0.25;
      }
      return t;
    };
    expect(time()).toBeCloseTo(28, 1); // the ship type's own rate is one unit
    expect(time(rudderRate(1))).toBeCloseTo(28, 1);
    expect(time(rudderRate(2))).toBeCloseTo(18, 1);
  });
  it("a beam wind gives leeway to leeward; a head wind takes off speed", () => {
    const type = SHIP_TYPES[0]!;
    const m = stepShip(type, atSpeed(type, 15), { rudder: 0, speed: 15 }, { head: 0, beam: 30 }, DT);
    expect(m.v).toBeCloseTo(type.leeway * 30, 6); // wind from port pushes the ship to starboard
    let h = atSpeed(type, 15);
    for (let i = 0; i < 4000; i++) h = stepShip(type, h, { rudder: 0, speed: 15 }, { head: 40, beam: 0 }, DT);
    expect(h.u).toBeLessThan(15);
    expect(h.u).toBeGreaterThan(13);
  });
});

import { createWorld, ownCogSog, relativeWind, setShipModel, stepWorld } from "../src/engine/index";
import { angleDiffDeg } from "../src/core/vec";

describe("own ship with a manoeuvring model in the simulation", () => {
  const sc = { id: "t", name: "t", description: "", own: { heading: 0, speed: 12 }, targets: [], coasts: [], env: {} };
  const runW = (w: ReturnType<typeof createWorld>, s: number): void => {
    for (let i = 0; i < s * 2; i++) stepWorld(w, 0.5);
  };
  it("autopilot: a new course is taken up and held; the turn takes longer than an instant change", () => {
    const w = createWorld(sc);
    setShipModel(w, "container");
    w.own.ordered.course = 50;
    runW(w, 20);
    expect(Math.abs(angleDiffDeg(w.own.heading, 50))).toBeGreaterThan(20); // still turning after 20 s
    runW(w, 280);
    expect(Math.abs(angleDiffDeg(w.own.heading, 50))).toBeLessThan(1);
  });
  it("hand steering: the ship keeps turning until the rudder is amidships, and the ordered course follows the heading", () => {
    const w = createWorld(sc);
    setShipModel(w, "coaster");
    w.own.model!.steering = "hand";
    w.own.model!.rudderOrder = 20;
    runW(w, 60);
    const h1 = w.own.heading;
    expect(h1).toBeGreaterThan(20);
    expect(w.own.ordered.course).toBeCloseTo(h1, 6);
    w.own.model!.rudderOrder = 0;
    runW(w, 120);
    const h2 = w.own.heading;
    runW(w, 60);
    expect(Math.abs(angleDiffDeg(w.own.heading, h2))).toBeLessThan(0.5); // steady again
  });
  it("in the simulation the second steering gear unit brings the rudder over sooner", () => {
    const secondsToHardOver = (units: 1 | 2): number => {
      const w = createWorld(sc);
      setShipModel(w, "container");
      w.own.model!.steering = "hand";
      w.own.model!.steeringUnits = units;
      w.own.model!.rudderOrder = 35;
      let t = 0;
      while (w.own.model!.motion.rudder < 35 - 1e-9) {
        stepWorld(w, 0.25);
        t += 0.25;
      }
      return t;
    };
    expect(secondsToHardOver(1)).toBeCloseTo(14, 1); // midships to hard over: half of 28 s
    expect(secondsToHardOver(2)).toBeCloseTo(9, 1); // half of 18 s
  });
  it("relative wind: 20 kn from north on a ship steering north at 12 kn is felt as 32 kn from ahead", () => {
    const w = createWorld(sc);
    w.env.wind = { from: 0, speedKn: 20 };
    const r = relativeWind(w)!;
    expect(r.speedKn).toBeCloseTo(32, 6);
    expect(angleDiffDeg(r.fromRel, 0)).toBeCloseTo(0, 6);
    expect(r.head).toBeCloseTo(32, 6);
  });
  it("relative wind: 12 kn from the west on a ship steering north at 12 kn is felt 45 deg on the port bow at 17 kn", () => {
    const w = createWorld(sc);
    w.env.wind = { from: 270, speedKn: 12 };
    const r = relativeWind(w)!;
    expect(r.speedKn).toBeCloseTo(12 * Math.SQRT2, 6);
    expect(r.fromRel).toBeCloseTo(315, 6);
    expect(r.beam).toBeCloseTo(12, 6); // from port
  });
  it("a wind from the west sets the ship to the east: course made good is to starboard of the heading", () => {
    const w = createWorld(sc);
    setShipModel(w, "container");
    w.env.wind = { from: 270, speedKn: 30 };
    runW(w, 300);
    const cog = ownCogSog(w);
    expect(cog.course).toBeGreaterThan(1);
    expect(cog.course).toBeLessThan(15);
    expect(Math.abs(angleDiffDeg(w.own.heading, 0))).toBeLessThan(1);
  });
});
