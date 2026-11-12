import { ShipMotion } from "../core/shipmodel";
import { Vec2 } from "../core/vec";
import { SetDrift } from "../core/current";

export type TargetKind = "ship" | "small-craft" | "buoy" | "beacon";

export interface TargetEvent {
  /** Simulation seconds from the start at which the change happens. */
  atSeconds: number;
  course?: number;
  speed?: number;
}

export interface Target {
  id: number;
  name: string;
  kind: TargetKind;
  /** Position over the ground, NM, local east/north frame. */
  pos: Vec2;
  /** Course and speed OVER THE GROUND. */
  course: number;
  speed: number;
  /** Radar reflectivity: about 1 = large ship, 0.04 = small craft, 0.015 = buoy. */
  rcs: number;
  /** Height of the reflecting structure above sea level, metres. */
  height: number;
  /** Length of the vessel, metres (sets the size of the echo's glint). Default by kind: see `targetLengthM`. */
  lengthM?: number;
  events: TargetEvent[];
  nextEvent: number;
  /**
   * Radar transponder carried by the target, if any. "racon": a radar beacon that paints a Morse
   * flash beyond its echo. "sart": a search and rescue transponder that paints a line of 12 dots.
   * "ramark": a beacon that transmits all the time and paints a line along its bearing (bearing only, no range).
   */
  transponder?: "racon" | "sart" | "ramark";
  /** Morse letter of a racon, as dots and dashes (for example "-.-" for K). */
  raconCode?: string;
  /** Bands a racon answers: X (default), S or both. A SART answers X band only. */
  raconBand?: "X" | "S" | "both";
  /** False when the vessel's AIS is switched off or it carries none. Ships transmit AIS by default. */
  ais?: boolean;
  /** Catalogue type (engine/targets.ts). A moving target of a catalogue type is given `motion`. */
  typeId?: string;
  /**
   * Motion through the water for a target of a catalogue type: what it steers and the speed it
   * makes, and the course and speed it has been ordered to. `course` and `speed` above are then
   * the result OVER THE GROUND (with current and leeway), recomputed every step.
   */
  motion?: { heading: number; stw: number; orderedCourse: number; orderedSpeed: number };
}

export interface Coast {
  name: string;
  points: Vec2[];
  closed: boolean;
  /** Height the shoreline rises to, metres (sets how far off it is detected). Default 60. */
  heightM?: number;
}

export interface RainZone {
  center: Vec2;
  radius: number;
  /** 0 to 1 */
  intensity: number;
}

export interface Hazard {
  name: string;
  center: Vec2;
  /** NM */
  radius: number;
}

/** A charted area of shallow water: nowhere inside it is deeper than `depthM`. Outside every area the water is deep. */
export interface DepthArea {
  name: string;
  points: Vec2[];
  depthM: number;
}

export interface Environment {
  current: SetDrift;
  /** 0 (calm) to 9 */
  seaState: number;
  /** Abnormal propagation: extends the detection horizon. */
  ducting: boolean;
  rain: RainZone[];
  /**
   * Tidal stream, added to the steady current: it runs towards `floodSet` on the flood and the
   * opposite way on the ebb, with a rate that changes through the tidal cycle.
   */
  /** True wind: the direction it blows FROM (degrees true) and its speed, knots. */
  wind?: { from: number; speedKn: number };
  tidal?: { floodSet: number; maxRateKn: number; hoursAfterSlackAtStart: number };
  /** Another ship's radar on the same band is causing interference on the picture. */
  interference?: boolean;
}

export interface OwnShip {
  pos: Vec2;
  heading: number;
  speedThroughWater: number;
  ordered: { course: number; speed: number };
  /** Radar antenna height above sea level, metres. */
  antennaHeight: number;
  turnRateDegPerSec: number;
  accelKnPerSec: number;
  /**
   * Manoeuvring model (see core/shipmodel). When absent, the ship turns and changes speed at the
   * fixed rates above. `steering` "auto": the autopilot steers `ordered.course`; "hand": the
   * rudder follows `rudderOrder` and `ordered.course` follows the heading. The engine order is
   * `ordered.speed` (the speed it gives in the end; negative for astern).
   */
  model?: { typeId: string; steering: "auto" | "hand"; rudderOrder: number; motion: ShipMotion; /** Steering gear power units (telemotors) running: 1 (default) or 2. */ steeringUnits?: 1 | 2 };
}

export interface RadarControls {
  /** Selected range scale, NM. */
  rangeNm: number;
  /** 0 to 100 */
  gain: number;
  tuning: number;
  /** Sea clutter (STC) */
  stc: number;
  /** Rain clutter (FTC) */
  ftc: number;
  brilliance: number;
  /** Pulse length: "auto" follows the range scale; the others are chosen by hand. Default auto. */
  pulse?: "auto" | "short" | "medium" | "long";
  /** Echo stretch: target echoes are painted larger. */
  echoStretch?: boolean;
  /** Echo averaging (scan-to-scan correlation): random clutter and noise are suppressed. */
  echoAverage?: boolean;
  /** Interference rejection: removes the pattern from another ship's radar. */
  interferenceRejection?: boolean;
}

export interface ShadowSector {
  /** Relative bearings from own bow, degrees. The sector runs clockwise from `from` to `to`. */
  from: number;
  to: number;
}

export interface RadarSet {
  controls: RadarControls;
  /** Hidden best tuning setting (0 to 100). The student finds it with the tuning indicator. */
  tuningOptimum: number;
  shadowSectors: ShadowSector[];
  /** Antenna revolutions per minute. */
  rpm: number;
  /** Frequency band: X (9 GHz, 3 cm) or S (3 GHz, 10 cm). */
  band: "X" | "S";
  /** Transmitter and receiver performance, 1 = as new. Set lower by the instructor (ageing magnetron, water in the waveguide). */
  performance?: number;
}

export interface CoastEdge {
  a: Vec2;
  b: Vec2;
}

export interface CoastSample {
  pos: Vec2;
  edge: number;
  /** Height of this stretch of shoreline, metres. */
  heightM: number;
}

/**
 * Own-ship sensor errors, set by the instructor (fault injection). Zero means a perfect sensor.
 * They affect what the radar and ARPA are told, never the ship's real motion.
 */
export interface Sensors {
  /** Gyro compass error, degrees. Positive = gyro reads HIGH (every bearing reads too large). */
  gyroErrorDeg: number;
  /** Speed log error, knots. Positive = log reads HIGH. Applies to speed through the water. */
  logErrorKn: number;
  /** Heading marker error, degrees: the heading line is painted this far to starboard (+) of the ship's head. */
  headingMarkerErrorDeg?: number;
  /** VRM error, per cent: the variable range marker ring is painted this much too large (+) for its readout. */
  vrmErrorPct?: number;
  /**
   * Instructor setting the errors are moving towards. The errors change gradually at the
   * ramp rates (a sudden step would make every distant ARPA track jump out of its gate).
   * Absent = the errors stay as they are.
   */
  target?: { gyroErrorDeg: number; logErrorKn: number };
  /** Ramp rates: degrees per minute and knots per minute. Placeholder values. */
  rampPerMin: { gyroDeg: number; logKn: number };
}

export interface World {
  /** Simulation time, seconds. */
  time: number;
  own: OwnShip;
  targets: Target[];
  coasts: Coast[];
  edges: CoastEdge[];
  coastSamples: CoastSample[];
  env: Environment;
  radar: RadarSet;
  hazards: Hazard[];
  sensors: Sensors;
  /** Planned track (waypoints), NM. Empty when the scenario has none. */
  route: Vec2[];
  /** Charted shallow areas (optional chart data). */
  depths: DepthArea[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  own: { heading: number; speed: number; pos?: Vec2 };
  env: Partial<Environment>;
  targets: Omit<Target, "nextEvent">[];
  coasts: Coast[];
  hazards?: Hazard[];
  route?: Vec2[];
  depths?: DepthArea[];
}

/** IMO MSC.192(79) 5.10.1: 0.25, 0.5, 0.75, 1.5, 3, 6, 12 and 24 NM. */
export const RADAR_RANGES = [0.25, 0.5, 0.75, 1.5, 3, 6, 12, 24, 48, 96] as const;
