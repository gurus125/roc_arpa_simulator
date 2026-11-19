// The robot student on the #demo display: works exercises through the screen's own controls in a headless
// browser and reports each result. Run after `npm run build`:
//   node scripts/robot-demo-test.mjs                    every exercise of the ARPA EX list at level 5
//   node scripts/robot-demo-test.mjs arpa-1,arpa-6 3    some exercises, at another level
// Several browsers run side by side. Pictures of each finished exercise go to the folder given by
// ROBOT_SHOTS, if set. Needs Playwright, like the screen test.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = await import("playwright");
const html = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "radar-simulator.html")).href + "#demo";
const level = Number(process.argv[3] ?? 5);
const seed = Number(process.argv[4] ?? 1);
const parallel = Number(process.env.ROBOT_PARALLEL ?? 4);
const shots = process.env.ROBOT_SHOTS ?? "";
const browser = await chromium.launch();
const probe = await (await browser.newContext()).newPage();
await probe.goto(html);
const all = await probe.$$eval("#rbEx option", (o) => o.map((x) => x.value).filter((v) => v !== "all"));
await probe.context().close();
const ids = process.argv[2] && process.argv[2] !== "all" ? process.argv[2].split(",") : all;
const results = [];
const failures = [];

async function one(id) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(html);
  await p.selectOption("#rbEx", id);
  await p.selectOption("#rbLevel", String(level));
  await p.fill("#rbSeed", String(seed));
  await p.selectOption("#rbSpeed", "20");
  const t0 = Date.now();
  await p.click("#rbStart");
  // Done when START is enabled again (the run is over), at most 15 minutes.
  await p.waitForFunction(() => !document.getElementById("rbStart").disabled, null, { timeout: 15 * 60 * 1000, polling: 1000 }).catch(() => errs.push("timed out"));
  const out = await p.evaluate(() => {
    const t = window.__simTest;
    const text = [...document.querySelectorAll("#rbLog .result")].map((e) => e.textContent).join(" | ");
    const mistakes = [...document.querySelectorAll("#rbLog .mistake")].map((e) => e.textContent);
    return { text, mistakes, banner: t.bannerText() };
  });
  const m = /Result (\d+) of (\d+) \((\d+)%\)/.exec(out.text);
  const pct = m ? Number(m[3]) : null;
  if (shots) await p.screenshot({ path: path.join(shots, `robot-${id}.png`) });
  const rec = await p.evaluate(() => {
    const raw = localStorage.getItem("radar-sim-store-v1");
    const recs = raw ? JSON.parse(raw).records ?? [] : [];
    const r = recs[recs.length - 1];
    return r ? { robot: r.robot ?? null, students: r.students, hasResult: !!r.result, debrief: r.debrief?.self?.slice(0, 60) ?? "" } : null;
  });
  const secs = Math.round((Date.now() - t0) / 1000);
  results.push({ id, pct, secs, errs, rec });
  const ok = errs.length === 0 && pct !== null && (level < 5 || pct === 100) && rec?.robot?.level === level;
  if (!ok) failures.push(`${id}: ${pct}% ${errs.join("; ")} ${out.text.slice(0, 300)} record ${JSON.stringify(rec)}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${id.padEnd(9)} ${pct === null ? "--" : pct + "%"} in ${secs} s${out.mistakes.length ? `, ${out.mistakes.length} mistakes` : ""}${errs.length ? ` ERRORS ${errs.join("; ")}` : ""}${ok ? "" : ` | ${out.text.slice(0, 400)}`}`);
  await ctx.close();
}

const queue = [...ids];
await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
  while (queue.length > 0) await one(queue.shift());
}));
await browser.close();
console.log(`\n${results.length - failures.length} of ${results.length} as expected.`);
if (failures.length > 0) {
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}
