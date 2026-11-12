/**
 * Link between student displays and the instructor's monitor.
 *  - Same computer: browser tabs talk through a BroadcastChannel (works when the page is opened as a file).
 *  - Classroom network: when the page is served by `npm run serve`, messages also go through that server.
 * Messages are small status summaries and instructor commands. Nothing here is secure: classroom use only.
 */
export interface StationStatus {
  station: string;
  students: string[];
  batch: string;
  exercise: string;
  time: number;
  running: boolean;
  hdg: number;
  spd: number;
  ordC: number;
  ordS: number;
  rangeNm: number;
  tracks: number;
  alarms: string[];
  answered: string;
  /** Scenario in use and own ship's real position and motion over the ground, for linked own-ship exercises. */
  scenario: string;
  joint: boolean;
  own: { e: number; n: number; cog: number; sog: number };
  /** Real positions relative to own ship (NM east, north) for the instructor's small picture. */
  tg: { e: number; n: number; name: string }[];
  at: number;
}

export type Command =
  | { to: string; cmd: "pause" | "run" }
  | { to: string; cmd: "message"; text: string }
  | { to: string; cmd: "radio"; station: string; from: string; text: string }
  | { to: string; cmd: "weather"; seaState: number; rain: boolean; ducting: boolean; interference: boolean }
  /** Load this scenario (JSON text), join the linked exercise and start, on every display at the same moment. */
  | { to: string; cmd: "startLinked"; scenarioJson: string }
  | { to: string; cmd: "fault"; gyroDeg: number; logKn: number }
  | { to: string; cmd: "target"; id: number; course?: number; speed?: number };

/** `id` marks one message, so that a copy arriving a second way (same-computer channel and server) is dropped. */
type Envelope = ({ kind: "status"; status: StationStatus } | { kind: "command"; command: Command }) & { id?: string };

/** After this many failures in a row the server is treated as out of reach; it is then tried again less often. */
const FAILS_BEFORE_OFFLINE = 3;
const POLL_MS = 2000;
const RETRY_MS = 10000;

export class Link {
  readonly station = `S${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  private statusListeners: ((s: StationStatus) => void)[] = [];
  addStatusListener(f: (s: StationStatus) => void): void {
    this.statusListeners.push(f);
  }
  onCommand: (c: Command) => void = () => {};
  /** "server", "server out of reach (trying again)", "same computer only" or "off". */
  mode = "off";
  private bc: BroadcastChannel | null = null;
  /** The page came from the classroom server, so messages also go through it. */
  private http = false;
  private since = 0;
  private fails = 0;
  private lastTry = 0;
  private contacted = false;
  private sent = 0;
  private seen: string[] = [];

  constructor() {
    try {
      this.bc = new BroadcastChannel("radar-sim-link");
      this.bc.onmessage = (ev) => this.receive(ev.data as Envelope);
      this.mode = "same computer only";
    } catch {
      this.bc = null;
    }
    this.http = typeof location !== "undefined" && location.protocol.startsWith("http");
    if (this.http) {
      this.mode = "server";
      setInterval(() => void this.poll(), POLL_MS);
    }
  }

  private receive(m: Envelope): void {
    if (!m || typeof m !== "object") return;
    if (m.id) {
      if (this.seen.includes(m.id)) return; // already had it by the other way
      this.seen.push(m.id);
      if (this.seen.length > 400) this.seen.splice(0, 200);
    }
    if (m.kind === "status" && m.status.station !== this.station) for (const f of this.statusListeners) f(m.status);
    if (m.kind === "command" && (m.command.to === this.station || m.command.to === "all")) this.onCommand(m.command);
  }

  private send(m0: Envelope): void {
    const m: Envelope = { ...m0, id: `${this.station}-${++this.sent}` };
    this.seen.push(m.id!);
    this.bc?.postMessage(m);
    if (this.http && this.fails < FAILS_BEFORE_OFFLINE) {
      fetch("/api/post", { method: "POST", body: JSON.stringify(m) }).then((r) => {
        if (!r.ok) this.failed();
      }).catch(() => this.failed());
    }
  }

  private failed(): void {
    if (++this.fails >= FAILS_BEFORE_OFFLINE) this.mode = "server out of reach (trying again)";
  }

  private async poll(): Promise<void> {
    if (!this.http) return;
    // Out of reach: keep trying, but less often, and come back by itself when the server answers.
    const now = Date.now();
    if (this.fails >= FAILS_BEFORE_OFFLINE && now - this.lastTry < RETRY_MS) return;
    this.lastTry = now;
    try {
      const r = await fetch(`/api/poll?since=${this.since}`);
      if (!r.ok) return this.failed();
      const d = (await r.json()) as { seq: number; messages: Envelope[] };
      this.fails = 0;
      this.mode = "server";
      if (d.seq < this.since) {
        // The server was started again and counts from nothing: begin again from its start.
        this.since = 0;
        return;
      }
      const first = !this.contacted;
      this.contacted = true;
      this.since = d.seq;
      // On first contact skip the backlog of commands meant for earlier sessions.
      for (const m of d.messages) if (!(first && m.kind === "command")) this.receive(m);
    } catch {
      this.failed();
    }
  }

  sendStatus(s: StationStatus): void {
    this.send({ kind: "status", status: s });
  }

  sendCommand(c: Command): void {
    this.send({ kind: "command", command: c });
  }
}
