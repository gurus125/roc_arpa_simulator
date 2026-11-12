import { TargetKind, Target } from "./types";
import { rcsForDetectionRange } from "./band";

/**
 * Catalogue of target types. Each has a size, the height of its radar-reflecting structure, the
 * range at which the X-band radar first detects it in clear conditions (subject to the radar
 * horizon), a typical service speed, and how it moves: turn rate, speed change rate and leeway
 * in a beam wind. A target of a catalogue type steers a course through the water, turns and
 * changes speed gradually, and is set by the current and blown by the wind.
 *
 * ALL FIGURES ARE PLACEHOLDERS: typical values for the type, not data of any particular ship.
 * The detection ranges of the IMO standard targets in MSC.192(79) table 2 are in band.ts.
 */
export interface TargetType {
  id: string;
  name: string;
  kind: TargetKind;
  lengthM: number;
  heightM: number;
  /** First detection on X band in clear conditions, NM. */
  detectNm: number;
  /** Typical service speed, knots. */
  speedKn: number;
  /** Rate of turn when altering course, degrees per second. */
  turnDegPerSec: number;
  /** Rate of change of speed, knots per second. */
  accelKnPerSec: number;
  /** Leeway speed as a fraction of the beam component of the relative wind. */
  leeway: number;
  /** Fixed object: does not move or drift. */
  fixed?: boolean;
}

const T = (id: string, name: string, kind: TargetKind, lengthM: number, heightM: number, detectNm: number, speedKn: number, turnDegPerSec: number, accelKnPerSec: number, leeway: number): TargetType =>
  ({ id, name, kind, lengthM, heightM, detectNm, speedKn, turnDegPerSec, accelKnPerSec, leeway });

export const TARGET_TYPES: TargetType[] = [
  T("vlcc", "VLCC tanker, loaded, 330 m", "ship", 330, 25, 20, 14, 0.4, 0.01, 0.01),
  T("aframax", "Aframax tanker, 250 m", "ship", 250, 22, 18, 14, 0.5, 0.015, 0.012),
  T("product-tanker", "Product tanker, 180 m", "ship", 180, 18, 15, 14, 0.7, 0.02, 0.015),
  T("chemical-tanker", "Chemical tanker, 130 m", "ship", 130, 15, 13, 13, 0.8, 0.025, 0.015),
  T("lng", "LNG carrier, 290 m", "ship", 290, 35, 20, 19, 0.5, 0.015, 0.03),
  T("lpg", "LPG carrier, 180 m", "ship", 180, 22, 15, 16, 0.7, 0.02, 0.025),
  T("container-ul", "Container ship, ultra large, 400 m", "ship", 400, 45, 22, 21, 0.4, 0.012, 0.035),
  T("container-pp", "Container ship, post-Panamax, 300 m", "ship", 300, 38, 20, 22, 0.5, 0.015, 0.035),
  T("container-feeder", "Container feeder, 140 m", "ship", 140, 22, 14, 17, 0.9, 0.03, 0.03),
  T("bulk-cape", "Capesize bulk carrier, 290 m", "ship", 290, 24, 19, 13, 0.4, 0.01, 0.012),
  T("bulk-panamax", "Panamax bulk carrier, 225 m", "ship", 225, 20, 17, 13.5, 0.5, 0.012, 0.013),
  T("bulk-handy", "Handysize bulk carrier, 170 m", "ship", 170, 17, 14, 13, 0.7, 0.02, 0.015),
  T("general-cargo", "General cargo ship, 120 m", "ship", 120, 15, 12, 13, 0.9, 0.03, 0.02),
  T("coaster", "Coaster, 90 m", "ship", 90, 12, 11, 11, 1.2, 0.04, 0.025),
  T("roro", "Ro-ro cargo ship, 180 m", "ship", 180, 28, 16, 19, 0.8, 0.025, 0.04),
  T("car-carrier", "Car carrier, 200 m", "ship", 200, 35, 18, 19, 0.7, 0.02, 0.05),
  T("cruise", "Cruise ship, 300 m", "ship", 300, 50, 22, 21, 0.7, 0.025, 0.045),
  T("ferry", "Passenger ferry, 150 m", "ship", 150, 25, 15, 20, 1.2, 0.04, 0.04),
  T("high-speed", "High-speed craft, 90 m", "ship", 90, 12, 10, 35, 3, 0.15, 0.03),
  T("frigate", "Naval frigate, 130 m", "ship", 130, 20, 13, 25, 1.5, 0.06, 0.03),
  T("offshore-supply", "Offshore supply vessel, 80 m", "ship", 80, 12, 10, 12, 1.5, 0.05, 0.03),
  T("dredger", "Dredger, 100 m", "ship", 100, 12, 11, 8, 0.8, 0.02, 0.02),
  T("tug", "Tug, 30 m", "ship", 30, 8, 7, 11, 3, 0.08, 0.02),
  T("tug-tow", "Tug with tow, 200 m overall", "ship", 200, 8, 8, 6, 0.5, 0.01, 0.02),
  T("trawler", "Fishing trawler, 35 m", "ship", 35, 7, 6, 9, 2.5, 0.06, 0.025),
  T("fishing-boat", "Small fishing boat, 12 m", "small-craft", 12, 3, 3.4, 7, 4, 0.1, 0.03),
  T("pilot-boat", "Pilot boat, 15 m", "small-craft", 15, 4, 4, 20, 6, 0.2, 0.03),
  T("yacht", "Sailing yacht with radar reflector, 12 m", "small-craft", 12, 4, 5, 6, 4, 0.1, 0.05),
  { ...T("buoy", "Navigation buoy with corner reflector", "buoy", 0, 3.5, 4.9, 0, 0, 0, 0), fixed: true },
  { ...T("beacon", "Beacon or light structure", "beacon", 0, 15, 12, 0, 0, 0, 0), fixed: true },
];

export function targetTypeById(id: string | undefined): TargetType | undefined {
  return id === undefined ? undefined : TARGET_TYPES.find((t) => t.id === id);
}

/** The fields of a target that come from its catalogue type. */
export function targetFromType(type: TargetType): Pick<Target, "kind" | "rcs" | "height" | "lengthM" | "typeId"> {
  return { kind: type.kind, rcs: rcsForDetectionRange(type.detectNm), height: type.heightM, lengthM: type.lengthM, typeId: type.id };
}
