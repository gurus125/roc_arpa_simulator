// Link test: several displays working together through the classroom server.
// Starts the server, opens one instructor and four student displays in SEPARATE browser
// profiles (so they can only reach each other through the server, as separate PCs would),
// and checks monitoring, a linked exercise, pause/run, messages and recovery after the
// server is stopped and started again. Run with `npm run test:link` after `npm run build`.
// It runs on one machine: it does not replace a trial on the classroom's own PCs and network.
import { createServer } from "node:http";
import { handle } from "../server/server.mjs";

const { chromium } = await import("playwright");
const PORT = 8137;
const STUDENTS = 4;
const fails = [];
const check = (name, ok, detail = "") => {
  if (!ok) fails.push(`${name} ${detail}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name} ${ok ? "" : detail}`);
};
const listen = () => new Promise((res) => {
  const s = createServer(handle);
  s.listen(PORT, () => res(s));
});
let server = await listen();
const browser = await chromium.launch();
const open = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/`);
  await p.getByText("Free practice without names").click();
  await p.waitForTimeout(200);
  return p;
};
const text = (p, sel) => p.$eval(sel, (e) => e.innerText.replace(/\s+/g, " "));
const key = async (p, k) => {
  // The menu is a drawer: open it first.
  if (!(await p.evaluate(() => document.body.classList.contains("menu-open")))) await p.click("#menuKey");
  await p.click(`#cMenu button[data-key=${k}]`);
  await p.waitForTimeout(300);
};
const until = async (fn, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

const instr = await open();
const students = [];
for (let i = 0; i < STUDENTS; i++) students.push(await open());
await key(instr, "instr");
await instr.fill("#inPin", "0000");
await instr.click("#inLoginBtn");
const stations = () => instr.$$eval("#inStations canvas", (c) => c.length);

check("instructor display is linked through the server", (await text(instr, "#inLinkMode")).includes("server"), await text(instr, "#inLinkMode"));
check(`instructor sees all ${STUDENTS} student displays`, await until(async () => (await stations()) === STUDENTS), `${await stations()} seen`);

// A linked exercise: every display loads the scenario and sees the other own ships as targets.
const before = await students[0].evaluate(() => window.__simTest.targetCount());
await instr.click("#inLinked");
await key(instr, "instr"); // starting the exercise shows the radar keys; go back to the instructor page
const counts = async () => Promise.all(students.map((p) => p.evaluate(() => window.__simTest.targetCount())));
check("linked exercise: every student display shows the other own ships as targets", await until(async () => (await counts()).every((n) => n >= before + STUDENTS)), `targets before ${before}, now ${(await counts()).join(",")}`);

// Pause and run all displays.
const running = async () => Promise.all(students.map((p) => text(p, "#run")));
await instr.click("#inAllPause");
check("pause all reaches every student display", await until(async () => (await running()).every((t) => /run/i.test(t))), (await running()).join(","));
await instr.click("#inAllRun");
check("run all reaches every student display", await until(async () => (await running()).every((t) => /pause/i.test(t))), (await running()).join(","));

// A typed message from the instructor.
await instr.fill("#inMsgText", "Reduce to 3 NM range");
await instr.click("#inMsgSend");
const banners = async () => Promise.all(students.map((p) => text(p, "#banner")));
check("instructor's message is shown on every student display", await until(async () => (await banners()).every((t) => t.includes("Reduce to 3 NM range"))), (await banners()).join(" | "));

// The server stops (power cut, cable out) and comes back: the displays find it again by themselves.
// Connections still open are cut at once (waiting for them to end could hang the test).
await new Promise((r) => {
  server.close(r);
  server.closeAllConnections?.();
});
await new Promise((r) => setTimeout(r, 9000));
check("with the server stopped, the display says it is out of reach", (await text(instr, "#inLinkMode")).includes("out of reach"), await text(instr, "#inLinkMode"));
server = await listen();
check("after the server is started again, the instructor display is linked again", await until(async () => /Link: server\./.test(await text(instr, "#inLinkMode")), 30000), await text(instr, "#inLinkMode"));
check("and sees the student displays again", await until(async () => (await stations()) === STUDENTS, 40000), `${await stations()} seen`);
await instr.fill("#inMsgText", "Back on line");
await instr.click("#inMsgSend");
check("messages get through again", await until(async () => (await banners()).every((t) => t.includes("Back on line")), 30000), (await banners()).join(" | "));

for (const p of [instr, ...students]) check("no script errors on a display", p.errs.length === 0, p.errs.join("; "));
await browser.close();
await new Promise((r) => server.close(r));
console.log(fails.length ? `\n${fails.length} FAILED` : "\nAll link checks passed");
process.exit(fails.length ? 1 : 0);
