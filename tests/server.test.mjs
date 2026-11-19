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
      expect(readdirSync(dir).sort()).toEqual(["history.json", "records", "station-key.txt"]);
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
