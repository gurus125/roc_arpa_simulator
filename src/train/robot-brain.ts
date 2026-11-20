import { ArpaSystem, nextToAcknowledge } from "../arpa/index";
import { rule19Check } from "../core/colreg";
import { computeCpa } from "../core/cpa";
import { CourseSpeed, Vec2, add, angleDiffDeg, bearingOf, courseSpeedOf, fromPolar, length, normalizeDeg, scale, sub, velocityOf } from "../core/vec";
import { RADAR_RANGES, World, measuredHeading } from "../engine/index";
import { ArpaExSession, ArpaExercise, ExerciseResult, threats, truthCpa } from "./session";
import { PlotWork, ReasonCtx, RobotWhy, arpaTrialRows, choiceWhy, dataLine, encounterLine, f1, planWhy, readNumber } from "./robot-reasons";
import { RobotAction, RobotHost, RobotLevel, RobotLogEntry, RobotLogKind, RobotStopped, RobotView, lcg, mm, pad3, readAs, show, withUnit } from "./robot-types";

// ---------------------------------------------------------------- the brain

export class Brain {
  readonly mistakes: string[] = [];
  private readonly rng: () => number;
  private ackAt = new Map<string, number>();
  private steerJob: { every: number; next: number; fn: () => Promise<void> } | null = null;
  private busy = false;
  private plot = new Map<number, { t: number; rel: Vec2; bearing: number; range: number }[]>();
  /** The target the plotting answers are about. */
  plotFocus: number | null = null;
  /** Reasons and lessons not yet stepped through (TEACH). */
  private toTeach: RobotLogEntry[] = [];
  /** Explanations given once a run. */
  private told = new Set<string>();
  /** Extra avoiding action already taken while monitoring. */
  private extra = 0;
  /** The ships the avoiding action was taken for. */
  private riskIds: number[] = [];

  constructor(readonly ex: ArpaExercise, readonly host: RobotHost, readonly lv: RobotLevel, seed: number) {
    this.rng = lcg(seed * 7919 + lv.level * 104729 + ex.number * 31);
  }

  get v(): RobotView {
    return this.host.view();
  }
  get w(): World {
    return this.v.w;
  }
  get a(): ArpaSystem {
    return this.v.a;
  }
  get s(): ArpaExSession {
    return this.v.s;
  }
  now(): number {
    return this.w.time;
  }
  rand(a: number, b: number): number {
    return a + (b - a) * this.rng();
  }
  chance(p: number): boolean {
    return p > 0 && this.rng() < p;
  }

  log(kind: RobotLogKind, text: string): void {
    this.host.log({ t: this.now(), kind, text });
  }
  think(text: string): void {
    this.log("think", text);
  }
  /**
   * Write why: the reason for what comes next, its rule and its working. `once` gives it only the first time in a
   * run; `stop: false` never stops for it with TEACH (for what repeats).
   */
  explain(why: RobotWhy, o: { once?: string; stop?: boolean } = {}): void {
    if (o.once) {
      if (this.told.has(o.once)) return;
      this.told.add(o.once);
    }
    const e: RobotLogEntry = { t: this.now(), kind: "why", text: why.title, why };
    this.host.log(e);
    if (o.stop !== false) this.toTeach.push(e);
  }
  /** Step through the reasons and lessons written since the robot last did something. */
  async flush(): Promise<void> {
    while (this.toTeach.length > 0) {
      const e = this.toTeach.shift()!;
      if (this.host.teach) await this.host.teach(e);
      this.checkStop();
    }
  }
  /**
   * A mistake made on purpose, with what was wrong and what is right. A lesson with a `once` key is given (and
   * stopped at) only the first time; the same kind of mistake again is logged without it.
   */
  mistake(text: string, lesson?: Omit<RobotWhy, "title">, once?: string): void {
    this.mistakes.push(text);
    const teachIt = lesson && !(once && this.told.has(once));
    if (once) this.told.add(once);
    const e: RobotLogEntry = { t: this.now(), kind: "mistake", text, ...(teachIt ? { why: { title: `Mistake: ${text}`, ...lesson } } : {}) };
    this.host.log(e);
    if (teachIt) this.toTeach.push(e);
  }
  /** False (and a mistake logged, with why the step matters) when this level forgets the step. */
  maybe(step: string, matters: string): boolean {
    if (!this.chance(this.lv.forget)) return true;
    this.mistake(`Forgot to ${step}.`, { reason: matters });
    return false;
  }
  /** What the reasons can see. */
  rc(): ReasonCtx {
    return {
      ex: this.ex, w: this.w, a: this.a, measured: this.v.measured,
      name: (id) => this.name(id),
      track: (id) => this.track(id),
      plot: () => this.plotWork(),
      trial: (course, speed, delayMin) => this.trialRows(course, speed, delayMin),
    };
  }
  checkStop(): void {
    if (this.host.stopRequested()) throw new RobotStopped();
  }

  async act(a: RobotAction, text: string): Promise<void> {
    this.checkStop();
    await this.flush();
    this.log(a.k === "answer" ? "answer" : "do", text);
    await this.host.act(a);
  }

  /** Let time pass, doing what has to be done meanwhile (alarms, steering). */
  async idle(sec: number): Promise<void> {
    const end = this.now() + sec;
    while (this.now() < end - 1e-6) {
      this.checkStop();
      await this.flush();
      await this.host.wait(Math.min(5, end - this.now()));
      await this.duties();
    }
  }
  async until(cond: () => boolean, maxSec: number, stepSec = 5): Promise<boolean> {
    const end = this.now() + maxSec;
    while (!cond()) {
      if (this.now() >= end - 1e-6) return false;
      await this.idle(Math.min(stepSec, end - this.now()));
    }
    return true;
  }
  async hesitate(): Promise<void> {
    await this.idle(this.rand(this.lv.hesitate[0], this.lv.hesitate[1]));
  }

  private async duties(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.ackDuty();
      const j = this.steerJob;
      if (j && this.now() >= j.next) {
        j.next = this.now() + j.every;
        await j.fn();
      }
    } finally {
      this.busy = false;
    }
  }
  private async ackDuty(): Promise<void> {
    const next = nextToAcknowledge(this.host.alerts());
    if (!next) return;
    const key = `${next.key}@${next.raisedAt}`;
    let at = this.ackAt.get(key);
    if (at === undefined) {
      at = next.raisedAt + this.rand(this.lv.ackDelay[0], this.lv.ackDelay[1]);
      this.ackAt.set(key, at);
      this.log("read", `Alert: ${next.text}`);
      if (at - next.raisedAt > 45) {
        this.mistake(`Left the alert "${next.text.replace(/\.$/, "")}" unacknowledged for ${Math.round(at - next.raisedAt)} s.`, {
          reason: "An alarm is there to make the watchkeeper look at once. Left sounding, it shows nobody has seen it, and it can hide the next alarm.",
          rule: "Acknowledge an alarm promptly, then deal with its cause.",
        }, "lateAck");
      }
    }
    if (this.now() >= at) {
      this.explain({
        title: "Acknowledge the alarm",
        reason: `"${next.text.replace(/\.$/, "")}". Acknowledging tells the system the alarm has been seen; then I look at what raised it.`,
        look: "ALARM ACK key, or Ack in the alarm list.",
      }, { once: "ack" });
      await this.act({ k: "ack" }, "ALARM ACK");
    }
  }
  /** Look at the steering every `every` seconds (null: stop). */
  steer(every: number | null, fn?: () => Promise<void>): void {
    this.steerJob = every === null || !fn ? null : { every, next: this.now(), fn };
  }

  // ---- reading the picture
  target(id: number): World["targets"][number] | undefined {
    return this.w.targets.find((t) => t.id === id);
  }
  name(id: number): string {
    return this.target(id)?.name ?? `target ${id}`;
  }
  track(id: number): ArpaSystem["tracks"][number] | undefined {
    return this.a.tracks.find((t) => t.truthId === id && t.state === "tracking");
  }
  steady(ids: number[]): boolean {
    return ids.every((id) => this.track(id)?.quality === "steady");
  }
  ships(): number[] {
    return this.w.targets.filter((t) => t.kind === "ship" || t.kind === "small-craft").map((t) => t.id);
  }
  /** Tracked ships (with data) that will pass inside `nm` and have not yet passed. */
  arpaRisks(nm: number): { id: number; name: string; cpa: number; tcpa: number; relBearing: number }[] {
    const out: { id: number; name: string; cpa: number; tcpa: number; relBearing: number }[] = [];
    for (const t of this.a.tracks) {
      if (t.state !== "tracking" || !t.est || t.quality === "acquiring" || t.truthId === null) continue;
      const tg = this.target(t.truthId);
      if (!tg || (tg.kind !== "ship" && tg.kind !== "small-craft")) continue;
      const c = t.est.cpa;
      if (c.tcpaMinutes === null || c.tcpaMinutes <= 0 || c.cpa >= nm) continue;
      out.push({ id: tg.id, name: tg.name, cpa: c.cpa, tcpa: c.tcpaMinutes, relBearing: normalizeDeg(bearingOf(t.est.rel) - measuredHeading(this.w)) });
    }
    return out;
  }
  /** The part of the line from a to b that lies on the picture (within 85% of the range scale of own ship), as its two ends. */
  onScreen(a: Vec2, b: Vec2): Vec2[] {
    const r = 0.85 * this.w.radar.controls.rangeNm;
    const inside: Vec2[] = [];
    for (let i = 0; i <= 100; i++) {
      const p = add(a, scale(sub(b, a), i / 100));
      if (length(sub(p, this.w.own.pos)) <= r) inside.push(p);
    }
    return inside.length >= 2 ? [inside[0]!, inside[inside.length - 1]!] : [a, b];
  }
  /** A range scale on which a point is well inside the picture. */
  async rangeFor(p: Vec2): Promise<void> {
    const d = length(sub(p, this.w.own.pos));
    const want = RADAR_RANGES.find((s) => s >= 0.75 && s * 0.85 >= d) ?? 48;
    if (this.w.radar.controls.rangeNm * 0.85 < d) await this.act({ k: "range", nm: want }, `Range ${want} NM, so that it is on the picture`);
  }
  done(actionId: string): boolean {
    return this.s.actionsDone.has(actionId);
  }
  truthOf(taskId: string): number | null {
    const t = this.ex.tasks.find((x) => x.id === taskId);
    return t && t.kind === "number" ? t.truth(this.s.ctx(this.w, this.a)) : null;
  }

  // ---- the steps
  async begin(): Promise<void> {
    await this.act({ k: "open" }, `Opens exercise ${this.ex.number}: ${this.ex.title}`);
    this.log("read", this.ex.aim);
    for (const b of this.ex.briefing.slice(0, 2)) this.log("read", b);
    this.explain(planWhy(this.ex));
  }
  async run(): Promise<void> {
    await this.act({ k: "run" }, "RUN: the exercise clock starts");
    await this.hesitate();
  }

  async acquire(ids: number[]): Promise<void> {
    const todo = ids.filter((id) => !this.track(id) && this.target(id));
    if (todo.length > 0) {
      this.explain({
        title: `Acquire ${todo.map((id) => this.name(id)).join(", ")}`,
        reason: "The ARPA gives a target's CPA, TCPA, course and speed, and alarms for her, only once it tracks her. Every ship that could come close is acquired, the nearest and closing ones first.",
        look: "ARPA: ACQUIRE, then click on each echo.",
        rule: "Rule 7: proper use of radar, with systematic observation of the ships detected, to judge risk of collision.",
      }, { once: "acquire" });
    }
    for (const id of ids) {
      if (this.track(id) || !this.target(id)) continue;
      if (!this.maybe(`acquire ${this.name(id)}`, "A ship that is not acquired has no CPA or TCPA on the ARPA and never gives a dangerous-target alarm: she can come close without the ARPA saying anything.")) continue;
      await this.rangeFor(this.target(id)!.pos);
      await this.act({ k: "acquire", target: id }, `Acquires ${this.name(id)}`);
      await this.idle(this.rand(0.5, 1.5) * (this.lv.level >= 4 ? 1 : 2));
    }
  }
  async waitSteady(ids: number[], maxSec = 300): Promise<void> {
    const want = ids.filter((id) => this.a.tracks.some((t) => t.truthId === id && t.state === "tracking"));
    if (want.length === 0) return;
    this.explain({
      title: "Wait for steady data",
      reason: "A new track's first data are rough. The ARPA needs about a minute to show a trend and about three minutes before the vectors, CPA and TCPA are steady. Values read earlier can be far out.",
      look: "While a track is preliminary its data carry a ? and its light in the target list is orange; green when steady.",
    }, { once: "steady" });
    this.think(`Waiting for steady data on ${want.map((id) => this.name(id)).join(", ")} (about 3 minutes from acquisition).`);
    // A weaker trainee reads before the data has settled.
    if (this.lv.level <= 2 && this.chance(0.5)) {
      await this.until(() => want.every((id) => (this.track(id)?.quality ?? "acquiring") !== "acquiring"), maxSec);
      this.mistake("Read the data while the vectors were still preliminary (dashed).", {
        reason: "Preliminary data come from too few plots: course, speed, CPA and TCPA can all be well out, and the answers or decisions taken from them with them.",
        rule: "Wait for steady data (about three minutes after acquisition) before relying on them.",
      });
      return;
    }
    await this.until(() => this.steady(want), maxSec);
    this.log("read", this.trackSummary(want));
  }
  trackSummary(ids: number[]): string {
    return ids
      .map((id) => {
        const t = this.track(id);
        if (!t?.est) return `${this.name(id)}: no data`;
        const c = t.est.cpa;
        return `${this.name(id)} CPA ${c.cpa.toFixed(1)} NM TCPA ${c.tcpaMinutes === null ? "---" : c.tcpaMinutes.toFixed(0)} min, ${pad3(t.est.trueCS.course)}° ${t.est.trueCS.speed.toFixed(1)} kn`;
      })
      .join("; ");
  }

  /**
   * Answer a question. A number is read off the screen as a trainee would (the ARPA's data, the own ship data, the
   * EBL and VRM, the robot's own plot: see robot-reasons.ts), or taken from `value`; the exercise's key is used only
   * to know whether the question can be answered yet, and when nothing on the screen gives the value.
   */
  async answer(taskId: string, value?: number): Promise<boolean> {
    const t = this.ex.tasks.find((x) => x.id === taskId);
    if (!t || this.s.answers.has(taskId) || this.s.finished) return false;
    const c = this.s.ctx(this.w, this.a);
    if (t.kind === "number") {
      const truth = t.truth(c);
      if (truth === null && value === undefined) return false;
      const reading = value === undefined ? readNumber(this.rc(), t) : null;
      const raw = value ?? reading?.value ?? truth;
      if (raw === null) return false;
      const tol = t.tol(this.s.cfg);
      let v = readAs(t, tol, raw);
      const why = reading?.why ?? {
        title: "",
        reason: "There are no steady data on the screen for this (the target is not tracked, or the value is not shown): the answer is the best that can be judged from the picture.",
      };
      this.explain({ ...why, title: `${t.prompt}: ${withUnit(v, t.unit)}` });
      let slip = "";
      const was = v;
      if (this.chance(this.lv.misread)) {
        const off = (this.rng() < 0.5 ? -1 : 1) * (1.6 + 1.4 * this.rng()) * tol;
        v = readAs(t, tol, t.circular ? normalizeDeg(v + off) : Math.max(0, v + off));
        if (Math.abs(t.circular ? angleDiffDeg(v, was) : v - was) > tol) slip = `Misread "${t.prompt}": typed ${show(v)} ${t.unit}, the display showed about ${show(was)} ${t.unit}.`;
        else v = was;
      }
      await this.act({ k: "answer", task: taskId, value: v }, `Answers "${t.prompt}": ${withUnit(v, t.unit)}`);
      if (slip) {
        this.mistake(slip, {
          reason: `The display shows about ${withUnit(was, t.unit)}, but ${withUnit(v, t.unit)} was typed. An answer is credited only within ${withUnit(tol, t.unit)} of the right value (a placeholder tolerance), so this one is lost.`,
          rule: "Read the value twice before entering it, and check that it is the right target, the right field and the right unit.",
        });
      }
      return true;
    }
    if (t.kind === "choice") {
      const right = t.correct(c);
      let pick = right;
      if (this.chance(this.lv.wrongChoice) && t.choices.length > 1) pick = (right + 1 + Math.floor(this.rng() * (t.choices.length - 1))) % t.choices.length;
      const why = choiceWhy(this.rc(), t, right);
      if (pick === right) this.explain({ ...why, title: `${t.prompt} ${t.choices[right]}` });
      await this.act({ k: "answer", task: taskId, value: pick }, `Answers "${t.prompt}": ${t.choices[pick]}`);
      if (pick !== right) this.mistake(`Chose "${t.choices[pick]}" for "${t.prompt}".`, { ...why, reason: `The right answer is "${t.choices[right]}". ${why.reason}` });
      return true;
    }
    return false;
  }
  async answerAll(ids: string[]): Promise<void> {
    for (const id of ids) await this.answer(id);
  }
  /** Answer as soon as each number can be answered (within `maxSec`). */
  async answerWhenReady(ids: string[], maxSec: number): Promise<void> {
    const left = new Set(ids);
    const end = this.now() + maxSec;
    while (left.size > 0 && this.now() < end) {
      for (const id of [...left]) if (this.truthOf(id) !== null && (await this.answer(id))) left.delete(id);
      if (left.size > 0) await this.idle(10);
    }
  }

  async order(course: number | null, speed: number | null, why: string): Promise<void> {
    const o = this.w.own.ordered;
    if (course !== null && Math.abs(angleDiffDeg(course, o.course)) >= 0.5) await this.act({ k: "course", deg: normalizeDeg(Math.round(course)) % 360 }, `Autopilot course ${pad3(course)}°${why ? `: ${why}` : ""}`);
    if (speed !== null && Math.abs(speed - o.speed) >= 0.25) await this.act({ k: "speed", kn: Math.round(speed * 2) / 2 }, `Engine: speed ${Math.round(speed * 2) / 2} kn${why && course === null ? `: ${why}` : ""}`);
  }

  async setLimits(cpa: number, tcpa: number): Promise<void> {
    this.explain({
      title: `CPA limit ${cpa} NM, TCPA limit ${tcpa} min`,
      reason: `The ARPA gives the dangerous-target alarm for any tracked ship that will pass inside ${cpa} NM within ${tcpa} minutes. Set before acquiring, the alarm works from the start. These are the briefing's limits.`,
      look: "VRM / ARPA panel: CPA LIM and TCPA LIM.",
      rule: "The limits suit the waters and the ship: wider in open sea, closer in a busy lane.",
    });
    if (!this.maybe(`set the CPA/TCPA limits to ${cpa} NM / ${tcpa} min`, "With the limits not set as the briefing asks, the dangerous-target alarm comes too late, or not at all, for the ship that matters.")) return;
    await this.act({ k: "limits", cpa, tcpa }, `CPA limit ${cpa} NM, TCPA limit ${tcpa} min`);
  }
  async groundRef(id: number): Promise<void> {
    this.explain({
      title: `Ground stabilisation on ${this.name(id)}`,
      reason: `${this.name(id)} does not move over the ground. Taken as the reference, her apparent movement is treated as the current and removed: true vectors then show motion over the ground, where each ship is really going.`,
      look: "Select the target, then ARPA: Ground stabilisation. The label changes from SEA STAB to GND STAB (REF TGT).",
      rule: "The reference must be a fixed echo, small and isolated: a buoy, a beacon, a rock.",
    });
    if (!this.maybe(`make ${this.name(id)} the ground reference`, "Without a ground reference the true vectors stay through the water: the set and drift, and each ship's motion over the ground, cannot be read.")) return;
    if (!this.track(id)) await this.acquire([id]);
    await this.until(() => !!this.track(id), 60);
    await this.act({ k: "select", target: id }, `Selects ${this.name(id)}`);
    await this.act({ k: "groundRef" }, `Stabilisation: GROUND, ${this.name(id)} as the fixed reference`);
  }

  // ---- collision avoidance with the ARPA's trial manoeuvre
  /** The trial's predicted closest approaches for a course and speed, as the ARPA shows them (nothing is changed). */
  trialRows(course: number, speed: number, delayMin = 1): { name: string; cpa: number; tcpa: number }[] {
    return arpaTrialRows(this.w, this.a, (id) => this.name(id), course, speed, delayMin);
  }
  private clears(rows: { cpa: number; tcpa: number }[], nm: number): boolean {
    return rows.every((r) => r.cpa >= nm || r.tcpa <= 0.01);
  }
  async showTrial(course: number, speed: number): Promise<void> {
    this.explain({
      title: `Check with the trial manoeuvre: ${pad3(course)}° at ${speed} kn`,
      reason: "The trial shows, before anything is changed, the CPA every tracked ship would have with the new course and speed, allowing for own ship's turn and a delay before it starts. It checks that the action works for every ship, not only the dangerous one.",
      look: "ARPA: TRIAL on, course, speed and a 1 minute delay; the picture shows TRIAL and the predicted vectors.",
      rule: "Switch the trial off afterwards: a trial picture left on can be taken for the real one.",
    }, { once: "trial" });
    if (!this.maybe("check the action with the trial manoeuvre first", "Without the trial the alteration is a guess: it may not clear the dangerous ship, or may bring another one close.")) return;
    await this.act({ k: "trial", on: true, course: normalizeDeg(Math.round(course)) % 360, speed, delay: 1 }, `Trial manoeuvre: ${pad3(course)}° at ${speed} kn, starting in 1 minute`);
    await this.idle(4);
    const rows = this.trialRows(course, speed);
    this.log("read", `Trial shows: ${rows.map((r) => `${r.name} ${r.cpa.toFixed(1)} NM`).join(", ") || "no tracked targets"}`);
    await this.act({ k: "trial", on: false }, "Trial off");
  }

  /**
   * Take avoiding action for the ships that will pass inside `safeNm`: the smallest alteration to starboard
   * (at least `minTurn`) that the trial shows clearing every tracked ship by `safeNm` and a margin, keeping
   * to Rule 19(d) in restricted visibility; a speed reduction with it when no turn alone is enough.
   */
  async avoid(o: { safeNm: number; restricted: boolean; minTurn?: number; maxTurn?: number }): Promise<boolean> {
    const risks = this.arpaRisks(o.safeNm);
    if (risks.length === 0) {
      this.think(`No tracked ship will pass inside ${o.safeNm} NM: no action is needed yet.`);
      return false;
    }
    this.riskIds = risks.map((r) => r.id);
    this.think(`Close-quarters situation developing: ${risks.map((r) => `${r.name} CPA ${r.cpa.toFixed(1)} NM in ${r.tcpa.toFixed(0)} min`).join("; ")}.`);
    const rc = this.rc();
    const tracked = this.ships().filter((id) => this.track(id));
    this.explain({
      title: `Close quarters developing with ${risks.map((r) => r.name).join(" and ")}: action is needed`,
      reason: o.restricted
        ? "The visibility is restricted and the ships are known by radar alone, so Rule 19 applies: no ship is stand-on or give-way. Every ship coming into a close-quarters situation must be avoided, in ample time."
        : "The ships are in sight of one another, so the steering and sailing rules for ships in sight decide who gives way.",
      look: "The target list: every ship's CPA and TCPA, from steady tracks.",
      rule: o.restricted
        ? "Rule 19(d): action in ample time; so far as possible, no alteration to port for a ship forward of the beam (unless she is being overtaken), and none towards a ship abeam or abaft the beam."
        : "Rules 15 and 16: the ship with the other on her starboard side keeps out of the way, early and substantially, and avoids crossing ahead of her.",
      working: [
        `The passing distance this exercise asks for: ${o.safeNm} NM (a placeholder).`,
        ...tracked.map((id) => dataLine(rc, id)),
        ...risks.map((r) => encounterLine(rc, r.id, o.restricted)),
      ],
    });
    const base = { course: this.w.own.ordered.course, speed: this.w.own.ordered.speed };
    const margin = 0.3;
    const rows: string[] = [];
    const tryRow = (turn: number, speed: number): { ok: boolean; r19: boolean } => {
      const tr = this.trialRows(base.course + turn, speed);
      const ok = this.clears(tr, o.safeNm + margin);
      const r19 = !o.restricted || rule19Check(turn, risks).ok;
      const close = tr.filter((x) => x.cpa < o.safeNm + margin && x.tcpa > 0.01).map((x) => x.name);
      rows.push(`${turn}° to starboard (${pad3(base.course + turn)}°)${speed !== base.speed ? ` at ${speed} kn` : ""}: ${tr.map((x) => `${x.name} ${x.cpa.toFixed(1)}`).join(", ")} NM ${ok ? (r19 ? "→ clears every ship" : "→ clears, but not in line with Rule 19(d)") : `→ ${close.join(", ")} inside ${f1(o.safeNm + margin)} NM`}`);
      return { ok, r19 };
    };
    let plan: { turn: number; speed: number; clears: boolean } | null = null;
    for (let turn = o.minTurn ?? 30; turn <= (o.maxTurn ?? 90); turn += 10) {
      const x = tryRow(turn, base.speed);
      if (!x.ok || !x.r19) continue;
      plan = { turn, speed: base.speed, clears: true };
      break;
    }
    if (!plan) {
      // No turn alone does it: a large turn with the speed halved.
      for (let turn = o.minTurn ?? 30; turn <= (o.maxTurn ?? 90); turn += 10) {
        const sp = Math.round(base.speed / 2);
        const ok = tryRow(turn, sp).ok;
        if (ok || turn + 10 > (o.maxTurn ?? 90)) {
          plan = { turn, speed: sp, clears: ok };
          break;
        }
      }
    }
    if (!plan) plan = { turn: o.maxTurn ?? 90, speed: base.speed, clears: false };
    this.think(`Plan: ${plan.turn > 0 ? `alter ${plan.turn}° to starboard` : "hold the course"}${plan.speed !== base.speed ? `, speed to ${plan.speed} kn` : ""}.`);
    this.explain({
      title: `Decision: ${plan.turn}° to starboard, to ${pad3(base.course + plan.turn)}°${plan.speed !== base.speed ? `, and speed down to ${plan.speed} kn` : ""}`,
      reason: `I try alterations to starboard in 10° steps, from ${o.minTurn ?? 30}°, with the trial on every tracked ship (starting in 1 minute, with own ship's turn allowed for), and take the first that clears them all by ${o.safeNm} NM with a ${margin} NM margin for the time the turn takes and the errors in the data${o.restricted ? ", and keeps to Rule 19(d)" : ""}${plan.speed !== base.speed ? ". No turn alone was enough, so the speed comes down as well" : ""}. At least 30°, so that the other ships see it at once on their radar.${plan.clears ? "" : " None of those tried clears every ship: this is the best of them, and I will watch closely and do more once she is steady."}`,
      rule: "Rule 8: action in good time, large enough to be readily apparent to another ship watching by radar, not a series of small alterations; then checked until every ship is past and clear. To starboard: it takes own ship away from ships ahead and to starboard, and agrees with what they are expected to do.",
      working: rows,
    });
    // A weaker trainee may act too little, to port, or late.
    let turn = plan.turn;
    const r = this.rng();
    if (r < this.lv.portTurn) {
      turn = -(30 + 10 * Math.floor(this.rng() * 2));
      this.mistake(`Altered to port (${-turn}°) instead of to starboard.`, {
        reason: `The trial and the rules called for ${plan.turn}° to starboard. A turn to port for a ship forward of the beam can meet her own turn to starboard and bring both ships together.`,
        rule: o.restricted ? "Rule 19(d)(i): avoid an alteration to port for a vessel forward of the beam, other than one being overtaken." : "Rules 14, 15 and 17: in a meeting or crossing the give-way action is to starboard; a turn to port for a ship on the port side is to be avoided.",
      });
    } else if (r < this.lv.portTurn + this.lv.smallAction && turn > 0) {
      turn = 15 + 5 * Math.floor(this.rng() * 2);
      this.mistake(`Altered only ${turn}°: too small to be readily apparent on another ship's radar (Rule 8).`, {
        reason: `The trial showed ${plan.turn}° was needed to clear every ship. ${turn}° is hard to see on the other ship's radar, does not give the passing distance, and invites a second alteration later.`,
        rule: "Rule 8(b): an alteration large enough to be readily apparent; a succession of small alterations should be avoided.",
      });
    }
    const course = normalizeDeg(base.course + turn);
    await this.showTrial(course, plan.speed);
    if (this.chance(this.lv.lateAction)) {
      const wait = this.rand(180, 360);
      this.mistake(`Waited ${Math.round(wait / 60)} minutes more before acting: the action was late.`, {
        reason: `With the TCPA only ${Math.round(Math.min(...risks.map((x) => x.tcpa)))} minutes, every minute of waiting needs a bigger alteration later, and leaves the other ship less time to understand it.`,
        rule: "Rule 8(a) and Rule 19(d): avoiding action is taken in ample time.",
      });
      await this.idle(wait);
    } else await this.hesitate();
    await this.order(course, plan.speed !== base.speed ? plan.speed : null, "avoiding action");
    return true;
  }

  /** Every ship past and clear: no tracked ship will pass inside `nm`, and none on the picture is still closing inside it. */
  clearOfAll(nm: number): boolean {
    return this.arpaRisks(nm).length === 0 && threats(this.w, nm).length === 0;
  }
  allPast(): boolean {
    return this.ships().every((id) => {
      const c = truthCpa(this.w, id);
      return !c || c.tcpaMinutes === null || c.tcpaMinutes <= 0;
    });
  }

  /** Watch the ships go past; take more action if one would still pass too close; resume when clear if asked. */
  async monitor(o: { safeNm: number; maxSec: number; resume?: { course: number; speed: number }; restricted?: boolean }): Promise<void> {
    const end = this.now() + o.maxSec;
    let resumed = !o.resume;
    let steadySince: number | null = null;
    this.explain({
      title: "Watch until every ship is past and clear",
      reason: "The action is not finished until every ship is finally past and clear. While own ship turns, the ARPA's data are disturbed, so I judge again only once she is steady on her new course and the tracks have settled (about 3 minutes).",
      rule: "Rule 8(d): check that the action works until the other vessel is finally past and clear.",
    }, { once: "monitor" });
    this.think("Watching the ships pass, ready to do more.");
    while (this.now() < end) {
      await this.idle(30);
      // More action only once own ship is steady on her new course and the tracks have settled again (the data
      // are disturbed while she turns), and only when the trial on the course she is steering still shows a ship too close.
      const w = this.w;
      const steadyNow = Math.abs(angleDiffDeg(measuredHeading(w), w.own.ordered.course)) < 3 && Math.abs(w.own.speedThroughWater - w.own.ordered.speed) < 1;
      steadySince = steadyNow ? (steadySince ?? this.now()) : null;
      if (steadySince !== null && this.now() - steadySince >= 180 && this.lv.level >= 3 && this.extra < 2) {
        const close = this.trialRows(w.own.ordered.course, w.own.ordered.speed, 0).filter((r) => r.cpa < o.safeNm && r.tcpa > 0.01 && r.tcpa < 25);
        if (close.length > 0) {
          this.extra++;
          steadySince = null;
          this.think(`${close[0]!.name} would still pass at ${close[0]!.cpa.toFixed(1)} NM: more action is needed.`);
          this.explain({
            title: "More action: a further 20° to starboard",
            reason: `Steady on the new course, the data show ${close[0]!.name} would still pass at ${close[0]!.cpa.toFixed(1)} NM, inside ${o.safeNm} NM. The first action was not enough, so more is taken, the same way.`,
            rule: "Rule 8(d): if the action is not resulting in a safe passing distance, more action is taken.",
            working: this.trialRows(w.own.ordered.course, w.own.ordered.speed, 0).map((x) => `On ${pad3(w.own.ordered.course)}°: ${x.name} CPA ${x.cpa.toFixed(1)} NM in ${x.tcpa.toFixed(0)} min`),
          });
          await this.order(normalizeDeg(w.own.ordered.course + 20), null, "a further 20° to starboard");
          continue;
        }
      }
      if (!this.clearOfAll(o.safeNm + 0.3)) continue;
      const past = this.riskIds.every((id) => (truthCpa(this.w, id)?.tcpaMinutes ?? 0) <= 0);
      if (!past) continue;
      if (!resumed && o.resume) {
        resumed = true;
        const back = this.trialRows(o.resume.course, o.resume.speed, 0);
        if (this.clears(back, o.safeNm + 0.5)) {
          this.think("All past and clearing: back to the original course.");
          this.explain({
            title: `Resume the original course, ${pad3(o.resume.course)}°`,
            reason: `The ships the action was for are past their closest approach, and the trial on the original course shows no ship would come inside ${o.safeNm} NM with a 0.5 NM margin.`,
            rule: "Come back only when the ships are past and clear, and check first that the old course does not create a new close-quarters situation.",
            working: back.map((x) => `On ${pad3(o.resume!.course)}°: ${x.name} ${x.tcpa > 0.01 ? `CPA ${x.cpa.toFixed(1)} NM` : "past"}`),
          });
          await this.order(o.resume.course, o.resume.speed, "resuming");
          continue;
        }
        this.think("Not yet clear enough to resume the course: holding on.");
      }
      this.think("Every ship is past and clear.");
      return;
    }
  }

  // ---- manual plotting with the EBL and VRM
  async observe(ids: number[]): Promise<void> {
    this.explain({
      title: "Plot each target with the EBL and VRM",
      reason: "With the ARPA off, the only data are bearings and ranges taken by hand. EBL 1 through the middle of the echo gives its true bearing, VRM 1 on its near edge its range. Each pair goes on the plotting sheet with the time; two or more plots a known time apart show how the target moves.",
      look: "EBL / CURSOR panel: EBL 1 and VRM 1, read BRG and RNG.",
      rule: "Rule 7(b): proper use of radar includes radar plotting, or an equivalent systematic watch, of the ships detected.",
    }, { once: "observe" });
    for (const id of ids) {
      if (!this.target(id)) continue;
      await this.act({ k: "measure", target: id }, `EBL and VRM on ${this.name(id)}`);
      const m = this.v.measured;
      if (!m) continue;
      const list = this.plot.get(id) ?? [];
      list.push({ t: this.now(), rel: fromPolar(m.bearing, m.range), bearing: m.bearing, range: m.range });
      this.plot.set(id, list);
      this.log("read", `Plot ${this.name(id)} at ${mm(this.now())}: ${m.bearing.toFixed(1)}° ${m.range.toFixed(2)} NM`);
    }
  }
  /** What the plot says of a target: its relative motion, CPA and TCPA (from now) and its true course and speed. */
  solve(id: number): { rel: Vec2; relVel: Vec2; cpa: number; tcpa: number; trueCS: CourseSpeed } | null {
    const p = this.plot.get(id);
    if (!p || p.length < 2) return null;
    const a = p[0]!, b = p[p.length - 1]!;
    if (b.t - a.t < 120) return null;
    const relVel = scale(sub(b.rel, a.rel), 3600 / (b.t - a.t));
    const rel = add(b.rel, scale(relVel, (this.now() - b.t) / 3600));
    const c = computeCpa(rel, relVel);
    const ownV = velocityOf({ course: measuredHeading(this.w), speed: this.w.own.speedThroughWater });
    return { rel, relVel, cpa: c.cpa, tcpa: c.tcpaMinutes ?? 0, trueCS: courseSpeedOf(add(relVel, ownV)) };
  }
  /** The plot of the target the answers are about, for the reasons. */
  plotWork(): PlotWork | null {
    const id = this.plotFocus;
    if (id === null) return null;
    const p = this.plot.get(id);
    const s = this.solve(id);
    if (!p || !s) return null;
    const a = p[0]!, b = p[p.length - 1]!;
    return {
      id, name: this.name(id), first: { t: a.t, bearing: a.bearing, range: a.range }, last: { t: b.t, bearing: b.bearing, range: b.range },
      rel: s.rel, relVel: s.relVel, own: { course: measuredHeading(this.w), speed: this.w.own.speedThroughWater }, trueCS: s.trueCS,
    };
  }

  async finish(): Promise<ExerciseResult | null> {
    await this.act({ k: "finish" }, "Finish exercise");
    const r = this.s.finished;
    if (!r) return null;
    const bad = r.items.filter((i) => !i.ok);
    const text = [
      `Robot student, level ${this.lv.level} (${this.lv.name}).`,
      bad.length === 0 ? "Every item was credited." : `Not credited: ${bad.map((i) => `${i.label} (${i.student})`).join("; ")}.`,
      this.mistakes.length === 0 ? "No mistakes were made on purpose." : `Mistakes made on purpose at this level: ${this.mistakes.join(" ")}`,
    ].join(" ");
    await this.act({ k: "debrief", text }, "Writes the debrief notes and saves them");
    this.log("result", `Result ${r.score} of ${r.max} (${r.percent.toFixed(0)}%).${bad.length > 0 ? ` Not credited: ${bad.map((i) => i.label).join("; ")}.` : " Every item credited."}`);
    return r;
  }
}
