/**
 * Own-ship manoeuvring model with three degrees of freedom: surge (ahead speed), sway (sideways
 * speed) and yaw (rate of turn).
 *
 *  - Yaw: first-order Nomoto model, T r' + r = K d, with K = K' U / L and T = T' L / U, so the
 *    steady turning radius is L / (K' d) whatever the speed, and the ship answers the helm
 *    more slowly at low speed.
 *  - Sway: the ship slides outwards in a turn (drift angle), in proportion to the rate of turn.
 *  - Surge: propeller thrust against hull resistance that grows with the square of the speed,
 *    so a stopped engine gives a long run-on; turning adds resistance (speed loss in a turn).
 *  - Rudder: moves at a limited rate to the ordered angle. Engine: takes time to follow the order.
 *  - Wind: leeway in proportion to the beam component of the relative wind, and a small
 *    effect on speed from the head component.
 *
 * The coefficients of the ship types are PLACEHOLDERS: typical values chosen so that each ship
 * meets the IMO manoeuvrability criteria (turning, initial turning, stopping). They are not
 * from any ship's trial data. Units at the interface: knots, degrees, seconds, metres.
 */
export interface ShipType {
  id: string;
  name: string;
  lengthM: number;
  /** Beam and loaded draught, metres (for the ship particulars only; placeholders). */
  beamM: number;
  draughtM: number;
  /** Speed at full sea speed ahead, knots. */
  maxSpeedKn: number;
  /** Nomoto gain and time constant, non-dimensional. */
  kPrime: number;
  tPrime: number;
  /** Sets thrust and resistance: from rest on full ahead the ship reaches 90% of full speed in about 0.74 x this, seconds. */
  speedTimeS: number;
  /** Seconds for the engine to go from stop to full. */
  engineTimeS: number;
  /** Astern thrust as a fraction of ahead thrust. */
  asternPower: number;
  /** Sideways speed in a turn = driftFactor x rate of turn x length. */
  driftFactor: number;
  /** Extra resistance in a turn = turnLoss x (r L / U)^2. */
  turnLoss: number;
  /** Leeway speed as a fraction of the beam component of the relative wind. */
  leeway: number;
  /** Speed effect of a head wind, 1/m (small). */
  windDrag: number;
  maxRudderDeg: number;
  rudderRateDegPerSec: number;
}

/** Engine telegraph steps as fractions of full sea speed (PLACEHOLDER fractions). */
export const TELEGRAPH: { key: string; label: string; fraction: number }[] = [
  { key: "FA", label: "FULL AST", fraction: -0.45 },
  { key: "HA", label: "HALF AST", fraction: -0.35 },
  { key: "SA", label: "SLOW AST", fraction: -0.25 },
  { key: "DA", label: "DS AST", fraction: -0.15 },
  { key: "ST", label: "STOP", fraction: 0 },
  { key: "DS", label: "D.SLOW", fraction: 0.25 },
  { key: "SL", label: "SLOW", fraction: 0.4 },
  { key: "HF", label: "HALF", fraction: 0.6 },
  { key: "FL", label: "FULL", fraction: 0.8 },
  { key: "NF", label: "SEA FULL", fraction: 1 },
];

/**
 * Time for the rudder to go from hard over to hard over (35 deg one side to 35 deg the other),
 * seconds, with one steering gear power unit ("telemotor") running and with two. Figures given by
 * the academy. (SOLAS II-1 regulation 29 requires 35 deg one side to 30 deg the other in not more
 * than 28 seconds with one power unit.)
 */
export const HARD_OVER_SECONDS: Record<1 | 2, number> = { 1: 28, 2: 18 };
/** Rudder rate in degrees per second with one or two power units running. */
export const rudderRate = (units: 1 | 2): number => 70 / HARD_OVER_SECONDS[units];

const BASE = { asternPower: 0.6, driftFactor: 0.3, turnLoss: 4, windDrag: 0.000005, maxRudderDeg: 35, rudderRateDegPerSec: rudderRate(1) };

export const SHIP_TYPES: ShipType[] = [
  { ...BASE, id: "container", name: "Container ship, 230 m", lengthM: 230, beamM: 32.2, draughtM: 11.5, maxSpeedKn: 22, kPrime: 0.9, tPrime: 1.2, speedTimeS: 600, engineTimeS: 40, leeway: 0.035 },
  { ...BASE, id: "bulk", name: "Bulk carrier, loaded, 225 m", lengthM: 225, beamM: 32.3, draughtM: 14.2, maxSpeedKn: 14.5, kPrime: 1.05, tPrime: 2.1, speedTimeS: 1000, engineTimeS: 60, leeway: 0.015 },
  { ...BASE, id: "tanker", name: "Product tanker, 180 m", lengthM: 180, beamM: 32, draughtM: 11, maxSpeedKn: 15, kPrime: 1.0, tPrime: 1.8, speedTimeS: 800, engineTimeS: 50, leeway: 0.02 },
  { ...BASE, id: "coaster", name: "Coaster, 90 m", lengthM: 90, beamM: 14, draughtM: 5.5, maxSpeedKn: 13, kPrime: 1.0, tPrime: 1.0, speedTimeS: 300, engineTimeS: 25, leeway: 0.03 },
];

export function shipTypeById(id: string): ShipType {
  return SHIP_TYPES.find((s) => s.id === id) ?? SHIP_TYPES[0]!;
}

export interface ShipMotion {
  /** Speed ahead through the water, knots (negative: moving astern). */
  u: number;
  /** Sideways speed through the water, knots, positive to starboard. */
  v: number;
  /** Rate of turn, degrees per second, positive to starboard. */
  r: number;
  /** Actual rudder angle, degrees, positive to starboard. */
  rudder: number;
  /** Speed the engine is delivering now (the speed it would give in the end), knots. */
  engine: number;
}

export interface ShipOrders {
  /** Rudder order, degrees, positive to starboard. */
  rudder: number;
  /** Engine order as the speed it gives in the end, knots (negative: astern). */
  speed: number;
  /** Rudder rate now, degrees per second (two steering gear units move it faster). Default: the ship type's rate with one unit. */
  rudderRateDegPerSec?: number;
}

/** Full astern as a fraction of full sea speed (the lowest telegraph step). */
const ASTERN_FULL = 0.45;
const KN = 0.514444; // m/s per knot
const RAD = Math.PI / 180;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/**
 * Advance the ship's motion by dt seconds. `relWind` is the relative wind in ship axes, knots:
 * `head` positive when it blows from ahead, `beam` positive when it blows from the port side
 * (pushing the ship to starboard). Null: no wind.
 */
export function stepShip(type: ShipType, m: ShipMotion, orders: ShipOrders, relWind: { head: number; beam: number } | null, dt: number): ShipMotion {
  const L = type.lengthM;
  const uMax = type.maxSpeedKn * KN;
  // Rudder and engine follow their orders at limited rates.
  const dOrder = clamp(orders.rudder, -type.maxRudderDeg, type.maxRudderDeg);
  const rate = orders.rudderRateDegPerSec ?? type.rudderRateDegPerSec;
  const rudder = m.rudder + clamp(dOrder - m.rudder, -rate * dt, rate * dt);
  const eOrder = clamp(orders.speed, -ASTERN_FULL * type.maxSpeedKn, type.maxSpeedKn);
  const eRate = (type.maxSpeedKn / type.engineTimeS) * dt;
  const engine = m.engine + clamp(eOrder - m.engine, -eRate, eRate);

  const u = m.u * KN;
  const U = Math.max(Math.abs(u), 0.05);
  // Yaw (Nomoto). The rudder needs water flow: ahead it steers normally, astern weakly and reversed.
  const K = (type.kPrime * u) / L;
  const T = (type.tPrime * L) / Math.max(U, 0.5);
  let r = m.r * RAD;
  r += ((K * (u >= 0 ? 1 : 0.3) * rudder * RAD - r) / T) * dt;

  // Surge: thrust - resistance. k is chosen so the speed settles in about speedTimeS near full speed.
  const k = 2 / (type.speedTimeS * uMax);
  const e = engine * KN;
  // Astern, full gives `asternPower` of the full-ahead thrust; hull resistance astern is raised in the same ratio so that the steady astern speed is the telegraph speed.
  const thrust = e >= 0 ? k * e * e : -k * e * e * (type.asternPower / ASTERN_FULL ** 2);
  const turn = 1 + type.turnLoss * ((r * L) / U) ** 2;
  let du = thrust - k * u * Math.abs(u) * turn * (u < 0 ? type.asternPower / ASTERN_FULL ** 2 : 1);
  if (relWind) du -= type.windDrag * relWind.head * KN * Math.abs(relWind.head * KN);
  const u2 = u + du * dt;

  // Sway: outward slide in the turn, plus leeway from the beam wind.
  const v = -type.driftFactor * r * L + (relWind ? type.leeway * relWind.beam * KN : 0);
  return { u: u2 / KN, v: v / KN, r: r / RAD, rudder, engine };
}

/** Autopilot: rudder order to bring the heading error to zero (PD controller), within a rudder limit. */
export function autopilotRudder(type: ShipType, headingErrorDeg: number, rotDegPerSec: number, uKn: number, limitDeg = 20): number {
  const T = (type.tPrime * type.lengthM) / Math.max(Math.abs(uKn) * KN, 0.5);
  return clamp(2 * headingErrorDeg - 2 * 0.8 * T * rotDegPerSec, -limitDeg, limitDeg);
}
