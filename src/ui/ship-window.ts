import { AppState } from "./app";
import { byId, esc, registerDoc, unregisterDoc } from "./dom";
import { ICON } from "./console-ui";
import { logSpeed, measuredHeading, ownCogSog, relativeWind } from "../engine/index";
import { normalizeDeg } from "../core/vec";

/**
 * The ship control window: steering, engine telegraph, anchor and own ship's data on the left; the exercise
 * (choose it, its briefing, the answers, finish, the result, the ROC worksheets) on the right. It opens in a
 * window of its own, for a second monitor beside the radar, as on a bridge where the radar and the
 * steering and engine controls are separate consoles.
 *
 * The window is a view of this page, not a second program: the controls it shows are this page's own
 * (moved into it while it is open, and moved back when it closes), so the simulation, the exercise and the
 * records stay in one place. While it is open it also keeps the clock running if the radar window is hidden.
 */
export type ExTab = "ex" | "roc";

export interface ShipWindow {
  /** Open the window (from a key press: browsers allow a new window only then), or bring it forward. */
  open: () => void;
  isOpen: () => boolean;
  /** Bring the window forward, at the given exercise list. */
  focus: (tab?: ExTab) => void;
  close: () => void;
  /** Whether this element is shown in the ship control window now. */
  holds: (el: Element) => boolean;
  tick: (app: AppState) => void;
}

export interface ShipWindowOpts {
  /** Called on every frame of the ship window: lets the simulation run on while the radar window is hidden. */
  keepAlive: () => void;
  /** Told when the window opens or closes. */
  changed: (open: boolean) => void;
  /** Told when the window could not be opened (blocked by the browser). */
  blocked: () => void;
}

const NAME = "rasimShipControl";

const SKELETON = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ship control</title></head><body></body></html>`;

const LAYOUT = `
<div id="swTop"><span class="logo">${ICON.logo}</span><div class="t"><b>SHIP CONTROL</b><span id="swShip"></span></div>
  <span id="swLink" class="pill"><i></i>Linked to the radar display</span><span class="grow"></span>
  <span class="clk"><span class="lab">SIM TIME</span><b id="swTime">00:00:00</b></span><button id="swRun">PAUSE</button></div>
<div id="swMain">
  <div class="col" id="swLeft">
    <section class="box" id="swSteer"><h3><i class="ico">${ICON.ship}</i>STEERING<span class="r" id="swPumps"></span></h3>
      <div class="row1" id="swSteerKeys"></div>
      <div class="setc"><span class="lab">SET COURSE</span><b id="swCourse">000</b><span class="deg">°</span><span class="grow"></span>
        <button data-dc="-10">−10</button><button data-dc="-1">−1</button><button data-dc="1">+1</button><button data-dc="10">+10</button></div>
      <div id="swCourseRow"></div>
      <div class="kvrow"><div class="kv"><span>HEADING</span><b id="swHdg">---</b></div><div class="kv"><span>RATE OF TURN</span><b id="swRot">---</b></div></div>
      <div class="lab sub">RUDDER</div>
      <div id="swRudder"></div>
      <div class="scale"><span>P35</span><span>P20</span><span>P10</span><span>MID</span><span>S10</span><span>S20</span><span>S35</span></div>
      <div id="swHelmInfo"></div>
      <div id="swHelm"></div>
    </section>
    <section class="box" id="swEngine"><h3><i class="ico">${ICON.gain}</i>ENGINE TELEGRAPH<span class="r" id="swOrdered"></span></h3>
      <div class="tele"><div id="swLever"></div>
        <div class="side">
          <div class="kv"><span>STW</span><b id="swStw">---</b></div>
          <div class="kv"><span>SOG</span><b id="swSog">---</b></div>
          <div class="kv"><span>COG</span><b id="swCog">---</b></div>
          <div class="kv"><span>REL WIND</span><b id="swWind">---</b></div>
          <div class="lab sub">ENGINE ORDER</div><div id="swEngOrder"></div>
          <div class="lab sub">ANCHOR</div><div id="swAnchor"></div>
        </div></div>
      <div id="swShipNow"></div>
    </section>
    <section class="box" id="swData"><h3><i class="ico">${ICON.target}</i>OWN SHIP DATA</h3><div id="swDataBody"></div><div id="swShipType"></div><div id="swShipInfo"></div></section>
  </div>
  <div class="col" id="swRight">
    <section class="box ex" id="swEx"><h3><i class="ico">${ICON.radar}</i>EXERCISE<span class="grow"></span>
      <span id="swExTabs"><button data-t="ex" class="on">ARPA &amp; RADAR</button><button data-t="roc">ROC</button></span><button id="swChoose">CHOOSE EXERCISE</button></h3>
      <div id="swExBody"></div></section>
  </div>
</div>
<div id="swFoot">Training simulator &middot; not type approved &middot; not for navigation</div>`;

/** The window's own layout, on top of the radar page's styles (which it copies). */
const CSS = `
html, body { height:100%; }
body { margin:0; overflow:hidden; display:flex; flex-direction:column; background:var(--bg); color:var(--text); font:13px/1.4 "Segoe UI", system-ui, sans-serif; }
#swTop { height:54px; flex:none; display:flex; align-items:center; gap:14px; padding:0 16px; background:var(--hdrbg); border-bottom:1px solid var(--line); white-space:nowrap; }
#swTop .logo { width:32px; height:32px; color:var(--text); }
#swTop svg, .box h3 .ico svg { width:100%; height:100%; display:block; }
#swTop .t b { display:block; font:700 17px/1.15 "Segoe UI", system-ui, sans-serif; letter-spacing:.08em; color:var(--text); }
#swTop .t span { font-size:11.5px; color:var(--muted); }
.pill { display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--ok); border:1px solid var(--ok); border-radius:11px; padding:2px 10px; }
.pill i { width:8px; height:8px; border-radius:50%; background:var(--ok); box-shadow:0 0 6px var(--ok); }
.grow { flex:1; }
.clk { display:flex; align-items:baseline; gap:8px; }
.lab { color:var(--clab); font-size:11.5px; letter-spacing:.08em; }
.lab.sub { margin:10px 0 4px; }
#swTime { font:700 16px Consolas, "DejaVu Sans Mono", ui-monospace, monospace; }
button { border-radius:4px; font:600 12px/18px "Segoe UI", system-ui, sans-serif; letter-spacing:.03em; padding:4px 10px; text-transform:uppercase; }
button.on { background:var(--segon); border-color:var(--segonline); color:var(--segontext); }
#swMain { flex:1; min-height:0; display:grid; grid-template-columns:minmax(430px, 520px) minmax(0, 1fr); gap:10px; padding:10px; }
.col { min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.box { background:linear-gradient(180deg, rgba(16,40,76,.9), var(--cbg) 140px); border:1px solid var(--line); border-radius:8px; padding:0 14px 12px; margin:0; }
body[data-mode=night] .box { background:var(--cbg); }
.box > h3 { display:flex; align-items:center; gap:9px; margin:0 -14px 10px; padding:9px 14px 8px; border-bottom:1px solid var(--line); font:700 13px "Segoe UI", system-ui, sans-serif; letter-spacing:.07em; color:var(--text); }
.box > h3 .ico { width:18px; height:18px; color:var(--accent); flex:none; }
.box > h3 .r { margin-left:auto; font-weight:500; font-size:12px; color:var(--clab); letter-spacing:.02em; }
.box > h3 .r b { font-family:Consolas, "DejaVu Sans Mono", monospace; color:var(--bright); }
.row1 { display:flex; gap:6px; flex-wrap:wrap; }
.row1 button { flex:1; }
.setc { display:flex; align-items:center; gap:6px; margin:12px 0 4px; }
.setc .lab { margin-right:6px; }
#swCourse { font:700 46px/1 Consolas, "DejaVu Sans Mono", ui-monospace, monospace; color:var(--bright); }
.setc .deg { color:var(--muted); font-size:20px; align-self:flex-start; }
.setc button { min-width:46px; }
#swCourseRow .row { grid-template-columns:1fr; margin:2px 0 6px; }
#swCourseRow .row label, #swCourseRow .row .val { display:none; }
.kvrow { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.kv { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px dotted rgba(36,70,111,.8); padding:4px 0; }
.kv span { color:var(--clab); font-size:12px; letter-spacing:.04em; }
.kv b { font:700 16px Consolas, "DejaVu Sans Mono", ui-monospace, monospace; color:var(--bright); }
.kv b.no { color:var(--bad); }
#swRudder #rudderInd { height:26px; margin:0; border-radius:4px; background:linear-gradient(90deg, rgba(255,59,78,.22) 0, rgba(255,59,78,.22) 50%, rgba(32,217,138,.2) 50%, rgba(32,217,138,.2) 100%); }
#swRudder #rudderBar { background:var(--accent); opacity:.85; }
#swRudder #rudderOrd { background:var(--ackbg); width:3px; }
.scale { display:flex; justify-content:space-between; font:11px Consolas, "DejaVu Sans Mono", monospace; color:var(--muted); margin:3px 0 6px; }
#swHelmInfo .btns { margin:2px 0 8px; font-size:12.5px; }
#swHelm #helmScale button { padding:7px 0; font:600 11.5px Consolas, "DejaVu Sans Mono", monospace; }
.tele { display:grid; grid-template-columns:190px 1fr; gap:16px; }
#swLever #telegraph { display:flex !important; flex-direction:column-reverse; align-items:stretch; gap:4px !important; margin:0; }
#swLever #telegraph button { padding:6px 12px; text-align:left; font:600 12px "Segoe UI", system-ui, sans-serif; }
#swLever #telegraph button[data-k="ST"] { margin:5px 0; text-align:center; }
.side { display:flex; flex-direction:column; }
#swEngOrder .btns, #swAnchor .btns { margin:0; }
#swEngOrder .btns > .small:first-child, #swAnchor .btns > .small:first-child { display:none; }
#swEngOrder #ordSpeedV { font:700 18px Consolas, "DejaVu Sans Mono", monospace; }
#swAnchor .btns .small { display:block; flex-basis:100%; }
#swShipNow #shipNow { font:12.5px Consolas, "DejaVu Sans Mono", monospace !important; color:var(--clab); margin:10px 0 0 !important; }
#swDataBody { display:grid; grid-template-columns:1fr 1fr; column-gap:18px; }
#swShipType .row { grid-template-columns:70px 1fr; margin:8px 0 0; }
#swShipInfo .hint { margin-top:6px; }
#swEx { display:flex; flex-direction:column; min-height:100%; }
#swEx > h3 button { padding:2px 10px; font-size:11.5px; }
#swExTabs { display:flex; gap:4px; }
#swExBody { flex:1; }
#swExBody .pane { gap:0; }
#swExBody section { background:transparent; border:0; border-bottom:1px solid var(--line); border-radius:0; padding:10px 0; margin:0; }
#swExBody section:last-child { border-bottom:0; }
#swExBody section h2 { font-size:12.5px; }
#swExBody ol.steps { font-size:13.5px; color:var(--text); line-height:1.45; }
#swExBody ol.steps li { margin:4px 0; }
#swExBody .small, #swExBody #exAim, #swExBody #rocDesc { font-size:12.5px; }
#swExBody #exList { display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; }
#swExBody #exList .btns { margin:0 !important; }
#swExBody #exList > p { grid-column:1 / -1; }
#swExBody #work { max-width:680px; margin:0 auto; }
#swExBody #exTaskList .btns { max-width:560px; }
#swExBody table.res td, #swExBody table.obs td { font-size:12.5px; }
#swEx.running:not(.showlist) #paneEx > section:first-child { display:none; }
#swChoose { display:none; }
#swEx.running #swChoose { display:inline-block; }
#swFoot { height:26px; flex:none; display:flex; align-items:center; padding:0 16px; border-top:1px solid var(--line); background:var(--hdrbg); font-size:11.5px; color:var(--accent); }
@media (max-width:1000px) { #swMain { grid-template-columns:1fr; overflow-y:auto; } .col { overflow:visible; } }
`;

export function initShipWindow(opts: ShipWindowOpts): ShipWindow {
  let win: Window | null = null;
  let tab: ExTab = "ex";
  let showList = false;
  /** What was moved into the window, and where it came from, so that it goes back exactly. */
  let moved: { el: Element; parent: Node; next: Node | null }[] = [];

  const isOpen = (): boolean => !!win && !win.closed;
  const doc = (): Document | null => (isOpen() ? win!.document : null);
  const el = <T extends HTMLElement = HTMLElement>(id: string): T | null => (doc()?.getElementById(id) as T | null) ?? null;

  const move = (node: Element | null | undefined, into: Element | null): void => {
    if (!node || !into) return;
    moved.push({ el: node, parent: node.parentNode!, next: node.nextSibling });
    into.appendChild(node);
  };

  /** Everything goes back to the radar page, in the reverse order it was taken. */
  const restore = (): void => {
    if (moved.length === 0 && !win) return;
    for (let i = moved.length - 1; i >= 0; i--) {
      const m = moved[i]!;
      try {
        m.parent.insertBefore(m.el, m.next && m.next.parentNode === m.parent ? m.next : null);
      } catch {
        // The original place has gone: leave it where it is.
      }
    }
    moved = [];
    if (win) {
      try {
        unregisterDoc(win.document);
      } catch {
        // already gone
      }
    }
    win = null;
    opts.changed(false);
  };

  const setTabIn = (t: ExTab): void => {
    tab = t;
    const p = byId("paneEx");
    const r = byId("paneRoc");
    if (p && isOpen() && p.ownerDocument === doc()) p.hidden = t !== "ex";
    if (r && isOpen() && r.ownerDocument === doc()) r.hidden = t !== "roc";
    for (const b of doc()?.querySelectorAll<HTMLElement>("#swExTabs button") ?? []) b.classList.toggle("on", b.dataset["t"] === t);
  };

  /** On a computer with two screens (and once the user allows it), put the window on the other screen. */
  const placeOnOtherScreen = async (w: Window): Promise<void> => {
    const scr = window.screen as Screen & { isExtended?: boolean };
    type Det = { screens: { availLeft: number; availTop: number; availWidth: number; availHeight: number }[]; currentScreen: unknown };
    const get = (window as unknown as { getScreenDetails?: () => Promise<Det> }).getScreenDetails;
    if (!scr.isExtended || !get) return;
    try {
      const sd = await get.call(window);
      const other = sd.screens.find((s) => s !== sd.currentScreen);
      if (!other) return;
      w.moveTo(other.availLeft, other.availTop);
      w.resizeTo(other.availWidth, other.availHeight);
    } catch {
      // Not allowed: the user drags the window to the other screen.
    }
  };

  const open = (): void => {
    if (isOpen()) {
      win!.focus();
      return;
    }
    const w = window.open("", NAME, "popup=yes,width=1280,height=860");
    if (!w) {
      opts.blocked();
      return;
    }
    let d: Document;
    try {
      d = w.document;
      d.open();
      d.write(SKELETON);
      d.close();
    } catch {
      w.close();
      opts.blocked();
      return;
    }
    for (const st of document.querySelectorAll("style")) d.head.appendChild(d.importNode(st, true));
    const css = d.createElement("style");
    css.textContent = CSS;
    d.head.appendChild(css);
    d.body.innerHTML = LAYOUT;
    win = w;
    registerDoc(d);
    const at = (id: string): Element | null => d.getElementById(id);
    const parentOf = (id: string, sel: string): Element | null => byId(id)?.closest(sel) ?? null;

    // Steering: autopilot or hand, the autopilot course, the rudder indicator and the rudder keys.
    move(byId("steerAuto"), at("swSteerKeys"));
    move(byId("steerHand"), at("swSteerKeys"));
    move(parentOf("ordCourse", ".row"), at("swCourseRow"));
    move(byId("rudderInd"), at("swRudder"));
    move(parentOf("helmV", ".btns"), at("swHelmInfo"));
    move(byId("helmScale"), at("swHelm"));
    // Engine: the telegraph, the engine order, the anchor, and the line of the ship's present state.
    move(byId("telegraph"), at("swLever"));
    move(parentOf("engDn", ".btns"), at("swEngOrder"));
    move(parentOf("anchorKey", ".btns"), at("swAnchor"));
    move(byId("shipNow"), at("swShipNow"));
    move(parentOf("shipType", ".row"), at("swShipType"));
    move(byId("shipInfo"), at("swShipInfo"));
    // The exercises.
    move(byId("paneEx"), at("swExBody"));
    move(byId("paneRoc"), at("swExBody"));
    setTabIn(tab);

    // Keys of the window itself.
    at("swRun")?.addEventListener("click", () => byId("run")?.click());
    // PUMP 2: the second steering gear unit (the same key as under SETTINGS).
    const pump = d.createElement("button");
    pump.id = "swPump2";
    pump.textContent = "PUMP 2";
    pump.title = "Start or stop the second steering gear pump (telemotor 2): the rudder moves faster";
    pump.addEventListener("click", () => byId('teleKeys')?.querySelector<HTMLElement>('button[data-u="2"]')?.click());
    at("swSteerKeys")?.appendChild(pump);
    at("swSteer")?.querySelector(".setc")?.addEventListener("click", (ev) => {
      const dc = Number((ev.target as HTMLElement).closest<HTMLElement>("button")?.dataset["dc"]);
      const r = byId<HTMLInputElement>("ordCourse");
      if (!dc || !r || r.disabled) return;
      r.value = String((Number(r.value) + dc + 360) % 360);
      r.dispatchEvent(new Event("input", { bubbles: true }));
      r.dispatchEvent(new Event("change", { bubbles: true }));
    });
    at("swExTabs")?.addEventListener("click", (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>("button")?.dataset["t"];
      if (t === "ex" || t === "roc") setTabIn(t);
    });
    at("swChoose")?.addEventListener("click", () => {
      showList = !showList;
      setTabIn("ex");
    });

    // Closing the window gives its controls back to the radar page.
    w.addEventListener("pagehide", restore);
    w.addEventListener("beforeunload", restore);
    // Keep the simulation going while this window is in front and the radar window is hidden.
    const loop = (): void => {
      if (!isOpen() || win !== w) return;
      opts.keepAlive();
      w.requestAnimationFrame(loop);
    };
    w.requestAnimationFrame(loop);
    void placeOnOtherScreen(w);
    opts.changed(true);
    w.focus();
  };

  const p3 = (x: number): string => normalizeDeg(x).toFixed(1).padStart(5, "0");
  const put = (id: string, html: string): void => {
    const e = el(id);
    if (e && e.innerHTML !== html) e.innerHTML = html;
  };
  const txt = (id: string): string => byId(id)?.textContent?.trim() ?? "";
  const valOf = (id: string): string => (byId(id) as HTMLInputElement | null)?.value?.trim() ?? "";

  const tick = (app: AppState): void => {
    if (!win) return;
    if (win.closed) {
      restore();
      return;
    }
    const d = win.document;
    // Day or night, help and the user's role follow the radar page.
    for (const k of ["mode", "role"] as const) {
      const v = document.body.dataset[k];
      if (v !== undefined && d.body.dataset[k] !== v) d.body.dataset[k] = v;
    }
    d.body.classList.toggle("help", document.body.classList.contains("help"));
    const w = app.world;
    const t = Math.floor(w.time + 1e-6);
    const hh = (n: number): string => String(n).padStart(2, "0");
    put("swTime", `${hh(Math.floor(t / 3600))}:${hh(Math.floor((t % 3600) / 60))}:${hh(t % 60)}`);
    put("swRun", app.running ? "PAUSE" : "RUN");
    el("swRun")?.classList.toggle("on", !app.running);
    put("swShip", esc(`${valOf("osName") || "TRAINING SHIP"} · ${byId<HTMLSelectElement>("shipType")?.selectedOptions[0]?.textContent ?? ""}`));
    const ord = byId("ordCourseV")?.textContent ?? "---";
    put("swCourse", ord);
    const units = w.own.model?.steeringUnits ?? 1;
    put("swPumps", `Pumps <b>${units}</b> running`);
    el("swPump2")?.classList.toggle("on", units === 2);
    const mo = w.own.model?.motion;
    put("swHdg", `${p3(measuredHeading(w))}°`);
    put("swRot", mo ? `${Math.abs(mo.r * 60) < 0.5 ? "0" : `${mo.r > 0 ? "S" : "P"} ${Math.abs(mo.r * 60).toFixed(0)}`} °/min` : "---");
    put("swStw", `${logSpeed(w).toFixed(1)} kn`);
    const noFix = !!w.sensors.gnssFailed;
    const g = ownCogSog(w);
    put("swSog", noFix ? "--.- EPFS" : `${g.speed.toFixed(1)} kn`);
    put("swCog", noFix ? "---.- EPFS" : `${p3(g.course)}°`);
    el("swSog")?.classList.toggle("no", noFix);
    el("swCog")?.classList.toggle("no", noFix);
    const rw = relativeWind(w);
    put("swWind", rw ? `R${String(Math.round(rw.fromRel) % 360).padStart(3, "0")} ${rw.speedKn.toFixed(0)} kn` : "CALM");
    put("swOrdered", `Ordered <b>${txt("ordSpeedV") || "0"} kn</b>`);
    const row = (k: string, v: string): string => `<div class="kv"><span>${k}</span><b>${esc(v) || "---"}</b></div>`;
    put("swDataBody", row("NAME", valOf("osName")) + row("CALL SIGN", valOf("osCall")) + row("MMSI", valOf("osMmsi")) + row("IMO", valOf("osImo")) + row("TYPE", txt("osType")) + row("SIZE", txt("osSize")));
    // While an exercise runs its list folds away (CHOOSE EXERCISE shows it again).
    const ex = el("swEx");
    const running = !!app.arpaEx && !app.arpaEx.finished;
    if (ex) {
      ex.classList.toggle("running", running);
      ex.classList.toggle("showlist", showList);
      if (!running) showList = false;
    }
    setTabIn(tab);
  };

  return {
    open,
    isOpen,
    focus: (t) => {
      if (!isOpen()) return;
      if (t) {
        setTabIn(t);
        if (t === "ex") showList = false;
      }
      win!.focus();
    },
    close: () => {
      if (!isOpen()) return;
      const w = win!;
      restore();
      w.close();
    },
    holds: (e) => isOpen() && e.ownerDocument === doc(),
    tick,
  };
}
