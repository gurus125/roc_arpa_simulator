import type { SessionRecord } from "../train/index";

/**
 * The instructor station's records and class settings kept on the classroom server's disk (server/server.mjs,
 * /api/store), so that they do not depend on one browser and are not limited by its storage. Only for a station
 * that has the server's station key, which the server prints when it starts. Without the classroom server (the
 * page opened as a file, or a copy hosted on a web site) there is nothing here: the browser and the backup file
 * are all there is.
 *
 * Classroom use only: the key and the records travel unencrypted on the network.
 */

/** A record as the server lists it: its short form, a mark of its contents, and whether the server has its replay. */
export interface ServerEntry {
  light: SessionRecord;
  sig: string;
  replay: boolean;
}

export type ServerState = "no-server" | "no-key" | "wrong-key" | "on" | "out-of-reach";

const KEY_AT = "radar-sim-station-key";

export class ServerStore {
  state: ServerState;
  entries: ServerEntry[] = [];
  /** Whether the server holds class settings saved by a station. */
  hasState = false;
  private key = "";

  /** `base`: the server's address, for the tests; the page's own address otherwise. */
  constructor(private kv: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null, private http: boolean, private base = "") {
    try {
      this.key = kv?.getItem(KEY_AT) ?? "";
    } catch {
      this.key = "";
    }
    this.state = !http ? "no-server" : this.key ? "out-of-reach" : "no-key";
  }

  get keySet(): boolean {
    return this.key !== "";
  }

  setKey(key: string): void {
    this.key = key.trim();
    try {
      if (this.key) this.kv?.setItem(KEY_AT, this.key);
      else this.kv?.removeItem(KEY_AT);
    } catch {
      // The key then lasts for this visit only.
    }
    this.state = !this.http ? "no-server" : this.key ? "out-of-reach" : "no-key";
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    const r = await fetch(`${this.base}/api/store/${path}`, { method, headers: { "x-station-key": this.key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data: unknown = null;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    return { status: r.status, data };
  }

  /** Ask the server what it holds. Sets `state`, and the list of records when the key is right. */
  async refresh(): Promise<ServerState> {
    if (!this.http) return (this.state = "no-server");
    try {
      // Asked even without a key: the answer tells a classroom server (which refuses) from a web site that has none.
      const info = await this.call("GET", "info");
      if (info.status === 404) return (this.state = "no-server");
      if (info.status === 401) return (this.state = this.key ? "wrong-key" : "no-key");
      if (info.status !== 200) return (this.state = "out-of-reach");
      // Some web sites answer every address with a page: only the server's own answer counts.
      if ((info.data as { ok?: boolean } | null)?.ok !== true) return (this.state = "no-server");
      this.hasState = !!(info.data as { state?: boolean } | null)?.state;
      const list = await this.call("GET", "history");
      if (list.status === 200 && Array.isArray(list.data)) this.entries = (list.data as ServerEntry[]).filter((e) => e && e.light && typeof e.light.id === "string");
      return (this.state = "on");
    } catch {
      return (this.state = "out-of-reach");
    }
  }

  /** Keep a record on the server: its short form always, the whole record with its replay when given. */
  async putRecord(light: SessionRecord, sig: string, full?: SessionRecord): Promise<boolean> {
    if (this.state !== "on") return false;
    try {
      const r = await this.call("PUT", "record", { light, sig, ...(full ? { full } : {}) });
      if (r.status !== 200) return false;
      const had = this.entries.find((e) => e.light.id === light.id);
      this.entries = [{ light, sig, replay: !!full || !!had?.replay }, ...this.entries.filter((e) => e.light.id !== light.id)];
      return true;
    } catch {
      this.state = "out-of-reach";
      return false;
    }
  }

  /** The whole record with its replay, if the server has it. */
  async getRecord(id: string): Promise<SessionRecord | null> {
    if (this.state !== "on") return null;
    try {
      const r = await this.call("GET", `record?id=${encodeURIComponent(id)}`);
      const rec = r.data as SessionRecord | null;
      return r.status === 200 && rec && rec.id === id ? rec : null;
    } catch {
      this.state = "out-of-reach";
      return null;
    }
  }

  async removeRecord(id: string): Promise<void> {
    if (this.state !== "on") return;
    try {
      await this.call("DELETE", `record?id=${encodeURIComponent(id)}`);
      this.entries = this.entries.filter((e) => e.light.id !== id);
    } catch {
      this.state = "out-of-reach";
    }
  }

  async putState(state: Record<string, unknown>): Promise<boolean> {
    if (this.state !== "on") return false;
    try {
      const ok = (await this.call("PUT", "state", state)).status === 200;
      if (ok) this.hasState = true;
      return ok;
    } catch {
      this.state = "out-of-reach";
      return false;
    }
  }

  async getState(): Promise<Record<string, unknown> | null> {
    if (this.state !== "on") return null;
    try {
      const r = await this.call("GET", "state");
      return r.status === 200 && r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
    } catch {
      this.state = "out-of-reach";
      return null;
    }
  }
}
