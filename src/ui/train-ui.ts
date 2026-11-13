import { ARPA_EXERCISES, ArpaExercise, ExerciseResult, PLOTTING_EXERCISES, RADAR_EXERCISES } from "../train/index";

/** Every exercise, listed by number. */
const ALL = [...ARPA_EXERCISES, ...RADAR_EXERCISES, ...PLOTTING_EXERCISES].sort((a, b) => a.number - b.number);
import { AppState } from "./app";
import { $, esc, mmss } from "./dom";

export interface TrainUiApi {
  getApp: () => AppState;
  start: (ex: ArpaExercise) => void;
  /** Called when the student presses Finish: the caller stores the record. */
  finished: (app: AppState, r: ExerciseResult) => void;
  /** The trainees' own review, peer comments and goals, written after the exercise. */
  saveDebrief: (app: AppState, d: { self: string; peer: string; goals: string }) => void;
  /** Exercise ids assigned to the students at this display (empty = everything is open). */
  assigned: () => string[];
  isInstructor: () => boolean;
}

export interface TrainUi {
  tick: (app: AppState) => void;
  onAppChanged: (app: AppState) => void;
  refreshList: () => void;
}

export function resultHtml(r: ExerciseResult): string {
  const rows = r.items
    .map((i) => `<tr><td>${esc(i.label)}</td><td>${esc(i.student)}</td><td>${esc(i.correct)}</td><td class="${i.ok ? "ok" : "no"}">${i.ok ? "✓" : "✗"}</td><td>${i.points}/${i.max}</td></tr>`)
    .join("");
  const verdict = r.passed === null ? "No pass mark has been set by the instructor." : r.passed ? '<span class="ok">Passed.</span>' : '<span class="no">Not yet passed.</span>';
  return `<p><b>${esc(r.title)}</b> &nbsp; ${mmss(r.simSeconds)} simulated</p>
    <table class="res"><thead><tr><th>Item</th><th>Yours</th><th>Correct</th><th></th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>
    <p><b>${r.score} of ${r.max} (${r.percent.toFixed(0)}%)</b>. ${verdict}</p>
    <p class="small">${esc(r.placeholderNote)}</p>
    <h2 style="margin-top:10px">Debrief questions</h2><ol class="steps">${r.debrief.map((d) => `<li>${esc(d)}</li>`).join("")}</ol>`;
}

export function initTrainUi(api: TrainUiApi): TrainUi {
  const pane = $("paneEx");
  pane.innerHTML = `
    <section><h2>ARPA and radar exercises</h2><div id="exList"></div>
      <p class="hint">Exercises 1 to 9 are the ARPA exercises; 10 and 11 radar navigation (parallel indexing, search and rescue); 12 to 21 manual radar plotting; 22 switching on and setting up; 23 to 26 radar work on the real coasts of Mumbai, Goa, Kochi and the Gulf of Kutch. Each one loads its own traffic. Answers are checked against the real situation when you press Finish.</p></section>
    <section id="exRun" hidden><h2 id="exTitle"></h2><p class="small" id="exAim"></p><ol class="steps" id="exBrief"></ol>
      <p class="small" id="exClock"></p></section>
    <section id="exCrit" hidden><h2>How you will be assessed</h2><table class="res"><thead><tr><th>Item</th><th>Criterion</th><th>Pts</th></tr></thead><tbody id="exCritBody"></tbody></table>
      <p class="small">Read this before you press Run: take the planning time you need. The pair at this display is assessed together. The score is provisional (the marking scheme is not yet validated); the assessor's decision that you carried out the task safely and effectively is what counts.</p></section>
    <section id="exTasks" hidden><h2>Tasks and questions</h2><div id="exTaskList"></div>
      <div class="btns"><button id="exFinish">Finish exercise</button></div>
      <p class="hint">Numbers are checked at the moment you press Answer (CPA and TCPA change with time). You can answer again; the last answer counts.</p></section>
    <section id="exScript" class="instr-only" hidden><h2>Instructor: scripted events</h2><div class="log" id="exScriptLog"></div></section>
    <section id="exResult" hidden><h2>Result</h2><div id="exResultBody"></div>
      <h2 style="margin-top:10px">Your debrief notes</h2>
      <label class="small" for="dbSelf">What went well, and what would you do differently?</label><textarea id="dbSelf" rows="3"></textarea>
      <label class="small" for="dbPeer">Comments from your partner or the observing trainees (facts, not blame)</label><textarea id="dbPeer" rows="2"></textarea>
      <label class="small" for="dbGoals">Your goals for next time</label><textarea id="dbGoals" rows="2"></textarea>
      <div class="btns"><button id="dbSave">Save notes to the record</button><span class="small" id="dbMsg"></span></div></section>`;

  const refreshList = (): void => {
    const assigned = api.assigned();
    const open = api.isInstructor() || assigned.length === 0;
    $("exList").innerHTML = ALL.map((e) => {
      const mine = assigned.includes(e.id);
      const can = open || mine;
      return `<div class="btns" style="margin:3px 0"><button data-ex="${e.id}" ${can ? "" : "disabled"} style="flex:1;text-align:left">${e.number}. ${esc(e.title)}${mine ? " ★" : ""}</button></div>`;
    }).join("") + (assigned.length > 0 ? '<p class="small">★ assigned to your batch.</p>' : "");
  };
  refreshList();

  $("exList").addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement).closest("button")?.dataset["ex"];
    const ex = ALL.find((e) => e.id === id);
    if (ex) api.start(ex);
  });

  const onAppChanged = (app: AppState): void => {
    const s = app.arpaEx;
    $("exRun").hidden = !s;
    $("exTasks").hidden = !s;
    $("exScript").hidden = !s || s.def.script.length === 0;
    $("exCrit").hidden = !s;
    if (s) $("exCritBody").innerHTML = s.criteria().map((c) => `<tr><td>${esc(c.label)}</td><td>${esc(c.criterion)}</td><td>${c.points}</td></tr>`).join("");
    for (const id of ["dbSelf", "dbPeer", "dbGoals"]) ($(id) as HTMLTextAreaElement).value = "";
    $("dbMsg").textContent = "";
    $("exResult").hidden = true;
    if (!s) return;
    const d = s.def;
    $("exTitle").textContent = `${d.number}. ${d.title}`;
    $("exAim").textContent = d.aim;
    $("exBrief").innerHTML = d.briefing.map((b) => `<li>${esc(b)}</li>`).join("");
    $("exTaskList").innerHTML = d.tasks
      .map((t) => {
        const st = `<span class="small" id="exSt_${t.id}"></span>`;
        if (t.kind === "number") {
          return `<div style="margin:8px 0"><label class="small" for="exIn_${t.id}">${esc(t.prompt)} (${esc(t.unit)})</label>
            <div class="btns" style="margin-top:2px"><input type="number" step="any" id="exIn_${t.id}" style="flex:1"><button data-ans="${t.id}">Answer</button></div>${st}</div>`;
        }
        if (t.kind === "choice") {
          return `<div style="margin:8px 0"><label class="small" for="exIn_${t.id}">${esc(t.prompt)}</label>
            <div class="btns" style="margin-top:2px"><select id="exIn_${t.id}" style="flex:1"><option value="">choose</option>${t.choices.map((c, i) => `<option value="${i}">${esc(c)}</option>`).join("")}</select><button data-ans="${t.id}">Answer</button></div>${st}</div>`;
        }
        return `<div style="margin:6px 0" class="small">${t.kind === "action" ? "To do" : "Judged at the end"}: ${esc(t.prompt)} ${st}</div>`;
      })
      .join("");
  };

  $("exTaskList").addEventListener("click", (ev) => {
    const id = (ev.target as HTMLElement).closest("button")?.dataset["ans"];
    const app = api.getApp();
    const s = app.arpaEx;
    if (!id || !s) return;
    const raw = ($(`exIn_${id}`) as HTMLInputElement | HTMLSelectElement).value;
    const st = $(`exSt_${id}`);
    if (raw === "") {
      st.textContent = "Enter an answer first.";
      return;
    }
    const ok = s.answer(app.world, app.arpa, id, Number(raw));
    if (!ok) st.textContent = "This cannot be answered yet (the event has not happened or the value is not defined).";
    else app.recorder?.note(app.world, `Answered "${s.def.tasks.find((t) => t.id === id)?.prompt}": ${s.answers.get(id)?.text}`);
  });

  $("exFinish").addEventListener("click", () => {
    const app = api.getApp();
    const s = app.arpaEx;
    if (!s || s.finished) return;
    const r = s.finish(app.world, app.arpa);
    app.running = false;
    $("exResult").hidden = false;
    $("exResultBody").innerHTML = resultHtml(r);
    api.finished(app, r);
  });

  $("dbSave").addEventListener("click", () => {
    const v = (id: string): string => ($(id) as HTMLTextAreaElement).value.trim();
    api.saveDebrief(api.getApp(), { self: v("dbSelf"), peer: v("dbPeer"), goals: v("dbGoals") });
    $("dbMsg").textContent = "Saved.";
  });

  const tick = (app: AppState): void => {
    const s = app.arpaEx;
    if (!s) return;
    $("exClock").textContent = `Exercise time ${mmss(app.world.time)}${s.finished ? " (finished)" : app.running ? "" : " (paused: press Run)"}`;
    for (const t of s.def.tasks) {
      const st = document.getElementById(`exSt_${t.id}`);
      if (!st) continue;
      if (t.kind === "action") st.innerHTML = s.actionsDone.has(t.id) ? '<span class="ok">✓ done</span>' : "";
      else if (t.kind !== "outcome") {
        const a = s.answers.get(t.id);
        if (a) st.textContent = `Recorded at ${mmss(a.time)}: ${a.text}`;
      }
    }
    if (!$("exScript").hidden) $("exScriptLog").innerHTML = s.scriptLog.map((e) => `<div class="i">${mmss(e.time)} ${esc(e.note)}</div>`).join("") || "<div>Nothing yet.</div>";
  };

  return { tick, onAppChanged, refreshList };
}
