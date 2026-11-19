// Classroom server for the radar simulator. No installation beyond Node.js; no database.
//   npm run serve            (then open the address it prints on every student PC)
// It serves dist/radar-simulator.html and relays small status messages between student
// displays and the instructor station on the same network.
// It also keeps the instructor station's records and class settings on this computer's disk
// (the folder "data" beside this server, or RADAR_SIM_DATA), as plain JSON files, so that they do
// not depend on one browser. Only a station that gives the station key can read or write them;
// the key is made at the first start, kept in data/station-key.txt and printed below.
// Training use only: there is no encryption, and the key travels in clear on the network. Use
// it on the classroom network, not on the internet. The files hold trainees' names and results:
// keep the folder as the institute keeps its other records.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
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
const readBody = (req, limit, done) => {
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
  req.on("end", () => done(tooBig ? null : body));
};

/** Everything under /api/store: the instructor station's records and settings, for a station that gives the key. */
function handleStore(req, res, url) {
  if (!sameKey(req.headers["x-station-key"])) return json(res, 401, { error: "The station key is missing or wrong." });
  ensureDirs();
  const path = url.pathname.slice("/api/store/".length);
  if (req.method === "GET" && path === "info") {
    const list = readJson(historyFile(), []);
    return json(res, 200, { ok: true, records: Array.isArray(list) ? list.length : 0, state: existsSync(stateFile()) });
  }
  if (req.method === "GET" && path === "history") return json(res, 200, readJson(historyFile(), []));
  if (req.method === "GET" && path === "state") return existsSync(stateFile()) ? json(res, 200, readJson(stateFile(), {})) : json(res, 404, { error: "No settings have been saved." });
  if (path === "record" && (req.method === "GET" || req.method === "DELETE")) {
    const id = url.searchParams.get("id") || "";
    const file = recordFile(id);
    if (req.method === "GET") return existsSync(file) ? json(res, 200, readJson(file, null)) : json(res, 404, { error: "That record's replay is not kept here." });
    if (existsSync(file)) unlinkSync(file);
    const list = readJson(historyFile(), []);
    writeJson(historyFile(), (Array.isArray(list) ? list : []).filter((e) => e?.light?.id !== id));
    return json(res, 200, { ok: true });
  }
  if (req.method === "PUT" && (path === "record" || path === "state")) {
    readBody(req, MAX_STORE_BODY, (body) => {
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
      return json(res, 200, { ok: true, records: rest.length });
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
  if (url.pathname.startsWith("/api/store/")) return handleStore(req, res, url);
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
    console.log(`Station key (type it once at the instructor station, RECORDS, "Server key"): ${stationKey()}`);
    console.log("Training use only. Press Ctrl+C to stop.");
  });
}
