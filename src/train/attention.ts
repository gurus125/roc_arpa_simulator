import { Vec2, bearingOf, length, sub } from "../core/vec";
import { crossTrackError } from "../core/nav";
import { advanceLeg } from "../core/route";
import { tssConduct } from "../core/tss";
import { World, ownGroundVelocity, radarTransmitting } from "../engine/index";
import { ArpaSystem } from "../arpa/index";
import { ArpaExSession, distanceToLandNm, timeLimitMin, truthCpa } from "./session";

/**
 * What the instructor should look at. An instructor cannot watch several displays at once: while he or she
 * attends to one, events on the others go unnoticed (T. Karlsson, "The importance of structured briefings and
 * debriefings for objective evaluation of ARPA simulator training", Chalmers, 2011: interviews with instructors
 * who follow up to four bridges). So each display watches itself and reports a short list of flags, and the
 * instructor station ranks the flags of all displays.
 *
 * The flags use the REAL positions of the ships, which the trainee does not have. They are for the instructor
 * only and take no part in the marking. EVERY limit here is a PLACEHOLDER for the institute to set.
 */
export const ATTENTION_LIMITS = {
  /** Passing distance taken as unsafe when the exercise does not give one, NM. */
  safeNm: 0.5,
  /** A vessel that will pass inside the safe distance in less than this many minutes, with no action taken yet, is urgent. */
  urgentTcpaMin: 6,
  /** A vessel that will pass inside the safe distance in less than this many minutes should be tracked by now. */
  trackedByTcpaMin: 12,
  /** Land closer than this while under way, NM. */
  landNm: 0.3,
  /** An alarm or warning left unacknowledged this long, seconds of exercise time. */
  alarmSec: 60,
  /** Distance off the route, NM. */
  routeXteNm: 0.3,
  /** No control touched for this long while the exercise runs, seconds. */
  idleSec: 180,
  /** Paused this long during an exercise, seconds. */
  pausedSec: 180,
  /** Time left on a timed exercise, seconds. */
  timeLeftSec: 120,
  /** Gain at or below this, or a clutter control at or above this (0 to 100), may be hiding echoes. */
  gainLow: 15,
  clutterHigh: 85,
};

/** 3: look now. 2: look soon. 1: worth knowing. */
export type AttentionLevel = 1 | 2 | 3;

export interface AttentionFlag {
  /** The same situation keeps the same key from one report to the next (for example "risk:4" for target 4). */
  key: string;
  level: AttentionLevel;
  text: string;
}

export interface AttentionInput {
  w: World;
  /** Null in the ROC exercises, which have no ARPA. */
  a: ArpaSystem | null;
  session: ArpaExSession | null;
  running: boolean;
  /** Seconds since the trainee last touched a control, and since the display was paused (0 while running). */
  idleSec: number;
  pausedSec: number;
  /** The route on the radar, if any. */
  route: Vec2[];
}

const isVessel = (kind: string): boolean => kind === "ship" || kind === "small-craft";

/** The flags of one display now, most urgent first. At most `max` are returned. */
export function attentionFlags(i: AttentionInput, max = 6): AttentionFlag[] {
  const { w, a, session: s } = i;
  const L = ATTENTION_LIMITS;
  const out: AttentionFlag[] = [];
  if (s?.finished) return out;
  const safe = s?.def.safeNm ?? L.safeNm;
  const manual = !!s && (s.def.group === "Plotting" || !!s.def.aisOff);
  const acted = !!s?.obs.manoeuvre;
  const og = ownGroundVelocity(w);
  const underWay = length(og) > 1 && !w.own.anchor;

  for (const t of w.targets) {
    if (!isVessel(t.kind)) continue;
    const range = length(sub(t.pos, w.own.pos));
    const r = truthCpa(w, t.id);
    const closing = !!r && r.tcpaMinutes !== null && r.tcpaMinutes > 0;
    if (range < safe && underWay) {
      out.push({ key: `inside:${t.id}`, level: 3, text: `${t.name} is ${range.toFixed(2)} NM off, inside the safe distance of ${safe} NM` });
      continue;
    }
    if (!r || !closing || r.cpa >= safe) continue;
    const tcpa = r.tcpaMinutes!;
    if (tcpa <= L.urgentTcpaMin) {
      out.push({ key: `risk:${t.id}`, level: 3, text: `${t.name} will pass at ${r.cpa.toFixed(2)} NM in ${tcpa.toFixed(0)} min${s ? (acted ? ": the action taken is not enough" : ": no action taken") : ""}` });
    } else if (tcpa <= L.trackedByTcpaMin && a && !manual && !a.settings.standby && !a.tracks.some((k) => k.truthId === t.id && k.state === "tracking")) {
      out.push({ key: `untracked:${t.id}`, level: 2, text: `${t.name} will pass at ${r.cpa.toFixed(2)} NM in ${tcpa.toFixed(0)} min and is not tracked` });
    }
  }

  if (underWay) {
    const land = distanceToLandNm(w);
    if (land < L.landNm) out.push({ key: "land", level: 3, text: `Land ${land.toFixed(2)} NM off and the ship is under way` });
    for (const t of w.tss) {
      const c = tssConduct(w.own.pos, bearingOf(og), t);
      if (c === "in-zone") out.push({ key: "tss-zone", level: 2, text: "In the separation zone of the traffic separation scheme" });
      if (c === "against-flow") out.push({ key: "tss-against", level: 2, text: "Going against the flow of a traffic lane" });
    }
    const rt = s?.def.route ?? (i.route.length >= 2 ? i.route : null);
    if (rt && rt.length >= 2) {
      const leg = advanceLeg(rt, w.own.pos, 0, 0);
      const xtd = crossTrackError(w.own.pos, rt[leg]!, rt[leg + 1]!);
      if (Math.abs(xtd) > L.routeXteNm) out.push({ key: "route", level: 2, text: `${Math.abs(xtd).toFixed(2)} NM to ${xtd > 0 ? "starboard" : "port"} of the route` });
    }
  }

  if (a && !a.settings.standby) {
    const old = a.alarms.filter((x) => !x.acked && x.kind !== "capacity-near" && w.time - x.raisedAt >= L.alarmSec).sort((x, y) => x.raisedAt - y.raisedAt)[0];
    if (old) out.push({ key: `alarm:${old.key}`, level: 2, text: `Alert not acknowledged for ${Math.round((w.time - old.raisedAt) / 60)} min: ${old.text.split(".")[0]}` });
  }
  if (s && manual && (s.obs.maxTurnDeg <= -5 || (s.obs.manoeuvre?.turnDeg ?? 0) <= -5)) out.push({ key: "port-turn", level: 2, text: "Turned to port (not allowed in this plotting exercise)" });
  if (s && !s.def.startsSwitchedOff && !radarTransmitting(w) && underWay) out.push({ key: "radar-off", level: 2, text: "Under way with the radar not transmitting" });

  if (s) {
    const limit = timeLimitMin(s.def, s.cfg);
    const left = limit === null ? null : limit * 60 - w.time;
    if (left !== null && left < 0) out.push({ key: "time-up", level: 2, text: `Time is up (${Math.round(-left / 60)} min over) and the exercise is not finished` });
    else if (left !== null && left <= L.timeLeftSec) out.push({ key: "time-left", level: 1, text: `${Math.ceil(left / 60)} min left of the time allowed` });
  }
  const c = w.radar.controls;
  if (radarTransmitting(w) && c.gain <= L.gainLow) out.push({ key: "gain", level: 1, text: `Gain very low (${Math.round(c.gain)}): weak echoes will not show` });
  if (radarTransmitting(w) && (c.stc >= L.clutterHigh || c.ftc >= L.clutterHigh)) out.push({ key: "clutter", level: 1, text: `${c.stc >= L.clutterHigh ? "Sea" : "Rain"} clutter control very high (${Math.round(Math.max(c.stc, c.ftc))}): echoes may be hidden` });
  if (s || !a) {
    if (!i.running && i.pausedSec >= L.pausedSec) out.push({ key: "paused", level: 1, text: `Paused for ${Math.round(i.pausedSec / 60)} min` });
    else if (i.running && i.idleSec >= L.idleSec) out.push({ key: "idle", level: 1, text: `No control touched for ${Math.round(i.idleSec / 60)} min` });
  }
  return out.sort((x, y) => y.level - x.level).slice(0, max);
}

/** What a display reports of its progress, for the instructor's class table. */
export interface ProgressReport {
  /** Questions and actions done, of how many. */
  done: number;
  of: number;
  /** Points so far from the answers given and the actions done, of the exercise's total; null outside a marked exercise. */
  score: number | null;
  max: number | null;
  /** Final percentage when the exercise is finished. */
  finished: number | null;
  /** The vessel that has come closest, and how close, NM. */
  closest: { name: string; nm: number } | null;
  /** Whether own ship's course or speed has been altered, and when (exercise time, s). */
  actedAt: number | null;
}

export function progressReport(w: World, s: ArpaExSession | null): ProgressReport {
  const vessels = w.targets.filter((t) => isVessel(t.kind));
  const near = s
    ? vessels.map((t) => ({ name: t.name, nm: s.obs.minRange[t.id] ?? Infinity })).sort((x, y) => x.nm - y.nm)[0]
    : vessels.map((t) => ({ name: t.name, nm: length(sub(t.pos, w.own.pos)) })).sort((x, y) => x.nm - y.nm)[0];
  const closest = near && Number.isFinite(near.nm) ? { name: near.name, nm: Math.round(near.nm * 100) / 100 } : null;
  if (!s) return { done: 0, of: 0, score: null, max: null, finished: null, closest, actedAt: null };
  const asked = s.def.tasks.filter((t) => t.kind !== "outcome");
  let score = 0;
  for (const t of asked) {
    if (t.kind === "action") score += s.actionsDone.has(t.id) ? s.cfg.points.action : 0;
    else score += s.answers.get(t.id)?.ok ? s.cfg.points.question : 0;
  }
  const max = s.def.tasks.reduce((m, t) => m + (t.kind === "outcome" ? s.cfg.points.safety : t.kind === "action" ? s.cfg.points.action : s.cfg.points.question), 0) + (timeLimitMin(s.def, s.cfg) !== null ? s.cfg.points.safety : 0);
  return {
    done: s.answers.size + s.actionsDone.size, of: asked.length,
    score: s.finished ? s.finished.score : score, max: s.finished ? s.finished.max : max,
    finished: s.finished ? Math.round(s.finished.percent) : null, closest, actedAt: s.obs.manoeuvre ? Math.round(s.obs.manoeuvre.time) : null,
  };
}

/** Rank the flags of several displays for one list: the most urgent first, and among equals the one that has waited longest. */
export function rankFlags<T extends { level: AttentionLevel; since: number }>(flags: T[]): T[] {
  return [...flags].sort((x, y) => y.level - x.level || x.since - y.since);
}
