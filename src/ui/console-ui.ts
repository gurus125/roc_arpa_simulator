import { nextToAcknowledge } from "../arpa/index";
import { AisReport, aisFilterOn } from "../ais/index";
import { alertRows } from "./alerts-view";
import { formatLatLon, latLonOf } from "../core/nav";
import { courseSpeedOf, normalizeDeg, sub, velocityOf } from "../core/vec";
import { displayNmToWorld, logSpeed, measuredHeading, ownCogSog, ownGroundVelocity, pulseFor, radarPower, relativeWind, ringInterval, warmUpLeftSec } from "../engine/index";
import { AppState } from "./app";
import { $ } from "./dom";
import { readoutAt } from "./view";
import { arpaStatusLines } from "./arpa-view";

/**
 * Console layout: the radar picture on the left; on the right the working controls and data
 * that a radar console keeps in view (display, own ship, cursor, EBL/VRM, gain and clutter,
 * targets, vectors, target data, AIS data), then a grid of menu keys for everything else.
 * The boxes are built from the SAME controls as before (the elements are moved, so their
 * handlers still work). Explanatory text is hidden until HELP is pressed.
 *
 * The data area is laid out and drawn the way ships' radars in general present their data: one
 * framed panel divided by thin lines; heading and speed in large figures with the sensor they
 * come from; position, cursor, and target data as label and value with the unit in small
 * letters; settings in boxes that are clicked; gain and clutter as bars. The abbreviations are
 * the standard ones of IMO SN.1/Circ.243/Rev.2. It is a generic arrangement of our own, not a
 * copy of any maker's screen. The keys that work the simulator and not the radar (pause, speed,
 * day/night, help) sit in the strip at the top of the page.
 */
type Tab = "radar" | "roc" | "arpa" | "ex" | "instr";
type Line = "ebl" | "vrm" | "ebl2" | "vrm2";

interface Key {
  key: string;
  label: string;
  /** Section headings (h2 text) shown by this key. */
  sections: string[];
  /** Pane the sections live in, or "top" for the sections above the panes. */
  tab: Tab | "top";
  instructor?: boolean;
}

const KEYS: Key[] = [
  { key: "own", label: "SHIP", sections: ["Own ship", "Hand steering"], tab: "top" },
  { key: "meas", label: "PI / MAP", sections: ["Measure"], tab: "top" },
  { key: "gain", label: "RADAR", sections: ["Radar controls"], tab: "radar" },
  { key: "acq", label: "TGT LIST", sections: ["Target data"], tab: "arpa" },
  { key: "alarm", label: "CPA/ALARM", sections: ["Alarms"], tab: "arpa" },
  { key: "past", label: "PAST POS", sections: ["Vectors"], tab: "arpa" },
  { key: "guard", label: "GUARD", sections: ["Guard zones and exclusion areas"], tab: "arpa" },
  { key: "trial", label: "TRIAL", sections: ["Trial manoeuvre"], tab: "arpa" },
  { key: "ais", label: "AIS LIST", sections: ["AIS targets"], tab: "arpa" },
  { key: "arpa", label: "ARPA", sections: ["ARPA operation"], tab: "arpa" },
  { key: "set", label: "SETTINGS", sections: ["Settings", "Own ship data", "Control panel"], tab: "top" },
  { key: "comm", label: "VHF/SIGNAL", sections: ["Communications (VHF, typed)", "Sound signals"], tab: "top" },
  { key: "env", label: "WEATHER", sections: ["Environment"], tab: "radar" },
  { key: "scen", label: "SCENARIO", sections: ["Free practice", "Linked own ships", "Study aids"], tab: "radar" },
  { key: "roc", label: "ROC EX", sections: [], tab: "roc" },
  { key: "ex", label: "ARPA EX", sections: [], tab: "ex" },
  { key: "fault", label: "FAULTS", sections: [], tab: "arpa", instructor: true },
  { key: "instr", label: "INSTR", sections: [], tab: "instr" },
];

/** Small line icons for the panel headings and the page header: simple shapes of our own. */
const svg = (body: string, vb = "0 0 24 24"): string => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICON = {
  radar: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18.4 5.6"/>'),
  gain: svg('<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="7" cy="17" r="2" fill="currentColor"/>'),
  ebl: svg('<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
  ship: svg('<path d="M3 15h18l-3 5H6z"/><path d="M6 15V10h12v5M9 10V6h6v4M12 3v3"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>'),
  arpa: svg('<path d="M12 21V9"/><path d="M8 21h8"/><path d="M7.5 6.5a6.4 6.4 0 0 1 9 0M5 4a10 10 0 0 1 14 0"/><circle cx="12" cy="9" r="1.4" fill="currentColor"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  logo: svg('<path d="M2 17h20l-3.5 4h-13z"/><path d="M5 17v-4h14v4M8 13V9h8v4M11 9V5h2v4M12 2v3"/><path d="M1 22.5c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1"/>'),
};

const VECTOR_TIMES = [1, 2, 3, 6, 12, 15, 20, 30, 45, 60];

/** Text of the RADAR key: the radar's power state, with the warm-up countdown. */
export function radarKeyLabel(w: Parameters<typeof radarPower>[0]): string {
  const pw = radarPower(w);
  const left = Math.ceil(warmUpLeftSec(w));
  return pw === "off" ? "RADAR: OFF" : pw === "warming" ? `WARM UP ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : pw === "standby" ? "RADAR: STANDBY" : "RADAR: ON";
}

export interface ConsoleUi {
  tick: (app: AppState) => void;
  setMenu: (key: string, open?: boolean) => void;
  /** Called when something else changes the tab (starting an exercise, for example). */
  followTab: (tab: Tab) => void;
}

export function initConsoleUi(setTab: (t: Tab) => void, freeLines: () => Record<Line, boolean>): ConsoleUi {
  const side = $("side");
  /** Range rings shown (kept here so the choice survives a change of scenario). */
  let ringsOn = true;
  /** EBL readouts relative to the ship's head (kept here for the same reason). */
  let eblRelative = false;
  // Tag every static section with its heading so a menu key can show or hide it.
  const tagged: { el: HTMLElement; title: string; pane: Tab | "top" }[] = [];
  for (const sec of side.querySelectorAll<HTMLElement>("section")) {
    const h = sec.querySelector(":scope > h2");
    const paneEl = sec.closest<HTMLElement>(".pane");
    const pane = !paneEl ? "top" : paneEl.id === "paneRadar" ? "radar" : paneEl.id === "paneArpa" ? "arpa" : null;
    if (!h || pane === null || sec.closest("details.instr")) continue;
    tagged.push({ el: sec, title: (h.textContent ?? "").trim(), pane });
  }
  const faultBox = side.querySelector<HTMLDetailsElement>("details.instr");

  // The radar screen: the picture in the middle, three data panels down each side of it, and everything
  // else in a menu drawer that opens over the right-hand side (MENU key) and closes again.
  const panel = document.createElement("div");
  panel.id = "console";
  panel.innerHTML = `
    <div id="colL" class="ccolumn">
    <div class="cbox" id="bDisp"><h3><i class="ico">${ICON.radar}</i><span class="ttl">PICTURE &amp; RADAR<span class="long"> CONTROL</span></span><span id="cTopSb"></span></h3>
      <div class="crow"><span class="cl">Range</span><button id="rngDn" class="pm" title="Range scale down">−</button><span id="rngHold"></span><button id="rngUp" class="pm" title="Range scale up">+</button></div>
      <div class="crow"><span class="cl">Band</span><span id="bandKeys" class="seg"><button data-b="X" title="X band (3 cm)">X</button><button data-b="S" title="S band (10 cm)">S</button></span><span class="seg one"><button id="aisKey" title="AIS targets on the picture: on / off (a primary control, IEC 62388 13.3.1)">AIS</button></span></div>
      <div class="crow"><span class="cl">Mode</span><span id="hOrient"></span><span id="hMotion"></span><span id="hStab"></span></div>
      <div class="crow"><span class="cl">Rings</span><span class="seg one"><button id="ringsKey" title="Fixed range rings on / off, and their interval">RINGS</button></span><span id="ringNote" class="note"></span></div>
      <div class="crow"><span class="cl">Pulse</span><span id="pulseSeg" class="seg"></span></div>
      <div class="crow"><span class="cl">Reset</span><span id="hReset" class="seg"></span></div>
      <div id="cPicSt" class="cst"></div>
    </div>
    <div class="cbox" id="bGain"><h3><i class="ico">${ICON.gain}</i><span class="ttl">GAIN / CLUTTER</span><span id="cProc" title="Signal processing in use: IR interference rejection, ENH echo stretch, SC/SC scan-to-scan correlation, MON performance monitor"></span></h3><div id="cGain"></div>
      <div class="crow"><span class="cl">Trails</span><span id="hTrails"></span><span id="hTrailMin"></span></div>
    </div>
    <div class="cbox" id="bCur"><h3><i class="ico">${ICON.ebl}</i><span class="ttl">EBL / CURSOR</span></h3><div id="cEbl"></div><div id="cCur"></div>
      <div class="cbtns"><button id="piMapKey" title="Parallel index lines, offset EBL, off-centre, navigation lines and marks">PI / MAP</button></div>
    </div>
    </div>
    <div id="colR" class="ccolumn">
    <div class="cbox" id="bOwn"><h3><i class="ico">${ICON.ship}</i><span class="ttl">OWN SHIP DATA</span><span id="cTime"></span></h3><div id="cOwn"></div></div>
    <div class="cbox" id="bTd"><h3><i class="ico">${ICON.target}</i><span class="ttl">TARGET DATA</span><span id="cTgtKind"></span><span id="cTgtN"></span><button id="cAisMore" hidden title="Further AIS data: class, IMO number, ship type, destination, ETA, draught, size, position accuracy">MORE</button></h3>
      <div id="tdList" hidden><table><thead><tr><th>No.</th><th>BRG<u>°</u></th><th>RNG<u>NM</u></th><th>CPA<u>NM</u></th><th>TCPA<u>min</u></th><th id="tdCrsH">CRS<u>°</u></th><th id="tdSpdH">SPD<u>kn</u></th><th></th></tr></thead><tbody id="tdRows"></tbody></table></div>
      <div id="cTd"></div></div>
    <div class="cbox" id="bArpa"><h3><i class="ico">${ICON.arpa}</i><span class="ttl">VRM / ARPA</span><span id="cArpaChip"></span></h3><div id="cVrm"></div>
      <div class="crow"><span class="cl">Vector</span><span id="vecSeg" class="seg"></span><span id="hVecT"><select id="vecTimeSel" title="Vector time">${VECTOR_TIMES.map((t) => `<option value="${t}">${t} min</option>`).join("")}</select></span><span id="hVec" hidden></span></div>
      <div class="crow"><span class="cl">Danger</span><span id="hGfx"></span></div>
      <div id="cVecInfo"></div>
      <div id="cArpaSt" class="cst"></div>
      <div id="cTop"><button id="ackKey" title="Acknowledge the alert shown (one at a time: alarms first)">ALARM ACK</button><span id="cTopAlarm"></span></div>
      <div id="cTgt"></div>
      <div class="cbtns cmenu"><button id="menuKey" title="All other controls: ARPA, AIS, radar, display, scenario, settings ..."><i class="ico">${ICON.menu}</i>MENU</button></div>
    </div>
    </div>
    `;
  // The keys that work the simulator, not the radar, sit in the strip at the top of the page.
  const runBar = document.createElement("div");
  runBar.id = "cRun";
  for (const [id, icon] of [["hdrLogo", ICON.logo], ["hdrClockIco", ICON.clock], ["hdrSet", ICON.gear], ["whoChange", ICON.user]] as const) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = icon;
  }
  const hdrRight = document.getElementById("hdrRight");
  if (hdrRight) hdrRight.prepend(runBar);
  else panel.appendChild(runBar);
  const menu = document.createElement("div");
  menu.id = "cMenu";
  // The menu drawer: its title and CLOSE key, the chosen menu's controls (scrolling), and the menu keys at the bottom.
  const body = document.createElement("div");
  body.id = "menuBody";
  while (side.firstChild) body.appendChild(side.firstChild);
  const head = document.createElement("div");
  head.id = "menuHead";
  head.innerHTML = `<b>MENU</b><span id="menuTitle"></span><button id="menuClose" title="Close the menu (Esc)">CLOSE ✕</button>`;
  side.append(head, body, menu);
  side.parentElement!.insertBefore(panel, side);

  // Display: the same selects, moved.
  $("rngHold").appendChild($("range"));
  for (const [hold, id] of [["hOrient", "orient"], ["hMotion", "motion"], ["hStab", "stab"], ["hTrails", "trails"], ["hTrailMin", "trailMin"]] as const) $(hold).appendChild($(id));
  // The settings are shown with the standard abbreviations; the full words are in the tooltip.
  const relabel = (id: string, names: Record<string, string>, title: string): void => {
    const s = $<HTMLSelectElement>(id);
    for (const o of s.options) o.textContent = names[o.value] ?? o.textContent;
    s.title = title;
  };
  relabel("orient", { "north-up": "N UP", "head-up": "H UP", "course-up": "C UP" }, "Orientation: N UP north-up, H UP head-up (unstabilised), C UP course-up");
  relabel("motion", { relative: "RM", true: "TM" }, "Motion: RM relative motion, TM true motion");
  relabel("stab", { ground: "GND", sea: "SEA" }, "Stabilisation of the picture: GND ground, SEA sea (through the water)");
  relabel("trails", { off: "OFF", relative: "REL", true: "TRUE" }, "Trails: off, relative or true");
  relabel("trailMin", {}, "Trail length");
  relabel("range", {}, "Range scale");
  const fire = (el: HTMLElement): void => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const stepSelect = (id: string, d: number): void => {
    const s = $<HTMLSelectElement>(id);
    const i = Math.min(s.options.length - 1, Math.max(0, s.selectedIndex + d));
    if (i !== s.selectedIndex) {
      s.selectedIndex = i;
      fire(s);
    }
  };
  $("bandKeys").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button")?.dataset["b"];
    if (!b) return;
    $<HTMLSelectElement>("band").value = b;
    fire($("band"));
  });
  $("band").closest<HTMLElement>(".row")!.style.display = "none";
  $("ringsKey").addEventListener("click", () => {
    ringsOn = !ringsOn;
  });
  side.ownerDocument.addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement).id === "eblRef") eblRelative = !eblRelative;
  });
  $("rngDn").addEventListener("click", () => stepSelect("range", -1));
  $("rngUp").addEventListener("click", () => stepSelect("range", 1));

  // EBL / VRM: tick boxes only, each with its own large readout. Sliders stay out of sight.
  const lines: { line: Line; box: string; label: string }[] = [
    { line: "ebl", box: "eblOn", label: "EBL 1" },
    { line: "vrm", box: "vrmOn", label: "VRM 1" },
    { line: "ebl2", box: "ebl2On", label: "EBL 2" },
    { line: "vrm2", box: "vrm2On", label: "VRM 2" },
  ];
  for (const l of lines) {
    const rowEl = document.createElement("label");
    rowEl.className = "mrow";
    const old = $(l.box).closest<HTMLElement>(".check");
    rowEl.appendChild($(l.box));
    old?.remove();
    rowEl.insertAdjacentHTML("beforeend", `<span class="cl">${l.label}</span><b class="big" id="m_${l.line}">OFF</b><i id="ms_${l.line}"></i>`);
    // EBLs on the left of the picture, VRMs on the right.
    $(l.line.startsWith("ebl") ? "cEbl" : "cVrm").appendChild(rowEl);
  }

  // EBL bearings can be read true or relative to the ship's head; the reference is shown in every readout.
  $("cEbl").insertAdjacentHTML("beforeend", `<div class="mref"><span class="cl">EBL BRG</span><button id="eblRef" title="EBL bearings true (T) or relative to the ship's head (R)">TRUE</button></div>`);
  for (const id of ["eblBrg", "vrmRng", "ebl2Brg", "vrm2Rng", "arpaVec", "arpaVecT", "arpaGraphics"]) $(id).closest<HTMLElement>(".row")!.style.display = "none";
  // Vectors and danger graphics sit under Trails, in the same form: the same selects, moved.
  $("hVec").appendChild($("arpaVec"));
  $("hGfx").appendChild($("arpaGraphics"));
  relabel("arpaVec", { relative: "REL", true: "TRUE" }, "Vectors: REL relative, TRUE true");
  relabel("arpaGraphics", { off: "OFF", ppc: "PPC", pad: "PAD" }, "Danger graphics: PPC points of possible collision, PAD predicted areas of danger");
  // Target data: the tracked targets in a short list; a row pressed selects that target.
  let appRef: AppState | null = null;
  $("tdRows").addEventListener("pointerdown", (ev) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>("tr")?.dataset["id"];
    if (id && appRef) appRef.arpaSelected = Number(id);
  });
  $("vecTimeSel").addEventListener("change", () => {
    const el = $<HTMLInputElement>("arpaVecT");
    el.value = $<HTMLSelectElement>("vecTimeSel").value;
    fire(el);
  });
  for (const id of ["eblMove", "vrmMove"]) $(id).style.display = "none";
  const more = $("piGrid").closest("details");
  if (more) {
    more.open = true;
    more.querySelector("summary")?.remove();
  }
  $("cuReset").textContent = "C-UP RST";
  $("cuReset").title = "Course-up reset: take the present heading as the new reference";
  $("tmReset").textContent = "TM RST";
  $("tmReset").title = "True motion reset: put own ship back to the start of its run across the screen";
  $("hReset").append($("cuReset"), $("tmReset"));
  /** Keys for each setting of a select, the one in use lit; the select stays the control (moved out of sight). */
  const segs: { sel: HTMLSelectElement; holder: HTMLElement }[] = [];
  const segment = (holder: string, selectId: string, names: Record<string, string>, titles: Record<string, string>): void => {
    const sel = $<HTMLSelectElement>(selectId);
    const h = $(holder);
    h.innerHTML = [...sel.options].map((o) => `<button data-v="${o.value}" title="${titles[o.value] ?? ""}">${names[o.value] ?? o.textContent}</button>`).join("");
    h.addEventListener("click", (ev) => {
      const v = (ev.target as HTMLElement).closest<HTMLElement>("button")?.dataset["v"];
      if (v === undefined || sel.value === v) return;
      sel.value = v;
      fire(sel);
    });
    segs.push({ sel, holder: h });
  };
  segment("vecSeg", "arpaVec", { relative: "REL", true: "TRUE" }, { relative: "Relative vectors", true: "True vectors" });
  segment("pulseSeg", "pulse", { auto: "AUTO", short: "SHORT", medium: "MED", long: "LONG" },
    { auto: "Pulse length chosen by the range scale", short: "Short pulse", medium: "Medium pulse", long: "Long pulse" });

  // Gain, sea, rain, tune with the automatic controls beside them.
  // Display brilliance is a primary control (IEC 62388 13.3.1), so it sits with gain and the clutter controls.
  const short: Record<string, string> = { gain: "GAIN", stc: "SEA", ftc: "RAIN", tuning: "TUNE", brill: "BRILL" };
  const autoOf: Record<string, string> = { stc: "autoSea", ftc: "autoRain", tuning: "autoTune" };
  $("aisKey").addEventListener("click", () => $("aisOn").click());
  // Further data of the selected AIS target, on request (IEC 62388 11.6.1: shown on request, with an
  // indication in the data field that it is there).
  let aisMore = false;
  $("cAisMore").addEventListener("click", () => {
    aisMore = !aisMore;
  });
  for (const id of ["gain", "stc", "ftc", "tuning", "brill"]) {
    const r = $(id).closest<HTMLElement>(".row")!;
    r.querySelector("label")!.textContent = short[id]!;
    const a = autoOf[id];
    if (a) {
      const lab = $(a).closest("label")!;
      lab.lastChild!.textContent = " AUTO";
      lab.classList.add("auto");
      r.appendChild(lab);
    } else r.insertAdjacentHTML("beforeend", `<span class="auto"></span>`);
    $("cGain").appendChild(r);
  }
  const meterRow = $("meter").closest<HTMLElement>(".row")!;
  meterRow.querySelector("label")!.textContent = "METER";
  $("cGain").appendChild(meterRow);

  // Targets: the four click actions in one row.
  $("cTgt").appendChild($("cmAcq").closest<HTMLElement>(".btns")!);
  $("cmAcq").closest(".btns")!.querySelector(".small")?.remove();
  $("cmEbl").textContent = "Measure";
  const tgtRow = $("arpaCancelAll").closest<HTMLElement>(".btns")!;
  $("arpaCancelAll").textContent = "Cancel all";
  const autoAcq = $("arpaAuto").closest<HTMLElement>(".check")!;
  autoAcq.querySelector("label")!.textContent = "Auto";
  // One strip: the four click actions, cancel all, automatic acquisition.
  const strip = $("cmAcq").closest<HTMLElement>(".btns")!;
  strip.append($("arpaCancelAll"), autoAcq);
  tgtRow.remove();
  $("bTd").appendChild($("arpaMsg"));
  // Rows in the order the right-hand panel lists them: VRMs, vectors, limits, status, alerts, target keys, MENU.

  // Run / speed / radar standby stay in view (the same controls, moved).
  for (const id of ["run", "speed"]) $("cRun").appendChild($(id));
  // Radar ON / STANDBY and alarm acknowledge sit at the top, larger than the other keys.
  $("cTopSb").appendChild($("radarSb"));
  $("ackKey").addEventListener("click", () => $("arpaAckNext").click());
  const help = document.createElement("button");
  help.id = "cHelp";
  help.className = "ico";
  help.innerHTML = ICON.help;
  help.title = "Help: a short explanation under every control (press again to hide)";
  help.addEventListener("click", () => {
    document.body.classList.toggle("help");
    help.classList.toggle("on", document.body.classList.contains("help"));
  });
  const hdrIcons = document.getElementById("hdrIcons");
  if (hdrIcons) hdrIcons.insertBefore(help, document.getElementById("whoChange"));
  else $("cRun").appendChild(help);
  $("cMenu").innerHTML = KEYS.map((k) => `<button data-key="${k.key}" class="${k.instructor ? "instr-only" : ""}">${k.label}</button>`).join("");

  const night = document.createElement("button");
  night.id = "nightKey";
  night.textContent = "DAY";
  night.title = "Display mode: day / night (also under SETTINGS)";
  night.addEventListener("click", () => {
    const now = document.body.dataset["mode"] === "night" ? "night" : "day";
    document.querySelector<HTMLElement>(`#modeKeys button[data-m="${now === "night" ? "day" : "night"}"]`)?.click();
  });
  $("cRun").appendChild(night);

  let current = "own";
  /** The tabs at the top of the page: RADAR (the radar screen and its menu), ARPA, EXERCISE. */
  const TOP_OF: Record<string, string> = { arpa: "arpa", acq: "arpa", alarm: "arpa", past: "arpa", guard: "arpa", trial: "arpa", ais: "arpa", fault: "arpa", ex: "exercise", roc: "exercise" };
  const syncTabs = (): void => {
    const open = document.body.classList.contains("menu-open");
    const on = open ? (TOP_OF[current] ?? "radar") : "radar";
    for (const b of document.querySelectorAll<HTMLElement>("#topTabs button")) b.classList.toggle("on", b.dataset["top"] === on);
  };
  /** Open or close the menu drawer. */
  const openMenu = (open: boolean): void => {
    document.body.classList.toggle("menu-open", open);
    $("menuKey").classList.toggle("on", open);
    syncTabs();
  };
  const setMenu = (key: string, open = true): void => {
    const k = KEYS.find((x) => x.key === key) ?? KEYS[0]!;
    current = k.key;
    if (open) openMenu(true);
    $("menuTitle").textContent = k.label;
    for (const b of $("cMenu").querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["key"] === k.key);
    if (k.tab !== "top") setTab(k.tab);
    for (const t of tagged) t.el.style.display = t.pane === k.tab && k.sections.includes(t.title) ? "" : "none";
    // With a top key nothing from the panes is shown.
    for (const id of ["paneRadar", "paneRoc", "paneArpa", "paneEx", "paneInstr"]) {
      if (k.tab === "top") $(id).hidden = true;
    }
    if (faultBox) {
      faultBox.style.display = k.key === "fault" ? "" : "none";
      if (k.key === "fault") faultBox.open = true;
    }
    syncTabs();
  };
  // RADAR opens the radar's own menu, ARPA the ARPA's, EXERCISE the list of exercises; the lit tab pressed
  // again while its menu is open closes the menu. The gear opens SETTINGS.
  const TAB_KEY: Record<string, string> = { radar: "gain", arpa: "arpa", exercise: "ex" };
  document.getElementById("topTabs")?.addEventListener("click", (ev) => {
    const top = (ev.target as HTMLElement).closest<HTMLElement>("button")?.dataset["top"];
    if (!top) return;
    const open = document.body.classList.contains("menu-open");
    if (open && (TOP_OF[current] ?? "radar") === top) openMenu(false);
    else {
      setMenu(TAB_KEY[top] ?? "gain");
      body.scrollTop = 0;
    }
  });
  document.getElementById("hdrSet")?.addEventListener("click", () => {
    setMenu("set");
    body.scrollTop = 0;
  });
  $("cMenu").addEventListener("click", (ev) => {
    const key = (ev.target as HTMLElement).closest("button")?.dataset["key"];
    if (!key) return;
    // Pressing the lit key again goes back to the main panel; otherwise the menu's controls are brought into view.
    setMenu(key);
    body.scrollTop = 0;
  });
  setMenu("own", false);
  $("menuKey").addEventListener("click", () => openMenu(!document.body.classList.contains("menu-open")));
  $("menuClose").addEventListener("click", () => openMenu(false));
  $("piMapKey").addEventListener("click", () => {
    setMenu("meas");
    body.scrollTop = 0;
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && document.body.classList.contains("menu-open")) openMenu(false);
  });

  /** A label and its value kept together, for a row of several. */
  const pair = (label: string, value: string, cls = ""): string => `<span class="pair"><span class="cl">${label}</span> <b class="${cls}">${value}</b></span>`;
  /** A unit, written small after its value. */
  const unit = (u: string): string => `<u>${u}</u>`;
  const dash = "---";
  /** The controls drawn as bars. */
  const BAR_IDS = ["gain", "stc", "ftc", "tuning", "brill"];
  const p3 = (x: number): string => normalizeDeg(x).toFixed(1).padStart(5, "0");
  const put = (id: string, html: string): void => {
    const el = $(id);
    if (el.innerHTML !== html) el.innerHTML = html;
  };

  const tick = (app: AppState): void => {
    const w = app.world;
    const c = w.radar.controls;
    const a = app.arpa;
    const s = a.settings;
    const cog = ownCogSog(w);
    const t = Math.floor(w.time + 1e-6);
    const time = `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    const arpaOn = !app.roc && !s.standby;

    const mo = w.own.model;
    const rw = relativeWind(w);
    const side1 = (x: number, dead: number, f: (a: number) => string, zero: string): string => (Math.abs(x) < dead ? zero : `${x > 0 ? "S" : "P"} ${f(Math.abs(x))}`);
    for (const b of $("bandKeys").querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["b"] === w.radar.band);
    put("nightKey", document.body.dataset["mode"] === "night" ? "NIGHT" : "DAY");
    appRef = app;
    for (const g of segs) for (const b of g.holder.querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["v"] === g.sel.value);
    app.ringsOn = ringsOn;
    // Heading input lost: the picture goes to unstabilised head-up, relative motion, and only relative bearings
    // can be measured (IEC 62388 16.2.2.1: automatically, within a minute, with an indication).
    const headingLost = !app.roc && a.gyroFailed;
    if (headingLost) {
      for (const [id, v] of [["orient", "head-up"], ["motion", "relative"]] as const) {
        const el = $<HTMLSelectElement>(id);
        if (el.value !== v) {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
    app.headingLost = headingLost;
    app.eblRelative = eblRelative || headingLost;
    $("ringsKey").classList.toggle("on", ringsOn);
    put("ringsKey", ringsOn ? "ON" : "OFF");
    put("ringNote", ringsOn ? `every ${ringInterval(c.rangeNm)} NM` : "");
    const rows = alertRows(app);
    const pending = rows.filter((x) => !x.acked && x.priority !== "caution");
    const caution = rows.find((x) => x.priority === "caution");
    const nextAlert = nextToAcknowledge(rows);
    $("ackKey").classList.toggle("alarm", pending.length > 0);
    put("cTopAlarm", nextAlert ? `<span class="${nextAlert.priority === "alarm" ? "no" : "wn"}">${pending.length > 1 ? `${pending.length} ALERTS: ` : ""}${nextAlert.priority.toUpperCase()}: ${nextAlert.text.replace(/</g, "&lt;")}</span>` : `${caution ? `<span class="cau">CAUTION: ${caution.text.replace(/</g, "&lt;")}</span>` : `<span class="cl">NO ALARM</span>`}`);
    // The alert box is filled red for an alarm and orange for a warning; a caution is yellow, steady and silent.
    const alertClass = nextAlert ? nextAlert.priority : caution ? "caution" : "";
    if ($("cTopAlarm").className !== alertClass) $("cTopAlarm").className = alertClass;
    // The page header: the ship's clock (UTC, date and time) and the state of the alerts.
    const hdrTime = document.getElementById("hdrTime");
    if (hdrTime) {
      const utc = new Date(app.startUtcMs + w.time * 1000);
      const hh = (n: number): string => String(n).padStart(2, "0");
      put("hdrTime", `${hh(utc.getUTCHours())}:${hh(utc.getUTCMinutes())}:${hh(utc.getUTCSeconds())}`);
      put("hdrDate", `${utc.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][utc.getUTCMonth()]} ${utc.getUTCFullYear()} UTC`);
      const st = nextAlert ? (nextAlert.priority === "alarm" ? "alarm" : "warning") : caution ? "caution" : "ok";
      const word = st === "ok" ? "No Alarms" : `${pending.length > 1 ? `${pending.length} ` : ""}${st === "alarm" ? "ALARM" : st === "warning" ? "WARNING" : "CAUTION"}`;
      put("hdrAlarm", `<i class="dot"></i><span>${word}</span>`);
      if ($("hdrAlarm").className !== st) $("hdrAlarm").className = st;
    }
    $("radarSb").classList.toggle("stby", app.radarStandby);
    put("radarSb", radarKeyLabel(w));
    // Screen brilliance sets the brightness of the whole picture (Bole, Wall and Norris 6.2.3), from dim at 10 to full at 100.
    const bright = `brightness(${(0.15 + 0.85 * Math.min(1, Math.max(0, (w.radar.controls.brilliance - 10) / 60))).toFixed(2)})`;
    const ppiEl = $("ppi");
    if (ppiEl.style.filter !== bright) ppiEl.style.filter = bright;
    // Own ship: heading and speed in large figures, each value with the sensor it comes from
    // (red when the instructor has failed that sensor, as the ARPA's own alarm already says).
    const pos = latLonOf(w.origin, w.own.pos);
    const noFix = !!w.sensors.gnssFailed;
    const nav = (label: string, value: string, u: string, source: string, bad: boolean, cls = ""): string =>
      `<div class="nav ${cls}"><span class="cl">${label}</span><b>${value}</b>${unit(u)}<i class="src${bad ? " no" : ""}">${source}</i></div>`;
    put("cOwn",
      nav("HDG", p3(measuredHeading(w)), "°", "GYRO", !app.roc && a.gyroFailed, "big") + nav("STW", logSpeed(w).toFixed(1), "kn", "LOG", !app.roc && a.logFailed, "big") +
      // With the EPFS (GNSS) failed there is no position, course or speed over the ground.
      (noFix
        ? nav("COG", "---.-", "°", "EPFS", true) + nav("SOG", "--.-", "kn", "EPFS", true) +
          `<div class="nav pos"><span class="cl">LAT</span><b class="no">NO FIX</b></div><div class="nav pos"><span class="cl">LON</span><b class="no">NO FIX</b></div>`
        : nav("COG", p3(cog.course), "°", "EPFS", false) + nav("SOG", cog.speed.toFixed(1), "kn", "EPFS", false) +
          `<div class="nav pos"><span class="cl">LAT</span><b>${formatLatLon(pos.lat, "lat", 3)}</b></div><div class="nav pos"><span class="cl">LON</span><b>${formatLatLon(pos.lon, "lon", 3)}</b></div>`) +
      `<div class="navrow">` +
      pair("RUD", mo ? side1(mo.motion.rudder, 0.5, (x) => `${x.toFixed(0)}°`, "MID") : "---") + pair("ROT", mo ? side1(mo.motion.r * 60, 0.5, (x) => `${x.toFixed(0)}°/min`, "0") : "---") +
      pair("STEER", w.own.anchor ? "ANCHORED" : mo ? (mo.steering === "hand" ? "HAND" : "AUTO") : "---", "pill") +
      pair("WIND", rw ? `R${String(Math.round(rw.fromRel) % 360).padStart(3, "0")} ${rw.speedKn.toFixed(0)} kn` : "CALM") +
      `</div>`);
    // The exercise clock, in the heading of the own ship panel.
    put("cTime", `TIME <b>${time}</b>`);

    // Cursor: bearing (true and relative) and range as the radar reads them, and the position that
    // bearing and range give from own ship's position (so a gyro error shifts it, as on a real set).
    const cur = app.cursor ? readoutAt(app, displayNmToWorld(w, app.display, app.cursor.x, app.cursor.y)) : null;
    // The cursor's position is worked from own ship's position, so there is none without the EPFS.
    const curPos = cur && !noFix ? latLonOf(w.origin, { e: w.own.pos.e + cur.range * Math.sin((cur.trueBearing * Math.PI) / 180), n: w.own.pos.n + cur.range * Math.cos((cur.trueBearing * Math.PI) / 180) }) : null;
    put("cCur",
      `<div class="cline">` + pair("BRG", cur ? `${p3(cur.trueBearing)}${unit("°T")}` : dash, "big") + pair("REL", cur ? `${p3(cur.relBearing)}${unit("°")}` : dash) + pair("RNG", cur ? `${cur.range.toFixed(2)}${unit("NM")}` : dash, "big") + `</div>` +
      `<div class="cpos"><span class="cl">CURS</span><b>${curPos ? formatLatLon(curPos.lat, "lat", 3) : "--°--.---'"}</b><b>${curPos ? formatLatLon(curPos.lon, "lon", 3) : "---°--.---'"}</b></div>`);

    // Gain and clutter bars: how far each bar is filled.
    for (const id of BAR_IDS) {
      const el = $<HTMLInputElement>(id);
      const pct = `${Math.round(((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100)}%`;
      if (el.style.getPropertyValue("--p") !== pct) el.style.setProperty("--p", pct);
    }

    const free = freeLines();
    const eblText = (trueBearing: number): string => (app.eblRelative ? `${p3(trueBearing - measuredHeading(w))}° R` : `${p3(trueBearing)}° T`);
    const val: Record<Line, string> = {
      ebl: app.ebl.on ? eblText(app.ebl.bearing) : "OFF",
      vrm: app.vrm.on ? `${app.vrm.range.toFixed(2)} NM` : "OFF",
      ebl2: app.ebl2.on ? eblText(app.ebl2.bearing) : "OFF",
      vrm2: app.vrm2.on ? `${app.vrm2.range.toFixed(2)} NM` : "OFF",
    };
    put("eblRef", app.eblRelative ? "REL" : "TRUE");
    // AIS on / off, and the signal processing in use, are always in view.
    const aisOn = $<HTMLInputElement>("aisOn").checked;
    $("aisKey").classList.toggle("on", aisOn);
    // The filter for sleeping targets is shown here as well as on the picture while it is on.
    put("aisKey", aisOn ? (aisFilterOn(app.ais.settings.sleepFilter) ? "AIS FILT" : "AIS ON") : "AIS OFF");
    put("cProc", [[c.interferenceRejection, "IR"], [c.echoStretch, "ENH"], [c.echoAverage, "SC/SC"], [app.pmOn, "MON"]].map(([on, name]) => `<i class="${on ? "on" : ""}">${name}</i>`).join(""));
    for (const l of lines) {
      put(`m_${l.line}`, val[l.line]);
      put(`ms_${l.line}`, val[l.line] === "OFF" ? "" : free[l.line] ? "MOVE" : "LOCK");
    }

    put("cTgtN", arpaOn ? `${a.activeCount()} / ${a.cfg.maxTracks}` : app.roc ? "ARPA OFF" : "STANDBY");
    put("cArpaChip", app.roc ? "ARPA OFF" : s.standby ? "STANDBY" : "ARPA ON");
    $("cArpaChip").className = app.roc ? "off" : s.standby ? "stby" : "on";
    {
      // The list of tracked targets: number, bearing, range, CPA, TCPA, course and speed (through the water or over the
      // ground, as the ARPA is stabilised), and a status light: green steady, orange acquiring, preliminary or lost, red dangerous.
      const gnd = a.stabLabel().startsWith("GND");
      put("tdCrsH", `${gnd ? "COG" : "CTW"}<u>°</u>`);
      put("tdSpdH", `${gnd ? "SOG" : "STW"}<u>kn</u>`);
      const list = arpaOn ? a.tracks : [];
      $("tdList").hidden = list.length === 0;
      const p1 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");
      put("tdRows", list.map((t, i) => {
        const rel = t.est?.rel ?? a.predictRel(t, w.time);
        const est = t.est && t.quality !== "acquiring" && t.state !== "lost" ? t.est : null;
        const q = t.quality === "prelim" ? "?" : "";
        const cp = est?.cpa;
        const st = t.state === "lost" ? "wn" : t.dangerous ? "no" : t.quality === "steady" ? "ok" : "wn";
        const cls = `${app.arpaSelected === t.id ? "sel " : ""}${t.dangerous ? "danger" : ""}`;
        return `<tr data-id="${t.id}" class="${cls}"><td><i>${i + 1}</i>${String(t.id).padStart(3, "0")}</td><td>${p1(Math.atan2(rel.e, rel.n) * 180 / Math.PI)}</td><td>${Math.hypot(rel.e, rel.n).toFixed(1)}</td>` +
          `<td>${cp ? (cp.opening ? "open" : `${cp.cpa.toFixed(1)}${q}`) : dash}</td><td>${cp && cp.tcpaMinutes !== null && !cp.opening ? `${cp.tcpaMinutes.toFixed(1)}${q}` : dash}</td>` +
          `<td>${est ? p1(est.trueCS.course) : dash}</td><td>${est ? est.trueCS.speed.toFixed(1) : dash}</td><td><i class="dot ${st}"></i></td></tr>`;
      }).join(""));
    }
    // Pulse length in use, and the heading failure, under the picture settings; the ARPA's state in the ARPA panel.
    const pl = pulseFor(c.rangeNm, c.pulse);
    put("cPicSt", `<span class="pair"><span class="cl">PULSE</span> <b>${pl.name === "short" ? "SP" : pl.name === "medium" ? "MP" : "LP"} ${pl.microseconds} µs</b></span>` +
      (app.headingLost ? ` <b class="wn">HDG FAIL: UNSTAB, REL BRG ONLY</b>` : ""));
    put("cArpaSt", arpaStatusLines(app).map((l) => `<b class="${l.cls}">${l.text.replace(/</g, "&lt;")}</b>`).join(""));
    const vsel = $<HTMLSelectElement>("vecTimeSel");
    if (vsel.value !== String(s.vectorMinutes) && document.activeElement !== vsel) {
      if (![...vsel.options].some((o) => o.value === String(s.vectorMinutes))) vsel.add(new Option(`${s.vectorMinutes} min`, String(s.vectorMinutes)));
      vsel.value = String(s.vectorMinutes);
    }
    put("cVecInfo",
      pair("CPA LIM", `${s.cpaLimitNm}${unit("NM")}`) + pair("TCPA LIM", `${s.tcpaLimitMin}${unit("min")}`) +
      pair("PAST", arpaOn && s.past.mode !== "off" ? `${s.past.mode === "true" ? "T" : "R"} ${s.past.points}x${s.past.intervalMin}m` : "OFF"));

    // Selected target. An ARPA track shows the values of its row in the target list (computed by the ARPA code);
    // with no track selected, a selected AIS target shows what its AIS report carries.
    const tr = document.querySelector<HTMLElement>("#arpaRows tr.sel");
    const td = tr ? [...tr.querySelectorAll("td")].map((x) => x.textContent ?? "") : null;
    const [bcr, bct] = td ? (td[7] ?? "").split("/").map((x) => x.trim()) : ["", ""];
    const v = td || app.roc ? undefined : app.ais.targets(w, a, { cpaNm: s.cpaLimitNm, tcpaMin: s.tcpaLimitMin }).find((x) => x.report.id === app.ais.selected);
    // A value with its unit; no unit after "---" or "open". The "?" of a preliminary value goes after the unit.
    const withUnit = (x: string | undefined, u: string): string => {
      if (!x || x === dash || x === "open") return x || dash;
      const prelim = x.endsWith("?");
      return `${prelim ? x.slice(0, -1) : x}${unit(u)}${prelim ? `<i class="q">?</i>` : ""}`;
    };
    /** One field of the target data: label at the left of its column, value at the right. */
    const field = (label: string, value: string, cls = "", span = ""): string => `<div class="tp ${span}"><span class="cl">${label}</span> <b class="${cls}">${value}</b></div>`;
    put("cTgtKind", td ? "TT" : v ? "AIS" : "");
    const moreKey = $<HTMLButtonElement>("cAisMore");
    moreKey.hidden = !v;
    moreKey.classList.toggle("on", !!v && aisMore);
    put("cAisMore", aisMore ? "LESS" : "MORE");
    // A tracked target's course and speed are through the water when the ARPA is sea stabilised (CTW, STW)
    // and over the ground when it is ground stabilised (COG, SOG): IEC 62288 5.5.10.1.
    const ground = a.stabLabel().startsWith("GND");
    // With the sea stabilised, an AIS target's course and speed are given through the water (CTW, STW: IEC 62388
    // 11.6.1): its reported course and speed over the ground less the set and drift that own ship is experiencing.
    const aisWater = (() => {
      if (!v || ground) return null;
      const ownWater = velocityOf({ course: measuredHeading(w), speed: logSpeed(w) });
      const setDrift = sub(ownGroundVelocity(w), ownWater);
      return courseSpeedOf(sub(velocityOf({ course: v.report.cog, speed: v.report.sog }), setDrift));
    })();
    put("cTd", td
      ? field("TGT", td[0] ?? dash, "big") + field("BRG", withUnit(td[1], "°T"), "big") + field("RNG", withUnit(td[2], "NM"), "big") + field("STATE", td[8] ?? dash, /DANGER/.test(td[8] ?? "") ? "no" : /LOST|PRELIM|FADE/.test(td[8] ?? "") ? "wn" : "") +
        field(ground ? "COG" : "CTW", withUnit(td[5], "°T"), "big") + field(ground ? "SOG" : "STW", withUnit(td[6], "kn"), "big") + field("CPA", withUnit(td[3], "NM"), "big") + field("TCPA", withUnit(td[4], "min"), "big") +
        field("BCR", withUnit(bcr, "NM")) + field("BCT", withUnit(bct, "min"))
      : v
        ? field("AIS", v.report.name.replace(/</g, "&lt;"), "big", "span2") + field("BRG", `${p3(v.bearing)}${unit("°T")}`, "big") + field("RNG", `${v.range.toFixed(2)}${unit("NM")}`, "big") +
          (aisWater
            ? field("CTW", `${p3(aisWater.course)}${unit("°T")}`, "big") + field("STW", `${aisWater.speed.toFixed(1)}${unit("kn")}`, "big")
            : field("COG", `${p3(v.report.cog)}${unit("°T")}`, "big") + field("SOG", `${v.report.sog.toFixed(1)}${unit("kn")}`, "big")) + field("CPA", v.cpa.opening ? "open" : `${v.cpa.cpa.toFixed(2)}${unit("NM")}`, "big") + field("TCPA", v.cpa.tcpaMinutes === null ? dash : `${v.cpa.tcpaMinutes.toFixed(1)}${unit("min")}`, "big") +
          field("HDG", `${p3(v.report.heading)}${unit("°")}`) + field("ROT", v.report.rot === null ? "MISSING" : `${Math.abs(v.report.rot) < 0.5 ? "0" : `${v.report.rot > 0 ? "S" : "P"} ${Math.abs(v.report.rot).toFixed(0)}`}${unit("°/min")}`, v.report.rot === null ? "wn" : "") +
          field("STATE", v.lost ? "LOST" : v.dangerous ? "DANGER" : v.state === "activated" ? "ACTIVE" : "SLEEP", v.dangerous ? "no" : v.lost ? "wn" : "") + field("AGE", `${Math.round(v.ageSec)}${unit("s")}`) +
          // Identification, navigational status and reported position (IEC 62288 5.5.11.1); on request, the further data.
          // What the report does not carry is shown as MISSING.
          (aisMore ? moreLine(v.report) : `<div class="tp none"><span class="pair"><span class="cl">MMSI</span> <b>${v.report.mmsi || "MISSING"}</b></span><span class="pair"><span class="cl">C/S</span> <b>${v.report.callSign || "MISSING"}</b></span><span class="pair"><b class="${v.report.navStatus ? "" : "wn"}">${(v.report.navStatus || "STATUS MISSING").replace(/</g, "&lt;").toUpperCase()}</b></span><span class="pair"><span class="cl">POSN</span> <b>${formatLatLon(latLonOf(w.origin, v.report.pos).lat, "lat", 3)} ${formatLatLon(latLonOf(w.origin, v.report.pos).lon, "lon", 3)}</b></span></div>`)
        : `<div class="tp none nosel"><i class="ico">${ICON.target}</i><span><b>NO TARGET SELECTED</b><span class="cl">Acquire or select a target, or press a row of the list</span></span></div>`);
  };

  /** The further data of an AIS report, one line; MISSING where the report carries none. */
  const moreLine = (r: AisReport): string => {
    const pair = (label: string, value: string | null): string =>
      `<span class="pair"><span class="cl">${label}</span> <b class="${value === null ? "wn" : ""}">${value === null ? "MISSING" : value.replace(/</g, "&lt;").toUpperCase()}</b></span>`;
    const size = r.lengthM === null ? null : `${Math.round(r.lengthM)}x${Math.round(r.beamM ?? 0)} m`;
    return `<div class="tp none more">${pair("CLASS", r.cls === "A" ? "A" : `B ${r.cls.slice(2)}`)}${pair("IMO", r.imo)}${pair("TYPE", r.shipType)}${pair("DEST", r.destination)}${pair("ETA", r.eta)}${pair("DRAUGHT", r.draughtM === null ? null : `${r.draughtM.toFixed(1)} m`)}${pair("SIZE", size)}${pair("POS ACC", r.posAccuracy === "high" ? "HIGH" : "LOW")}</div>`;
  };

  return {
    tick,
    setMenu,
    followTab: (tab) => {
      const k = KEYS.find((x) => x.key === current);
      if (k && (k.tab === tab || (k.tab === "top" && tab === "radar"))) return;
      // An exercise, ROC or instructor pane is something to read and work in: the drawer opens on it.
      setMenu(tab === "radar" ? "scen" : tab === "arpa" ? "acq" : tab, tab === "ex" || tab === "roc" || tab === "instr");
    },
  };
}
