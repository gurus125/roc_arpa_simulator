import { normalizeDeg } from "../core/vec";
import { logSpeed, measuredHeading, ownCogSog, relativeWind, ringInterval } from "../engine/index";
import { AppState } from "./app";
import { $ } from "./dom";

/**
 * Console layout: the radar picture on the left; on the right the working controls and data
 * that a radar console keeps in view (display, own ship, cursor, EBL/VRM, gain and clutter,
 * targets, vectors, target data, AIS data), then a grid of menu keys for everything else.
 * The boxes are built from the SAME controls as before (the elements are moved, so their
 * handlers still work). Explanatory text is hidden until HELP is pressed. This is a generic
 * radar-console arrangement of our own, not a copy of any maker's screen.
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
  { key: "own", label: "SHIP", sections: ["Own ship"], tab: "top" },
  { key: "meas", label: "PI / MAP", sections: ["Measure"], tab: "top" },
  { key: "gain", label: "RADAR", sections: ["Radar controls"], tab: "radar" },
  { key: "acq", label: "TGT LIST", sections: ["Target data"], tab: "arpa" },
  { key: "alarm", label: "CPA/ALARM", sections: ["Alarms"], tab: "arpa" },
  { key: "past", label: "PAST POS", sections: ["Vectors"], tab: "arpa" },
  { key: "guard", label: "GUARD", sections: ["Guard zones and exclusion areas"], tab: "arpa" },
  { key: "trial", label: "TRIAL", sections: ["Trial manoeuvre"], tab: "arpa" },
  { key: "ais", label: "AIS LIST", sections: ["AIS targets"], tab: "arpa" },
  { key: "arpa", label: "ARPA", sections: ["ARPA operation"], tab: "arpa" },
  { key: "comm", label: "VHF", sections: ["Communications (VHF, typed)"], tab: "top" },
  { key: "env", label: "WEATHER", sections: ["Environment"], tab: "radar" },
  { key: "scen", label: "SCENARIO", sections: ["Free practice", "Linked own ships", "Study aids"], tab: "radar" },
  { key: "roc", label: "ROC EX", sections: [], tab: "roc" },
  { key: "ex", label: "ARPA EX", sections: [], tab: "ex" },
  { key: "fault", label: "FAULTS", sections: [], tab: "arpa", instructor: true },
  { key: "instr", label: "INSTR", sections: [], tab: "instr" },
];

const VECTOR_TIMES = [3, 6, 12, 15, 30];

export interface ConsoleUi {
  tick: (app: AppState) => void;
  setMenu: (key: string) => void;
  /** Called when something else changes the tab (starting an exercise, for example). */
  followTab: (tab: Tab) => void;
}

export function initConsoleUi(setTab: (t: Tab) => void, freeLines: () => Record<Line, boolean>): ConsoleUi {
  const side = $("side");
  /** Range rings shown (kept here so the choice survives a change of scenario). */
  let ringsOn = true;
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

  const panel = document.createElement("div");
  panel.id = "console";
  panel.innerHTML = `
    <div id="cTop" class="wide"><span id="cTopSb"></span><button id="ackKey" title="Acknowledge all alarms">ALARM ACK</button><span id="cTopAlarm"></span></div>
    <div class="cbox" id="bDisp"><h3>DISPLAY</h3>
      <div class="crow"><span class="cl">RANGE</span><button id="rngDn" class="pm">−</button><span id="rngHold"></span><button id="rngUp" class="pm">+</button><button id="ringsKey" title="Range rings on / off">RINGS</button><b id="cRings" class="big"></b></div>
      <div class="crow"><span class="cl">BAND</span><span id="bandKeys" class="cbtns" style="margin:0"><button data-b="X">X BAND</button><button data-b="S">S BAND</button></span></div>
      <div class="crow"><span class="cl">ORIENT</span><span id="hOrient"></span></div>
      <div class="crow"><span class="cl">MOTION</span><span id="hMotion"></span></div>
      <div class="crow"><span class="cl">STAB</span><span id="hStab"></span></div>
      <div class="crow"><span class="cl">TRAILS</span><span id="hTrails"></span><span id="hTrailMin"></span></div>
    </div>
    <div class="cbox" id="bOwn"><h3>OWN SHIP <span id="cTx"></span> <span id="cAlarm" class="no"></span></h3><div class="cgrid" id="cOwn"></div></div>
    <div class="cbox" id="bCur"><h3>CURSOR</h3><div class="cgrid" id="cCur"></div></div>
    <div class="cbox" id="bMeas"><h3>EBL / VRM</h3><div id="cMeas"></div></div>
    <div class="cbox" id="bGain"><h3>GAIN / CLUTTER</h3><div id="cGain"></div></div>
    <div class="cbox" id="bTgt"><h3>TARGETS <span id="cTgtN"></span></h3><div id="cTgt"></div></div>
    <div class="cbox" id="bVec"><h3>VECTORS</h3>
      <div class="cbtns"><span id="vecMode"><button data-v="relative">REL</button><button data-v="true">TRUE</button></span><span id="vecGfx"><button data-g="ppc">PPC</button><button data-g="pad">PAD</button></span><b id="cVecNow" class="big"></b></div>
      <div class="cbtns" id="vecTime"><button data-d="-1" class="pm">−</button>${VECTOR_TIMES.map((t) => `<button data-t="${t}">${t}</button>`).join("")}<button data-d="1" class="pm">+</button><span class="cl">min</span></div>
      <div class="cgrid" id="cVecInfo"></div>
    </div>
    <div class="cbox wide" id="bTd"><h3>TARGET DATA (ARPA)</h3><div class="cgrid four" id="cTd"></div></div>
    <div class="cbox wide" id="bAis"><h3>AIS TARGET DATA</h3><div class="cgrid four" id="cAis"></div></div>
    <div id="cRun" class="wide"></div><div id="cMenu" class="wide"></div>`;
  side.insertBefore(panel, side.firstChild);

  // Display: the same selects, moved.
  $("rngHold").appendChild($("range"));
  for (const [hold, id] of [["hOrient", "orient"], ["hMotion", "motion"], ["hStab", "stab"], ["hTrails", "trails"], ["hTrailMin", "trailMin"]] as const) $(hold).appendChild($(id));
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
    $("cMeas").appendChild(rowEl);
  }

  for (const id of ["eblBrg", "vrmRng", "ebl2Brg", "vrm2Rng", "arpaVec", "arpaVecT", "arpaGraphics"]) $(id).closest<HTMLElement>(".row")!.style.display = "none";
  for (const id of ["eblMove", "vrmMove"]) $(id).style.display = "none";
  const more = $("piGrid").closest("details");
  if (more) {
    more.open = true;
    more.querySelector("summary")?.remove();
  }
  const resets = document.createElement("div");
  resets.className = "cbtns";
  $("cuReset").textContent = "Reset C-UP";
  $("tmReset").textContent = "Reset TM";
  resets.append($("cuReset"), $("tmReset"));
  $("bDisp").appendChild(resets);

  // Gain, sea, rain, tune with the automatic controls beside them.
  const short: Record<string, string> = { gain: "GAIN", stc: "SEA", ftc: "RAIN", tuning: "TUNE" };
  const autoOf: Record<string, string> = { stc: "autoSea", ftc: "autoRain", tuning: "autoTune" };
  for (const id of ["gain", "stc", "ftc", "tuning"]) {
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
  autoAcq.querySelector("label")!.textContent = "Auto acquire";
  tgtRow.appendChild(autoAcq);
  $("cTgt").appendChild(tgtRow);
  $("cTgt").appendChild($("arpaMsg"));

  // Vectors by buttons: nothing to type.
  const setVecTime = (t: number): void => {
    const el = $<HTMLInputElement>("arpaVecT");
    el.value = String(Math.min(60, Math.max(1, t)));
    fire(el);
  };
  $("vecMode").addEventListener("click", (ev) => {
    const v = (ev.target as HTMLElement).closest("button")?.dataset["v"];
    if (!v) return;
    $<HTMLSelectElement>("arpaVec").value = v;
    fire($("arpaVec"));
  });
  $("vecGfx").addEventListener("click", (ev) => {
    const g = (ev.target as HTMLElement).closest("button")?.dataset["g"];
    if (!g) return;
    const el = $<HTMLSelectElement>("arpaGraphics");
    el.value = el.value === g ? "off" : g; // pressing the lit key switches the graphics off
    fire($("arpaGraphics"));
  });
  $("vecTime").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (!b) return;
    const now = Number($<HTMLInputElement>("arpaVecT").value) || 6;
    if (b.dataset["t"]) setVecTime(Number(b.dataset["t"]));
    else if (b.dataset["d"]) setVecTime(now + Number(b.dataset["d"]));
  });

  // Run / speed / radar standby stay in view (the same controls, moved).
  for (const id of ["run", "speed"]) $("cRun").appendChild($(id));
  // Radar ON / STANDBY and alarm acknowledge sit at the top, larger than the other keys.
  $("cTopSb").appendChild($("radarSb"));
  $("ackKey").addEventListener("click", () => $("arpaAckAll").click());
  const help = document.createElement("button");
  help.id = "cHelp";
  help.textContent = "HELP";
  help.addEventListener("click", () => {
    document.body.classList.toggle("help");
    help.classList.toggle("on", document.body.classList.contains("help"));
  });
  $("cRun").appendChild(help);
  $("cMenu").innerHTML = KEYS.map((k) => `<button data-key="${k.key}" class="${k.instructor ? "instr-only" : ""}">${k.label}</button>`).join("");

  const night = document.createElement("button");
  night.id = "nightKey";
  night.textContent = "DAY";
  night.addEventListener("click", () => {
    const on = document.body.classList.toggle("night");
    night.textContent = on ? "NIGHT" : "DAY";
  });
  $("cRun").insertBefore(night, help);

  let current = "own";
  const setMenu = (key: string): void => {
    const k = KEYS.find((x) => x.key === key) ?? KEYS[0]!;
    current = k.key;
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
  };
  $("cMenu").addEventListener("click", (ev) => {
    const key = (ev.target as HTMLElement).closest("button")?.dataset["key"];
    if (!key) return;
    // Pressing the lit key again goes back to the main panel; otherwise the menu's controls are brought into view.
    const target = Math.min($("cRun").offsetTop - side.offsetTop, side.scrollHeight - side.clientHeight);
    const again = key === current && target > 0 && side.scrollTop >= target - 4;
    setMenu(key);
    side.scrollTo({ top: again ? 0 : target });
  });
  setMenu("own");

  const cell = (label: string, value: string, cls = ""): string => `<span class="cl">${label}</span><b class="${cls}">${value}</b>`;
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
    const unacked = !app.roc && [...a.alarms, ...app.ais.alarms].some((x) => !x.acked);
    const t = Math.floor(w.time + 1e-6);
    const time = `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    const arpaOn = !app.roc && !s.standby;

    const mo = w.own.model;
    const rw = relativeWind(w);
    const side1 = (x: number, dead: number, f: (a: number) => string, zero: string): string => (Math.abs(x) < dead ? zero : `${x > 0 ? "S" : "P"} ${f(Math.abs(x))}`);
    for (const b of $("bandKeys").querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["b"] === w.radar.band);
    app.ringsOn = ringsOn;
    $("ringsKey").classList.toggle("on", ringsOn);
    put("cRings", ringsOn ? `${ringInterval(c.rangeNm)} NM` : "OFF");
    put("cTx", `<span class="${app.radarStandby ? "wn" : "ok"}">${app.radarStandby ? "STANDBY" : "TX"}</span> <span class="cl">${mo ? (mo.steering === "hand" ? "HAND" : "AUTO") : ""}</span>`);
    put("cAlarm", unacked ? `<span class="flash">ALARM</span>` : "");
    const pending = app.roc ? [] : [...a.alarms, ...app.ais.alarms].filter((x) => !x.acked);
    $("ackKey").classList.toggle("alarm", pending.length > 0);
    put("cTopAlarm", pending.length > 0 ? `<span class="no">${pending.length > 1 ? `${pending.length} ALARMS: ` : ""}${pending[pending.length - 1]!.text.replace(/</g, "&lt;")}</span>` : `<span class="cl">No alarm</span>`);
    $("radarSb").classList.toggle("stby", app.radarStandby);
    put("cOwn",
      cell("HDG", `${p3(measuredHeading(w))}°`, "big") + cell("STW", `${logSpeed(w).toFixed(1)} kn`, "big") +
      cell("COG", `${p3(cog.course)}°`) + cell("SOG", `${cog.speed.toFixed(1)} kn`) +
      cell("RUD", mo ? side1(mo.motion.rudder, 0.5, (x) => `${x.toFixed(0)}°`, "MID") : "---") + cell("ROT", mo ? side1(mo.motion.r * 60, 0.5, (x) => `${x.toFixed(0)}°/min`, "0") : "---") +
      cell("WIND", rw ? `R${String(Math.round(rw.fromRel) % 360).padStart(3, "0")} ${rw.speedKn.toFixed(0)} kn` : "CALM") + cell("TIME", time));

    // Cursor: range, true and relative bearing, taken from the existing cursor readout.
    const cur = ($("rCur").textContent ?? "").match(/([\d.]+) NM\s+T(\d+)\s+R(\d+)/);
    put("cCur", cell("RNG", cur ? `${cur[1]} NM` : "---", "big") + cell("BRG T", cur ? `${cur[2]}°` : "---", "big") + cell("BRG R", cur ? `${cur[3]}°` : "---", "big"));

    const free = freeLines();
    const val: Record<Line, string> = {
      ebl: app.ebl.on ? `${p3(app.ebl.bearing)}° T` : "OFF",
      vrm: app.vrm.on ? `${app.vrm.range.toFixed(2)} NM` : "OFF",
      ebl2: app.ebl2.on ? `${p3(app.ebl2.bearing)}° T` : "OFF",
      vrm2: app.vrm2.on ? `${app.vrm2.range.toFixed(2)} NM` : "OFF",
    };
    for (const l of lines) {
      put(`m_${l.line}`, val[l.line]);
      put(`ms_${l.line}`, val[l.line] === "OFF" ? "" : free[l.line] ? "MOVE" : "LOCK");
    }

    put("cTgtN", arpaOn ? `${a.activeCount()} / ${a.cfg.maxTracks}` : app.roc ? "ARPA OFF" : "STANDBY");
    for (const b of $("vecMode").querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["v"] === s.vectorMode);
    for (const b of $("vecTime").querySelectorAll<HTMLElement>("button[data-t]")) b.classList.toggle("on", Number(b.dataset["t"]) === s.vectorMinutes);
    for (const b of $("vecGfx").querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["g"] === s.graphics);
    put("cVecNow", arpaOn ? `${s.vectorMode === "true" ? "T" : "R"} ${s.vectorMinutes} min` : "---");
    put("cVecInfo",
      cell("STAB", arpaOn ? a.stabLabel().replace(" STAB", "") : "---") + cell("PAST", arpaOn && s.past.mode !== "off" ? `${s.past.mode === "true" ? "T" : "R"} ${s.past.points}x${s.past.intervalMin}m` : "OFF") +
      cell("CPA LIM", `${s.cpaLimitNm} NM`) + cell("TCPA LIM", `${s.tcpaLimitMin} min`));

    // Selected ARPA target: the values of its row in the target list (computed by the ARPA code).
    const tr = document.querySelector<HTMLElement>("#arpaRows tr.sel");
    const td = tr ? [...tr.querySelectorAll("td")].map((x) => x.textContent ?? "") : null;
    const [bcr, bct] = td ? (td[7] ?? "").split("/").map((x) => x.trim()) : ["", ""];
    const dash = "---";
    put("cTd", td
      ? cell("TGT", td[0] ?? dash, "big") + cell("STATE", td[8] ?? dash) +
        cell("BRG", `${td[1]}°`, "big") + cell("RNG", `${td[2]} NM`, "big") +
        cell("CPA", `${td[3]}`, "big") + cell("TCPA", `${td[4]}`, "big") +
        cell("CSE", `${td[5]}`, "big") + cell("SPD", `${td[6]}`, "big") +
        cell("BCR", bcr || dash) + cell("BCT", bct || dash)
      : `<span class="cl full">Acquire or select a target</span>`);

    // Selected AIS target: everything the AIS report carries, plus CPA/TCPA from it.
    const v = app.roc ? undefined : app.ais.targets(w, a, { cpaNm: s.cpaLimitNm, tcpaMin: s.tcpaLimitMin }).find((x) => x.report.id === app.ais.selected);
    put("cAis", v
      ? cell("NAME", v.report.name, "big span3") + cell("MMSI", v.report.mmsi) +
        cell("BRG", `${p3(v.bearing)}°`, "big") + cell("RNG", `${v.range.toFixed(2)} NM`, "big") +
        cell("CPA", v.cpa.opening ? "open" : `${v.cpa.cpa.toFixed(2)} NM`, "big") + cell("TCPA", v.cpa.tcpaMinutes === null ? dash : `${v.cpa.tcpaMinutes.toFixed(1)} min`, "big") +
        cell("COG", `${p3(v.report.cog)}°`, "big") + cell("SOG", `${v.report.sog.toFixed(1)} kn`, "big") +
        cell("HDG", `${p3(v.report.heading)}°`) + cell("ROT", "missing") +
        cell("STATUS", v.report.navStatus, "span3") + cell("AGE", `${Math.round(v.ageSec)} s`) +
        cell("STATE", v.lost ? "LOST" : v.dangerous ? "DANGER" : v.state === "activated" ? "ACTIVE" : "SLEEP", v.lost || v.dangerous ? "no" : "") +
        cell("RADAR", v.associatedTrack !== null ? `= TGT ${v.associatedTrack}` : "no track")
      : `<span class="cl full">Press Select, then click an AIS target (or use AIS LIST)</span>`);
  };

  return {
    tick,
    setMenu,
    followTab: (tab) => {
      const k = KEYS.find((x) => x.key === current);
      if (k && (k.tab === tab || (k.tab === "top" && tab === "radar"))) return;
      setMenu(tab === "radar" ? "scen" : tab === "arpa" ? "acq" : tab);
    },
  };
}
