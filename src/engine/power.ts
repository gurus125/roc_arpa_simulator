import { World } from "./types";

/**
 * The radar's power and transmitter. Switched on from cold, a magnetron radar warms up before it can
 * transmit; it then waits in STANDBY (no transmission) until it is put to transmit. From standby it
 * transmits at once, inside the 5 s the standard allows (IMO MSC.192(79) 5.8, IEC 62388:2013 6.11.1).
 * A world without a power state is switched on and transmitting, as every scenario starts.
 */
export type RadarPower = "off" | "warming" | "standby" | "transmit";

/**
 * Warm-up after switching on from cold, seconds of exercise time. PLACEHOLDER: the standard allows
 * at most 4 minutes; Bole, Wall and Norris (Radar and ARPA Manual, 3rd edition, 6.2.2) say the
 * warm-up of a magnetron radar "is likely to exceed one and a half minutes".
 */
export const RADAR_WARM_UP_SEC = 90;
/** The longest warm-up the standard allows, seconds. */
export const RADAR_WARM_UP_LIMIT_SEC = 240;

export const radarPower = (w: World): RadarPower => w.radar.power ?? "transmit";
export const radarTransmitting = (w: World): boolean => radarPower(w) === "transmit";

/** Switch on from cold: the warm-up starts. Nothing happens if the radar is already on. */
export function switchRadarOn(w: World): void {
  if (radarPower(w) !== "off") return;
  w.radar.power = "warming";
  w.radar.warmUntil = w.time + RADAR_WARM_UP_SEC;
}

export function switchRadarOff(w: World): void {
  w.radar.power = "off";
  delete w.radar.warmUntil;
}

/** Transmit or go to standby. Returns false when the radar is off or still warming up. */
export function setRadarTransmit(w: World, transmit: boolean): boolean {
  const p = radarPower(w);
  if (p === "off" || p === "warming") return false;
  w.radar.power = transmit ? "transmit" : "standby";
  return true;
}

/** Seconds of warm-up still to run (0 when not warming up). */
export function warmUpLeftSec(w: World): number {
  return radarPower(w) === "warming" ? Math.max(0, (w.radar.warmUntil ?? w.time) - w.time) : 0;
}

/** Called every step: when the warm-up is over the radar goes to standby. */
export function stepRadarPower(w: World): void {
  if (radarPower(w) === "warming" && w.time >= (w.radar.warmUntil ?? 0) - 1e-9) {
    w.radar.power = "standby";
    delete w.radar.warmUntil;
  }
}
