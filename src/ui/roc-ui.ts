import { byId } from "./dom";
import { Vec2, length, normalizeDeg, sub } from "../core/vec";
import { rangeBearing } from "../core/nav";
import { formatAspect } from "../core/plot";
import {
  EXERCISES, ExerciseKind, Message, PlotReport, PlotAnswerInput, RocSession, SituationAnswer, computeFix,
  evaluateClearing, evaluatePilotage, evaluatePlot, evaluateSetDrift, evaluateTraffic, exerciseById, FixResult, ROC_PLACEHOLDERS,
} from "../roc/index";
import { AppState } from "./app";
import { drawBoard, drawChart, drawTriangle } from "./work";

type View = "board" | "chart" | "tri";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = byId(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};
const val = (id: string): string => (byId(id) as HTMLInputElement).value;
const mmss = (sec: number): string => {
  const s = Math.floor(sec + 1e-6);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const f1 = (x: number): string => x.toFixed(1);
const f2 = (x: number): string => x.toFixed(2);
const brg = (x: number): string => normalizeDeg(x).toFixed(1).padStart(5, "0");
const mark = (ok: boolean | undefined): string => (ok === undefined ? "" : ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');

const SIT_LABEL: Record<SituationAnswer, string> = {
  "no-risk": "No risk",
  "head-on": "Head-on",
  "crossing-give-way": "Crossing, own ship gives way",
  "crossing-stand-on": "Crossing, own ship stands on",
  overtaking: "Own ship overtaking",
  overtaken: "Own ship being overtaken",
};

function msgList(list: Message[]): string {
  if (list.length === 0) return "";
  const cls = { error: "no", warn: "wn", info: "in" } as const;
  return `<ul class="msgs">${list.map((m) => `<li class="${cls[m.level]}">${m.text}</li>`).join("")}</ul>`;
}

export interface RocUiApi {
  getApp: () => AppState;
  start: (id: ExerciseKind) => void;
}

export interface RocUi {
  /** Draw the work canvas. Call every animation frame. */
  frame: (app: AppState) => void;
  /** Call about 6 times a second. */
  tick: (app: AppState) => void;
  /** Call after a new app (free practice or exercise) has been loaded. */
  onAppChanged: (app: AppState) => void;
  /** Call when the exercise ends. */
  showFinish: (app: AppState) => void;
}

export function initRocUi(api: RocUiApi): RocUi {
  let view: View = "board";
  let lastPlot: PlotReport | null = null;
  let lastStudent: PlotAnswerInput | null = null;
  let lastReport: unknown = null;
  let hover: Vec2 | null = null;
  let toWorld: ((x: number, y: number) => Vec2) | null = null;
  let canvasPx = 0;

  const work = $<HTMLCanvasElement>("work");
  const wctx = work.getContext("2d") as CanvasRenderingContext2D;

  const sel = $<HTMLSelectElement>("rocSelect");
  for (const e of EXERCISES) sel.add(new Option(`Module ${e.module}: ${e.name}`, e.id));
  const describe = (): void => {
    const e = exerciseById(sel.value as ExerciseKind);
    $("rocDesc").textContent = e.description;
    $("rocSteps").innerHTML = e.steps.map((s) => `<li>${s}</li>`).join("");
  };
  sel.addEventListener("change", describe);
  describe();

  const setView = (v: View): void => {
    view = v;
    $("viewBoard").classList.toggle("on", v === "board");
    $("viewChart").classList.toggle("on", v === "chart");
    $("viewTri").classList.toggle("on", v === "tri");
  };
  $("viewBoard").addEventListener("click", () => setView("board"));
  $("viewChart").addEventListener("click", () => setView("chart"));
  $("viewTri").addEventListener("click", () => setView("tri"));

  const setResult = (html: string): void => {
    $("secResult").hidden = html === "";
    $("rocResult").innerHTML = html;
  };

  function refreshTable(app: AppState): void {
    const s = app.roc;
    const body = $("obsRows");
    if (!s) {
      body.innerHTML = "";
      return;
    }
    const names = new Map(app.world.targets.map((t) => [t.id, t.name]));
    body.innerHTML = s.observations
      .map(
        (o, i) =>
          `<tr><td>${i + 1}</td><td>${o.group}</td><td>${mmss(o.timeSec)}</td><td>${brg(o.bearing)}</td><td>${f2(o.range)}</td><td>${
            o.objectId === null ? '<span class="no">no echo</span>' : names.get(o.objectId) ?? "?"
          }</td></tr>`,
      )
      .join("");
  }

  function fixHtml(r: FixResult): string {
    if (!r.valid) return `<p><b>Fix ${r.group}</b>: not yet.${msgList(r.messages)}</p>`;
    const err = r.errorNm!;
    return `<p><b>Fix ${r.group}</b> at ${mmss(r.time!)} from ${r.objects!.join(", ")}<br>
      Position E ${f2(r.pos!.e)}  N ${f2(r.pos!.n)} &nbsp; error <b class="${r.ok ? "ok" : "no"}">${f2(err)} NM</b> ${mark(r.ok)} &nbsp; angle of cut ${r.cutAngle!.toFixed(0)}°${msgList(r.messages)}</p>`;
  }

  function refreshFixResult(app: AppState): void {
    const s = app.roc;
    if (!s || (s.ex.id !== "fix" && s.ex.id !== "setdrift")) return;
    let html = "";
    for (let g = 1; g <= s.group; g++) html += fixHtml(computeFix(s.observations, s.charted, g));
    html += `<p class="small">Largest acceptable fix error ${f2(ROC_PLACEHOLDERS.fixErrorNm)} NM (placeholder). The chart shows each fix as a cross.</p>`;
    setResult(html);
  }

  function plotHtml(rep: PlotReport, st: PlotAnswerInput): string {
    if (!rep.valid) return msgList(rep.messages);
    const a = rep.fromPlot!;
    const t = rep.truth!;
    const sp = rep.studentVsPlot!.checks;
    const st2 = rep.studentVsTruth!.checks;
    const row = (label: string, key: keyof typeof a, d: number): string => {
      const c1 = sp.find((c) => c.field === key)!;
      const c2 = st2.find((c) => c.field === key)!;
      const f = (x: number): string => x.toFixed(d);
      return `<tr><td>${label}</td><td>${f(st[key])}</td><td>${f(a[key])} ${mark(c1.ok)}</td><td>${f(t[key])} ${mark(c2.ok)}</td></tr>`;
    };
    const consistent = rep.studentVsPlot!.fractionCorrect === 1;
    const accurate = rep.plotVsTruth!.fractionCorrect === 1;
    return `<table class="res"><thead><tr><th></th><th>You</th><th>Your plot</th><th>Truth</th></tr></thead><tbody>
      ${row("Relative course °", "relativeCourse", 1)}${row("Relative speed kn", "relativeSpeed", 1)}
      ${row("True course °", "trueCourse", 1)}${row("True speed kn", "trueSpeed", 1)}
      ${row("CPA NM", "cpa", 2)}${row("TCPA min", "tcpaMinutes", 1)}
      <tr><td>Aspect</td><td>${st.aspect === undefined ? "not given" : formatAspect(st.aspect)}</td><td>${formatAspect(rep.fromPlotAspect)} ${st.aspect === undefined ? "" : mark(rep.aspectVsPlotOk)}</td><td>${formatAspect(rep.truthAspect)} ${st.aspect === undefined ? "" : mark(rep.aspectVsTruthOk)}</td></tr></tbody></table>
      <p>Risk of collision: you said <b>${st.risk ? "yes" : "no"}</b>, truth is <b>${rep.truthRisk ? "yes" : "no"}</b> ${mark(rep.riskOk)}<br>
      Situation: you said <b>${SIT_LABEL[st.risk ? st.situation : "no-risk"]}</b>, truth is <b>${SIT_LABEL[rep.truthSituation!]}</b> ${mark(rep.situationOk)}</p>
      <p class="${consistent ? "ok" : "no"}">${consistent ? "Your answers agree with your own plot: the working is right." : "Your answers do not agree with your own plot: check the working."}</p>
      <p class="${accurate ? "ok" : "wn"}">${accurate ? "Your plot matches the true values: good observations." : "Your plot differs from the true values: check how you read the bearings and ranges."}</p>
      ${msgList(rep.messages)}
      <p class="small">Tolerances are placeholders: course ±${ROC_PLACEHOLDERS.plotTolerances.courseDeg}°, speed ±${ROC_PLACEHOLDERS.plotTolerances.speedKn} kn, CPA ±${ROC_PLACEHOLDERS.plotTolerances.cpaNm} NM, TCPA ±${ROC_PLACEHOLDERS.plotTolerances.tcpaMinutes} min, aspect ±${ROC_PLACEHOLDERS.aspectToleranceDeg}°. "Vector triangle" shows the construction.</p>`;
  }

  function status(app: AppState): void {
    const s = app.roc;
    if (!s) {
      $("rocStatus").textContent = "No exercise started.";
      return;
    }
    const t = `sim time ${mmss(app.world.time)}`;
    if (s.finished) $("rocStatus").textContent = `Finished: ${s.finishReason} (${t})`;
    else if (app.advanceTo !== null) $("rocStatus").textContent = `Advancing... (${t})`;
    else $("rocStatus").textContent = `${app.running ? "Running" : "Paused: press Run on the left to start the clock"} (${t})`;
  }

  /* ---------- actions ---------- */

  $("rocStart").addEventListener("click", () => api.start(sel.value as ExerciseKind));

  $("obsTake").addEventListener("click", () => {
    const app = api.getApp();
    const s = app.roc;
    if (!s || s.finished) return;
    if (!app.ebl.on || !app.vrm.on) {
      setResult('<p class="no">Switch on the EBL and the VRM and set them on the echo first. Click the echo on the radar to do it quickly.</p>');
      return;
    }
    const r = s.observe(app.world, app.ebl.bearing, app.vrm.range);
    refreshTable(app);
    if (!r.ok) setResult(`<p class="no">${r.message}</p>`);
    else if (s.ex.id === "fix" || s.ex.id === "setdrift") refreshFixResult(app);
    else setResult(r.obs.objectId === null ? '<p class="wn">That observation did not match any echo. Delete it and set the EBL and VRM on the target again.</p>' : "");
  });
  $("obsDel").addEventListener("click", () => {
    const app = api.getApp();
    app.roc?.deleteLast();
    refreshTable(app);
    refreshFixResult(app);
  });
  $("obsClear").addEventListener("click", () => {
    const app = api.getApp();
    app.roc?.clearObservations();
    refreshTable(app);
    setResult("");
  });
  $("obsNext").addEventListener("click", () => {
    const app = api.getApp();
    app.roc?.nextFixGroup();
    refreshFixResult(app);
  });
  $("advBtn").addEventListener("click", () => {
    const app = api.getApp();
    if (!app.roc || app.roc.finished) return;
    app.advanceTo = app.world.time + Number(val("advMin")) * 60;
  });

  $("ansCheck").addEventListener("click", () => {
    const app = api.getApp();
    const s = app.roc;
    if (!s) return;
    const ids = ["ansRelC", "ansRelS", "ansTrueC", "ansTrueS", "ansCpa", "ansTcpa"];
    if (ids.some((id) => val(id).trim() === "")) {
      setResult('<p class="wn">Fill in all six numbers first.</p>');
      return;
    }
    const risk = val("ansRisk") === "yes";
    const st: PlotAnswerInput = {
      relativeCourse: Number(val("ansRelC")), relativeSpeed: Number(val("ansRelS")),
      trueCourse: Number(val("ansTrueC")), trueSpeed: Number(val("ansTrueS")),
      cpa: Number(val("ansCpa")), tcpaMinutes: Number(val("ansTcpa")),
      risk, situation: val("ansSit") as SituationAnswer,
    };
    // Aspect: Red (own ship on the target's port side) is negative, Green positive.
    if (val("ansAsp").trim() !== "") st.aspect = Math.min(180, Math.max(0, Number(val("ansAsp")))) * (val("ansAspSide") === "green" ? 1 : -1);
    const rep = evaluatePlot(s.observations, st, s.ex.safePassingNm);
    lastPlot = rep;
    lastStudent = st;
    lastReport = { plot: rep, answer: st };
    setResult(plotHtml(rep, st));
    if (rep.valid) setView("tri");
  });

  $("sdCheck").addEventListener("click", () => {
    const app = api.getApp();
    const s = app.roc;
    if (!s) return;
    const student = val("ansSet").trim() === "" || val("ansDrift").trim() === "" ? null : { set: Number(val("ansSet")), drift: Number(val("ansDrift")) };
    const rep = evaluateSetDrift(s.observations, s.charted, app.world.env.current, student);
    lastReport = { setDrift: rep, answer: student };
    if (!rep.valid) {
      setResult((rep.fix1 ? fixHtml(rep.fix1) : "") + (rep.fix2 ? fixHtml(rep.fix2) : "") + msgList(rep.messages));
      return;
    }
    const ft = rep.fromFixes!;
    const tr = rep.truth!;
    let html = fixHtml(rep.fix1!) + fixHtml(rep.fix2!);
    html += `<table class="res"><thead><tr><th></th><th>You</th><th>From your fixes</th><th>Truth</th></tr></thead><tbody>
      <tr><td>Set °</td><td>${student ? f1(student.set) : "-"}</td><td>${f1(ft.set)} ${mark(rep.studentVsFixes?.setOk)}</td><td>${f1(tr.set)} ${mark(rep.studentVsTruth?.setOk)}</td></tr>
      <tr><td>Drift kn</td><td>${student ? f2(student.drift) : "-"}</td><td>${f2(ft.drift)} ${mark(rep.studentVsFixes?.driftOk)}</td><td>${f2(tr.drift)} ${mark(rep.studentVsTruth?.driftOk)}</td></tr></tbody></table>
      ${msgList(rep.messages)}<p class="small">Tolerances are placeholders: set ±${ROC_PLACEHOLDERS.setToleranceDeg}°, drift ±${ROC_PLACEHOLDERS.driftToleranceKn} kn.</p>`;
    setResult(html);
  });

  $("clrRecord").addEventListener("click", () => {
    const app = api.getApp();
    const s = app.roc;
    if (!s || s.finished) return;
    if (!app.vrm.on) {
      $("clrStatus").textContent = "Switch the VRM on and set it first.";
      return;
    }
    const id = Number(val("clrObj"));
    s.recordClearing(id, app.vrm.range);
    const name = s.charted.find((c) => c.id === id)?.name ?? "object";
    $("clrStatus").textContent = `Recorded: ${f2(app.vrm.range)} NM from ${name}.`;
  });

  $("rocFinish").addEventListener("click", () => {
    const app = api.getApp();
    if (!app.roc || app.roc.finished) return;
    app.roc.finish("Finished by the student.");
    app.running = false;
    app.advanceTo = null;
    if (app.onRocFinish) app.onRocFinish();
    else showFinish(app);
  });

  $("rocDownload").addEventListener("click", () => {
    const app = api.getApp();
    if (!app.roc) return;
    const data = { record: app.roc.toJSON(), lastReport, savedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roc-${app.roc.ex.id}-record.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  work.addEventListener("pointermove", (ev) => {
    if (view !== "chart" || !toWorld || canvasPx === 0) return;
    const r = work.getBoundingClientRect();
    hover = toWorld(((ev.clientX - r.left) / r.width) * canvasPx, ((ev.clientY - r.top) / r.height) * canvasPx);
  });
  work.addEventListener("pointerleave", () => {
    hover = null;
  });

  /* ---------- finish reports ---------- */

  function showFinish(app: AppState): void {
    const s = app.roc;
    if (!s) return;
    status(app);
    let html = `<p><b>${s.finishReason}</b></p>`;
    if (s.ex.id === "clearing") {
      const r = evaluateClearing(s, s.charted, s.ex, app.world.hazards);
      lastReport = { clearing: r };
      html += `<p>Required clearing range: <b>${r.requiredRange !== undefined ? f2(r.requiredRange) : "?"} NM</b> (distance to the shoal + its radius + margin)<br>
        You recorded: <b>${r.recordedRange !== undefined ? f2(r.recordedRange) : "nothing"}</b> ${mark(r.rangeOk)}<br>
        Kept outside your range: ${mark(r.keptOutside)}${r.minRangeToObject !== undefined ? ` (closest ${f2(r.minRangeToObject)} NM)` : ""}<br>
        Closest approach to the shoal edge: <b>${f2(r.minClearance)} NM</b> &nbsp; Grounded: ${r.grounded ? '<span class="no">yes</span>' : '<span class="ok">no</span>'}</p>
        <p class="${r.passed ? "ok" : "no"}"><b>${r.passed ? "Passed." : "Not passed."}</b></p>${msgList(r.messages)}`;
      setView("chart");
    } else if (s.ex.id === "pilotage") {
      const r = evaluatePilotage(s);
      lastReport = { pilotage: r };
      html += `<p>Time taken: <b>${f1(r.durationMin)} min</b> &nbsp; Reached last waypoint: ${mark(r.reachedEnd)}<br>
        Largest cross-track error: <b>${f2(r.maxXte)} NM</b> &nbsp; Mean: ${f2(r.meanXte)} NM &nbsp; Grounded: ${r.grounded ? '<span class="no">yes</span>' : '<span class="ok">no</span>'}</p>
        <p class="${r.passed ? "ok" : "no"}"><b>${r.passed ? "Passed." : "Not passed."}</b></p>${msgList(r.messages)}
        <p class="small">The chart now shows your track (blue) against the plan (magenta).</p>`;
      setView("chart");
    } else if (s.ex.id === "traffic") {
      const r = evaluateTraffic(s, s.ex.safePassingNm);
      lastReport = { traffic: r };
      html += `<table class="res"><thead><tr><th>Ship</th><th>Start CPA</th><th>Situation</th><th>Closest</th></tr></thead><tbody>${r.perTarget
        .map((t) => `<tr><td>${t.name}</td><td>${f2(t.initialCpa)}${t.initialRisk ? ' <span class="wn">risk</span>' : ""}</td><td>${SIT_LABEL[t.situation]}</td><td>${f2(t.minRange)} ${mark(t.safe)}</td></tr>`)
        .join("")}</tbody></table>`;
      const a = r.firstAction;
      html += a
        ? `<p>First significant action at <b>${f1(a.timeMin)} min</b>: ${a.kind === "course" ? `${f1(a.changeDeg)}° to ${a.direction}` : `speed change ${f1(a.changeKn)} kn`}${a.criticalTarget ? `, against ${a.criticalTarget} (${f1(a.rangeToCritical!)} NM, ${f1(a.tcpaToCritical!)} min to CPA)` : ""}.</p>`
        : "<p>No significant action was taken.</p>";
      html += msgList(r.advisories);
      html += `<p class="small">Safe passing distance ${f1(s.ex.safePassingNm)} NM and the action limits are placeholders. These are advisory notes. Your instructor decides the official COLREG answer.</p>`;
      setView("board");
    } else {
      html += "<p>Use the Check button to see your result.</p>";
    }
    setResult(html);
  }

  /* ---------- per-frame work ---------- */

  function onAppChanged(app: AppState): void {
    const s = app.roc;
    lastPlot = null;
    lastStudent = null;
    lastReport = null;
    hover = null;
    setResult("");
    $("clrStatus").textContent = "Not recorded.";
    const showObs = !!s && ["plot", "fix", "setdrift", "pilotage", "traffic"].includes(s.ex.id);
    $("secWork").hidden = !s;
    $("secObs").hidden = !showObs;
    $("secAnsPlot").hidden = !s || s.ex.id !== "plot";
    $("secAnsSD").hidden = !s || s.ex.id !== "setdrift";
    $("secClear").hidden = !s || s.ex.id !== "clearing";
    $("obsNext").hidden = !s || !(s.ex.id === "fix" || s.ex.id === "setdrift");
    $("viewTri").hidden = !s || s.ex.id !== "plot";
    if (s) {
      sel.value = s.ex.id;
      describe();
      setView(s.ex.id === "plot" || s.ex.id === "traffic" ? "board" : "chart");
      const clr = $<HTMLSelectElement>("clrObj");
      clr.innerHTML = "";
      for (const c of s.charted) clr.add(new Option(c.name, String(c.id)));
      for (const id of ["ansRelC", "ansRelS", "ansTrueC", "ansTrueS", "ansCpa", "ansTcpa", "ansAsp", "ansSet", "ansDrift"]) (byId(id) as HTMLInputElement).value = "";
    }
    refreshTable(app);
    status(app);
  }

  function frame(app: AppState): void {
    if (!app.roc) return;
    const size = Math.max(200, Math.round(work.getBoundingClientRect().width));
    const dpr = window.devicePixelRatio || 1;
    if (size !== canvasPx || work.width !== Math.round(size * dpr)) {
      canvasPx = size;
      work.width = Math.round(size * dpr);
      work.height = Math.round(size * dpr);
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (view === "board") drawBoard(wctx, size, app);
    else if (view === "tri") drawTriangle(wctx, size, lastPlot, lastStudent);
    else {
      const r = drawChart(wctx, size, app, hover);
      toWorld = r.toWorld;
    }
    const ro = $("workReadout");
    if (view === "chart" && hover) {
      const ref = app.roc.charted.find((c) => c.id === Number(val("clrObj"))) ?? app.roc.charted[0];
      let t = `Chart E ${f2(hover.e)}  N ${f2(hover.n)}`;
      if (ref) {
        const rb = rangeBearing(ref.pos, hover);
        t += `  |  from ${ref.name}: ${f2(rb.range)} NM, T${brg(rb.bearing)}`;
      }
      ro.textContent = t;
    } else if (view === "chart") ro.textContent = "Move over the chart to read positions and distances from an object. The chart shows the plan, not where you are.";
    else if (view === "board") ro.textContent = "Own ship is at O. Plotted points are what you read with the EBL and VRM. North is up.";
    else ro.textContent = "";
  }

  function tick(app: AppState): void {
    status(app);
    ($("advBtn") as HTMLButtonElement).disabled = app.advanceTo !== null;
  }

  return { frame, tick, onAppChanged, showFinish };
}

export { length, sub };
