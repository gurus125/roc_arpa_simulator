import { SectorZone } from "../core/zones";

/**
 * ARPA model parameters.
 *
 * IMPORTANT: every value here is a PLACEHOLDER chosen so the behaviour described in the ARPA
 * handout is visible on the screen. None of them is a pass mark, an accuracy limit or a
 * figure from a performance standard. They are listed in docs/PHASE4-INSTRUCTOR-CHECK.md for
 * the instructor to confirm or replace.
 */
export interface ArpaConfig {
  /**
   * Fixed receiver setting used by the ARPA plot extractor (gain, tuning, STC, FTC and the
   * range scale that sets the minimum range). The ARPA data feed is separate from the display
   * controls: the operator's gain, clutter and range scale do not change what is tracked.
   * `tuning: null` means "tuned to the set's optimum".
   */
  receiver: { rangeNm: number; gain: number; tuning: number | null; stc: number; ftc: number };
  /** Sea clutter plots are generated out to this range, NM (independent of the display scale). */
  clutterRangeNm: number;
  /** Plots are added to a track's past-position history this often, seconds. */
  pastRecordSec: number;
  /** Most past positions that can be shown. */
  pastMaxPoints: number;
  /** The ARPA self-test shows its test targets and results for this long, seconds. */
  testDurationSec: number;
  /** Target velocity change (relative velocity, knots) that raises a target manoeuvre alarm, and how long it must persist, seconds. */
  courseChangeKn: number;
  courseChangeSec: number;
  /** The threshold is never less than this many times the expected noise of the velocity estimate. */
  courseChangeNoiseFactor: number;
  /** Vectors are hidden for a target moving slower than this (true mode) or closer in relative velocity than this to own ship's (relative mode), knots. */
  stationaryKn: number;
  /**
   * Glint: random wander of the echo's centre along the length of a moving target. Standard
   * deviation in NM for a target 200 m long (IMO A.823(19) appendix 3: 30 m); it scales with length.
   */
  scintillationNm: number;
  /** A poor ground reference left unrestored this long cancels ground stabilisation, seconds. */
  poorRefCancelSec: number;
  /** Standard deviation of the bearing measurement noise of one plot, degrees. */
  bearingNoiseDeg: number;
  /** Standard deviation of the range measurement noise of one plot, NM. */
  rangeNoiseNm: number;
  /** The same for echoes inside `shortPulseRangeNm`, where a shorter pulse is in use. */
  rangeNoiseShortNm: number;
  shortPulseRangeNm: number;
  /** Two echoes closer than this in range AND in bearing merge into one plot. */
  rangeResolutionNm: number;
  beamwidthDeg: number;
  /** Plots further than this are not processed. */
  maxRangeNm: number;
  /** Length of the sliding window of plots used to work out course and speed, seconds. */
  windowSec: number;
  /** Track age before a vector and CPA/TCPA are shown (marked PRELIMINARY), seconds. */
  vectorAfterSec: number;
  /** Track age after which the track is shown as steady, seconds. */
  steadyAfterSec: number;
  /** Association gate round the predicted position, NM, plus growth per missed scan. */
  gateBaseNm: number;
  gateGrowPerMissNm: number;
  /** Consecutive scans without an echo before the target is declared LOST. */
  lostAfterMissedScans: number;
  /** A track with fewer hits than this fraction over the last `fadingScans` scans shows as fading. */
  fadingHitRatio: number;
  fadingScans: number;
  /** Manual acquisition: search radius round the marker, NM, and scans to wait for an echo. */
  manualAcqGateNm: number;
  manualAcqScans: number;
  /** Automatic acquisition: hits needed before a new echo in a guard zone is confirmed. */
  autoConfirmHits: number;
  /** Consecutive misses after which an unconfirmed echo is forgotten. */
  candidateMaxMisses: number;
  candidateGateNm: number;
  maxCandidates: number;
  /** Track capacity. */
  maxTracks: number;
  /** Size of the cells used to turn coastline echoes into plots, NM. */
  landCellNm: number;
  /** Random clutter samples per antenna revolution for the plot extractor. */
  clutterSamplesPerScan: number;
}

export const ARPA_PLACEHOLDERS: ArpaConfig = {
  receiver: { rangeNm: 6, gain: 50, tuning: null, stc: 0, ftc: 0 },
  clutterRangeNm: 5,
  poorRefCancelSec: 60,
  pastRecordSec: 30,
  pastMaxPoints: 10,
  testDurationSec: 30,
  courseChangeKn: 1.5,
  courseChangeSec: 10,
  courseChangeNoiseFactor: 5,
  stationaryKn: 0.5,
  scintillationNm: 0.016,
  bearingNoiseDeg: 0.2,
  rangeNoiseNm: 0.012,
  rangeNoiseShortNm: 0.008,
  shortPulseRangeNm: 3,
  rangeResolutionNm: 0.05,
  beamwidthDeg: 2,
  maxRangeNm: 24,
  windowSec: 180,
  vectorAfterSec: 60,
  steadyAfterSec: 180,
  gateBaseNm: 0.2,
  gateGrowPerMissNm: 0.05,
  lostAfterMissedScans: 8,
  fadingHitRatio: 0.6,
  fadingScans: 10,
  manualAcqGateNm: 0.3,
  manualAcqScans: 4,
  autoConfirmHits: 3,
  candidateMaxMisses: 1,
  candidateGateNm: 0.15,
  maxCandidates: 150,
  maxTracks: 20,
  landCellNm: 0.2,
  clutterSamplesPerScan: 600,
};

export interface ZoneSetting extends SectorZone {
  on: boolean;
}

/** Operator settings, with placeholder defaults. The student changes these on the ARPA panel. */
export interface ArpaSettings {
  stabilisation: "sea" | "ground";
  vectorMode: "true" | "relative";
  vectorMinutes: number;
  cpaLimitNm: number;
  tcpaLimitMin: number;
  autoAcquire: boolean;
  guardZones: ZoneSetting[];
  exclusionZones: ZoneSetting[];
  trial: { on: boolean; course: number; speed: number; delayMinutes: number };
  /** ARPA in standby: no processing, no targets, nothing displayed (as when the radar is on standby). */
  standby: boolean;
  /**
   * Speed input: log through the water, a Doppler bottom-track log (over the ground), or an
   * electronic position-fixing system (EPFS, e.g. GNSS: course and speed over the ground).
   * IMO A.823(19) 3.11.3 allows ground stabilisation from any of: log, EPFS, tracked stationary targets.
   */
  logMode: "water" | "bottom" | "gnss" | "manual";
  /** Speed set by hand, knots, used when `logMode` is "manual" (through the water, along the gyro heading). */
  manualSpeedKn: number;
  /** Collision-danger graphics on tracked targets: potential points of collision, or predicted areas of danger. */
  graphics: "off" | "ppc" | "pad";
  /** ARPA data (symbols, vectors, zones) shown on the radar picture. Off removes it at once (A.823(19) 3.4.7). */
  showData: boolean;
  /** Brilliance of the ARPA data, 0 to 100, independent of the radar picture (A.823(19) 3.4.8). */
  brilliance: number;
  /** Past positions: mode, number of dots shown and the time between them, minutes. */
  past: { mode: "off" | "relative" | "true"; points: number; intervalMin: number };
  /**
   * Safe limit vector suppression (Bole and Dineley 5.2.7): the vectors of targets that do not
   * violate the CPA and TCPA limits are not drawn. They are still tracked, and a vector comes back
   * with the alarm as soon as its target violates the limits.
   */
  vectorSuppress: boolean;
  /**
   * Anchor watch (Bole and Dineley 5.2.3): a tracked target known to be stationary is marked; a
   * warning is given when it has moved more than `limitNm` from the marked position, which means
   * that own ship, or the target, is dragging. `trackId` null: off.
   */
  anchorWatch: { trackId: number | null; limitNm: number };
}

/** Anchor watch distance offered at first, NM (this simulator's choice: about one cable). */
export const ANCHOR_WATCH_DEFAULT_NM = 0.1;

/** Time between past positions the operator can choose, minutes (placeholder). */
export const PAST_INTERVALS_MIN = [0.5, 1, 2, 3, 6] as const;

/** Vector time can be set between these limits, minutes. */
export const VECTOR_TIME_RANGE_MIN = { min: 1, max: 60 } as const;
/** Range scales on which the ARPA is available (placeholder; see the instructor check list). */
export const ARPA_SCALES_NM = [3, 6, 12, 24] as const;
export const arpaAvailableOnScale = (rangeNm: number): boolean => (ARPA_SCALES_NM as readonly number[]).includes(rangeNm);

export function defaultArpaSettings(ownCourse: number, ownSpeed: number): ArpaSettings {
  return {
    stabilisation: "sea",
    vectorMode: "relative",
    vectorMinutes: 6,
    cpaLimitNm: 1.0,
    tcpaLimitMin: 12,
    autoAcquire: false,
    guardZones: [
      { on: false, innerNm: 5.5, outerNm: 6.0, fromRel: 0, toRel: 0 },
      { on: false, innerNm: 2.5, outerNm: 3.0, fromRel: 300, toRel: 60 },
    ],
    exclusionZones: [
      { on: false, innerNm: 0, outerNm: 12, fromRel: 30, toRel: 150 },
      { on: false, innerNm: 0, outerNm: 1.0, fromRel: 0, toRel: 0 },
    ],
    trial: { on: false, course: ownCourse, speed: ownSpeed, delayMinutes: 6 },
    standby: false,
    logMode: "water",
    manualSpeedKn: ownSpeed,
    graphics: "off",
    showData: true,
    brilliance: 100,
    past: { mode: "off", points: 5, intervalMin: 1 },
    vectorSuppress: false,
    anchorWatch: { trackId: null, limitNm: ANCHOR_WATCH_DEFAULT_NM },
  };
}
