import type { SessionRecord } from "../train/index";

/**
 * The instructor station's records and class settings kept on the classroom server's disk (server/server.mjs,
 * /api/store), so that they do not depend on one browser and are not limited by its storage. Only for a station
 * that has the server's station key, which the server prints when it starts. Without the classroom server (the
 * page opened as a file, or a copy hosted on a web site) there is nothing here: the browser and the backup file
 * are all there is.
 *
 * An instructor can also log in with an account of his or her own (made by an administrator at the station); the
 * server then knows who did what. A login lasts a working day and is kept in this browser until then.
 *
 * Classroom use only: the key, the passwords and the records travel unencrypted on the network.
 */

/** A record as the server lists it: its short form, a mark of its contents, and whether the server has its replay. */
export interface ServerEntry {
  light: SessionRecord;
  sig: string;
  replay: boolean;
}

export type ServerState = "no-server" | "no-key" | "wrong-key" | "on" | "out-of-reach";

/** Who the server takes this station to be. */
export interface ServerUser {
  name: string;
  /** "station" when the station key is in use. */
  role: "admin" | "instructor" | "station";
  /** May manage the accounts, put the records back to a backup and import. */
  admin: boolean;
  accounts: number;
  keyEnabled: boolean;
}

/** A backup the server keeps: once a day, and before a restore or an import, or when asked. */
export interface ServerBackup {
  id: string;
  kind: "daily" | "manual" | "before-restore" | "before-import";
  records: number;
  replays: number;
  state: boolean;
}

export interface AuditLine {
  t: string;
  who: string;
  action: string;
  detail: string;
  from?: string;
}

const KEY_AT = "radar-sim-station-key";
const LOGIN_AT = "radar-sim-station-login";

export class ServerStore {
  state: ServerState;
  entries: ServerEntry[] = [];
  /** Whether the server holds class settings saved by a station. */
  hasState = false;
  /** Who the server takes this station to be, when it is on. */
  user: ServerUser | null = null;
  /** The server has instructors' accounts, so a login is offered. */
  loginOffered = false;
  /** The server still takes the station key. */
  keyOffered = true;
  private key = "";
  private login: { token: string; name: string; expiresIso: string } | null = null;

  /** `base`: the server's address, for the tests; the page's own address otherwise. */
  constructor(private kv: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null, private http: boolean, private base = "") {
    try {
      this.key = kv?.getItem(KEY_AT) ?? "";
      const l = JSON.parse(kv?.getItem(LOGIN_AT) ?? "null") as ServerStore["login"];
      this.login = l && typeof l.token === "string" && Date.parse(l.expiresIso) > Date.now() ? l : null;
    } catch {
      this.key = "";
      this.login = null;
    }
    this.state = !http ? "no-server" : this.key || this.login ? "out-of-reach" : "no-key";
  }

  /** The instructor logged in at this station, if any. */
  get loggedIn(): string | null {
    return this.login?.name ?? null;
  }

  private keepLogin(l: ServerStore["login"]): void {
    this.login = l;
    try {
      if (l) this.kv?.setItem(LOGIN_AT, JSON.stringify(l));
      else this.kv?.removeItem(LOGIN_AT);
    } catch {
      // The login then lasts for this visit only.
    }
  }

  /** Log in with an instructor's account. Null when it worked, else what the server said. */
  async logIn(name: string, password: string): Promise<string | null> {
    if (!this.http) return "No classroom server at this address.";
    try {
      const r = await fetch(`${this.base}/api/login`, { method: "POST", body: JSON.stringify({ name, password }) });
      const d = (await r.json().catch(() => null)) as { token?: string; name?: string; expiresIso?: string; error?: string } | null;
      if (r.status !== 200 || !d?.token) return d?.error ?? "The server refused the login.";
      this.keepLogin({ token: d.token, name: d.name ?? name, expiresIso: d.expiresIso ?? "" });
      await this.refresh();
      return null;
    } catch {
      return "The classroom server is out of reach.";
    }
  }

  async logOut(): Promise<void> {
    if (this.login) {
      try {
        await fetch(`${this.base}/api/logout`, { method: "POST", headers: { authorization: `Bearer ${this.login.token}` } });
      } catch {
        // Forgotten here whatever the server says.
      }
    }
    this.keepLogin(null);
    this.user = null;
    await this.refresh();
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
    this.state = !this.http ? "no-server" : this.key || this.login ? "out-of-reach" : "no-key";
  }

  /** The login when there is one, else the station key. */
  private headers(): Record<string, string> {
    return this.login ? { authorization: `Bearer ${this.login.token}` } : { "x-station-key": this.key };
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    const r = await fetch(`${this.base}/api/store/${path}`, { method, headers: this.headers(), ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
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
      let info = await this.call("GET", "info");
      if (info.status === 404) return (this.state = "no-server");
      if (info.status === 401) {
        const d = info.data as { login?: boolean; keyEnabled?: boolean } | null;
        this.loginOffered = !!d?.login;
        this.keyOffered = d?.keyEnabled !== false;
        this.user = null;
        // A login that has ended: forgotten, and the key (if any) tried instead.
        if (this.login) {
          this.keepLogin(null);
          if (!this.key) return (this.state = "no-key");
          info = await this.call("GET", "info");
          if (info.status === 401) return (this.state = "wrong-key");
        } else return (this.state = this.key ? "wrong-key" : "no-key");
      }
      if (info.status !== 200) return (this.state = "out-of-reach");
      // Some web sites answer every address with a page: only the server's own answer counts.
      if ((info.data as { ok?: boolean } | null)?.ok !== true) return (this.state = "no-server");
      this.hasState = !!(info.data as { state?: boolean } | null)?.state;
      // Older servers have no accounts and do not answer this.
      const me = await this.call("GET", "whoami");
      this.user = me.status === 200 && me.data && typeof me.data === "object" ? (me.data as ServerUser) : { name: "station key", role: "station", admin: false, accounts: 0, keyEnabled: true };
      this.loginOffered = this.user.accounts > 0;
      this.keyOffered = this.user.keyEnabled;
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

  /** A call that only makes sense while the server is on: its answer's data, or the error the server gave. */
  private async ask<T>(method: string, path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    if (this.state !== "on") return { ok: false, error: "The classroom server is not in use at this station." };
    try {
      const r = await this.call(method, path, body);
      if (r.status === 200) return { ok: true, data: r.data as T };
      return { ok: false, error: (r.data as { error?: string } | null)?.error ?? `The server answered ${r.status}.` };
    } catch {
      this.state = "out-of-reach";
      return { ok: false, error: "The classroom server is out of reach." };
    }
  }

  backups(): Promise<{ ok: true; data: ServerBackup[] } | { ok: false; error: string }> {
    return this.ask<ServerBackup[]>("GET", "backups");
  }
  backUpNow(): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
    return this.ask<{ id: string }>("POST", "backups", {});
  }
  restoreBackup(id: string): Promise<{ ok: true; data: { records: number } } | { ok: false; error: string }> {
    return this.ask<{ records: number }>("POST", "backups/restore", { id });
  }
  /** Everything the server holds, as one file's text. */
  async exportAll(): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    if (this.state !== "on") return { ok: false, error: "The classroom server is not in use at this station." };
    try {
      const r = await fetch(`${this.base}/api/store/export`, { headers: this.headers() });
      if (r.status !== 200) return { ok: false, error: `The server answered ${r.status}.` };
      return { ok: true, text: await r.text() };
    } catch {
      this.state = "out-of-reach";
      return { ok: false, error: "The classroom server is out of reach." };
    }
  }
  /** A file exported from a classroom server: what this server lacks is added. */
  importAll(text: string): Promise<{ ok: true; data: { added: number; skipped: number; state: boolean } } | { ok: false; error: string }> {
    return this.ask<{ added: number; skipped: number; state: boolean }>("POST", "import", text);
  }
  users(): Promise<{ ok: true; data: { name: string; role: string; createdIso: string }[] } | { ok: false; error: string }> {
    return this.ask<{ name: string; role: string; createdIso: string }[]>("GET", "users");
  }
  addUser(name: string, role: "admin" | "instructor", password: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    return this.ask("POST", "users", { name, role, password });
  }
  removeUser(name: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    return this.ask("DELETE", `users?name=${encodeURIComponent(name)}`);
  }
  setPassword(name: string, password: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    return this.ask("POST", "users/password", { name, password });
  }
  setKeyEnabled(enabled: boolean): Promise<{ ok: true; data: { keyEnabled: boolean } } | { ok: false; error: string }> {
    return this.ask<{ keyEnabled: boolean }>("POST", "key", { enabled });
  }
  audit(n = 100): Promise<{ ok: true; data: AuditLine[] } | { ok: false; error: string }> {
    return this.ask<AuditLine[]>("GET", `audit?n=${n}`);
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
