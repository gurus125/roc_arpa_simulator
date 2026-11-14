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
    check(`${tag} self-test of the exercises passes (instructor station)`, /ALL 26 EXERCISES PASSED/.test(await stText("#stMsg")), await stText("#stMsg"));

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
    check(`${tag} real coastline scenario loads`, (await p.evaluate(() => window.__simTest.targetCount())) === 7);
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
      await p.click(aisRow);
      await p.waitForTimeout(500);
      const moreShown = await p.isVisible("#cAisMore");
      if (moreShown) await p.click("#cAisMore");
      await p.waitForTimeout(500);
      const td = await text("#cTd");
      check(`${tag} AIS further data on request (MORE)`, moreShown && td.includes("IMO") && td.includes("DEST") && td.includes("CLASS"), td.slice(0, 160));
      if (moreShown) await p.click("#cAisMore");
      await p.click(aisRow);
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
    await p.selectOption("#orient", "north-up");
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
    check(`${tag} marking sheets: all exercises listed`, sheets === 27, String(sheets));
    await st.close();
    p.off("dialog", acceptAll);
  }

  check(`${tag} no script errors`, errs.length === 0, errs.join("; "));
  await p.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nAll screen checks passed");
process.exit(fails.length ? 1 : 0);
