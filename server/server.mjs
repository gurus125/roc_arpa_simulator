// Classroom server for the radar simulator. No installation beyond Node.js; no database.
//   npm run serve            (then open the address it prints on every student PC)
// It serves dist/radar-simulator.html and relays small status messages between student
// displays and the instructor's Monitor page on the same network. Nothing is stored on disk.
// Training use only: there is no encryption and no real access control. Use it on the
// classroom network, not on the internet.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
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
    console.log("Training use only. Press Ctrl+C to stop.");
  });
}
