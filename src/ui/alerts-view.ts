import { AlertPriority, alertPriority } from "../arpa/index";
import { AppState } from "./app";

/** One alert as the operator sees it: ARPA and AIS alerts in one list, each with its priority (see arpa/alerts.ts). */
export interface AlertRow {
  key: string;
  text: string;
  priority: AlertPriority;
  acked: boolean;
  raisedAt: number;
}

export function alertRows(app: AppState): AlertRow[] {
  if (app.roc) return [];
  return [
    ...app.arpa.alarms.map((x) => ({ key: x.key, text: x.text, priority: alertPriority(x.kind), acked: x.acked, raisedAt: x.raisedAt })),
    ...app.ais.alarms.map((x) => ({ key: x.key, text: x.text, priority: alertPriority(x.key.startsWith("ais-cpa") ? "ais-cpa" : "ais-lost"), acked: x.acked, raisedAt: x.raisedAt })),
  ];
}

/** Acknowledge one alert by its key. */
export function acknowledge(app: AppState, key: string): void {
  if (key.startsWith("ais-")) app.ais.ack(key);
  else app.arpa.ack(app.world, key);
}
