// Screen test: opens the built simulator in a headless browser and checks that the controls
// are on screen and do something. Run with `npm run test:screen` after `npm run build`.
// Needs Playwright (`npm i -D playwright` then `npx playwright install chromium`); it is not
// needed to build or use the simulator.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const { chromium } = await import("playwright");
const html = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "radar-simulator.html")).href;
const fails = [];
const check = (name, ok, detail = "") => {
  if (!ok) fails.push(`${name} ${detail}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name} ${ok ? "" : detail}`);
};
const browser = await chromium.launch();
for (const [W, H] of [[1366, 768], [1280, 600], [1920, 1080]]) {
  // A context of its own, so that the instructor station can be opened beside the display in the same browser.
  const p = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(html);
  await p.getByText("Free practice without names").click();
  await p.waitForTimeout(300);
  const tag = `[${W}x${H}]`;
  // The menu is a drawer over the right-hand side of the screen: open it to reach a menu key, close it to
  // reach what it covers. A click on a control in the drawer opens it; a click on something it covers closes it.
  const menuOpen = () => p.evaluate(() => document.body.classList.contains("menu-open"));
  const openMenu = async () => {
    if (!(await menuOpen())) await rawClick("#menuKey");
  };
  const closeMenu = async () => {
    if (await menuOpen()) await rawClick("#menuClose");
  };
  const rawClick = p.click.bind(p);
  p.click = async (sel, opts) => {
    // Looked up and judged in one go: some lists are redrawn every second, so a handle can go stale.
    const where = await p.evaluate((q) => {
      const e = document.querySelector(q);
      if (!e) return { inSide: false, covered: false };
      const r = e.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { inSide: !!e.closest("#side"), covered: !e.closest("#side") && !!at?.closest("#side") };
    }, sel).catch(() => ({ inSide: false, covered: false }));
    if (where.inSide) await openMenu();
    if (where.covered) await closeMenu();
    return rawClick(sel, opts);
  };
  const key = async (k) => {
    await openMenu();
    await rawClick(`#cMenu button[data-key=${k}]`);
    await p.waitForTimeout(500);
  };
  const topY = async (sel) => (await p.locator(sel).boundingBox()).y;
  const text = (sel) => p.$eval(sel, (e) => e.innerText.replace(/\s+/g, " "));

  // The screen at the start: the picture in the middle with three data panels each side of it, the menu closed.
  {
    const lay = await p.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const col = (id) => [...document.getElementById(id).children].map((e) => e.id);
      const cols = [...document.querySelectorAll(".ccolumn")];
      return {
        ppi: r("ppi"), colL: r("colL"), colR: r("colR"), left: col("colL"), right: col("colR"), h: window.innerHeight, w: window.innerWidth,
        menuShown: document.getElementById("side").offsetParent !== null, zoom: Number(getComputedStyle(cols[0]).zoom),
        overflow: cols.flatMap((c) => [c, ...c.children]).filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.id),
        onPicture: document.querySelectorAll("#ppiCorner").length,
        pageScroll: document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight,
      };
    });
    check(`${tag} picture in the middle, data panels left and right of it`, lay.colL.right <= lay.ppi.left + 1 && lay.colR.left >= lay.ppi.right - 1, JSON.stringify({ ppi: lay.ppi, l: lay.colL.right, r: lay.colR.left }));
    check(`${tag} picture as tall as the window allows`, lay.ppi.height >= lay.h - 100, `${lay.ppi.height} of ${lay.h}`);
    check(`${tag} left: picture, gain and clutter, EBL and cursor; right: own ship, target data, VRM and ARPA`, lay.left.join() === "bDisp,bGain,bCur" && lay.right.join() === "bOwn,bTd,bArpa", `${lay.left} | ${lay.right}`);
    check(`${tag} every data panel fits, no page scroll`, lay.overflow.length === 0 && !lay.pageScroll, lay.overflow.join());
    check(`${tag} nothing written over the picture, menu closed`, lay.onPicture === 0 && !lay.menuShown);
    if (W >= 1880 && H >= 1000) check(`${tag} data panels drawn larger on a large screen`, lay.zoom >= 1.3, String(lay.zoom));
    await rawClick("#menuKey");
    const dr = await p.evaluate(() => ({ side: document.getElementById("side").getBoundingClientRect(), ppi: document.getElementById("ppi").getBoundingClientRect(), w: window.innerWidth }));
    check(`${tag} MENU opens the menu over the right-hand side`, dr.side.width > 200 && dr.side.right >= dr.w - 12 && dr.side.left > dr.ppi.left, JSON.stringify(dr.side));
    await p.keyboard.press("Escape");
    check(`${tag} Esc closes the menu`, !(await menuOpen()));
    await rawClick("#piMapKey");
    check(`${tag} PI / MAP key opens the menu at the PI lines and maps`, (await menuOpen()) && /PI/.test(await p.$eval("#menuTitle", (e) => e.textContent)), await p.$eval("#menuTitle", (e) => e.textContent));
    await closeMenu();
    // The header: RADAR, ARPA and EXERCISE tabs (no ECDIS), the ship's clock, the state of the alerts.
    const hdr = await p.evaluate(() => ({
      tabs: [...document.querySelectorAll("#topTabs button")].map((b) => b.textContent.trim()).join(","),
      time: document.getElementById("hdrTime").textContent, alarm: document.getElementById("hdrAlarm").textContent.trim(),
      foot: document.querySelector("footer#legend").innerText.replace(/\s+/g, " "),
    }));
    check(`${tag} header: RADAR, ARPA and EXERCISE tabs, clock, alert state`, hdr.tabs === "RADAR,ARPA,EXERCISE" && /^\d\d:\d\d:\d\d$/.test(hdr.time) && hdr.alarm === "No Alarms", JSON.stringify(hdr));
    check(`${tag} foot: symbol legend, and "not type approved, not for navigation"`, /not type approved/.test(hdr.foot) && /not for navigation/.test(hdr.foot) && /Tracked target/.test(hdr.foot) && /AIS target/.test(hdr.foot) && !/DGS/.test(hdr.foot), hdr.foot);
    const title = () => p.$eval("#menuTitle", (e) => e.textContent);
    await rawClick('#topTabs button[data-top="arpa"]');
    const tArpa = (await menuOpen()) && (await title()) === "ARPA";
    await rawClick('#topTabs button[data-top="exercise"]');
    const tEx = (await menuOpen()) && (await title()) === "ARPA EX";
    await rawClick('#topTabs button[data-top="radar"]');
    const tRadar = (await menuOpen()) && (await title()) === "RADAR";
    await rawClick('#topTabs button[data-top="radar"]');
    check(`${tag} tabs open the ARPA, exercise and radar menus; the lit tab again closes it`, tArpa && tEx && tRadar && !(await menuOpen()), JSON.stringify({ tArpa, tEx, tRadar }));
  }
  // Every menu key shows at least one section, none squashed, and its first control can be reached.
  await openMenu();
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
  {
    const mb = await p.evaluate(() => ({ menu: document.getElementById("cMenu").getBoundingClientRect().bottom, body: document.getElementById("menuBody").getBoundingClientRect().top, side: document.getElementById("side").getBoundingClientRect().bottom }));
    check(`${tag} menu keys are at the bottom of the menu`, mb.menu > mb.body && mb.menu >= mb.side - 20, JSON.stringify(mb));
  }
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

  // AIS targets and the ARPA on every range scale (IMO MSC.192(79) 5.25.1.3, 5.26.3, 5.27.5): an AIS ship 0.6 NM off
  // is drawn on the 1.5 NM scale with the ARPA on, and again with the ARPA in standby; switching AIS off removes it.
  {
    const near = await p.evaluate(() => window.__simTest.aisTarget());
    check(`${tag} the first scenario has an AIS ship`, !!near);
    if (near) {
      const setRangeSel = (v) => p.evaluate((x) => {
        const el = document.getElementById("range");
        el.value = x;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, v);
      await p.evaluate(({ e, n }) => window.__simTest.placeOwn(e - 0.6, n, 0), near.pos);
      await setRangeSel("1.5");
      await p.waitForTimeout(700);
      const on = await p.evaluate(() => window.__simTest.aisDrawn());
      const st = await text("#cArpaSt");
      check(`${tag} AIS ship drawn on the 1.5 NM scale, no "not available" message`, on >= 1 && !/NOT AVAILABLE/.test(st), `${on} | ${st}`);
      await p.evaluate(() => document.getElementById("arpaStandby").click());
      await p.waitForTimeout(500);
      const sb = await p.evaluate(() => window.__simTest.aisDrawn());
      check(`${tag} AIS ship still drawn with the ARPA in standby`, sb >= 1 && /ARPA STANDBY/.test(await text("#cArpaSt")), `${sb} | ${await text("#cArpaSt")}`);
      await p.click("#aisKey");
      await p.waitForTimeout(500);
      const off = await p.evaluate(() => window.__simTest.aisDrawn());
      check(`${tag} AIS key off removes the AIS ships`, off === 0, String(off));
      await p.click("#aisKey");
      await p.evaluate(() => document.getElementById("arpaStandby").click());
      await setRangeSel("6");
      await p.waitForTimeout(300);
    }
    await p.selectOption("#scenario", "0");
    await p.waitForTimeout(400);
  }

  // Display box.
  await p.click("#bandKeys button[data-b=S]");
  check(`${tag} S band key`, (await p.$eval("#band", (e) => e.value)) === "S" && (await p.$eval("#bandKeys button[data-b=S]", (e) => e.classList.contains("on"))));
  await p.click("#bandKeys button[data-b=X]");
  check(`${tag} X band key`, (await p.$eval("#band", (e) => e.value)) === "X");
  await p.click("#rngUp");
  check(`${tag} range + works`, (await p.$eval("#range", (e) => e.value)) === "12");
  check(`${tag} range scales go to 96 NM`, (await p.$$eval("#range option", (o) => o.map((x) => x.value))).includes("96"));
  // EBL follows the cursor and locks on a double click.
  await closeMenu();
  const c = await p.locator("#ppi").boundingBox();
  await p.check("#eblOn");
  await p.mouse.move(c.x + c.width * 0.75, c.y + c.height * 0.25);
  await p.waitForTimeout(200);
  check(`${tag} EBL follows cursor`, (await text("#m_ebl")).startsWith("045"), await text("#m_ebl"));
  await p.mouse.dblclick(c.x + c.width * 0.75, c.y + c.height * 0.25);
  await p.waitForTimeout(200);
  check(`${tag} EBL locks`, (await text("#ms_ebl")) === "LOCK");
  check(`${tag} cursor box`, /NM/.test(await text("#cCur")));
  check(`${tag} cursor box shows the position of the cursor`, /\d\d°\d\d\.\d{3}'[NS] \d{3}°\d\d\.\d{3}'[EW]/.test(await text("#cCur")), await text("#cCur"));

  // The data area is laid out as on a radar: own ship's data with its sensors and position, settings by their
  // abbreviations, bars for gain and clutter, and the simulator's own keys in the strip at the top of the page.
  {
    const o = await text("#cOwn");
    check(`${tag} own ship data: heading, speeds, sensors and position`, /HDG \d{3}\.\d ° GYRO STW [\d.]+ kn LOG COG \d{3}\.\d ° EPFS SOG [\d.]+ kn EPFS LAT \d\d°\d\d\.\d{3}'[NS] LON \d{3}°\d\d\.\d{3}'[EW]/.test(o), o);
    check(`${tag} own ship data: steering, wind and time`, /STEER (AUTO|HAND)/.test(o) && /WIND/.test(o) && /TIME \d\d:\d\d:\d\d/.test(await text("#bOwn h3")), o);
    const abbr = await p.evaluate(() => ["orient", "motion", "stab", "trails", "arpaVec", "arpaGraphics"].map((id) => [...document.getElementById(id).options].map((x) => x.textContent).join("/")));
    check(`${tag} settings are shown by their abbreviations`, abbr.join(" ") === "N UP/H UP/C UP RM/TM GND/SEA OFF/REL/TRUE REL/TRUE OFF/PPC/PAD", abbr.join(" "));
    check(`${tag} pause, speed, day/night and help are in the top strip`, await p.evaluate(() => ["run", "speed", "nightKey", "cHelp"].every((id) => !!document.getElementById(id).closest("header") && document.getElementById(id).offsetParent !== null)));
    const fill = async () => p.$eval("#gain", (e) => e.style.getPropertyValue("--p"));
    const g0 = await p.$eval("#gain", (e) => e.value);
    check(`${tag} gain bar is filled to the gain setting`, (await fill()) === `${g0}%`, await fill());
  }

  // The radar on / standby key is in the heading of the picture panel; the alarm acknowledge key is in the ARPA panel.
  check(`${tag} radar key at the top left, alarm ack in the ARPA panel`, await p.evaluate(() => !!document.getElementById("radarSb").closest("#bDisp h3") && !!document.getElementById("ackKey").closest("#bArpa")));
  await p.click("#radarSb");
  check(`${tag} radar standby key`, (await text("#radarSb")).includes("STANDBY"));
  await p.click("#radarSb");

  // Clutter auto, vectors, danger graphics.
  await p.check("#autoSea");
  check(`${tag} auto sea sets the control`, (await p.$eval("#stc", (e) => e.value)) !== "0");
  await p.click('#vecSeg button[data-v="true"]');
  await p.selectOption("#vecTimeSel", "12");
  check(`${tag} vector keys in the ARPA panel`, (await p.$eval("#arpaVecT", (e) => e.value)) === "12" && (await p.evaluate(() => !!document.getElementById("vecTimeSel").closest("#bArpa"))));
  await p.selectOption("#arpaGraphics", "pad");
  check(`${tag} PAD graphics`, (await p.$eval("#arpaGraphics", (e) => e.value)) === "pad");
  // The EBLs are in the EBL / cursor panel; the VRMs and the target keys in the VRM / ARPA panel.
  check(`${tag} EBLs bottom left, VRMs and target keys bottom right`, await p.evaluate(() => !!document.getElementById("m_ebl").closest("#bCur") && !!document.getElementById("m_vrm").closest("#bArpa") && !!document.getElementById("cmAcq").closest("#bArpa")));
  check(`${tag} no AIS data panel, no separate targets or vectors box`, (await p.locator("#bAis, #bVec, #bTgt, #bMeas").count()) === 0);

  // Acquire the first target by its true position and read its data.
  const tgt = await p.evaluate(() => window.__simTest?.firstTargetScreen?.() ?? null);
  if (tgt) {
    await closeMenu();
    await p.click("#cmAcq");
    await p.mouse.click(c.x + tgt.x, c.y + tgt.y);
    await p.waitForTimeout(600);
    check(`${tag} acquire shows target data`, (await text("#cTd")).includes("TGT"), await text("#cTd"));
    check(`${tag} target data has bearing and range with units, and is marked as a tracked target`, /BRG \d{3}(\.\d)? ?°T/.test(await text("#cTd")) && /RNG [\d.]+ ?NM/.test(await text("#cTd")) && (await text("#cTgtKind")) === "TT", `${await text("#cTd")} | ${await text("#cTgtKind")}`);
    // The tracked target is in the list, and its data label is shown on the picture; a click on it hides the label,
    // another shows it again.
    const labels = () => p.evaluate(() => window.__simTest.labels().join(","));
    const listed = await p.$$eval("#tdRows tr", (r) => r.length);
    const l1 = await labels();
    await p.mouse.click(c.x + tgt.x, c.y + tgt.y);
    await p.waitForTimeout(300);
    const l2 = await labels();
    await p.mouse.click(c.x + tgt.x, c.y + tgt.y);
    await p.waitForTimeout(300);
    const l3 = await labels();
    check(`${tag} target list and data label: shown, hidden by a click, shown again`, listed === 1 && /^t:\d+$/.test(l1) && l2 === "" && l3 === l1, JSON.stringify({ listed, l1, l2, l3 }));
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
  // The AIS display is locked off: the plotted ships transmit AIS, which would give away their course, speed and CPA.
  {
    const locked = async () => (await text("#aisKey")) === "AIS OFF" && (await p.isDisabled("#aisKey")) && !(await p.isChecked("#aisOn")) && (await p.isDisabled("#aisOn"));
    const l1 = await locked();
    await p.click("#aisKey", { force: true });
    await p.waitForTimeout(400);
    const l2 = await locked();
    const drawn = await p.evaluate(() => window.__simTest.aisDrawn());
    check(`${tag} manual plotting exercise: AIS display locked off`, l1 && l2 && drawn === 0 && /AIS OFF FOR THIS EXERCISE/.test(await text("#cArpaSt")), `${await text("#aisKey")} ${drawn} | ${await text("#cArpaSt")}`);
  }
  await p.click("#ringsKey");
  await p.waitForTimeout(200);
  check(`${tag} rings off`, (await text("#ringsKey")) === "OFF");
  await p.click("#ringsKey");
  // Sound signals.
  await key("comm");
  await p.click('#whistleKeys button[data-s="starboard"]');
  check(`${tag} sound signal key`, (await text("#whistleMsg")).includes("starboard"), await text("#whistleMsg"));

  // Settings: day / night mode, steering gear and own ship data (with a ship model again, not the exercise ship).
  await key("scen");
  await p.selectOption("#scenario", "1");
  await p.waitForTimeout(300);
  check(`${tag} after the plotting exercise the AIS display is on again`, (await text("#aisKey")) === "AIS ON" && (await p.isChecked("#aisOn")) && !(await p.isDisabled("#aisOn")) && !(await p.isDisabled("#aisKey")), await text("#aisKey"));
  await key("set");
  await p.click('#modeKeys button[data-m="night"]');
  await p.waitForTimeout(300); // the key label is redrawn on the next frame
  check(`${tag} night mode`, (await p.evaluate(() => document.body.dataset.mode)) === "night" && (await text("#nightKey")) === "NIGHT");
  await p.click("#nightKey");
  check(`${tag} day mode`, (await p.evaluate(() => document.body.dataset.mode)) === "day");
  check(`${tag} own ship data is hidden until asked for`, !(await p.locator("#osName").isVisible()));
  await p.click("#osToggle");
  await p.fill("#osName", "MV TEST");
  await p.locator("#osName").blur();
  check(`${tag} own ship data: position, UTC and size shown`, /\d\d°\d\d\.\d'N\s+\d{3}°/.test(await text("#osPos")) && /\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/.test(await text("#osUtc")), (await text("#osPos")) + " | " + (await text("#osUtc")));
  check(`${tag} telemotor 1 only at the start: 28 s`, (await text("#teleInfo")).includes("28 s"), await text("#teleInfo"));
  await p.click('#teleKeys button[data-u="2"]');
  await p.waitForTimeout(300);
  check(`${tag} telemotor 2 started: 18 s`, (await text("#teleInfo")).includes("18 s"), await text("#teleInfo"));
  await p.click('#teleKeys button[data-u="2"]');
  check(`${tag} own ship data: name is kept`, (await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => localStorage.getItem(k).includes("ownShip")))).ownShip.name)) === "MV TEST");

  // The instructor station, and the self-test of the exercises (once is enough: they do not depend on the screen size).
  if (W === 1366) {
    // The instructor station is the same page opened with #instructor, on the instructor's own PC (here a second page
    // of the same browser, which reaches this display through the same-computer channel).
    const st = await p.context().newPage();
    st.on("pageerror", (e) => errs.push(`station: ${e.message}`));
    await st.goto(`${html}#instructor`);
    await st.waitForTimeout(500);
    const pinFirst = (await st.isVisible("#stLogin")) && !(await st.isVisible("#login"));
    await st.fill("#stPin", "9999");
    await st.click("#stLoginBtn");
    const refused = await st.isVisible("#stLogin");
    await st.fill("#stPin", "0000");
    await st.click("#stLoginBtn");
    await st.waitForTimeout(300);
    const stTabs = await st.$$eval("#topTabs button", (b) => b.map((x) => x.textContent).join(","));
    const stHdr = await st.evaluate(() => {
      const h = document.querySelector("header");
      const t = document.querySelector("#topTabs").getBoundingClientRect();
      const b = document.querySelector("#brand b").getBoundingClientRect();
      return { fits: h.scrollWidth <= h.clientWidth + 1, clear: b.right <= t.left + 1, title: Math.round(b.width) };
    });
    check(`${tag} station header: the title is clear of the six tabs and nothing is cut off`, stHdr.fits && stHdr.clear && stHdr.title > 150, JSON.stringify(stHdr));
    check(`${tag} instructor station: PIN first (a wrong one refused), then its own tabs`, pinFirst && refused && !(await st.isVisible("#stLogin")) && stTabs === "CLASSROOM,RECORDS,EXERCISES,BATCHES,SCENARIOS,OWN RADAR", stTabs);
    check(`${tag} student display: no instructor keys, no PIN`, (await p.locator('#cMenu button[data-key="instr"], #cMenu button[data-key="fault"]').count()) === 0 && !(await p.isVisible("#inPin")) && !(await p.isVisible("#stPin")));
    const stTab = async (k) => {
      await st.click(`#topTabs button[data-st="${k}"]`);
      await st.waitForTimeout(300);
    };
    const stText = (sel) => st.$eval(sel, (e) => e.innerText.replace(/\s+/g, " "));
    const seen = await st.waitForFunction(() => document.querySelectorAll("#inStations canvas").length >= 1, null, { timeout: 10000 }).then(() => true, () => false);
    check(`${tag} instructor station sees the display in CLASSROOM`, seen && (await st.isVisible("#inStations canvas")));
    // A message from the station shows in a box over the display's screen, which stays where it is; a click closes it.
    await st.fill("#inMsgText", "Screen test message");
    await st.click("#inMsgSend");
    await p.waitForTimeout(700);
    const bn = await p.evaluate(() => {
      const b = document.getElementById("banner");
      return { shown: !b.hidden, text: b.textContent, foot: Math.round(document.querySelector("footer#legend").getBoundingClientRect().bottom), h: window.innerHeight };
    });
    await p.click("#banner");
    check(`${tag} a message from the station shows over the screen without moving it, and a click closes it`, bn.shown && /Screen test message/.test(bn.text) && Math.abs(bn.foot - bn.h) <= 1 && !(await p.isVisible("#banner")), JSON.stringify(bn));
    await stTab("ex");
    await st.click("#stRun");
    await st.waitForFunction(() => /PASSED|FAILED/.test(document.querySelector("#stMsg").textContent), null, { timeout: 180000 });
    check(`${tag} self-test of the exercises passes (instructor station)`, /ALL 32 EXERCISES PASSED/.test(await stText("#stMsg")), await stText("#stMsg"));

    // 100 ships at once on programmed tracks: the scenario loads and the picture keeps moving.
    await key("scen");
    await p.selectOption("#scenario", { label: "Traffic: 100 ships on programmed tracks" });
    await p.waitForTimeout(1500);
    check(`${tag} 100-ship scenario: 100 targets`, (await p.evaluate(() => window.__simTest.targetCount())) === 100);
    const fps = await p.evaluate(() => new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < 3000) requestAnimationFrame(f);
        else res(n / 3);
      };
      requestAnimationFrame(f);
    }));
    console.log(`     100 ships: ${fps.toFixed(0)} frames a second in this headless browser`);
    check(`${tag} 100-ship scenario: picture keeps moving (10 frames a second or more)`, fps >= 10, `${fps.toFixed(1)} fps`);

    // The instructor programmes a track for a target by clicking points on the station's own radar (OWN RADAR, MENU, INSTR).
    await stTab("radar");
    await st.click("#menuKey");
    await st.click('#cMenu button[data-key="instr"]');
    await st.waitForTimeout(300);
    await st.click("#inRtStart");
    const cb = await st.locator("#ppi").boundingBox();
    for (const [dx, dy] of [[0.30, 0.30], [0.40, 0.30], [0.40, 0.40]]) await st.mouse.click(cb.x + cb.width * dx, cb.y + cb.height * dy);
    await st.waitForTimeout(300);
    check(`${tag} track: three clicks give three waypoints`, (await stText("#inRtMsg")).includes("3 of 20"), await stText("#inRtMsg"));
    await st.click("#inRtUndo");
    await st.waitForTimeout(300);
    check(`${tag} track: undo removes a waypoint`, (await stText("#inRtMsg")).includes("2 of 20"), await stText("#inRtMsg"));
    await st.click("#inRtSet");
    await st.waitForTimeout(300);
    check(`${tag} track: target is put on the track`, /on a track, [12] points? ahead/.test(await stText("#inRtMsg")), await stText("#inRtMsg"));
    await st.click("#inRtClear");
    await st.waitForTimeout(300);
    check(`${tag} track: target taken off the track`, (await stText("#inRtMsg")).includes("no track"), await stText("#inRtMsg"));
    await st.click("#menuClose");
    const speeds = await st.$$eval("#inReplaySpeed option", (os) => os.map((o) => Number(o.value)));
    check(`${tag} replay: slow motion, real time and rapid speeds offered`, speeds.some((v) => v < 1) && speeds.includes(1) && speeds.some((v) => v > 1), speeds.join(","));

    // Scenarios on a real coastline and with false echoes load with their ships.
    await key("scen");
    await p.selectOption("#scenario", { label: "Approaches to Mumbai (real coastline)" });
    await p.waitForTimeout(600);
    check(`${tag} real coastline scenario loads`, (await p.evaluate(() => window.__simTest.targetCount() - window.__simTest.seaMarkCount())) === 7);
    // The area's buoys, beacons and lights give echoes; the echo sounder reads and the area map has its contours.
    check(`${tag} real area: sea marks among the targets`, (await p.evaluate(() => window.__simTest.seaMarkCount())) > 10, String(await p.evaluate(() => window.__simTest.seaMarkCount())));
    check(`${tag} real area: the echo sounder reads the depth`, /≈ \d+ m of water/.test(await p.evaluate(() => document.getElementById("osDepth").textContent)), await p.evaluate(() => document.getElementById("osDepth").textContent));
    check(`${tag} real area: depth contours to draw`, (await p.evaluate(() => window.__simTest.depthLines())) > 10);
    await p.evaluate(() => {
      const c = document.getElementById("areaMap");
      c.checked = true;
      c.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await p.waitForTimeout(400);
    await p.evaluate(() => {
      const c = document.getElementById("areaMap");
      c.checked = false;
      c.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await p.selectOption("#scenario", { label: "False echoes: power line, bridge and quay" });
    await p.waitForTimeout(600);
    check(`${tag} false echoes scenario loads`, (await p.evaluate(() => window.__simTest.targetCount())) === 3);

    // Control panel keys: Q and A work the gain; a key can be given to another function.
    await p.mouse.move(400, 300);
    const gain0 = Number(await p.$eval("#gain", (e) => e.value));
    await p.keyboard.press("KeyQ");
    check(`${tag} panel key raises the gain`, Number(await p.$eval("#gain", (e) => e.value)) === gain0 + 2);
    await p.keyboard.press("KeyA");
    check(`${tag} panel key lowers the gain`, Number(await p.$eval("#gain", (e) => e.value)) === gain0);
    await key("set");
    await p.click('#pnKeys button[data-pn="gainUp"]');
    await p.keyboard.press("KeyP");
    await p.keyboard.press("KeyP");
    check(`${tag} panel key can be changed`, Number(await p.$eval("#gain", (e) => e.value)) === gain0 + 2 && (await text("#pnKeys tr:first-child")).includes("P"), await text("#pnKeys tr:first-child"));
    await p.click("#pnReset");
    await p.keyboard.press("KeyA");

    // Items added from the Radar and ARPA Manual: refraction, safe limit vector suppression, anchor watch, aspect.
    await key("env");
    await p.selectOption("#refr", "sub");
    check(`${tag} refraction can be set to sub-refraction`, (await p.evaluate(() => window.__simTest.refraction())) === "sub");
    await p.selectOption("#refr", "standard");
    await key("past");
    await p.check("#arpaVecSup");
    check(`${tag} safe limit vector suppression can be switched on`, (await p.evaluate(() => window.__simTest.vectorSuppress())) === true);
    await p.uncheck("#arpaVecSup");
    await key("alarm");
    await p.click("#anchorSet");
    check(`${tag} anchor watch needs a selected target`, /off/i.test(await text("#anchorInfo")), await text("#anchorInfo"));
    check(`${tag} anchor watch keys are shown`, (await p.locator("#anchorSet").isVisible()) && (await p.locator("#anchorOff").isVisible()) && (await p.locator("#anchorLim").isVisible()));
    check(`${tag} the plot report asks for the aspect`, (await p.locator("#ansAsp").count()) === 1 && (await p.locator("#ansAspSide option").count()) === 2);

    // Alerts are acknowledged one at a time; sound can be silenced.
    check(`${tag} alert keys: acknowledge next and silence`, (await p.locator("#arpaAckNext").count()) === 1 && (await p.locator("#arpaSilence").count()) === 1);

    // Replay shows the radar picture the trainee saw.
    await key("ex");
    await p.locator("#paneEx button[data-ex]").first().click();
    await p.waitForTimeout(400);
    if (/run/i.test(await text("#run"))) await p.click("#run");
    await p.selectOption("#speed", "10");
    await p.waitForTimeout(5000);
    await p.click("#exFinish");
    await p.waitForTimeout(1500);
    // The display sends the record to the instructor station, which replays it with the radar pictures.
    await stTab("recs");
    const recRow = await stText("#inRecs tr");
    await st.locator('#inRecs button[data-act="open"]').first().click();
    await st.waitForTimeout(1000);
    const pic = await st.$eval("#inPic", (e) => ({ hidden: e.hidden, w: e.naturalWidth }));
    check(`${tag} the finished exercise's record reaches the instructor station`, /ARPA 1:/.test(recRow), recRow);
    check(`${tag} replay: the recorded radar picture is shown`, !pic.hidden && pic.w === 480, JSON.stringify(pic));

    // Items from IEC 62388 and IEC 62288.
    // Primary controls always in view: display brilliance and AIS on / off; the signal processing in use is shown.
    check(`${tag} brilliance is in the data area`, await p.evaluate(() => !!document.getElementById("brill").closest("#console") && document.getElementById("brill").offsetParent !== null));
    await p.click("#aisKey");
    await p.waitForTimeout(400);
    check(`${tag} AIS key switches AIS off`, (await text("#aisKey")) === "AIS OFF" && !(await p.isChecked("#aisOn")), await text("#aisKey"));
    await p.click("#aisKey");
    await p.waitForTimeout(400);
    check(`${tag} AIS key switches AIS on again`, (await text("#aisKey")) === "AIS ON" && (await p.isChecked("#aisOn")));
    await key("gain");
    await p.check("#irOn");
    await p.waitForTimeout(300);
    check(`${tag} signal processing in use is shown`, (await p.$$eval("#cProc i.on", (e) => e.map((x) => x.textContent).join(","))) === "IR", await text("#cProc"));
    await p.uncheck("#irOn");
    // EBL bearings true or relative, with the reference shown.
    await p.check("#eblOn");
    await p.waitForTimeout(300);
    const eblT = await text("#m_ebl");
    await p.click("#eblRef");
    await p.waitForTimeout(300);
    const eblR = await text("#m_ebl");
    check(`${tag} EBL readout true or relative, reference shown`, eblT.endsWith("T") && eblR.endsWith("R") && (await text("#eblRef")) === "REL", `${eblT} | ${eblR}`);
    await p.click("#eblRef");
    // A real area: Goa. The land paints from the real heights, and positions are given for that area.
    {
      await key("scen");
      const goa = await p.$$eval("#scenario option", (os) => os.findIndex((o) => /Mormugao/.test(o.textContent ?? "")));
      await p.selectOption("#scenario", String(goa));
      const setRange = (r) => p.evaluate((v) => {
        const el = document.querySelector("#range");
        el.value = v;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, r);
      await setRange("24");
      await p.waitForTimeout(3500);
      const kinds = await p.evaluate(() => window.__simTest.hitKinds());
      const pos = await text("#cOwn");
      check(`${tag} real area (Goa): land painted from its heights, position off Goa`, (kinds.coast ?? 0) > 20 && /LAT 15°2\d/.test(pos) && /LON 073°3\d/.test(pos), `${JSON.stringify(kinds)} ${pos.slice(0, 120)}`);
      await p.selectOption("#scenario", "0");
      await setRange("6");
      // A new scenario starts with the EBL off; the checks below use it.
      await p.evaluate(() => {
        const e = document.querySelector("#eblOn");
        if (!e.checked) {
          e.checked = true;
          e.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await p.waitForTimeout(300);
    }
    // Sleeping AIS targets can be filtered by range; the lost target warning can be switched off.
    await key("ais");
    await p.selectOption("#aisFilter", "6");
    check(`${tag} AIS sleeping target filter`, (await p.evaluate(() => window.__simTest.aisFilter())) === 6);
    // More criteria: CPA, and class B only; the status is shown on the picture, on the AIS key and in the panel.
    await p.selectOption("#aisFiltCpa", "2");
    await p.selectOption("#aisFiltCls", "B");
    await p.waitForTimeout(400);
    const fLabel = await p.evaluate(() => window.__simTest.aisFilterLabel());
    check(`${tag} AIS filter by range and CPA for class B, status shown`, fLabel === "RNG>6 CPA>2 CLASS B ONLY" && (await text("#aisKey")) === "AIS FILT" && (await text("#aisFiltNow")).startsWith("Filter on"), `${fLabel} | ${await text("#aisKey")}`);
    await p.selectOption("#aisFiltCpa", "");
    await p.selectOption("#aisFiltCls", "all");
    await p.selectOption("#aisFilter", "");
    await p.waitForTimeout(300);
    check(`${tag} AIS filter off`, (await text("#aisKey")) === "AIS ON" && (await p.evaluate(() => window.__simTest.aisFilterLabel())) === "");
    // Own ship's AIS data on request.
    await p.click("#aisOwnKey");
    await p.waitForTimeout(400);
    check(`${tag} own ship AIS data on request`, (await text("#aisOwn")).includes("MMSI 419000001"), await text("#aisOwn"));
    await p.click("#aisOwnKey");
    // An AIS target's further data on request: the MORE key in the target data.
    const aisRow = '#aisRows tr[data-ais="1"]';
    if (await p.$(aisRow)) {
      await p.evaluate(() => document.querySelectorAll("#arpaRows tr.sel").forEach((r) => r.classList.remove("sel")));
      // The list is redrawn several times a second and answers on pointer down (a click could fall between redraws).
      const pressRow = () => p.evaluate((sel) => document.querySelector(`${sel} td`).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })), aisRow);
      await pressRow();
      await p.waitForTimeout(500);
      const moreShown = await p.isVisible("#cAisMore");
      if (moreShown) await p.click("#cAisMore");
      await p.waitForTimeout(500);
      const td = await text("#cTd");
      check(`${tag} AIS further data on request (MORE)`, moreShown && td.includes("IMO") && td.includes("DEST") && td.includes("CLASS"), td.slice(0, 160));
      if (moreShown) await p.click("#cAisMore");
      await pressRow();
      await p.waitForTimeout(300);
    } else check(`${tag} AIS further data on request (MORE)`, false, "no AIS row");
    await key("alarm");
    await p.uncheck("#arpaLostWarn");
    check(`${tag} lost target warning can be switched off`, (await p.evaluate(() => window.__simTest.lostWarning())) === false);
    await p.check("#arpaLostWarn");
    // Heading input lost (sent from the instructor station): the picture goes to unstabilised head-up and bearings are relative.
    await p.selectOption("#orient", "north-up");
    await stTab("class");
    await st.check("#rf_gyroFail");
    await st.click("#rfAll");
    await p.waitForTimeout(800);
    check(`${tag} heading failure: unstabilised head-up, relative bearings`, (await p.$eval("#orient", (e) => e.value)) === "head-up" && (await p.evaluate(() => window.__simTest.headingLost())) && (await text("#m_ebl")).endsWith("R"), `${await p.$eval("#orient", (e) => e.value)} ${await text("#m_ebl")}`);
    await st.uncheck("#rf_gyroFail");
    await st.click("#rfClear");
    await p.waitForTimeout(500);
    check(`${tag} faults cleared from the instructor station`, !(await p.evaluate(() => window.__simTest.headingLost())));
    // A radar signal lost (IMO MSC.192(79) 5.34.2 and 9.5): no radar picture, the warning names the signal, the AIS targets stay.
    {
      const echoes = async () => Object.values(await p.evaluate(() => window.__simTest.hitKinds())).reduce((a, b) => a + b, 0);
      const before = await echoes();
      await st.check("#rf_sigVideo");
      await st.check("#rf_sigHm");
      await st.click("#rfAll");
      await p.waitForTimeout(5000);
      const lost = await echoes();
      const ais = await p.evaluate(() => window.__simTest.aisDrawn());
      const stLost = await text("#cArpaSt");
      const hdrLost = (await text("#hdrAlarm")).trim();
      check(`${tag} radar signals lost: no echoes, the warning names them, AIS targets stay`, before > 0 && lost === 0 && ais > 0 && /RADAR SIGNAL LOST: VIDEO, HEADING MARKER/.test(stLost) && hdrLost !== "No Alarms", `${before} -> ${lost} echoes, ${ais} AIS | ${stLost} | ${hdrLost}`);
      await st.uncheck("#rf_sigVideo");
      await st.uncheck("#rf_sigHm");
      await st.click("#rfClear");
      await p.waitForTimeout(5000);
      const back = await echoes();
      // Picture freeze (5.34.1): the echoes stay, the alert is given.
      await st.check("#rf_picFreeze");
      await st.click("#rfAll");
      await p.waitForTimeout(1500);
      const f1 = await echoes();
      await p.waitForTimeout(4000);
      const f2 = await echoes();
      const stFrozen = await text("#cArpaSt");
      check(`${tag} picture freeze: the echoes stay as they were and the alert is given`, back > 0 && f1 > 0 && f2 === f1 && /PICTURE FREEZE/.test(stFrozen) && !/RADAR SIGNAL LOST/.test(stFrozen), `${back} back, frozen ${f1} then ${f2} | ${stFrozen}`);
      await st.uncheck("#rf_picFreeze");
      await st.click("#rfClear");
      await p.waitForTimeout(800);
      check(`${tag} picture freeze cleared`, !/PICTURE FREEZE/.test(await text("#cArpaSt")));
    }
    await p.selectOption("#orient", "north-up");
    // Unstabilised head-up cannot be used in true motion (Radar and ARPA Manual, 3rd edition, 1.5.2.1).
    {
      const modes = async () => `${await p.$eval("#orient", (e) => e.value)},${await p.$eval("#motion", (e) => e.value)}`;
      await p.selectOption("#motion", "true");
      await p.selectOption("#orient", "head-up");
      const hu = await modes();
      await p.selectOption("#motion", "true");
      const tm = await modes();
      check(`${tag} head-up only in relative motion: H UP gives RM, then TM gives C UP`, hu === "head-up,relative" && tm === "course-up,true", `${hu} / ${tm}`);
      await p.selectOption("#orient", "north-up");
    }
    // DEFAULT SETTINGS (IEC 62388 Table 35), after a confirmation.
    await key("set");
    p.once("dialog", (d) => d.accept());
    await p.click("#radarDefault");
    await p.waitForTimeout(500);
    const def = await p.evaluate(() => ({
      range: document.getElementById("range").value, orient: document.getElementById("orient").value, motion: document.getElementById("motion").value,
      stab: document.getElementById("stab").value, cpa: document.getElementById("arpaCpaLim").value, tcpa: document.getElementById("arpaTcpaLim").value,
      vec: document.getElementById("arpaVec").value, ebl: document.getElementById("eblOn").checked, rings: document.getElementById("ringsKey").textContent,
      vrm: document.getElementById("m_vrm").textContent, trails: document.getElementById("trails").value, band: document.getElementById("band").value,
    }));
    check(`${tag} default settings`, def.range === "6" && def.orient === "north-up" && def.motion === "true" && def.stab === "ground" && def.cpa === "2" && def.tcpa === "12" && def.vec === "relative" && def.ebl && def.rings === "OFF" && def.vrm === "0.25 NM" && def.trails === "true" && def.band === "X", JSON.stringify(def));
    // Parallel index lines: one put parallel to the heading, all switched off together.
    await key("meas");
    await p.click('#piGrid button[data-pihdg="1"]');
    await p.waitForTimeout(200);
    const piOn = await p.isChecked("#pi1On");
    await p.click("#piAllOff");
    check(`${tag} PI line parallel to the heading, then all PI lines off`, piOn && !(await p.isChecked("#pi1On")) && (await p.locator("#pi0Ahd").count()) === 1);
    // User settings: store, change, recall. (Storing over an existing setting, and recalling, ask for a confirmation.)
    const acceptAll = (d) => void d.accept().catch(() => {});
    p.on("dialog", acceptAll);
    await key("set");
    await p.click('[data-us-save="0"]');
    await p.waitForTimeout(200);
    const r0 = await p.$eval("#range", (e) => e.value);
    await p.click("#rngUp");
    await p.waitForTimeout(200);
    await p.click('[data-us-load="0"]');
    await p.waitForTimeout(300);
    check(`${tag} user setting stored and recalled`, (await p.$eval("#range", (e) => e.value)) === r0 && (await text("#usInfo0")) === "recalled", `${r0} ${await p.$eval("#range", (e) => e.value)} ${await text("#usInfo0")}`);
    // Setting-up exercise: the radar starts off, warms up, waits in standby, then transmits.
    await key("ex");
    await p.click('#paneEx button[data-ex="radar-22"]');
    await p.waitForTimeout(500);
    const off = await text("#radarSb");
    if (/run/i.test(await text("#run"))) await p.click("#run");
    await p.click("#radarSb");
    await p.waitForTimeout(300);
    const warming = await text("#radarSb");
    await p.selectOption("#speed", "10");
    await p.waitForFunction(() => /STANDBY/.test(document.getElementById("radarSb").textContent), null, { timeout: 30000 });
    await p.click("#radarSb");
    await p.waitForTimeout(300);
    check(`${tag} setting-up exercise: off, warming up, standby, on`, off === "RADAR: OFF" && /^WARM UP 1:/.test(warming) && (await text("#radarSb")) === "RADAR: ON", `${off} | ${warming} | ${await text("#radarSb")}`);
    await p.selectOption("#speed", "1");
    await p.click("#exFinish");
    await p.waitForTimeout(400);
    // Exercise 23 starts with the GNSS failed: no position, course or speed over the ground anywhere.
    await key("ex");
    await p.click('#paneEx button[data-ex="radar-23"]');
    await p.waitForTimeout(800);
    const fix = await text("#cOwn");
    check(`${tag} exercise 23: GNSS failed, NO FIX`, /LAT NO FIX/.test(fix) && /LON NO FIX/.test(fix) && /COG ---\.-/.test(fix), fix);
    // The anchor cannot be let go with way on.
    await key("own");
    await p.click("#anchorKey");
    await p.waitForTimeout(300);
    check(`${tag} anchor: refused with way on`, /Too much way on/.test(await text("#anchorNow")) && (await text("#anchorKey")) === "LET GO ANCHOR", await text("#anchorNow"));
    await key("ex");
    await p.click("#exFinish");
    await p.waitForTimeout(400);
    // Stern line and antenna mark switch on without trouble (the picture is checked for script errors below).
    await key("scen");
    await p.check("#sternLine");
    await p.check("#antMark");
    await p.waitForTimeout(500);
    await p.uncheck("#sternLine");
    await p.uncheck("#antMark");
    // The ship control window: steering, engine, anchor and the exercises in a window of their own (for a second
    // screen); closing it gives them back to the radar page.
    {
      await closeMenu();
      const [pop] = await Promise.all([p.context().waitForEvent("page"), rawClick("#shipWinKey")]);
      pop.on("pageerror", (e) => errs.push(`ship window: ${e.message}`));
      await pop.waitForTimeout(600);
      const inPop = await pop.evaluate(() => ["telegraph", "helmScale", "steerAuto", "ordCourse", "anchorKey", "paneEx", "paneRoc"].every((id) => !!document.getElementById(id)));
      const inMain = await p.evaluate(() => ["telegraph", "helmScale", "paneEx", "paneRoc"].some((id) => !!document.getElementById(id)));
      check(`${tag} ship control window opens with steering, engine, anchor and the exercises`, inPop && !inMain && (await pop.title()) === "Ship control" && (await p.$eval("#shipWinKey", (e) => e.classList.contains("on"))), JSON.stringify({ inPop, inMain }));
      const c0 = Number(await pop.$eval("#ordCourse", (e) => e.value));
      await pop.click('.setc button[data-dc="10"]');
      const c1 = Number(await pop.$eval("#ordCourse", (e) => e.value));
      await pop.click('#telegraph button[data-k="ST"]');
      await pop.waitForTimeout(400);
      const ordered = await pop.$eval("#swOrdered", (e) => e.textContent);
      check(`${tag} ship control window: SET COURSE +10 and the telegraph work`, (c1 - c0 + 360) % 360 === 10 && /Ordered 0 kn/.test(ordered) && (await p.evaluate(() => window.__simTest.orderedCourse())) === c1, `${c0} ${c1} ${ordered}`);
      if (!(await pop.isVisible('#paneEx button[data-ex="arpa-2"]'))) await pop.click("#swChoose");
      await pop.click('#paneEx button[data-ex="arpa-2"]');
      await pop.waitForTimeout(800);
      const exTitle = await pop.$eval("#exTitle", (e) => e.textContent);
      check(`${tag} ship control window: an exercise starts there, the radar's menu stays shut`, /^2\. /.test(exTitle) && !(await menuOpen()) && (await pop.$eval("#paneEx", (e) => !e.hidden)), exTitle);
      await key("ex");
      check(`${tag} ARPA EX on the radar brings the ship control window forward instead of the menu`, !(await menuOpen()));
      await pop.click('#swExTabs button[data-t="roc"]');
      check(`${tag} ship control window: the ROC exercises are there too`, await pop.$eval("#paneRoc", (e) => !e.hidden && !!e.querySelector("#rocSelect")));
      await pop.close();
      await p.waitForTimeout(800);
      const back = await p.evaluate(() => ["telegraph", "helmScale", "steerAuto", "ordCourse", "anchorKey", "paneEx", "paneRoc"].every((id) => !!document.getElementById(id)));
      check(`${tag} closing the ship control window gives the controls back to the radar page`, back && !(await p.$eval("#shipWinKey", (e) => e.classList.contains("on"))));
      await key("ex");
      await p.click("#exFinish");
      await p.waitForTimeout(400);
    }
    // The instructor station starts an exercise on the display, and its batches reach the display.
    await stTab("class");
    await st.selectOption("#inExSel", "arpa-3");
    await st.click('#inStations button[data-cmd="ex"]');
    await p.waitForTimeout(1000);
    await key("ex");
    const exT = await text("#exTitle");
    check(`${tag} instructor station starts an exercise on the display`, /^3\. /.test(exT), exT);
    await p.click("#exFinish");
    await stTab("batch");
    await st.fill("#inBatchName", "Screen test batch");
    await st.click("#inBatchAdd");
    await st.fill("#inStudents", "Asha\nRavi");
    await st.click("#inBatchSave");
    const gotBatch = await p.waitForFunction(() => window.__simTest.batchNames().includes("Screen test batch"), null, { timeout: 12000 }).then(() => true, () => false);
    check(`${tag} the station's batches reach the display`, gotBatch, JSON.stringify(await p.evaluate(() => window.__simTest.batchNames())));
    st.once("dialog", (d) => d.accept());
    await st.click("#inBatchDel");
    // Marking sheets: one choice per exercise, and "all" (instructor station, EXERCISES).
    const sheets = await st.$$eval("#msEx option", (os) => os.length);
    check(`${tag} marking sheets: all exercises listed`, sheets === 33, String(sheets));
    // ---- Added 18 Nov 2026: PRF, routes, lanes, man overboard, live control from the station, examinations.
    {
      const T = (fn, ...a) => p.evaluate(([f, args]) => window.__simTest[f](...args), [fn, a]);
      const waitFor = (fn, ms = 8000) => p.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
      // PRF chosen by hand: allowed with the medium pulse, greyed out and dropped with the long pulse.
      // The controls are in a part of the menu that is closed: set them as a choice in the menu would.
      const setVal = (id, v) => p.evaluate(([i, x]) => {
        const e = document.getElementById(i);
        e.value = x;
        e.dispatchEvent(new Event("input", { bubbles: true }));
        e.dispatchEvent(new Event("change", { bubbles: true }));
      }, [id, v]);
      await setVal("pulse", "medium");
      await setVal("prf", "600");
      await p.waitForTimeout(400);
      const prfSet = await T("prf");
      await setVal("pulse", "long");
      await p.waitForTimeout(400);
      const off1000 = await p.$eval('#prf option[value="1000"]', (o) => o.disabled);
      await setVal("pulse", "auto");
      await setVal("prf", "");
      check(`${tag} PRF chosen by hand: 600 with the medium pulse; 1000 not offered with the long pulse`, prfSet === 600 && off1000 && /PRF/.test(await text("#cPicSt")), `${prfSet} ${off1000} ${await text("#cPicSt")}`);
      // Exercise 27: the route on the radar and its readout in the EBL / CURSOR panel.
      await T("startExercise", "radar-27");
      await p.waitForTimeout(600);
      check(`${tag} exercise 27: the route is on the radar with the next waypoint and XTD in the panel`, (await T("routePoints")) === 4 && /WPT 2/.test(await text("#cCur")) && /XTD/.test(await text("#cCur")), await text("#cCur"));
      // Exercise 28: the lanes of the separation scheme.
      await T("startExercise", "radar-28");
      await p.waitForTimeout(600);
      check(`${tag} exercise 28: the traffic separation scheme is in the scenario`, (await T("tssCount")) === 1 && (await T("targetCount")) === 8);
      // Exercise 29: the MOB key and a search pattern from the mark.
      await T("startExercise", "radar-29");
      await p.waitForTimeout(600);
      await p.evaluate(() => document.getElementById("mobKey").click());
      await p.evaluate(() => document.getElementById("spMake").click());
      await p.waitForTimeout(400);
      check(`${tag} exercise 29: MOB mark and an expanding square of ten legs`, (await T("mobMarked")) && (await T("routePoints")) === 11, `${await T("mobMarked")} ${await T("routePoints")}`);
      // Exercise 31: the time left is shown.
      await T("startExercise", "arpa-31");
      await p.waitForTimeout(700);
      await key("ex");
      check(`${tag} exercise 31: the time left is shown`, /TIME LEFT 0?[78]:\d\d/.test(await text("#exClock")), await text("#exClock"));
      await closeMenu();
      // The station alters, adds and removes a target on the display while the exercise runs.
      await stTab("class");
      const okList = await st.waitForFunction(() => document.querySelectorAll("#rtTg option").length >= 6, null, { timeout: 12000 }).then(() => true, () => false);
      await st.selectOption("#rtTg", "2");
      await st.fill("#rtC", "123");
      await st.fill("#rtS", "9");
      await st.click("#rtAlter");
      const altered = await waitFor(() => window.__simTest.targets().some((t) => t.id === 2 && t.course === 123 && t.speed === 9));
      check(`${tag} station alters a target on the display (course and speed)`, okList && altered, JSON.stringify((await T("targets")).find((t) => t.id === 2)));
      await st.fill("#rtNewName", "Sudden threat");
      await st.click("#rtAdd");
      const added = await waitFor(() => window.__simTest.targets().some((t) => t.name === "Sudden threat"));
      check(`${tag} station adds a target on the display`, added && (await T("targetCount")) === 7, String(await T("targetCount")));
      await st.selectOption("#rtTg", "3");
      await st.click("#rtDel");
      const removed = await waitFor(() => !window.__simTest.targets().some((t) => t.id === 3));
      check(`${tag} station removes a target on the display`, removed);
      // Random traffic, the same on every display for the same seed; weather with wind and current to one display.
      await st.fill("#rgCount", "9");
      await st.fill("#rgThreats", "2");
      await st.fill("#rgSeed", "4242");
      await st.check("#rgReplace");
      await st.click("#rgSend");
      const traffic = await waitFor(() => window.__simTest.targetCount() === 9);
      check(`${tag} station sends random traffic in place of the ships there`, traffic, String(await T("targetCount")));
      await st.fill("#inWxSea", "5");
      await st.fill("#inWxWindF", "270");
      await st.fill("#inWxWindS", "25");
      await st.fill("#inWxCurS", "90");
      await st.fill("#inWxCurD", "1.5");
      await st.click("#inWxSend");
      const wx = await waitFor(() => { const w = window.__simTest.weather(); return w.sea === 5 && w.wind === 25 && Math.abs(w.drift - 1.5) < 0.01; });
      check(`${tag} station sends sea state, wind and current`, wx, JSON.stringify(await T("weather")));
      // An examination: the parts one after the other.
      await stTab("ex");
      const exmList = await st.$$eval("#exmArpa option", (os) => os.filter((o) => o.selected).length);
      await st.click("#exmStartArpa");
      const exStarted = await waitFor(() => window.__simTest.exam()?.part === 1);
      check(`${tag} ARPA examination started from the station: part 1 of 5`, exmList === 5 && exStarted && (await T("exam")).of === 5 && /part 1 of 5/.test(await text("#banner")), `${exmList} ${JSON.stringify(await T("exam"))} ${await text("#banner")}`);
      await p.waitForTimeout(500);
      await key("ex");
      await p.click("#exFinish");
      const nextReady = await waitFor(() => window.__simTest.exam()?.nextReady === true);
      await closeMenu();
      await p.click("#banner");
      const part2 = await waitFor(() => window.__simTest.exam()?.part === 2 && window.__simTest.exam()?.nextReady === false);
      check(`${tag} examination: the next part is offered when a part is finished`, nextReady && part2, JSON.stringify(await T("exam")));
      await stTab("recs");
      await st.waitForTimeout(1500);
      check(`${tag} examination results can be printed from the station`, await st.isVisible("#exmPrint").catch(() => false) || (await st.$("#exmPrint")) !== null);
      // ---- What the instructor should look at: the attention list, the class table, the live view, the checklist, bookmarks.
      await stTab("class");
      await st.selectOption("#inExSel", "arpa-1");
      await st.click('#inStations button[data-cmd="ex"]');
      await waitFor(() => /^1\. /.test(document.getElementById("exTitle")?.textContent ?? ""));
      await closeMenu();
      await p.evaluate(() => {
        const b = document.getElementById("run");
        if (/run/i.test(b.textContent)) b.click();
      });
      const stWait = (fn, ms = 15000) => st.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
      // The class table has a row for the display, with its exercise and no action yet.
      const rowOk = await stWait(() => /Exercise 1/.test(document.getElementById("classRows").innerText) && /none yet/.test(document.getElementById("classRows").innerText));
      check(`${tag} class table: one row for the display with its exercise, items, points and action`, rowOk, await stText("#classRows"));
      // A ship put right ahead on the opposite course, 1.2 NM off: three minutes to a collision.
      const hdg = await T("orderedCourse");
      await st.fill("#rtNewName", "Collision");
      await st.fill("#rtNewBrg", String(hdg));
      await st.fill("#rtNewRng", "1.2");
      await st.fill("#rtNewC", String((hdg + 180) % 360));
      await st.fill("#rtNewS", "12");
      await st.click("#rtAdd");
      const flagged = await stWait(() => /NOW/.test(document.getElementById("attList").innerText) && /Collision will pass at 0\.\d\d NM/.test(document.getElementById("attList").innerText));
      const firstRow = await st.$eval("#attList li", (e) => e.innerText.replace(/\s+/g, " "));
      check(`${tag} attention list: the vessel about to pass too close is flagged and listed first`, flagged && /NOW/.test(firstRow) && /Collision/.test(firstRow), await stText("#attList"));
      check(`${tag} class table counts the flags of the display`, /now/.test(await stText("#classRows")), await stText("#classRows"));
      // The live view: the picture and the settings of that display.
      await st.click("#attList li button");
      const gotPic = await stWait(() => (document.getElementById("watchImg").getAttribute("src") ?? "").startsWith("data:image/jpeg"));
      check(`${tag} live view: the trainee's radar picture and settings on the station`, gotPic && (await st.isVisible("#watchBox")) && /Gain \d+/.test(await stText("#watchSet")) && /watching/i.test(await stText("#watchTitle")), `${await stText("#watchTitle")} | ${await stText("#watchSet")}`);
      await st.click("#watchClose");
      check(`${tag} live view closed`, !(await st.isVisible("#watchBox")));
      // The observation checklist: a tick goes into the record of that exercise.
      await st.click('#inStations button[data-cmd="obs"]');
      await st.waitForTimeout(400);
      const items = await st.$$eval("#obsItems .btns", (r) => r.length);
      // Under each item: its written standard, and what that display has measured so far.
      await stWait(() => /Measured: Range/.test(document.getElementById("obsItems").innerText));
      const obsText = await stText("#obsItems");
      check(`${tag} checklist: each item has its standard, and the measured facts of that display beside it`, /Yes: /.test(obsText) && /No: /.test(obsText) && /Measured: Range \d+(\.\d+)? NM, gain \d+/.test(obsText) && /Measured: Collision will pass at 0\.\d\d NM in \d+ min if nothing changes/.test(obsText), obsText.slice(0, 600));
      await st.uncheck("#obsStd");
      const noStd = !/Yes: /.test(await stText("#obsItems")) && /Measured: /.test(await stText("#obsItems"));
      await st.check("#obsStd");
      check(`${tag} checklist: the standards can be hidden, the measured facts stay`, noStd);
      await st.click('#obsItems button[data-obs="0"][data-mark="yes"]');
      await st.click('#obsItems button[data-obs="5"][data-mark="no"]');
      await st.fill("#obsNotes", "Slow to see the ship ahead.");
      await st.click("#obsSave");
      const ticked = await st.$eval('#obsItems button[data-obs="0"][data-mark="yes"]', (b) => b.classList.contains("on"));
      check(`${tag} observation checklist: twelve items, ticks kept`, items === 12 && ticked && /saved/i.test(await stText("#obsMsg")), `${items} ${ticked} ${await stText("#obsMsg")}`);
      await key("ex");
      await p.click("#exFinish");
      await closeMenu();
      await stTab("recs");
      const recHere = await stWait(() => /ARPA 1:/.test(document.getElementById("inRecs").innerText));
      await st.click('#inRecs button[data-act="open"]');
      await st.waitForTimeout(1200);
      const obsInRec = await stText("#inRecDebrief");
      const marks = await st.$$eval("#inRecMarks button", (b) => b.map((x) => x.textContent).join(" | "));
      check(`${tag} the record holds the instructor's observations and notes`, recHere && /instructor's observations/i.test(obsInRec) && /Radar set up before use/.test(obsInRec) && /Slow to see the ship ahead/.test(obsInRec), obsInRec.slice(0, 300));
      check(`${tag} the record has a bookmark for what was flagged, and the replay goes there`, /Collision will pass/.test(marks), marks);
      await st.click("#inRecMarks button");
      check(`${tag} a bookmark moves the replay`, Number(await st.$eval("#inScrub", (e) => e.value)) >= 0 && (await stText("#inRecMarksT")).includes("Bookmarks"), await stText("#inRecMarksT"));
      check(`${tag} with no names logged in, "at the controls" is not shown`, await p.$eval("#ctlRow", (e) => e.hidden));
      // ---- Added 18 Nov 2026 (second round): the evidence before the decision, the guided debrief, each trainee of a group, sheets, ROC points.
      const evid = await stText("#inRecEvid");
      check(`${tag} record: the evidence is set out before the decision (score, flags, observations, measured facts, criteria in force)`,
        /Score: \d+%/.test(evid) && /needing attention at once/.test(evid) && /1 yes, 1 no/.test(evid) && /Measured \(as it stood at the end\):/.test(evid) && /criteria in force/.test(evid), evid.slice(0, 500));
      await st.selectOption("#asDec", "competent");
      await st.fill("#asName", "Rao");
      await st.click("#asSave");
      const refusedSave = /Not saved/.test(await stText("#asMsg")) && /goes against the record/i.test(await stText("#asCheck")) && /needing attention at once/.test(await stText("#asCheck"));
      await st.fill("#asRem", "The ship was put ahead by the instructor just before the end.");
      await st.click("#asSave");
      check(`${tag} a decision against the record is refused without a reason, and saved with one`, refusedSave && /^Saved/.test(await stText("#asMsg")) && /reason written/.test(await stText("#asCheck")), `${refusedSave} ${await stText("#asMsg")} | ${await stText("#asCheck")}`);
      const gdSteps = await st.$$eval("#gdSteps input[type=checkbox]", (c) => c.length);
      const dbText = await stText("#gdSteps");
      await st.check("#gd_0");
      await st.check("#gd_1");
      await st.fill("#gdGoals", "Look further ahead.");
      await st.click("#gdSave");
      check(`${tag} guided debrief: five steps, the key moments and questions written from the record, goals saved`,
        gdSteps === 5 && /Collision will pass/.test(dbText) && /What did the radar show you at that moment/.test(dbText) && /2 of 5 steps done/.test(await stText("#gdMsg")), `${gdSteps} ${await stText("#gdMsg")} ${dbText.slice(0, 300)}`);
      await st.click("#gdMoments button");
      await st.click("#clsShow");
      check(`${tag} the class on this exercise is listed for a class debrief`, (await st.$$eval("#clsTable tbody tr", (r) => r.length)) >= 1 && /recorded attempt/.test(await stText("#clsOut")), await stText("#clsOut"));
      await st.click("#asCmp");
      check(`${tag} assessors compared: decisions, mean scores, decisions against the record`, /Rao 1 1 \(100%\)/.test(await stText("#asCmpOut")) && /against the record/i.test(await stText("#asCmpOut")), await stText("#asCmpOut"));
      // The exercise sheet: one form for every exercise, read from the window it prints in.
      await stTab("ex");
      const nSheets = await st.$$eval("#xsEx option", (o) => o.length);
      await st.selectOption("#xsEx", "arpa-1");
      const readPopup = async (click) => {
        const [pop] = await Promise.all([st.waitForEvent("popup", { timeout: 8000 }).catch(() => null), st.click(click)]);
        if (!pop) return "";
        const body = await Promise.race([pop.evaluate(() => document.body.innerText).catch(() => ""), new Promise((r) => setTimeout(() => r(""), 4000))]);
        await pop.close().catch(() => {});
        return String(body).replace(/\s+/g, " ");
      };
      const sheet = await readPopup("#xsPrint");
      check(`${tag} exercise sheets: 32 exercises and six ROC, each with the marked items, the limits and the checklist standards`,
        nSheets === 39 && /Exercise 1\./.test(sheet) && /what the simulator measures/i.test(sheet) && /CPA of Ship A/.test(sheet) && /Radar set up before use/.test(sheet) && /not type approved/.test(sheet), `${nSheets} ${sheet.slice(0, 300)}`);
      await st.selectOption("#xsEx", "roc-plot");
      const rocSheet = await readPopup("#xsPrint");
      check(`${tag} exercise sheet of a ROC exercise: points, and the first check counts`, /ROC: Manual plotting/.test(rocSheet) && /first check/.test(rocSheet) && /Total 90/.test(rocSheet), rocSheet.slice(0, 300));
      // A group of two: the instructor sets a changeover every minute of exercise time.
      await stTab("batch");
      await st.fill("#inChange", "1");
      await st.click("#inBatchSave");
      const gotChange = await waitFor(() => window.__simTest.changeover() === 1, 15000);
      await p.evaluate(() => document.getElementById("whoChange").click());
      await p.fill("#lgS0", "Asha");
      await p.fill("#lgS1", "Ravi");
      await p.click("#lgStart");
      await T("startExercise", "arpa-1");
      await p.waitForTimeout(600);
      await closeMenu();
      const firstAt = await T("atControls");
      await setVal("speed", "10");
      await p.evaluate(() => {
        const b = document.getElementById("run");
        if (/run/i.test(b.textContent)) b.click();
      });
      const changed = await waitFor(() => window.__simTest.atControls() === "Ravi", 20000);
      check(`${tag} timed changeover: after a minute of the exercise the next trainee has the controls, with a message`,
        gotChange && firstAt === "Asha" && changed && /Change over: Ravi takes the controls now/.test(await T("bannerText")) && (await p.$eval("#ctlWho", (e) => e.value)) === "Ravi" && !(await p.$eval("#ctlRow", (e) => e.hidden)), `${gotChange} ${firstAt} ${changed} ${await T("bannerText")}`);
      await setVal("speed", "1");
      await key("ex");
      await p.click("#exFinish");
      await closeMenu();
      await stTab("recs");
      const groupRec = await stWait(() => /Asha \/ Ravi/.test(document.getElementById("inRecs").innerText));
      await st.click('#inRecs button[data-act="open"]');
      await st.waitForTimeout(800);
      const byText = await stText("#inRecBy");
      const tfNames = await st.$$eval("#tfWho option", (o) => o.map((x) => x.textContent).join(","));
      check(`${tag} a group's record shows each trainee: time at the controls, own answers, observations`, groupRec && /each trainee/i.test(byText) && /Asha 0[01]:\d\d \(\d+%\)/.test(byText) && /Ravi 0\d:\d\d \(\d+%\)/.test(byText), byText);
      await st.selectOption("#tfWho", { label: "Asha" });
      const file = await readPopup("#tfPrint");
      check(`${tag} trainee file: one page for one person across the recorded exercises`, tfNames === "Asha,Ravi" && /Trainee file: Asha/.test(file) && /1\. |ARPA 1/.test(file) && /Ravi/.test(file) && /not a certificate of competence/i.test(file), `${tfNames} | ${file.slice(0, 300)}`);
      // A ROC exercise now ends with points, which go into its record.
      await T("startExercise", "roc-fix");
      await p.waitForTimeout(600);
      await p.evaluate(() => document.getElementById("rocFinish").click());
      await p.waitForTimeout(600);
      const rocPts = await p.$eval("#rocPoints", (e) => e.innerText.replace(/\s+/g, " ")).catch(() => "");
      const rocRec = await stWait(() => /ROC: Position fixing/.test(document.querySelector("#inRecs tr")?.innerText ?? ""));
      const rocRow = await st.$eval("#inRecs tr", (e) => e.innerText.replace(/\s+/g, " "));
      check(`${tag} ROC exercise: points on the display at the end, and in the record at the station`, /0 of 30 \(0%\)/.test(rocPts) && /no valid fix/.test(rocPts) && rocRec && /ROC: Position fixing.* 0 /.test(rocRow), `${rocPts.slice(0, 200)} | ${rocRow}`);
      // ---- Added 18 Nov 2026 (third round): take-back, reset and tracks from the station; visibility; accounts; progress; backup.
      await T("startExercise", "arpa-1");
      await p.waitForTimeout(500);
      await closeMenu();
      await setVal("speed", "10");
      await p.evaluate(() => {
        const b = document.getElementById("run");
        if (/run/i.test(b.textContent)) b.click();
      });
      await waitFor(() => window.__simTest.time() > 70, 20000);
      await setVal("speed", "1");
      await stTab("class");
      await st.click('#inStations button[data-cmd="back2"]');
      const wentBack = await waitFor(() => window.__simTest.time() < 60 && /taken back to 00:0\d/.test(window.__simTest.bannerText()), 10000);
      check(`${tag} the station takes a display's exercise back in time, and the trainees are told`, wentBack, `${await T("time")} ${await T("bannerText")}`);
      // A programmed track for one of that display's targets, typed as bearing and range from its own ship.
      await st.waitForFunction(() => document.querySelectorAll("#rtTg option").length >= 3, null, { timeout: 12000 }).catch(() => {});
      await st.fill("#rtTrack", "north of here");
      await st.click("#rtTrackSet");
      const badTrack = /type the points as bearing\/range/.test(await st.$eval("#inMsg", (e) => e.textContent));
      await st.fill("#rtTrack", "090/5, 180/5");
      await st.click("#rtTrackSet");
      const onTrack = await waitFor(() => window.__simTest.targets().filter((t) => t.onTrack).length === 1, 8000);
      await st.click("#rtTrackOff");
      const offTrack = await waitFor(() => window.__simTest.targets().every((t) => !t.onTrack), 8000);
      check(`${tag} the station gives a target on a display a programmed track, and takes it off`, badTrack && onTrack && offTrack, `${badTrack} ${onTrack} ${offTrack}`);
      st.once("dialog", (d) => d.accept());
      await st.click('#inStations button[data-cmd="reset"]');
      const wasReset = await waitFor(() => window.__simTest.time() < 2 && /started again from the beginning/.test(window.__simTest.bannerText()), 10000);
      check(`${tag} the station resets a display's exercise to its beginning`, wasReset, `${await T("time")} ${await T("bannerText")}`);
      // Visibility set from the station: told to the trainees, shown in the own ship panel, and a vessel inside it is reported.
      await st.selectOption("#inWxVis", "0.5");
      await st.click("#inWxSend");
      const visSet = await waitFor(() => window.__simTest.visibility() === 0.5 && /visibility has closed to 0\.5 NM/.test(window.__simTest.bannerText()), 10000);
      // The data panels are redrawn a few times a second: wait for the readout rather than read it at once.
      const visShown = await waitFor(() => /VIS\s*0\.5 NM/.test(document.getElementById("cOwn").innerText), 5000);
      const ahead = await T("orderedCourse");
      await st.fill("#rtNewName", "Close one");
      await st.fill("#rtNewBrg", String(ahead));
      await st.fill("#rtNewRng", "0.3");
      await st.fill("#rtNewC", String(ahead));
      await st.fill("#rtNewS", "0");
      await st.click("#rtAdd");
      const sighted = await waitFor(() => /LOOKOUT: a vessel in sight, bearing \d{3}° \(right ahead\), about 0\.3 NM/.test(window.__simTest.bannerText()), 10000);
      await st.selectOption("#inWxVis", "good");
      await st.click("#inWxSend");
      const visGood = await waitFor(() => window.__simTest.visibility() === null && /visibility is good again/.test(window.__simTest.bannerText()), 10000);
      await st.selectOption("#inWxVis", "");
      check(`${tag} visibility set from the station: shown, reported by the bridge, and a vessel inside it is reported by the look-out`, visSet && visShown && sighted && visGood && (await waitFor(() => !/VIS/.test(document.getElementById("cOwn").innerText), 5000)), `${visSet} ${visShown} ${sighted} ${visGood} ${await T("bannerText")}`);
      // Accounts: a batch whose trainees log in with their own PIN.
      await stTab("batch");
      await st.fill("#inBatchName", "B44");
      await st.click("#inBatchAdd");
      await st.fill("#inStudents", "Asha\nRavi");
      await st.check("#inReqLogin");
      await st.click("#inBatchSave");
      const gotLogin = await waitFor(() => window.__simTest.requireLogin() && window.__simTest.batchNames().includes("B44"), 15000);
      const openLoginAs = async (name) => {
        await p.evaluate(() => document.getElementById("whoChange").click());
        const bid = await p.$eval("#lgBatch", (s) => [...s.options].find((o) => o.textContent === "B44")?.value ?? "");
        await p.selectOption("#lgBatch", bid);
        await p.selectOption("#lgS0", name);
        // The second place offers the name that was there before: this login is of one trainee alone.
        await p.selectOption("#lgS1", "");
      };
      await openLoginAs("Asha");
      const firstLogin = (await p.isVisible("#lgP0")) && (await p.isVisible("#lgQ0")) && /First login/.test(await p.$eval("#lgH0", (e) => e.textContent)) && !(await p.isVisible("#lgP1"));
      await p.fill("#lgP0", "1234");
      await p.fill("#lgQ0", "1235");
      await p.click("#lgStart");
      const mismatch = /not the same/.test(await p.$eval("#lgMsg", (e) => e.textContent)) && (await p.isVisible("#login"));
      await p.fill("#lgQ0", "1234");
      await p.click("#lgStart");
      const loggedIn = !(await p.isVisible("#login"));
      const listed = await stWait(() => /Asha\s+set/.test(document.getElementById("inAccts").innerText));
      await waitFor(() => window.__simTest.pinSet("B44", "Asha"), 15000);
      await openLoginAs("Asha");
      const secondLogin = (await p.isVisible("#lgP0")) && !(await p.isVisible("#lgQ0"));
      await p.fill("#lgP0", "9999");
      await p.click("#lgStart");
      const wrongPin = /Wrong PIN for Asha/.test(await p.$eval("#lgMsg", (e) => e.textContent)) && (await p.isVisible("#login"));
      await p.fill("#lgP0", "1234");
      await p.click("#lgStart");
      check(`${tag} accounts: a first login chooses a PIN (typed twice), the station lists it, a wrong PIN is refused and the right one accepted`,
        gotLogin && firstLogin && mismatch && loggedIn && listed && secondLogin && wrongPin && !(await p.isVisible("#login")), `${gotLogin} ${firstLogin} ${mismatch} ${loggedIn} ${listed} ${secondLogin} ${wrongPin}`);
      // Her own results on the display come from the station, which holds the records.
      await T("startExercise", "arpa-1");
      await p.waitForTimeout(600);
      await key("ex");
      await p.click("#exFinish");
      await stTab("recs");
      await stWait(() => /\d Asha ARPA 1:/.test((document.querySelector("#inRecs tr")?.innerText ?? "").replace(/\s+/g, " ")));
      await p.evaluate(() => document.getElementById("myGet").click());
      const mine = await waitFor(() => /From the instructor station: 1 recorded exercise/.test(document.getElementById("myMsg").textContent), 12000);
      // What this display recorded earlier under a typed name "Asha", with no batch, is another person's and stays out.
      const myText = await p.$eval("#myOut", (e) => e.innerText.replace(/\s+/g, " "));
      check(`${tag} a trainee who logged in with a PIN sees her own results on the display, from the station`, mine && /Asha: 1 attempt at 1 exercise/.test(myText) && (await p.$$eval("#myOut svg.viz circle", (c) => c.length)) >= 1 && /worked alone/.test(myText), `${mine} ${myText.slice(0, 200)}`);
      await closeMenu();
      // Progress of a trainee and of a batch at the station.
      // The name typed earlier with no batch (three exercises with Ravi and alone) and the Asha of batch B44 are two trainees.
      const who = await st.$$eval("#tfWho option", (o) => o.map((x) => x.textContent).join(","));
      await st.selectOption("#tfWho", { label: "Asha" });
      await st.click("#phShow");
      const phText = await stText("#phOut");
      const phSvg = await st.$eval("#phOut svg.viz", (s) => ({ label: s.getAttribute("aria-label"), w: s.getBoundingClientRect().width, dots: s.querySelectorAll('circle[r="4"]').length })).catch(() => null);
      await st.selectOption("#tfWho", { label: "Asha (B44)" });
      await st.click("#phShow");
      const phB44 = await stText("#phOut");
      check(`${tag} progress of a trainee: the figures, a chart of the scored attempts, each exercise and each attempt; the same name in another batch is another trainee`,
        who === "Asha,Asha (B44),Ravi" && /Asha: 2 attempts at 2 exercises/.test(phText) && !!phSvg && phSvg.dots === 2 && phSvg.w > 300 && /2 scored attempts, oldest first/.test(phSvg.label) && /Asha \(B44\): 1 attempt at 1 exercise/.test(phB44),
        `${who} | ${phText.slice(0, 120)} | ${JSON.stringify(phSvg)} | ${phB44.slice(0, 80)}`);
      await stTab("batch");
      await st.click("#bmShow");
      const bm = await stText("#bmOut");
      check(`${tag} progress of a batch: each trainee against the exercises`, /Asha 0% 1 of 1/.test(bm) && /Ravi - 0 of 1/.test(bm), bm.slice(0, 200));
      await st.click('#inAccts button[data-reset="Asha"]');
      check(`${tag} the instructor resets a trainee's PIN`, /Asha none yet/.test(await stText("#inAccts")), await stText("#inAccts"));
      // A backup of everything, and reading it back adds nothing that is already there.
      await stTab("recs");
      const [dl] = await Promise.all([st.waitForEvent("download", { timeout: 8000 }).catch(() => null), st.click("#bkSave")]);
      const bkPath = dl ? await dl.path() : null;
      const backup = bkPath ? JSON.parse(fs.readFileSync(bkPath, "utf8")) : null;
      if (bkPath) await st.setInputFiles("#bkFile", bkPath);
      const restored = await stWait(() => /Restored: 0 exercises and 0 batches added/.test(document.getElementById("inMsg").textContent), 8000);
      check(`${tag} backup: one file with the class and every record; restored, it adds nothing already here`,
        !!backup && backup.kind === "radar-sim-backup" && backup.records.length >= 3 && backup.state.batches.some((b) => b.name === "B44") && restored, `${backup?.kind} ${backup?.records?.length} ${restored}`);
      check(`${tag} with no classroom server the station says where the records are kept`, /No classroom server at this address/.test(await stText("#svState")), await stText("#svState"));
      await stTab("batch");
      await st.uncheck("#inReqLogin");
      // Two elements with one id would make a key or a field act on the wrong one.
      const dupIds = (pg) => pg.evaluate(() => {
        const seen = new Map();
        for (const e of document.querySelectorAll("[id]")) seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
        return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
      });
      const dups = [...(await dupIds(st)), ...(await dupIds(p))];
      check(`${tag} no element id is used twice, on the station or on the display`, dups.length === 0, dups.join(", "));
      // Back to no changeover and no names.
      await stTab("batch");
      await st.fill("#inChange", "");
      await st.click("#inBatchSave");
      await p.evaluate(() => document.getElementById("whoChange").click());
      await p.click("#lgSkip");
    }
    await st.close();
    p.off("dialog", acceptAll);
  }

  check(`${tag} no script errors`, errs.length === 0, errs.join("; "));
  await p.close();
}

// Exercise 8 brings in a gyro error by its script: changing an ARPA control afterwards must not undo it (it did, until
// rs-b46: every ARPA control copied the instructor's fault boxes, still at 0, into the gyro).
{
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(html);
  await p.getByText("Free practice without names").click();
  await p.evaluate(() => window.__simTest.startExercise("arpa-8"));
  await p.evaluate(() => {
    document.getElementById("banner").click();
    document.getElementById("run").click();
    const s = document.getElementById("speed");
    s.value = "10";
    s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForFunction(() => window.__simTest.time() > 600, null, { timeout: 150000, polling: 500 });
  const gyro = () => p.$eval("#faultNow", (e) => Number(/gyro (-?[\d.]+)/.exec(e.textContent)?.[1] ?? NaN));
  const g0 = await gyro();
  await p.evaluate(() => {
    const e = document.getElementById("arpaCpaLim");
    e.value = "1.5";
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const t0 = await p.evaluate(() => window.__simTest.time());
  await p.waitForFunction((t) => window.__simTest.time() > t + 120, t0, { timeout: 60000, polling: 500 });
  const g1 = await gyro();
  check("[ex 8] the scripted gyro error stays when an ARPA control is changed", Math.abs(g0 - 4) < 0.05 && Math.abs(g1 - 4) < 0.05, `${g0} then ${g1}`);
  check("[ex 8] no script errors", errs.length === 0, errs.join("; "));
  await p.close();
}

// The robot student on the #demo display: it works an exercise with the display's own controls.
{
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(html + "#demo");
  await p.waitForTimeout(400);
  const tag = "[#demo]";
  const bar = await p.evaluate(() => ({
    login: !document.getElementById("login").hidden,
    ex: document.querySelectorAll("#rbEx option").length,
    levels: document.querySelectorAll("#rbLevel option").length,
    text: document.getElementById("robotBar")?.innerText ?? "",
    who: document.getElementById("who").textContent,
  }));
  check(`${tag} no login box; the robot bar lists the 32 exercises (and all of them in turn) and five levels`, !bar.login && bar.ex === 33 && bar.levels === 5, JSON.stringify({ ...bar, text: "" }));
  check(`${tag} the bar says it is a training simulator, not for navigation`, /not for navigation/.test(bar.text) && /robot student/i.test(bar.who), bar.text.slice(0, 200));
  await p.selectOption("#rbEx", "arpa-1");
  await p.selectOption("#rbLevel", "5");
  await p.selectOption("#rbSpeed", "20");
  await p.click("#rbStart");
  await p.waitForTimeout(6000);
  // A person's click on the display is held back while the robot has the controls.
  const before = await p.evaluate(() => document.getElementById("cmCan").classList.contains("on"));
  const box = await p.locator("#cmCan").boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const after = await p.evaluate(() => document.getElementById("cmCan").classList.contains("on"));
  const pointer = await p.evaluate(() => !document.getElementById("rbPointer").hidden);
  check(`${tag} while the robot works, its pointer shows and a person's clicks are held back`, !before && !after && pointer, `${before} ${after} ${pointer}`);
  await p.waitForFunction(() => !document.getElementById("rbStart").disabled, null, { timeout: 180000, polling: 500 }).catch(() => undefined);
  const res = await p.evaluate(() => {
    const raw = localStorage.getItem("radar-sim-store-v1");
    const recs = raw ? JSON.parse(raw).records ?? [] : [];
    const r = recs[recs.length - 1];
    return { log: [...document.querySelectorAll("#rbLog .result")].map((e) => e.textContent).join(" "), rec: r ? { robot: r.robot, students: r.students, percent: r.result?.percent, debrief: r.debrief?.self ?? "" } : null };
  });
  check(`${tag} level 5 works exercise 1 through the screen: every item credited`, /Result 50 of 50 \(100%\)/.test(res.log), res.log.slice(0, 200));
  check(`${tag} its record is marked as the robot's, with its debrief`, res.rec?.robot?.level === 5 && res.rec.students[0] === "Robot student (level 5)" && res.rec.percent === 100 && /Robot student, level 5/.test(res.rec.debrief), JSON.stringify(res.rec));
  // PAUSE holds the clock; TAKE OVER hands the exercise to the person, whose clicks then work.
  await p.selectOption("#rbEx", "arpa-7");
  await p.selectOption("#rbLevel", "3");
  await p.click("#rbStart");
  await p.waitForTimeout(5000);
  await p.click("#rbPause");
  await p.waitForTimeout(500);
  const t0 = await p.evaluate(() => window.__simTest.time());
  await p.waitForTimeout(1500);
  const t1 = await p.evaluate(() => window.__simTest.time());
  check(`${tag} PAUSE holds the clock`, t1 === t0, `${t0} ${t1}`);
  await p.click("#rbTake");
  await p.waitForFunction(() => !document.getElementById("rbStart").disabled, null, { timeout: 20000 }).catch(() => undefined);
  // A real click on the Run key works again (the clock was held by PAUSE, so it was stopped).
  const runBefore = await p.evaluate(() => document.getElementById("run").textContent);
  await p.locator("#run").click({ timeout: 5000 }).catch(() => undefined);
  const runAfter = await p.evaluate(() => document.getElementById("run").textContent);
  const mine = runBefore !== runAfter;
  await p.evaluate(() => {
    if (!document.body.classList.contains("menu-open")) document.getElementById("menuKey").click();
  });
  await p.evaluate(() => document.querySelector('#cMenu button[data-key="ex"]')?.click());
  await p.evaluate(() => document.getElementById("exFinish").click());
  await p.waitForTimeout(500);
  const taken = await p.evaluate(() => {
    const recs = JSON.parse(localStorage.getItem("radar-sim-store-v1") ?? "{}").records ?? [];
    return recs.find((r) => r.exerciseId === "arpa-7")?.robot ?? null;
  });
  check(`${tag} TAKE OVER: the person's clicks work again, and the record says when the robot handed over`, mine && taken?.level === 3 && typeof taken.takenOverAt === "number", `${mine} ${JSON.stringify(taken)}`);
  check(`${tag} no script errors`, errs.length === 0, errs.join("; "));
  await p.close();
}

// The robot student's reasons: TEACH stops it at each one until NEXT, with the clock held, and the reasons stay in the log.
{
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(html + "#demo");
  await p.waitForTimeout(400);
  const tag = "[#demo TEACH]";
  await p.selectOption("#rbEx", "arpa-1");
  await p.selectOption("#rbLevel", "5");
  await p.selectOption("#rbSpeed", "20");
  await p.check("#rbTeach");
  await p.click("#rbStart");
  await p.waitForFunction(() => !document.getElementById("rbNext").disabled, null, { timeout: 60000 }).catch(() => undefined);
  const first = await p.evaluate(() => ({
    next: !document.getElementById("rbNext").disabled,
    card: !document.getElementById("rbCard").hidden,
    title: document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "",
    working: document.querySelectorAll("#rbCard .rbWork div").length,
  }));
  check(`${tag} it stops at its first reason, its plan, shown on the card with NEXT`, first.next && first.card && /^My plan for exercise 1$/.test(first.title) && first.working >= 3, JSON.stringify(first));
  // NEXT by the button, by the card's own key and by the space bar; the clock waits while it stops.
  await p.click("#rbNext");
  await p.waitForFunction(() => !document.getElementById("rbNext").disabled && !/My plan/.test(document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? ""), null, { timeout: 60000 }).catch(() => undefined);
  const t0 = await p.evaluate(() => window.__simTest.time());
  await p.waitForTimeout(1500);
  const t1 = await p.evaluate(() => window.__simTest.time());
  const second = await p.evaluate(() => document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "");
  check(`${tag} NEXT goes on to the next reason, and the clock waits meanwhile`, /^Acquire Ship A/.test(second) && t0 === t1, `${second} ${t0} ${t1}`);
  await p.click("#rbCardNext");
  await p.waitForFunction((s) => !document.getElementById("rbNext").disabled && (document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "") !== s, second, { timeout: 120000 }).catch(() => undefined);
  const third = await p.evaluate(() => document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "");
  await p.keyboard.press("Space");
  await p.waitForFunction((s) => !document.getElementById("rbNext").disabled && (document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "") !== s, third, { timeout: 300000 }).catch(() => undefined);
  const fourth = await p.evaluate(() => ({ title: document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "", work: [...document.querySelectorAll("#rbCard .rbWork div")].map((d) => d.textContent).join(" | ") }));
  check(`${tag} the card's NEXT and the space bar go on too; an answer shows its working`, /^Wait for steady data$/.test(third) && /^CPA of Ship A from the ARPA data: \d/.test(fourth.title) && /CPA = range × sin\(angle\)/.test(fourth.work), `${third} / ${fourth.title} / ${fourth.work.slice(0, 160)}`);
  // TEACH off: it carries on to the end by itself; every answer was credited.
  await p.uncheck("#rbTeach");
  await p.waitForFunction(() => !document.getElementById("rbStart").disabled, null, { timeout: 240000, polling: 500 }).catch(() => undefined);
  const end = await p.evaluate(() => ({
    result: [...document.querySelectorAll("#rbLog .result")].map((e) => e.textContent).join(" "),
    whys: document.querySelectorAll("#rbLog .why.hasWhy").length,
    card: !document.getElementById("rbCard").hidden,
  }));
  check(`${tag} with TEACH turned off it finishes by itself, every item credited, the card put away`, /Result 50 of 50 \(100%\)/.test(end.result) && end.whys >= 6 && !end.card, JSON.stringify(end));
  // A reason in the log can be looked at again, on the card.
  await p.locator("#rbLog .why.hasWhy").nth(1).click();
  const again = await p.evaluate(() => ({ card: !document.getElementById("rbCard").hidden, head: document.querySelector("#rbCard .rbWhyHead")?.textContent ?? "", title: document.querySelector("#rbCard .rbWhyTitle")?.textContent ?? "" }));
  check(`${tag} a WHY line of the log opens that reason again`, again.card && /\(from \d+:\d\d\)/.test(again.head) && /^Acquire Ship A/.test(again.title), JSON.stringify(again));
  await p.click("#rbCardClose");
  check(`${tag} no script errors`, errs.length === 0, errs.join("; "));
  await p.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nAll screen checks passed");
process.exit(fails.length ? 1 : 0);
