import { Target, World } from "../engine/index";

/**
 * Linked own-ship stations: every display taking part in the same scenario shows the other
 * displays' own ships as ordinary radar targets (ships with AIS), so two or more trainee ships
 * can meet in one exercise. Each station reports its own ship's real position, course and
 * speed over the ground; between reports the others run it on at that course and speed.
 */
export interface RemoteShip {
  station: string;
  name: string;
  e: number;
  n: number;
  cog: number;
  sog: number;
  /** Wall-clock time the report was received, milliseconds. */
  at: number;
}

export const REMOTE_ID_BASE = 9000;
/** A remote ship is dropped when nothing has been heard from it for this long, milliseconds. */
export const REMOTE_TIMEOUT_MS = 10000;

/** Stable target id for a station name. */
export function remoteId(station: string): number {
  let h = 0;
  for (const c of station) h = (h * 31 + c.charCodeAt(0)) % 900;
  return REMOTE_ID_BASE + h;
}

/**
 * Bring the world's remote own ships into line with the latest reports: add new ones, update
 * known ones, remove silent ones. `speedFactor` is how fast this display's clock runs compared
 * with real time (reports are in real time). Returns the ids added or removed.
 */
export function applyRemoteShips(w: World, remotes: RemoteShip[], nowMs: number, speedFactor = 1): { added: number[]; removed: number[] } {
  const live = remotes.filter((r) => nowMs - r.at <= REMOTE_TIMEOUT_MS);
  const ids = new Set(live.map((r) => remoteId(r.station)));
  const removed = w.targets.filter((t) => t.id >= REMOTE_ID_BASE && !ids.has(t.id)).map((t) => t.id);
  if (removed.length > 0) w.targets = w.targets.filter((t) => !removed.includes(t.id));
  const added: number[] = [];
  for (const r of live) {
    const id = remoteId(r.station);
    // The report is `age` seconds old in real time: run it on to now.
    const ageH = Math.max(0, nowMs - r.at) / 3.6e6;
    const a = (r.cog * Math.PI) / 180;
    const pos = { e: r.e + Math.sin(a) * r.sog * ageH, n: r.n + Math.cos(a) * r.sog * ageH };
    let t = w.targets.find((x) => x.id === id);
    if (!t) {
      const nt: Target = { id, name: r.name, kind: "ship", pos, course: r.cog, speed: r.sog, rcs: 1, height: 20, events: [], nextEvent: 0, ais: true };
      w.targets.push(nt);
      added.push(id);
      t = nt;
    }
    t.name = r.name;
    t.pos = pos;
    t.course = r.cog;
    // stepWorld moves targets on this display's clock, so match real-time speed to it.
    t.speed = speedFactor > 0 ? r.sog / speedFactor : 0;
  }
  return { added, removed };
}

export const isRemote = (t: { id: number }): boolean => t.id >= REMOTE_ID_BASE;
