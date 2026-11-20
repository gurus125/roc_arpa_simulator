import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { handle } from "../server/server.mjs";

describe("classroom server relay", () => {
  it("relays posted messages to pollers in order, and rejects bad input", async () => {
    const srv = createServer(handle);
    await new Promise((r) => srv.listen(0, r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
      const first = await (await fetch(`${base}/api/poll?since=0`)).json();
      await fetch(`${base}/api/post`, { method: "POST", body: JSON.stringify({ kind: "status", n: 1 }) });
      await fetch(`${base}/api/post`, { method: "POST", body: JSON.stringify({ kind: "status", n: 2 }) });
      const got = await (await fetch(`${base}/api/poll?since=${first.seq}`)).json();
      expect(got.messages.map((m) => m.n)).toEqual([1, 2]);
      expect(got.seq).toBe(first.seq + 2);
      const none = await (await fetch(`${base}/api/poll?since=${got.seq}`)).json();
      expect(none.messages).toEqual([]);
      expect((await fetch(`${base}/api/post`, { method: "POST", body: "{not json" })).status).toBe(400);
      expect((await fetch(`${base}/nothing`)).status).toBe(404);
    } finally {
      srv.close();
    }
  });
});

// ---- Records and class settings kept on the server's disk, for a station that gives the station key.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setDataDir, stationKey } from "../server/server.mjs";
import { ServerStore } from "../src/ui/server-store.ts";

const record = (id, day, more = {}) => ({ id, exerciseId: "arpa-1", title: "ARPA 1: Setting up", kind: "arpa", students: ["Asha"], batch: "ROC 12", startedIso: `2026-11-${day}T10:00:00.000Z`, simSeconds: 600, names: {}, coasts: [], frames: [], events: [], result: null, summary: [], ...more });
const withServer = async (run) => {
  const dir = mkdtempSync(join(tmpdir(), "radar-sim-store-"));
  setDataDir(dir);
  const srv = createServer(handle);
  await new Promise((r) => srv.listen(0, r));
  try {
    await run(`http://127.0.0.1:${srv.address().port}`, dir);
  } finally {
    srv.close();
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("classroom server store", () => {
  it("makes a station key once: sixteen characters in four groups, none that is mistaken for another", async () => {
    await withServer(async (_base, dir) => {
      const key = stationKey();
      expect(key).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
      expect(stationKey()).toBe(key);
      expect(readFileSync(join(dir, "station-key.txt"), "utf8").trim()).toBe(key);
    });
  });
  it("gives nothing without the key, and takes the key with or without its hyphens and capitals", async () => {
    await withServer(async (base) => {
      const key = stationKey();
      const info = (k) => fetch(`${base}/api/store/info`, { headers: k === undefined ? {} : { "x-station-key": k } });
      expect((await info(undefined)).status).toBe(401);
      expect((await info("AAAA-AAAA-AAAA-AAAA")).status).toBe(401);
      expect((await info(key.slice(0, -1))).status).toBe(401);
      expect((await fetch(`${base}/api/store/history`)).status).toBe(401);
      expect((await fetch(`${base}/api/store/record?id=x`, { method: "DELETE" })).status).toBe(401);
      expect((await fetch(`${base}/api/store/state`, { method: "PUT", body: "{}" })).status).toBe(401);
      expect(await (await info(key)).json()).toEqual({ ok: true, records: 0, state: false });
      expect((await info(key.replace(/-/g, "").toLowerCase())).status).toBe(200);
    });
  });
  it("keeps a record with its replay, lists the short forms newest first, and gives the whole record back", async () => {
    await withServer(async (base, dir) => {
      const h = { "x-station-key": stationKey() };
      const put = (body) => fetch(`${base}/api/store/record`, { method: "PUT", headers: h, body: typeof body === "string" ? body : JSON.stringify(body) });
      const full = record("2026-11-10T10:00:00.000Z-arpa-1", "10", { frames: [{ t: 0 }, { t: 10 }] });
      expect((await put({ light: record(full.id, "10"), sig: "aa", full })).status).toBe(200);
      // A later one sent in short only (the station no longer has its replay).
      expect((await put({ light: record("r2", "12"), sig: "bb" })).status).toBe(200);
      const list = await (await fetch(`${base}/api/store/history`, { headers: h })).json();
      expect(list.map((e) => [e.light.id, e.sig, e.replay])).toEqual([["r2", "bb", false], [full.id, "aa", true]]);
      expect((await (await fetch(`${base}/api/store/record?id=${encodeURIComponent(full.id)}`, { headers: h })).json()).frames).toHaveLength(2);
      expect((await fetch(`${base}/api/store/record?id=r2`, { headers: h })).status).toBe(404);
      // Sent again with a new mark: one entry still, the replay kept.
      await put({ light: record(full.id, "10", { assessor: { decision: "competent", name: "Rao", remarks: "" } }), sig: "cc" });
      const again = await (await fetch(`${base}/api/store/history`, { headers: h })).json();
      expect(again).toHaveLength(2);
      expect(again.find((e) => e.light.id === full.id)).toMatchObject({ sig: "cc", replay: true, light: { assessor: { decision: "competent" } } });
      // What is not a record is refused.
      expect((await put("{not json")).status).toBe(400);
      expect((await put({ light: { id: "" } })).status).toBe(400);
      expect((await put({ light: record("r3", "13"), full: record("other", "13") })).status).toBe(400);
      // An id cannot name a file outside the records folder.
      expect((await put({ light: record("../../escape", "14"), full: record("../../escape", "14") })).status).toBe(200);
      expect(readdirSync(dir).sort()).toEqual(["audit.log", "history.json", "records", "station-key.txt"]);
      expect(readdirSync(join(dir, "records")).every((f) => /^[A-Za-z0-9_.-]+\.json$/.test(f) && !f.includes(".."))).toBe(true);
      // Deleted: gone from the list and from the disk.
      expect((await fetch(`${base}/api/store/record?id=${encodeURIComponent(full.id)}`, { method: "DELETE", headers: h })).status).toBe(200);
      expect((await (await fetch(`${base}/api/store/history`, { headers: h })).json()).map((e) => e.light.id).sort()).toEqual(["../../escape", "r2"]);
      expect((await fetch(`${base}/api/store/record?id=${encodeURIComponent(full.id)}`, { headers: h })).status).toBe(404);
    });
  });
  it("keeps the class settings", async () => {
    await withServer(async (base) => {
      const h = { "x-station-key": stationKey() };
      expect((await fetch(`${base}/api/store/state`, { headers: h })).status).toBe(404);
      expect((await fetch(`${base}/api/store/state`, { method: "PUT", headers: h, body: "[1,2]" })).status).toBe(400);
      expect((await fetch(`${base}/api/store/state`, { method: "PUT", headers: h, body: JSON.stringify({ batches: [{ id: "b1", name: "ROC 12" }] }) })).status).toBe(200);
      expect(await (await fetch(`${base}/api/store/state`, { headers: h })).json()).toEqual({ batches: [{ id: "b1", name: "ROC 12" }] });
      expect(await (await fetch(`${base}/api/store/info`, { headers: h })).json()).toEqual({ ok: true, records: 0, state: true });
    });
  });
  it("the station's side: no server, no key, a wrong key, and then records and settings kept and read back", async () => {
    await withServer(async (base) => {
      const kv = new Map();
      const storage = { getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => void kv.set(k, v), removeItem: (k) => void kv.delete(k) };
      expect(new ServerStore(storage, false, base).state).toBe("no-server");
      const s = new ServerStore(storage, true, base);
      expect(s.state).toBe("no-key");
      // The server is there and refuses: a key is wanted.
      expect(await s.refresh()).toBe("no-key");
      s.setKey("WRNG-WRNG-WRNG-WRNG");
      expect(await s.refresh()).toBe("wrong-key");
      expect(await s.putRecord(record("r1", "10"), "aa")).toBe(false);
      s.setKey(stationKey());
      expect(await s.refresh()).toBe("on");
      const full = record("r1", "10", { frames: [{ t: 0 }] });
      expect(await s.putRecord(record("r1", "10"), "aa", full)).toBe(true);
      expect(await s.putRecord(record("r2", "11"), "bb")).toBe(true);
      expect(s.entries.map((e) => [e.light.id, e.replay])).toEqual([["r2", false], ["r1", true]]);
      expect((await s.getRecord("r1")).frames).toHaveLength(1);
      expect(await s.getRecord("r2")).toBeNull();
      expect(await s.putState({ batches: [] })).toBe(true);
      // Another browser with the same key sees the same.
      const other = new ServerStore(storage, true, base);
      expect(other.keySet).toBe(true);
      expect(await other.refresh()).toBe("on");
      expect(other.entries.map((e) => e.light.id)).toEqual(["r2", "r1"]);
      expect(other.hasState).toBe(true);
      expect(await other.getState()).toEqual({ batches: [] });
      await other.removeRecord("r1");
      expect((await s.refresh()) === "on" && s.entries.map((e) => e.light.id)).toEqual(["r2"]);
    });
  });
  it("a page from a web site with no classroom server is told so", async () => {
    const srv = createServer((req, res) => res.writeHead(404).end("Not found"));
    await new Promise((r) => srv.listen(0, r));
    try {
      const s = new ServerStore(null, true, `http://127.0.0.1:${srv.address().port}`);
      // Told so before any key is typed, so that the station does not ask for one.
      expect(await s.refresh()).toBe("no-server");
      s.setKey("AAAA-AAAA-AAAA-AAAA");
      expect(await s.refresh()).toBe("no-server");
    } finally {
      srv.close();
    }
    // A site that answers every address with a page is not a classroom server either.
    const page = createServer((req, res) => res.writeHead(200, { "content-type": "text/html" }).end("<html></html>"));
    await new Promise((r) => page.listen(0, r));
    try {
      const s = new ServerStore(null, true, `http://127.0.0.1:${page.address().port}`);
      expect(await s.refresh()).toBe("no-server");
    } finally {
      page.close();
    }
  });
});

// ---- Instructors' own accounts, the audit log, daily backups, export and import (rs-b48).
import { ACCOUNT_RULES, dailyBackup, listBackups, resetLogins } from "../server/server.mjs";

describe("instructors' accounts", () => {
  const call = (base, path, { method = "GET", body, key, token } = {}) =>
    fetch(`${base}${path}`, { method, headers: { ...(key ? { "x-station-key": key } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const login = async (base, name, password) => {
    const r = await call(base, "/api/login", { method: "POST", body: { name, password } });
    return { status: r.status, ...(await r.json()) };
  };

  it("the first account is an administrator's, made with the station key; then each instructor logs in with a name and password", async () => {
    resetLogins();
    await withServer(async (base, dir) => {
      const key = stationKey();
      // Not yet: an instructor's account first, a short password, a bad name.
      expect((await call(base, "/api/store/users", { method: "POST", key, body: { name: "Rao", role: "instructor", password: "longenough" } })).status).toBe(400);
      expect((await call(base, "/api/store/users", { method: "POST", key, body: { name: "Rao", role: "admin", password: "short" } })).status).toBe(400);
      expect((await call(base, "/api/store/users", { method: "POST", key, body: { name: "../x", role: "admin", password: "longenough" } })).status).toBe(400);
      expect((await call(base, "/api/store/users", { method: "POST", key, body: { name: "Rao", role: "admin", password: "longenough" } })).status).toBe(200);
      // The password is kept only as a salted hash.
      const file = readFileSync(join(dir, "instructors.json"), "utf8");
      expect(file).not.toContain("longenough");
      expect(JSON.parse(file).users[0]).toMatchObject({ name: "Rao", role: "admin" });
      expect(JSON.parse(file).users[0].salt).toMatch(/^[0-9a-f]{32}$/);
      // Now the key can no longer make accounts: an administrator must.
      expect((await call(base, "/api/store/users", { method: "POST", key, body: { name: "Iyer", role: "instructor", password: "longenough" } })).status).toBe(403);
      const rao = await login(base, "rao", "longenough");
      expect(rao).toMatchObject({ ok: true, name: "Rao", role: "admin" });
      expect(Date.parse(rao.expiresIso) - Date.now()).toBeGreaterThan((ACCOUNT_RULES.loginHours - 0.1) * 3600_000);
      expect(await (await call(base, "/api/store/whoami", { token: rao.token })).json()).toMatchObject({ name: "Rao", role: "admin", admin: true, accounts: 1, keyEnabled: true });
      expect((await call(base, "/api/store/users", { method: "POST", token: rao.token, body: { name: "Iyer", role: "instructor", password: "another-one" } })).status).toBe(200);
      expect((await call(base, "/api/store/users", { method: "POST", token: rao.token, body: { name: "IYER", role: "instructor", password: "another-one" } })).status).toBe(400);
      expect(await (await call(base, "/api/store/users", { token: rao.token })).json()).toEqual([
        { name: "Rao", role: "admin", createdIso: expect.any(String) }, { name: "Iyer", role: "instructor", createdIso: expect.any(String) },
      ]);
      // An instructor keeps records, but cannot make accounts, put the records back, import or read the log.
      const iyer = await login(base, "Iyer", "another-one");
      expect(iyer.role).toBe("instructor");
      expect((await call(base, "/api/store/record", { method: "PUT", token: iyer.token, body: { light: record("r1", "10"), sig: "a" } })).status).toBe(200);
      expect((await call(base, "/api/store/users", { method: "POST", token: iyer.token, body: { name: "X", role: "instructor", password: "longenough" } })).status).toBe(403);
      expect((await call(base, "/api/store/audit", { token: iyer.token })).status).toBe(403);
      expect((await call(base, "/api/store/import", { method: "POST", token: iyer.token, body: {} })).status).toBe(403);
      expect((await call(base, "/api/store/users?name=Rao", { method: "DELETE", token: iyer.token })).status).toBe(403);
      // ... and changes his own password, not another's.
      expect((await call(base, "/api/store/users/password", { method: "POST", token: iyer.token, body: { name: "Rao", password: "hijacked!!" } })).status).toBe(403);
      expect((await call(base, "/api/store/users/password", { method: "POST", token: iyer.token, body: { name: "Iyer", password: "a-new-one-9" } })).status).toBe(200);
      expect((await login(base, "Iyer", "another-one")).status).toBe(401);
      expect((await login(base, "Iyer", "a-new-one-9")).status).toBe(200);
      // The last administrator cannot be removed; an instructor can, and his logins end.
      expect((await call(base, "/api/store/users?name=Rao", { method: "DELETE", token: rao.token })).status).toBe(400);
      expect((await call(base, "/api/store/users?name=Iyer", { method: "DELETE", token: rao.token })).status).toBe(200);
      expect((await call(base, "/api/store/info", { token: iyer.token })).status).toBe(401);
      // Logged out: the token no longer opens anything.
      await call(base, "/api/logout", { method: "POST", token: rao.token });
      expect((await call(base, "/api/store/info", { token: rao.token })).status).toBe(401);
    });
  });

  it("too many wrong passwords lock the name for a while; the station key can be switched off", async () => {
    resetLogins();
    await withServer(async (base) => {
      const key = stationKey();
      await call(base, "/api/store/users", { method: "POST", key, body: { name: "Rao", role: "admin", password: "longenough" } });
      for (let i = 1; i < ACCOUNT_RULES.maxFailures; i++) expect((await login(base, "Rao", `wrong-${i}`)).status).toBe(401);
      expect((await login(base, "Rao", "wrong-last")).status).toBe(401);
      // Locked now, even with the right password.
      const locked = await login(base, "Rao", "longenough");
      expect(locked.status).toBe(429);
      expect(locked.error).toMatch(/wait 15 minutes/);
      resetLogins();
      const rao = await login(base, "Rao", "longenough");
      expect(rao.status).toBe(200);
      // Only a logged-in administrator switches the key off; then the key opens nothing and says why.
      expect((await call(base, "/api/store/key", { method: "POST", key, body: { enabled: false } })).status).toBe(403);
      expect((await call(base, "/api/store/key", { method: "POST", token: rao.token, body: { enabled: false } })).status).toBe(200);
      const refused = await call(base, "/api/store/info", { key });
      expect(refused.status).toBe(401);
      expect(await refused.json()).toMatchObject({ login: true, keyEnabled: false });
      expect((await call(base, "/api/store/info", { token: rao.token })).status).toBe(200);
      // Everything done is in the log, newest first.
      const log = await (await call(base, "/api/store/audit", { token: rao.token })).json();
      expect(log.map((e) => e.action)).toEqual(["station key off", "log in", "login refused", "login refused", "login refused", "login refused", "login refused", "make account"]);
      expect(log[2].detail).toMatch(/locked for 15 minutes/);
      expect(log.every((e) => typeof e.t === "string" && e.t.length > 0)).toBe(true);
    });
  });
});

describe("backups, export and import", () => {
  const h = () => ({ "x-station-key": stationKey() });
  const put = (base, id, day, extra = {}) => fetch(`${base}/api/store/record`, { method: "PUT", headers: h(), body: JSON.stringify({ light: record(id, day), sig: `s-${id}`, full: record(id, day, extra) }) });
  const ids = async (base) => (await (await fetch(`${base}/api/store/history`, { headers: h() })).json()).map((e) => e.light.id).sort();

  it("a backup a day, the last fourteen kept; a record changed later stays as it was in the backup", async () => {
    resetLogins();
    await withServer(async (base, dir) => {
      expect(dailyBackup(new Date(2026, 10, 1, 9))).toBeNull(); // nothing to keep yet
      await put(base, "r1", "10", { summary: ["first"] });
      expect(dailyBackup(new Date(2026, 10, 1, 9))).toBe("2026-11-01");
      expect(dailyBackup(new Date(2026, 10, 1, 18))).toBeNull(); // one a day
      await put(base, "r1", "10", { summary: ["changed"] });
      const kept = JSON.parse(readFileSync(join(dir, "backups", "2026-11-01", "records", readdirSync(join(dir, "backups", "2026-11-01", "records"))[0]), "utf8"));
      expect(kept.summary).toEqual(["first"]);
      for (let d = 2; d <= 17; d++) dailyBackup(new Date(2026, 10, d, 9));
      const daily = listBackups().filter((b) => b.kind === "daily").map((b) => b.id);
      expect(daily).toHaveLength(ACCOUNT_RULES.keepDailyBackups);
      expect(daily[0]).toBe("2026-11-17");
      expect(daily.at(-1)).toBe("2026-11-04");
      expect(listBackups()[0]).toMatchObject({ records: 1, replays: 1, state: false });
    });
  });

  it("puts the records back to a backup, keeping what there was before in a backup of its own", async () => {
    resetLogins();
    await withServer(async (base) => {
      await put(base, "r1", "10");
      const made = await (await fetch(`${base}/api/store/backups`, { method: "POST", headers: h() })).json();
      expect(made.id).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-manual$/);
      await fetch(`${base}/api/store/record?id=r1`, { method: "DELETE", headers: h() });
      await put(base, "r2", "11");
      expect(await ids(base)).toEqual(["r2"]);
      // The key may do it while no administrator's account exists.
      const r = await fetch(`${base}/api/store/backups/restore`, { method: "POST", headers: h(), body: JSON.stringify({ id: made.id }) });
      expect(r.status).toBe(200);
      expect(await ids(base)).toEqual(["r1"]);
      expect((await fetch(`${base}/api/store/record?id=r1`, { headers: h() })).status).toBe(200);
      const before = listBackups().find((b) => b.kind === "before-restore");
      expect(before).toMatchObject({ records: 1, replays: 1 });
      // ... and that one brings r2 back.
      await fetch(`${base}/api/store/backups/restore`, { method: "POST", headers: h(), body: JSON.stringify({ id: before.id }) });
      expect(await ids(base)).toEqual(["r2"]);
      expect((await fetch(`${base}/api/store/backups/restore`, { method: "POST", headers: h(), body: JSON.stringify({ id: "../../x" }) })).status).toBe(404);
    });
  });

  it("exports everything to one file, and an import adds only what the other server lacks", async () => {
    resetLogins();
    let file = "";
    await withServer(async (base) => {
      await put(base, "r1", "10", { frames: [{ t: 0 }, { t: 5 }] });
      await put(base, "r2", "11");
      await fetch(`${base}/api/store/state`, { method: "PUT", headers: h(), body: JSON.stringify({ batches: [{ id: "b1", name: "ROC 12" }] }) });
      const r = await fetch(`${base}/api/store/export`, { headers: h() });
      expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="radar-sim-classroom-\d{4}-\d{2}-\d{2}\.json"/);
      file = await r.text();
      const x = JSON.parse(file);
      expect(x).toMatchObject({ kind: "radar-sim-classroom", version: 1, state: { batches: [{ name: "ROC 12" }] } });
      expect(x.history.map((e) => e.light.id).sort()).toEqual(["r1", "r2"]);
      expect(x.records.r1.frames).toHaveLength(2);
      expect((await fetch(`${base}/api/store/export`)).status).toBe(401);
    });
    await withServer(async (base) => {
      await put(base, "r2", "11", { summary: ["kept here"] });
      await fetch(`${base}/api/store/state`, { method: "PUT", headers: h(), body: JSON.stringify({ batches: [] }) });
      expect((await fetch(`${base}/api/store/import`, { method: "POST", headers: h(), body: '{"kind":"something else"}' })).status).toBe(400);
      const res = await (await fetch(`${base}/api/store/import`, { method: "POST", headers: h(), body: file })).json();
      expect(res).toEqual({ ok: true, added: 1, skipped: 1, state: false });
      expect(await ids(base)).toEqual(["r1", "r2"]);
      expect((await (await fetch(`${base}/api/store/record?id=r1`, { headers: h() })).json()).frames).toHaveLength(2);
      // What was here is not replaced.
      expect((await (await fetch(`${base}/api/store/record?id=r2`, { headers: h() })).json()).summary).toEqual(["kept here"]);
      expect(await (await fetch(`${base}/api/store/state`, { headers: h() })).json()).toEqual({ batches: [] });
      expect(listBackups().some((b) => b.kind === "before-import")).toBe(true);
      // A second import adds nothing.
      expect((await (await fetch(`${base}/api/store/import`, { method: "POST", headers: h(), body: file })).json()).added).toBe(0);
    });
  });
});

describe("the station's side of the accounts and backups", () => {
  it("makes the first administrator with the key, logs in and out, and reaches the backups and the log", async () => {
    resetLogins();
    await withServer(async (base) => {
      const kv = new Map();
      const storage = { getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => void kv.set(k, v), removeItem: (k) => void kv.delete(k) };
      const s = new ServerStore(storage, true, base);
      s.setKey(stationKey());
      expect(await s.refresh()).toBe("on");
      // With no administrator yet, the key may make the first one.
      expect(s.user).toMatchObject({ role: "station", admin: true, accounts: 0, keyEnabled: true });
      expect(s.loginOffered).toBe(false);
      expect((await s.addUser("Rao", "admin", "longenough")).ok).toBe(true);
      await s.refresh();
      expect(s.user).toMatchObject({ role: "station", admin: false, accounts: 1 });
      expect(s.loginOffered).toBe(true);
      // A login is used before the key, and is kept in this browser until it ends.
      expect(await s.logIn("Rao", "wrong-password")).toMatch(/wrong/);
      expect(await s.logIn("Rao", "longenough")).toBeNull();
      expect(s.loggedIn).toBe("Rao");
      expect(s.user).toMatchObject({ name: "Rao", role: "admin", admin: true });
      expect(JSON.parse(kv.get("radar-sim-station-login"))).toMatchObject({ name: "Rao" });
      expect(await s.putRecord(record("r1", "10"), "aa", record("r1", "10"))).toBe(true);
      const made = await s.backUpNow();
      expect(made.ok).toBe(true);
      const list = await s.backups();
      expect(list.ok && list.data[0]).toMatchObject({ kind: "manual", records: 1 });
      const log = await s.audit();
      expect(log.ok && log.data.map((l) => l.action).slice(0, 3)).toEqual(["backup", "save record", "log in"]);
      const exp = await s.exportAll();
      expect(exp.ok && JSON.parse(exp.text).history).toHaveLength(1);
      // Switched off, the key no longer works; logged out, the station must log in again.
      expect((await s.setKeyEnabled(false)).ok).toBe(true);
      await s.logOut();
      expect(s.loggedIn).toBeNull();
      expect(s.state).toBe("wrong-key");
      expect(s.keyOffered).toBe(false);
      expect(s.loginOffered).toBe(true);
      // Another browser with only the key: refused too.
      const other = new ServerStore(storage, true, base);
      expect(await other.refresh()).toBe("wrong-key");
    });
  });
});
