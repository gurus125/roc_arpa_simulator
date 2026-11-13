/**
 * Alert handling after IMO resolution MSC.302(87), performance standards for bridge alert
 * management: priorities (alarm, warning, caution), how each is announced, and what
 * acknowledging does.
 *
 *  - Alarm (immediate attention and action): audible signal until acknowledged, flashing until
 *    acknowledged, then steady until the cause has gone (7.3).
 *  - Warning (precautionary, not immediately hazardous): a momentary audible signal, flashing until
 *    acknowledged, then steady until the cause has gone (7.4). Left unacknowledged, it is
 *    repeated within 5 minutes (7.6.2).
 *  - Caution: steady, no sound, nothing to acknowledge (7.5). This simulator raises none.
 *  - Alarms and warnings are acknowledged one at a time (9.9); all sound can be silenced for a
 *    short time with one action (9.10), and an alarm's sound starts again after 30 seconds (7.3.5).
 *
 * WHICH radar alert has WHICH priority follows the radar standard IEC 62388:2013 (read 13 Nov
 * 2026): a CPA/TCPA violation is an ALARM (11.7.1.1); a new target in a zone (11.7.2.1), a lost
 * target (11.7.3, 11.7.4), target capacity exceeded (11.3.5.1) and the failure of a sensor in use
 * (16.1.9.1) are WARNINGS; target capacity about to be exceeded, at a nominal 95%, is a CAUTION
 * (11.3.5.1 and its test). The alerts this simulator adds of its own (time for action, wrong
 * order, target manoeuvre, poor ground reference, trial, anchor watch) are given as warnings.
 *
 * HOW each is shown and sounded follows IEC 62288:2014, Table 2: an unacknowledged alarm is red,
 * flashing, with three short audible signals repeated every 7 s to 10 s; an unacknowledged warning
 * is yellowish orange, flashing, with two short audible signals; a caution is yellow and silent.
 */
export type AlertPriority = "alarm" | "warning" | "caution";

/** Kinds of ARPA and AIS alert in this simulator. */
export type AlertKind = "cpa" | "lost" | "new" | "guard" | "capacity" | "capacity-near" | "groundref" | "action" | "order" | "malfunction" | "course" | "trial" | "anchor" | "ais-cpa" | "ais-lost";

export function alertPriority(kind: AlertKind): AlertPriority {
  if (kind === "cpa" || kind === "ais-cpa") return "alarm";
  return kind === "capacity-near" ? "caution" : "warning";
}

/** Share of the target capacity at which the caution is given (IEC 62388 11.3.5: "a nominal 95 % full capacity"). */
export const CAPACITY_CAUTION_SHARE = 0.95;
/** Number of tracked targets at which the "capacity about to be exceeded" caution is given: 38 for 40, 19 for 20. */
export function capacityCautionAt(capacity: number): number {
  return Math.floor(capacity * CAPACITY_CAUTION_SHARE + 1e-9);
}

/** Length of one short audible signal and of the pause after it, seconds (this simulator's choice). */
export const SIGNAL_BEEP_SEC = 0.2;
export const SIGNAL_GAP_SEC = 0.2;
/** An alarm's three short signals are repeated this often, seconds (IEC 62288 Table 2: every 7 s to 10 s). */
export const ALARM_SIGNAL_CYCLE_SEC = 8;

/** Whether the tone is on, `t` seconds after an alarm's audible signal began: three short signals, repeated. */
export function alarmToneOn(t: number): boolean {
  if (t < 0) return false;
  const p = t % ALARM_SIGNAL_CYCLE_SEC;
  const step = SIGNAL_BEEP_SEC + SIGNAL_GAP_SEC;
  return p < 3 * step - SIGNAL_GAP_SEC && p % step < SIGNAL_BEEP_SEC;
}

/** Whether the tone is on, `t` seconds after a warning's audible signal began: two short signals, once. */
export function warningToneOn(t: number): boolean {
  if (t < 0) return false;
  const step = SIGNAL_BEEP_SEC + SIGNAL_GAP_SEC;
  return t < 2 * step - SIGNAL_GAP_SEC && t % step < SIGNAL_BEEP_SEC;
}

/** An unacknowledged warning is announced again this often, seconds (MSC.302(87) 7.6.2: not more than 5 minutes). */
export const WARNING_REPEAT_SEC = 300;
/** For this long after a warning is raised (and after each repeat) its audible signal is due, seconds of exercise time. */
export const WARNING_SIGNAL_SEC = 2;
/** "Silence" stops all sound for this long, seconds; an alarm then sounds again (MSC.302(87) 7.3.5). */
export const SILENCE_SEC = 30;

export interface AlertState {
  priority: AlertPriority;
  acked: boolean;
  /** Time the alert was raised, seconds on the same clock as `now`. */
  raisedAt: number;
}

/**
 * The audible signal to make now: "alarm" (kept up until acknowledged), "warning" (momentary,
 * repeated every WARNING_REPEAT_SEC while unacknowledged) or "none". `silenced` is true while the
 * operator's temporary silence lasts.
 */
export function alertSound(alerts: AlertState[], now: number, silenced: boolean): "none" | "alarm" | "warning" {
  if (silenced) return "none";
  const open = alerts.filter((a) => !a.acked);
  if (open.some((a) => a.priority === "alarm")) return "alarm";
  for (const a of open) {
    if (a.priority !== "warning") continue;
    const age = Math.max(0, now - a.raisedAt);
    if (age % WARNING_REPEAT_SEC < WARNING_SIGNAL_SEC) return "warning";
  }
  return "none";
}

/** The alert the ACK key acknowledges next: alarms before warnings, the oldest first. Null when nothing waits. */
export function nextToAcknowledge<T extends AlertState>(alerts: T[]): T | null {
  const open = alerts.filter((a) => !a.acked && a.priority !== "caution");
  if (open.length === 0) return null;
  const rank = (a: AlertState): number => (a.priority === "alarm" ? 0 : 1);
  return [...open].sort((a, b) => rank(a) - rank(b) || a.raisedAt - b.raisedAt)[0]!;
}
