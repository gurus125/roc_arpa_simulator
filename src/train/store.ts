import { Scenario } from "../engine/index";
import { Observation, SessionRecord } from "./record";
import { PLACEHOLDER_SCORING, ScoringConfig } from "./session";

/**
 * Everything the simulator remembers between sessions on one computer: instructor PIN, batches,
 * assignments, exercise records, instructor-made scenarios and the scoring settings. Kept in the
 * browser's local storage (or any object with the same two methods, for tests).
 *
 * The PIN only keeps students out of the instructor pages in a classroom. It is NOT security:
 * anyone with access to the computer's browser data can read or clear it.
 */
export interface Batch {
  id: string;
  name: string;
  students: string[];
  /** Exercise ids assigned to this batch (ARPA exercise ids and ROC exercise kinds). */
  assigned: string[];
  /** For each trainee who has chosen a PIN: its digest, by name (see train/accounts.ts). The PIN itself is not kept. */
  pins?: Record<string, string>;
}

export interface StoreData {
  version: 1;
  pin: string;
  batches: Batch[];
  records: SessionRecord[];
  scenarios: Scenario[];
  /** Radar maps: named sets of navigation lines (positions in NM), drawn by the user on the radar. */
  maps: Record<string, { e: number; n: number }[][]>;
  /** Nav marks saved with the map of the same name. */
  mapMarks: Record<string, { e: number; n: number }[]>;
  scoring: ScoringConfig;
  /** Simulated-plus-paused time each pair of students has spent at the display, seconds of wall time. */
  pairSeconds: Record<string, number>;
  /** Students allowed at one display, and the hours each pair should get. Placeholders from the plan's open question. */
  maxStudentsPerDisplay: number;
  targetHoursPerPair: number | null;
  /** Minutes of exercise time after which the next trainee of a group takes the controls; null or left out: they change by hand. */
  changeoverMin?: number | null;
  /** Trainees must log in with their own name and PIN (see train/accounts.ts). Left out: names are chosen or typed freely. */
  requireLogin?: boolean;
  /** The instructor's observation checklist, one item a line; left out: DEFAULT_OBSERVATION_ITEMS. */
  obsItems?: string[];
  /**
   * Older records without their replay (see lightRecord), newest first: when a record is dropped to make room,
   * what the trainee file, the class comparison and the comparison of assessors need is kept here.
   */
  archive?: SessionRecord[];
  /** Observations ticked at the station, by the id of the display's record, until (and after) that record arrives. */
  pendingObs?: Record<string, { items: Observation[]; notes: string }>;
  /** The parts (exercise ids) of the two practical examinations, as the instructor has set them; left out: DEFAULT_EXAMS. */
  exams?: { roc: string[]; arpa: string[] };
  /** Own ship particulars and voyage data typed in by the user (as on an AIS). Starting values are placeholders, not a real ship. */
  ownShip: {
    name: string; callSign: string; imo: string; mmsi: string; draughtM: number | null; hazardous: string; destination: string; eta: string;
    /** Where the radar antenna is from the reference point (CCRP), metres ahead (+) and to starboard (+). Only places the antenna mark on the outline. Older stores: absent, read as 0. */
    antennaAheadM?: number; antennaStbdM?: number;
  };
  /** Display palette. */
  displayMode: "day" | "night";
  /** Keys of a hardware control panel chosen by the user, by function (see ui/panel-map.ts). Empty: the default keys. */
  panelKeys: Record<string, string>;
  /**
   * Two sets of control settings the user has stored, to recall later (IEC 62388 13.5.1: at least two).
   * Each maps a control's id to its value (or checked state). Null: nothing stored.
   */
  userSettings: (Record<string, string | boolean> | null)[];
}

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORE_KEY = "radar-sim-store-v1";
export const DEFAULT_PIN = "0000";
export const MAX_RECORDS = 60;
/** Older records kept without their replay. */
export const MAX_ARCHIVE = 300;

/**
 * A record without its replay: no frames, coastline or radio log, only the flagged events, and no criteria rows
 * or debrief questions. What is left is what the trainee file and the comparisons use: who, when, the marked
 * items, who was at the controls, the observations, the decisions and the measured facts.
 */
export function lightRecord(r: SessionRecord): SessionRecord {
  const light: SessionRecord = {
    ...r, names: {}, coasts: [], frames: [], events: r.events.filter((e) => e.flag !== undefined),
    result: r.result ? { ...r.result, debrief: [] } : null,
    ...(r.criteria ? { criteria: { ...r.criteria, rows: [] } } : {}),
  };
  delete light.comms;
  return light;
}

export function emptyStore(): StoreData {
  return {
    version: 1, pin: DEFAULT_PIN, batches: [], records: [], scenarios: [], maps: {}, mapMarks: {},
    scoring: JSON.parse(JSON.stringify(PLACEHOLDER_SCORING)) as ScoringConfig,
    pairSeconds: {}, maxStudentsPerDisplay: 2, targetHoursPerPair: null,
    ownShip: { name: "TRAINING SHIP", callSign: "TRNG1", imo: "0000000", mmsi: "000000000", draughtM: null, hazardous: "None", destination: "", eta: "", antennaAheadM: 0, antennaStbdM: 0 },
    displayMode: "day",
    panelKeys: {},
    userSettings: [null, null],
  };
}

/**
 * What a class is, apart from its records: the batches with their trainees (and the digests of their PINs), the
 * scoring settings, the examination parts, the checklist, the limits, the display time and the instructor's own
 * scenarios. This is what goes into a backup and onto the classroom server. The instructor PIN is not part of it.
 */
export type ClassState = Pick<StoreData, "batches" | "scoring" | "pairSeconds" | "maxStudentsPerDisplay" | "targetHoursPerPair" | "scenarios"> &
  Partial<Pick<StoreData, "exams" | "obsItems" | "changeoverMin" | "requireLogin">>;

export const BACKUP_KIND = "radar-sim-backup";

/** A short mark of a text (FNV-1a, 32 bits, as hexadecimal): to tell whether something has changed, not for security. */
export function textMark(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** A mark of a record's contents, leaving out the bulk of its replay (only the number of frames counts). */
export function recordMark(r: SessionRecord): string {
  return textMark(JSON.stringify({ ...r, frames: r.frames.length, coasts: r.coasts.length }));
}

const isRecord = (r: unknown): r is SessionRecord => {
  const x = r as Partial<SessionRecord> | null;
  return !!x && typeof x.id === "string" && x.id !== "" && typeof x.startedIso === "string" && Array.isArray(x.students) && Array.isArray(x.frames) && Array.isArray(x.events) && typeof x.title === "string";
};

export const pairKey = (students: string[]): string => [...students].map((s) => s.trim().toLowerCase()).filter(Boolean).sort().join(" + ");

export class Store {
  data: StoreData;
  private kv: KeyValue | null;

  constructor(kv: KeyValue | null) {
    this.kv = kv;
    this.data = emptyStore();
    try {
      const raw = kv?.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<StoreData>;
        if (d && d.version === 1) {
          // Tolerances and points added in later versions keep their placeholders.
          const def = emptyStore().scoring;
          const sc: Partial<ScoringConfig> = d.scoring ?? {};
          this.data = { ...emptyStore(), ...d, scoring: { ...def, ...sc, tol: { ...def.tol, ...(sc.tol ?? {}) }, points: { ...def.points, ...(sc.points ?? {}) } } };
        }
      }
    } catch {
      // Unreadable data: start empty rather than stop the simulator.
    }
  }

  /** Returns false when the browser refused to store (storage full or blocked). */
  save(): boolean {
    try {
      this.kv?.setItem(STORE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  checkPin(pin: string): boolean {
    return pin === this.data.pin;
  }

  setPin(pin: string): boolean {
    if (!/^\d{4,8}$/.test(pin)) return false;
    this.data.pin = pin;
    return this.save();
  }

  addBatch(name: string): Batch | null {
    const n = name.trim();
    if (!n || this.data.batches.some((b) => b.name.toLowerCase() === n.toLowerCase())) return null;
    // The time and a few random characters: two stations making a batch at the same moment still get different ids.
    const b: Batch = { id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: n, students: [], assigned: [] };
    this.data.batches.push(b);
    this.save();
    return b;
  }

  removeBatch(id: string): void {
    this.data.batches = this.data.batches.filter((b) => b.id !== id);
    this.save();
  }

  setStudents(batchId: string, names: string[]): void {
    const b = this.data.batches.find((x) => x.id === batchId);
    if (!b) return;
    b.students = [...new Set(names.map((s) => s.trim()).filter(Boolean))];
    // A trainee taken off the list loses the account with it.
    if (b.pins) for (const n of Object.keys(b.pins)) if (!b.students.includes(n)) delete b.pins[n];
    this.save();
  }

  /** Keep the digest of a trainee's PIN, or with null take the PIN away (the trainee chooses a new one at the next login). */
  setStudentPin(batchId: string, name: string, digest: string | null): boolean {
    const b = this.data.batches.find((x) => x.id === batchId);
    if (!b || !b.students.includes(name)) return false;
    if (digest === null) {
      if (b.pins) delete b.pins[name];
    } else (b.pins ??= {})[name] = digest;
    return this.save();
  }

  setAssigned(batchId: string, ids: string[]): void {
    const b = this.data.batches.find((x) => x.id === batchId);
    if (!b) return;
    b.assigned = [...new Set(ids)];
    this.save();
  }

  /** Newest first; the oldest are dropped beyond MAX_RECORDS. If storage is full, older ones are dropped until it fits. */
  addRecord(r0: SessionRecord): boolean {
    // A display sends a record again when the trainees save their debrief: what the assessor and the instructor
    // added to it at this station (the decision, the observations) stays.
    const old = this.data.records.find((x) => x.id === r0.id);
    const r: SessionRecord = old ? {
      ...r0,
      ...(r0.assessor === undefined && old.assessor ? { assessor: old.assessor } : {}),
      ...(r0.assessorBy === undefined && old.assessorBy ? { assessorBy: old.assessorBy } : {}),
      ...(r0.observations === undefined && old.observations ? { observations: old.observations } : {}),
      ...(r0.observerNotes === undefined && old.observerNotes ? { observerNotes: old.observerNotes } : {}),
      ...(r0.debriefDone === undefined && old.debriefDone ? { debriefDone: old.debriefDone } : {}),
    } : r0;
    const all = [r, ...this.data.records.filter((x) => x.id !== r.id)];
    this.data.records = all.slice(0, MAX_RECORDS);
    this.toArchive(all.slice(MAX_RECORDS));
    if (this.data.archive) this.data.archive = this.data.archive.filter((x) => x.id !== r.id);
    while (!this.save()) {
      // Storage is full: the oldest replay goes first (its light copy stays), then the oldest of the archive.
      if (this.data.records.length > 1) this.toArchive([this.data.records.pop()!]);
      else if (this.data.archive && this.data.archive.length > 0) this.data.archive.pop();
      else return false;
    }
    return true;
  }

  private toArchive(dropped: SessionRecord[]): void {
    if (dropped.length === 0) return;
    const ids = new Set(dropped.map((d) => d.id));
    this.data.archive = [...dropped.map(lightRecord), ...(this.data.archive ?? []).filter((x) => !ids.has(x.id))].slice(0, MAX_ARCHIVE);
  }

  /** Every exercise on record, newest first: the full records, then the older ones kept without their replay. */
  history(): SessionRecord[] {
    return [...this.data.records, ...(this.data.archive ?? [])];
  }

  /** The class apart from its records (see ClassState). */
  classState(): ClassState {
    const d = this.data;
    return {
      batches: d.batches, scoring: d.scoring, pairSeconds: d.pairSeconds, maxStudentsPerDisplay: d.maxStudentsPerDisplay, targetHoursPerPair: d.targetHoursPerPair, scenarios: d.scenarios,
      ...(d.exams ? { exams: d.exams } : {}), ...(d.obsItems ? { obsItems: d.obsItems } : {}), ...(d.changeoverMin ? { changeoverMin: d.changeoverMin } : {}), ...(d.requireLogin ? { requireLogin: true } : {}),
    };
  }

  /** Take a class from a backup or from the classroom server in place of this one. The records and the instructor PIN stay. False when it is not a class. */
  applyClassState(s: unknown): boolean {
    const x = s as Partial<ClassState> | null;
    if (!x || !Array.isArray(x.batches) || !x.batches.every((b) => b && typeof b.id === "string" && typeof b.name === "string" && Array.isArray(b.students) && Array.isArray(b.assigned))) return false;
    const def = emptyStore();
    const sc: Partial<ScoringConfig> = x.scoring ?? {};
    const d = this.data;
    d.batches = x.batches;
    d.scoring = { ...def.scoring, ...sc, tol: { ...def.scoring.tol, ...(sc.tol ?? {}) }, points: { ...def.scoring.points, ...(sc.points ?? {}) } };
    d.pairSeconds = x.pairSeconds && typeof x.pairSeconds === "object" ? x.pairSeconds : {};
    d.maxStudentsPerDisplay = typeof x.maxStudentsPerDisplay === "number" ? Math.min(4, Math.max(1, Math.round(x.maxStudentsPerDisplay))) : def.maxStudentsPerDisplay;
    d.targetHoursPerPair = typeof x.targetHoursPerPair === "number" ? x.targetHoursPerPair : null;
    if (Array.isArray(x.scenarios)) d.scenarios = x.scenarios;
    if (x.exams) d.exams = x.exams;
    else delete d.exams;
    if (Array.isArray(x.obsItems)) d.obsItems = x.obsItems;
    else delete d.obsItems;
    d.changeoverMin = typeof x.changeoverMin === "number" ? x.changeoverMin : null;
    d.requireLogin = !!x.requireLogin;
    return this.save();
  }

  /** Add records this store does not have: with their replay while there is room, otherwise in short. Returns how many were added. */
  mergeRecords(list: unknown[]): number {
    const have = new Set(this.history().map((r) => r.id));
    const fresh = list.filter(isRecord).filter((r) => !have.has(r.id) && (have.add(r.id), true));
    if (fresh.length === 0) return 0;
    const newest = (a: SessionRecord, b: SessionRecord): number => b.startedIso.localeCompare(a.startedIso);
    const full = [...this.data.records, ...fresh.filter((r) => r.frames.length > 0)].sort(newest);
    this.data.records = full.slice(0, MAX_RECORDS);
    this.data.archive = [...(this.data.archive ?? []), ...full.slice(MAX_RECORDS).map(lightRecord), ...fresh.filter((r) => r.frames.length === 0)].sort(newest).slice(0, MAX_ARCHIVE);
    while (!this.save()) {
      if (this.data.records.length > 1) this.toArchive([this.data.records.pop()!]);
      else if (this.data.archive.length > 0) this.data.archive.pop();
      else break;
    }
    return fresh.length;
  }

  /** Everything worth keeping, as text for a file: the class and every record held here. */
  backup(nowIso: string): string {
    return JSON.stringify({ kind: BACKUP_KIND, version: 1, savedIso: nowIso, state: this.classState(), records: this.history() });
  }

  /**
   * Read a backup. It only adds: the records this store does not have, and the batches it does not have. On a
   * station with no batch at all (a new browser) the whole class of the backup is taken, settings included.
   */
  restore(text: string): { ok: true; records: number; batches: number; settings: boolean } | { ok: false; error: string } {
    let b: { kind?: unknown; state?: Partial<ClassState>; records?: unknown };
    try {
      b = JSON.parse(text) as typeof b;
    } catch {
      return { ok: false, error: "This file is not a backup: it could not be read." };
    }
    if (!b || b.kind !== BACKUP_KIND || !b.state || !Array.isArray(b.state.batches)) return { ok: false, error: "This file is not a backup of the simulator's records." };
    let batches = 0;
    let settings = false;
    if (this.data.batches.length === 0) {
      if (!this.applyClassState(b.state)) return { ok: false, error: "The class in this backup could not be read." };
      batches = this.data.batches.length;
      settings = true;
    } else {
      for (const x of b.state.batches) {
        if (!x || typeof x.id !== "string" || typeof x.name !== "string" || !Array.isArray(x.students) || !Array.isArray(x.assigned)) continue;
        if (this.data.batches.some((y) => y.id === x.id || y.name.toLowerCase() === x.name.toLowerCase())) continue;
        this.data.batches.push(x);
        batches++;
      }
    }
    const records = this.mergeRecords(Array.isArray(b.records) ? b.records : []);
    this.save();
    return { ok: true, records, batches, settings };
  }

  removeRecord(id: string): void {
    this.data.records = this.data.records.filter((r) => r.id !== id);
    if (this.data.archive) this.data.archive = this.data.archive.filter((r) => r.id !== id);
    this.save();
  }

  saveScenario(sc: Scenario): void {
    this.data.scenarios = [sc, ...this.data.scenarios.filter((s) => s.id !== sc.id)];
    this.save();
  }

  removeScenario(id: string): void {
    this.data.scenarios = this.data.scenarios.filter((s) => s.id !== id);
    this.save();
  }

  addPairTime(students: string[], seconds: number): void {
    const k = pairKey(students);
    if (!k || seconds <= 0) return;
    this.data.pairSeconds[k] = (this.data.pairSeconds[k] ?? 0) + seconds;
  }

  pairHours(students: string[]): number {
    return (this.data.pairSeconds[pairKey(students)] ?? 0) / 3600;
  }
}
