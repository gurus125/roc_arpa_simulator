import type { AttemptRow, AttentionFlag, Batch, ProgressReport, ScoringConfig, SessionRecord } from "../train/index";
import type { ShipBehaviour } from "../engine/index";

/**
 * Link between student displays and the instructor station.
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
  tg: { e: number; n: number; name: string; id?: number }[];
  at: number;
  /** What the instructor should look at on this display now, most urgent first (see train/attention.ts). */
  flags?: AttentionFlag[];
  /** Progress in the exercise, for the class table. */
  prog?: ProgressReport;
  /** The trainee at the controls, and the id of the record being made (for the instructor's observations). */
  ctl?: string;
  recId?: string;
  /** The radar and ARPA settings in use, as short lines, for the instructor's live view. */
  set?: string[];
  /** What the simulator has measured so far in a marked exercise, by subject (see train/assess.ts), shown beside the instructor's checklist. */
  ev?: Record<string, string>;
}

/** The radar picture of a display that the instructor is watching, as a JPEG data URL, with the exercise time. */
export interface LivePicture {
  station: string;
  t: number;
  url: string;
}

/** The fault controls an instructor station can set on a display (the ids of the display's own controls). */
export const FAULT_IDS = ["gyroErr", "logErr", "hmErr", "vrmErr", "perf", "logFail", "gyroFail", "gnssFail", "sigVideo", "sigSync", "sigAzimuth", "sigHm", "picFreeze", "anchorDrag", "aisRepeat"] as const;

/** What the instructor station keeps for the whole class and sends to every display: batches and assignments, scoring. */
export interface ClassConfig {
  batches: Batch[];
  scoring: ScoringConfig;
  maxStudentsPerDisplay: number;
  targetHoursPerPair: number | null;
  /** Minutes of exercise time after which the next trainee of a group takes the controls; null or left out: they change by hand. */
  changeoverMin?: number | null;
  /** Trainees must log in with their own name and PIN. */
  requireLogin?: boolean;
}

/** A trainee's first PIN, chosen at a display: its digest, for the instructor station to keep (see train/accounts.ts). */
export interface NewAccount {
  batchId: string;
  name: string;
  digest: string;
}

/** A trainee asks the station for his or her own results; the digest of the PIN shows who is asking. */
export interface HistoryRequest {
  station: string;
  batchId: string;
  name: string;
  digest: string;
}

/** The station's answer: that trainee's attempts, oldest first. */
export interface HistoryReply {
  to: string;
  name: string;
  rows: AttemptRow[];
  passPercent: number | null;
}

export type Command =
  | { to: string; cmd: "pause" | "run" }
  | { to: string; cmd: "message"; text: string }
  | { to: string; cmd: "radio"; station: string; from: string; text: string }
  | { to: string; cmd: "weather"; seaState: number; rain: boolean; ducting: boolean; interference: boolean; rainPct?: number; windFrom?: number; windKn?: number; curSet?: number; curDrift?: number; /** Visibility, NM; null: good again; left out: no change. */ visNm?: number | null; /** Swell: from (degrees) and height (m, 0 none). */ swellFrom?: number; swellM?: number; /** Tide: off, streams and height, or height only; hours from HW at the start; neaps 0 to springs 100. */ tide?: "off" | "on" | "height"; tideHw?: number; springsPct?: number }
  /** A vessel of a catalogue type put on the display's picture, at a true bearing and range from its own ship. */
  | { to: string; cmd: "addTarget"; name: string; typeId: string; bearing: number; rangeNm: number; course: number; speed: number }
  | { to: string; cmd: "removeTarget"; id: number }
  /** Random traffic round the display's own ship: the same seed gives every display the same ships. */
  | { to: string; cmd: "traffic"; seed: number; count: number; minNm: number; maxNm: number; threats: number; replace: boolean }
  | { to: string; cmd: "shipRules"; mode: ShipBehaviour; ship?: number | null }
  /** Load this scenario (JSON text), join the linked exercise and start, on every display at the same moment. */
  | { to: string; cmd: "startLinked"; scenarioJson: string }
  | { to: string; cmd: "fault"; gyroDeg: number; logKn: number }
  | { to: string; cmd: "target"; id: number; course?: number; speed?: number }
  /** The instructor station is watching this display's radar picture (sent every few seconds), or has stopped. */
  | { to: string; cmd: "watch"; on: boolean }
  /** Start a practical examination: these exercises, one after the other. `examId` marks the sitting. */
  | { to: string; cmd: "startExam"; examId: string; name: string; parts: string[] }
  /** Start this exercise (an ARPA, radar or plotting exercise id, or "roc-" and an ROC exercise). */
  | { to: string; cmd: "startExercise"; id: string }
  /** Set these fault controls (FAULT_IDS) to these values. */
  | { to: string; cmd: "faults"; values: Record<string, number | boolean> }
  /** Take the display's exercise back by this many seconds (ships, weather and faults as they were then). */
  | { to: string; cmd: "rewind"; seconds: number }
  /** Start the display's exercise (or its free scenario) again from the beginning. */
  | { to: string; cmd: "restart" }
  /** A track for one of the display's targets: points as true bearing and range from its own ship now, in order. No points: taken off its track. */
  | { to: string; cmd: "track"; id: number; points: { bearing: number; rangeNm: number }[] };

/** `id` marks one message, so that a copy arriving a second way (same-computer channel and server) is dropped. */
type Envelope = (
  | { kind: "status"; status: StationStatus }
  | { kind: "command"; command: Command }
  /** A display's exercise record, for the instructor station (sent when an exercise is finished or its debrief saved). */
  | { kind: "record"; record: SessionRecord }
  /** The instructor station's batches and scoring, for every display. */
  | { kind: "config"; config: ClassConfig }
  | { kind: "picture"; picture: LivePicture }
  | { kind: "account"; account: NewAccount }
  | { kind: "historyRequest"; request: HistoryRequest }
  | { kind: "history"; reply: HistoryReply }
) & { id?: string };

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
  onRecord: (r: SessionRecord) => void = () => {};
  onConfig: (c: ClassConfig) => void = () => {};
  onPicture: (p: LivePicture) => void = () => {};
  onAccount: (a: NewAccount) => void = () => {};
  onHistoryRequest: (r: HistoryRequest) => void = () => {};
  onHistory: (r: HistoryReply) => void = () => {};
  /** "server", "server out of reach (trying again)", "same computer only", "no classroom server at this address ..." or "off". */
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
  /** The page came from a web site that has no classroom server (a hosted copy): only the same-computer channel works. */
  private noServer = false;

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
    if (m.kind === "record" && m.record && typeof m.record.id === "string") this.onRecord(m.record);
    if (m.kind === "config" && m.config && Array.isArray(m.config.batches)) this.onConfig(m.config);
    if (m.kind === "picture" && m.picture && m.picture.station !== this.station) this.onPicture(m.picture);
    if (m.kind === "account" && m.account && typeof m.account.name === "string") this.onAccount(m.account);
    if (m.kind === "historyRequest" && m.request && m.request.station !== this.station) this.onHistoryRequest(m.request);
    if (m.kind === "history" && m.reply && m.reply.to === this.station) this.onHistory(m.reply);
  }

  private send(m0: Envelope): void {
    const m: Envelope = { ...m0, id: `${this.station}-${++this.sent}` };
    this.seen.push(m.id!);
    this.bc?.postMessage(m);
    if (this.http && !this.noServer && this.fails < FAILS_BEFORE_OFFLINE) {
      fetch("/api/post", { method: "POST", body: JSON.stringify(m) }).then((r) => {
        if (!r.ok) this.failed();
      }).catch(() => this.failed());
    }
  }

  private failed(): void {
    if (++this.fails >= FAILS_BEFORE_OFFLINE) this.mode = "server out of reach (trying again)";
  }

  private async poll(): Promise<void> {
    if (!this.http || this.noServer) return;
    // Out of reach: keep trying, but less often, and come back by itself when the server answers.
    const now = Date.now();
    if (this.fails >= FAILS_BEFORE_OFFLINE && now - this.lastTry < RETRY_MS) return;
    this.lastTry = now;
    try {
      const r = await fetch(`/api/poll?since=${this.since}`);
      if (r.status === 404 && !this.contacted) {
        // A hosted copy of the page (on a web site, not the classroom server): there is nothing to poll.
        this.noServer = true;
        this.mode = "no classroom server at this address (a hosted copy): linked only with tabs of this browser on this computer";
        return;
      }
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

  /** Send an exercise record to the instructor station. A long record is thinned (every other frame) to stay small. */
  sendRecord(r: SessionRecord): void {
    let rec = r;
    while (JSON.stringify(rec).length > 900_000 && rec.frames.length > 20) rec = { ...rec, frames: rec.frames.filter((_, i) => i % 2 === 0) };
    this.send({ kind: "record", record: rec });
  }

  sendAccount(a: NewAccount): void {
    this.send({ kind: "account", account: a });
  }

  sendHistoryRequest(r: HistoryRequest): void {
    this.send({ kind: "historyRequest", request: r });
  }

  sendHistory(r: HistoryReply): void {
    this.send({ kind: "history", reply: r });
  }

  sendPicture(p: LivePicture): void {
    this.send({ kind: "picture", picture: p });
  }

  sendConfig(c: ClassConfig): void {
    this.send({ kind: "config", config: c });
  }
}
