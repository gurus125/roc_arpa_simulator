import { classifyEncounter } from "../core/colreg";
import { computeCpa } from "../core/cpa";
import { trialManoeuvre } from "../core/trial";
import { CourseSpeed, angleDiffDeg, bearingOf, courseSpeedOf, length, normalizeDeg, sub, velocityOf } from "../core/vec";
import { Target, World } from "./types";
import { visibilityNm } from "./visibility";
import { orderTarget, ownGroundVelocity } from "./world";

/**
 * How the other ships behave towards own ship: an instructor's choice, "hold" unless one is made.
 *
 *  - hold:  every ship keeps her course and speed (or her script), as the exercises are written and marked.
 *  - rules: ships keep the collision regulations towards own ship. In sight of one another a give-way ship alters to
 *           starboard in good time (Rules 15, 16; Rule 13 when she overtakes; Rule 14 head-on); a stand-on ship keeps
 *           her course and speed (Rule 17(a)(i)) and acts herself only when own ship has not and they are about to
 *           come too close (Rule 17(a)(ii) and (b)), then to starboard (Rule 17(c)). In restricted visibility each one
 *           detecting own ship by radar alone alters to starboard for a vessel forward of her beam (Rule 19(d)) and
 *           keeps on for one abeam or abaft it. When own ship is past and clear she goes back to her course.
 *  - wrong: the same, except that the first ship to act gets it wrong in a way trainees must be ready for: she turns
 *           to port, as ships detecting each other by radar alone sometimes do.
 *  - careless, hunting: one ship keeps coming. She holds on while own ship is coming close, and once own ship has
 *           acted she comes back towards her, so that one good alteration is not enough: the trainee must keep
 *           watching and act again. "careless" is a ship with no proper look-out that keeps edging back across own
 *           ship's way (a few small corrections, minutes apart); "hunting" is a drill, a ship that re-aims at own
 *           ship (more and larger corrections). Either gives up after a set number of corrections, when own ship has
 *           nearly stopped, or when she is past and clear, so a bold action by own ship always gets clear. The other
 *           ships keep their course and speed.
 *
 * The ships act on the true situation (as if their own radar and look-out were perfect). Ships following a track
 * or with scripted alterations still to come are left alone, and ships at anchor never move. Every figure below is
 * a PLACEHOLDER chosen to make the behaviour visible in an exercise, not taken from any standard.
 */
export type ShipBehaviour = "hold" | "rules" | "wrong" | "careless" | "hunting";

/** One ship keeps coming (modes "careless" and "hunting"). PLACEHOLDERS, chosen to make the exercise work. */
export const KEEPS_COMING = {
  /** How often she looks at own ship, seconds; the largest correction each time, degrees; how many she makes in all. */
  careless: { lookEverySec: 150, maxTurnDeg: 15, maxCorrections: 3 },
  hunting: { lookEverySec: 60, maxTurnDeg: 20, maxCorrections: 6 },
  /** She comes back only while own ship would pass wider than this, NM (so only after own ship has acted)... */
  backWhenCpaOverNm: 0.5,
  /** ...and while the TCPA is between these, minutes: never a surprise in the last minutes. */
  notInsideTcpaMin: 4,
  withinTcpaMin: 30,
  /** She gives up when own ship is slower than this through the water, knots, or past and this far off, NM. */
  ownStoppedKn: 3,
  clearNm: 3,
  /** With no ship chosen: the vessel coming closest, if she would pass inside this, NM. */
  pickCpaNm: 2,
};

/** The ship that keeps coming: which, how many corrections she has made, when she looks again, and whether she has stopped. */
export interface ChaseState {
  id: number | null;
  corrections: number;
  nextLook: number;
  over: boolean;
}

export const TRAFFIC_RULES = {
  /** Each ship looks at own ship this often, seconds. */
  lookEverySec: 10,
  /** A close-quarters situation: own ship will pass inside this, NM, within `actTcpaMin` minutes. */
  riskCpaNm: 1,
  actTcpaMin: 12,
  /** The passing distance a ship that gives way aims for, NM. */
  clearNm: 1.5,
  /** A stand-on ship acts herself when the CPA is under this, NM, and the TCPA under `lastMomentTcpaMin` minutes. */
  standOnCpaNm: 0.5,
  lastMomentTcpaMin: 6,
  /** A ship that has acted goes back to her course once own ship is past and at least this far off, NM. */
  resumeNm: 2,
  /** How fast a ship without a catalogue type comes round, degrees a second. */
  simpleTurnDegPerSec: 0.5,
  /** How far the ship that gets it wrong turns to port, degrees. */
  wrongTurnDeg: 30,
};

/** What one ship is doing about own ship. */
export interface ShipReaction {
  phase: "watch" | "acting";
  /** Her course and speed before she acted (to go back to). */
  course: number;
  speed: number;
  /** The course she is coming round to, for a ship without a catalogue type. */
  steer?: number;
  /** When she looks again, seconds. */
  nextLook: number;
}

/** The other ships' behaviour and what they have done (a plain object: it is copied with the world). */
export interface TrafficState {
  mode: ShipBehaviour;
  /** The ship that got it wrong (mode "wrong"). */
  wrongId: number | null;
  ships: Record<string, ShipReaction>;
  /** What the ships did and why, for the record (seen by the instructor, not told to the trainees). `back`: a correction by the ship that keeps coming. */
  log: { t: number; id: number; text: string; back?: boolean }[];
  /** Modes "careless" and "hunting": the ship that keeps coming. */
  chase?: ChaseState;
}

export const BEHAVIOUR_LABELS: Record<ShipBehaviour, string> = {
  hold: "Keep their course and speed (as the exercise is written)",
  rules: "Keep the collision regulations",
  wrong: "Keep the regulations, but one gets it wrong",
  careless: "One ship keeps coming: careless, no look-out",
  hunting: "One ship keeps coming: hunting (a drill)",
};

/**
 * Set how the other ships behave (a fresh start: what they were doing is forgotten). For "careless" and "hunting",
 * `ship` is the one that keeps coming; left out, the vessel that would come closest is chosen when there is one.
 */
export function setShipBehaviour(w: World, mode: ShipBehaviour, ship: number | null = null): void {
  w.traffic = {
    mode, wrongId: null, ships: {}, log: w.traffic?.log ?? [],
    ...(mode === "careless" || mode === "hunting" ? { chase: { id: ship, corrections: 0, nextLook: w.time, over: false } } : {}),
  };
}

const isVessel = (t: Target): boolean => t.kind === "ship" || t.kind === "small-craft";
const headingOf = (t: Target): number => (t.motion ? t.motion.heading : t.course);
const speedOf = (t: Target): number => (t.motion ? t.motion.orderedSpeed : t.speed);
const pad3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");

/** The smallest turn to starboard, in 10° steps from `from`, that makes own ship pass the target at `nm` or more. */
function starboardTurnFor(w: World, t: Target, from: number, nm: number): number {
  const rel = sub(w.own.pos, t.pos);
  const own: CourseSpeed = { course: t.course, speed: t.speed };
  const other = courseSpeedOf(ownGroundVelocity(w));
  for (let k = from; k <= 90; k += 10) {
    const r = trialManoeuvre(rel, own, other, { course: normalizeDeg(t.course + k), speed: t.speed, delayMinutes: 0 });
    if (r.cpa >= nm) return k;
  }
  return 90;
}

/** What the ship should do now, if anything: a turn (+ starboard) and the reason, in words. */
function decide(w: World, t: Target): { turn: number; why: string } | null {
  const R = TRAFFIC_RULES;
  const rel = sub(w.own.pos, t.pos);
  const ownV = ownGroundVelocity(w);
  const c = computeCpa(rel, sub(ownV, velocityOf({ course: t.course, speed: t.speed })));
  if (c.tcpaMinutes === null || c.tcpaMinutes <= 0 || c.cpa >= R.riskCpaNm || c.tcpaMinutes >= R.actTcpaMin) return null;
  const vis = visibilityNm(w);
  const range = length(rel);
  const inSight = vis === null || range <= vis;
  const rb = normalizeDeg(bearingOf(rel) - headingOf(t));
  if (inSight) {
    const hint = classifyEncounter(rel, { course: headingOf(t), speed: speedOf(t) }, { course: w.own.heading, speed: w.own.speedThroughWater });
    if (hint.ownRole === "give-way") {
      return { turn: starboardTurnFor(w, t, 20, R.clearNm), why: hint.situation === "overtaking" ? "she is overtaking own ship and keeps out of the way (rule 13)" : "own ship is on her starboard side: she gives way (rules 15 and 16)" };
    }
    if (hint.ownRole === "both-give-way") return { turn: Math.max(30, starboardTurnFor(w, t, 30, R.clearNm)), why: "meeting end-on: she alters to starboard (rule 14)" };
    // Stand-on: she keeps her course and speed until own ship is about to come too close without having acted.
    if (c.cpa < R.standOnCpaNm && c.tcpaMinutes < R.lastMomentTcpaMin) {
      return { turn: Math.max(40, starboardTurnFor(w, t, 40, R.clearNm)), why: "the give-way ship (own ship) has not acted and they are coming too close: she acts herself, to starboard (rule 17(a)(ii), (b) and (c))" };
    }
    return null;
  }
  // Restricted visibility: own ship detected by radar alone.
  const forward = rb < 90 || rb > 270;
  if (forward) return { turn: starboardTurnFor(w, t, 30, R.clearNm), why: "restricted visibility, own ship forward of her beam: she alters to starboard in ample time (rule 19(d))" };
  return null;
}

/** Bring a ship without a catalogue type round towards the course she is steering. */
function steerSimple(t: Target, st: ShipReaction, dtSec: number): void {
  if (t.motion || st.steer === undefined) return;
  const diff = angleDiffDeg(st.steer, t.course);
  const max = TRAFFIC_RULES.simpleTurnDegPerSec * dtSec;
  t.course = normalizeDeg(t.course + Math.max(-max, Math.min(max, diff)));
  if (Math.abs(diff) <= max) delete st.steer;
}

function order(t: Target, st: ShipReaction, course: number): void {
  if (t.motion) orderTarget(t, { course });
  else st.steer = normalizeDeg(course);
}

/** When the ship that keeps coming first came back towards own ship (simulation time, s), or null. */
export function cameBackAt(w: World): number | null {
  return w.traffic?.log.find((e) => e.back)?.t ?? null;
}

/** Whether a target can be steered by these rules: a vessel under way, not on a track or a script, not at anchor. */
const free = (t: Target): boolean => isVessel(t) && !t.atAnchor && !t.route && t.nextEvent >= t.events.length && speedOf(t) >= 0.5;

/** Own ship's CPA and TCPA with a target steering `course` at her speed (own ship's present motion). */
function cpaWith(w: World, t: Target, course: number): { cpa: number; tcpa: number | null } {
  const c = computeCpa(sub(w.own.pos, t.pos), sub(ownGroundVelocity(w), velocityOf({ course, speed: t.speed })));
  return { cpa: c.cpa, tcpa: c.tcpaMinutes };
}

/** Modes "careless" and "hunting": the ship that keeps coming. */
function stepChase(w: World, dtSec: number): void {
  const tr = w.traffic!;
  const K = KEEPS_COMING;
  const P = tr.mode === "hunting" ? K.hunting : K.careless;
  const ch = (tr.chase ??= { id: null, corrections: 0, nextLook: w.time, over: false });
  const t = ch.id === null ? undefined : w.targets.find((x) => x.id === ch.id);
  const key = String(ch.id);
  if (t) steerSimple(t, (tr.ships[key] ??= { phase: "acting", course: headingOf(t), speed: speedOf(t), nextLook: w.time }), dtSec);
  if (ch.over || w.time < ch.nextLook) return;
  if (!t) {
    // None chosen yet: the vessel that would come closest, once one would come close.
    ch.nextLook = w.time + TRAFFIC_RULES.lookEverySec;
    let best: { t: Target; cpa: number } | null = null;
    for (const x of w.targets) {
      if (!free(x)) continue;
      const c = cpaWith(w, x, x.course);
      if (c.tcpa === null || c.tcpa <= 0 || c.tcpa > K.withinTcpaMin || c.cpa >= K.pickCpaNm) continue;
      if (!best || c.cpa < best.cpa) best = { t: x, cpa: c.cpa };
    }
    if (best) {
      ch.id = best.t.id;
      tr.log.push({ t: w.time, id: best.t.id, text: `${best.t.name} is the ship that keeps coming (${tr.mode}).` });
    }
    return;
  }
  ch.nextLook = w.time + P.lookEverySec;
  if (!free(t)) {
    ch.over = true;
    return;
  }
  const now = cpaWith(w, t, t.course);
  const stop = (text: string): void => {
    ch.over = true;
    tr.log.push({ t: w.time, id: t.id, text: `${t.name} ${text}` });
  };
  if (w.own.speedThroughWater < K.ownStoppedKn) return stop("holds her course: own ship has nearly stopped.");
  if (now.tcpa === null || now.tcpa <= 0) {
    if (length(sub(w.own.pos, t.pos)) >= K.clearNm) stop("is past and clear.");
    return;
  }
  if (ch.corrections >= P.maxCorrections) return stop(`makes no more corrections (${P.maxCorrections} made).`);
  if (now.cpa <= K.backWhenCpaOverNm || now.tcpa < K.notInsideTcpaMin || now.tcpa > K.withinTcpaMin) return;
  // The course within her largest correction, in whole degrees, that brings her closest to own ship.
  let best = { turn: 0, cpa: now.cpa };
  for (let k = -P.maxTurnDeg; k <= P.maxTurnDeg; k++) {
    const c = cpaWith(w, t, normalizeDeg(t.course + k));
    if (c.tcpa !== null && c.tcpa > 0 && c.cpa < best.cpa - 1e-9) best = { turn: k, cpa: c.cpa };
  }
  if (best.turn === 0 || now.cpa - best.cpa < 0.05) return;
  const to = normalizeDeg(t.course + best.turn);
  order(t, tr.ships[key]!, to);
  ch.corrections++;
  const side = best.turn > 0 ? "starboard" : "port";
  tr.log.push({
    t: w.time, id: t.id, back: true,
    text: tr.mode === "hunting"
      ? `${t.name} comes back at own ship: ${Math.abs(best.turn)}° to ${side}, to ${pad3(to)}° (hunting, the drill set by the instructor).`
      : `${t.name} edges back towards own ship: ${Math.abs(best.turn)}° to ${side}, to ${pad3(to)}° (careless: no proper look-out).`,
  });
}

/** Let the other ships act on own ship for `dtSec` seconds (call after each step of the world). */
export function stepTraffic(w: World, dtSec: number): void {
  const tr = w.traffic;
  if (!tr || tr.mode === "hold") return;
  if (tr.mode === "careless" || tr.mode === "hunting") return stepChase(w, dtSec);
  const R = TRAFFIC_RULES;
  for (const t of w.targets) {
    if (!isVessel(t) || t.atAnchor || t.route || t.nextEvent < t.events.length || speedOf(t) < 0.5) continue;
    const key = String(t.id);
    let st = tr.ships[key];
    if (!st) st = tr.ships[key] = { phase: "watch", course: headingOf(t), speed: speedOf(t), nextLook: w.time };
    steerSimple(t, st, dtSec);
    if (w.time < st.nextLook) continue;
    st.nextLook = w.time + R.lookEverySec;
    const rel = sub(w.own.pos, t.pos);
    if (st.phase === "acting") {
      const c = computeCpa(rel, sub(ownGroundVelocity(w), velocityOf({ course: t.course, speed: t.speed })));
      if ((c.tcpaMinutes ?? 0) <= 0 && length(rel) >= R.resumeNm) {
        order(t, st, st.course);
        st.phase = "watch";
        tr.log.push({ t: w.time, id: t.id, text: `${t.name} is past and clear: back to ${pad3(st.course)}°.` });
      }
      continue;
    }
    const d = decide(w, t);
    if (!d) continue;
    st.course = headingOf(t);
    st.speed = speedOf(t);
    st.phase = "acting";
    if (tr.mode === "wrong" && (tr.wrongId === null || tr.wrongId === t.id)) {
      tr.wrongId = t.id;
      const to = normalizeDeg(st.course - R.wrongTurnDeg);
      order(t, st, to);
      tr.log.push({ t: w.time, id: t.id, text: `${t.name} alters ${R.wrongTurnDeg}° to PORT, to ${pad3(to)}° (the mistake set by the instructor; she should have: ${d.why}).` });
      continue;
    }
    const to = normalizeDeg(st.course + d.turn);
    order(t, st, to);
    tr.log.push({ t: w.time, id: t.id, text: `${t.name} alters ${d.turn}° to starboard, to ${pad3(to)}°: ${d.why}.` });
  }
}
