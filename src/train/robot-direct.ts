import { ArpaSystem, alertPriority, nextToAcknowledge } from "../arpa/index";
import { expandingSquare } from "../core/search";
import { Vec2, bearingOf, length, normalizeDeg, rotateVec, sub } from "../core/vec";
import { World, createWorld, letGoAnchor, radarPower, radarTransmitting, setRadarTransmit, setShipModel, stepTraffic, stepWorld, switchRadarOn } from "../engine/index";
import { ArpaExSession, ArpaExercise } from "./session";
import { RobotAction, RobotHost, RobotLogEntry, RobotRun, RobotView, lcg } from "./robot-types";
import { runRobotStudent } from "./robot-scripts";

// ---------------------------------------------------------------- working the simulation directly (tests)

/**
 * The robot working the simulation directly, without a screen: each action does to the world, the ARPA and
 * the session what the matching control on the display does, then the clock runs a second.
 */
export class DirectHost implements RobotHost {
  readonly w: World;
  readonly a: ArpaSystem;
  readonly s: ArpaExSession;
  readonly logs: RobotLogEntry[] = [];
  private selected: number | null = null;
  private mob: { pos: Vec2; time: number } | null = null;
  private ebl: { bearing: number; range: number } | null = null;
  private ui = { pi: [] as { on: boolean; bearing: number; range: number }[], navLines: 0, pmOn: false, mobAt: null as number | null, routePoints: 0 };
  private rng: () => number;

  constructor(readonly ex: ArpaExercise, seed = 11) {
    this.rng = lcg(seed);
    const w = createWorld(ex.scenario, 62);
    w.radar.controls.tuning = 62;
    w.radar.controls.rangeNm = ex.rangeNm;
    if (ex.ownRates) {
      w.own.turnRateDegPerSec = ex.ownRates.turnDegPerMin / 60;
      w.own.accelKnPerSec = ex.ownRates.speedKnPerMin / 60;
    } else setShipModel(w, "container");
    this.w = w;
    this.a = new ArpaSystem(w);
    this.s = new ArpaExSession(ex, w, this.a);
    this.a.step(w, this.rng);
  }

  view(): RobotView {
    return { w: this.w, a: this.a, s: this.s, selected: this.selected, mob: this.mob, measured: this.ebl };
  }
  private advance(sec: number): void {
    const n = Math.max(1, Math.round(sec));
    for (let i = 0; i < n; i++) {
      stepWorld(this.w, 1);
      stepTraffic(this.w, 1);
      if (!radarTransmitting(this.w)) this.a.settings.standby = true;
      this.a.step(this.w, this.rng);
      this.s.step(this.w, this.a, this.ui);
    }
  }
  async wait(sec: number): Promise<void> {
    this.advance(sec);
  }
  alerts(): ReturnType<RobotHost["alerts"]> {
    return this.a.alarms.filter((x) => !x.acked).map((x) => ({ key: x.key, text: x.text, raisedAt: x.raisedAt, priority: alertPriority(x.kind), acked: false })).filter((x) => x.priority !== "caution");
  }
  log(e: RobotLogEntry): void {
    this.logs.push(e);
  }
  stopRequested(): boolean {
    return false;
  }
  private trackOf(id: number): number | null {
    return this.a.tracks.find((t) => t.truthId === id && t.state === "tracking")?.id ?? null;
  }

  async act(x: RobotAction): Promise<void> {
    const w = this.w, a = this.a, s = a.settings;
    switch (x.k) {
      case "open":
      case "run":
        break;
      case "acquire": {
        const t = w.targets.find((q) => q.id === x.target);
        if (t) {
          const tr = a.acquire(w, rotateVec(sub(t.pos, w.own.pos), w.sensors.gyroErrorDeg));
          if (tr) this.selected = tr.id;
        }
        break;
      }
      case "select":
        this.selected = this.trackOf(x.target) ?? this.selected;
        break;
      case "measure": {
        const p = x.at ?? w.targets.find((q) => q.id === x.target)?.pos;
        if (p) {
          const rel = sub(p, w.own.pos);
          this.ebl = { bearing: Math.round(normalizeDeg(bearingOf(rel)) * 10) / 10, range: Math.round(length(rel) * 100) / 100 };
        }
        break;
      }
      case "vectors":
        s.vectorMode = x.mode;
        break;
      case "past":
        s.past = { mode: x.mode, points: 5, intervalMin: 1 };
        break;
      case "limits":
        s.cpaLimitNm = x.cpa;
        s.tcpaLimitMin = x.tcpa;
        break;
      case "zone":
        (x.which === "guard" ? s.guardZones : s.exclusionZones)[0]!.on = x.on;
        break;
      case "autoAcquire":
        s.autoAcquire = x.on;
        break;
      case "trial":
        s.trial = x.on ? { on: true, course: x.course ?? s.trial.course, speed: x.speed ?? s.trial.speed, delayMinutes: x.delay ?? 6 } : { ...s.trial, on: false };
        break;
      case "course":
        w.own.ordered.course = normalizeDeg(x.deg);
        break;
      case "speed":
        w.own.ordered.speed = x.kn;
        break;
      case "helm":
        if (w.own.model) {
          w.own.model.steering = "hand";
          w.own.model.rudderOrder = x.deg;
        }
        break;
      case "autopilot":
        if (w.own.model) {
          w.own.model.steering = "auto";
          w.own.model.rudderOrder = 0;
        }
        w.own.ordered.course = normalizeDeg(x.course);
        break;
      case "ack": {
        const next = nextToAcknowledge(this.alerts());
        if (next) a.ack(w, next.key);
        break;
      }
      case "selfTest":
        a.runSelfTest(w);
        break;
      case "groundRef":
        if (this.selected !== null) a.designateGroundRef(w, this.selected);
        break;
      case "anchorWatch":
        if (this.selected !== null) a.setAnchorWatch(w, this.selected, 0.1);
        break;
      case "pi":
        this.ui.pi[x.index] = { on: x.on, bearing: x.bearing, range: x.range };
        break;
      case "navLine":
        if (x.points.length >= 2) this.ui.navLines++;
        break;
      case "radarKey": {
        const p = radarPower(w);
        if (p === "off") switchRadarOn(w);
        else if (p !== "warming") setRadarTransmit(w, p === "standby");
        if (radarTransmitting(w)) s.standby = false;
        break;
      }
      case "control": {
        const c = w.radar.controls;
        if (x.id === "brill") c.brilliance = x.value;
        else c[x.id] = x.value;
        break;
      }
      case "processing": {
        const c = w.radar.controls;
        if (x.id === "echoStretch") c.echoStretch = x.on;
        else if (x.id === "echoAvg") c.echoAverage = x.on;
        else c.interferenceRejection = x.on;
        break;
      }
      case "range":
        w.radar.controls.rangeNm = x.nm;
        break;
      case "pm":
        this.ui.pmOn = x.on;
        break;
      case "letGo":
        if (letGoAnchor(w)) w.own.ordered.speed = 0;
        break;
      case "whistle":
        this.s.signal(w, x.id);
        break;
      case "mob":
        this.mob = { pos: { ...w.own.pos }, time: w.time };
        this.ui.mobAt = w.time;
        break;
      case "search":
        this.ui.routePoints = expandingSquare(this.mob?.pos ?? w.own.pos, x.course, x.size, 10).length;
        break;
      case "answer":
        this.s.answer(w, a, x.task, x.value);
        break;
      case "finish":
        this.s.finish(w, a);
        return;
      case "debrief":
        return;
    }
    this.advance(1);
  }
}

/** Work one exercise directly (no screen) and return what happened. */
export async function robotDirect(ex: ArpaExercise, level: number, seed: number): Promise<RobotRun & { log: RobotLogEntry[] }> {
  const host = new DirectHost(ex, seed);
  const r = await runRobotStudent(ex, host, level, seed);
  return { ...r, log: host.logs };
}
