// Shared by the scripts that take the manual's screen pictures. They drive the BUILT simulator
// (dist/radar-simulator.html) in a headless browser: run `npm run build` first. Needs Playwright,
// as the screen test does. Nothing here changes the simulator.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
/** Where the raw pictures go: the first argument of the script, or manual-img/raw in the project. */
export const RAW = path.resolve(process.argv[2] ?? path.join(ROOT, "manual-img", "raw"));
fs.mkdirSync(RAW, { recursive: true });
export const PAGE = pathToFileURL(path.join(ROOT, "dist", "radar-simulator.html")).href;
/** The size of the window the pictures are taken at, and how sharp (2 = twice the pixels). */
export const VIEW = { width: 1440, height: 900 };
export const SHARP = 2;

export const { chromium } = await import("playwright");

/** Run one scene; a scene that fails is reported and the rest go on. */
export async function step(name, fn) {
  try {
    await fn();
    console.log("ok    ", name);
  } catch (e) {
    console.log("FAILED", name, String(e?.message ?? e).split("\n")[0].slice(0, 300));
    process.exitCode = 1;
  }
}

/** A trainee's display in a browser of its own, with helpers to work it. */
export async function openDisplay(browser, url = PAGE, sharp = SHARP) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: sharp });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url);
  await p.waitForTimeout(500);
  const h = {
    p, ctx, errs,
    /** Call one of the page's test hooks (window.__simTest). */
    T: (fn, ...a) => p.evaluate(([f, args]) => window.__simTest[f](...args), [fn, a]),
    /** Set a control by its id, as a choice in the menu would (works for controls in a closed part of the menu). */
    setVal: (id, v) => p.evaluate(([i, x]) => {
      const e = document.getElementById(i);
      if (!e) throw new Error("no element " + i);
      if (e.type === "checkbox") e.checked = !!x; else e.value = x;
      e.dispatchEvent(new Event("input", { bubbles: true }));
      e.dispatchEvent(new Event("change", { bubbles: true }));
    }, [id, v]),
    clickEl: (id) => p.evaluate((i) => {
      const e = document.getElementById(i);
      if (!e) throw new Error("no element " + i);
      e.click();
    }, id),
    menuOpen: () => p.evaluate(() => document.body.classList.contains("menu-open")),
    openMenu: async () => { if (!(await h.menuOpen())) await p.click("#menuKey"); },
    closeMenu: async () => { if (await h.menuOpen()) await p.click("#menuClose"); },
    key: async (k) => { await h.openMenu(); await p.click(`#cMenu button[data-key=${k}]`); await p.waitForTimeout(400); },
    box: async () => (await p.$("#ppi")).boundingBox(),
    /** Press RUN if the clock is stopped (an exercise starts paused). */
    run: async () => { if (/run/i.test(await p.$eval("#run", (b) => b.textContent))) await p.click("#run"); },
    /** Let this many seconds of exercise time pass, at 10x. */
    fast: async (simSec) => { await p.selectOption("#speed", "10"); await p.waitForTimeout(simSec * 100); await p.selectOption("#speed", "1"); await p.waitForTimeout(400); },
    /** Acquire the targets whose name passes the filter. */
    acquire: async (filter = () => true) => {
      await h.closeMenu();
      const c = await h.box();
      const ts = await h.T("targetsScreen");
      const names = (await h.T("targets")).map((t) => t.name);
      await p.click("#cmAcq");
      for (let i = 0; i < ts.length; i++) {
        if (!filter(names[i], i)) continue;
        await p.mouse.click(c.x + ts[i].x, c.y + ts[i].y);
        await p.waitForTimeout(200);
      }
    },
    /** Click target number i with a cursor mode: #cmSel select, #cmEbl measure, #cmAcq acquire. */
    clickTarget: async (i, mode = "#cmSel") => {
      await h.closeMenu();
      const c = await h.box();
      const ts = await h.T("targetsScreen");
      await p.click(mode);
      await p.mouse.click(c.x + ts[i].x, c.y + ts[i].y);
      await p.waitForTimeout(400);
    },
    /** Move the cursor to an empty part of the picture, out of the way. */
    park: async () => { const c = await h.box(); await p.mouse.move(c.x + c.width * 0.22, c.y + c.height * 0.8); await p.waitForTimeout(300); },
    shot: async (name, sel) => {
      if (sel) await (await p.$(sel)).screenshot({ path: path.join(RAW, `${name}.png`) });
      else await p.screenshot({ path: path.join(RAW, `${name}.png`) });
    },
  };
  return h;
}
