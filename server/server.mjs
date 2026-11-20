// Classroom server for the radar simulator. No installation beyond Node.js; no database.
//   npm run serve            (then open the address it prints on every student PC)
// It serves dist/radar-simulator.html and relays small status messages between student
// displays and the instructor station on the same network.
// It also keeps the instructor station's records and class settings on this computer's disk
// (the folder "data" beside this server, or RADAR_SIM_DATA), as plain JSON files, so that they do
// not depend on one browser. Only a station that gives the station key can read or write them;
// the key is made at the first start, kept in data/station-key.txt and printed below.
// Instructors can also have accounts of their own (name and password, kept as salted scrypt hashes
// in data/instructors.json): each logs in at the station, and what each does to the records is
// written in data/audit.log. An administrator manages the accounts, can put the records back to
// one of the backups the server makes every day (data/backups, the last 14 kept), can export
// everything to one file and import such a file, and can switch the shared station key off.
// Training use only: there is no encryption, and the key and passwords travel in clear on the
// network. Use it on the classroom network, not on the internet. The files hold trainees' names
// and results: keep the folder as the institute keeps its other records.
import { createServer } from "node:http";
import { appendFileSync, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const MAX_MESSAGES = 500;
// A display's exercise record (sent to the instructor station) can be a few hundred kilobytes.
const MAX_BODY = 2 * 1024 * 1024;
/** Messages kept in memory, in all: the oldest go first beyond this. */
const MAX_KEPT_BYTES = 40 * 1024 * 1024;

// ---------------------------------------------------------------- the store on disk
/** A record with its replay, or the station's settings, can be a few megabytes. */
const MAX_STORE_BODY = 8 * 1024 * 1024;
/** Letters and digits that are not mistaken for one another when typed. */
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let dataDir = process.env.RADAR_SIM_DATA || join(here, "..", "data");
/** For the tests: keep the store in another folder. */
export function setDataDir(dir) {
  dataDir = dir;
}
const recordsDir = () => join(dataDir, "records");
const ensureDirs = () => mkdirSync(recordsDir(), { recursive: true });
/** The station key: made once, 16 characters in four groups, kept in the data folder. */
export function stationKey() {
  ensureDirs();
  const file = join(dataDir, "station-key.txt");
  if (existsSync(file)) {
    const k = readFileSync(file, "utf8").trim();
    if (k) return k;
  }
  const bytes = randomBytes(16);
  const key = [...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
  writeFileSync(file, `${key}\n`);
  return key;
}
/** The key may be typed with or without its hyphens, in capitals or not. */
const keyChars = (k) => String(k || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const sameKey = (given) => {
  const a = Buffer.from(keyChars(given));
  const b = Buffer.from(keyChars(stationKey()));
  return a.length === b.length && timingSafeEqual(a, b);
};

// ---------------------------------------------------------------- instructors' accounts
/** PLACEHOLDERS for the institute to set: how long a login lasts, how many wrong passwords before a wait, how long. */
export const ACCOUNT_RULES = { loginHours: 12, maxFailures: 5, lockMinutes: 15, minPassword: 8, keepDailyBackups: 14, keepOtherBackups: 10 };
const usersFile = () => join(dataDir, "instructors.json");
const auditFile = () => join(dataDir, "audit.log");
/** The accounts, and whether the station key still opens the store. */
const readUsers = () => {
  const u = readJson(usersFile(), null);
  return u && Array.isArray(u.users) ? { users: u.users, keyEnabled: u.keyEnabled !== false } : { users: [], keyEnabled: true };
};
const writeUsers = (u) => {
  mkdirSync(dataDir, { recursive: true });
  writeJson(usersFile(), u);
};
const hashOf = (password, salt) => scryptSync(String(password), Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
const findUser = (u, name) => u.users.find((x) => String(x.name).toLowerCase() === String(name || "").trim().toLowerCase());
const hasAdmin = (u) => u.users.some((x) => x.role === "admin");
/** Logins: token to name, role and when it ends. In memory: a restart of the server logs everyone out. */
const sessions = new Map();
/** Failed logins by address and name: how many since when, and until when that name is locked from that address. */
const failures = new Map();
/** For the tests: forget every login and every failed attempt. */
export function resetLogins() {
  sessions.clear();
  failures.clear();
}
const nameOk = (n) => typeof n === "string" && /^[A-Za-z0-9][A-Za-z0-9 .'-]{0,39}$/.test(n.trim());
const passwordOk = (p) => typeof p === "string" && p.length >= ACCOUNT_RULES.minPassword && p.length <= 200;
/** One line in the audit log: when, who, what, from where. */
function audit(who, action, detail, req) {
  try {
    mkdirSync(dataDir, { recursive: true });
    appendFileSync(auditFile(), `${JSON.stringify({ t: new Date().toISOString(), who, action, detail, from: req?.socket?.remoteAddress ?? "" })}\n`);
  } catch {
    // The log is a help, not a condition of the work.
  }
}
/** Who is asking: a logged-in instructor, the station key, or nobody. */
function whoIs(req) {
  const m = /^Bearer\s+([0-9a-f]{64})$/i.exec(String(req.headers["authorization"] || ""));
  if (m) {
    const token = m[1].toLowerCase();
    const s = sessions.get(token);
    if (s && s.expires > Date.now()) return { name: s.name, role: s.role, token };
    sessions.delete(token);
    return null;
  }
  if (req.headers["x-station-key"] !== undefined && readUsers().keyEnabled && sameKey(req.headers["x-station-key"])) return { name: "station key", role: "station" };
  return null;
}
/** An administrator; or the station key while no administrator's account exists, so that the first one can be made. */
const mayAdminister = (who) => who.role === "admin" || (who.role === "station" && !hasAdmin(readUsers()));

function handleLogin(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/logout") {
    const who = whoIs(req);
    if (who?.token) {
      sessions.delete(who.token);
      audit(who.name, "log out", "", req);
    }
    return json(res, 200, { ok: true });
  }
  readBody(req, res, 10_000, (body) => {
    let msg = null;
    try {
      msg = JSON.parse(body ?? "");
    } catch {
      msg = null;
    }
    const name = String(msg?.name ?? "").trim();
    const where = `${req.socket.remoteAddress ?? ""}|${name.toLowerCase()}`;
    // Failures older than the lock time are forgotten.
    let f = failures.get(where);
    if (f && f.lockedUntil <= Date.now() && Date.now() - f.since > ACCOUNT_RULES.lockMinutes * 60000) {
      failures.delete(where);
      f = undefined;
    }
    if (f && f.lockedUntil > Date.now()) {
      return json(res, 429, { error: `Too many wrong passwords for this name: wait ${Math.ceil((f.lockedUntil - Date.now()) / 60000)} minutes.` });
    }
    const u = readUsers();
    const user = findUser(u, name);
    // A hash is worked out even for a name that does not exist, so that the answer takes as long either way.
    const given = Buffer.from(hashOf(String(msg?.password ?? ""), user?.salt ?? "00"), "hex");
    const stored = Buffer.from(String(user?.hash ?? ""), "hex");
    const ok = !!user && !user.disabled && stored.length === given.length && timingSafeEqual(given, stored);
    if (!ok) {
      const n = (f?.count ?? 0) + 1;
      failures.set(where, { count: n, since: f?.since ?? Date.now(), lockedUntil: n >= ACCOUNT_RULES.maxFailures ? Date.now() + ACCOUNT_RULES.lockMinutes * 60000 : 0 });
      audit(name || "(no name)", "login refused", n >= ACCOUNT_RULES.maxFailures ? `locked for ${ACCOUNT_RULES.lockMinutes} minutes` : `${n} wrong`, req);
      return json(res, 401, { error: "Name or password wrong." });
    }
    failures.delete(where);
    const token = randomBytes(32).toString("hex");
    const expires = Date.now() + ACCOUNT_RULES.loginHours * 3600_000;
    sessions.set(token, { name: user.name, role: user.role, expires });
    audit(user.name, "log in", user.role, req);
    return json(res, 200, { ok: true, token, name: user.name, role: user.role, expiresIso: new Date(expires).toISOString() });
  });
}
/** A file name for a record id: its safe characters and a short hash, so that no id can name a file outside the folder. */
const recordFile = (id) => join(recordsDir(), `${String(id).replace(/[^A-Za-z0-9-]/g, "_").slice(0, 80)}.${createHash("sha256").update(String(id)).digest("hex").slice(0, 10)}.json`);
const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
/** Written beside the file and then moved over it, so that a power cut cannot leave half a file. */
const writeJson = (file, value) => {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, file);
};
const historyFile = () => join(dataDir, "history.json");
const stateFile = () => join(dataDir, "state.json");
const json = (res, code, value) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
};
/** The body of a request, or null when it is larger than `limit`. A failure in `done` answers 500 rather than stopping the server. */
const readBody = (req, res, limit, done) => {
  let body = "";
  let tooBig = false;
  req.on("data", (c) => {
    if (tooBig) return;
    body += c;
    if (body.length > limit) {
      tooBig = true;
      body = "";
    }
  });
  req.on("end", () => {
    try {
      done(tooBig ? null : body);
    } catch (e) {
      if (!res.headersSent) json(res, 500, { error: `The server could not do it: ${e?.message ?? e}` });
    }
  });
};

/** Everything under /api/store: the instructor station's records and settings, for a station that gives the key or a logged-in instructor. */
function handleStore(req, res, url) {
  const who = whoIs(req);
  if (!who) {
    const u = readUsers();
    return json(res, 401, { error: "Log in, or give the station key.", login: u.users.length > 0, keyEnabled: u.keyEnabled });
  }
  ensureDirs();
  const path = url.pathname.slice("/api/store/".length);
  if (req.method === "GET" && path === "info") {
    const list = readJson(historyFile(), []);
    return json(res, 200, { ok: true, records: Array.isArray(list) ? list.length : 0, state: existsSync(stateFile()) });
  }
  if (req.method === "GET" && path === "whoami") {
    const u = readUsers();
    return json(res, 200, { name: who.name, role: who.role, admin: mayAdminister(who), accounts: u.users.length, keyEnabled: u.keyEnabled });
  }
  if (path === "users" || path === "users/password" || path === "key" || path === "audit") return handleAccounts(req, res, url, who, path);
  if (path === "backups" || path === "backups/restore" || path === "export" || path === "import") return handleBackups(req, res, url, who, path);
  if (req.method === "GET" && path === "history") return json(res, 200, readJson(historyFile(), []));
  if (req.method === "GET" && path === "state") return existsSync(stateFile()) ? json(res, 200, readJson(stateFile(), {})) : json(res, 404, { error: "No settings have been saved." });
  if (path === "record" && (req.method === "GET" || req.method === "DELETE")) {
    const id = url.searchParams.get("id") || "";
    const file = recordFile(id);
    if (req.method === "GET") return existsSync(file) ? json(res, 200, readJson(file, null)) : json(res, 404, { error: "That record's replay is not kept here." });
    if (existsSync(file)) unlinkSync(file);
    const list = readJson(historyFile(), []);
    writeJson(historyFile(), (Array.isArray(list) ? list : []).filter((e) => e?.light?.id !== id));
    audit(who.name, "delete record", id, req);
    return json(res, 200, { ok: true });
  }
  if (req.method === "PUT" && (path === "record" || path === "state")) {
    readBody(req, res, MAX_STORE_BODY, (body) => {
      if (body === null) return json(res, 413, { error: "Too large." });
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        return json(res, 400, { error: "Not JSON." });
      }
      if (path === "state") {
        if (!msg || typeof msg !== "object" || Array.isArray(msg)) return json(res, 400, { error: "The settings must be an object." });
        writeJson(stateFile(), msg);
        audit(who.name, "save class settings", "", req);
        return json(res, 200, { ok: true });
      }
      // A record: its short form for the lists, a mark of its contents, and (when the station still has it) the whole record with its replay.
      const light = msg?.light;
      if (!light || typeof light.id !== "string" || light.id === "" || typeof light.startedIso !== "string") return json(res, 400, { error: "A record needs its short form with an id and a start time." });
      if (msg.full !== undefined) {
        if (!msg.full || msg.full.id !== light.id) return json(res, 400, { error: "The whole record must have the same id." });
        writeJson(recordFile(light.id), msg.full);
      }
      const list = readJson(historyFile(), []);
      const rest = (Array.isArray(list) ? list : []).filter((e) => e?.light?.id !== light.id);
      rest.push({ light, sig: typeof msg.sig === "string" ? msg.sig : "", replay: existsSync(recordFile(light.id)) });
      rest.sort((a, b) => String(b.light.startedIso).localeCompare(String(a.light.startedIso)));
      writeJson(historyFile(), rest);
      audit(who.name, "save record", light.id, req);
      return json(res, 200, { ok: true, records: rest.length });
    });
    return;
  }
  json(res, 404, { error: "Not found." });
}

/** Accounts, the station key and the audit log. */
function handleAccounts(req, res, url, who, path) {
  const u = readUsers();
  if (path === "audit" && req.method === "GET") {
    if (!mayAdminister(who)) return json(res, 403, { error: "Only an administrator can read the log." });
    let lines = [];
    try {
      lines = readFileSync(auditFile(), "utf8").split("\n").filter(Boolean);
    } catch {
      lines = [];
    }
    const n = Math.max(1, Math.min(2000, Number(url.searchParams.get("n") || 200)));
    return json(res, 200, lines.slice(-n).reverse().map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { t: "", who: "", action: "unreadable line", detail: "" };
      }
    }));
  }
  if (path === "users" && req.method === "GET") return json(res, 200, u.users.map((x) => ({ name: x.name, role: x.role, createdIso: x.createdIso })));
  if (path === "users" && req.method === "DELETE") {
    if (!mayAdminister(who)) return json(res, 403, { error: "Only an administrator can remove an account." });
    const user = findUser(u, url.searchParams.get("name"));
    if (!user) return json(res, 404, { error: "No such account." });
    if (user.role === "admin" && u.users.filter((x) => x.role === "admin").length === 1) return json(res, 400, { error: "That is the last administrator's account: make another administrator first." });
    u.users = u.users.filter((x) => x !== user);
    writeUsers(u);
    for (const [t, s] of sessions) if (s.name === user.name) sessions.delete(t);
    audit(who.name, "remove account", user.name, req);
    return json(res, 200, { ok: true });
  }
  if (req.method !== "POST") return json(res, 404, { error: "Not found." });
  readBody(req, res, 10_000, (body) => {
    let msg = null;
    try {
      msg = JSON.parse(body ?? "");
    } catch {
      return json(res, 400, { error: "Not JSON." });
    }
    if (path === "key") {
      if (who.role !== "admin") return json(res, 403, { error: "Log in as an administrator to switch the station key on or off." });
      u.keyEnabled = msg?.enabled !== false;
      writeUsers(u);
      audit(who.name, u.keyEnabled ? "station key on" : "station key off", "", req);
      return json(res, 200, { ok: true, keyEnabled: u.keyEnabled });
    }
    if (path === "users/password") {
      const user = findUser(u, msg?.name);
      if (!user) return json(res, 404, { error: "No such account." });
      if (!(mayAdminister(who) || who.name === user.name)) return json(res, 403, { error: "Only the instructor or an administrator can change this password." });
      if (!passwordOk(msg?.password)) return json(res, 400, { error: `A password needs at least ${ACCOUNT_RULES.minPassword} characters.` });
      user.salt = randomBytes(16).toString("hex");
      user.hash = hashOf(msg.password, user.salt);
      writeUsers(u);
      audit(who.name, "change password", user.name, req);
      return json(res, 200, { ok: true });
    }
    // A new account.
    if (!mayAdminister(who)) return json(res, 403, { error: "Only an administrator can make an account." });
    const name = String(msg?.name ?? "").trim();
    if (!nameOk(name)) return json(res, 400, { error: "A name needs 1 to 40 letters, figures, spaces, points, hyphens or apostrophes." });
    if (findUser(u, name)) return json(res, 400, { error: "There is already an account of that name." });
    const role = msg?.role === "admin" ? "admin" : "instructor";
    if (!hasAdmin(u) && role !== "admin") return json(res, 400, { error: "The first account must be an administrator's." });
    if (!passwordOk(msg?.password)) return json(res, 400, { error: `A password needs at least ${ACCOUNT_RULES.minPassword} characters.` });
    const salt = randomBytes(16).toString("hex");
    u.users.push({ name, role, salt, hash: hashOf(msg.password, salt), createdIso: new Date().toISOString() });
    writeUsers(u);
    audit(who.name, "make account", `${name} (${role})`, req);
    return json(res, 200, { ok: true });
  });
}

// ---------------------------------------------------------------- backups, export and import
const backupsDir = () => join(dataDir, "backups");
const pad2 = (n) => String(n).padStart(2, "0");
/** The day by this computer's clock, YYYY-MM-DD. */
const localDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DAILY = /^\d{4}-\d{2}-\d{2}$/;
const OTHER = /^\d{4}-\d{2}-\d{2}-\d{6}-(manual|before-restore|before-import)(-\d+)?$/;
/** The backups kept: newest first, with what each holds. */
export function listBackups() {
  let names = [];
  try {
    names = readdirSync(backupsDir()).filter((n) => DAILY.test(n) || OTHER.test(n));
  } catch {
    names = [];
  }
  return names
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((id) => {
      const dir = join(backupsDir(), id);
      const list = readJson(join(dir, "history.json"), []);
      let replays = 0;
      try {
        replays = readdirSync(join(dir, "records")).filter((f) => f.endsWith(".json")).length;
      } catch {
        replays = 0;
      }
      return { id, kind: DAILY.test(id) ? "daily" : OTHER.exec(id)[1], records: Array.isArray(list) ? list.length : 0, replays, state: existsSync(join(dir, "state.json")) };
    });
}
/**
 * A copy of the records, the list and the class settings in data/backups/<name>. The records are hard links where
 * the disk allows (a record is replaced, never changed in place, so the link keeps the old one), else copies. Made
 * under another name and renamed at the end, so that a half-made backup never counts.
 */
function makeBackup(wanted) {
  // Two in the same second: the second one numbered.
  let name = wanted;
  for (let k = 2; existsSync(join(backupsDir(), name)); k++) name = `${wanted}-${k}`;
  const dir = join(backupsDir(), name);
  const part = `${dir}.part`;
  rmSync(part, { recursive: true, force: true });
  mkdirSync(join(part, "records"), { recursive: true });
  for (const f of ["history.json", "state.json"]) if (existsSync(join(dataDir, f))) copyFileSync(join(dataDir, f), join(part, f));
  for (const f of readdirSync(recordsDir())) {
    if (!f.endsWith(".json")) continue;
    try {
      linkSync(join(recordsDir(), f), join(part, "records", f));
    } catch {
      copyFileSync(join(recordsDir(), f), join(part, "records", f));
    }
  }
  renameSync(part, dir);
  // Only so many of each kind are kept.
  const all = listBackups();
  for (const [kind, keep] of [["daily", ACCOUNT_RULES.keepDailyBackups], ["other", ACCOUNT_RULES.keepOtherBackups]]) {
    const old = all.filter((b) => (kind === "daily" ? b.kind === "daily" : b.kind !== "daily")).slice(keep);
    for (const b of old) rmSync(join(backupsDir(), b.id), { recursive: true, force: true });
  }
  return name;
}
const stamp = (d) => `${localDay(d)}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
/** Today's backup, if it has not been made yet and there is something to keep. Returns its name, or null. */
export function dailyBackup(now = new Date()) {
  ensureDirs();
  const day = localDay(now);
  if (existsSync(join(backupsDir(), day))) return null;
  if (!existsSync(historyFile()) && !existsSync(stateFile())) return null;
  makeBackup(day);
  audit("server", "daily backup", day, null);
  return day;
}
/** Put the records, the list and the class settings back to a backup (after keeping what there is now). */
function restoreBackup(id) {
  const src = join(backupsDir(), id);
  makeBackup(`${stamp(new Date())}-before-restore`);
  const fresh = join(dataDir, "records.restore");
  rmSync(fresh, { recursive: true, force: true });
  mkdirSync(fresh, { recursive: true });
  for (const f of readdirSync(join(src, "records"))) {
    try {
      linkSync(join(src, "records", f), join(fresh, f));
    } catch {
      copyFileSync(join(src, "records", f), join(fresh, f));
    }
  }
  const old = join(dataDir, "records.old");
  rmSync(old, { recursive: true, force: true });
  renameSync(recordsDir(), old);
  renameSync(fresh, recordsDir());
  rmSync(old, { recursive: true, force: true });
  for (const f of ["history.json", "state.json"]) {
    if (existsSync(join(src, f))) writeJson(join(dataDir, f), readJson(join(src, f), null));
    else if (existsSync(join(dataDir, f))) unlinkSync(join(dataDir, f));
  }
}
/** The largest file that can be imported. */
const MAX_IMPORT_BODY = 200 * 1024 * 1024;
export const EXPORT_KIND = "radar-sim-classroom";

function handleBackups(req, res, url, who, path) {
  if (path === "backups" && req.method === "GET") return json(res, 200, listBackups());
  if (path === "backups" && req.method === "POST") {
    const id = makeBackup(`${stamp(new Date())}-manual`);
    audit(who.name, "backup", id, req);
    return json(res, 200, { ok: true, id });
  }
  if (path === "export" && req.method === "GET") {
    // Streamed record by record: the whole store can be large.
    audit(who.name, "export", "", req);
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "content-disposition": `attachment; filename="radar-sim-classroom-${localDay(new Date())}.json"` });
    const history = readJson(historyFile(), []);
    res.write(`{"kind":"${EXPORT_KIND}","version":1,"exportedIso":"${new Date().toISOString()}","history":${JSON.stringify(Array.isArray(history) ? history : [])},"state":${existsSync(stateFile()) ? JSON.stringify(readJson(stateFile(), null)) : "null"},"records":{`);
    let first = true;
    for (const e of Array.isArray(history) ? history : []) {
      const id = e?.light?.id;
      if (typeof id !== "string" || !existsSync(recordFile(id))) continue;
      res.write(`${first ? "" : ","}${JSON.stringify(id)}:${readFileSync(recordFile(id), "utf8")}`);
      first = false;
    }
    return res.end("}}");
  }
  if (!mayAdminister(who)) return json(res, 403, { error: "Only an administrator can put the records back or import them." });
  if (path === "backups/restore" && req.method === "POST") {
    readBody(req, res, 10_000, (body) => {
      let id = "";
      try {
        id = String(JSON.parse(body ?? "")?.id ?? "");
      } catch {
        id = "";
      }
      if (!listBackups().some((b) => b.id === id)) return json(res, 404, { error: "No such backup." });
      restoreBackup(id);
      audit(who.name, "restore backup", id, req);
      const list = readJson(historyFile(), []);
      return json(res, 200, { ok: true, records: Array.isArray(list) ? list.length : 0 });
    });
    return;
  }
  if (path === "import" && req.method === "POST") {
    readBody(req, res, MAX_IMPORT_BODY, (body) => {
      if (body === null) return json(res, 413, { error: "Too large." });
      let x;
      try {
        x = JSON.parse(body);
      } catch {
        return json(res, 400, { error: "Not JSON." });
      }
      if (x?.kind !== EXPORT_KIND || x?.version !== 1 || !Array.isArray(x.history)) return json(res, 400, { error: "Not a file exported from a classroom server." });
      makeBackup(`${stamp(new Date())}-before-import`);
      // Added: what this server does not have. Nothing here is replaced or deleted.
      const list = readJson(historyFile(), []);
      const have = new Set((Array.isArray(list) ? list : []).map((e) => e?.light?.id));
      const rest = Array.isArray(list) ? [...list] : [];
      let added = 0;
      for (const e of x.history) {
        const id = e?.light?.id;
        if (typeof id !== "string" || id === "" || typeof e.light.startedIso !== "string" || have.has(id)) continue;
        const full = x.records && typeof x.records === "object" ? x.records[id] : undefined;
        const withReplay = !!full && full.id === id;
        if (withReplay) writeJson(recordFile(id), full);
        rest.push({ light: e.light, sig: typeof e.sig === "string" ? e.sig : "", replay: withReplay || existsSync(recordFile(id)) });
        have.add(id);
        added++;
      }
      rest.sort((a, b) => String(b.light.startedIso).localeCompare(String(a.light.startedIso)));
      writeJson(historyFile(), rest);
      const tookState = !existsSync(stateFile()) && !!x.state && typeof x.state === "object" && !Array.isArray(x.state);
      if (tookState) writeJson(stateFile(), x.state);
      audit(who.name, "import", `${added} added${tookState ? ", with the class settings" : ""}`, req);
      return json(res, 200, { ok: true, added, skipped: x.history.length - added, state: tookState });
    });
    return;
  }
  json(res, 404, { error: "Not found." });
}

let seq = 0;
/** @type {{seq:number, msg:unknown, bytes:number}[]} */
let messages = [];
let keptBytes = 0;

export function handle(req, res) {
  const url = new URL(req.url || "/", "http://x");
  // The instructor station is the same page, opened at /instructor.
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/instructor" || url.pathname === "/instructor/")) {
    try {
      const html = readFileSync(join(here, "..", "dist", "radar-simulator.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
    } catch {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("dist/radar-simulator.html is missing. Run: npm run build");
    }
    return;
  }
  if (url.pathname.startsWith("/api/store/")) {
    try {
      return handleStore(req, res, url);
    } catch (e) {
      if (!res.headersSent) json(res, 500, { error: `The server could not do it: ${e?.message ?? e}` });
      return;
    }
  }
  if (req.method === "POST" && (url.pathname === "/api/login" || url.pathname === "/api/logout")) return handleLogin(req, res, url);
  if (req.method === "GET" && url.pathname === "/api/poll") {
    const since = Number(url.searchParams.get("since") || 0);
    const out = messages.filter((m) => m.seq > since).map((m) => m.msg);
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ seq, messages: out }));
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/post") {
    let body = "";
    let tooBig = false;
    req.on("data", (c) => {
      body += c;
      if (body.length > MAX_BODY) tooBig = true;
    });
    req.on("end", () => {
      if (tooBig) {
        res.writeHead(413).end();
        return;
      }
      try {
        const msg = JSON.parse(body);
        messages.push({ seq: ++seq, msg, bytes: body.length });
        keptBytes += body.length;
        while (messages.length > MAX_MESSAGES || (keptBytes > MAX_KEPT_BYTES && messages.length > 1)) keptBytes -= messages.shift().bytes;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ seq }));
      } catch {
        res.writeHead(400).end();
      }
    });
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer(handle).listen(PORT, () => {
    console.log(`Radar simulator classroom server running.`);
    console.log(`  This computer:   http://localhost:${PORT}/`);
    for (const list of Object.values(networkInterfaces())) {
      for (const n of list || []) if (n.family === "IPv4" && !n.internal) console.log(`  Other computers: http://${n.address}:${PORT}/`);
    }
    console.log(`Records and class settings are kept in: ${dataDir}`);
    const u = readUsers();
    if (u.keyEnabled) console.log(`Station key (type it once at the instructor station, RECORDS, "Server key"): ${stationKey()}`);
    else console.log("The station key is switched off: instructors log in with their own accounts.");
    if (u.users.length) console.log(`Instructors' accounts: ${u.users.length}.`);
    console.log(`A backup is made every day in ${backupsDir()} (the last ${ACCOUNT_RULES.keepDailyBackups} days are kept).`);
    console.log("Training use only. Press Ctrl+C to stop.");
    const backup = () => {
      try {
        const made = dailyBackup();
        if (made) console.log(`Backup made: ${made}`);
      } catch (e) {
        console.log(`The daily backup could not be made: ${e?.message ?? e}`);
      }
    };
    backup();
    setInterval(backup, 3600_000).unref();
  });
}
