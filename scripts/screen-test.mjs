// Screen test: opens the built simulator in a headless browser and checks that the controls
// are on screen and do something. Run with `npm run test:screen` after `npm run build`.
// Needs Playwright (`npm i -D playwright` then `npx playwright install chromium`); it is not
// needed to build or use the simulator.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = await import("playwright");
const html = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "radar-simulator.html")).href;
const fails = [];
const check = (name, ok, detail = "") => {
  if (!ok) fails.push(`${name} ${detail}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name} ${ok ? "" : detail}`);
};
const browser = await chromium.launch();
for (const [W, H] of [[1366, 768], [1280, 600], [1920, 1080]]) {
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(html);
  await p.getByText("Free practice without names").click();
  await p.waitForTimeout(300);
  const tag = `[${W}x${H}]`;
  const key = async (k) => {
    await p.click(`#cMenu button[data-key=${k}]`);
    await p.waitForTimeout(500);
  };
  const topY = async (sel) => (await p.locator(sel).boundingBox()).y;
  const text = (sel) => p.$eval(sel, (e) => e.innerText.replace(/\s+/g, " "));

  // Every menu key shows at least one section, none squashed, and its first control can be reached.
  for (const k of await p.$$eval("#cMenu button", (bs) => bs.filter((b) => b.offsetParent).map((b) => b.dataset.key))) {
    await key(k);
    const r = await p.evaluate(() => {
      const side = document.querySelector("#side");
      const secs = [...side.querySelectorAll("section")].filter((e) => e.offsetParent && !e.closest("#console"));
      const squashed = secs.filter((e) => e.scrollHeight > e.clientHeight + 2).map((e) => e.querySelector("h2")?.textContent);
      const top = secs[0]?.getBoundingClientRect().top ?? -1;
      return { n: secs.length, squashed, top, h: window.innerHeight };
    });
    check(`${tag} key ${k} shows its controls`, r.n > 0 && r.squashed.length === 0 && r.top >= 0 && r.top < r.h, JSON.stringify(r));
  }

  // Own ship: course and speed.
  await key("own");
  {
    const b = await p.locator("#ordCourse").boundingBox();
    await p.mouse.click(b.x + b.width * 0.25, b.y + b.height / 2);
    await p.click("#telegraph button[data-k=NF]");
  }
  await p.selectOption("#speed", "10");
  await p.waitForTimeout(4000);
  const own = await text("#cOwn");
  check(`${tag} course order turns the ship`, !own.includes("HDG 000.0"), own);
  check(`${tag} speed order changes speed`, !own.includes("STW 12.0"), own);

  // Hand steering and telegraph.
  const apBefore = await p.$eval("#ordCourse", (e) => e.value);
  await p.click("#steerHand");
  await p.click('#helmScale button[data-v="25"]');
  await p.click('#helmScale button[data-d="1"]');
  check(`${tag} hand steering scale: +25 then + gives 26`, (await p.$eval("#helm", (e) => e.value)) === "26" && (await text("#helmV")) === "+26°", await text("#helmV"));
  await p.waitForTimeout(2500);
  check(`${tag} hand steering: rudder and rate of turn shown`, /RUD S \d+/.test(await text("#cOwn")) && /ROT S \d+/.test(await text("#cOwn")), await text("#cOwn"));
  check(`${tag} hand steering: autopilot course does not move and shows OFF`, (await p.$eval("#ordCourse", (e) => e.value)) === apBefore && (await text("#ordCourseV")) === "OFF", await text("#ordCourseV"));
  await p.click("#steerAuto");
  await p.click("#telegraph button[data-k=ST]");
  check(`${tag} menu keys are at the bottom of the panel`, (await topY("#cMenu")) > (await topY("#menuBody")) && (await topY("#cMenu")) > H - 90);
  check(`${tag} no engine order slider on screen`, !(await p.locator("#ordSpeed").isVisible()));
  check(`${tag} telegraph STOP sets the engine order`, (await p.$eval("#ordSpeed", (e) => e.value)) === "0");
  check(`${tag} ship types offered`, (await p.$$eval("#shipType option", (o) => o.length)) >= 3);

  // Scenario change and restart.
  await key("scen");
  const before = await text("#desc");
  await p.selectOption("#scenario", "1");
  await p.waitForTimeout(400);
  check(`${tag} scenario changes`, (await text("#desc")) !== before);
  await p.selectOption("#scenario", "0");
  await p.waitForTimeout(400);

  // Scenario with one vessel of every catalogue type.
  await p.selectOption("#scenario", "5");
  await p.waitForTimeout(400);
  check(`${tag} ship-types scenario has more than 20 targets`, (await p.evaluate(() => window.__simTest.targetCount())) > 20);
  await p.selectOption("#scenario", "0");
  await p.waitForTimeout(400);

  // Display box.
  await p.click("#bandKeys button[data-b=S]");
  check(`${tag} S band key`, (await p.$eval("#band", (e) => e.value)) === "S" && (await p.$eval("#bandKeys button[data-b=S]", (e) => e.classList.contains("on"))));
  await p.click("#bandKeys button[data-b=X]");
  check(`${tag} X band key`, (await p.$eval("#band", (e) => e.value)) === "X");
  await p.click("#rngUp");
  check(`${tag} range + works`, (await p.$eval("#range", (e) => e.value)) === "12");
  check(`${tag} range scales go to 96 NM`, (await p.$$eval("#range option", (o) => o.map((x) => x.value))).includes("96"));
  // EBL follows the cursor and locks on a double click.
  const c = await p.locator("#ppi").boundingBox();
  await p.check("#eblOn");
  await p.mouse.move(c.x + c.width * 0.75, c.y + c.height * 0.25);
  await p.waitForTimeout(200);
  check(`${tag} EBL follows cursor`, (await text("#m_ebl")).startsWith("045"), await text("#m_ebl"));
  await p.mouse.dblclick(c.x + c.width * 0.75, c.y + c.height * 0.25);
  await p.waitForTimeout(200);
  check(`${tag} EBL locks`, (await text("#ms_ebl")) === "LOCK");
  check(`${tag} cursor box`, /NM/.test(await text("#cCur")));

  // Top bar: radar on / standby and alarm acknowledge are at the top of the panel.
  check(`${tag} radar key and alarm ack at the top`, (await topY("#radarSb")) < (await topY("#bDisp")) && (await topY("#ackKey")) < (await topY("#bDisp")));
  await p.click("#radarSb");
  check(`${tag} radar standby key`, (await text("#radarSb")).includes("STANDBY"));
  await p.click("#radarSb");

  // Clutter auto, vectors, danger graphics.
  await p.check("#autoSea");
  check(`${tag} auto sea sets the control`, (await p.$eval("#stc", (e) => e.value)) !== "0");
  await p.selectOption("#arpaVec", "true");
  await p.selectOption("#vecTimeSel", "12");
  check(`${tag} vectors under trails`, (await p.$eval("#arpaVecT", (e) => e.value)) === "12" && (await topY("#arpaVec")) > (await topY("#trails")));
  await p.selectOption("#arpaGraphics", "pad");
  check(`${tag} PAD graphics`, (await p.$eval("#arpaGraphics", (e) => e.value)) === "pad");
  // EBL/VRM and the target keys are over the bottom-left corner of the picture.
  const pb = await p.locator("#ppi").boundingBox();
  const mb = await p.locator("#cMeas").boundingBox();
  const tb = await p.locator("#cmAcq").boundingBox();
  check(`${tag} EBL/VRM and target keys at the bottom left of the picture`, mb.x < pb.x + pb.width * 0.3 && mb.y > pb.y + pb.height * 0.7 && tb.y > pb.y + pb.height * 0.9 && tb.x < pb.x + pb.width * 0.2, JSON.stringify({ mb, tb }));
  check(`${tag} no AIS data panel, no separate targets or vectors box`, (await p.locator("#bAis, #bVec, #bTgt, #bMeas").count()) === 0);

  // Acquire the first target by its true position and read its data.
  const tgt = await p.evaluate(() => window.__simTest?.firstTargetScreen?.() ?? null);
  if (tgt) {
    await p.click("#cmAcq");
    await p.mouse.click(c.x + tgt.x, c.y + tgt.y);
    await p.waitForTimeout(600);
    check(`${tag} acquire shows target data`, (await text("#cTd")).includes("TGT"), await text("#cTd"));
  }

  // Manual speed row appears with the manual input.
  await key("arpa");
  await p.selectOption("#arpaLogMode", "manual");
  check(`${tag} manual speed input`, await p.locator("#arpaManSpd").isVisible());
  await p.selectOption("#arpaLogMode", "water");

  // Exercises start.
  await key("roc");
  await p.click("#rocStart");
  await p.waitForTimeout(400);
  check(`${tag} ROC exercise starts`, await p.locator("#obsTake").isVisible());
  await key("ex");
  await p.locator("#paneEx button").first().click();
  await p.waitForTimeout(400);
  check(`${tag} ARPA exercise opens`, (await text("#paneEx")).length > 50);

  // Manual plotting exercise: listed, starts with the exercise ship and the ARPA in standby.
  await p.locator('#paneEx button[data-ex="plot-01"]').click();
  await p.waitForTimeout(500);
  check(`${tag} manual plotting exercise uses the exercise ship`, (await p.$eval("#shipType", (e) => e.value)) === "simple");
  check(`${tag} manual plotting exercise: ARPA in standby`, /STANDBY|STBY/.test(await text("#cTgtN")), await text("#cTgtN"));
  await p.click("#ringsKey");
  await p.waitForTimeout(200);
  check(`${tag} rings off`, (await text("#ringsKey")) === "RINGS OFF");
  await p.click("#ringsKey");
  await p.click("#nightKey");
  check(`${tag} night key`, await p.evaluate(() => document.body.classList.contains("night")));
  await p.click("#nightKey");

  // Instructor self-test of the exercises (once is enough: it does not depend on the screen size).
  if (W === 1366) {
    await key("instr");
    await p.fill("#inPin", "0000");
    await p.click("#inLoginBtn");
    await p.click("#stRun");
    await p.waitForFunction(() => /PASSED|FAILED/.test(document.querySelector("#stMsg").textContent), null, { timeout: 90000 });
    check(`${tag} self-test of the exercises passes`, /ALL \d+ EXERCISES PASSED/.test(await text("#stMsg")), await text("#stMsg"));
  }

  check(`${tag} no script errors`, errs.length === 0, errs.join("; "));
  await p.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nAll screen checks passed");
process.exit(fails.length ? 1 : 0);
