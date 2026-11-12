import { Scenario } from "../engine/index";
import { SessionRecord } from "./record";
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
  /** Own ship particulars and voyage data typed in by the user (as on an AIS). Starting values are placeholders, not a real ship. */
  ownShip: { name: string; callSign: string; imo: string; mmsi: string; draughtM: number | null; hazardous: string; destination: string; eta: string };
  /** Display palette. */
  displayMode: "day" | "night";
}

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORE_KEY = "radar-sim-store-v1";
export const DEFAULT_PIN = "0000";
export const MAX_RECORDS = 60;

export function emptyStore(): StoreData {
  return {
    version: 1, pin: DEFAULT_PIN, batches: [], records: [], scenarios: [], maps: {}, mapMarks: {},
    scoring: JSON.parse(JSON.stringify(PLACEHOLDER_SCORING)) as ScoringConfig,
    pairSeconds: {}, maxStudentsPerDisplay: 2, targetHoursPerPair: null,
    ownShip: { name: "TRAINING SHIP", callSign: "TRNG1", imo: "0000000", mmsi: "000000000", draughtM: null, hazardous: "None", destination: "", eta: "" },
    displayMode: "day",
  };
}

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
        if (d && d.version === 1) this.data = { ...emptyStore(), ...d, scoring: { ...emptyStore().scoring, ...(d.scoring ?? {}) } };
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
    const b: Batch = { id: `b${Date.now().toString(36)}${this.data.batches.length}`, name: n, students: [], assigned: [] };
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
    this.save();
  }

  setAssigned(batchId: string, ids: string[]): void {
    const b = this.data.batches.find((x) => x.id === batchId);
    if (!b) return;
    b.assigned = [...new Set(ids)];
    this.save();
  }

  /** Newest first; the oldest are dropped beyond MAX_RECORDS. If storage is full, older ones are dropped until it fits. */
  addRecord(r: SessionRecord): boolean {
    this.data.records = [r, ...this.data.records.filter((x) => x.id !== r.id)].slice(0, MAX_RECORDS);
    while (!this.save()) {
      if (this.data.records.length <= 1) return false;
      this.data.records.pop();
    }
    return true;
  }

  removeRecord(id: string): void {
    this.data.records = this.data.records.filter((r) => r.id !== id);
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
