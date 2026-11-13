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
 * WHICH radar alert has WHICH priority is laid down in the radar test standard IEC 62388, which
 * has not been read for this project. The allocation below follows the definitions in MSC.302(87)
 * and is this simulator's own judgement: CPA/TCPA danger is an alarm; the rest are warnings.
 */
export type AlertPriority = "alarm" | "warning" | "caution";

/** Kinds of ARPA and AIS alert in this simulator. */
export type AlertKind = "cpa" | "lost" | "new" | "guard" | "capacity" | "groundref" | "action" | "order" | "malfunction" | "course" | "trial" | "anchor" | "ais-cpa" | "ais-lost";

export function alertPriority(kind: AlertKind): AlertPriority {
  return kind === "cpa" || kind === "ais-cpa" ? "alarm" : "warning";
}

/** An unacknowledged warning is announced again this often, seconds (MSC.302(87) 7.6.2: not more than 5 minutes). */
export const WARNING_REPEAT_SEC = 300;
/** Length of the momentary audible signal of a warning, seconds (this simulator's choice). */
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
