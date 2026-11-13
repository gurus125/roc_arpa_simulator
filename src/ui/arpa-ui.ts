import { Vec2, bearingOf, fromPolar, length, normalizeDeg, sub } from "../core/vec";
import { bowCrossing } from "../core/bcr";
import { SILENCE_SEC, alertSound, nextToAcknowledge } from "../arpa/index";
import { acknowledge, alertRows } from "./alerts-view";
import { createAlarmSound } from "./alarm-sound";
import { Track, VECTOR_TIME_RANGE_MIN, ZoneSetting, arpaAvailableOnScale, ARPA_SCALES_NM } from "../arpa/index";
import { measuredHeading } from "../engine/index";
import { AppState } from "./app";

export type ClickMode = "acquire" | "select" | "cancel" | "ebl";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};
const inp = (id: string): HTMLInputElement => $<HTMLInputElement>(id);
const num = (id: string, fallback: number): number => {
  const v = Number(inp(id).value);
  return Number.isFinite(v) ? v : fallback;
};
const pad3 = (x: number): string => normalizeDeg(x).toFixed(1).padStart(5, "0");
const mmss = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec + 1e-6));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export interface ArpaUiApi {
  getApp: () => AppState;
}

export interface ArpaUi {
  tick: (app: AppState) => void;
  onAppChanged: (app: AppState) => void;
  clickMode: () => ClickMode;
  /** A click on the PPI while the ARPA tab is open. `rel` is gyro frame, `radiusNm` the pick radius. */
  click: (app: AppState, rel: Vec2, radiusNm: number) => void;
}

const ZONES: { key: string; label: string; list: "guardZones" | "exclusionZones"; i: number }[] = [
  { key: "g0", label: "Guard 1", list: "guardZones", i: 0 },
  { key: "g1", label: "Guard 2", list: "guardZones", i: 1 },
  { key: "x0", label: "Exclude 1", list: "exclusionZones", i: 0 },
  { key: "x1", label: "Exclude 2", list: "exclusionZones", i: 1 },
];

export function initArpaUi(api: ArpaUiApi): ArpaUi {
  let mode: ClickMode = "acquire";
  let alarmSig = "";
  const sound = createAlarmSound();


  // Zone editor
  const grid = $("zoneGrid");
  grid.innerHTML =
    "<span></span><span>Inner NM</span><span>Outer NM</span><span>From °</span><span>To °</span>" +
    ZONES.map(
      (z) =>
        `<label><input type="checkbox" id="z_${z.key}_on"> ${z.label}</label>` +
        `<input type="number" id="z_${z.key}_in" min="0" max="24" step="0.1">` +
        `<input type="number" id="z_${z.key}_out" min="0.1" max="24" step="0.1">` +
        `<input type="number" id="z_${z.key}_from" min="0" max="359" step="1">` +
        `<input type="number" id="z_${z.key}_to" min="0" max="359" step="1">`,
    ).join("");

  const modeBtn: Record<ClickMode, string> = { acquire: "cmAcq", select: "cmSel", cancel: "cmCan", ebl: "cmEbl" };
  const setMode = (m: ClickMode): void => {
    mode = m;
    for (const [k, id] of Object.entries(modeBtn)) $(id).classList.toggle("on", k === m);
  };
  for (const [k, id] of Object.entries(modeBtn)) $(id).addEventListener("click", () => setMode(k as ClickMode));

  /** Copy the panel into the ARPA settings. */
  const apply = (): void => {
    const app = api.getApp();
    const s = app.arpa.settings;
    s.autoAcquire = inp("arpaAuto").checked;
    s.logMode = $<HTMLSelectElement>("arpaLogMode").value as typeof s.logMode;
    s.manualSpeedKn = Math.min(40, Math.max(0, num("arpaManSpd", 0)));
    $("arpaManSpd").closest<HTMLElement>(".row")!.style.display = s.logMode === "manual" ? "" : "none";
    s.graphics = $<HTMLSelectElement>("arpaGraphics").value as typeof s.graphics;
    s.vectorSuppress = inp("arpaVecSup").checked;
    s.showData = inp("arpaShow").checked;
    s.brilliance = num("arpaBrill", 100);
    $("arpaBrillV").textContent = String(s.brilliance);
    app.arpa.logFailed = inp("logFail").checked;
    app.world.sensors.headingMarkerErrorDeg = num("hmErr", 0);
    app.world.sensors.vrmErrorPct = num("vrmErr", 0);
    app.world.radar.performance = num("perf", 100) / 100;
    $("hmErrV").textContent = num("hmErr", 0).toFixed(1);
    $("vrmErrV").textContent = String(num("vrmErr", 0));
    $("perfV").textContent = String(num("perf", 100));
    s.past = {
      mode: $<HTMLSelectElement>("pastMode").value as "off" | "relative" | "true",
      points: Math.min(10, Math.max(1, Math.round(num("pastPts", 5)))),
      intervalMin: Number($<HTMLSelectElement>("pastInt").value),
    };
    sound.setEnabled(inp("arpaSound").checked);
    s.vectorMode = $<HTMLSelectElement>("arpaVec").value as "true" | "relative";
    s.vectorMinutes = Math.min(VECTOR_TIME_RANGE_MIN.max, Math.max(VECTOR_TIME_RANGE_MIN.min, num("arpaVecT", 6)));
    app.arpa.gyroFailed = inp("gyroFail").checked;
    s.cpaLimitNm = Math.max(0, num("arpaCpaLim", 1));
    s.tcpaLimitMin = Math.max(0, num("arpaTcpaLim", 12));
    s.trial = {
      on: inp("trialOn").checked,
      course: normalizeDeg(num("trialCourse", 0)),
      speed: Math.max(0, num("trialSpeed", 0)),
      delayMinutes: Math.max(0, num("trialDelay", 0)),
    };
    for (const z of ZONES) {
      const zs: ZoneSetting = {
        on: inp(`z_${z.key}_on`).checked,
        innerNm: Math.max(0, num(`z_${z.key}_in`, 0)),
        outerNm: Math.max(0, num(`z_${z.key}_out`, 1)),
        fromRel: normalizeDeg(num(`z_${z.key}_from`, 0)),
        toRel: normalizeDeg(num(`z_${z.key}_to`, 0)),
      };
      if (zs.outerNm < zs.innerNm) zs.outerNm = zs.innerNm;
      s[z.list][z.i] = zs;
    }
    const w = app.world;
    w.sensors.target = { gyroErrorDeg: num("gyroErr", 0), logErrorKn: num("logErr", 0) };
    $("gyroErrV").textContent = w.sensors.target.gyroErrorDeg.toFixed(1);
    $("logErrV").textContent = w.sensors.target.logErrorKn.toFixed(1);
    $("truthTable").hidden = !inp("arpaTruth").checked;
  };

  /** Copy the ARPA settings into the panel (after a new scenario is loaded). */
  const load = (app: AppState): void => {
    aisApply();
    const s = app.arpa.settings;
    // Keep the student's display choices; reset what belongs to the scenario.
    s.autoAcquire = inp("arpaAuto").checked;
    inp("arpaVecSup").checked = s.vectorSuppress;
    inp("trialOn").checked = false;
    inp("trialCourse").value = String(Math.round(measuredHeading(app.world)));
    inp("trialSpeed").value = String(app.world.own.speedThroughWater);
    inp("trialDelay").value = "6";
    inp("arpaManSpd").value = String(app.world.own.speedThroughWater);
    inp("gyroErr").value = "0";
    inp("gyroFail").checked = false;
    inp("logFail").checked = false;
    inp("hmErr").value = "0";
    inp("vrmErr").value = "0";
    inp("perf").value = "100";
    inp("logErr").value = "0";
    for (const z of ZONES) {
      if (inp(`z_${z.key}_in`).value === "") {
        const zs = s[z.list][z.i]!;
        inp(`z_${z.key}_on`).checked = zs.on;
        inp(`z_${z.key}_in`).value = String(zs.innerNm);
        inp(`z_${z.key}_out`).value = String(zs.outerNm);
        inp(`z_${z.key}_from`).value = String(zs.fromRel);
        inp(`z_${z.key}_to`).value = String(zs.toRel);
      }
    }
    $<HTMLSelectElement>("arpaStab").value = s.stabilisation;
    alarmSig = "";
    apply();
  };

  const ids = [
    "arpaAuto", "arpaVec", "arpaVecT", "gyroFail", "logFail", "hmErr", "vrmErr", "perf", "arpaShow", "arpaBrill", "arpaLogMode", "arpaManSpd", "arpaGraphics", "arpaVecSup", "pastMode", "pastPts", "pastInt", "arpaSound", "arpaCpaLim", "arpaTcpaLim", "trialOn", "trialCourse", "trialSpeed", "trialDelay",
    "gyroErr", "logErr", "arpaTruth", ...ZONES.flatMap((z) => ["on", "in", "out", "from", "to"].map((f) => `z_${z.key}_${f}`)),
  ];
  for (const id of ids) {
    $(id).addEventListener("input", apply);
    $(id).addEventListener("change", apply);
  }
  // Ground stabilisation needs a fixed reference target: the selected track becomes the reference.
  $("arpaStab").addEventListener("change", () => {
    const app = api.getApp();
    const v = $<HTMLSelectElement>("arpaStab").value;
    if (v === "sea") {
      app.arpa.releaseGroundRef(app.world);
    } else if (app.arpaSelected === null) {
      app.arpa.wrongOrder(app.world, "select the fixed reference target first.");
      app.arpa.message = { text: "Select a small, isolated FIXED target (buoy, rock, light) first, then choose Ground.", time: app.world.time };
      $<HTMLSelectElement>("arpaStab").value = app.arpa.settings.stabilisation;
    } else if (!app.arpa.designateGroundRef(app.world, app.arpaSelected)) {
      app.arpa.message = { text: "Select a small, isolated FIXED target (buoy, rock, light) first, then choose Ground.", time: app.world.time };
      $<HTMLSelectElement>("arpaStab").value = app.arpa.settings.stabilisation;
    }
  });
  $("arpaStandby").addEventListener("click", () => {
    const app = api.getApp();
    app.arpa.settings.standby = !app.arpa.settings.standby;
  });
  $("arpaTest").addEventListener("click", () => {
    const app = api.getApp();
    app.arpa.runSelfTest(app.world);
  });
  const aisApply = (): void => {
    const st = api.getApp().ais.settings;
    st.on = inp("aisOn").checked;
    st.lostAlarm = inp("aisLost").checked;
    st.associatedShows = $<HTMLSelectElement>("aisAssoc").value as "ais" | "radar";
  };
  for (const id of ["aisOn", "aisLost", "aisAssoc"]) $(id).addEventListener("change", aisApply);
  $("aisActAll").addEventListener("click", () => {
    const ais = api.getApp().ais;
    for (const id of ais.reports.keys()) ais.activate(id);
  });
  $("aisSleepAll").addEventListener("click", () => {
    const ais = api.getApp().ais;
    for (const id of [...ais.activated]) ais.sleep(id);
  });
  $("aisRows").addEventListener("pointerdown", (ev) => {
    const id = Number((ev.target as HTMLElement).closest("tr")?.dataset["ais"]);
    if (!id) return;
    const ais = api.getApp().ais;
    if (ais.selected === id) ais.sleep(id);
    else {
      ais.activate(id);
      ais.selected = id;
    }
  });
  $("arpaCancelAll").addEventListener("click", () => {
    const app = api.getApp();
    app.arpa.cancelAll(app.world);
    app.arpaSelected = null;
  });
  // Alerts are acknowledged one at a time (MSC.302(87) 9.9): alarms first, then the oldest warning.
  $("arpaAckNext").addEventListener("click", () => {
    const app = api.getApp();
    const next = nextToAcknowledge(alertRows(app));
    if (next) acknowledge(app, next.key);
    alarmSig = "";
  });
  // All sound can be silenced for a short time with one action (9.10); nothing is acknowledged by it.
  let silencedUntil = 0;
  $("arpaSilence").addEventListener("click", () => {
    silencedUntil = api.getApp().wall + SILENCE_SEC;
  });
  // Switching the trial on starts from the present course and speed with the default delay.
  $("trialOn").addEventListener("change", () => {
    const app = api.getApp();
    if (inp("trialOn").checked) {
      const cs = app.arpa.ownCourseSpeed(app.world);
      inp("trialCourse").value = String(Math.round(cs.course));
      inp("trialSpeed").value = String(Math.round(cs.speed * 2) / 2);
      inp("trialDelay").value = "6";
      apply();
    }
  });
  $("trialFromOwn").addEventListener("click", () => {
    const app = api.getApp();
    inp("trialCourse").value = String(Math.round(measuredHeading(app.world)));
    inp("trialSpeed").value = String(Math.round(app.world.own.speedThroughWater * 2) / 2);
    apply();
  });
  $("arpaAlarms").addEventListener("pointerdown", (ev) => {
    const key = (ev.target as HTMLElement).closest("button")?.dataset["key"];
    if (!key) return;
    acknowledge(api.getApp(), key);
    alarmSig = "";
  });
  $("anchorSet").addEventListener("click", () => {
    const app = api.getApp();
    if (app.arpaSelected === null) app.arpa.message = { text: "Anchor watch: select a tracked target first.", time: app.world.time };
    else app.arpa.setAnchorWatch(app.world, app.arpaSelected, num("anchorLim", 0.1));
  });
  $("anchorOff").addEventListener("click", () => {
    const app = api.getApp();
    app.arpa.clearAnchorWatch(app.world);
  });
  $("arpaRows").addEventListener("pointerdown", (ev) => {
    const id = (ev.target as HTMLElement).closest("tr")?.dataset["id"];
    if (id) api.getApp().arpaSelected = Number(id);
  });

  const stateLabel = (t: Track): string => {
    if (t.state === "lost") return '<span class="wn">LOST</span>';
    if (t.dangerous) return '<span class="no">DANGER</span>';
    if (t.quality === "acquiring") return "ACQ";
    const q = t.quality === "prelim" ? '<span class="wn">PRELIM</span>' : "STEADY";
    return t.fading ? `${q} <span class="wn">FADE</span>` : q;
  };

  const tick = (app: AppState): void => {
    const w = app.world;
    const a = app.arpa;
    if (app.roc) {
      sound.update("none", app.wall);
      $("arpaStatus").textContent = "ARPA is switched off while an ROC exercise is running. Restart free practice on the Radar tab to use it.";
      $("arpaRows").innerHTML = "";
      return;
    }
    const sb = a.settings.standby;
    $("arpaStandby").textContent = sb ? "ARPA: STANDBY (press to switch on)" : "ARPA: ON (press for standby)";
    $("arpaTestRes").innerHTML = a.test
      ? a.test.results.map((r) => `<li class="${r.ok ? "" : "un"}"><span>${r.ok ? "PASS" : "FAIL"} ${r.name}: ${r.detail}</span></li>`).join("")
      : "";
    {
      // Alarm: sounds until acknowledged. Warning: a short signal, repeated every 5 minutes while unacknowledged.
      const snd = alertSound(alertRows(app), w.time, app.wall < silencedUntil);
      sound.update(sb ? "none" : snd === "alarm" ? "danger" : snd === "warning" ? "warning" : "none", app.wall);
    }
    $("arpaStatus").textContent = sb ? "ARPA is in STANDBY: no targets are tracked or shown." :
      `${a.activeCount()} of ${a.cfg.maxTracks} targets tracked.` +
      (arpaAvailableOnScale(w.radar.controls.rangeNm) ? "" : ` ARPA is displayed only on the ${ARPA_SCALES_NM.join(", ")} NM range scales; tracking continues in the background.`);
    $("faultNow").textContent = `Now: gyro ${w.sensors.gyroErrorDeg.toFixed(1)}°, log ${w.sensors.logErrorKn.toFixed(1)} kn (changes at ${w.sensors.rampPerMin.gyroDeg}°/min and ${w.sensors.rampPerMin.logKn} kn/min).`;
    $<HTMLSelectElement>("arpaStab").value = a.settings.stabilisation;
    $("arpaRefNote").textContent = `True course and speed (CSE/SPD) are ${a.effectiveStab() === "ground" ? "GROUND" : "SEA"} stabilised: ${a.stabLabel()}.`;
    $("arpaStabStatus").textContent =
      a.groundRefId !== null
        ? `Ground stabilised on target ${a.groundRefId}${a.effectiveStab() === "ground" ? "" : " (reference poor: sea values shown)"}.`
        : "Sea stabilised (through the water).";
    $("arpaMsg").textContent = a.message && w.time - a.message.time < 20 ? a.message.text : "";
    const aw = a.settings.anchorWatch;
    const moved = a.anchorWatchMovedNm();
    const awText = aw.trackId === null ? "Anchor watch is off." : `Anchor watch on target ${aw.trackId}: moved ${moved === null ? "---" : moved.toFixed(2)} NM, warning at ${aw.limitNm.toFixed(2)} NM.`;
    if ($("anchorInfo").textContent !== awText) $("anchorInfo").textContent = awText;

    // AIS panel.
    const lim = { cpaNm: a.settings.cpaLimitNm, tcpaMin: a.settings.tcpaLimitMin };
    const views = app.ais.targets(w, a, lim);
    $("aisRows").innerHTML = views.map((v) => `<tr data-ais="${v.report.id}" class="${app.ais.selected === v.report.id ? "sel" : ""}"><td>${v.report.name}</td><td>${pad3(v.bearing)}</td><td>${v.range.toFixed(2)}</td><td>${v.cpa.opening ? "open" : v.cpa.cpa.toFixed(2)}</td><td>${v.cpa.tcpaMinutes === null ? "---" : v.cpa.tcpaMinutes.toFixed(1)}</td><td>${pad3(v.report.cog)}</td><td>${v.report.sog.toFixed(1)}</td><td>${v.lost ? "LOST" : v.dangerous ? "DANGER" : v.state === "activated" ? "active" : "sleep"}${v.associatedTrack !== null ? ` =R${v.associatedTrack}` : ""}</td></tr>`).join("")
      || `<tr><td colspan="8" class="small">${app.ais.settings.on ? "No AIS targets received." : "AIS display is off."}</td></tr>`;
    const sv = views.find((v) => v.report.id === app.ais.selected);
    $("aisData").textContent = sv
      ? `Source AIS. ${sv.report.name}, MMSI ${sv.report.mmsi}. ${sv.report.navStatus}. Heading ${pad3(sv.report.heading)}°, COG ${pad3(sv.report.cog)}°, SOG ${sv.report.sog.toFixed(1)} kn. Last report ${Math.round(sv.ageSec)} s ago. Rate of turn: missing.`
      : "";

    const all = alertRows(app);
    const sig = all.map((x) => `${x.key}${x.acked}${x.text}`).join("|");
    if (sig !== alarmSig) {
      alarmSig = sig;
      $("arpaAlarms").innerHTML = all
        .map((x) => `<li class="${x.acked ? "" : "un"}"><span>${mmss(x.raisedAt)} <b class="${x.priority === "alarm" ? "no" : "wn"}">${x.priority.toUpperCase()}</b> ${x.text}${x.acked ? " (acknowledged)" : ""}</span>${x.acked ? "" : `<button data-key="${x.key}">Ack</button>`}</li>`)
        .join("") || '<li><span class="small">No alarms.</span></li>';
    }

    const bow = (t: Track, ownCourse: number): string => {
      const b = t.est ? bowCrossing(t.est.rel, t.est.relVel, ownCourse) : null;
      return b ? `${b.rangeNm.toFixed(2)}/${b.minutes.toFixed(1)}` : "---";
    };
    const rows = a.tracks.map((t) => {
      const rel = t.est?.rel ?? a.predictRel(t, w.time);
      const show = t.est && t.quality !== "acquiring" && t.state !== "lost";
      const q = t.quality === "prelim" ? "?" : "";
      const c = t.est?.cpa;
      const cells = show && c
        ? [
            c.opening ? "open" : `${c.cpa.toFixed(2)}${q}`,
            c.tcpaMinutes === null ? "---" : `${c.tcpaMinutes.toFixed(1)}${q}`,
            `${pad3(t.est!.trueCS.course)}${q}`,
            `${t.est!.trueCS.speed.toFixed(1)}${q}`,
            bow(t, a.ownCourseSpeed(w).course),
          ]
        : ["---", "---", "---", "---", "---"];
      return `<tr data-id="${t.id}" class="${app.arpaSelected === t.id ? "sel" : ""}"><td>${t.id}${t.manual ? "" : " A"}</td><td>${pad3(bearingOf(rel))}</td><td>${length(rel).toFixed(2)}</td>${cells.map((x) => `<td>${x}</td>`).join("")}<td>${stateLabel(t)}</td></tr>`;
    });
    $("arpaRows").innerHTML = rows.join("") || '<tr><td colspan="9" class="small">No targets. Click an echo to acquire it.</td></tr>';

    if (a.settings.trial.on) {
      const tr = a.trial(w);
      $("trialRows").innerHTML =
        tr
          .map((r) => {
            const t = a.tracks.find((x) => x.id === r.trackId);
            const now = t?.est?.cpa;
            const cls = r.dangerous ? "no" : "ok";
            const note = r.result.beforeManoeuvre ? "before turn" : "";
            return `<tr><td>${r.trackId}</td><td class="${cls}">${r.result.cpa.toFixed(2)}</td><td>${r.result.tcpaMinutes.toFixed(1)}</td><td>${now ? now.cpa.toFixed(2) : "---"}</td><td class="small">${note}</td></tr>`;
          })
          .join("") || '<tr><td colspan="5" class="small">No target with a vector yet.</td></tr>';
    } else {
      $("trialRows").innerHTML = '<tr><td colspan="5" class="small">Trial is off.</td></tr>';
    }

    if (inp("arpaTruth").checked) {
      $("truthRows").innerHTML = a.tracks
        .map((t) => {
          const tr = a.truthOf(w, t);
          if (!tr) return `<tr><td>${t.id}</td><td>${t.truthId === null ? "clutter/land" : "?"}</td><td colspan="4"></td><td>${t.swaps}</td></tr>`;
          const c = tr.cpa;
          return `<tr><td>${t.id}</td><td>${tr.name}</td><td>${c.opening ? "open" : c.cpa.toFixed(2)}</td><td>${c.tcpaMinutes === null ? "---" : c.tcpaMinutes.toFixed(1)}</td><td>${pad3(tr.trueCS.course)}</td><td>${tr.trueCS.speed.toFixed(1)}</td><td class="${t.swaps ? "no" : ""}">${t.swaps}</td></tr>`;
        })
        .join("");
    }
    const showTruth = inp("arpaTruth").checked;
    $("arpaLog").innerHTML = a.events
      .filter((e) => showTruth || !e.instructor)
      .slice(-40)
      .reverse()
      .map((e) => `<div class="${e.instructor ? "i" : ""}">${mmss(e.time)} ${e.text}</div>`)
      .join("");
  };

  const click = (app: AppState, rel: Vec2, radiusNm: number): void => {
    const w = app.world;
    const a = app.arpa;
    if (app.roc) return;
    if (mode === "acquire") {
      const t = a.acquire(w, rel);
      if (t) app.arpaSelected = t.id;
    } else {
      const t = a.trackNear(w, rel, radiusNm);
      if (!t && mode === "select") {
        // No tracked target there: an AIS target at that position is activated and selected.
        const v = app.ais.targets(w, a, { cpaNm: a.settings.cpaLimitNm, tcpaMin: a.settings.tcpaLimitMin })
          .find((x) => length(sub(fromPolar(x.bearing, x.range), rel)) <= radiusNm);
        if (v) {
          app.ais.activate(v.report.id);
          app.ais.selected = v.report.id;
          return;
        }
      }
      if (!t) {
        a.wrongOrder(w, mode === "select" ? "no target at that position to select." : "no target at that position to cancel.");
        return;
      }
      if (mode === "select") app.arpaSelected = t.id;
      else {
        a.cancel(w, t.id);
        if (app.arpaSelected === t.id) app.arpaSelected = null;
      }
    }
  };

  return {
    tick,
    onAppChanged: load,
    clickMode: () => mode,
    click,
  };
}
