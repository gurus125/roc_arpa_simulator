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

type Envelope = { kind: "status"; status: StationStatus } | { kind: "command"; command: Command };

export class Link {
  readonly station = `S${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  private statusListeners: ((s: StationStatus) => void)[] = [];
  addStatusListener(f: (s: StationStatus) => void): void {
    this.statusListeners.push(f);
  }
  onCommand: (c: Command) => void = () => {};
  /** "server", "same computer only" or "off". */
  mode = "off";
  private bc: BroadcastChannel | null = null;
  private http = false;
  private since = 0;
  private fails = 0;

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
      setInterval(() => void this.poll(), 2000);
    }
  }

  private receive(m: Envelope): void {
    if (!m || typeof m !== "object") return;
    if (m.kind === "status" && m.status.station !== this.station) for (const f of this.statusListeners) f(m.status);
    if (m.kind === "command" && (m.command.to === this.station || m.command.to === "all")) this.onCommand(m.command);
  }

  private send(m: Envelope): void {
    this.bc?.postMessage(m);
    if (this.http) {
      fetch("/api/post", { method: "POST", body: JSON.stringify(m) }).then((r) => {
        if (!r.ok) this.failed();
      }).catch(() => this.failed());
    }
  }

  private failed(): void {
    if (++this.fails >= 3) {
      this.http = false;
      this.mode = this.bc ? "same computer only" : "off";
    }
  }

  private async poll(): Promise<void> {
    if (!this.http) return;
    try {
      const r = await fetch(`/api/poll?since=${this.since}`);
      if (!r.ok) return this.failed();
      const d = (await r.json()) as { seq: number; messages: Envelope[] };
      const first = this.since === 0;
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
