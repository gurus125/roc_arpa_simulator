// The manual's pictures of the instructor station, with two displays linked through the classroom
// server. Run after `npm run build`:
//   node docs/manual-src/shots/station.mjs [folder for the raw pictures]
// About five minutes. The server's store goes to a temporary folder, never to the project's "data"
// folder, and the names and results in the pictures are invented.
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { handle, setDataDir, stationKey } from "../../../server/server.mjs";
import { chromium, step, RAW, VIEW, SHARP } from "./lib.mjs";

const dataDir = mkdtempSync(path.join(tmpdir(), "radar-sim-manual-"));
setDataDir(dataDir);
const PORT = 8152;
const srv = createServer(handle);
await new Promise((r) => srv.listen(PORT, r));
const base = `http://localhost:${PORT}`;
const browser = await chromium.launch();
const errs = [];
const out = (name) => path.join(RAW, `${name}.png`);

const sctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SHARP });
const st = await sctx.newPage();
st.on("pageerror", (e) => errs.push("station: " + e.message));
st.on("dialog", (d) => d.accept());
await st.goto(base + "/instructor");
await st.waitForTimeout(500);
await st.screenshot({ path: out("st-login") });
const login = async () => { await st.fill("#stPin", "0000"); await st.click("#stLoginBtn"); await st.waitForTimeout(400); };
await login();
const tab = async (k) => { await st.click(`#topTabs button[data-st="${k}"]`); await st.waitForTimeout(400); };
const tall = async (h, fn) => { await st.setViewportSize({ width: VIEW.width, height: h }); await st.waitForTimeout(500); try { await fn(); } finally { await st.setViewportSize(VIEW); } };
const elShot = async (name, sel) => { const e = await st.$(sel); if (!e) throw new Error("no element " + sel); await e.screenshot({ path: out(name) }); };
/** The section that holds an element, or the part of it from a heading down. */
const secShot = async (name, id) => { const hnd = await st.evaluateHandle((i) => document.getElementById(i)?.closest("section"), id); const e = hnd.asElement(); if (!e) throw new Error("no section for " + id); await e.screenshot({ path: out(name) }); };
/** A paper the station prints: it opens in a window of its own. */
const paper = async (click, name) => {
  const [pop] = await Promise.all([st.waitForEvent("popup", { timeout: 8000 }), st.click(click)]);
  await pop.setViewportSize({ width: 900, height: 1270 });
  await pop.waitForTimeout(400);
  await pop.screenshot({ path: out(name), fullPage: true });
  await pop.close().catch(() => {});
};

await step("a batch", async () => {
  await tab("batch");
  await st.fill("#inBatchName", "ROC 12");
  await st.click("#inBatchAdd");
  await st.fill("#inStudents", "Asha Verma\nRavi Nair\nMeera Iyer\nImran Khan");
  await st.click("#inBatchSave");
  await st.waitForTimeout(300);
});
await step("older records, so that the lists and the chart have something in them", async () => {
  // On a page of the same address that does not run the simulator, so that nothing writes the store back over this.
  await st.goto(base + "/api/poll?since=0");
  await st.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("radar-sim-store-v1"));
    const item = (ok, by) => ({ id: "q", label: "q", kind: "number", student: "", correct: "", ok, points: ok ? 10 : 0, max: 10, by });
    const mk = (id, day, ex, title, students, pct, dec, who = "Capt. Rao") => ({ id, exerciseId: ex, title, kind: "arpa", students, batch: "ROC 12", startedIso: `2026-11-${day}T10:00:00.000Z`, simSeconds: 900, names: {}, coasts: [], frames: [{ t: 0, own: { e: 0, n: 0, hdg: 0, spd: 12, ordC: 0, ordS: 12 }, tg: [], tracks: 0, alarms: [] }], events: [], summary: [],
      result: { exerciseId: ex, title, simSeconds: 900, items: [item(true, students[0]), item(pct > 50, students[0])], score: 0, max: 0, percent: pct, passed: null, debrief: [], placeholderNote: "" }, ...(dec ? { assessor: { decision: dec, name: who, remarks: "" } } : {}) });
    d.records = [
      mk("r8", "17", "arpa-9", "ARPA 9: Collision avoidance in restricted visibility", ["Asha Verma"], 82, "competent"),
      mk("r7", "16", "radar-22", "RADAR 22: Switching on and setting up the radar", ["Meera Iyer", "Imran Khan"], 78, "competent", "Capt. D'Souza"),
      mk("r6", "15", "arpa-6", "ARPA 6: Trial manoeuvre", ["Asha Verma"], 74, "competent"),
      mk("r5", "14", "arpa-6", "ARPA 6: Trial manoeuvre", ["Asha Verma", "Ravi Nair"], 48, "not-yet"),
      mk("r4", "12", "arpa-5", "ARPA 5: CPA/TCPA limits, alarms and bow crossing", ["Asha Verma"], 66, "competent", "Capt. D'Souza"),
      mk("r3", "11", "arpa-1", "ARPA 1: Setting up and manual acquisition", ["Asha Verma"], 90, "competent"),
      mk("r2", "10", "arpa-1", "ARPA 1: Setting up and manual acquisition", ["Asha Verma", "Ravi Nair"], 55, "not-yet", "Capt. D'Souza"),
      mk("r1", "09", "radar-22", "RADAR 22: Switching on and setting up the radar", ["Ravi Nair"], 60, "competent"),
    ];
    d.scoring.passPercent = 60;
    localStorage.setItem("radar-sim-store-v1", JSON.stringify(d));
  });
  await st.goto(base + "/instructor");
  await login();
});

// ---------------------------------------------------------------- two displays
const mkDisplay = async (names) => {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("display: " + e.message));
  await p.goto(base + "/");
  await p.waitForFunction(() => window.__simTest.batchNames().length > 0, null, { timeout: 20000 });
  await p.evaluate(() => document.getElementById("whoChange").click());
  await p.waitForTimeout(300);
  const bid = await p.$eval("#lgBatch", (s) => [...s.options].find((o) => o.textContent === "ROC 12")?.value ?? "");
  await p.selectOption("#lgBatch", bid);
  for (let i = 0; i < names.length; i++) await p.selectOption(`#lgS${i}`, names[i]);
  return p;
};
const runAt = (p, sp) => p.evaluate((sp) => {
  document.body.classList.remove("menu-open");
  const b = document.getElementById("run");
  if (/run/i.test(b.textContent)) b.click();
  const s = document.getElementById("speed");
  s.value = sp;
  s.dispatchEvent(new Event("change", { bubbles: true }));
}, sp);
let A, B;
await step("two displays log in", async () => {
  A = await mkDisplay(["Asha Verma", "Ravi Nair"]);
  await A.screenshot({ path: out("login-batch") });
  await A.click("#lgStart");
  B = await mkDisplay(["Meera Iyer", "Imran Khan"]);
  await B.click("#lgStart");
  await tab("class");
  await st.waitForFunction(() => document.querySelectorAll('#inStations button[data-cmd="obs"]').length >= 2, null, { timeout: 20000 });
});
await step("CLASSROOM with two exercises running", async () => {
  await A.evaluate(() => window.__simTest.startExercise("arpa-5"));
  await B.evaluate(() => window.__simTest.startExercise("radar-28"));
  await A.waitForTimeout(600);
  await A.evaluate(() => document.body.classList.remove("menu-open"));
  const c = await (await A.$("#ppi")).boundingBox();
  const ts = await A.evaluate(() => window.__simTest.targetsScreen());
  await A.click("#cmAcq");
  for (const t of ts) { await A.mouse.click(c.x + t.x, c.y + t.y); await A.waitForTimeout(150); }
  await runAt(A, "10");
  await runAt(B, "10");
  // Fifteen minutes of exercise time, so that something needs attention.
  await st.waitForTimeout(90000);
  await runAt(A, "1");
  await runAt(B, "1");
  await st.waitForTimeout(2500);
  await st.screenshot({ path: out("st-classroom") });
  await tall(2600, async () => { await st.waitForTimeout(2000); await st.screenshot({ path: out("st-classroom-full"), fullPage: true }); });
});
await step("watching a display", async () => {
  await st.click('#inStations button[data-cmd="watch"]');
  await st.waitForFunction(() => { const i = document.getElementById("watchImg"); return i && i.naturalWidth > 0; }, null, { timeout: 15000 });
  await st.waitForTimeout(2500);
  await st.evaluate(() => document.getElementById("watchBox").scrollIntoView());
  await st.waitForTimeout(300);
  await elShot("st-watch", "#watchBox");
  await st.click("#watchClose");
});
await step("the observation checklist", async () => {
  await st.click('#inStations button[data-cmd="obs"]');
  await st.waitForTimeout(2500);
  await st.click('#obsItems button[data-obs="0"][data-mark="yes"]');
  await st.click('#obsItems button[data-obs="2"][data-mark="yes"]');
  await st.selectOption("#obsWho", "Ravi Nair");
  await st.click('#obsItems button[data-obs="5"][data-mark="no"]');
  await st.fill("#obsNotes", "Acquired all four ships at once. Slow to act on Ship L.");
  await st.click("#obsSave");
  await st.waitForTimeout(500);
  await tall(2400, () => elShot("st-observe", "#obsBox"));
});
await step("display A finishes its exercise", async () => {
  await A.evaluate(() => { const e = document.getElementById("ordCourse"); e.value = "50"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
  await runAt(A, "10");
  await A.waitForTimeout(12000);
  await runAt(A, "1");
  await A.evaluate(() => document.querySelector('#cMenu button[data-key="ex"]')?.click());
  await A.waitForTimeout(300);
  const ids = await A.$$eval("#exTaskList [id^=exIn_]", (e) => e.map((x) => [x.id, x.tagName]));
  for (const [id, tag] of ids) {
    if (tag === "SELECT") await A.selectOption("#" + id, "0"); else await A.fill("#" + id, "1.2");
    await A.click(`button[data-ans="${id.slice(5)}"]`);
  }
  await A.evaluate(() => document.getElementById("exFinish").click());
  await A.waitForTimeout(800);
  await A.fill("#dbSelf", "We tracked all four ships early. We should have altered sooner for Ship L.");
  await A.fill("#dbGoals", "Use the trial manoeuvre before altering.");
  await A.click("#dbSave");
  await A.waitForTimeout(1500);
});
await step("RECORDS and an opened record", async () => {
  await tab("recs");
  await st.waitForFunction(() => /11-1\d \d\d:\d\d\s+Asha Verma \/ Ravi Nair\s+ARPA 5/.test(document.getElementById("inRecs").innerText.replace(/\s+/g, " ")) || document.querySelectorAll("#inRecs button[data-act=open]").length >= 9, null, { timeout: 20000 });
  await st.waitForTimeout(800);
  await st.screenshot({ path: out("st-records") });
  await st.click('#inRecs button[data-act="open"]');
  await st.waitForTimeout(1200);
  await st.evaluate(() => { const s = document.getElementById("inScrub"); s.value = String(Math.round(Number(s.max) * 0.7)); s.dispatchEvent(new Event("input", { bubbles: true })); });
  await st.waitForTimeout(800);
  await tall(5200, async () => {
    await st.selectOption("#asDec", "competent"); // against a score below the pass mark: the station asks for a reason
    await st.fill("#asName", "Capt. Rao");
    await st.click("#asSave");
    await st.waitForTimeout(500);
    await secShot("st-record-full", "inRecView");
    // Where each part of the record is, for assets.py (CSS pixels from the top of the section).
    console.log("record parts:", JSON.stringify(await st.evaluate(() => {
      const sec = document.getElementById("inRecView").closest("section").getBoundingClientRect();
      const y = (id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top - sec.top) : null; };
      return { title: y("inRecTitle"), pic: y("inPic"), play: y("inPlay"), result: y("inRecResult"), by: y("inRecBy"), debrief: y("gdSteps"), evidence: y("inRecEvid"), decision: y("asDec"), height: Math.round(sec.height), width: Math.round(sec.width) };
    })));
    await st.click("#clsShow");
    await st.waitForTimeout(300);
    await elShot("st-class-on-exercise", "#clsOut");
  });
});
await step("the papers of a record", async () => {
  await paper("#gdPrint", "paper-debrief-pack");
  await paper("#inRecPrint", "paper-report");
});
await step("progress, assessors, the server's store", async () => {
  await st.selectOption("#tfWho", { label: "Asha Verma (ROC 12)" });
  await st.click("#phShow");
  await st.waitForTimeout(400);
  await elShot("st-progress", "#phOut");
  await st.click("#asCmp");
  await st.waitForTimeout(300);
  await elShot("st-assessors", "#asCmpOut");
  await paper("#tfPrint", "paper-trainee-file");
  await st.fill("#svKey", stationKey());
  await st.click("#svKeySet");
  await st.waitForFunction(() => /Kept on the classroom server/.test(document.getElementById("svState").textContent), null, { timeout: 40000 });
  await st.waitForTimeout(600);
  await tall(6400, async () => {
    const r = await st.evaluate(() => {
      const h = [...document.querySelectorAll("h2")].find((x) => /keeping the records/i.test(x.textContent));
      const top = h.getBoundingClientRect().top - 8;
      // down to the next heading, or the end of the section
      const sec = h.closest("section").getBoundingClientRect();
      const next = [...h.closest("section").querySelectorAll("h2")].map((x) => x.getBoundingClientRect().top).filter((y) => y > top + 20).sort((a, b) => a - b)[0];
      return { x: sec.left, y: top, width: sec.width, height: (next ?? sec.bottom) - top };
    });
    await st.screenshot({ path: out("st-keeping"), clip: r });
  });
});
await step("EXERCISES and its papers", async () => {
  await tab("ex");
  await st.screenshot({ path: out("st-exercises") });
  await tall(3000, () => st.screenshot({ path: out("st-exercises-full"), fullPage: true }));
  await st.selectOption("#xsEx", "arpa-6");
  await paper("#xsPrint", "paper-exercise-sheet");
  await st.selectOption("#msEx", "arpa-6");
  await paper("#msPrint", "paper-marking-sheet");
  await st.selectOption("#xsEx", "roc-plot");
  await paper("#xsPrint", "paper-exercise-sheet-roc");
});
await step("BATCHES with accounts and the progress of the batch", async () => {
  await tab("batch");
  await st.check("#inReqLogin");
  await st.click("#inBatchSave");
  await st.waitForTimeout(400);
  await st.click("#bmShow");
  await st.waitForTimeout(400);
  await tall(1700, () => st.screenshot({ path: out("st-batches"), fullPage: true }));
  await st.uncheck("#inReqLogin");
  await st.click("#inBatchSave");
});
await step("SCENARIOS", async () => {
  await tab("scen");
  await st.waitForTimeout(300);
  await st.screenshot({ path: out("st-scenarios") });
});
await step("OWN RADAR: a programmed track, and the faults", async () => {
  await tab("radar");
  await st.waitForTimeout(800);
  await st.click("#rngUp");
  const openKey = async (k) => {
    await st.evaluate((k) => { if (!document.body.classList.contains("menu-open")) document.getElementById("menuKey").click(); document.querySelector(`#cMenu button[data-key="${k}"]`).click(); }, k);
    await st.waitForTimeout(400);
  };
  await openKey("instr");
  await st.click("#inRtStart");
  await st.evaluate(() => document.getElementById("menuClose").click());
  const c = await (await st.$("#ppi")).boundingBox();
  for (const [fx, fy] of [[0.62, 0.3], [0.45, 0.25], [0.3, 0.4], [0.28, 0.62]]) { await st.mouse.click(c.x + c.width * fx, c.y + c.height * fy); await st.waitForTimeout(200); }
  await openKey("instr");
  await st.click("#inRtSet");
  await st.check("#inRtShow");
  await st.waitForTimeout(1500);
  await st.screenshot({ path: out("st-ownradar-instr") });
  await openKey("fault");
  await st.evaluate(() => { const e = document.getElementById("gyroErr"); e.value = "3"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
  await st.waitForTimeout(600);
  await st.screenshot({ path: out("st-ownradar-faults") });
});
await step("the self-test", async () => {
  await tab("ex");
  await st.click("#stRun");
  await st.waitForFunction(() => document.querySelectorAll("#stRows tr").length >= 31, null, { timeout: 150000 });
  await st.waitForTimeout(500);
  await tall(2400, () => secShot("st-selftest", "stRun"));
});

console.log("page errors:", errs.join("; ") || "none");
await browser.close();
await new Promise((r) => srv.close(r));
rmSync(dataDir, { recursive: true, force: true });
