import { CourseSpeed, Vec2, add, courseSpeedOf, length, rotateVec, scale, sub, velocityOf } from "../core/vec";
import { capacityCautionAt } from "./alerts";
import { CpaResult, computeCpa } from "../core/cpa";
import { relativeVelocity } from "../core/motion";
import { TrialResult, trialManoeuvre } from "../core/trial";
import { fitLinearMotion, fitPositionAt } from "../core/track";
import { inSectorZone } from "../core/zones";
import { World, logSpeed, measuredHeading, ownCogSog, ownGroundVelocity } from "../engine/index";
import { ARPA_PLACEHOLDERS, ArpaConfig, ArpaSettings, defaultArpaSettings } from "./config";
import { ArpaPlot, extractPlots } from "./plots";

export type Stab = "sea" | "ground";
export type TrackState = "tracking" | "lost";
export type TrackQuality = "acquiring" | "prelim" | "steady";

/** One plot kept in a track's window. */
interface TrackPlot {
  /** Seconds. */
  t: number;
  /** Gyro frame, relative to own ship, NM. */
  rel: Vec2;
  /** Position in ARPA's sea frame (own ship dead-reckoned on gyro and log). Ground stabilisation is
   *  derived from this by removing the apparent motion of the designated reference target. */
  refSea: Vec2;
}

export interface TrackEstimate {
  /** Smoothed position relative to own ship now, gyro frame, NM. */
  rel: Vec2;
  /** Relative velocity, knots. */
  relVel: Vec2;
  /** Target velocity in the selected stabilisation frame ("true" vector), knots. */
  trueVel: Vec2;
  trueCS: CourseSpeed;
  relCS: CourseSpeed;
  cpa: CpaResult;
  stab: Stab;
}

export interface Track {
  id: number;
  manual: boolean;
  state: TrackState;
  quality: TrackQuality;
  /** Seconds: time of the first plot (or of the acquisition request for a manual track). */
  acquiredAt: number;
  plots: TrackPlot[];
  missed: number;
  /** When the target was lost, for a lost target that is not held by a warning waiting to be acknowledged. */
  lostAt?: number;
  hits: boolean[];
  fading: boolean;
  dangerous: boolean;
  est: TrackEstimate | null;
  /** Manual acquisition marker, sea frame, until the first echo is found. */
  seedSea: Vec2 | null;
  /** Instructor only: the real target this track is following now, and the first one. */
  truthId: number | null;
  firstTruthId: number | null;
  swaps: number;
  /** Times the adaptive window has dropped the older plots because the target manoeuvred. */
  windowRestarts: number;
  /** Relative velocity when the track was last judged steady (target manoeuvre alarm reference), and when it started to differ. */
  baseRelVel: Vec2 | null;
  devSince: number | null;
  /** Smoothed positions recorded every `pastRecordSec`, for past-position dots. */
  history: { t: number; ref: Vec2; rel: Vec2 }[];
}

export interface SelfTestResult {
  name: string;
  ok: boolean;
  detail: string;
}
export interface SelfTestTarget {
  id: string;
  /** Position relative to own ship (NM) and relative velocity (kn) the test target is built with. */
  rel: Vec2;
  relVel: Vec2;
}

export type AlarmKind = "cpa" | "lost" | "new" | "guard" | "capacity" | "capacity-near" | "groundref" | "action" | "order" | "malfunction" | "course" | "trial" | "anchor";

export interface ArpaAlarm {
  key: string;
  kind: AlarmKind;
  trackId?: number;
  text: string;
  raisedAt: number;
  acked: boolean;
  /** Where the echo that caused a guard-zone warning was, relative to own ship (gyro frame), NM. */
  rel?: Vec2;
}

export interface ArpaEvent {
  time: number;
  text: string;
  /** True for events only the instructor should see (they reveal the truth). */
  instructor: boolean;
}

interface Candidate {
  id: number;
  plots: TrackPlot[];
  truthIds: number[];
  hits: number;
  misses: number;
  alarmed: boolean;
}

/** How long a lost target's symbol stays when the lost target warning is switched off, seconds (this simulator's choice). */
export const LOST_SYMBOL_SEC = 60;

export interface TrialRow {
  trackId: number;
  result: TrialResult;
  dangerous: boolean;
}

/**
 * The ARPA processor. It never reads the targets' real positions or velocities: it only sees
 * plots from `extractPlots` and own ship's sensors (gyro, log, GNSS). Everything it shows is
 * an estimate, with the delays and errors that come with that.
 */
export class ArpaSystem {
  readonly cfg: ArpaConfig;
  settings: ArpaSettings;
  tracks: Track[] = [];
  alarms: ArpaAlarm[] = [];
  events: ArpaEvent[] = [];
  /** Short message for the operator (for example "No echo at the acquisition point"). */
  message: { text: string; time: number } | null = null;
  private candidates: Candidate[] = [];
  private ownSea: Vec2 = { e: 0, n: 0 };
  /** Id of the track designated as the fixed ground reference, or null. */
  groundRefId: number | null = null;
  /** When a poor-reference alarm started (seconds), for the automatic cancellation. */
  private poorRefSince: number | null = null;
  /** Trial manoeuvre bookkeeping: when the present trial setting was started, and whether TIME FOR ACTION was raised. */
  /** Instructor fault: the gyro compass has failed. Always detected by the ARPA (alarm), and the tracks are lost. */
  gyroFailed = false;
  /** Instructor fault: the speed log gives no signal. The ARPA indicates the absent input (A.823(19) 3.9.2). */
  logFailed = false;
  /** Number of alarms the operator has acknowledged (for exercise records). */
  ackCount = 0;
  /** Number of self-tests run (for exercise records). */
  testCount = 0;
  /** The ARPA self-test in progress or just finished, or null. */
  test: { startedAt: number; results: SelfTestResult[]; targets: SelfTestTarget[] } | null = null;
  private trialSig = "";
  private trialStart = 0;
  private trialActionRaised = false;
  private lastTime: number;
  private nextScanAt: number;
  private nextId = 1;
  private nextCand = 1;

  constructor(w: World, cfg: ArpaConfig = ARPA_PLACEHOLDERS, settings?: ArpaSettings) {
    this.cfg = cfg;
    this.settings = settings ?? defaultArpaSettings(w.own.heading, w.own.speedThroughWater);
    this.lastTime = w.time;
    this.nextScanAt = w.time;
  }

  scanPeriod(w: World): number {
    return 60 / w.radar.rpm;
  }

  /**
   * Velocity of the ground in ARPA's sea frame, from the apparent motion of the designated
   * reference target (a fixed object appears to move at the reverse of own ship's set and drift).
   * Null when no usable reference exists.
   */
  groundRefVelocity(): Vec2 | null {
    // With a ground-referenced speed input the own-ship velocity is already over the ground.
    if (!this.waterInput()) return null;
    if (this.groundRefId === null) return null;
    const t = this.tracks.find((x) => x.id === this.groundRefId);
    if (!t || t.state !== "tracking" || t.plots.length < 2 || t.quality === "acquiring") return null;
    const fit = fitLinearMotion(t.plots.map((p) => ({ t: p.t / 3600, p: p.refSea })));
    return fit ? fit.vel : null;
  }

  /** Stabilisation and its input, as shown to the operator (A.823(19) 3.11.4). */
  stabLabel(): string {
    const m = this.settings.logMode;
    if (m === "gnss") return "GND STAB (EPFS)";
    if (m === "bottom") return "GND STAB (BT LOG)";
    return this.effectiveStab() === "ground" ? `GND STAB (REF TGT ${this.groundRefId})` : m === "manual" ? "SEA STAB (MAN SPD)" : "SEA STAB (LOG)";
  }

  /** True when the speed input is through the water (log or a speed set by hand). */
  private waterInput(): boolean {
    return this.settings.logMode === "water" || this.settings.logMode === "manual";
  }

  /** The stabilisation actually in use: ground only while a usable reference exists. */
  effectiveStab(): Stab {
    if (!this.waterInput()) return "ground";
    return this.settings.stabilisation === "ground" && this.groundRefVelocity() ? "ground" : "sea";
  }

  /**
   * Own ship velocity as ARPA knows it. Sea: gyro and log (through the water). Ground: the same
   * minus the reference target's apparent velocity (over the ground).
   */
  ownVelocity(w: World, stab: Stab = this.effectiveStab()): Vec2 {
    let sea: Vec2;
    if (this.settings.logMode === "gnss") {
      // EPFS (GNSS): course and speed over the ground, independent of gyro and log.
      sea = ownGroundVelocity(w);
    } else if (this.settings.logMode === "manual") {
      // Speed set by hand: whatever the operator entered, along the gyro heading. A wrong value
      // gives wrong true vectors and true course/speed; relative data and CPA/TCPA are unaffected.
      sea = velocityOf({ course: measuredHeading(w), speed: this.settings.manualSpeedKn });
    } else if (this.logFailed) {
      // No speed input: the ARPA has only the heading. True vectors are not valid.
      sea = { e: 0, n: 0 };
    } else if (this.settings.logMode === "bottom") {
      // Doppler bottom-track log: the velocity is over the GROUND, but still read through the gyro
      // (so a gyro error rotates it) and the log error is along the heading.
      const along = velocityOf({ course: measuredHeading(w), speed: w.sensors.logErrorKn });
      sea = add(rotateVec(ownGroundVelocity(w), w.sensors.gyroErrorDeg), along);
    } else {
      sea = velocityOf({ course: measuredHeading(w), speed: logSpeed(w) });
    }
    if (stab === "sea") return sea;
    const g = this.groundRefVelocity();
    return g ? sub(sea, g) : sea;
  }

  ownCourseSpeed(w: World, stab: Stab = this.effectiveStab()): CourseSpeed {
    return courseSpeedOf(this.ownVelocity(w, stab));
  }

  /** Designate a track as the fixed ground reference (operator action). Ground stabilisation starts. */
  designateGroundRef(w: World, id: number): boolean {
    const t = this.tracks.find((x) => x.id === id);
    if (!t || t.state !== "tracking") {
      this.say(w, "Select a tracked target to use as ground reference.");
      return false;
    }
    this.groundRefId = id;
    this.poorRefSince = null;
    this.settings.stabilisation = "ground";
    this.alarms = this.alarms.filter((a) => a.kind !== "groundref");
    this.event(w, `Ground stabilisation: target ${id} designated as fixed reference.`, false);
    return true;
  }

  /** Release the ground reference and return to sea stabilisation. */
  releaseGroundRef(w: World, why = "released"): void {
    if (this.groundRefId === null && this.settings.stabilisation === "sea") return;
    this.groundRefId = null;
    this.poorRefSince = null;
    this.settings.stabilisation = "sea";
    this.alarms = this.alarms.filter((a) => a.kind !== "groundref");
    this.event(w, `Ground stabilisation ${why}; sea stabilisation.`, false);
  }

  /** Call after every world step. */
  step(w: World, rng: () => number = Math.random): void {
    const dtH = (w.time - this.lastTime) / 3600;
    if (dtH > 0) {
      this.ownSea = add(this.ownSea, scale(this.ownVelocity(w, "sea"), dtH));
    }
    this.lastTime = w.time;
    if (this.settings.standby) {
      // Standby: nothing is processed or remembered. Coming back to ON starts from an empty picture.
      if (this.tracks.length > 0 || this.alarms.length > 0 || this.candidates.length > 0) {
        this.tracks = [];
        this.candidates = [];
        this.alarms = [];
        this.groundRefId = null;
        this.settings.stabilisation = "sea";
        this.test = null;
        this.event(w, "ARPA in standby: all targets cleared.", false);
      }
      this.nextScanAt = w.time;
      return;
    }
    if (w.time + 1e-9 >= this.nextScanAt) {
      if (this.gyroFailed) {
        // No stabilised bearings: nothing can be associated, so every track coasts and is then lost.
        for (const t of this.tracks) if (t.state === "tracking") this.miss(w, t);
      } else {
        this.scan(w, rng);
      }
      this.nextScanAt = Math.max(this.nextScanAt + this.scanPeriod(w), w.time + 0.5 * this.scanPeriod(w));
    }
    this.update(w);
  }

  // ---------------------------------------------------------------- operator actions

  /** Manual acquisition at a position relative to own ship, in the gyro frame (as read off the screen). */
  acquire(w: World, rel: Vec2): Track | null {
    const near = this.trackNear(w, rel, this.cfg.manualAcqGateNm);
    if (near && near.state === "tracking") {
      this.say(w, `Target ${near.id} is already tracked there.`);
      return null;
    }
    if (this.activeCount() >= this.cfg.maxTracks) {
      this.raise(w, "capacity", "capacity", `Track capacity full (${this.cfg.maxTracks}).`);
      return null;
    }
    const t = this.newTrack(w, true, []);
    t.seedSea = add(this.ownSea, rel);
    this.event(w, `Manual acquisition of target ${t.id}.`, false);
    return t;
  }

  cancel(w: World, id: number): void {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    this.tracks = this.tracks.filter((x) => x.id !== id);
    this.alarms = this.alarms.filter((a) => a.trackId !== id);
    this.event(w, `Target ${id} cancelled.`, false);
  }

  cancelAll(w: World): void {
    for (const t of [...this.tracks]) this.cancel(w, t.id);
  }

  ack(w: World, key: string): void {
    const a = this.alarms.find((x) => x.key === key);
    if (!a) return;
    if (!a.acked) this.ackCount++;
    a.acked = true;
    if (a.kind === "lost" && a.trackId !== undefined) {
      this.tracks = this.tracks.filter((x) => x.id !== a.trackId);
      this.alarms = this.alarms.filter((x) => x !== a);
      this.event(w, `Lost target ${a.trackId} acknowledged and removed.`, false);
    } else if (a.kind === "capacity" || a.kind === "malfunction") {
      // Stays (acknowledged) until the cause is cleared: a target dropped, or the fault removed.
    } else if (a.kind === "course" && a.trackId !== undefined) {
      const t = this.tracks.find((x) => x.id === a.trackId);
      if (t) {
        t.baseRelVel = null;
        t.devSince = null;
      }
      this.alarms = this.alarms.filter((x) => x !== a);
    } else if (a.kind !== "cpa") {
      this.alarms = this.alarms.filter((x) => x !== a);
    }
  }

  ackAll(w: World): void {
    for (const a of [...this.alarms]) this.ack(w, a.key);
  }

  /**
   * ARPA self-test. The ARPA checks its own processing against test targets built with known
   * motion (hand-worked values, not read from the simulation), and checks its inputs. Not a
   * hardware diagnostic: the faults it can find are the ones this simulator can produce.
   */
  runSelfTest(w: World): void {
    if (this.settings.standby) {
      this.say(w, "ARPA is in standby: switch it on before testing.");
      return;
    }
    const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;
    // Test target A: 5 NM dead ahead, closing at 10 kn on a steady bearing: CPA 0, TCPA 30 min.
    // Test target B: (4, 3) NM, relative velocity (-8, 0) kn: passes 3 NM off after 30 min.
    const targets: SelfTestTarget[] = [
      { id: "T1", rel: { e: 0, n: 5 }, relVel: { e: 0, n: -10 } },
      { id: "T2", rel: { e: 4, n: 3 }, relVel: { e: -8, n: 0 } },
    ];
    const expect = [{ cpa: 0, tcpa: 30 }, { cpa: 3, tcpa: 30 }];
    const results: SelfTestResult[] = [];
    targets.forEach((tg, i) => {
      // Feed three exact plots one 10-second step apart through the same fit the tracker uses.
      const pts = [0, 1, 2].map((k) => ({ t: (k * 10) / 3600, p: add(tg.rel, scale(tg.relVel, (k * 10) / 3600)) }));
      const fit = fitLinearMotion(pts);
      const now = fit ? fitPositionAt(fit, pts[2]!.t) : tg.rel;
      const c = fit ? computeCpa(now, fit.vel) : null;
      const e = expect[i]!;
      const ok = !!c && near(c.cpa, e.cpa, 0.01) && c.tcpaMinutes !== null && near(c.tcpaMinutes + 20 / 60, e.tcpa, 0.05);
      results.push({
        name: `Tracking and CPA/TCPA ${tg.id}`,
        ok,
        detail: c ? `CPA ${c.cpa.toFixed(2)} NM, TCPA ${(c.tcpaMinutes! + 20 / 60).toFixed(1)} min (expected ${e.cpa} NM, ${e.tcpa} min)` : "no result",
      });
    });
    results.push({ name: "Gyro heading input", ok: !this.gyroFailed, detail: this.gyroFailed ? "NO GYRO SIGNAL" : "signal present" });
    const logOk = Number.isFinite(logSpeed(w));
    results.push({ name: "Speed log input", ok: logOk, detail: logOk ? `${logSpeed(w).toFixed(1)} kn` : "NO LOG SIGNAL" });
    const mem = this.activeCount() <= this.cfg.maxTracks;
    results.push({ name: "Target memory", ok: mem, detail: `${this.activeCount()} of ${this.cfg.maxTracks} in use` });
    this.test = { startedAt: w.time, results, targets };
    this.testCount++;
    const failed = results.filter((r) => !r.ok);
    this.event(w, failed.length === 0 ? "ARPA self-test passed." : `ARPA self-test FAILED: ${failed.map((r) => r.name).join(", ")}.`, false);
  }

  /**
   * Past positions of a track for display: the last `points` dots, `intervalMin` apart, as offsets
   * from own ship's CURRENT position (gyro frame). Relative: where the target was relative to own
   * ship at the time. True: where the target was in the water (or over the ground when ground
   * stabilised), seen from own ship now.
   */
  pastPositions(w: World, t: Track): Vec2[] {
    const p = this.settings.past;
    if (p.mode === "off" || t.history.length === 0) return [];
    const g = this.effectiveStab() === "ground" ? this.groundRefVelocity() : null;
    const out: Vec2[] = [];
    for (let k = 1; k <= Math.min(p.points, this.cfg.pastMaxPoints); k++) {
      const want = w.time - k * p.intervalMin * 60;
      let best = t.history[0]!;
      for (const h of t.history) if (Math.abs(h.t - want) < Math.abs(best.t - want)) best = h;
      if (Math.abs(best.t - want) > this.cfg.pastRecordSec) break; // no data that far back
      if (p.mode === "relative") out.push(best.rel);
      else {
        const shift = g ? scale(g, (w.time - best.t) / 3600) : { e: 0, n: 0 };
        out.push(add(sub(best.ref, this.ownSea), shift));
      }
    }
    return out;
  }

  /** The operator pressed a key out of sequence (for example "select" with nothing there). Beep and lamp. */
  wrongOrder(w: World, text: string): void {
    this.raise(w, `order-${Math.floor(w.time)}`, "order", `WRONG ORDER: ${text}`);
  }

  /** Nearest track to a gyro-frame relative position, within `radiusNm`. */
  trackNear(w: World, rel: Vec2, radiusNm: number): Track | null {
    let best: Track | null = null;
    let bestD = radiusNm;
    for (const t of this.tracks) {
      const d = length(sub(this.predictRel(t, w.time), rel));
      if (d <= bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** Minutes of the trial delay still to run (counts down from the moment the trial was set). */
  trialRemainingMin(w: World): number {
    const tr = this.settings.trial;
    if (!tr.on) return tr.delayMinutes;
    return Math.max(0, tr.delayMinutes - (w.time - this.trialStart) / 60);
  }

  /** Trial manoeuvre for every track with a vector, using ARPA's own estimates (core trialManoeuvre). */
  trial(w: World): TrialRow[] {
    const tr = this.settings.trial;
    const remaining = this.trialRemainingMin(w);
    const own = this.ownCourseSpeed(w);
    const rows: TrialRow[] = [];
    for (const t of this.tracks) {
      if (!t.est || t.quality === "acquiring" || t.state === "lost") continue;
      const result = trialManoeuvre(t.est.rel, own, t.est.trueCS, { course: tr.course, speed: tr.speed, delayMinutes: remaining });
      const dangerous = result.cpa < this.settings.cpaLimitNm && result.tcpaMinutes >= 0 && result.tcpaMinutes <= this.settings.tcpaLimitMin;
      rows.push({ trackId: t.id, result, dangerous });
    }
    return rows;
  }

  /** Instructor only: the real CPA/TCPA and true course/speed of the target a track is following. */
  truthOf(w: World, t: Track): { name: string; cpa: CpaResult; trueCS: CourseSpeed } | null {
    const tgt = w.targets.find((x) => x.id === t.truthId);
    if (!tgt) return null;
    const tcs = { course: tgt.course, speed: tgt.speed };
    return {
      name: tgt.name,
      cpa: computeCpa(sub(tgt.pos, w.own.pos), relativeVelocity(ownCogSog(w), tcs)),
      trueCS: tcs,
    };
  }

  /** Position of a track relative to own ship, gyro frame: the estimate, or the last plot, or the marker. */
  predictRel(t: Track, time: number): Vec2 {
    const pts = t.plots.map((p) => ({ t: p.t / 3600, p: p.refSea }));
    const fit = pts.length >= 2 ? fitLinearMotion(pts) : null;
    if (fit) return sub(fitPositionAt(fit, time / 3600), this.ownSea);
    const last = t.plots[t.plots.length - 1];
    if (last) return sub(last.refSea, this.ownSea);
    return t.seedSea ? sub(t.seedSea, this.ownSea) : { e: 0, n: 0 };
  }

  activeCount(): number {
    return this.tracks.filter((t) => t.state === "tracking").length;
  }

  // ---------------------------------------------------------------- processing

  private scan(w: World, rng: () => number): void {
    const now = w.time;
    const g = w.sensors.gyroErrorDeg;
    const heading = measuredHeading(w);
    const s = this.settings;
    const predicted = new Map<number, Vec2>();
    for (const t of this.tracks) predicted.set(t.id, this.predictRel(t, now));
    const preds = [...predicted.values()];
    const wantLand = (relTrue: Vec2): boolean => {
      const rel = rotateVec(relTrue, g);
      if (s.guardZones.some((z) => z.on && inSectorZone(rel, heading, z))) return true;
      return preds.some((p) => length(sub(p, rel)) < 0.6);
    };
    const plots = extractPlots(w, this.cfg, rng, wantLand);
    const uses = plots.map(() => 0);
    const capacity = (p: ArpaPlot): number => Math.max(1, p.truthIds.length);
    const toTrackPlot = (p: ArpaPlot): TrackPlot => ({
      t: now,
      rel: p.rel,
      refSea: add(this.ownSea, p.rel),
    });

    // 1. Existing tracks take the nearest free plot inside their gate.
    for (const t of this.tracks) {
      if (t.state === "lost") continue;
      const pr = predicted.get(t.id)!;
      const range = length(pr);
      const noise = range * Math.sin((3 * this.cfg.bearingNoiseDeg * Math.PI) / 180);
      const gate = t.plots.length === 0 ? this.cfg.manualAcqGateNm : this.cfg.gateBaseNm + noise + t.missed * this.cfg.gateGrowPerMissNm;
      let best = -1;
      let bestD = gate;
      plots.forEach((p, i) => {
        if (uses[i]! >= capacity(p)) return;
        const d = length(sub(p.rel, pr));
        if (d <= bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        const p = plots[best]!;
        uses[best]!++;
        this.associate(w, t, p, toTrackPlot(p));
      } else {
        this.miss(w, t);
      }
    }
    this.tracks = this.tracks.filter((t) => !(t.plots.length === 0 && t.missed >= this.cfg.manualAcqScans && this.dropManual(w, t)));

    // 2. Free plots inside a guard zone and outside every exclusion area feed automatic acquisition.
    const seen = new Set<number>();
    plots.forEach((p, i) => {
      if (uses[i]! > 0) return;
      if (!s.guardZones.some((z) => z.on && inSectorZone(p.rel, heading, z))) return;
      if (s.exclusionZones.some((z) => z.on && inSectorZone(p.rel, heading, z))) return;
      const tp = toTrackPlot(p);
      let best: Candidate | null = null;
      let bestD = this.cfg.candidateGateNm;
      for (const c of this.candidates) {
        if (seen.has(c.id)) continue;
        const d = length(sub(c.plots[c.plots.length - 1]!.refSea, tp.refSea));
        if (d <= bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) {
        best.plots.push(tp);
        best.hits++;
        best.misses = 0;
        best.truthIds = p.truthIds;
        seen.add(best.id);
      } else if (this.candidates.length < this.cfg.maxCandidates) {
        const c: Candidate = { id: this.nextCand++, plots: [tp], truthIds: p.truthIds, hits: 1, misses: 0, alarmed: false };
        this.candidates.push(c);
        seen.add(c.id);
      }
    });
    for (const c of this.candidates) if (!seen.has(c.id)) c.misses++;
    this.candidates = this.candidates.filter((c) => c.misses <= this.cfg.candidateMaxMisses);

    // 3. Confirmed candidates: acquire automatically, or just sound the guard zone alarm.
    for (const c of [...this.candidates]) {
      if (c.hits < this.cfg.autoConfirmHits) continue;
      if (s.autoAcquire) {
        this.candidates = this.candidates.filter((x) => x !== c);
        if (this.activeCount() >= this.cfg.maxTracks) {
          this.raise(w, "capacity", "capacity", `Track capacity full (${this.cfg.maxTracks}). New target not acquired.`);
          continue;
        }
        const t = this.newTrack(w, false, c.plots);
        t.truthId = c.truthIds[0] ?? null;
        t.firstTruthId = t.truthId;
        this.raise(w, `new-${t.id}`, "new", `New target ${t.id} acquired in guard zone.`, t.id);
        this.event(w, `Target ${t.id} acquired automatically.`, false);
        this.event(w, `Target ${t.id} is ${this.truthName(w, t.truthId)}.`, true);
      } else if (!c.alarmed) {
        c.alarmed = true;
        this.raise(w, `guard-${c.id}`, "guard", "Echo entering guard zone.");
        const ga = this.alarms.find((x) => x.key === `guard-${c.id}`);
        if (ga) ga.rel = c.plots[c.plots.length - 1]!.rel;
        this.event(w, `Guard zone: ${this.truthName(w, c.truthIds[0] ?? null)}.`, true);
      }
    }
    for (const t of this.tracks) {
      while (t.plots.length > 2 && t.plots[0]!.t < now - this.cfg.windowSec) t.plots.shift();
      this.restartOnManoeuvre(t, now);
    }
  }

  /**
   * Adaptive window (see `manoeuvreTestSec` in the config): when the newest plots have left the line
   * fitted to the older ones by more than the plot noise can explain, the target has changed course
   * or speed. The older plots are dropped so that the estimate follows the new motion.
   */
  private restartOnManoeuvre(t: Track, now: number): void {
    if (t.state !== "tracking") return;
    const cut = now - this.cfg.manoeuvreTestSec;
    const older = t.plots.filter((p) => p.t < cut);
    const recent = t.plots.filter((p) => p.t >= cut);
    if (older.length < 4 || recent.length < 3) return;
    if (older[older.length - 1]!.t - older[0]!.t < this.cfg.manoeuvreTestSec) return;
    const fit = fitLinearMotion(older.map((p) => ({ t: p.t / 3600, p: p.refSea })));
    if (!fit) return;
    let e = 0;
    let n = 0;
    for (const p of recent) {
      const d = sub(p.refSea, fitPositionAt(fit, p.t / 3600));
      e += d.e;
      n += d.n;
    }
    const meanOff = Math.hypot(e, n) / recent.length;
    // Expected spread of that mean when the target has not manoeuvred: the noise of the recent plots'
    // mean, plus the error of the older line extrapolated to the recent plots' mean time
    // (least squares: sigma² (1/n + (t - t̄)² / Sxx)).
    const range = length(recent[recent.length - 1]!.rel);
    const sigmaPos = Math.hypot(this.cfg.rangeNoiseNm, range * Math.sin((this.cfg.bearingNoiseDeg * Math.PI) / 180), this.cfg.scintillationNm);
    const tOld = older.reduce((s, p) => s + p.t, 0) / older.length;
    const tNew = recent.reduce((s, p) => s + p.t, 0) / recent.length;
    const sxx = older.reduce((s, p) => s + (p.t - tOld) ** 2, 0);
    const spread = sigmaPos * Math.sqrt(1 / recent.length + 1 / older.length + (tNew - tOld) ** 2 / sxx);
    const limit = Math.max(this.cfg.manoeuvreMinNm, this.cfg.manoeuvreSigmas * spread);
    if (!(meanOff > limit)) return;
    t.plots = recent;
    t.windowRestarts++;
  }

  private associate(w: World, t: Track, p: ArpaPlot, tp: TrackPlot): void {
    const first = t.plots.length === 0;
    t.plots.push(tp);
    t.seedSea = null;
    t.missed = 0;
    t.hits.push(true);
    if (first) {
      t.acquiredAt = w.time;
      t.truthId = p.truthIds[0] ?? null;
      t.firstTruthId = t.truthId;
      this.event(w, `Target ${t.id} is ${this.truthName(w, t.truthId)}.`, true);
      return;
    }
    if (t.truthId !== null && p.truthIds.includes(t.truthId)) return;
    if (t.truthId === null && p.truthIds.length === 0) return;
    const was = this.truthName(w, t.truthId);
    t.truthId = p.truthIds[0] ?? null;
    t.swaps++;
    this.event(w, `TARGET SWAP: track ${t.id} moved from ${was} to ${this.truthName(w, t.truthId)}.`, true);
  }

  private miss(w: World, t: Track): void {
    t.missed++;
    t.hits.push(false);
    if (t.plots.length > 0 && t.state === "tracking" && t.missed >= this.cfg.lostAfterMissedScans) {
      t.state = "lost";
      t.dangerous = false;
      this.alarms = this.alarms.filter((a) => a.key !== `cpa-${t.id}`);
      if (this.settings.lostWarning) this.raise(w, `lost-${t.id}`, "lost", `Target ${t.id} LOST.`, t.id);
      else t.lostAt = w.time;
      this.event(w, `Target ${t.id} lost.`, false);
    }
  }

  private dropManual(w: World, t: Track): boolean {
    this.say(w, `No echo found where target ${t.id} was acquired. Acquisition cancelled.`);
    this.event(w, `Manual acquisition ${t.id} failed: no echo.`, false);
    return true;
  }

  private update(w: World): void {
    const s = this.settings;
    if (this.test && w.time - this.test.startedAt > this.cfg.testDurationSec) this.test = null;
    this.checkMalfunction(w);
    this.checkGroundRef(w);
    this.checkTrial(w);
    this.checkAnchorWatch(w);
    this.checkCapacity(w);
    const stab = this.effectiveStab();
    for (const t of this.tracks) {
      while (t.hits.length > this.cfg.fadingScans) t.hits.shift();
      const ratio = t.hits.filter(Boolean).length / Math.max(1, t.hits.length);
      t.fading = t.state === "tracking" && t.hits.length >= this.cfg.fadingScans && ratio < this.cfg.fadingHitRatio;
      t.est = this.estimate(w, t, stab);
      const age = w.time - t.acquiredAt;
      t.quality = t.plots.length < 2 || age < this.cfg.vectorAfterSec ? "acquiring" : age < this.cfg.steadyAfterSec ? "prelim" : "steady";

      this.checkManoeuvre(w, t);
      if (t.state === "tracking" && t.est && t.quality !== "acquiring") {
        const last = t.history[t.history.length - 1];
        if (!last || w.time - last.t >= this.cfg.pastRecordSec - 1e-6) {
          t.history.push({ t: w.time, ref: add(this.ownSea, t.est.rel), rel: t.est.rel });
          while (t.history.length > 0 && t.history[0]!.t < w.time - 3700) t.history.shift();
        }
      }
      const key = `cpa-${t.id}`;
      const c = t.est?.cpa;
      t.dangerous =
        t.state === "tracking" &&
        t.quality !== "acquiring" &&
        !!c &&
        c.tcpaMinutes !== null &&
        c.tcpaMinutes >= 0 &&
        c.tcpaMinutes <= s.tcpaLimitMin &&
        c.cpa < s.cpaLimitNm;
      if (t.dangerous) this.raise(w, key, "cpa", `DANGEROUS TARGET ${t.id}: CPA ${c!.cpa.toFixed(2)} NM in ${c!.tcpaMinutes!.toFixed(1)} min.`, t.id);
      else this.alarms = this.alarms.filter((a) => a.key !== key);
    }
  }

  /**
   * The trial delay counts down while the trial is left on. When it reaches zero a TIME FOR ACTION
   * alarm sounds once: the trial manoeuvre point has been reached (the real ship has not turned).
   */
  private checkTrial(w: World): void {
    this.checkTrialAlarm(w);
    const tr = this.settings.trial;
    const sig = tr.on ? `${tr.course}|${tr.speed}|${tr.delayMinutes}` : "";
    if (sig !== this.trialSig) {
      this.trialSig = sig;
      this.trialStart = w.time;
      this.trialActionRaised = false;
      this.alarms = this.alarms.filter((a) => a.kind !== "action");
    }
    if (tr.on && tr.delayMinutes > 0 && !this.trialActionRaised && this.trialRemainingMin(w) <= 0) {
      this.trialActionRaised = true;
      this.raise(w, "action", "action", "TIME FOR ACTION: the trial manoeuvre delay has elapsed. Trial is still on.");
    }
  }

  /**
   * Trial alarm (Bole and Dineley 5.2.8): like the CPA/TCPA alarm, but for the manoeuvre being
   * tried. While the trial is on, a warning names each target that would pass inside the limits
   * if the trial manoeuvre were made. It goes when the trial is changed to one that clears the
   * target, or is switched off.
   */
  private checkTrialAlarm(w: World): void {
    const rows = this.settings.trial.on ? this.trial(w).filter((r) => r.dangerous) : [];
    const keys = new Set(rows.map((r) => `trial-${r.trackId}`));
    this.alarms = this.alarms.filter((a) => a.kind !== "trial" || keys.has(a.key));
    for (const r of rows) {
      this.raise(w, `trial-${r.trackId}`, "trial", `TRIAL: target ${r.trackId} would pass inside the limits (CPA ${r.result.cpa.toFixed(2)} NM in ${r.result.tcpaMinutes.toFixed(1)} min).`, r.trackId);
    }
  }

  /**
   * Caution when the target capacity is about to be exceeded (IEC 62388 11.3.5.1: at a nominal 95%,
   * so at 19 of 20). A caution is not acknowledged; it goes when targets are dropped. The warning
   * that the capacity HAS been exceeded is raised when one more target is asked for.
   */
  private checkCapacity(w: World): void {
    // With the lost target warning switched off there is nothing to acknowledge, so the lost target
    // symbol is shown for a minute at the last position and the track is then dropped.
    this.tracks = this.tracks.filter((t) => !(t.state === "lost" && t.lostAt !== undefined && w.time - t.lostAt > LOST_SYMBOL_SEC));
    const n = this.activeCount();
    if (n >= capacityCautionAt(this.cfg.maxTracks)) {
      this.raise(w, "capacity-near", "capacity-near", `Target capacity nearly full: ${n} of ${this.cfg.maxTracks} tracked.`);
    } else {
      this.alarms = this.alarms.filter((a) => a.kind !== "capacity-near");
    }
  }

  /** Position of the anchor watch target when it was marked, relative to own ship, gyro frame, NM. */
  private anchorMark: Vec2 | null = null;

  /**
   * Start the anchor watch on a tracked target that the observer knows to be stationary (a small
   * isolated mark, for example). Returns false, with a message, when the target has no data yet.
   */
  setAnchorWatch(w: World, trackId: number, limitNm: number): boolean {
    const t = this.tracks.find((x) => x.id === trackId);
    if (!t || !t.est || t.state === "lost" || t.quality === "acquiring") {
      this.say(w, "Anchor watch: select a target that is being tracked first.");
      return false;
    }
    this.settings.anchorWatch = { trackId, limitNm: Math.max(0.01, limitNm) };
    this.anchorMark = { ...t.est.rel };
    this.alarms = this.alarms.filter((a) => a.kind !== "anchor");
    this.event(w, `Anchor watch set on target ${trackId}: warning at ${this.settings.anchorWatch.limitNm.toFixed(2)} NM.`, false);
    return true;
  }

  clearAnchorWatch(w: World): void {
    if (this.settings.anchorWatch.trackId !== null) this.event(w, "Anchor watch off.", false);
    this.settings.anchorWatch = { ...this.settings.anchorWatch, trackId: null };
    this.anchorMark = null;
    this.alarms = this.alarms.filter((a) => a.kind !== "anchor");
  }

  /** How far the anchor watch target has moved from its marked position, NM, or null when the watch is off or the target has no data. */
  anchorWatchMovedNm(): number | null {
    const id = this.settings.anchorWatch.trackId;
    const t = id === null ? undefined : this.tracks.find((x) => x.id === id);
    if (!t || !t.est || !this.anchorMark) return null;
    return length(sub(t.est.rel, this.anchorMark));
  }

  private checkAnchorWatch(w: World): void {
    const aw = this.settings.anchorWatch;
    if (aw.trackId === null) return;
    const t = this.tracks.find((x) => x.id === aw.trackId);
    if (!t || t.state === "lost") {
      this.raise(w, "anchor", "anchor", `ANCHOR WATCH: target ${aw.trackId} is no longer tracked. The anchor watch is not working.`);
      return;
    }
    const moved = this.anchorWatchMovedNm();
    if (moved !== null && moved > aw.limitNm) {
      this.raise(w, "anchor", "anchor", `ANCHOR WATCH: target ${aw.trackId} has moved ${moved.toFixed(2)} NM from its marked position. Own ship or the target may be dragging.`, aw.trackId);
    }
  }

  private checkMalfunction(w: World): void {
    const has = this.alarms.some((a) => a.key === "malfunction");
    if (this.gyroFailed && !has) this.raise(w, "malfunction", "malfunction", "EQUIPMENT MALFUNCTION: gyro compass failure. ARPA data not valid.");
    if (!this.gyroFailed && has) this.alarms = this.alarms.filter((a) => a.key !== "malfunction");
    const logAbsent = this.logFailed && this.settings.logMode !== "gnss" && this.settings.logMode !== "manual";
    const hasLog = this.alarms.some((a) => a.key === "logfail");
    if (logAbsent && !hasLog) this.raise(w, "logfail", "malfunction", "SPEED LOG INPUT ABSENT: true vectors and true course/speed are not valid. Relative data and CPA/TCPA remain valid.");
    if (!logAbsent && hasLog) this.alarms = this.alarms.filter((a) => a.key !== "logfail");
    // Memory full stays on until a target has been dropped.
    if (this.activeCount() < this.cfg.maxTracks) this.alarms = this.alarms.filter((a) => a.kind !== "capacity");
  }

  /** Target manoeuvre alarm: the settled relative velocity has changed by more than the threshold for long enough. */
  private checkManoeuvre(w: World, t: Track): void {
    if (t.state !== "tracking" || t.quality !== "steady" || !t.est) return;
    if (!t.baseRelVel) {
      t.baseRelVel = t.est.relVel;
      return;
    }
    const dev = length(sub(t.est.relVel, t.baseRelVel));
    // Expected noise of a velocity estimate at this range (least squares over the window), so that
    // plot noise on a distant steady target does not raise the alarm.
    const range = length(t.est.rel);
    const sigmaPos = Math.hypot(this.cfg.rangeNoiseNm, range * Math.sin((this.cfg.bearingNoiseDeg * Math.PI) / 180), this.cfg.scintillationNm);
    const n = Math.max(2, t.plots.length);
    // Over the plots actually in the window: shorter after the adaptive window has dropped old plots.
    const span = Math.max(this.cfg.manoeuvreTestSec, t.plots[t.plots.length - 1]!.t - t.plots[0]!.t);
    const sigmaVel = (sigmaPos * Math.sqrt(12 / n)) / (span / 3600);
    if (dev <= Math.max(this.cfg.courseChangeKn, this.cfg.courseChangeNoiseFactor * sigmaVel)) {
      t.devSince = null;
      return;
    }
    if (t.devSince === null) t.devSince = w.time;
    if (w.time - t.devSince >= this.cfg.courseChangeSec) {
      this.raise(w, `course-${t.id}`, "course", `Target ${t.id} has changed course or speed.`, t.id);
    }
  }

  /** Poor ground reference alarm; ground stabilisation is cancelled if the alarm is not acknowledged in time. */
  private checkGroundRef(w: World): void {
    if (this.groundRefId === null) return;
    const t = this.tracks.find((x) => x.id === this.groundRefId);
    const poor = !t || t.state !== "tracking" || t.fading;
    if (!poor) {
      this.poorRefSince = null;
      this.alarms = this.alarms.filter((a) => a.kind !== "groundref");
      return;
    }
    if (this.poorRefSince === null) this.poorRefSince = w.time;
    this.raise(w, "groundref", "groundref", "POOR GROUND REFERENCE: sea stabilisation will be used unless the reference is restored.");
    if (w.time - this.poorRefSince >= this.cfg.poorRefCancelSec) this.releaseGroundRef(w, "cancelled (poor reference not restored)");
  }

  /** Least-squares fit over the window in the chosen frame, then relative motion and CPA (core). */
  estimate(w: World, t: Track, stab: Stab): TrackEstimate | null {
    const fit = fitLinearMotion(t.plots.map((p) => ({ t: p.t / 3600, p: p.refSea })));
    if (!fit) return null;
    const rel = sub(fitPositionAt(fit, w.time / 3600), this.ownSea);
    const seaOwn = this.ownVelocity(w, "sea");
    // Relative motion does not depend on the stabilisation. The true vector does:
    // sea = through the water; ground = over the ground (reference target's apparent motion removed).
    const relVel = sub(fit.vel, seaOwn);
    const g = stab === "ground" ? this.groundRefVelocity() : null;
    const trueVel = g ? sub(fit.vel, g) : fit.vel;
    return {
      rel,
      relVel,
      trueVel,
      trueCS: courseSpeedOf(trueVel),
      relCS: courseSpeedOf(relVel),
      cpa: computeCpa(rel, relVel),
      stab,
    };
  }

  private newTrack(w: World, manual: boolean, plots: TrackPlot[]): Track {
    const t: Track = {
      id: this.nextId++,
      manual,
      state: "tracking",
      quality: "acquiring",
      acquiredAt: plots[0]?.t ?? w.time,
      plots: [...plots],
      missed: 0,
      hits: plots.map(() => true),
      fading: false,
      dangerous: false,
      est: null,
      seedSea: null,
      truthId: null,
      firstTruthId: null,
      swaps: 0,
      windowRestarts: 0,
      baseRelVel: null,
      devSince: null,
      history: [],
    };
    this.tracks.push(t);
    return t;
  }

  private raise(w: World, key: string, kind: AlarmKind, text: string, trackId?: number): void {
    const a = this.alarms.find((x) => x.key === key);
    if (a) {
      a.text = text;
      return;
    }
    const alarm: ArpaAlarm = { key, kind, text, raisedAt: w.time, acked: false };
    if (trackId !== undefined) alarm.trackId = trackId;
    this.alarms.push(alarm);
    this.event(w, `${kind === "capacity-near" ? "CAUTION" : "ALARM"}: ${text}`, false);
  }

  private say(w: World, text: string): void {
    this.message = { text, time: w.time };
  }

  private event(w: World, text: string, instructor: boolean): void {
    this.events.push({ time: w.time, text, instructor });
    if (this.events.length > 500) this.events.shift();
  }

  private truthName(w: World, id: number | null): string {
    if (id === null) return "clutter or land (no real target)";
    return w.targets.find((x) => x.id === id)?.name ?? `target ${id}`;
  }
}
