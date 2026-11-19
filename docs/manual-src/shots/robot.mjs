// The manual's pictures of the robot student on the #demo display. Run after `npm run build`:
//   node docs/manual-src/shots/robot.mjs [folder for the raw pictures]
// About three minutes. assets.py cuts the pictures to size.
import path from "node:path";
import { chromium, openDisplay, step, PAGE, RAW } from "./lib.mjs";

const browser = await chromium.launch();
const errors = [];

/** Start the robot on an exercise and wait until its caption (or log) shows the words looked for. */
async function robotUntil(h, id, level, seed, speed, re, timeoutMs = 240000) {
  const { p } = h;
  await p.selectOption("#rbEx", id);
  await p.selectOption("#rbLevel", String(level));
  await p.fill("#rbSeed", String(seed));
  await p.selectOption("#rbSpeed", String(speed));
  await p.click("#rbStart");
  await p.waitForFunction((src) => new RegExp(src).test(document.getElementById("rbCap").textContent), re.source, { timeout: timeoutMs, polling: 100 });
}
const finished = (h) => h.p.waitForFunction(() => !document.getElementById("rbStart").disabled, null, { timeout: 600000, polling: 500 });

await step("the robot checks its avoiding action with the trial manoeuvre (exercise 6)", async () => {
  const h = await openDisplay(browser, PAGE + "#demo");
  await robotUntil(h, "arpa-6", 5, 1, 10, /^Trial manoeuvre:/);
  await h.p.waitForTimeout(1600);
  await h.p.screenshot({ path: path.join(RAW, "robot-trial.png") });
  errors.push(...h.errs);
  await h.ctx.close();
});

await step("the robot plots by hand with the EBL and VRM (exercise 16)", async () => {
  const h = await openDisplay(browser, PAGE + "#demo");
  await robotUntil(h, "plot-05", 5, 1, 20, /^EBL and VRM on Target C/, 300000);
  await h.p.waitForFunction(() => /Plot Target C/.test(document.getElementById("rbLog").textContent), null, { timeout: 30000 }).catch(() => undefined);
  await h.p.waitForTimeout(300);
  await h.p.screenshot({ path: path.join(RAW, "robot-plot.png") });
  errors.push(...h.errs);
  await h.ctx.close();
});

await step("a level 2 robot's result and log, with its mistakes (exercise 1)", async () => {
  const h = await openDisplay(browser, PAGE + "#demo");
  await robotUntil(h, "arpa-1", 2, 2, 20, /^Opens exercise/);
  await finished(h);
  await h.p.evaluate(() => {
    const log = document.getElementById("rbLog");
    log.scrollTop = log.scrollHeight;
  });
  await h.p.waitForTimeout(400);
  await h.p.screenshot({ path: path.join(RAW, "robot-result.png") });
  await h.p.locator("#robotBar").screenshot({ path: path.join(RAW, "robot-bar.png") });
  errors.push(...h.errs);
  await h.ctx.close();
});

console.log("page errors:", errors.join("; ") || "none");
await browser.close();
