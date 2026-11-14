import { ShipWindow, initShipWindow } from "./ship-window";
import { StationUi, initStationUi } from "./station-ui";
import { fromPolar, normalizeDeg, rotateVec, sub } from "../core/vec";
import { aisFilterLabel } from "../ais/index";
import { HARD_OVER_SECONDS, SHIP_TYPES, TELEGRAPH, shipTypeById } from "../core/shipmodel";
import { BAND_DATA, currentVelocity, pulseFor, RADAR_RANGES, SCENARIOS, Scenario, orderTarget, setShipModel, autoRainFtc, autoSeaStc, displayNmToWorld, worldToDisplayNm, measuredHeading, ownCogSog, tuningFactor, radarPower, radarTransmitting, setRadarTransmit, switchRadarOff, switchRadarOn, letGoAnchor, weighAnchor, ANCHOR_MAX_SOG_KN } from "../engine/index";
import { ExerciseDef, ExerciseKind, RocSession, exerciseById } from "../roc/index";
import { ARPA_EXERCISES, PLOTTING_EXERCISES, PLOT_RULES, RADAR_EXERCISES, ArpaExSession, ArpaExercise, Recorder, RemoteShip, Store, applyRemoteShips, remoteId, scenarioFromJson } from "../train/index";
import { initTrainUi } from "./train-ui";
import { initInstructorUi } from "./instructor-ui";
import { FAULT_IDS, Link } from "./link";
import { byId, esc } from "./dom";
import { ConsoleUi, initConsoleUi, radarKeyLabel } from "./console-ui";
import { AppState, advance, createApp, resetCourseUp, resetTrueMotion, setDisplayMode, setRange } from "./app";
import { initRocUi } from "./roc-ui";
import { initArpaUi } from "./arpa-ui";
import { drawPpi, radarGeometry, readoutAt } from "./view";
import { setDisplayPalette } from "./palette";
import { soundWhistle } from "./whistle";
import { FOG_SIGNAL_INTERVAL_S, SignalId, WHISTLE_SIGNALS, fogSignalFor, whistleFrequencyHz, whistleSignal } from "../core/signals";
import { formatLatLon, latLonOf } from "../core/nav";
import { MAX_ROUTE_WAYPOINTS } from "../core/route";
import { PanelUi, initPanel } from "./panel";
import { savePictures } from "./picture-store";
import { MAX_PICTURES, PICTURE_INTERVAL_SEC, PICTURE_QUALITY, PICTURE_SIZE_PX } from "../train/index";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = byId(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>("ppi");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
let app: AppState = createApp(SCENARIOS[0]!);
let cssSize = 600;

/** Local storage, when the browser allows it (some block it for pages opened as files). */
function browserStorage(): Storage | null {
  try {
    const k = "__radar_sim_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}
/**
 * This page is the instructor station when opened as radar-simulator.html#instructor (or /instructor from the
 * classroom server). Otherwise it is a student display, which has no instructor pages at all.
 */
const STATION = /(^|[#?&])instructor\b/i.test(location.hash + location.search) || /\/instructor\/?$/i.test(location.pathname);
let stationUi: StationUi | null = null;
const storage = browserStorage();
const store = new Store(storage);
const link = new Link();
/** Other displays' own ships, by station, for linked exercises. */
const remoteShips = new Map<string, RemoteShip>();
const session: { role: "student" | "instructor"; students: string[]; batchId: string } = { role: "student", students: [], batchId: "" };
const batchName = (): string => store.data.batches.find((b) => b.id === session.batchId)?.name ?? "";
const assignedIds = (): string[] => store.data.batches.find((b) => b.id === session.batchId)?.assigned ?? [];
const allScenarios = (): Scenario[] => [...SCENARIOS, ...store.data.scenarios];

function banner(text: string): void {
  $("banner").hidden = text === "";
  $("banner").textContent = text;
}

function startRecorder(id: string, title: string, kind: "arpa" | "roc"): void {
  app.pictures = [];
  app.nextPictureAt = 0;
  app.recorder = new Recorder({ exerciseId: id, title, kind, students: [...session.students], batch: batchName() }, app.world, new Date().toISOString());
}
function saveRecord(a: AppState): void {
  if (!a.recorder) return;
  a.recorder.sample(a.world, a.roc ? null : a.arpa);
  if (!store.addRecord(a.recorder.rec)) banner("The record could not be saved: the browser's storage is full or blocked. Download it from the result instead.");
  // A display sends the record to the instructor station too (it keeps its own copy).
  if (!STATION) link.sendRecord(a.recorder.rec);
  void savePictures(a.recorder.rec.id, a.pictures, store.data.records.map((r) => r.id));
  instrUi.refresh();
}

const rocUi = initRocUi({
  getApp: () => app,
  start: (id: ExerciseKind) => {
    const ex = exerciseById(id);
    loadScenario(ex.scenario, { roc: ex });
    setTab("roc");
  },
});

const trainUi = initTrainUi({
  getApp: () => app,
  start: (ex) => {
    loadScenario(ex.scenario, { arpa: ex });
    setTab("ex");
  },
  finished: (a, r) => {
    if (a.recorder) a.recorder.rec.result = r;
    saveRecord(a);
  },
  saveDebrief: (a, d) => {
    if (a.recorder) a.recorder.rec.debrief = d;
    saveRecord(a);
  },
  assigned: assignedIds,
  isInstructor: () => session.role === "instructor",
});

function setRole(r: "student" | "instructor"): void {
  session.role = r;
  if (r === "student") {
    app.routeEdit = null;
    app.showRoutes = false;
  }
  document.body.dataset["role"] = r;
  instrUi.refresh();
  trainUi.refreshList();
  showWho();
  // The instructor station logged out: back to its PIN screen (it never becomes a student display).
  if (STATION && r === "student") stationUi?.showLogin();
}

const instrUi = initInstructorUi({
  getApp: () => app,
  store,
  link,
  role: () => session.role,
  setRole,
  loadScenario: (sc) => {
    loadScenario(sc);
    setTab("radar");
  },
  scenariosChanged: () => fillScenarioList(),
  baseScenarios: () => [...allScenarios(), ...ARPA_EXERCISES.map((e) => e.scenario)],
  who: () => ({ students: session.students, batchId: session.batchId }),
  startLinkedHere: (json) => startLinked(json),
  station: STATION,
});

/** Start an exercise the instructor station asked for: an ARPA, radar or plotting exercise, or "roc-" and an ROC exercise. */
function startExerciseById(id: string): void {
  if (id.startsWith("roc-")) {
    const kind = id.slice(4) as ExerciseKind;
    try {
      const ex = exerciseById(kind);
      loadScenario(ex.scenario, { roc: ex });
      setTab("roc");
    } catch {
      // Not an exercise this display knows.
    }
    return;
  }
  const ex = [...ARPA_EXERCISES, ...RADAR_EXERCISES, ...PLOTTING_EXERCISES].find((e) => e.id === id);
  if (!ex) return;
  loadScenario(ex.scenario, { arpa: ex });
  setTab("ex");
  banner(`Instructor: exercise ${ex.number} started. Read the briefing, then press RUN.`);
}

// The instructor station keeps the records of every display; a display keeps the station's batches and scoring.
link.onRecord = (r) => {
  if (!STATION) return;
  const had = store.data.records.find((x) => x.id === r.id);
  // A display does not know the assessor's decision: keep the one made here.
  store.addRecord(had?.assessor && !r.assessor ? { ...r, assessor: had.assessor } : r);
  instrUi.recordsChanged();
};
link.onConfig = (c) => {
  if (STATION) return;
  const d = store.data;
  const now = JSON.stringify([d.batches, d.scoring, d.maxStudentsPerDisplay, d.targetHoursPerPair]);
  if (now === JSON.stringify([c.batches, c.scoring, c.maxStudentsPerDisplay, c.targetHoursPerPair])) return;
  d.batches = c.batches;
  d.scoring = c.scoring;
  d.maxStudentsPerDisplay = c.maxStudentsPerDisplay;
  d.targetHoursPerPair = c.targetHoursPerPair;
  store.save();
  trainUi.refreshList();
  // The login screen, if it is showing and nothing has been chosen yet, lists the batches again.
  if (!$("login").hidden && $<HTMLSelectElement>("lgBatch").value === "") openLogin();
  showWho();
};

/** Load the scenario, join the linked exercise, take a start position of this display's own, and run. */
function startLinked(scenarioJson: string): void {
  const r = scenarioFromJson(scenarioJson);
  if ("errors" in r) {
    banner(`Linked exercise could not start: ${r.errors[0] ?? "bad scenario"}`);
    return;
  }
  loadScenario(r.scenario);
  setTab("radar");
  setCheck("jointOn", true);
  setSelect("speed", "1");
  app.timeScale = 1;
  // A start bearing of this display's own, from its station code, 5 NM from the scenario start.
  const slot = (remoteId(link.station) * 47) % 360;
  setSlider("jointBrg", slot);
  setSlider("jointRng", 5);
  const start = r.scenario.own.pos ?? { e: 0, n: 0 };
  const d = fromPolar(slot, 5);
  app.world.own.pos = { e: start.e + d.e, n: start.n + d.n };
  resetTrueMotion(app);
  app.running = true;
  banner(`Linked exercise started: ${r.scenario.name}. Other own ships appear as targets.`);
}

/** A radio message heard (or sent) on this display: shown in the log and written to the exercise record. */
function heard(from: string, text: string): void {
  const t = Math.round(app.world.time);
  app.comms.push({ t, from, text });
  if (app.comms.length > 200) app.comms.shift();
  if (app.recorder) (app.recorder.rec.comms ??= []).push({ t, from, text });
  $("commLog").innerHTML = app.comms.slice(-30).map((m) => `<div>${String(Math.floor(m.t / 60)).padStart(2, "0")}:${String(m.t % 60).padStart(2, "0")} <b>${esc(m.from)}</b>: ${esc(m.text)}</div>`).join("");
  $("commLog").scrollTop = $("commLog").scrollHeight;
}

function showWho(): void {
  const names = session.students.length > 0 ? session.students.map(esc).join(" / ") : "free practice, no names";
  const hrs = session.students.length > 0 ? ` &nbsp; display time ${store.pairHours(session.students).toFixed(1)} h${store.data.targetHoursPerPair !== null ? ` of ${store.data.targetHoursPerPair} h` : ""}` : "";
  $("who").innerHTML = STATION ? (session.role === "instructor" ? "logged in" : "") : `${names}${batchName() ? ` (${esc(batchName())})` : ""}${hrs}${session.role === "instructor" ? ' &nbsp; <b style="color:var(--warn)">INSTRUCTOR</b>' : ""}`;
}

function fillScenarioList(): void {
  const scSel = $<HTMLSelectElement>("scenario");
  const cur = scSel.value;
  scSel.innerHTML = "";
  allScenarios().forEach((s, i) => scSel.add(new Option(s.name, String(i))));
  if (cur !== "" && Number(cur) < allScenarios().length) scSel.value = cur;
}

function openLogin(): void {
  const bs = $<HTMLSelectElement>("lgBatch");
  bs.innerHTML = '<option value="">(no batch)</option>' + store.data.batches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  bs.value = session.batchId;
  const names = (): void => {
    const b = store.data.batches.find((x) => x.id === bs.value);
    const n = store.data.maxStudentsPerDisplay;
    $("lgNames").innerHTML = Array.from({ length: n }, (_, i) => {
      const cur = session.students[i] ?? "";
      return `<label for="lgS${i}">Student ${i + 1}${i > 0 ? " (optional)" : ""}</label>` + (b && b.students.length > 0
        ? `<select id="lgS${i}"><option value=""></option>${b.students.map((s) => `<option ${s === cur ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`
        : `<input type="text" id="lgS${i}" value="${esc(cur)}">`);
    }).join("");
  };
  bs.onchange = names;
  names();
  $("lgMsg").textContent = storage ? "" : "This browser is not keeping data for this page, so records and batches will be lost when it is closed.";
  $("login").hidden = false;
}

const arpaUi = initArpaUi({
  getApp: () => app,
});

function resize(): void {
  const wrap = $("wrap");
  cssSize = Math.max(280, Math.round(wrap.getBoundingClientRect().width));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const num = (id: string): number => Number((byId(id) as HTMLInputElement).value);
const chk = (id: string): boolean => (byId(id) as HTMLInputElement).checked;
const sel = (id: string): string => (byId(id) as HTMLSelectElement).value;
const setText = (id: string, v: string): void => {
  $(id).textContent = v;
};
const pad3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");
const brg1 = (x: number): string => normalizeDeg(x).toFixed(1).padStart(5, "0");

/** Copy every control on the page into the simulation. */
function applyControls(): void {
  const w = app.world;
  const c = w.radar.controls;
  // Automatic anti-clutter and tuning: the set chooses the setting and the manual control is locked.
  const autos: [string, string, () => number][] = [
    ["autoSea", "stc", () => autoSeaStc(num("sea"))],
    ["autoRain", "ftc", () => (chk("rain") ? autoRainFtc(num("rainInt")) : 0)],
    ["autoTune", "tuning", () => Math.round(w.radar.tuningOptimum)],
  ];
  for (const [box, slider, value] of autos) {
    const on = chk(box);
    ($(slider) as HTMLInputElement).disabled = on;
    if (on) {
      setSlider(slider, value());
      setText(`${slider}V`, String(value()));
    }
  }
  c.gain = num("gain");
  c.tuning = num("tuning");
  c.stc = num("stc");
  c.ftc = num("ftc");
  c.brilliance = num("brill");
  w.env.seaState = num("sea");
  w.env.ducting = chk("duct");
  w.env.refraction = sel("refr") as NonNullable<typeof w.env.refraction>;
  w.env.interference = chk("interf");
  c.pulse = sel("pulse") as NonNullable<typeof c.pulse>;
  c.echoStretch = chk("echoStretch");
  c.echoAverage = chk("echoAvg");
  c.interferenceRejection = chk("irOn");
  app.pmOn = chk("pmOn");
  w.env.current = { set: num("curSet"), drift: num("curDrift") };
  if (num("tideRate") > 0) w.env.tidal = { floodSet: normalizeDeg(num("tideSet") || 0), maxRateKn: num("tideRate"), hoursAfterSlackAtStart: num("tideHrs") || 0 };
  else delete w.env.tidal;
  // Own ship: type, steering mode (autopilot course or helm by hand), engine order, wind.
  const simple = sel("shipType") === "simple";
  if (simple) {
    // Exercise ship: fixed rates of turn and speed change, as the plotting exercises state them. No rudder, no wind effect.
    delete w.own.model;
    w.own.turnRateDegPerSec = PLOT_RULES.turnDegPerMin / 60;
    w.own.accelKnPerSec = PLOT_RULES.speedKnPerMin / 60;
    setSteering(false);
  } else if (!w.own.model || w.own.model.typeId !== sel("shipType")) setShipModel(w, sel("shipType"));
  ($("steerHand") as HTMLButtonElement).disabled = simple;
  const hand = $("steerHand").classList.contains("on");
  if (w.own.model) {
    w.own.model.steering = hand ? "hand" : "auto";
    w.own.model.rudderOrder = num("helm");
  }
  if (!hand) w.own.ordered.course = num("ordCourse");
  ($("ordCourse") as HTMLInputElement).disabled = hand;
  const helm = num("helm");
  setText("helmV", `${helm > 0 ? "+" : ""}${helm}°`);
  for (const b of $("helmScale").querySelectorAll<HTMLButtonElement>("button")) {
    b.disabled = !hand;
    b.classList.toggle("on", hand && b.dataset["v"] !== undefined && Number(b.dataset["v"]) === helm);
  }
  w.own.ordered.speed = num("ordSpeed");
  if (num("windSpd") > 0) w.env.wind = { from: normalizeDeg(num("windFrom") || 0), speedKn: num("windSpd") };
  else delete w.env.wind;
  {
    const st = shipTypeById(sel("shipType"));
    const now = TELEGRAPH.find((t) => Math.abs(Math.round(t.fraction * st.maxSpeedKn * 2) / 2 - w.own.ordered.speed) < 0.01);
    for (const b of $("telegraph").querySelectorAll<HTMLElement>("button")) b.classList.toggle("on", b.dataset["k"] === now?.key);
    setText("shipInfo", simple
      ? `Exercise ship: turns at ${PLOT_RULES.turnDegPerMin}°/min and changes speed at ${PLOT_RULES.speedKnPerMin} kn/min, whatever the speed. Autopilot only.`
      : `${st.name}: sea full ${st.maxSpeedKn} kn, length ${st.lengthM} m. ${st.basis}`);
  }
  app.ebl2 = { on: chk("ebl2On"), bearing: num("ebl2Brg") };
  app.vrm2 = { on: chk("vrm2On"), range: num("vrm2Rng") };
  setText("ebl2BrgV", brg1(app.ebl2.bearing));
  setText("vrm2RngV", app.vrm2.range.toFixed(2));
  const cut = (id: string): number | null => {
    const v = (byId(id) as HTMLInputElement).value.trim();
    return v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v));
  };
  app.pi = [0, 1, 2, 3].map((i) => ({ on: chk(`pi${i}On`), bearing: normalizeDeg(num(`pi${i}Brg`) || 0), range: num(`pi${i}Rng`) || 0, ahead: cut(`pi${i}Ahd`), astern: cut(`pi${i}Ast`) }));
  w.radar.band = sel("band") as "X" | "S";
  for (const b of document.querySelectorAll<HTMLElement>("#bandKeys button")) b.classList.toggle("on", b.dataset["b"] === w.radar.band);
  {
    const bd = BAND_DATA[w.radar.band];
    const pl = pulseFor(c.rangeNm, c.pulse);
    setText("bandInfo", `${bd.name}: ${bd.frequencyGHz} GHz, ${bd.wavelengthCm} cm, beam ${bd.beamwidthDeg}°. ${pl.name} pulse ${pl.microseconds} µs, PRF ${pl.prfHz}/s: range discrimination ${Math.round(pl.rangeDiscriminationNm * 1852)} m, minimum range ${Math.round(pl.minRangeNm * 1852)} m.`);
  }
  app.ebl = { on: chk("eblOn"), bearing: num("eblBrg") };
  app.vrm = { on: chk("vrmOn"), range: num("vrmRng") };
  app.trailMode = sel("trails") as AppState["trailMode"];
  app.trailMinutes = Number(sel("trailMin"));
  app.showShadow = chk("shadow");
  app.showNames = chk("names");
  app.sternLine = chk("sternLine");
  app.antennaMark = chk("antMark");
  setText("gainV", String(c.gain));
  setText("tuningV", String(c.tuning));
  setText("stcV", String(c.stc));
  setText("ftcV", String(c.ftc));
  setText("brillV", String(c.brilliance));
  setText("seaV", String(w.env.seaState));
  setText("ordCourseV", pad3(w.own.ordered.course));
  setText("ordSpeedV", String(w.own.ordered.speed));
  setText("eblBrgV", brg1(app.ebl.bearing));
  setText("vrmRngV", app.vrm.range.toFixed(2));
  setText("rainIntV", String(num("rainInt")));
  if (chk("rain")) {
    if (w.env.rain.length === 0) w.env.rain = [{ center: { e: 0, n: 0 }, radius: 2.5, intensity: 0.8 }];
    w.env.rain[0]!.intensity = num("rainInt") / 100;
  } else {
    w.env.rain = [];
  }
}

function placeRainSquall(): void {
  const w = app.world;
  if (w.env.rain.length > 0) {
    const d = fromPolar(w.own.heading, 3);
    w.env.rain[0]!.center = { e: w.own.pos.e + d.e, n: w.own.pos.n + d.n };
  }
}

function setSlider(id: string, v: number): void {
  (byId(id) as HTMLInputElement).value = String(v);
}
function setSelect(id: string, v: string): void {
  (byId(id) as HTMLSelectElement).value = v;
}
function setCheck(id: string, v: boolean): void {
  (byId(id) as HTMLInputElement).checked = v;
}

type Tab = "radar" | "roc" | "arpa" | "ex" | "instr";
const TABS: Record<Tab, [string, string]> = {
  radar: ["paneRadar", "tabRadar"], roc: ["paneRoc", "tabRoc"], arpa: ["paneArpa", "tabArpa"], ex: ["paneEx", "tabEx"], instr: ["paneInstr", "tabInstr"],
};
let consoleUi: ConsoleUi | null = null;
let shipWin: ShipWindow | null = null;
function setSteering(hand: boolean): void {
  $("steerHand").classList.toggle("on", hand);
  $("steerAuto").classList.toggle("on", !hand);
}
function setTab(tab: Tab): void {
  // While the ship control window is open the exercises are in it: it shows them, and the menu is not opened on them.
  const away = shipWin?.isOpen() && (tab === "ex" || tab === "roc");
  for (const [k, [pane, btn]] of Object.entries(TABS)) {
    if (!shipWin?.holds($(pane))) $(pane).hidden = k !== tab;
    $(btn).classList.toggle("on", k === tab);
  }
  if (away) shipWin!.focus(tab as "ex" | "roc");
  else consoleUi?.followTab(tab);
}

/** The AIS display was on until a manual plotting exercise switched it off: it is switched on again for the next scenario. */
let aisOffByExercise = false;

function loadScenario(sc: Scenario, opts: { roc?: ExerciseDef; arpa?: ArpaExercise } = {}): void {
  const ex = opts.roc;
  const keepRoutes = app.showRoutes && session.role === "instructor";
  app = createApp(sc);
  app.showRoutes = keepRoutes;
  const a = app;
  // Exercises that state own ship's rates use the exercise ship; anything else goes back to a ship model.
  if (opts.arpa?.ownRates) setSelect("shipType", "simple");
  else if (sel("shipType") === "simple") setSelect("shipType", SHIP_TYPES[0]!.id);
  if (sel("shipType") !== "simple") setShipModel(a.world, sel("shipType"));
  setSlider("ordCourse", sc.own.heading);
  setSlider("ordSpeed", sc.own.speed);
  setSlider("helm", 0);
  setSteering(false);
  setSlider("windSpd", sc.env.wind?.speedKn ?? 0);
  setSlider("windFrom", sc.env.wind?.from ?? 0);
  setSlider("sea", sc.env.seaState ?? 3);
  setSlider("curSet", sc.env.current?.set ?? 0);
  setSlider("curDrift", sc.env.current?.drift ?? 0);
  setSlider("tideRate", sc.env.tidal?.maxRateKn ?? 0);
  setSlider("tideSet", sc.env.tidal?.floodSet ?? 0);
  setSlider("tideHrs", sc.env.tidal?.hoursAfterSlackAtStart ?? 0);
  setSlider("gain", 50);
  setSlider("stc", 0);
  setSlider("ftc", 0);
  setSlider("brill", 70);
  const rain0 = sc.env.rain?.[0];
  setCheck("rain", !!rain0);
  if (rain0) setSlider("rainInt", Math.round(rain0.intensity * 100));
  setCheck("duct", sc.env.ducting ?? false);
  setSelect("refr", sc.env.refraction ?? "standard");
  setCheck("interf", sc.env.interference ?? false);
  setSelect("pulse", "auto");
  for (const id of ["echoStretch", "echoAvg", "irOn", "pmOn"]) setCheck(id, false);
  setCheck("eblOn", false);
  setCheck("vrmOn", false);
  eblFree = false;
  vrmFree = false;
  ebl2Free = false;
  vrm2Free = false;
  pickMode = null;
  setCheck("ebl2On", false);
  setCheck("vrm2On", false);
  for (let i = 0; i < 4; i++) setCheck(`pi${i}On`, false);
  setSelect("band", "X");
  setSelect("trails", "off");
  setSelect("orient", "north-up");
  setSelect("motion", "relative");
  setSelect("stab", "ground");
  setText("run", "Pause");
  if (ex) {
    // Exercises start with the receiver tuned and the clock stopped so the student can set up.
    setSlider("tuning", app.world.radar.tuningOptimum);
    app.roc = new RocSession(ex, app.world);
    app.onRocFinish = () => rocUi.showFinish(a);
    app.running = false;
    setText("run", "Run");
    setRange(app, ex.rangeNm);
    setSelect("range", String(ex.rangeNm));
    startRecorder(`roc-${ex.id}`, `ROC: ${ex.name}`, "roc");
    app.onRocFinish = () => {
      rocUi.showFinish(a);
      if (a.recorder) a.recorder.rec.summary = $("rocResult").innerText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30);
      saveRecord(a);
    };
  } else if (opts.arpa) {
    // ARPA exercises start tuned and paused, on the exercise's range scale.
    setSlider("tuning", app.world.radar.tuningOptimum);
    app.running = false;
    setText("run", "Run");
    setRange(app, opts.arpa.rangeNm);
    setSelect("range", String(opts.arpa.rangeNm));
    setText("desc", opts.arpa.aim);
  } else {
    setSlider("tuning", 50);
    setSelect("range", "6");
    setText("desc", sc.description);
  }
  app.timeScale = Number(sel("speed"));
  applyControls();
  // A manual plotting exercise starts with the AIS display off (it stays locked off until Finish: see aisLocked).
  const aisBox = $<HTMLInputElement>("aisOn");
  if (opts.arpa?.aisOff) {
    if (aisBox.checked) aisOffByExercise = true;
    aisBox.checked = false;
  } else if (aisOffByExercise) {
    aisBox.checked = true;
    aisOffByExercise = false;
  }
  rocUi.onAppChanged(app);
  arpaUi.onAppChanged(app);
  if (opts.arpa) {
    app.arpaEx = new ArpaExSession(opts.arpa, app.world, app.arpa, JSON.parse(JSON.stringify(store.data.scoring)) as typeof store.data.scoring);
    if (opts.arpa.startsSwitchedOff) {
      // The exercise has left the radar off and badly set: show the controls as they are, with the automatic ones off.
      const c = app.world.radar.controls;
      for (const id of ["autoSea", "autoRain", "autoTune"]) setCheck(id, false);
      setSlider("gain", c.gain);
      setSlider("stc", c.stc);
      setSlider("ftc", c.ftc);
      setSlider("tuning", c.tuning);
      setSlider("brill", c.brilliance);
      setCheck("echoStretch", !!c.echoStretch);
      setCheck("echoAvg", !!c.echoAverage);
      setCheck("irOn", !!c.interferenceRejection);
      setSelect("pulse", c.pulse ?? "auto");
      setCheck("pmOn", false);
      applyControls();
      app.radarStandby = true;
      app.hits = [];
    }
    startRecorder(opts.arpa.id, `${opts.arpa.group ?? "ARPA"} ${opts.arpa.number}: ${opts.arpa.title}`, "arpa");
  }
  trainUi.onAppChanged(app);
  $("radarSb").textContent = "RADAR: ON";
}

function setup(): void {
  const scSel = $<HTMLSelectElement>("scenario");
  fillScenarioList();
  const rSel = $<HTMLSelectElement>("range");
  for (const r of RADAR_RANGES) rSel.add(new Option(`${r} NM`, String(r)));
  rSel.value = "6";

  scSel.addEventListener("change", () => loadScenario(allScenarios()[Number(scSel.value)] ?? SCENARIOS[0]!));
  $("reset").addEventListener("click", () => loadScenario(allScenarios()[Number(scSel.value)] ?? SCENARIOS[0]!));
  for (const [k, [, btn]] of Object.entries(TABS)) $(btn).addEventListener("click", () => setTab(k as Tab));
  // DEFAULT SETTINGS: the known starting state of IEC 62388:2013, Table 35, chosen by one action and confirmed.
  // Gain, the clutter controls and tuning are left as they are (the table allows that); maps keep their last setting.
  $("radarDefault").addEventListener("click", () => {
    if (!confirm("Put the radar and ARPA controls to the standard default settings?")) return;
    const fire = (id: string): void => {
      const el = $(id);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const set = (id: string, v: string): void => {
      ($(id) as HTMLInputElement).value = v;
      fire(id);
    };
    const check = (id: string, v: boolean): void => {
      const el = $(id) as HTMLInputElement;
      if (el.checked !== v) {
        el.checked = v;
        fire(id);
      }
    };
    set("band", "X");
    set("range", "6");
    if ($("ringsKey").classList.contains("on")) $("ringsKey").click(); // fixed range rings off
    check("eblOn", true);
    check("vrmOn", true);
    set("vrmRng", "0.25");
    check("ebl2On", false);
    check("vrm2On", false);
    for (const i of [0, 1, 2, 3]) check(`pi${i}On`, false);
    set("orient", "north-up");
    set("motion", "true");
    set("stab", "ground");
    set("trails", "true");
    set("trailMin", "6");
    set("pastMode", "off");
    set("arpaVec", "relative");
    set("arpaVecT", "6");
    set("arpaLogMode", "gnss"); // ground stabilised: course and speed over the ground
    check("arpaAuto", false);
    for (const el of document.querySelectorAll<HTMLInputElement>('input[id^="z_"][id$="_on"]')) check(el.id, false); // zones off
    check("aisOn", true);
    set("aisAssoc", "ais");
    set("arpaCpaLim", "2");
    set("arpaTcpaLim", "12");
    $("tmReset").click(); // own ship placed for the view ahead
    $("radarDefaultMsg").textContent = "Default settings set.";
    app.recorder?.note(app.world, "Radar controls put to the default settings.");
  });
  // Two stored sets of user settings (IEC 62388 13.5.1), each recalled after a confirmation.
  const USER_SETTING_IDS = [
    "band", "range", "orient", "motion", "stab", "trails", "trailMin", "arpaVec", "arpaVecT", "arpaGraphics", "pastMode", "pastPts", "pastInt",
    "gain", "stc", "ftc", "tuning", "brill", "autoSea", "autoRain", "autoTune", "pulse", "echoStretch", "echoAvg", "irOn",
    "arpaCpaLim", "arpaTcpaLim", "arpaVecSup", "arpaLostWarn", "aisOn", "aisLost", "aisFilter", "aisFiltCpa", "aisFiltTcpa", "aisFiltSog", "aisFiltCls", "aisAutoAct",
  ];
  const showUserSettings = (): void => {
    for (const i of [0, 1]) $(`usInfo${i}`).textContent = store.data.userSettings[i] ? "stored" : "empty";
  };
  showUserSettings();
  for (const i of [0, 1]) {
    document.querySelector(`[data-us-save="${i}"]`)!.addEventListener("click", () => {
      if (store.data.userSettings[i] && !confirm(`Replace user setting ${i + 1} with the present settings?`)) return;
      const rec: Record<string, string | boolean> = { rings: $("ringsKey").classList.contains("on") };
      for (const id of USER_SETTING_IDS) {
        const el = byId(id) as HTMLInputElement | null;
        if (el) rec[id] = el.type === "checkbox" ? el.checked : el.value;
      }
      store.data.userSettings[i] = rec;
      store.save();
      showUserSettings();
    });
    document.querySelector(`[data-us-load="${i}"]`)!.addEventListener("click", () => {
      const rec = store.data.userSettings[i];
      if (!rec) {
        $(`usInfo${i}`).textContent = "empty: nothing to recall";
        return;
      }
      if (!confirm(`Recall user setting ${i + 1}?`)) return;
      for (const id of USER_SETTING_IDS) {
        const el = byId(id) as HTMLInputElement | null;
        const v = rec[id];
        if (!el || v === undefined) continue;
        if (el.type === "checkbox") el.checked = v === true;
        else el.value = String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (typeof rec["rings"] === "boolean" && $("ringsKey").classList.contains("on") !== rec["rings"]) $("ringsKey").click();
      $(`usInfo${i}`).textContent = "recalled";
      app.recorder?.note(app.world, `User setting ${i + 1} recalled.`);
    });
  }
  // The RADAR key: switches on from cold (the warm-up then runs), and moves between standby and transmit.
  $("radarSb").addEventListener("click", () => {
    const w = app.world;
    const p = radarPower(w);
    if (p === "warming") return; // nothing to do until the warm-up is over
    if (p === "off") switchRadarOn(w);
    else setRadarTransmit(w, p === "standby");
    app.radarStandby = !radarTransmitting(w);
    if (app.radarStandby) app.hits = [];
    else app.arpa.settings.standby = false;
    $("radarSb").textContent = radarKeyLabel(w);
    app.recorder?.note(w, p === "off" ? "Radar switched on: warming up." : app.radarStandby ? "Radar to standby." : "Radar to transmit.");
  });
  $("radarOff").addEventListener("click", () => {
    if (!confirm("Switch the radar off? It will need to warm up again before it can transmit.")) return;
    switchRadarOff(app.world);
    app.radarStandby = true;
    app.hits = [];
    app.recorder?.note(app.world, "Radar switched off.");
  });
  // Students at this display.
  $("lgStart").addEventListener("click", () => {
    const names = [...$("lgNames").querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")].map((e) => e.value.trim()).filter(Boolean);
    if (names.length === 0) {
      $("lgMsg").textContent = "Enter at least one name, or choose free practice.";
      return;
    }
    session.students = [...new Set(names)];
    session.batchId = sel("lgBatch");
    $("login").hidden = true;
    showWho();
    trainUi.refreshList();
  });
  $("lgSkip").addEventListener("click", () => {
    session.students = [];
    session.batchId = "";
    $("login").hidden = true;
    showWho();
    trainUi.refreshList();
  });
  $("whoChange").addEventListener("click", () => (STATION ? setRole("student") : openLogin()));
  if (STATION) $("whoChange").title = "Log out of the instructor station";
  // Instructor commands from the monitor.
  link.onCommand = (c) => {
    // The instructor station takes no orders; it only hears the radio.
    if (STATION && c.cmd !== "radio") return;
    if (c.cmd === "startExercise") {
      startExerciseById(c.id);
      return;
    }
    if (c.cmd === "faults") {
      // Only the fault controls, set as the FAULTS key would set them on this display.
      for (const id of FAULT_IDS) {
        const v = c.values[id];
        const el = byId<HTMLInputElement>(id);
        if (!el || v === undefined) continue;
        if (el.type === "checkbox") {
          if (el.checked !== !!v) {
            el.checked = !!v;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (typeof v === "number" && Number.isFinite(v)) {
          el.value = String(v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      applyControls();
      app.recorder?.note(app.world, "INSTRUCTOR (remote): faults set.", true);
      return;
    }
    if (c.cmd === "pause") app.running = false;
    if (c.cmd === "run") app.running = true;
    if (c.cmd === "message") banner(`Instructor: ${c.text}`);
    if (c.cmd === "startLinked") startLinked(c.scenarioJson);
    if (c.cmd === "radio") {
      if (c.station !== link.station) heard(c.from, c.text);
      return;
    }
    if (c.cmd === "weather") {
      setSlider("sea", c.seaState);
      setCheck("rain", c.rain);
      setCheck("duct", c.ducting);
      setCheck("interf", c.interference);
      applyControls();
      placeRainSquall();
    }
    if (c.cmd === "fault") app.world.sensors.target = { gyroErrorDeg: c.gyroDeg, logErrorKn: c.logKn };
    if (c.cmd === "target") {
      const t = app.world.targets.find((x) => x.id === c.id);
      if (t) orderTarget(t, { ...(c.course !== undefined ? { course: c.course } : {}), ...(c.speed !== undefined ? { speed: c.speed } : {}) });
    }
    if (c.cmd !== "message") app.recorder?.note(app.world, `INSTRUCTOR (remote): ${c.cmd}.`, true);
  };
  $("banner").addEventListener("click", () => banner(""));
  // Communications: typed radio messages to every station; the instructor can speak as any vessel.
  const sendComm = (): void => {
    const text = ($("commText") as HTMLInputElement).value.trim();
    if (!text) return;
    const as = session.role === "instructor" ? ($("commAs") as HTMLInputElement).value.trim() : "";
    const from = as || (session.students.length > 0 ? `OS ${session.students.join("/")}` : `Station ${link.station}`);
    link.sendCommand({ to: "all", cmd: "radio", station: link.station, from, text });
    heard(from, text);
    ($("commText") as HTMLInputElement).value = "";
  };
  $("commSend").addEventListener("click", sendComm);
  $("commText").addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key === "Enter") sendComm();
  });
  // Linked own ships.
  link.addStatusListener((s) => {
    if (s.joint && s.scenario === app.scenario.id) remoteShips.set(s.station, { station: s.station, name: `OS ${s.students.join("/") || s.station}`, e: s.own.e, n: s.own.n, cog: s.own.cog, sog: s.own.sog, at: Date.now() });
    else remoteShips.delete(s.station);
  });
  $("jointOn").addEventListener("change", () => {
    if (chk("jointOn")) {
      setSelect("speed", "1");
      app.timeScale = 1;
    } else applyRemoteShips(app.world, [], Date.now());
  });
  $("jointPlace").addEventListener("click", () => {
    const start = app.scenario.own.pos ?? { e: 0, n: 0 };
    const d = fromPolar(num("jointBrg") || 0, Math.max(0, num("jointRng") || 0));
    app.world.own.pos = { e: start.e + d.e, n: start.n + d.n };
    app.trails.clear();
    app.arpa.cancelAll(app.world);
    resetTrueMotion(app);
  });
  $("run").addEventListener("click", () => {
    app.advanceTo = null;
    app.running = !app.running;
    $("run").textContent = app.running ? "Pause" : "Run";
  });
  $("speed").addEventListener("change", () => {
    app.timeScale = Number(sel("speed"));
  });
  rSel.addEventListener("change", () => setRange(app, Number(rSel.value)));
  // Head-up cannot be used in true motion: when one choice changes the other, its box shows the change.
  const showModes = (): void => {
    setSelect("orient", app.display.orientation);
    setSelect("motion", app.display.motion);
  };
  $("orient").addEventListener("change", () => {
    setDisplayMode(app, { orientation: sel("orient") as AppState["display"]["orientation"] });
    showModes();
  });
  $("motion").addEventListener("change", () => {
    setDisplayMode(app, { motion: sel("motion") as AppState["display"]["motion"] });
    showModes();
  });
  $("stab").addEventListener("change", () => {
    setDisplayMode(app, { stabilisation: sel("stab") as AppState["display"]["stabilisation"] });
  });
  $("cuReset").addEventListener("click", () => resetCourseUp(app));
  $("tmReset").addEventListener("click", () => {
    resetTrueMotion(app);
  });
  // Display mode (day / night palette), kept on this computer.
  const applyMode = (mode: "day" | "night"): void => {
    document.body.dataset["mode"] = mode;
    setDisplayPalette(mode);
    for (const b of document.querySelectorAll<HTMLElement>("#modeKeys button")) b.classList.toggle("on", b.dataset["m"] === mode);
    if (store.data.displayMode !== mode) {
      store.data.displayMode = mode;
      store.save();
    }
  };
  $("modeKeys").addEventListener("click", (ev) => {
    const mKey = (ev.target as HTMLElement).closest("button")?.dataset["m"];
    if (mKey === "day" || mKey === "night") applyMode(mKey);
  });
  applyMode(store.data.displayMode === "night" ? "night" : "day");

  // Whistle signals (COLREG rules 34 and 35). The pitch follows the ship's length.
  const whistleNow = (id: SignalId, auto = false): void => {
    const sig = whistleSignal(id);
    const type = app.world.own.model ? shipTypeById(app.world.own.model.typeId) : null;
    const heard = soundWhistle(sig, whistleFrequencyHz(type?.lengthM ?? 150));
    if (!heard && !auto) {
      setText("whistleMsg", "A signal is still sounding, or this browser cannot play sound.");
      return;
    }
    setText("whistleMsg", `${auto ? "Automatic: " : ""}${sig.label.toLowerCase()} blast${sig.blasts.length > 1 ? "s" : ""}. ${sig.meaning}.`);
    app.recorder?.note(app.world, `Sound signal${auto ? " (automatic)" : ""}: ${sig.label.toLowerCase()}. ${sig.meaning}.`, false);
  };
  $("whistleKeys").innerHTML = WHISTLE_SIGNALS.map((x) => `<button data-s="${x.id}">${x.label}<small>${x.meaning.replace(/ \(Rule \d+\)/, "")}</small></button>`).join("");
  $("whistleKeys").addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement).closest("button")?.dataset["s"];
    if (id) whistleNow(id as SignalId);
  });
  fogTick = (): void => {
    if (!($("fogAuto") as HTMLInputElement).checked) {
      nextFog = null;
      return;
    }
    const t = app.world.time;
    if (nextFog === null || t < nextFog - FOG_SIGNAL_INTERVAL_S) nextFog = t; // just switched on, or a new scenario
    if (t >= nextFog) {
      whistleNow(fogSignalFor(app.world.own.speedThroughWater), true);
      nextFog = t + FOG_SIGNAL_INTERVAL_S;
    }
  };

  // Steering gear: telemotor 1 always runs; telemotor 2 can be started as well (the rudder then moves faster).
  $("teleKeys").addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement).closest("button")?.dataset["u"] !== "2") return;
    const mo = app.world.own.model;
    if (mo) mo.steeringUnits = mo.steeringUnits === 2 ? 1 : 2;
  });
  // Own ship data is shown only when asked for.
  $("osToggle").addEventListener("click", () => {
    const off = $("osSection").classList.toggle("off");
    $("osToggle").classList.toggle("on", !off);
  });

  // Own ship data typed in by the user (fixed particulars and voyage data), kept on this computer.
  const os = store.data.ownShip;
  const osFields: [string, keyof typeof os][] = [["osName", "name"], ["osCall", "callSign"], ["osImo", "imo"], ["osMmsi", "mmsi"], ["osHaz", "hazardous"], ["osDest", "destination"], ["osEta", "eta"]];
  for (const [id, k] of osFields) {
    const el = $(id) as HTMLInputElement | HTMLSelectElement;
    el.value = String(os[k] ?? "");
    el.addEventListener("change", () => {
      (os[k] as string) = el.value.trim();
      store.save();
    });
  }
  $("osDraught").addEventListener("change", () => {
    const v = Number(($("osDraught") as HTMLInputElement).value);
    os.draughtM = Number.isFinite(v) && v > 0 ? v : null;
    store.save();
  });
  // The radar antenna's place from the reference point: it only places the antenna mark on the outline.
  const antIn = (id: string, k: "antennaAheadM" | "antennaStbdM", limit: number): void => {
    const el = $(id) as HTMLInputElement;
    el.value = String(os[k] ?? 0);
    el.addEventListener("change", () => {
      const v = Number(el.value);
      os[k] = Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0;
      el.value = String(os[k]);
      app.antennaOffsetM = { ahead: os.antennaAheadM ?? 0, stbd: os.antennaStbdM ?? 0 };
      store.save();
    });
  };
  antIn("osAntAhead", "antennaAheadM", 400);
  antIn("osAntStbd", "antennaStbdM", 60);
  app.antennaOffsetM = { ahead: os.antennaAheadM ?? 0, stbd: os.antennaStbdM ?? 0 };

  // Own ship: ship types, steering mode, telegraph.
  $("shipType").innerHTML = SHIP_TYPES.map((t) => `<option value="${t.id}">${t.name}</option>`).join("") + `<option value="simple">Exercise ship (${PLOT_RULES.turnDegPerMin}°/min, ${PLOT_RULES.speedKnPerMin} kn/min)</option>`;
  $("telegraph").innerHTML = TELEGRAPH.map((t) => `<button data-k="${t.key}">${t.label}</button>`).join("");
  $("telegraph").addEventListener("click", (ev) => {
    const k = (ev.target as HTMLElement).closest("button")?.dataset["k"];
    const t = TELEGRAPH.find((x) => x.key === k);
    if (!t) return;
    setSlider("ordSpeed", Math.round(t.fraction * shipTypeById(sel("shipType")).maxSpeedKn * 2) / 2);
    applyControls();
  });
  // Hand steering scale: -35 to +35 in steps of 5 (minus is port), with - and + at the ends for 1 degree.
  $("helmScale").innerHTML = `<button data-d="-1" title="1° more to port">−</button>` +
    [-35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35].map((v) => `<button data-v="${v}" class="${v === 0 ? "zero" : ""}">${v > 0 ? "+" : ""}${v}</button>`).join("") +
    `<button data-d="1" title="1° more to starboard">+</button>`;
  $("helmScale").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (!b || b.disabled) return;
    const v = b.dataset["v"] !== undefined ? Number(b.dataset["v"]) : num("helm") + Number(b.dataset["d"]);
    setSlider("helm", Math.max(-35, Math.min(35, v)));
    applyControls();
  });
  for (const [id, d] of [["engDn", -1], ["engUp", 1]] as const) {
    $(id).addEventListener("click", () => {
      setSlider("ordSpeed", Math.max(-10, Math.min(25, num("ordSpeed") + d)));
      applyControls();
    });
  }
  // Anchor: let go when nearly stopped, or weigh.
  $("anchorKey").addEventListener("click", () => {
    const w = app.world;
    if (w.own.anchor) {
      weighAnchor(w);
      setText("anchorNow", "Anchor aweigh.");
      app.recorder?.note(w, "Anchor weighed.");
    } else if (letGoAnchor(w)) {
      setSlider("ordSpeed", 0);
      applyControls();
      setText("anchorNow", "Anchor let go.");
      app.recorder?.note(w, "Anchor let go.");
    } else setText("anchorNow", `Too much way on: the anchor can be let go below ${ANCHOR_MAX_SOG_KN} kn over the ground.`);
  });
  $("steerAuto").addEventListener("click", () => {
    // Back to the autopilot: it holds the present heading, rudder order cleared.
    setSlider("ordCourse", Math.round(measuredHeading(app.world)) % 360);
    setSlider("helm", 0);
    setSteering(false);
    applyControls();
  });
  $("steerHand").addEventListener("click", () => {
    setSteering(true);
    applyControls();
  });
  $("rain").addEventListener("change", () => {
    applyControls();
    placeRainSquall();
  });

  // EBL / VRM: when ticked they are "free" and follow the cursor; a double click or double tap locks them.
  const setFree = (line: "ebl" | "vrm" | "ebl2" | "vrm2", free: boolean): void => {
    if (line === "ebl") eblFree = free;
    else if (line === "vrm") vrmFree = free;
    else if (line === "ebl2") ebl2Free = free;
    else vrm2Free = free;
    showMeasureState();
  };
  $("eblOn").addEventListener("change", () => setFree("ebl", chk("eblOn")));
  $("vrmOn").addEventListener("change", () => setFree("vrm", chk("vrmOn")));
  $("ebl2On").addEventListener("change", () => setFree("ebl2", chk("ebl2On")));
  $("vrm2On").addEventListener("change", () => setFree("vrm2", chk("vrm2On")));
  $("eblBrg").addEventListener("input", () => setFree("ebl", false));
  $("vrmRng").addEventListener("input", () => setFree("vrm", false));
  $("eblMove").addEventListener("click", () => {
    setCheck("eblOn", true);
    setFree("ebl", true);
    applyControls();
  });
  $("vrmMove").addEventListener("click", () => {
    setCheck("vrmOn", true);
    setFree("vrm", true);
    applyControls();
  });

  // More measuring tools: EBL 2, VRM 2, parallel index lines, heading line off, off-centre, band.
  $("piGrid").innerHTML = "<span></span><span>Bearing °</span><span>Distance NM</span><span>Ahead NM</span><span>Astern NM</span><span></span>" + [0, 1, 2, 3].map((i) =>
    `<label><input type="checkbox" id="pi${i}On"> PI ${i + 1}</label><input type="number" id="pi${i}Brg" min="0" max="359" step="1" value="0"><input type="number" id="pi${i}Rng" min="-24" max="24" step="0.05" value="${i % 2 === 0 ? 1 : -1}"><input type="number" id="pi${i}Ahd" min="0" max="48" step="0.1" placeholder="full"><input type="number" id="pi${i}Ast" min="0" max="48" step="0.1" placeholder="full"><button data-pihdg="${i}" title="Put this line parallel to the ship's heading">HDG</button>`).join("");
  $("piGrid").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("button[data-pihdg]");
    if (!b) return;
    const i = Number(b.dataset["pihdg"]);
    setSlider(`pi${i}Brg`, Math.round(normalizeDeg(measuredHeading(app.world))) % 360);
    setCheck(`pi${i}On`, true);
    applyControls();
  });
  for (const [id, on] of [["piAllOn", true], ["piAllOff", false]] as const) {
    $(id).addEventListener("click", () => {
      for (const i of [0, 1, 2, 3]) setCheck(`pi${i}On`, on);
      applyControls();
    });
  }
  $("eblCarry").addEventListener("click", () => {
    app.eblOriginCarried = !app.eblOriginCarried;
    app.eblOriginOffset = app.eblOrigin ? { e: app.eblOrigin.e - app.world.own.pos.e, n: app.eblOrigin.n - app.world.own.pos.n } : null;
    $("eblCarry").textContent = app.eblOriginCarried ? "Offset origin: carried with own ship" : "Offset origin: fixed to ground";
  });
  for (const id of ["ebl2On", "ebl2Brg", "vrm2On", "vrm2Rng", "band", ...[0, 1, 2, 3].flatMap((i) => [`pi${i}On`, `pi${i}Brg`, `pi${i}Rng`, `pi${i}Ahd`, `pi${i}Ast`])]) {
    $(id).addEventListener("input", applyControls);
    $(id).addEventListener("change", applyControls);
  }
  const hl = $("hlOff");
  hl.addEventListener("pointerdown", () => (app.hlOff = true));
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) hl.addEventListener(ev, () => (app.hlOff = false));
  $("eblOrg").addEventListener("click", () => {
    if (app.eblOrigin || pickMode === "eblOrigin") {
      app.eblOrigin = null;
      pickMode = null;
    } else pickMode = "eblOrigin";
    showMeasureState();
  });
  $("offC").addEventListener("click", () => {
    pickMode = pickMode === "offCentre" ? null : "offCentre";
    showMeasureState();
  });
  const fillMaps = (): void => {
    $("navLoad").innerHTML = '<option value="">Load map</option>' + Object.keys(store.data.maps).map((n) => `<option>${esc(n)}</option>`).join("");
  };
  fillMaps();
  $("navDraw").addEventListener("click", () => {
    if (pickMode === "navLine") {
      pickMode = null;
      if (app.navLines.length > 0 && app.navLines[app.navLines.length - 1]!.length < 2) app.navLines.pop();
    } else {
      pickMode = "navLine";
      app.navLines.push([]);
    }
    showMeasureState();
  });
  $("navMark").addEventListener("click", () => {
    pickMode = pickMode === "navMark" ? null : "navMark";
    showMeasureState();
  });
  $("navClear").addEventListener("click", () => {
    app.navLines = [];
    app.navMarks = [];
    if (pickMode === "navLine" || pickMode === "navMark") pickMode = null;
    showMeasureState();
  });
  $("navSave").addEventListener("click", () => {
    const name = ($("navName") as HTMLInputElement).value.trim();
    const lines = app.navLines.filter((l) => l.length >= 2);
    if (!name || (lines.length === 0 && app.navMarks.length === 0)) return;
    store.data.maps[name] = lines.map((l) => l.map((q) => ({ e: +q.e.toFixed(3), n: +q.n.toFixed(3) })));
    store.data.mapMarks[name] = app.navMarks.map((q) => ({ e: +q.e.toFixed(3), n: +q.n.toFixed(3) }));
    store.save();
    fillMaps();
  });
  $("navLoad").addEventListener("change", () => {
    const m = store.data.maps[sel("navLoad")];
    if (m) {
      app.navLines = m.map((l) => l.map((q) => ({ ...q })));
      app.navMarks = (store.data.mapMarks[sel("navLoad")] ?? []).map((q) => ({ ...q }));
    }
    setSelect("navLoad", "");
  });
  $("offReset").addEventListener("click", () => {
    app.display.offCentre = { x: 0, y: 0 };
  });

  const ids = [
    "shipType", "helm", "windFrom", "windSpd", "autoSea", "autoRain", "autoTune", "gain", "tuning", "stc", "ftc", "brill", "sea", "duct", "refr", "interf", "pulse", "echoStretch", "echoAvg", "irOn", "pmOn", "curSet", "curDrift", "tideRate", "tideSet", "tideHrs", "ordCourse", "ordSpeed",
    "eblOn", "eblBrg", "vrmOn", "vrmRng", "trails", "trailMin", "shadow", "names", "rainInt",
  ];
  for (const id of ids) {
    $(id).addEventListener("input", applyControls);
    $(id).addEventListener("change", applyControls);
  }

  const toDisplayNm = (ev: PointerEvent): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * cssSize;
    const sy = ((ev.clientY - rect.top) / rect.height) * cssSize;
    const g = radarGeometry(cssSize, app.world.radar.controls.rangeNm);
    const x = (sx - g.cx) / g.k;
    const y = (g.cy - sy) / g.k;
    return Math.hypot(x, y) <= app.world.radar.controls.rangeNm ? { x, y } : null;
  };
  /** Put the free EBL / VRM on a display position (NM from the display centre). */
  const moveFreeLines = (p: { x: number; y: number }): void => {
    if (!anyFree()) return;
    const r = readoutAt(app, displayNmToWorld(app.world, app.display, p.x, p.y));
    if (eblFree) {
      // With an offset origin the EBL bearing is from that point to the cursor.
      const o = app.eblOrigin;
      const cur = displayNmToWorld(app.world, app.display, p.x, p.y);
      const b = o ? normalizeDeg((Math.atan2(cur.e - o.e, cur.n - o.n) * 180) / Math.PI + app.world.sensors.gyroErrorDeg) : r.trueBearing;
      setSlider("eblBrg", (Math.round(b * 10) / 10) % 360);
    }
    if (vrmFree) setSlider("vrmRng", Math.min(24, Math.max(0.05, Math.round(r.range * 100) / 100)));
    if (ebl2Free) setSlider("ebl2Brg", (Math.round(r.trueBearing * 10) / 10) % 360);
    if (vrm2Free) setSlider("vrm2Rng", Math.min(24, Math.max(0.05, Math.round(r.range * 100) / 100)));
    applyControls();
  };
  canvas.style.touchAction = "manipulation";
  let lastTap = { t: 0, x: 0, y: 0 };
  canvas.addEventListener("pointermove", (ev) => {
    app.cursor = toDisplayNm(ev);
    if (app.cursor && (ev.pointerType === "mouse" || ev.buttons)) moveFreeLines(app.cursor);
  });
  canvas.addEventListener("pointerleave", () => {
    app.cursor = null;
  });
  canvas.addEventListener("pointerdown", (ev) => {
    const p = toDisplayNm(ev);
    if (!p) return;
    const wp = displayNmToWorld(app.world, app.display, p.x, p.y);
    if (app.routeEdit && session.role === "instructor") {
      // Instructor is programming a target's track: each click adds a waypoint.
      if (app.routeEdit.points.length < MAX_ROUTE_WAYPOINTS) app.routeEdit.points.push(wp);
      return;
    }
    if (pickMode === "eblOrigin") {
      app.eblOrigin = wp;
      app.eblOriginOffset = { e: wp.e - app.world.own.pos.e, n: wp.n - app.world.own.pos.n };
      setCheck("eblOn", true);
      pickMode = null;
      applyControls();
      showMeasureState();
      return;
    }
    if (pickMode === "navLine") {
      app.navLines[app.navLines.length - 1]?.push(wp);
      return;
    }
    if (pickMode === "navMark") {
      app.navMarks.push(wp);
      return;
    }
    if (pickMode === "offCentre") {
      // Own ship is drawn where the user clicked (relative motion), at most 66% of the radius off.
      const lim = 0.66 * app.world.radar.controls.rangeNm;
      const d = Math.hypot(p.x, p.y);
      const f = d > lim ? lim / d : 1;
      app.display.offCentre = { x: p.x * f, y: p.y * f };
      pickMode = null;
      showMeasureState();
      return;
    }
    // Double click / double tap: lock whichever of the EBL and VRM is following the cursor.
    const now = performance.now();
    const isDouble = now - lastTap.t < 400 && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 25;
    lastTap = { t: now, x: ev.clientX, y: ev.clientY };
    if (isDouble && anyFree()) {
      moveFreeLines(p);
      for (const l of ["ebl", "vrm", "ebl2", "vrm2"] as const) setFree(l, false);
      lastTap.t = 0;
      return;
    }
    if (anyFree()) {
      moveFreeLines(p); // touch: a tap moves the free line to that point
      return;
    }
    if (!app.roc && arpaUi.clickMode() !== "ebl") {
      const g = radarGeometry(cssSize, app.world.radar.controls.rangeNm);
      arpaUi.click(app, rotateVec(sub(wp, app.world.own.pos), app.world.sensors.gyroErrorDeg), 14 / g.k);
      return;
    }
    const r = readoutAt(app, wp);
    setCheck("eblOn", true);
    setCheck("vrmOn", true);
    setSlider("eblBrg", (Math.round(r.trueBearing * 10) / 10) % 360);
    setSlider("vrmRng", Math.min(24, Math.max(0.05, Math.round(r.range * 100) / 100)));
    applyControls();
  });

  window.addEventListener("resize", resize);
  resize();
  loadScenario(SCENARIOS[0]!);
  setTab("radar");
}

let pickMode: "eblOrigin" | "offCentre" | "navLine" | "navMark" | null = null;
let eblFree = false;
let vrmFree = false;
let ebl2Free = false;
let vrm2Free = false;
const anyFree = (): boolean => eblFree || vrmFree || ebl2Free || vrm2Free;
/** Which measuring lines are following the cursor (for the console panel). */
const freeLines = (): Record<"ebl" | "vrm" | "ebl2" | "vrm2", boolean> => ({ ebl: eblFree, vrm: vrmFree, ebl2: ebl2Free, vrm2: vrm2Free });

function showMeasureState(): void {
  const st = (on: boolean, free: boolean): string => (!on ? "off" : free ? "FREE (follows cursor)" : "LOCKED");
  setText("mvState", `EBL: ${st(app.ebl.on || chkId("eblOn"), eblFree)}   VRM: ${st(app.vrm.on || chkId("vrmOn"), vrmFree)}${pickMode === "eblOrigin" ? "   CLICK THE NEW EBL ORIGIN" : pickMode === "offCentre" ? "   CLICK WHERE OWN SHIP SHOULD BE" : pickMode === "navLine" ? "   CLICK THE POINTS OF THE NAV LINE" : pickMode === "navMark" ? "   CLICK WHERE EACH NAV MARK GOES" : ""}`);
  setText("navMark", pickMode === "navMark" ? "Nav mark: done" : "Nav mark: place");
  setText("navDraw", pickMode === "navLine" ? "Nav lines: end this line" : "Nav lines: draw");
  setText("eblOrg", app.eblOrigin ? "EBL origin: fixed point (press for own ship)" : "EBL origin: own ship");
}
function chkId(id: string): boolean {
  return (byId(id) as HTMLInputElement).checked;
}

let nextFog: number | null = null;
let fogTick: () => void = () => undefined;

function updateReadouts(): void {
  showMeasureState();
  fogTick();
  {
    const mo = app.world.own.model?.motion;
    const sd = (x: number, unit: string): string => (Math.abs(x) < 0.5 ? "0" : `${x > 0 ? "S" : "P"} ${Math.abs(x).toFixed(0)}${unit}`);
    // Rudder angle indicator and steering gear state.
    const units = app.world.own.model?.steeringUnits ?? 1;
    const r = mo?.rudder ?? 0;
    const bar = $("rudderBar").style;
    bar.left = `${50 + Math.min(0, r) / 0.7}%`;
    bar.width = `${Math.abs(r) / 0.7}%`;
    $("rudderOrd").style.left = `${50 + (app.world.own.model?.steering === "hand" ? app.world.own.model.rudderOrder : r) / 0.7}%`;
    $("teleKeys").querySelector<HTMLElement>('button[data-u="2"]')!.classList.toggle("on", units === 2);
    ($("teleKeys").querySelector('button[data-u="2"]') as HTMLButtonElement).disabled = !app.world.own.model;
    setText("teleInfo", app.world.own.model ? `hard over to hard over: ${HARD_OVER_SECONDS[units]} s` : "not used by the exercise ship");
    setText("helmGear", app.world.own.model ? `telemotor ${units === 2 ? "1 + 2" : "1"}: ${HARD_OVER_SECONDS[units]} s` : "");
    setText("helmNow", mo ? `${mo.rudder > 0.5 ? "+" : ""}${mo.rudder.toFixed(0)}°` : "---");
    const swy = app.world.own.seaway;
    const side = (x: number, pos: string, neg: string): string => `${Math.abs(x).toFixed(0)}° ${Math.abs(x) < 0.5 ? "" : x > 0 ? pos : neg}`.trim();
    setText("anchorKey", app.world.own.anchor ? "WEIGH ANCHOR" : "LET GO ANCHOR");
    $("anchorKey").classList.toggle("on", !!app.world.own.anchor);
    setText("shipNow", mo ? `HDG ${pad3(measuredHeading(app.world))}   RUDDER ${sd(mo.rudder, "°")}   ROT ${sd(mo.r * 60, "°/min")}   STW ${mo.u.toFixed(1)} kn${swy ? `   ROLL ${side(swy.rollDeg, "S", "P")}   PITCH ${side(swy.pitchDeg, "bow down", "bow up")}` : ""}` : "");
  }
  // Hand steering: the autopilot is disengaged, so its course setting is shown as OFF and does not move.
  if (app.world.own.model?.steering === "hand") setText("ordCourseV", "OFF");
  {
    // Own ship data: live values, and the particulars of the ship type in use.
    const w0 = app.world;
    const type = w0.own.model ? shipTypeById(w0.own.model.typeId) : null;
    setText("osSize", type ? `${type.lengthM} m x ${type.beamM} m` : "---");
    setText("osType", type ? type.name.split(",")[0]! : "Exercise ship");
    const dr = $("osDraught") as HTMLInputElement;
    if (document.activeElement !== dr) dr.value = String(store.data.ownShip.draughtM ?? type?.draughtM ?? "");
    const ll = latLonOf(w0.origin, w0.own.pos);
    setText("osPos", w0.sensors.gnssFailed ? "NO FIX (EPFS failed)" : `${formatLatLon(ll.lat, "lat")}  ${formatLatLon(ll.lon, "lon")}`);
    const cg = ownCogSog(w0);
    setText("osCog", `${cg.course.toFixed(1).padStart(5, "0")}°`);
    setText("osSog", `${cg.speed.toFixed(1)} kn`);
    setText("osHdg", `${measuredHeading(w0).toFixed(1).padStart(5, "0")}°`);
    const rot = (w0.own.model?.motion.r ?? 0) * 60;
    setText("osRot", w0.own.model ? (Math.abs(rot) < 0.5 ? "0°/min" : `${Math.abs(rot).toFixed(0)}°/min to ${rot > 0 ? "starboard" : "port"}`) : "---");
    setText("osUtc", new Date(app.startUtcMs + w0.time * 1000).toISOString().slice(0, 19).replace("T", " "));
  }
  const w = app.world;
  const t = Math.floor(w.time + 1e-6);
  setText("rTime", `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  $("meter").style.width = `${Math.round(tuningFactor(w.radar.controls.tuning, w.radar.tuningOptimum) * 100)}%`;
  if (app.cursor) {
    const wp = displayNmToWorld(w, app.display, app.cursor.x, app.cursor.y);
    const r = readoutAt(app, wp);
    setText("rCur", `${r.range.toFixed(2)} NM  T${pad3(r.trueBearing)}  R${pad3(r.relBearing)}`);
  } else {
    setText("rCur", "---");
  }
  setText("rEbl", app.ebl.on ? `T${brg1(app.ebl.bearing)}  R${brg1(app.ebl.bearing - measuredHeading(w))}` : "off");
  setText("rVrm", app.vrm.on ? `${app.vrm.range.toFixed(2)} NM` : "off");
  $("run").textContent = app.running || app.advanceTo !== null ? "Pause" : "Run";
  {
    const cv = currentVelocity(w);
    const sp = Math.hypot(cv.e, cv.n);
    setText("tideNow", sp < 0.05 ? "Water movement now: none." : `Water movement now (current and tidal stream): ${pad3((Math.atan2(cv.e, cv.n) * 180) / Math.PI)}° at ${sp.toFixed(1)} kn.`);
  }
  rocUi.tick(app);
  arpaUi.tick(app);
  consoleUi?.tick(app);
  trainUi.tick(app);
  instrUi.tick(app);
  panelUi?.tick();
}

/** Every second: report this display to the instructor's monitor and count display time for the pair. */
let lastPairSave = 0;
function heartbeat(): void {
  const w = app.world;
  const s = app.arpaEx;
  // The instructor station is not a display: it does not report (and its own ship is not shown to the trainees).
  if (!STATION) link.sendStatus({
    station: link.station, students: session.students, batch: batchName(),
    exercise: s ? `Exercise ${s.def.number}` : app.roc ? `ROC ${app.roc.ex.id}` : `Free: ${app.scenario.name}`,
    time: w.time, running: app.running, hdg: measuredHeading(w), spd: w.own.speedThroughWater, ordC: w.own.ordered.course, ordS: w.own.ordered.speed,
    rangeNm: w.radar.controls.rangeNm, tracks: app.roc ? 0 : app.arpa.activeCount(), alarms: app.roc ? [] : app.arpa.alarms.filter((x) => !x.acked).map((x) => x.text),
    answered: s ? `${s.answers.size + s.actionsDone.size} of ${s.def.tasks.filter((t) => t.kind !== "outcome").length} items${s.finished ? ` (finished ${s.finished.percent.toFixed(0)}%)` : ""}` : "",
    scenario: app.scenario.id, joint: chk("jointOn"),
    own: (() => {
      const g = ownCogSog(w);
      return { e: +w.own.pos.e.toFixed(4), n: +w.own.pos.n.toFixed(4), cog: +g.course.toFixed(1), sog: +g.speed.toFixed(2) };
    })(),
    tg: w.targets.map((t) => ({ e: +(t.pos.e - w.own.pos.e).toFixed(2), n: +(t.pos.n - w.own.pos.n).toFixed(2), name: t.name })),
    at: Date.now(),
  });
  if (chk("jointOn")) {
    if (app.timeScale !== 1) {
      setSelect("speed", "1");
      app.timeScale = 1;
    }
    const r = applyRemoteShips(app.world, [...remoteShips.values()], Date.now());
    for (const id of r.added) app.recorder?.note(w, `Linked own ship joined: ${w.targets.find((t) => t.id === id)?.name}.`);
    setText("jointInfo", `Linked with ${w.targets.filter((t) => t.id >= 9000).map((t) => t.name).join(", ") || "no other display yet"} (link: ${link.mode}).`);
  } else setText("jointInfo", "");
  if (session.students.length > 0 && $("login").hidden) {
    store.addPairTime(session.students, 1);
    if (++lastPairSave >= 60) {
      lastPairSave = 0;
      store.save();
      showWho();
    }
  }
}

let panelUi: PanelUi | null = null;
let last = performance.now();
/** While an exercise is being recorded, keep a small copy of the radar picture every few seconds for the replay. */
const pictureCanvas = document.createElement("canvas");
function takePicture(): void {
  if (!app.recorder || app.world.time + 1e-9 < app.nextPictureAt) return;
  app.nextPictureAt = app.world.time + PICTURE_INTERVAL_SEC;
  try {
    pictureCanvas.width = PICTURE_SIZE_PX;
    pictureCanvas.height = PICTURE_SIZE_PX;
    const c = pictureCanvas.getContext("2d");
    if (!c) return;
    c.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, 0, PICTURE_SIZE_PX, PICTURE_SIZE_PX);
    app.pictures.push({ t: Math.round(app.world.time), url: pictureCanvas.toDataURL("image/jpeg", PICTURE_QUALITY) });
    if (app.pictures.length > MAX_PICTURES) app.pictures.shift();
  } catch {
    // A picture that cannot be taken is left out; the exercise goes on.
  }
}

let readoutClock = 0;
/** When the simulation last stepped (this page's clock). */
let lastStepAt = 0;
function frame(now: number): void {
  step(now);
  requestAnimationFrame(frame);
}
/** One step of the simulation and one drawing of the picture. */
function step(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  lastStepAt = now;
  advance(app, dt);
  drawPpi(ctx, cssSize, app);
  takePicture();
  rocUi.frame(app);
  readoutClock += dt;
  if (readoutClock > 0.15) {
    readoutClock = 0;
    updateReadouts();
    shipWin?.tick(app);
  }
}

setup();
// The ship control window: while it is in front it keeps the clock going even if the radar window is hidden.
const ship = initShipWindow({
  keepAlive: () => {
    const now = performance.now();
    if (now - lastStepAt > 200) step(now);
  },
  changed: (open) => {
    $("shipWinKey").classList.toggle("on", open);
    $("shipWinKey").title = open ? "The ship control window is open: press to bring it forward" : "Open the ship control window (steering, engine, anchor and the exercise) for a second screen";
    if (!open) setTab(app.arpaEx ? "ex" : app.roc ? "roc" : "radar");
  },
  blocked: () => banner("The browser did not open the ship control window. Allow pop-up windows for this page (the icon at the right of the address bar), then press SHIP CONTROL again."),
});
shipWin = ship;
$("shipWinKey").addEventListener("click", () => ship.open());
window.addEventListener("beforeunload", () => ship.close());
consoleUi = initConsoleUi(setTab, freeLines, STATION, (key) => {
  // SHIP and the exercise keys bring the ship control window forward while it is open.
  if (!ship.isOpen()) return false;
  if (key === "own") ship.focus();
  else if (key === "ex" || key === "roc") ship.focus(key);
  else return false;
  return true;
});
panelUi = initPanel(store);
(window as unknown as { __panelAct: unknown }).__panelAct = (id: string, down?: boolean): void => panelUi?.act(id, down);
setRole("student");
if (STATION) {
  stationUi = initStationUi({ store, link, role: () => session.role, setRole });
  stationUi.showLogin();
} else openLogin();
setInterval(heartbeat, 1000);
window.addEventListener("beforeunload", () => store.save());

// Hook for the screen test (scripts/screen-test.mjs): where the first target's echo is on the picture, CSS pixels.
(window as unknown as { __simTest: unknown }).__simTest = {
  targetCount: (): number => app.world.targets.length,
  refraction: (): string => app.world.env.refraction ?? "standard",
  vectorSuppress: (): boolean => app.arpa.settings.vectorSuppress,
  aisFilter: (): number | null => app.ais.settings.sleepFilter.rangeNm,
  /** Echoes on the picture now, by kind. */
  hitKinds: (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const h of app.hits) out[h.hit.kind] = (out[h.hit.kind] ?? 0) + 1;
    return out;
  },
  /** Put own ship somewhere (NM in the scenario's frame) and clear the picture, for pictures of the land. */
  placeOwn: (e: number, n: number, heading: number): void => {
    app.world.own.pos = { e, n };
    app.world.own.heading = heading;
    app.world.own.ordered.course = heading;
    app.hits.length = 0;
    resetTrueMotion(app);
  },
  aisFilterLabel: (): string => aisFilterLabel(app.ais.settings.sleepFilter),
  headingLost: (): boolean => app.headingLost,
  /** The names of the batches this display knows. */
  batchNames: (): string[] => store.data.batches.map((b) => b.name),
  /** The autopilot course ordered now. */
  orderedCourse: (): number => Math.round(app.world.own.ordered.course) % 360,
  /** Targets whose data label is shown on the picture. */
  labels: (): string[] => [...app.tgtLabels],
  lostWarning: (): boolean => app.arpa.settings.lostWarning,
  /** AIS targets on the picture in the last frame. */
  aisDrawn: (): number => app.aisDrawn,
  /** The first target that transmits AIS (and has `name` in its name, if given): its index and position (NM). */
  aisTarget: (name?: string): { i: number; pos: { e: number; n: number } } | null => {
    const i = app.world.targets.findIndex((t) => (t.ais ?? t.kind === "ship") && (!name || t.name.toLowerCase().includes(name.toLowerCase())));
    return i < 0 ? null : { i, pos: { ...app.world.targets[i]!.pos } };
  },
  /** Where every target's echo is on the picture, CSS pixels. */
  targetsScreen: (): { x: number; y: number }[] => {
    const g = radarGeometry(cssSize, app.world.radar.controls.rangeNm);
    return app.world.targets.map((t) => {
      const d = worldToDisplayNm(app.world, app.display, t.pos);
      return { x: g.cx + d.x * g.k, y: g.cy - d.y * g.k };
    });
  },
  firstTargetScreen: (): { x: number; y: number } | null => {
    const t = app.world.targets[0];
    if (!t) return null;
    const g = radarGeometry(cssSize, app.world.radar.controls.rangeNm);
    const d = worldToDisplayNm(app.world, app.display, t.pos);
    return { x: g.cx + d.x * g.k, y: g.cy - d.y * g.k };
  },
};
requestAnimationFrame(frame);
