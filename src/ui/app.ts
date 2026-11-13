import { RocSession } from "../roc/index";
import { ArpaSystem } from "../arpa/index";
import { ArpaExSession, PictureFrame, Recorder } from "../train/index";
import { AisSystem } from "../ais/index";
import { Vec2 } from "../core/vec";
import {
  DisplayState, Hit, Scenario, TrailStore, World, createWorld, newDisplayState, recentreTrueMotion, scanWedge,
  stepWorld, stepSpeedInput, logSpeed, updateTrueMotionOrigin, SCENARIOS, measuredHeading, radarTransmitting,
} from "../engine/index";

/** Latitude and longitude of the scenarios' 0,0: the same point the real Mumbai coastline is laid out from. */

export type TrailMode = "off" | "relative" | "true";

export interface LiveHit {
  hit: Hit;
  born: number;
}

export interface AppState {
  scenario: Scenario;
  world: World;
  display: DisplayState;
  trails: TrailStore;
  hits: LiveHit[];
  /** Antenna bearing relative to the bow, degrees. */
  sweep: number;
  /** Wall-clock seconds since start (drives echo fading). */
  wall: number;
  running: boolean;
  timeScale: number;
  ebl: { on: boolean; bearing: number };
  vrm: { on: boolean; range: number };
  /** Second EBL and VRM (IMO MSC.192(79) asks for at least two of each). */
  ebl2: { on: boolean; bearing: number };
  vrm2: { on: boolean; range: number };
  /** Origin of EBL 1 when it is moved off own ship: a fixed position (NM), or null for own ship. */
  eblOrigin: Vec2 | null;
  /**
   * An offset EBL origin is either fixed to the ground or carried along with own ship (IEC 62388 9.6.3.1).
   * When carried, `eblOriginOffset` is where it lies from own ship, and the origin is moved with her.
   */
  eblOriginCarried: boolean;
  eblOriginOffset: Vec2 | null;
  /** Four parallel index lines: true bearing of the line and its distance from own ship (+ starboard side of that bearing). */
  /**
   * Parallel index lines. `ahead` and `astern` cut the line short: how far it runs from the point abeam
   * of own ship in the line's direction and the other way, NM; null runs it to the edge of the picture.
   */
  pi: { on: boolean; bearing: number; range: number; ahead: number | null; astern: number | null }[];
  /** Radar map: navigation lines drawn by the user, fixed to the ground (NM). */
  navLines: Vec2[][];
  /** World states kept every minute so the instructor can take the exercise back in time. */
  snapshots: { time: number; world: World }[];
  /** Radio messages heard on this display. */
  comms: { t: number; from: string; text: string }[];
  /** Radar map symbols placed by the user, fixed to the ground (NM). */
  navMarks: Vec2[];
  /** Instructor: the track being programmed for a target (points clicked on the picture so far), or null. */
  routeEdit: { targetId: number; points: Vec2[] } | null;
  /** Instructor: draw the programmed tracks of the targets on this display. Never set on a student's display. */
  showRoutes: boolean;
  /** Performance monitor display on. */
  pmOn: boolean;
  /** Heading line temporarily suppressed (while the button is held). */
  hlOff: boolean;
  /** EBL readouts given relative to the ship's head instead of true (IEC 62388 9.6.2.1: both, with the reference shown). */
  eblRelative: boolean;
  /** The heading input has failed: the display is held in unstabilised head-up and bearings are relative only. */
  headingLost: boolean;
  /** AIS reported targets shown on the radar. */
  ais: AisSystem;
  trailMode: TrailMode;
  trailMinutes: number;
  /** Real time (ms since 1970) when the scenario was started: the simulated UTC is this plus the simulated time. */
  startUtcMs: number;
  /** Fixed range rings shown. */
  ringsOn: boolean;
  showShadow: boolean;
  showNames: boolean;
  /** Cursor position on the display, NM from centre, or null. */
  cursor: { x: number; y: number } | null;
  /** The ROC exercise in progress, if any. */
  roc: RocSession | null;
  /** Simulation time to run to at high speed, then pause (the "advance" button). */
  advanceTo: number | null;
  /** Called once when the exercise ends. */
  onRocFinish: (() => void) | null;
  /** ARPA processor. Switched off (not stepped, not drawn) while an ROC exercise runs. */
  arpa: ArpaSystem;
  /** Track selected for the data readout. */
  arpaSelected: number | null;
  /** ARPA exercise in progress, if any (the ARPA keeps running). */
  arpaEx: ArpaExSession | null;
  /** Records the session for the debrief replay, when an exercise is running. */
  recorder: Recorder | null;
  /** Radar pictures recorded for the replay while the recorder runs, and the exercise time of the next one. */
  pictures: PictureFrame[];
  nextPictureAt: number;
  /** Radar transmitter on standby: no picture, and the ARPA is forced to standby. */
  radarStandby: boolean;
}

export const ECHO_LIFETIME_S = 3.2;
export const SNAPSHOT_INTERVAL_SEC = 60;

/**
 * Take the exercise back in time (IMO Model Course 6.10: the instructor may "take the scenario
 * back in time to a particular point" so trainees can try again). Ships, weather and faults go
 * back to how they were; the ARPA starts empty, as after standby, so targets must be re-acquired.
 * Returns the simulation time restored, or null when there is nothing that far back.
 */
export function rewind(app: AppState, seconds: number): number | null {
  if (app.roc) return null;
  const want = app.world.time - seconds;
  const snap = [...app.snapshots].reverse().find((s) => s.time <= want) ?? app.snapshots[0];
  if (!snap || snap.time >= app.world.time) return null;
  const settings = app.arpa.settings;
  app.world = structuredClone(snap.world);
  app.snapshots = app.snapshots.filter((s) => s.time <= snap.time);
  app.arpa = new ArpaSystem(app.world, app.arpa.cfg, settings);
  app.ais = new AisSystem();
  app.arpaSelected = null;
  app.hits = [];
  app.trails.clear();
  recentreTrueMotion(app.world, app.display);
  app.arpaEx?.rewindTo(snap.time);
  app.recorder?.note(app.world, `INSTRUCTOR: exercise taken back to ${Math.floor(snap.time / 60)} min ${Math.round(snap.time % 60)} s.`, true);
  return snap.time;
}
const MAX_HITS = 14000;

export function createApp(scenario: Scenario = SCENARIOS[0]!, tuningOptimum?: number): AppState {
  const world = createWorld(scenario, tuningOptimum ?? 55 + Math.random() * 15);
  return {
    scenario,
    world,
    display: newDisplayState(world),
    trails: new TrailStore(),
    hits: [],
    sweep: 0,
    wall: 0,
    running: true,
    timeScale: 1,
    ebl: { on: false, bearing: 0 },
    vrm: { on: false, range: 3 },
    ebl2: { on: false, bearing: 90 },
    vrm2: { on: false, range: 1 },
    eblOrigin: null,
    eblOriginCarried: false,
    eblOriginOffset: null,
    pi: Array.from({ length: 4 }, () => ({ on: false, bearing: 0, range: 1, ahead: null, astern: null })),
    navLines: [],
    navMarks: [],
    routeEdit: null,
    showRoutes: false,
    snapshots: [],
    comms: [],
    pmOn: false,
    hlOff: false,
    eblRelative: false,
    headingLost: false,
    ais: new AisSystem(),
    trailMode: "off",
    trailMinutes: 6,
    ringsOn: true,
    startUtcMs: Date.now(),
    showShadow: false,
    showNames: false,
    cursor: null,
    roc: null,
    advanceTo: null,
    onRocFinish: null,
    arpa: new ArpaSystem(world),
    arpaSelected: null,
    arpaEx: null,
    recorder: null,
    pictures: [],
    nextPictureAt: 0,
    radarStandby: false,
  };
}

/** Advance the simulation and the antenna by wallDt seconds of real time. */
export function advance(app: AppState, wallDt: number, rng: () => number = Math.random): void {
  const dt = Math.min(Math.max(wallDt, 0), 0.1);
  app.wall += dt;
  const w = app.world;

  const advancing = app.advanceTo !== null;
  if (app.running || advancing) {
    let simDt = dt * (advancing ? 120 : app.timeScale);
    if (advancing && app.advanceTo! - w.time < simDt) simDt = Math.max(0, app.advanceTo! - w.time);
    const steps = Math.max(1, Math.ceil(simDt / 0.5));
    for (let i = 0; i < steps; i++) {
      stepWorld(w, simDt / steps);
      // Speed input of the display's sea stabilisation: the speed set by hand, else the log (nothing when the log has failed).
      const as = app.arpa.settings;
      stepSpeedInput(w, app.display, simDt / steps, as.logMode === "manual" ? as.manualSpeedKn : app.arpa.logFailed ? 0 : logSpeed(w));
      updateTrueMotionOrigin(w, app.display);
      if (app.eblOrigin && app.eblOriginCarried && app.eblOriginOffset) app.eblOrigin = { e: w.own.pos.e + app.eblOriginOffset.e, n: w.own.pos.n + app.eblOriginOffset.n };
      // The radar's power state is in the world (engine/power.ts); off, warming up and standby all mean no picture.
      app.radarStandby = !radarTransmitting(w);
      if (app.radarStandby) app.arpa.settings.standby = true;
      if (!app.roc) app.arpa.step(w, rng);
      app.ais.step(w);
      const lastSnap = app.snapshots[app.snapshots.length - 1];
      if (!app.roc && (!lastSnap || w.time - lastSnap.time >= SNAPSHOT_INTERVAL_SEC)) {
        app.snapshots.push({ time: w.time, world: structuredClone(w) });
        if (app.snapshots.length > 40) app.snapshots.shift();
      }
      app.arpaEx?.step(w, app.arpa, { pi: app.pi, navLines: app.navLines.filter((l) => l.length >= 2).length, pmOn: app.pmOn });
      app.recorder?.sample(w, app.roc ? null : app.arpa);
      app.trails.sample(w, app.display);
      if (app.roc && app.roc.step(w)) {
        app.running = false;
        app.advanceTo = null;
        app.onRocFinish?.();
      }
    }
    if (advancing && app.advanceTo !== null && w.time >= app.advanceTo - 1e-6) {
      app.advanceTo = null;
      app.running = false;
    }
  }

  const dA = app.radarStandby ? 0 : w.radar.rpm * 6 * dt;
  if (dA > 0) {
    for (const h of scanWedge(w, app.sweep, app.sweep + dA, rng)) app.hits.push({ hit: h, born: app.wall });
    app.sweep = (app.sweep + dA) % 360;
  }
  const cutoff = app.wall - ECHO_LIFETIME_S;
  let i = 0;
  while (i < app.hits.length && app.hits[i]!.born < cutoff) i++;
  if (i > 0) app.hits.splice(0, i);
  if (app.hits.length > MAX_HITS) app.hits.splice(0, app.hits.length - MAX_HITS);
}

/** Changing the stabilisation or motion mode invalidates stored trails and recentres the picture. */
export function setDisplayMode(
  app: AppState,
  change: Partial<Pick<DisplayState, "orientation" | "motion" | "stabilisation">>,
): void {
  const d = app.display;
  const motionChanged = change.motion !== undefined && change.motion !== d.motion;
  const stabChanged = change.stabilisation !== undefined && change.stabilisation !== d.stabilisation;
  const orientChanged = change.orientation !== undefined && change.orientation !== d.orientation;
  Object.assign(d, change);
  if (orientChanged && d.orientation === "course-up") d.courseUpRef = measuredHeading(app.world);
  if (motionChanged || stabChanged) {
    app.trails.clear();
    recentreTrueMotion(app.world, d);
  }
}

/** Manual true-motion reset: own ship goes back to the centre of the screen. Only trails of past echoes are dropped. */
export function resetTrueMotion(app: AppState): void {
  recentreTrueMotion(app.world, app.display);
  app.trails.clear();
}

export function resetCourseUp(app: AppState): void {
  app.display.courseUpRef = measuredHeading(app.world);
}

export function setRange(app: AppState, rangeNm: number): void {
  app.world.radar.controls.rangeNm = rangeNm;
  recentreTrueMotion(app.world, app.display);
}
