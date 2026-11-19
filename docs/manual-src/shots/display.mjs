// The manual's pictures of a trainee's display. Run after `npm run build`:
//   node docs/manual-src/shots/display.mjs [folder for the raw pictures]
// About four minutes. Each scene writes one or more PNG files; assets.py cuts them to size.
import path from "node:path";
import { chromium, openDisplay, step, RAW } from "./lib.mjs";

const browser = await chromium.launch();
const errors = [];

// ---------------------------------------------------------------- 1. open sea: the screen, measuring, the ARPA, AIS
{
  const h = await openDisplay(browser);
  const { p } = h;
  await step("login box", async () => { await h.shot("login"); });
  await p.getByText("Free practice without names").click();
  await p.waitForTimeout(400);
  await p.click("#rngUp"); // 12 NM
  await step("the display, its panels and the menu", async () => {
    await h.acquire((n) => !/Buoy|Yacht/.test(n));
    await h.fast(240);
    await h.clickTarget(0, "#cmSel");
    await h.park();
    await h.shot("display");
    for (const id of ["bDisp", "bGain", "bCur", "bOwn", "bTd", "bArpa"]) await h.shot(`panel-${id}`, "#" + id);
    await h.shot("header", "header");
    await h.openMenu();
    await p.waitForTimeout(400);
    await h.shot("menu");
    await h.closeMenu();
  });
  await step("EBL, VRM and a parallel index line", async () => {
    await h.clickTarget(0, "#cmEbl");
    await h.setVal("pi0Brg", "0");
    await h.setVal("pi0Rng", "2");
    await h.setVal("pi0On", true);
    await h.park();
    await h.shot("measure");
    await h.shot("measure-ppi", "#ppi");
    await h.shot("panel-ebl-on", "#bCur");
    await h.key("meas");
    await h.shot("menu-pimap");
    await h.closeMenu();
    await h.setVal("pi0On", false);
    await h.setVal("eblOn", false);
    await h.setVal("vrmOn", false);
  });
  await step("a dangerous target", async () => {
    await h.setVal("arpaTcpaLim", "25"); // so that the tanker ahead violates both limits
    await p.waitForTimeout(2500);
    await h.clickTarget(1, "#cmSel");
    await h.park();
    await h.shot("alarm");
    await h.shot("alarm-header", "header");
    await h.shot("panel-arpa-alarm", "#bArpa");
    await h.key("alarm");
    await h.shot("menu-alarm");
    await h.closeMenu();
    await p.click("#ackKey");
    await p.waitForTimeout(600);
  });
  await step("true vectors, trails and past positions", async () => {
    await h.setVal("trails", "true");
    await h.setVal("pastMode", "true");
    await p.evaluate(() => [...document.querySelectorAll("#vecSeg button")].find((b) => /TRUE/.test(b.textContent))?.click());
    await h.setVal("vecTimeSel", "12");
    await h.fast(200);
    await h.park();
    await h.shot("truevec");
    await p.evaluate(() => [...document.querySelectorAll("#vecSeg button")].find((b) => /REL/.test(b.textContent))?.click());
  });
  await step("trial manoeuvre", async () => {
    await h.setVal("trialOn", true);
    await p.waitForTimeout(300);
    await h.setVal("trialCourse", "50");
    await h.setVal("trialSpeed", "12");
    await h.setVal("trialDelay", "2");
    await p.waitForTimeout(1500);
    await h.key("trial");
    await h.shot("trial");
    await h.closeMenu();
    await h.shot("trial-ppi", "#ppi");
    await h.setVal("trialOn", false);
  });
  await step("predicted area of danger", async () => {
    await h.setVal("arpaGraphics", "pad");
    await p.waitForTimeout(1200);
    await h.park();
    await h.shot("pad-ppi", "#ppi");
    await h.setVal("arpaGraphics", "off");
  });
  await step("AIS targets", async () => {
    await h.clickEl("aisActAll");
    await p.waitForTimeout(800);
    await h.key("ais");
    await h.shot("menu-ais");
    await h.closeMenu();
    await h.shot("ais-ppi", "#ppi");
  });
  await step("night colours", async () => {
    await p.keyboard.press("F8");
    await p.waitForTimeout(800);
    await h.shot("night");
    await p.keyboard.press("F8");
  });
  errors.push(...h.errs);
  await h.ctx.close();
}

// ---------------------------------------------------------------- 2. the free-practice scenarios: land, SART, false echoes
{
  const h = await openDisplay(browser);
  const { p } = h;
  await p.getByText("Free practice without names").click();
  await p.waitForTimeout(400);
  // The list of scenarios is by position: 1 coastal, 2 SAR, 4 heavy traffic, 7 false echoes, 9 Goa.
  await step("Goa: land as the radar sees it", async () => {
    await h.setVal("scenario", "9");
    await p.waitForTimeout(500);
    await p.click("#rngUp");
    await h.T("placeOwn", 9, 1.5, 100); // closer to the coast, clear of the ships at anchor
    await p.waitForTimeout(11000);
    await h.park();
    await h.shot("goa-ppi", "#ppi");
  });
  await step("coastal waters", async () => {
    await h.setVal("scenario", "1");
    await p.waitForTimeout(9000);
    await h.park();
    await h.shot("coastal-ppi", "#ppi");
  });
  await step("SART and racon", async () => {
    await h.setVal("scenario", "2");
    await p.waitForTimeout(500);
    await p.click("#rngUp");
    await p.waitForTimeout(9000);
    await h.park();
    await h.shot("sar-ppi", "#ppi");
  });
  await step("false echoes", async () => {
    await h.setVal("scenario", "7");
    await p.waitForTimeout(9000);
    await h.park();
    await h.shot("false-ppi", "#ppi");
  });
  await step("heavy traffic", async () => {
    await h.setVal("scenario", "4");
    await p.waitForTimeout(500);
    await p.click("#rngUp");
    await p.waitForTimeout(9000);
    await h.park();
    await h.shot("heavy-ppi", "#ppi");
  });
  await step("visibility and the look-out", async () => {
    await h.setVal("scenario", "0");
    await p.waitForTimeout(500);
    await p.click("#rngUp");
    await p.waitForTimeout(3000);
    await h.setVal("visNm", "5");
    await p.waitForTimeout(1500);
    await h.park();
    await h.shot("visibility");
  });
  errors.push(...h.errs);
  await h.ctx.close();
}

// ---------------------------------------------------------------- 3. exercises, the ROC worksheet, the ship control window
{
  const h = await openDisplay(browser);
  const { p } = h;
  await p.getByText("Free practice without names").click();
  await p.waitForTimeout(400);
  await step("a traffic separation scheme and a route", async () => {
    await h.T("startExercise", "radar-28");
    await p.waitForTimeout(600);
    await h.closeMenu();
    await p.evaluate(() => document.getElementById("banner").click()); // the message that the exercise has started
    await p.waitForTimeout(8000);
    await h.park();
    await h.shot("tss-ppi", "#ppi");
    await h.T("startExercise", "radar-27");
    await p.waitForTimeout(600);
    await h.closeMenu();
    await p.waitForTimeout(8000);
    await h.park();
    await h.shot("route");
  });
  await step("an exercise: briefing, answers, result", async () => {
    await h.T("startExercise", "arpa-1");
    await p.waitForTimeout(800);
    await h.openMenu();
    await p.evaluate(() => document.getElementById("exRun").scrollIntoView());
    await p.waitForTimeout(300);
    await h.shot("exercise-brief");
    await h.closeMenu();
    await h.run();
    await h.acquire(() => true);
    await h.fast(230);
    await h.openMenu();
    const rows = await p.$$eval("#tdRows tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent)));
    // Two right answers read from the list, and two wrong ones, so that the result shows both.
    await p.fill("#exIn_cpaA", String(rows[0][3]));
    await p.click('button[data-ans="cpaA"]');
    await p.fill("#exIn_tcpaA", String(rows[0][4]));
    await p.click('button[data-ans="tcpaA"]');
    await p.fill("#exIn_crsB", "90");
    await p.click('button[data-ans="crsB"]');
    await p.selectOption("#exIn_danger", "0");
    await p.click('button[data-ans="danger"]');
    await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById("exTasks").scrollIntoView());
    await p.waitForTimeout(300);
    await h.shot("exercise-answers");
    await p.click("#exFinish");
    await p.waitForTimeout(800);
    await p.evaluate(() => document.getElementById("exResult").scrollIntoView());
    await p.waitForTimeout(300);
    await h.shot("exercise-result");
  });
  await step("switching on from cold", async () => {
    await h.T("startExercise", "radar-22");
    await p.waitForTimeout(800);
    await h.closeMenu();
    await h.run();
    await p.waitForTimeout(500);
    await h.shot("radar-off");
    await p.keyboard.press("F2");
    await p.waitForTimeout(2500);
    await h.shot("warmup");
  });
  await step("the ROC plotting worksheet", async () => {
    await h.T("startExercise", "roc-plot");
    await p.waitForTimeout(800);
    await h.openMenu();
    await p.waitForTimeout(300);
    await h.clickEl("rocStart");
    await p.waitForTimeout(800);
    for (let i = 0; i < 3; i++) {
      await h.closeMenu();
      const c = await h.box();
      const ts = await h.T("targetsScreen");
      await p.mouse.click(c.x + ts[0].x, c.y + ts[0].y);
      await p.waitForTimeout(400);
      await h.clickEl("obsTake");
      await p.waitForTimeout(300);
      if (i < 2) {
        await h.clickEl("advBtn");
        await p.waitForTimeout(9000);
      }
    }
    await h.openMenu();
    await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById("secWork").scrollIntoView());
    await p.waitForTimeout(400);
    await h.shot("roc-plot");
    await p.evaluate(() => document.getElementById("secAnsPlot").scrollIntoView());
    await p.waitForTimeout(400);
    await h.shot("roc-answers");
  });
  await step("the ship control window", async () => {
    await h.setVal("scenario", "0");
    await h.closeMenu();
    const [w] = await Promise.all([h.ctx.waitForEvent("page"), p.click("#shipWinKey")]);
    await w.waitForTimeout(1500);
    await w.setViewportSize({ width: 1280, height: 860 });
    await w.waitForTimeout(800);
    await w.screenshot({ path: path.join(RAW, "shipwin.png") });
  });
  errors.push(...h.errs);
  await h.ctx.close();
}

console.log("page errors:", errors.join("; ") || "none");
await browser.close();
