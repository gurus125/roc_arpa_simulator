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
  check(`${tag} cursor box shows the position of the cursor`, /\d\d°\d\d\.\d{3}'[NS] \d{3}°\d\d\.\d{3}'[EW]/.test(await text("#cCur")), await text("#cCur"));

  // The data area is laid out as on a radar: own ship's data with its sensors and position, settings by their
  // abbreviations, bars for gain and clutter, and the simulator's own keys in the strip at the top of the page.
  {
    const o = await text("#cOwn");
    check(`${tag} own ship data: heading, speeds, sensors and position`, /HDG \d{3}\.\d ° GYRO STW [\d.]+ kn LOG COG \d{3}\.\d ° EPFS SOG [\d.]+ kn EPFS LAT \d\d°\d\d\.\d{3}'[NS] LON \d{3}°\d\d\.\d{3}'[EW]/.test(o), o);
    check(`${tag} own ship data: steering, wind and time`, /STEER (AUTO|HAND)/.test(o) && /WIND/.test(o) && /TIME \d\d:\d\d:\d\d/.test(o), o);
    const abbr = await p.evaluate(() => ["orient", "motion", "stab", "trails", "arpaVec", "arpaGraphics"].map((id) => [...document.getElementById(id).options].map((x) => x.textContent).join("/")));
    check(`${tag} settings are shown by their abbreviations`, abbr.join(" ") === "N UP/H UP/C UP RM/TM GND/SEA OFF/REL/TRUE REL/TRUE OFF/PPC/PAD", abbr.join(" "));
    check(`${tag} pause, speed, day/night and help are in the top strip`, await p.evaluate(() => ["run", "speed", "nightKey", "cHelp"].every((id) => !!document.getElementById(id).closest("header") && document.getElementById(id).offsetParent !== null)));
    const fill = async () => p.$eval("#gain", (e) => e.style.getPropertyValue("--p"));
    const g0 = await p.$eval("#gain", (e) => e.value);
    check(`${tag} gain bar is filled to the gain setting`, (await fill()) === `${g0}%`, await fill());
    const sizes = await p.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      return { console: r("console"), body: r("menuBody"), menu: r("cMenu"), own: r("bOwn"), td: r("bTd"), w: window.innerWidth, h: window.innerHeight };
    });
    check(`${tag} data area leaves room for the menu's controls`, sizes.body.height >= 140 && sizes.console.bottom <= sizes.body.top + 1 && sizes.menu.bottom <= sizes.h + 1, JSON.stringify({ body: sizes.body.height, console: sizes.console.height }));
    check(`${tag} own ship data above target data, both the full width of the data area`, sizes.own.top < sizes.td.top && sizes.own.width > sizes.console.width * 0.95 && sizes.td.width > sizes.console.width * 0.95);
    if (W >= 1880 && H >= 1000) check(`${tag} data area is drawn larger on a large screen`, sizes.console.width >= 700, String(sizes.console.width));
  }

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
    check(`${tag} target data has bearing and range with units, and is marked as a tracked target`, /BRG \d{3}(\.\d)? ?°T/.test(await text("#cTd")) && /RNG [\d.]+ ?NM/.test(await text("#cTd")) && (await text("#cTgtKind")) === "TT", `${await text("#cTd")} | ${await text("#cTgtKind")}`);
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

  // Instructor self-test of the exercises (once is enough: it does not depend on the screen size).
  if (W === 1366) {
    await key("instr");
    await p.fill("#inPin", "0000");
    await p.click("#inLoginBtn");
    await p.click("#stRun");
    await p.waitForFunction(() => /PASSED|FAILED/.test(document.querySelector("#stMsg").textContent), null, { timeout: 180000 });
    check(`${tag} self-test of the exercises passes`, /ALL 26 EXERCISES PASSED/.test(await text("#stMsg")), await text("#stMsg"));

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

    // Instructor programmes a track for a target by clicking points on the picture.
    await key("instr");
    await p.click("#inRtStart");
    const cb = await p.locator("#ppi").boundingBox();
    for (const [dx, dy] of [[0.30, 0.30], [0.40, 0.30], [0.40, 0.40]]) await p.mouse.click(cb.x + cb.width * dx, cb.y + cb.height * dy);
    await p.waitForTimeout(300);
    check(`${tag} track: three clicks give three waypoints`, (await text("#inRtMsg")).includes("3 of 20"), await text("#inRtMsg"));
    await p.click("#inRtUndo");
    await p.waitForTimeout(300);
    check(`${tag} track: undo removes a waypoint`, (await text("#inRtMsg")).includes("2 of 20"), await text("#inRtMsg"));
    await p.click("#inRtSet");
    await p.waitForTimeout(300);
    check(`${tag} track: target is put on the track`, /on a track, [12] points? ahead/.test(await text("#inRtMsg")), await text("#inRtMsg"));
    await p.click("#inRtClear");
    await p.waitForTimeout(300);
    check(`${tag} track: target taken off the track`, (await text("#inRtMsg")).includes("no track"), await text("#inRtMsg"));
    const speeds = await p.$$eval("#inReplaySpeed option", (os) => os.map((o) => Number(o.value)));
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
    await p.waitForTimeout(500);
    await key("instr");
    await p.locator('#inRecs button[data-act="open"]').first().click();
    await p.waitForTimeout(1000);
    const pic = await p.$eval("#inPic", (e) => ({ hidden: e.hidden, w: e.naturalWidth }));
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
    // Heading input lost: the picture goes to unstabilised head-up and bearings are relative.
    await key("fault");
    await p.selectOption("#orient", "north-up");
    await p.check("#gyroFail");
    await p.waitForTimeout(500);
    check(`${tag} heading failure: unstabilised head-up, relative bearings`, (await p.$eval("#orient", (e) => e.value)) === "head-up" && (await p.evaluate(() => window.__simTest.headingLost())) && (await text("#m_ebl")).endsWith("R"), `${await p.$eval("#orient", (e) => e.value)} ${await text("#m_ebl")}`);
    await p.uncheck("#gyroFail");
    await p.waitForTimeout(300);
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
    check(`${tag} default settings`, def.range === "6" && def.orient === "north-up" && def.motion === "true" && def.stab === "ground" && def.cpa === "2" && def.tcpa === "12" && def.vec === "relative" && def.ebl && def.rings === "RINGS OFF" && def.vrm === "0.25 NM" && def.trails === "true" && def.band === "X", JSON.stringify(def));
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
    // Marking sheets: one choice per exercise, and "all".
    await key("instr");
    const sheets = await p.$$eval("#msEx option", (os) => os.length);
    check(`${tag} marking sheets: all exercises listed`, sheets === 27, String(sheets));
    p.off("dialog", acceptAll);
  }

  check(`${tag} no script errors`, errs.length === 0, errs.join("; "));
  await p.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nAll screen checks passed");
process.exit(fails.length ? 1 : 0);
