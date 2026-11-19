import { bearingOf, fromPolar, length, normalizeDeg } from "../core/vec";
import { IMO_TABLE2, VISIBILITY_STEPS_NM, RANDOM_TRAFFIC_DEFAULT, addRandomTraffic, nextTargetId, Scenario, TARGET_TYPES, Target, TargetKind, clearTargetRoute, initTargetMotion, orderTarget, rcsForDetectionRange, routeAhead, setTargetRoute, targetFromType, targetTypeById } from "../engine/index";
import { MAX_ROUTE_WAYPOINTS } from "../core/route";
import { EXERCISES } from "../roc/index";
import {
  ARPA_EXERCISES, RADAR_EXERCISES, PLOTTING_EXERCISES, SELF_TEST_EXERCISES, SelfTestRow, selfTestExercise, markingSheetsHtml, examSheetsHtml, DEFAULT_EXAMS, Observation, rankFlags, bookmarks, controlsShare,
  ChecklistItem, parseChecklist, checklistLines, DEBRIEF_STEPS, debriefPack, debriefPackHtml, evidenceHtml, traineeTableHtml, decisionConflicts, traineeConflicts, assessorStats,
  parseTrackText, hasPin, traineeKeys, traineeAttempts, progressHtml, batchMatrix, batchMatrixHtml, lightRecord, recordMark, textMark, classComparison, traineeNames, traineeFileHtml, exerciseSheetHtml, exerciseSheetsHtml, rocSheetHtml, syllabusRefs, MAX_RECORDS, PLACEHOLDER_SCORING, SETUP_LIMITS, ScoringConfig, SessionRecord, Store, frameAt, frameInterpolated, REPLAY_SPEEDS, PICTURE_INTERVAL_SEC, PictureFrame, pictureAt, recordsCsv, resultCsv, scenarioFromJson, scenarioToJson,
} from "../train/index";
import { AppState, rewind } from "./app";
import { deletePictures, loadPictures } from "./picture-store";
import { $, download, esc, inputValue, mmss } from "./dom";
import { FAULT_IDS, Link, StationStatus } from "./link";
import { resultHtml } from "./train-ui";
import { ServerStore } from "./server-store";

export interface InstructorApi {
  getApp: () => AppState;
  store: Store;
  link: Link;
  role: () => "student" | "instructor";
  setRole: (r: "student" | "instructor") => void;
  loadScenario: (sc: Scenario) => void;
  scenariosChanged: () => void;
  baseScenarios: () => Scenario[];
  who: () => { students: string[]; batchId: string };
  /** Do on this display what the "startLinked" command does on the others. */
  startLinkedHere: (scenarioJson: string) => void;
  /** This page is the instructor station (its pages are shown under their own tabs, not in the menu). */
  station: boolean;
}

export interface InstructorUi {
  tick: (app: AppState) => void;
  refresh: () => void;
  /** Every exercise on record at this station (and, when the classroom server keeps records, those it holds). */
  history: () => SessionRecord[];
  /** A trainee has chosen a PIN at a display: show it in the list of accounts. */
  accountsChanged: () => void;
  /** A record has come in (from a display): list the records again. */
  recordsChanged: () => void;
}

/** Every exercise a display can be told to start: the ARPA, radar and plotting exercises, then the ROC exercises. */
const REMOTE_EXERCISES = [
  ...[...ARPA_EXERCISES, ...RADAR_EXERCISES, ...PLOTTING_EXERCISES].sort((a, b) => a.number - b.number).map((e) => ({ id: e.id, label: `${e.number}. ${e.title}` })),
  ...EXERCISES.map((e) => ({ id: `roc-${e.id}`, label: `ROC: ${e.name}` })),
];
/** The faults an instructor can send to a display: id, label, and for a number its range and step. */
const REMOTE_FAULTS: { id: (typeof FAULT_IDS)[number]; label: string; min?: number; max?: number; step?: number; off: number | boolean }[] = [
  { id: "gyroErr", label: "Gyro error (°)", min: -5, max: 5, step: 0.5, off: 0 },
  { id: "logErr", label: "Log error (kn)", min: -3, max: 3, step: 0.1, off: 0 },
  { id: "hmErr", label: "Heading marker error (°)", min: -5, max: 5, step: 0.5, off: 0 },
  { id: "vrmErr", label: "VRM error (%)", min: -10, max: 10, step: 1, off: 0 },
  { id: "perf", label: "Radar performance (% of echo power)", min: 10, max: 100, step: 5, off: 100 },
  { id: "logFail", label: "Speed log failed", off: false },
  { id: "gyroFail", label: "Gyro compass failed", off: false },
  { id: "gnssFail", label: "EPFS (GNSS) failed", off: false },
  { id: "sigVideo", label: "Radar video signal lost", off: false },
  { id: "sigSync", label: "Radar sync (trigger) lost", off: false },
  { id: "sigAzimuth", label: "Azimuth signal lost", off: false },
  { id: "sigHm", label: "Heading marker signal lost", off: false },
  { id: "picFreeze", label: "Picture frozen", off: false },
  { id: "anchorDrag", label: "Anchor dragging", off: false },
  { id: "aisRepeat", label: "AIS shore station repeating", off: false },
];

const RCS: Record<TargetKind, { rcs: number; height: number }> = {
  ship: { rcs: 1, height: 20 }, "small-craft": { rcs: 0.04, height: 4 }, buoy: { rcs: 0.015, height: 3 }, beacon: { rcs: 0.5, height: 15 },
};
const KINDS: TargetKind[] = ["ship", "small-craft", "buoy", "beacon"];
/** Type list for a target: the catalogue, then the four plain kinds (no ship model) for older scenarios. */
const typeOptions = (sel: string): string =>
  TARGET_TYPES.map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${t.name}</option>`).join("") +
  KINDS.map((k) => `<option value="kind:${k}" ${`kind:${k}` === sel ? "selected" : ""}>plain ${k}</option>`).join("");
/** Target fields for a choice from `typeOptions`. */
const fieldsFor = (choice: string): Pick<Target, "kind" | "rcs" | "height"> & Partial<Pick<Target, "lengthM" | "typeId">> => {
  const type = targetTypeById(choice);
  if (type) return targetFromType(type);
  const kind = (KINDS.find((k) => `kind:${k}` === choice) ?? "ship") as TargetKind;
  return { kind, ...RCS[kind] };
};

/** Draw a record at time t: coast, own ship's track and the targets' tracks (true motion, north up). */
export function drawReplay(ctx: CanvasRenderingContext2D, size: number, rec: SessionRecord, t: number): void {
  ctx.fillStyle = "#08100e";
  ctx.fillRect(0, 0, size, size);
  if (rec.frames.length === 0) return;
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const f of rec.frames) {
    for (const p of [f.own, ...f.tg]) {
      minE = Math.min(minE, p.e); maxE = Math.max(maxE, p.e); minN = Math.min(minN, p.n); maxN = Math.max(maxN, p.n);
    }
  }
  const span = Math.max(maxE - minE, maxN - minN, 2) * 1.15;
  const cE = (minE + maxE) / 2, cN = (minN + maxN) / 2;
  const k = size / span;
  const X = (e: number): number => size / 2 + (e - cE) * k;
  const Y = (n: number): number => size / 2 - (n - cN) * k;
  ctx.strokeStyle = "#6d6a45";
  ctx.lineWidth = 1.5;
  for (const c of rec.coasts) {
    ctx.beginPath();
    c.forEach((p, i) => (i === 0 ? ctx.moveTo(X(p.e), Y(p.n)) : ctx.lineTo(X(p.e), Y(p.n))));
    ctx.stroke();
  }
  // Scale bar: 1 NM.
  ctx.strokeStyle = "#8aa89a";
  ctx.beginPath();
  ctx.moveTo(10, size - 12);
  ctx.lineTo(10 + k, size - 12);
  ctx.stroke();
  ctx.fillStyle = "#8aa89a";
  ctx.font = "10px monospace";
  ctx.fillText("1 NM", 10, size - 16);
  const upTo = rec.frames.filter((f) => f.t <= t);
  const now = frameInterpolated(rec, t);
  if (!now) return;
  const track = (pts: { e: number; n: number }[], colour: string): void => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(X(p.e), Y(p.n)) : ctx.lineTo(X(p.e), Y(p.n))));
    ctx.stroke();
    for (let i = 0; i < pts.length; i += 6) ctx.fillRect(X(pts[i]!.e) - 1, Y(pts[i]!.n) - 1, 2, 2);
  };
  ctx.fillStyle = "#5fe08a";
  track(upTo.map((f) => f.own), "#5fe08a");
  ctx.beginPath();
  ctx.arc(X(now.own.e), Y(now.own.n), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(`OWN ${String(Math.round(now.own.hdg)).padStart(3, "0")}° ${now.own.spd} kn`, X(now.own.e) + 7, Y(now.own.n) + 3);
  for (const tg of now.tg) {
    ctx.fillStyle = "#ffd24a";
    track(upTo.map((f) => f.tg.find((x) => x.id === tg.id)).filter((x): x is NonNullable<typeof x> => !!x), "#b8963a");
    ctx.beginPath();
    ctx.arc(X(tg.e), Y(tg.n), 3, 0, Math.PI * 2);
    ctx.fill();
    const range = Math.hypot(tg.e - now.own.e, tg.n - now.own.n);
    ctx.fillText(`${rec.names[tg.id] ?? tg.id} ${range.toFixed(1)} NM`, X(tg.e) + 6, Y(tg.n) - 4);
  }
}

/** Trainees' debrief notes and the radio log of a record, as HTML. */
export function debriefHtml(rec: SessionRecord): string {
  const d = rec.debrief;
  const notes = d && (d.self || d.peer || d.goals)
    ? `<p><b>Trainees' review:</b> ${esc(d.self || "-")}<br><b>Peer comments:</b> ${esc(d.peer || "-")}<br><b>Goals:</b> ${esc(d.goals || "-")}</p>`
    : "<p>No debrief notes were entered by the trainees.</p>";
  const comms = rec.comms && rec.comms.length > 0 ? `<p><b>Radio log:</b><br>${rec.comms.map((m) => `${mmss(m.t)} ${esc(m.from)}: ${esc(m.text)}`).join("<br>")}</p>` : "";
  return notes + comms;
}

const DECISION_TEXT: Record<string, string> = { competent: "Competent: task carried out safely and effectively", "not-yet": "Not yet competent", "": "Not yet decided" };

/** Who was at the controls, what the instructor ticked and noted, and the decision for each trainee of a group. */
export function observedHtml(rec: SessionRecord): string {
  const share = controlsShare(rec).filter((s) => s.name);
  const ctl = share.length > 0 ? `<p><b>At the controls:</b> ${share.map((s) => `${esc(s.name)} ${mmss(s.seconds)}`).join(", ")}</p>` : "";
  const obs = rec.observations ?? [];
  const list = obs.length > 0 ? `<h2>Instructor's observations</h2><table><tbody>${obs.map((o) => `<tr><td class="${o.mark === "yes" ? "ok" : "no"}">${o.mark === "yes" ? "Yes" : "No"}</td><td>${esc(o.item)}</td><td>${esc(o.student || "the group")}</td><td>${mmss(o.t)}</td></tr>`).join("")}</tbody></table>` : "";
  const notes = rec.observerNotes ? `<p><b>Instructor's notes:</b> ${esc(rec.observerNotes)}</p>` : "";
  const by = Object.entries(rec.assessorBy ?? {}).filter(([, v]) => v.decision || v.remarks);
  const each = by.length > 0 ? `<h2>Decision for each trainee</h2><table><tbody>${by.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${DECISION_TEXT[v.decision]}</td><td>${esc(v.remarks)}</td></tr>`).join("")}</tbody></table>` : "";
  return ctl + list + notes + each;
}

export function reportHtml(rec: SessionRecord, cfg: ScoringConfig = PLACEHOLDER_SCORING): string {
  const res = rec.result;
  const done = rec.debriefDone;
  const events = rec.events.map((e) => `<tr><td>${mmss(e.t)}</td><td>${e.flag ? `<b>${esc(e.text)}</b>` : esc(e.text)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Exercise report</title>
<style>body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px}h2{font-size:14px;margin-top:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left;font-size:12px}.ok{color:#0a6b2d}.no{color:#b3261e}.small{color:#555;font-size:11px}</style></head><body>
<h1>Radar / ARPA simulator: exercise report</h1>
<p><b>Exercise:</b> ${esc(rec.title)}<br><b>Students:</b> ${esc(rec.students.join(" / ") || "-")} &nbsp; <b>Batch:</b> ${esc(rec.batch || "-")}<br>
<b>Started:</b> ${esc(rec.startedIso)} &nbsp; <b>Simulated time:</b> ${mmss(rec.simSeconds)}</p>
${res ? resultHtml(res) : `<p>${rec.summary.map(esc).join("<br>")}</p>`}
${traineeTableHtml(rec)}
<h2>Debrief</h2>${debriefHtml(rec)}
${done ? `<p><b>Guided debrief:</b> ${done.steps.filter(Boolean).length} of ${DEBRIEF_STEPS.length} steps done on ${esc(done.atIso.slice(0, 10))}.<br><b>Goals agreed:</b> ${esc(done.goals || "-")}</p>` : ""}
${observedHtml(rec)}
<h2>The evidence before the decision</h2>${evidenceHtml(rec, cfg, true)}
<h2>Assessor's decision</h2><p><b>${rec.assessor?.decision === "competent" ? "Competent: task carried out safely and effectively" : rec.assessor?.decision === "not-yet" ? "Not yet competent" : "Not yet decided"}</b>${rec.assessor?.name ? ` &nbsp; Assessor: ${esc(rec.assessor.name)}` : ""}<br>${esc(rec.assessor?.remarks ?? "")}</p>
<h2>Event log</h2><table><tbody>${events}</tbody></table>
<p class="small">Training simulator record. Tolerances and points are placeholders unless the academy has set its own marking scheme. Not a certificate of competence.</p>
<h2>Instructor remarks</h2><p style="height:90px;border:1px solid #999"></p><p>Instructor signature: ____________________ &nbsp; Date: ____________</p>
</body></html>`;
}

export function initInstructorUi(api: InstructorApi): InstructorUi {
  const st = api.store;
  const pane = $("paneInstr");
  pane.innerHTML = `
    <section><h2>Instructor access</h2>
      <div id="inLogin"><div class="btns"><input type="password" id="inPin" placeholder="Instructor PIN" style="flex:1" inputmode="numeric"><button id="inLoginBtn">Log in</button></div>
        <p class="hint">The first PIN is 0000: change it after logging in. The PIN only keeps students out of these pages in class. It is not real security.</p></div>
      <div id="inLogged" hidden><div class="btns"><button id="inLogout">Log out (student view)</button><input type="password" id="inNewPin" placeholder="New PIN (4-8 digits)" style="flex:1" inputmode="numeric"><button id="inSetPin">Change PIN</button></div></div>
      <p class="small wn" id="inMsg"></p></section>
    <div class="instr-only pane">
    <section><h2>Batches, students and assignments</h2>
      <div class="btns"><input type="text" id="inBatchName" placeholder="New batch name" style="flex:1"><button id="inBatchAdd">Add batch</button></div>
      <div class="row two" style="margin-top:8px"><label for="inBatch">Batch</label><select id="inBatch"></select></div>
      <label class="small" for="inStudents">Students (one name per line)</label><textarea id="inStudents" rows="5"></textarea>
      <div class="small" style="margin-top:6px">Assigned exercises:</div><div id="inAssign" class="small"></div>
      <div class="check" style="margin-top:6px"><input type="checkbox" id="inReqLogin"><label for="inReqLogin">Trainees log in with their own name and PIN</label></div>
      <div class="btns"><button id="inBatchSave">Save batch and limits</button><button id="inBatchDel">Delete batch</button></div>
      <h2 style="margin-top:10px">Trainee accounts of this batch</h2>
      <table class="res"><thead><tr><th>Trainee</th><th>PIN</th><th></th></tr></thead><tbody id="inAccts"></tbody></table>
      <div class="btns"><button id="bmShow">Progress of this batch</button></div>
      <div id="bmOut"></div>
      <p class="hint">With "Trainees log in with their own name and PIN" on, a display accepts only a name from the batch with that trainee's PIN, so that a record and a result belong to the person named. A trainee chooses the PIN at the first login (4 to 8 digits, typed twice); "Reset PIN" takes it away, and the trainee chooses a new one at the next login. The trainee can then see his or her own results on the display (EXERCISE, My results). This keeps one trainee from logging in as another in a classroom. It is not real security: only a digest of each PIN is kept, but a short PIN can be found from its digest, and nothing on the classroom network is encrypted. Free practice (the other key of the login screen) stays open and records no names.</p>
      <div class="grid2" style="margin-top:8px"><div><label for="inMaxStu">Students per display</label><input type="number" id="inMaxStu" min="1" max="4" step="1"></div>
        <div><label for="inPairHrs">Hours per pair (blank = not set)</label><input type="number" id="inPairHrs" min="0" step="0.5"></div>
        <div style="grid-column:1/3"><label for="inChange">Change over at the controls every (minutes of exercise time; blank = the trainees change by hand)</label><input type="number" id="inChange" min="1" step="1"></div></div>
      <div id="inPairs" class="small" style="margin-top:6px"></div>
      <p class="hint">Time at the display is counted for each pair of names while a session is open. The limits are the academy's to set; none is enforced unless entered here. With a changeover time set, a display with two or more trainees gives the controls to the next one each time that many minutes of an exercise have passed, with a message on the screen, so that each has a like share; the record shows who had them when. In an examination the trainees change with the parts instead.</p></section>
    <section><h2>Inject events (this display)</h2>
      <div class="row two"><label for="inTgt">Target</label><select id="inTgt"></select></div>
      <div class="grid2"><div><label for="inTgtC">New course (°)</label><input type="number" id="inTgtC" min="0" max="359"></div><div><label for="inTgtS">New speed (kn)</label><input type="number" id="inTgtS" min="0" max="60" step="0.5"></div></div>
      <div class="btns"><button id="inTgtApply">Alter target now</button><button id="inTgtDel">Remove target</button><button id="inTgtAis">Switch its AIS on/off</button></div>
      <div class="btns"><button id="inRtStart">Programme a track</button><button id="inRtUndo">Undo point</button><button id="inRtSet">Set track</button><button id="inRtClear">Take off track</button></div>
      <div class="grid2"><div><label for="inRtSpd">Speed on the track (kn, blank = as now)</label><input type="number" id="inRtSpd" min="0" max="60" step="0.5"></div>
        <div class="check"><input type="checkbox" id="inRtShow"><label for="inRtShow">Show target tracks on this display</label></div></div>
      <p class="small" id="inRtMsg"></p>
      <div class="btns"><button id="inBack2">Take exercise back 2 min</button><button id="inBack5">Back 5 min</button><button id="inBack10">Back 10 min</button></div>
      <div class="grid2" style="margin-top:8px"><div><label for="inNewName">New target name</label><input type="text" id="inNewName" value="Intruder"></div><div><label for="inNewKind">Type</label><select id="inNewKind">${typeOptions("general-cargo")}</select></div>
        <div style="grid-column:1/3"><label for="inNewStd">Echo strength</label><select id="inNewStd"><option value="">Typical for its type</option>${IMO_TABLE2.filter((t) => t.kind !== "coast").map((t, i) => `<option value="${i}">IMO table 2: ${t.name} (X ${t.xNm} NM, S ${t.sNm} NM)</option>`).join("")}</select></div>
        <div><label for="inNewBrg">True bearing (°)</label><input type="number" id="inNewBrg" value="30"></div><div><label for="inNewRng">Range (NM)</label><input type="number" id="inNewRng" value="8" step="0.1"></div>
        <div><label for="inNewC">Course (°)</label><input type="number" id="inNewC" value="210"></div><div><label for="inNewS">Speed (kn)</label><input type="number" id="inNewS" value="12" step="0.5"></div></div>
      <div class="btns"><button id="inNewAdd">Add target now</button></div>
      <p class="hint">Track: press "Programme a track", click up to ${MAX_ROUTE_WAYPOINTS} points on the radar picture in the order the target is to pass them, then "Set track". The target steers from point to point (a ship of a catalogue type turns on its turning circle) and carries on as it goes after the last point. Altering its course by hand, or "Take off track", ends the track. Tracks are drawn only on this display, never on a student's.</p>
      <p class="hint">"Taking the exercise back" returns the ships, weather and faults to that moment so the trainees can try again. Sensor faults (gyro, log, gyro failure) are in the Instructor box on the ARPA tab. Weather, sea state and current are on the Radar tab. Every injection is written to the exercise record.</p></section>
    <section><h2>Monitor other displays</h2><p class="small" id="inLinkMode"></p>
      <h2 style="margin-top:6px">Needs attention</h2><ul class="alarms" id="attList"></ul>
      <div style="overflow-x:auto;margin-top:8px"><table class="res" id="classTable"><thead><tr><th>Display</th><th>At the controls</th><th>Exercise</th><th>Time</th><th>Items</th><th>Points</th><th>Closest vessel</th><th>Action</th><th>Flags</th></tr></thead><tbody id="classRows"></tbody></table></div>
      <p class="hint">Each display watches itself and reports what the instructor should look at: a vessel about to pass too close with no action taken, a dangerous vessel not tracked, land close, the ship off her route or wrong in a traffic lane, an alert left unacknowledged, the radar not transmitting, time running out, controls that may hide echoes, a display left alone. The list is ranked: the most urgent first, and among equals the one that has waited longest. Every flag of the two upper kinds is also bookmarked in the display's record, so what was missed live can be found in the replay. The flags use the real positions of the ships and take no part in the marking. All their limits are placeholders.</p>
      <div id="inStations"></div>
      <div id="watchBox" hidden style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><h2 id="watchTitle"></h2>
        <img id="watchImg" alt="The radar picture of the display being watched" style="width:100%;max-width:560px;aspect-ratio:1/1;background:#000;display:block">
        <p class="small" id="watchNote"></p><ul class="alarms" id="watchFlags"></ul><div class="small" id="watchSet"></div>
        <div class="btns"><button id="watchClose">Stop watching</button></div></div>
      <div id="obsBox" hidden style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><h2 id="obsTitle"></h2>
        <div class="row two"><label for="obsWho">About</label><select id="obsWho"></select></div>
        <div class="check"><input type="checkbox" id="obsStd" checked><label for="obsStd">Show the standard of each item (what Yes and No look like)</label></div>
        <div id="obsItems"></div>
        <label class="small" for="obsNotes">Notes</label><textarea id="obsNotes" rows="2"></textarea>
        <div class="btns"><button id="obsSave">Save notes</button><button id="obsClose">Close the checklist</button><span class="small" id="obsMsg"></span></div>
        <details><summary class="small">Checklist items (one a line; its standard may follow as: item :: what Yes looks like :: what No looks like)</summary><textarea id="obsList" rows="8"></textarea>
          <div class="btns"><button id="obsListSave">Save the list</button><button id="obsListReset">Back to the proposed list</button></div></details>
        <p class="hint">Tick what you see while the exercise runs: Yes for done well, No for not done or done badly; leave an item alone if you did not see it. "About" names the whole group or one trainee. The ticks and the notes go into that exercise's record and its report. Under each item is its standard, so that every instructor ticks against the same words, and what the simulator has measured about it on that display so far (from the real positions: the trainees do not see it). The items and standards proposed are not from any syllabus: put in the objectives you gave at the briefing.</p></div>
      <div class="btns"><button id="inAllPause">Pause all</button><button id="inAllRun">Run all</button><button id="inAllBack">Take all back 2 min</button><button id="inAllReset">Reset all</button></div>
      <p class="hint">"Back 2 min" and "Back 5 min" on a display's card return its ships, weather and faults to that moment so the trainees can try again (its ARPA starts empty; not in an ROC exercise). "Reset" starts its exercise, or its free scenario, again from the beginning; what was done in it so far is not kept.</p>
      <div class="row two" style="margin-top:8px"><label for="inExSel">Exercise</label><select id="inExSel">${REMOTE_EXERCISES.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("")}</select></div>
      <div class="btns"><button id="inExAll">Start this exercise on all displays</button></div>
      <h2 style="margin-top:12px">Faults to send</h2>
      <div class="grid2" id="rfBox">${REMOTE_FAULTS.map((f) => typeof f.off === "number"
        ? `<div><label for="rf_${f.id}">${f.label}</label><input type="number" id="rf_${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.off}"></div>`
        : `<div class="check"><input type="checkbox" id="rf_${f.id}"><label for="rf_${f.id}">${f.label}</label></div>`).join("")}</div>
      <div class="btns"><button id="rfAll">Send these faults to all displays</button><button id="rfClear">Clear the faults on all displays</button></div>
      <p class="hint">Each display's card above has keys for that display alone: Pause, Run, Start exercise (the one chosen above), Send faults (the ones set here) and Clear faults. A fault changes the display's instruments as the FAULTS key does on a display of its own; the trainees are not told.</p>
      <div class="grid2" style="margin-top:6px"><div><label for="inWxSea">Sea state (0-9)</label><input type="number" id="inWxSea" min="0" max="9" value="3"></div>
        <div class="small"><label><input type="checkbox" id="inWxRain"> Rain squall</label><br><label><input type="checkbox" id="inWxDuct"> Abnormal propagation</label><br><label><input type="checkbox" id="inWxInt"> Radar interference</label></div></div>
      <div class="grid2"><div><label for="inWxRainPct">Rain intensity (% of heavy)</label><input type="number" id="inWxRainPct" min="5" max="100" step="5" value="50"></div>
        <div><label for="inWxWindF">Wind from (°) and speed (kn)</label><span style="display:flex;gap:4px"><input type="number" id="inWxWindF" min="0" max="359" placeholder="from"><input type="number" id="inWxWindS" min="0" max="70" placeholder="kn"></span></div>
        <div><label for="inWxCurS">Current set (°) and drift (kn)</label><span style="display:flex;gap:4px"><input type="number" id="inWxCurS" min="0" max="359" placeholder="set"><input type="number" id="inWxCurD" min="0" max="6" step="0.1" placeholder="kn"></span></div>
        <div><label for="inWxVis">Visibility</label><select id="inWxVis"><option value="">no change</option><option value="good">good</option>${VISIBILITY_STEPS_NM.map((v) => `<option value="${v}">${v} NM</option>`).join("")}</select></div>
        <div><label for="inWxTo">Send the weather to</label><select id="inWxTo"><option value="all">All displays</option></select></div></div>
      <div class="btns"><button id="inWxSend">Set this weather</button></div>
      <p class="hint">Wind and current are sent only when filled in; left blank, each display keeps its own. Visibility does not change the radar picture: the simulator has no view from the windows, so the trainees are told the visibility, a look-out reports each vessel that comes into sight (taken as: her range is not more than the visibility, a placeholder), and Rule 19(d) is applied in the marking to a vessel that was not in sight when the action was taken.</p>
      <h2 style="margin-top:12px">Targets on a display, while the exercise runs</h2>
      <div class="grid2"><div><label for="rtSt">Display</label><select id="rtSt"><option value="all">All displays</option></select></div><div><label for="rtTg">Target</label><select id="rtTg"></select></div>
        <div><label for="rtC">New course (°), blank: no change</label><input type="number" id="rtC" min="0" max="359"></div><div><label for="rtS">New speed (kn), blank: no change</label><input type="number" id="rtS" min="0" max="60" step="0.5"></div></div>
      <div class="btns"><button id="rtAlter">Alter this target now</button><button id="rtDel">Remove this target</button></div>
      <label class="small" for="rtTrack">Track for this target: true bearing / range (NM) from that own ship, in the order she is to pass them, for example 045/6, 090/8</label><input type="text" id="rtTrack" placeholder="045/6, 090/8">
      <div class="btns"><button id="rtTrackSet">Set this track</button><button id="rtTrackOff">Take off this track</button></div>
      <div class="grid2"><div><label for="rtNewName">New target: name</label><input type="text" id="rtNewName" value="Intruder"></div><div><label for="rtNewKind">Type</label><select id="rtNewKind">${TARGET_TYPES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
        <div><label for="rtNewBrg">True bearing from that own ship (°)</label><input type="number" id="rtNewBrg" min="0" max="359" value="30"></div><div><label for="rtNewRng">Range (NM)</label><input type="number" id="rtNewRng" min="0.1" max="48" step="0.1" value="4"></div>
        <div><label for="rtNewC">Course (°)</label><input type="number" id="rtNewC" min="0" max="359" value="210"></div><div><label for="rtNewS">Speed (kn)</label><input type="number" id="rtNewS" min="0" max="60" step="0.5" value="12"></div></div>
      <div class="btns"><button id="rtAdd">Add this target now</button></div>
      <h2 style="margin-top:12px">Random traffic</h2>
      <div class="grid2"><div><label for="rgCount">Ships</label><input type="number" id="rgCount" min="1" max="60" value="12"></div><div><label for="rgThreats">Of them, on close-quarters courses</label><input type="number" id="rgThreats" min="0" max="20" value="3"></div>
        <div><label for="rgMin">From (NM) to (NM) off own ship</label><span style="display:flex;gap:4px"><input type="number" id="rgMin" min="0.5" max="48" step="0.5" value="3"><input type="number" id="rgMax" min="1" max="48" step="0.5" value="12"></span></div>
        <div><label for="rgSeed">Seed (the same seed gives the same ships)</label><input type="number" id="rgSeed" min="1" max="999999" value="1"></div></div>
      <div class="check"><input type="checkbox" id="rgReplace"><label for="rgReplace">In place of the ships there now (buoys and beacons stay)</label></div>
      <div class="btns"><button id="rgSend">Random traffic on the display chosen above</button><button id="rgOwn">On the station's own radar</button><button id="rgNew">New seed</button></div>
      <p class="hint">The targets of the display chosen are listed from its last report. An alteration, a new target or random traffic acts at once on that display and is written to its record; the trainees are not told. A ship of a catalogue type comes round and changes speed gradually. Ships on close-quarters courses pass within 0.5 NM of that own ship in 15 to 35 minutes if nobody acts.</p>
      <div class="btns"><button id="inLinked">Start a LINKED exercise on all displays with the scenario loaded here</button></div>
      <div class="btns"><input type="text" id="inMsgText" placeholder="Message to all displays" style="flex:1"><button id="inMsgSend">Send</button></div>
      <p class="hint">A linked exercise loads the same scenario on every display at the same moment, puts each own ship at a different start 5 NM from the scenario start, and shows every own ship to the others as a target. It runs at 1x. Other browser tabs on this computer appear here at once. For other computers, start "npm run serve" on one PC and open the address it prints on every display.</p></section>
    <section><h2>Records, replay and reports</h2>
      <table class="res"><thead><tr><th>When</th><th>Students</th><th>Exercise</th><th>%</th><th></th></tr></thead><tbody id="inRecs"></tbody></table>
      <div class="btns"><button id="inCsvAll">Export all (CSV)</button><button id="asCmp">Assessors compared</button></div>
      <div class="row two"><label for="tfWho">Trainee</label><select id="tfWho"></select></div>
      <div class="btns"><button id="tfPrint">Trainee file (print or save as PDF)</button><button id="phShow">Progress of this trainee</button></div>
      <div id="phOut"></div>
      <div id="asCmpOut"></div>
      <p class="hint">The trainee file is one page for one person: every recorded exercise he or she took part in, with the time at the controls, the answers and actions that were his or her own, the observations about him or her and the decision. "Assessors compared" sets the assessors side by side: how many exercises each found competent, the mean score of those and of the ones found not yet competent, and how many decisions went against the record. Like figures mean like marking; a difference is a reason to talk, not a proof, since the classes may have differed. The newest ${MAX_RECORDS} exercises are kept with their replay; older ones stay in the files and comparisons without it.</p>
      <h2 style="margin-top:10px">Keeping the records</h2>
      <p class="small" id="svState"></p>
      <div class="btns" id="svKeyRow"><input type="text" id="svKey" placeholder="Server key (the classroom server prints it when it starts)" style="flex:1" autocomplete="off"><button id="svKeySet">Use this server key</button></div>
      <div class="row two" id="svOldRow" hidden><label for="svOld">On the server, its replay not in this browser</label><select id="svOld"></select></div>
      <div class="btns"><button id="svOpen" hidden>Bring this exercise back with its replay</button><button id="svRestore" hidden>Take the batches and settings from the server</button></div>
      <div class="btns"><button id="bkSave">Back up everything (JSON)</button><button id="bkLoad">Restore from a backup</button><input type="file" id="bkFile" accept="application/json,.json" hidden></div>
      <p class="hint">This browser keeps the newest ${MAX_RECORDS} exercises with their replay and 300 older ones without. To keep more, and to keep them apart from this browser: (1) the classroom server ("npm run serve") can keep every record with its replay, and the batches and settings, as files in its "data" folder on its own computer. Type the station key it prints when it starts; from then on this station sends each record there, and the trainee files, the progress and the comparisons reach back over all of them. (2) "Back up everything" saves the class and every record held here in one file; "Restore from a backup" adds the records and batches this station does not have (on a station with no batch yet it takes the settings too) and never deletes. Neither is encrypted: the files hold trainees' names and results, so keep them as the institute keeps its other records.</p>
      <div id="inRecView" hidden><h2 style="margin-top:10px" id="inRecTitle"></h2>
        <canvas id="inReplay" style="aspect-ratio:1/1;background:#08100e"></canvas>
        <p class="small" id="inPicNote"></p>
        <img id="inPic" alt="The radar picture as the trainee saw it" style="width:100%;aspect-ratio:1/1;background:#000;display:block" hidden>
        <div class="btns"><button id="inPlay">Play</button><input type="range" id="inScrub" min="0" max="100" value="0" style="flex:1"><span class="val" id="inScrubT">00:00</span></div>
        <div class="row two"><label for="inReplaySpeed">Replay speed</label><select id="inReplaySpeed">${REPLAY_SPEEDS.map((v) => `<option value="${v}"${v === 30 ? " selected" : ""}>${v}x${v < 1 ? " (slow motion)" : v === 1 ? " (real time)" : ""}</option>`).join("")}</select></div>
        <p class="small" id="inRecMarksT"></p><div class="btns" id="inRecMarks"></div>
        <div class="log" id="inRecEvents"></div><div id="inRecResult"></div>
        <div id="inRecBy"></div>
        <div id="inRecDebrief" class="small"></div>
        <h2 style="margin-top:10px">Guided debrief</h2>
        <div id="gdSteps"></div>
        <label class="small" for="gdGoals">Goals agreed with the trainees</label><textarea id="gdGoals" rows="2"></textarea>
        <div class="btns"><button id="gdSave">Save the debrief</button><button id="gdPrint">Debrief pack (print or save as PDF)</button><button id="clsShow">The class on this exercise</button><span class="small" id="gdMsg"></span></div>
        <div id="clsOut"></div>
        <p class="hint">The same five steps for every debrief, laid out from the record of this exercise: the trainees speak first, then the key moments in the replay, then the facts against the criteria, then the questions, then the goals. Tick each step as it is done. The questions are written from what happened in this exercise; the exercise's own questions follow them. "The class on this exercise" lists every recorded attempt at it, for a debrief of the whole class.</p>
        <h2 style="margin-top:10px">The evidence before the decision</h2>
        <div id="inRecEvid" class="small"></div>
        <h2 style="margin-top:10px">Assessor's decision</h2>
        <div class="grid2"><div><label for="asDec">Decision</label><select id="asDec"><option value="">not yet decided</option><option value="competent">Competent: task carried out safely and effectively</option><option value="not-yet">Not yet competent</option></select></div>
          <div><label for="asName">Assessor</label><input type="text" id="asName"></div></div>
        <label class="small" for="asRem">Remarks</label><textarea id="asRem" rows="2"></textarea>
        <div id="asBy"></div>
        <div id="asCheck" class="small"></div>
        <div class="btns"><button id="asSave">Save decision</button><span class="small" id="asMsg"></span></div>
        <p class="hint">The score is a guide only. The assessor's decision is the prime criterion (STCW Code A-I/12, paragraph 8). The evidence is set out above so that the same things are weighed every time. A decision that goes against it can still be made: the reason must then be written in the remarks, and it is kept with the record.</p>
        <div class="btns"><button id="inRecCsv">Result (CSV)</button><button id="inRecPrint">Report (print or save as PDF)</button><button id="inRecJson">Record (JSON)</button></div></div></section>
    <section><h2>Self-test of the exercises</h2>
      <div class="btns"><button id="stRun">Run self-test (about half a minute)</button><span class="small" id="stMsg"></span></div>
      <table class="trk"><thead><tr><th></th><th>Exercise</th><th>Careful robot</th><th>Wrong robot</th><th>Idle robot</th></tr></thead><tbody id="stRows"></tbody></table>
      <ul class="alarms" id="stProblems"></ul>
      <p class="hint">Three robots work every ARPA, radar and plotting exercise in the background. The careful robot does what the briefing asks and answers from the answer key: it must get 100%. The wrong robot gives wrong answers: all must be rejected. The idle robot does nothing: it must not be credited. This checks that every exercise runs, can be completed and is marked properly. It does not check that the answer key is good seamanship. The ROC exercises are not included.</p>
    </section>
    <section><h2>Scoring settings (placeholders)</h2><div class="grid2" id="inScore"></div>
      <div class="btns"><button id="inScoreSave">Save scoring</button><button id="inScoreReset">Reset to placeholders</button></div>
      <div class="grid2" style="margin-top:8px"><div><label for="inTlEx">Time limit for the exercise</label><select id="inTlEx">${REMOTE_EXERCISES.filter((e) => !e.id.startsWith("roc-")).map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("")}</select></div>
        <div><label for="inTlMin">Minutes allowed (blank: none, or the exercise's own)</label><input type="number" id="inTlMin" min="1" step="1"></div></div>
      <div class="btns"><button id="inTlSet">Set this time limit</button><span class="small" id="inTlNow"></span></div>
      <p class="hint">An exercise with a time limit gets one more marked item, "Finished within the time allowed", and the trainee sees the time left. The limit is exercise time, so it does not run while the exercise is paused.</p>
      <p class="hint">None of these values comes from an approved marking scheme. Leave the pass mark blank to report scores without pass or fail.</p></section>
    <section><h2>Examinations</h2>
      <div class="grid2"><div><label for="exmRoc">ROC practical examination: its parts</label><select id="exmRoc" multiple size="8">${REMOTE_EXERCISES.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("")}</select></div>
        <div><label for="exmArpa">ARPA practical examination: its parts</label><select id="exmArpa" multiple size="8">${REMOTE_EXERCISES.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("")}</select></div></div>
      <div class="btns"><button id="exmSave">Save the parts</button><button id="exmReset">Back to the proposed parts</button></div>
      <div class="row two"><label for="exmTo">Display</label><select id="exmTo"><option value="all">All displays</option></select></div>
      <div class="btns"><button id="exmStartRoc">Start the ROC examination</button><button id="exmStartArpa">Start the ARPA examination</button><button id="exmPrint">Examination results (print or save as PDF)</button></div>
      <p class="small" id="exmNow"></p>
      <p class="hint">An examination is a set of exercises worked one after the other on a display, in the order of the list. Hold Ctrl (or Cmd) and click to choose the parts. The parts proposed here are not from any syllabus: choose the institute's own. When a part is finished the display offers the next one; every part is recorded as usual and marked as part of the examination. "Examination results" prints one page for each examination taken, with the points of every part, their total and room for the assessor's decision. The ROC exercises are marked on the first check of the answers. Target names (a study aid) are switched off on the display.</p></section>
    <section><h2>Exercise sheets</h2>
      <div class="row two"><label for="xsEx">Exercise</label><select id="xsEx"></select></div>
      <div class="btns"><button id="xsPrint">Print exercise sheet (or save as PDF)</button></div>
      <p class="hint">One sheet of the same form for every exercise, for the trainees and the instructor: the objective, the briefing, every item the simulator marks and the limit it uses, the instructor's checklist with the standard for each item, the pass standard and the debrief questions. It is made from the same data that does the marking, so the sheet and the marking cannot differ. Give it out at the briefing. The marking sheets below are a different paper: they are for the institute to write in its own limits.</p></section>
    <section><h2>Marking sheets</h2>
      <div class="row two"><label for="msEx">Exercise</label><select id="msEx"></select></div>
      <div class="btns"><button id="msPrint">Print marking sheet (or save as PDF)</button></div>
      <p class="hint">One page per exercise for the institute to fill in: what the simulator checks and the value it uses now, with empty boxes for the institute's own tolerances, points and pass mark, the items the assessor judges, and the assessor's decision and signature. The values printed are the scoring settings above: placeholders until the institute changes them. The syllabus references on each sheet are a draft (docs/SYLLABUS-MATRIX.md).</p></section>
    <section><h2>Scenario editor</h2>
      <div class="row two"><label for="edBase">Start from</label><select id="edBase"></select></div>
      <div class="grid2"><div><label for="edName">Scenario name</label><input type="text" id="edName"></div><div><label for="edSea">Sea state (0-9)</label><input type="number" id="edSea" min="0" max="9"></div>
        <div><label for="edHdg">Own heading (°)</label><input type="number" id="edHdg" min="0" max="359"></div><div><label for="edSpd">Own speed (kn)</label><input type="number" id="edSpd" min="0" max="40" step="0.5"></div>
        <div><label for="edSet">Current set (°)</label><input type="number" id="edSet" min="0" max="359"></div><div><label for="edDrift">Current drift (kn)</label><input type="number" id="edDrift" min="0" max="6" step="0.1"></div>
        <div><label for="edVis">Visibility (NM; blank = good)</label><input type="number" id="edVis" min="0.05" max="20" step="0.05"></div></div>
      <div style="overflow-x:auto"><table class="res" id="edTable"><thead><tr><th>Name</th><th>Kind</th><th>Brg</th><th>Rng</th><th>Crs</th><th>Spd</th><th>At min</th><th>→Crs</th><th>→Spd</th><th></th></tr></thead><tbody id="edRows"></tbody></table></div>
      <div class="btns"><button id="edAdd">Add target</button><button id="edLoad">Load in simulator</button><button id="edSave">Save to library</button></div>
      <div class="btns"><button id="edDown">Download JSON</button><button id="edUp">Open JSON file</button><button id="edDel">Delete from library</button><input type="file" id="edFile" accept=".json,application/json" hidden></div>
      <ul class="msgs" id="edMsg"></ul>
      <p class="hint">Bearing and range are from own ship's starting position. "At min / →Crs / →Spd" is one optional alteration by the target. Coastlines and hazards are kept from the scenario you start from. Saved scenarios appear in the Free practice list on the Radar tab.</p></section>
    </div>`;

  const msg = (t: string): void => {
    $("inMsg").textContent = t;
  };

  // ------------------------------------------------------------ login
  $("inLoginBtn").addEventListener("click", () => {
    if (st.checkPin(inputValue("inPin"))) {
      api.setRole("instructor");
      msg("");
    } else msg("Wrong PIN.");
    ($("inPin") as HTMLInputElement).value = "";
  });
  $("inLogout").addEventListener("click", () => api.setRole("student"));

  // ------------------------------------------------------------ self-test
  let stBusy = false;
  $("stRun").addEventListener("click", () => {
    if (stBusy) return;
    stBusy = true;
    const rows: SelfTestRow[] = [];
    const list = SELF_TEST_EXERCISES;
    $("stRows").innerHTML = "";
    $("stProblems").innerHTML = "";
    const started = performance.now();
    // One exercise at a time, giving the screen a turn in between so the display does not freeze.
    const next = (i: number): void => {
      if (i >= list.length) {
        const bad = rows.filter((r) => !r.ok);
        $("stMsg").innerHTML = bad.length === 0
          ? `<span class="ok">ALL ${rows.length} EXERCISES PASSED</span> in ${Math.round((performance.now() - started) / 1000)} s`
          : `<span class="no">${bad.length} of ${rows.length} exercises FAILED</span>`;
        $("stProblems").innerHTML = bad.flatMap((r) => r.problems.map((p) => `<li class="no">${esc(r.title)}: ${esc(p)}</li>`)).join("");
        stBusy = false;
        return;
      }
      $("stMsg").textContent = `Working exercise ${i + 1} of ${list.length} ...`;
      window.setTimeout(() => {
        const r = selfTestExercise(list[i]!);
        rows.push(r);
        $("stRows").insertAdjacentHTML("beforeend", `<tr><td class="${r.ok ? "ok" : "no"}">${r.ok ? "PASS" : "FAIL"}</td><td>${esc(r.title)}</td><td>${esc(r.careful)}</td><td>${esc(r.wrong)}</td><td>${esc(r.idle)}</td></tr>`);
        next(i + 1);
      }, 20);
    };
    next(0);
  });
  $("inSetPin").addEventListener("click", () => {
    msg(st.setPin(inputValue("inNewPin")) ? "PIN changed." : "The PIN must be 4 to 8 digits.");
    ($("inNewPin") as HTMLInputElement).value = "";
  });

  // ------------------------------------------------------------ batches
  const allExercises = [...ARPA_EXERCISES.map((e) => ({ id: e.id, label: `ARPA ${e.number}` })), ...RADAR_EXERCISES.map((e) => ({ id: e.id, label: `Radar ${e.number}` })), ...PLOTTING_EXERCISES.map((e) => ({ id: e.id, label: `Plotting ${e.number}` })), ...EXERCISES.map((e) => ({ id: `roc-${e.id}`, label: `ROC ${e.name}` }))];
  const batchSel = $<HTMLSelectElement>("inBatch");
  /** The trainees of the batch chosen, each with whether a PIN has been chosen. */
  const drawAccounts = (): void => {
    const b = st.data.batches.find((x) => x.id === batchSel.value);
    const html = !b || b.students.length === 0 ? '<tr><td colspan="3" class="small">No trainees in this batch yet.</td></tr>'
      : b.students.map((n) => `<tr><td>${esc(n)}</td><td>${hasPin(b, n) ? "set" : "none yet: chosen at the first login"}</td><td>${hasPin(b, n) ? `<button data-reset="${esc(n)}">Reset PIN</button>` : ""}</td></tr>`).join("");
    const box = $("inAccts");
    if (box.dataset["sig"] !== html) {
      box.dataset["sig"] = html;
      box.innerHTML = html;
    }
  };
  $("inAccts").addEventListener("click", (ev) => {
    const name = (ev.target as HTMLElement).closest("button")?.dataset["reset"];
    if (!name || !batchSel.value) return;
    st.setStudentPin(batchSel.value, name, null);
    msg(`PIN of ${name} reset: a new one is chosen at the next login.`);
    drawAccounts();
  });
  const showBatch = (): void => {
    const b = st.data.batches.find((x) => x.id === batchSel.value);
    drawAccounts();
    ($("inStudents") as HTMLTextAreaElement).value = b ? b.students.join("\n") : "";
    $("inAssign").innerHTML = allExercises.map((e) => `<label style="margin-right:8px;white-space:nowrap"><input type="checkbox" data-as="${e.id}" ${b?.assigned.includes(e.id) ? "checked" : ""}> ${e.label}</label>`).join(" ");
  };
  const fillBatches = (keep?: string): void => {
    const cur = keep ?? batchSel.value;
    batchSel.innerHTML = st.data.batches.map((b) => `<option value="${b.id}">${esc(b.name)} (${b.students.length})</option>`).join("") || '<option value="">no batches yet</option>';
    if (st.data.batches.some((b) => b.id === cur)) batchSel.value = cur;
    showBatch();
    ($("inMaxStu") as HTMLInputElement).value = String(st.data.maxStudentsPerDisplay);
    ($("inPairHrs") as HTMLInputElement).value = st.data.targetHoursPerPair === null ? "" : String(st.data.targetHoursPerPair);
    ($("inChange") as HTMLInputElement).value = st.data.changeoverMin ? String(st.data.changeoverMin) : "";
    ($("inReqLogin") as HTMLInputElement).checked = !!st.data.requireLogin;
    const tgt = st.data.targetHoursPerPair;
    $("inPairs").innerHTML = Object.entries(st.data.pairSeconds).map(([k, s]) => `${esc(k)}: ${(s / 3600).toFixed(2)} h${tgt !== null ? ` of ${tgt} h` : ""}`).join("<br>") || "No display time recorded yet.";
  };
  batchSel.addEventListener("change", showBatch);
  $("inBatchAdd").addEventListener("click", () => {
    const b = st.addBatch(inputValue("inBatchName"));
    msg(b ? "" : "Enter a new, unused batch name.");
    if (b) {
      ($("inBatchName") as HTMLInputElement).value = "";
      fillBatches(b.id);
    }
  });
  $("inBatchSave").addEventListener("click", () => {
    const id = batchSel.value;
    if (id) {
      st.setStudents(id, inputValue("inStudents").split("\n"));
      st.setAssigned(id, [...$("inAssign").querySelectorAll<HTMLInputElement>("input:checked")].map((c) => c.dataset["as"]!));
    }
    // The limits for the whole class are saved with or without a batch.
    st.data.maxStudentsPerDisplay = Math.min(4, Math.max(1, Math.round(Number(inputValue("inMaxStu")) || 2)));
    const h = inputValue("inPairHrs");
    st.data.targetHoursPerPair = h === "" ? null : Math.max(0, Number(h));
    st.data.requireLogin = ($("inReqLogin") as HTMLInputElement).checked;
    const ch = inputValue("inChange");
    st.data.changeoverMin = ch === "" || !(Number(ch) > 0) ? null : Math.max(1, Math.round(Number(ch)));
    msg(st.save() ? (id ? "Batch saved." : "Class limits saved (no batch is chosen).") : "Could not save: the browser's storage is full or blocked.");
    fillBatches(id);
  });
  $("inBatchDel").addEventListener("click", () => {
    if (batchSel.value && confirm("Delete this batch? Its exercise records are kept.")) {
      st.removeBatch(batchSel.value);
      fillBatches();
    }
  });

  // ------------------------------------------------------------ injection
  const tgtSel = $<HTMLSelectElement>("inTgt");
  let tgtSig = "";
  const note = (app: AppState, text: string): void => {
    app.recorder?.note(app.world, `INSTRUCTOR: ${text}`, true);
  };
  $("inTgtApply").addEventListener("click", () => {
    const app = api.getApp();
    const t = app.world.targets.find((x) => x.id === Number(tgtSel.value));
    if (!t) return;
    const c = inputValue("inTgtC"), s = inputValue("inTgtS");
    if (c !== "" && t.route) clearTargetRoute(t); // a course ordered by hand takes the target off its track
    orderTarget(t, { ...(c !== "" ? { course: Number(c) } : {}), ...(s !== "" ? { speed: Number(s) } : {}) });
    note(app, `${t.name} ordered to ${c !== "" ? `${Math.round(normalizeDeg(Number(c)))}°` : "same course"} ${s !== "" ? `${Number(s)} kn` : "same speed"}${t.motion ? " (comes round gradually)" : ""}.`);
  });
  // Programmed tracks (routes) for targets.
  const selTarget = (app: AppState): Target | undefined => app.world.targets.find((x) => x.id === Number(tgtSel.value));
  let rtWarn = { text: "", until: 0 };
  $("inRtStart").addEventListener("click", () => {
    const app = api.getApp();
    const t = selTarget(app);
    if (!t || t.kind === "buoy" || t.kind === "beacon") {
      rtWarn = { text: "Choose a vessel first: a buoy or a beacon cannot be given a track.", until: performance.now() + 5000 };
      return;
    }
    app.routeEdit = { targetId: t.id, points: [] };
  });
  $("inRtUndo").addEventListener("click", () => {
    api.getApp().routeEdit?.points.pop();
  });
  $("inRtSet").addEventListener("click", () => {
    const app = api.getApp();
    const ed = app.routeEdit;
    const t = ed ? app.world.targets.find((x) => x.id === ed.targetId) : undefined;
    if (!ed || !t || ed.points.length === 0) return;
    const sp = inputValue("inRtSpd");
    setTargetRoute(t, ed.points, sp !== "" ? [Math.max(0, Number(sp))] : undefined);
    note(app, `${t.name} put on a track of ${ed.points.length} waypoint${ed.points.length === 1 ? "" : "s"}${sp !== "" ? ` at ${Number(sp)} kn` : ""}.`);
    app.routeEdit = null;
  });
  $("inRtClear").addEventListener("click", () => {
    const app = api.getApp();
    const t = selTarget(app);
    if (app.routeEdit && (!t || app.routeEdit.targetId === t.id)) app.routeEdit = null;
    if (t?.route) {
      clearTargetRoute(t);
      note(app, `${t.name} taken off its track.`);
    }
  });
  $<HTMLInputElement>("inRtShow").addEventListener("change", () => {
    api.getApp().showRoutes = $<HTMLInputElement>("inRtShow").checked;
  });
  $("inTgtDel").addEventListener("click", () => {
    const app = api.getApp();
    const t = app.world.targets.find((x) => x.id === Number(tgtSel.value));
    if (!t) return;
    app.world.targets = app.world.targets.filter((x) => x !== t);
    note(app, `${t.name} removed.`);
  });
  $("inTgtAis").addEventListener("click", () => {
    const app = api.getApp();
    const t = app.world.targets.find((x) => x.id === Number(tgtSel.value));
    if (!t) return;
    t.ais = !(t.ais ?? t.kind === "ship");
    note(app, `${t.name}: AIS ${t.ais ? "switched on" : "switched off"}.`);
  });
  for (const [id, sec] of [["inBack2", 120], ["inBack5", 300], ["inBack10", 600]] as const) {
    $(id).addEventListener("click", () => {
      const t = rewind(api.getApp(), sec);
      msg(t === null ? "Nothing that far back to return to (states are kept every minute; not available in ROC exercises)." : `Exercise taken back to ${mmss(t)}. The ARPA is empty: targets must be acquired again.`);
    });
  }
  $("inNewAdd").addEventListener("click", () => {
    const app = api.getApp();
    const w = app.world;
    const type = targetTypeById(inputValue("inNewKind")) ?? TARGET_TYPES[0]!;
    const rel = fromPolar(Number(inputValue("inNewBrg")) || 0, Math.max(0.1, Number(inputValue("inNewRng")) || 1));
    const t: Target = {
      id: nextTargetId(w), name: inputValue("inNewName") || "Intruder",
      pos: { e: w.own.pos.e + rel.e, n: w.own.pos.n + rel.n }, course: normalizeDeg(Number(inputValue("inNewC")) || 0), speed: Math.max(0, Number(inputValue("inNewS")) || 0),
      ...targetFromType(type), events: [], nextEvent: 0,
    };
    if (type.fixed) t.speed = 0;
    const std = IMO_TABLE2.filter((x) => x.kind !== "coast")[Number(inputValue("inNewStd"))];
    if (inputValue("inNewStd") !== "" && std) {
      // A standard target from IMO MSC.192(79) table 2: first detected at the table's range.
      t.rcs = rcsForDetectionRange(std.xNm);
      t.height = std.heightM;
      t.kind = std.kind as TargetKind;
    }
    initTargetMotion(t);
    w.targets.push(t);
    note(app, `${t.name} added at ${Math.round(bearingOf(rel))}° ${length(rel).toFixed(1)} NM, course ${Math.round(t.course)}° ${t.speed} kn.`);
  });

  // ------------------------------------------------------------ monitor
  const stations = new Map<string, StationStatus>();
  api.link.addStatusListener((s) => stations.set(s.station, s));
  $("inAllPause").addEventListener("click", () => api.link.sendCommand({ to: "all", cmd: "pause" }));
  $("inAllRun").addEventListener("click", () => api.link.sendCommand({ to: "all", cmd: "run" }));
  $("inAllBack").addEventListener("click", () => {
    api.link.sendCommand({ to: "all", cmd: "rewind", seconds: 120 });
    msg("All displays asked to go back 2 min.");
  });
  $("inAllReset").addEventListener("click", () => {
    if (!confirm("Start every display's exercise again from the beginning? What the trainees have done so far is not kept.")) return;
    api.link.sendCommand({ to: "all", cmd: "restart" });
    msg("All displays started again from the beginning.");
  });
  $("inWxSend").addEventListener("click", () => {
    const chk = (id: string): boolean => ($(id) as HTMLInputElement).checked;
    const opt = (id: string): number | undefined => (inputValue(id) === "" ? undefined : Number(inputValue(id)));
    const w = { windFrom: opt("inWxWindF"), windKn: opt("inWxWindS"), curSet: opt("inWxCurS"), curDrift: opt("inWxCurD") };
    api.link.sendCommand({
      to: inputValue("inWxTo") || "all", cmd: "weather", seaState: Math.min(9, Math.max(0, Number(inputValue("inWxSea")) || 0)), rain: chk("inWxRain"), ducting: chk("inWxDuct"), interference: chk("inWxInt"),
      rainPct: Math.min(100, Math.max(5, Number(inputValue("inWxRainPct")) || 50)),
      ...(inputValue("inWxVis") === "" ? {} : { visNm: inputValue("inWxVis") === "good" ? null : Number(inputValue("inWxVis")) }),
      ...Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined && Number.isFinite(v))),
    });
    msg(`Weather sent to ${inputValue("inWxTo") === "all" ? "all displays" : `display ${inputValue("inWxTo")}`}.`);
  });
  // Targets on a trainee's display, while the exercise runs.
  const rtTo = (): string => inputValue("rtSt") || "all";
  const optNum = (id: string): number | undefined => (inputValue(id) === "" || !Number.isFinite(Number(inputValue(id))) ? undefined : Number(inputValue(id)));
  $("rtAlter").addEventListener("click", () => {
    const id = Number(inputValue("rtTg"));
    const course = optNum("rtC"), speed = optNum("rtS");
    if (!id || (course === undefined && speed === undefined)) {
      msg("Choose a target and give a new course or speed.");
      return;
    }
    api.link.sendCommand({ to: rtTo(), cmd: "target", id, ...(course !== undefined ? { course: normalizeDeg(course) } : {}), ...(speed !== undefined ? { speed: Math.max(0, speed) } : {}) });
    msg(`Alteration sent to ${rtTo() === "all" ? "all displays" : `display ${rtTo()}`}.`);
  });
  $("rtDel").addEventListener("click", () => {
    const id = Number(inputValue("rtTg"));
    if (!id) return;
    api.link.sendCommand({ to: rtTo(), cmd: "removeTarget", id });
    msg("Target removed.");
  });
  // A programmed track for a target on a trainee's display, typed as points from that display's own ship.
  $("rtTrackSet").addEventListener("click", () => {
    const id = Number(inputValue("rtTg"));
    const points = parseTrackText(inputValue("rtTrack"));
    if (!id || !points) {
      msg(`Choose a target and type the points as bearing/range, for example 045/6, 090/8 (at most ${MAX_ROUTE_WAYPOINTS}).`);
      return;
    }
    api.link.sendCommand({ to: rtTo(), cmd: "track", id, points });
    msg(`Track of ${points.length} point${points.length === 1 ? "" : "s"} sent to ${rtTo() === "all" ? "all displays" : `display ${rtTo()}`}. The target steers from point to point and carries on as she goes after the last.`);
  });
  $("rtTrackOff").addEventListener("click", () => {
    const id = Number(inputValue("rtTg"));
    if (!id) return;
    api.link.sendCommand({ to: rtTo(), cmd: "track", id, points: [] });
    msg("Target taken off her track: she keeps the course and speed she has.");
  });
  $("rtAdd").addEventListener("click", () => {
    api.link.sendCommand({
      to: rtTo(), cmd: "addTarget", name: inputValue("rtNewName") || "Intruder", typeId: inputValue("rtNewKind"), bearing: normalizeDeg(Number(inputValue("rtNewBrg")) || 0),
      rangeNm: Math.max(0.1, Number(inputValue("rtNewRng")) || 1), course: normalizeDeg(Number(inputValue("rtNewC")) || 0), speed: Math.max(0, Number(inputValue("rtNewS")) || 0),
    });
    msg(`Target sent to ${rtTo() === "all" ? "all displays" : `display ${rtTo()}`}.`);
  });
  const trafficOpts = (): { seed: number; count: number; minNm: number; maxNm: number; threats: number; replace: boolean } => {
    const count = Math.min(60, Math.max(1, Math.floor(Number(inputValue("rgCount")) || 12)));
    const minNm = Math.max(0.5, Number(inputValue("rgMin")) || 3);
    return { seed: Math.max(1, Math.floor(Number(inputValue("rgSeed")) || 1)), count, minNm, maxNm: Math.max(minNm + 0.5, Number(inputValue("rgMax")) || 12), threats: Math.min(count, Math.max(0, Math.floor(Number(inputValue("rgThreats")) || 0))), replace: $<HTMLInputElement>("rgReplace").checked };
  };
  $("rgSend").addEventListener("click", () => {
    api.link.sendCommand({ to: rtTo(), cmd: "traffic", ...trafficOpts() });
    msg(`Random traffic sent to ${rtTo() === "all" ? "all displays" : `display ${rtTo()}`}.`);
  });
  $("rgOwn").addEventListener("click", () => {
    const app = api.getApp();
    const o = trafficOpts();
    const n = addRandomTraffic(app.world, { ...RANDOM_TRAFFIC_DEFAULT, count: o.count, minNm: o.minNm, maxNm: o.maxNm, threats: o.threats }, o.seed, o.replace);
    note(app, `random traffic, ${n} ships (seed ${o.seed}, ${o.threats} on close-quarters courses).`);
    msg(`${n} ships put on the station's own radar. The same seed sent to a display gives it the same ships round its own ship.`);
  });
  $("rgNew").addEventListener("click", () => {
    $<HTMLInputElement>("rgSeed").value = String(1 + Math.floor(Math.random() * 999998));
  });
  $("inLinked").addEventListener("click", () => {
    const app = api.getApp();
    api.link.sendCommand({ to: "all", cmd: "startLinked", scenarioJson: scenarioToJson(app.scenario) });
    api.startLinkedHere(scenarioToJson(app.scenario));
  });
  $("inMsgSend").addEventListener("click", () => {
    const text = inputValue("inMsgText").trim();
    if (text) api.link.sendCommand({ to: "all", cmd: "message", text });
  });
  $("inStations").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    const to = b?.dataset["st"];
    const cmd = b?.dataset["cmd"];
    if (!to || !cmd) return;
    if (cmd === "pause" || cmd === "run") api.link.sendCommand({ to, cmd });
    if (cmd === "ex") api.link.sendCommand({ to, cmd: "startExercise", id: inputValue("inExSel") });
    if (cmd === "faults") api.link.sendCommand({ to, cmd: "faults", values: faultValues(false) });
    if (cmd === "clear") api.link.sendCommand({ to, cmd: "faults", values: faultValues(true) });
    if (cmd === "watch") {
      watch(to);
      return;
    }
    if (cmd === "obs") {
      observe(to);
      return;
    }
    if (cmd === "back2" || cmd === "back5") {
      const s = stations.get(to);
      if (s && /^ROC /.test(s.exercise)) {
        msg("An ROC exercise cannot be taken back in time. Reset starts it again.");
        return;
      }
      api.link.sendCommand({ to, cmd: "rewind", seconds: cmd === "back2" ? 120 : 300 });
      msg(`Display ${to} asked to go back ${cmd === "back2" ? 2 : 5} min. Its time in the table shows when it has (states are kept every minute).`);
      return;
    }
    if (cmd === "reset") {
      if (!confirm("Start this display's exercise again from the beginning? What the trainees have done in it so far is not kept.")) return;
      api.link.sendCommand({ to, cmd: "restart" });
      msg(`Display ${to} started again from the beginning.`);
      return;
    }
    msg(`Sent to display ${to}.`);
  });
  /** The faults set under "Faults to send", or all of them off. */
  const faultValues = (off: boolean): Record<string, number | boolean> =>
    Object.fromEntries(REMOTE_FAULTS.map((f) => {
      const e = $<HTMLInputElement>(`rf_${f.id}`);
      return [f.id, off ? f.off : typeof f.off === "boolean" ? e.checked : Math.min(f.max ?? 100, Math.max(f.min ?? 0, Number(e.value) || 0))];
    }));
  $("rfAll").addEventListener("click", () => {
    api.link.sendCommand({ to: "all", cmd: "faults", values: faultValues(false) });
    msg("Faults sent to all displays.");
  });
  $("rfClear").addEventListener("click", () => {
    api.link.sendCommand({ to: "all", cmd: "faults", values: faultValues(true) });
    msg("Faults cleared on all displays.");
  });
  $("inExAll").addEventListener("click", () => {
    api.link.sendCommand({ to: "all", cmd: "startExercise", id: inputValue("inExSel") });
    msg("Exercise started on all displays.");
  });
  // ---- What needs attention, the class table, the live view of one display and the observation checklist.
  const nameOf = (s: StationStatus): string => s.students.join(" / ") || s.station;
  const flagSince = new Map<string, number>();
  let watching: string | null = null;
  let watchAsked = 0;
  let observing: string | null = null;
  const watch = (station: string | null): void => {
    if (watching && watching !== station) api.link.sendCommand({ to: watching, cmd: "watch", on: false });
    watching = station;
    watchAsked = 0;
    $("watchBox").hidden = !station;
    if (station) {
      $<HTMLImageElement>("watchImg").removeAttribute("src");
      $("watchNote").textContent = "Waiting for the picture...";
    }
  };
  $("watchClose").addEventListener("click", () => watch(null));
  api.link.onPicture = (p) => {
    if (p.station !== watching) return;
    $<HTMLImageElement>("watchImg").src = p.url;
    $("watchNote").textContent = `The radar picture as the trainee sees it, at exercise time ${mmss(p.t)}. A new picture comes every two seconds.`;
  };
  $("attList").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (b?.dataset["st"]) watch(b.dataset["st"]!);
  });
  const checklist = (): ChecklistItem[] => parseChecklist(st.data.obsItems);
  const pendingFor = (recId: string): { items: Observation[]; notes: string } => ((st.data.pendingObs ??= {})[recId] ??= { items: [], notes: "" });
  /** Observations ticked for a display go into its record as soon as the record is here (and again if the display sends it anew). */
  const mergeObservations = (): void => {
    const p = st.data.pendingObs;
    if (!p) return;
    // Only the observations of the last hundred exercises are kept waiting.
    for (const k of Object.keys(p).slice(0, Math.max(0, Object.keys(p).length - 100))) delete p[k];
    let changed = false;
    for (const r of st.data.records) {
      const o = p[r.id];
      if (!o || (o.items.length === 0 && o.notes === "")) continue;
      if (JSON.stringify(r.observations ?? []) !== JSON.stringify(o.items) || (r.observerNotes ?? "") !== o.notes) {
        r.observations = o.items.map((x) => ({ ...x }));
        r.observerNotes = o.notes;
        changed = true;
      }
    }
    if (changed) st.save();
  };
  const drawObs = (): void => {
    const s = observing ? stations.get(observing) : undefined;
    $("obsBox").hidden = !observing;
    if (!observing) return;
    const recId = s?.recId ?? "";
    $("obsTitle").textContent = s ? `Observing ${nameOf(s)}: ${s.exercise}${recId ? "" : " (no exercise is being recorded: nothing can be ticked)"}` : "That display is not reporting.";
    const who = $<HTMLSelectElement>("obsWho");
    const names = s?.students ?? [];
    const sig = `${observing}|${names.join("|")}`;
    if (who.dataset["sig"] !== sig) {
      who.dataset["sig"] = sig;
      who.innerHTML = '<option value="">The whole group</option>' + names.map((n) => `<option>${esc(n)}</option>`).join("");
    }
    const about = who.value;
    const have = recId ? (st.data.pendingObs?.[recId]?.items ?? []) : [];
    const list = checklist();
    const std = $<HTMLInputElement>("obsStd").checked;
    const isig = `${recId}|${about}|${std}|${list.map((c) => `${c.item}${c.yes}${c.no}`).join("¦")}|${have.map((h) => `${h.item}:${h.student}:${h.mark}`).join("¦")}`;
    const box = $("obsItems");
    if (box.dataset["sig"] !== isig) {
      box.dataset["sig"] = isig;
      box.innerHTML = list.map((c, i) => {
        const m = have.find((h) => h.item === c.item && h.student === about)?.mark;
        return `<div style="margin:4px 0;padding-top:3px;border-top:1px solid var(--line)"><div class="btns" style="margin:2px 0"><span class="small" style="flex:1"><b>${esc(c.item)}</b></span><button data-obs="${i}" data-mark="yes"${m === "yes" ? ' class="on"' : ""}>Yes</button><button data-obs="${i}" data-mark="no"${m === "no" ? ' class="on"' : ""}>No</button></div>` +
          (std && (c.yes || c.no) ? `<div class="small"><span class="ok">Yes:</span> ${esc(c.yes)}<br><span class="no">No:</span> ${esc(c.no)}</div>` : "") +
          (c.evidence ? `<div class="small" data-ev="${c.evidence}"></div>` : "") + `</div>`;
      }).join("");
    }
    // What the display has measured about each item so far (it changes while the exercise runs).
    for (const el of box.querySelectorAll<HTMLElement>("[data-ev]")) {
      const text = s?.ev?.[el.dataset["ev"]!];
      const html = text ? `<b>Measured:</b> ${esc(text)}` : "";
      if (el.dataset["was"] !== html) {
        el.dataset["was"] = html;
        el.innerHTML = html;
      }
    }
  };
  const observe = (station: string | null): void => {
    observing = station;
    const s = station ? stations.get(station) : undefined;
    $<HTMLTextAreaElement>("obsNotes").value = s?.recId ? (st.data.pendingObs?.[s.recId]?.notes ?? "") : "";
    $<HTMLTextAreaElement>("obsList").value = checklistLines(checklist()).join("\n");
    $("obsMsg").textContent = "";
    delete $("obsItems").dataset["sig"];
    drawObs();
  };
  $("obsClose").addEventListener("click", () => observe(null));
  $("obsWho").addEventListener("change", drawObs);
  $("obsStd").addEventListener("change", drawObs);
  $("obsItems").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    const s = observing ? stations.get(observing) : undefined;
    const item = checklist()[Number(b?.dataset["obs"])]?.item;
    if (!b || !s?.recId || item === undefined) return;
    const mark = b.dataset["mark"] as "yes" | "no";
    const about = inputValue("obsWho");
    const p = pendingFor(s.recId);
    const was = p.items.find((h) => h.item === item && h.student === about);
    p.items = p.items.filter((h) => h !== was);
    // Pressing the mark that is already set takes it off again.
    if (was?.mark !== mark) p.items.push({ item, mark, t: Math.round(s.time), student: about });
    st.save();
    mergeObservations();
    drawObs();
  });
  $("obsSave").addEventListener("click", () => {
    const s = observing ? stations.get(observing) : undefined;
    if (!s?.recId) {
      $("obsMsg").textContent = "No exercise is being recorded on that display.";
      return;
    }
    pendingFor(s.recId).notes = inputValue("obsNotes").trim();
    $("obsMsg").textContent = st.save() ? "Notes saved." : "Could not save.";
    mergeObservations();
  });
  $("obsListSave").addEventListener("click", () => {
    const list = inputValue("obsList").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 30);
    if (list.length === 0) return;
    st.data.obsItems = list;
    st.save();
    drawObs();
  });
  $("obsListReset").addEventListener("click", () => {
    delete st.data.obsItems;
    st.save();
    $<HTMLTextAreaElement>("obsList").value = checklistLines(checklist()).join("\n");
    drawObs();
  });
  const drawAttention = (): void => {
    const now = Date.now();
    const live = new Set<string>();
    const rows: { station: string; who: string; level: 1 | 2 | 3; text: string; since: number }[] = [];
    for (const s of stations.values()) {
      for (const f of s.flags ?? []) {
        const k = `${s.station}|${f.key}`;
        live.add(k);
        if (!flagSince.has(k)) flagSince.set(k, now);
        rows.push({ station: s.station, who: nameOf(s), level: f.level, text: f.text, since: flagSince.get(k)! });
      }
    }
    for (const k of [...flagSince.keys()]) if (!live.has(k)) flagSince.delete(k);
    const ranked = rankFlags(rows).slice(0, 12);
    const waited = (r: { since: number }): string => {
      const sec = Math.round((now - r.since) / 1000);
      return sec < 60 ? "now" : `${Math.floor(sec / 60)} min`;
    };
    const list = $("attList");
    const sig = ranked.map((r) => `${r.station}|${r.level}|${r.text}|${waited(r)}`).join("¦");
    if (list.dataset["sig"] !== sig) {
      list.dataset["sig"] = sig;
      list.innerHTML = ranked.map((r) => `<li class="${r.level === 3 ? "un" : ""}"><span><b class="${r.level === 3 ? "no" : r.level === 2 ? "wn" : ""}">${r.level === 3 ? "NOW" : r.level === 2 ? "SOON" : "NOTE"}</b> &nbsp; <b>${esc(r.who)}</b>: ${esc(r.text)} <span class="small">(${waited(r)})</span></span><button data-st="${esc(r.station)}">Watch</button></li>`).join("")
        || '<li><span class="small">Nothing needs attention.</span></li>';
    }
    // The class table: one row for each display.
    const body = $("classRows");
    const html = [...stations.values()].map((s) => {
      const p = s.prog;
      const fl = s.flags ?? [];
      const n3 = fl.filter((f) => f.level === 3).length, n2 = fl.filter((f) => f.level === 2).length, n1 = fl.length - n3 - n2;
      return `<tr><td>${esc(nameOf(s))}</td><td>${esc(s.ctl || "-")}</td><td>${esc(s.exercise)}</td><td>${mmss(s.time)}${s.running ? "" : " (paused)"}</td>` +
        `<td>${p && p.of > 0 ? `${p.done} of ${p.of}` : "-"}</td><td>${p && p.max !== null ? (p.finished !== null ? `<b>${p.finished}%</b> finished` : `${p.score} of ${p.max}`) : "-"}</td>` +
        `<td>${p?.closest ? `${esc(p.closest.name)} ${p.closest.nm.toFixed(2)} NM` : "-"}</td><td>${p && p.max !== null ? (p.actedAt !== null ? `at ${mmss(p.actedAt)}` : "none yet") : "-"}</td>` +
        `<td>${n3 ? `<b class="no">${n3} now</b> ` : ""}${n2 ? `<b class="wn">${n2} soon</b> ` : ""}${n1 ? `${n1} note` : ""}${fl.length ? "" : "-"}</td></tr>`;
    }).join("") || '<tr><td colspan="9" class="small">No other display is reporting.</td></tr>';
    if (body.dataset["sig"] !== html) {
      body.dataset["sig"] = html;
      body.innerHTML = html;
    }
    // The display being watched: ask again every five seconds, so that it stops by itself if this page is closed.
    if (watching) {
      const s = stations.get(watching);
      if (now - watchAsked > 5000) {
        watchAsked = now;
        api.link.sendCommand({ to: watching, cmd: "watch", on: true });
      }
      $("watchTitle").textContent = s ? `Watching ${nameOf(s)}${s.ctl ? ` (${s.ctl} at the controls)` : ""}: ${s.exercise}, ${mmss(s.time)}${s.running ? "" : " (paused)"}` : "That display is not reporting.";
      $("watchFlags").innerHTML = (s?.flags ?? []).map((f) => `<li class="${f.level === 3 ? "un" : ""}"><span>${esc(f.text)}</span></li>`).join("");
      $("watchSet").innerHTML = (s?.set ?? []).map(esc).join("<br>");
    }
    if (observing) drawObs();
    mergeObservations();
  };
  const drawStations = (): void => {
    const now = Date.now();
    for (const [k, s] of stations) if (now - s.at > 15000) stations.delete(k);
    drawAttention();
    const box = $("inStations");
    const sig = [...stations.keys()].join(",");
    if (box.dataset["sig"] !== sig) {
      box.dataset["sig"] = sig;
      box.innerHTML = [...stations.values()].map((s) => `<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;margin:8px 0;border-top:1px solid var(--line);padding-top:8px">
        <canvas id="stC_${s.station}" width="110" height="110" style="width:110px;height:110px;background:#08100e"></canvas>
        <div><div class="small" id="stT_${s.station}"></div><div class="btns"><button data-st="${s.station}" data-cmd="pause">Pause</button><button data-st="${s.station}" data-cmd="run">Run</button><button data-st="${s.station}" data-cmd="ex">Start exercise</button><button data-st="${s.station}" data-cmd="faults">Send faults</button><button data-st="${s.station}" data-cmd="clear">Clear faults</button><button data-st="${s.station}" data-cmd="watch">Watch</button><button data-st="${s.station}" data-cmd="obs">Observe</button><button data-st="${s.station}" data-cmd="back2">Back 2 min</button><button data-st="${s.station}" data-cmd="back5">Back 5 min</button><button data-st="${s.station}" data-cmd="reset">Reset</button></div></div></div>`).join("") || '<p class="small">No other display is reporting.</p>';
    }
    if (box.dataset["sel"] !== sig) {
      // The displays that can be chosen for weather and for targets.
      box.dataset["sel"] = sig;
      for (const id of ["rtSt", "inWxTo", "exmTo"]) {
        const el = $<HTMLSelectElement>(id);
        const cur = el.value;
        el.innerHTML = '<option value="all">All displays</option>' + [...stations.values()].map((s) => `<option value="${s.station}">${esc(s.students.join(" / ") || s.station)}</option>`).join("");
        el.value = [...el.options].some((o) => o.value === cur) ? cur : "all";
      }
    }
    {
      // The targets of the display chosen (of the first display, for "all"), from its last report.
      const chosen = inputValue("rtSt");
      const src = chosen === "all" || chosen === "" ? [...stations.values()][0] : stations.get(chosen);
      const list = (src?.tg ?? []).filter((t) => t.id !== undefined);
      const tsig = `${chosen}|${list.map((t) => `${t.id}:${t.name}`).join(",")}`;
      const tsel = $<HTMLSelectElement>("rtTg");
      if (tsel.dataset["sig"] !== tsig && document.activeElement !== tsel) {
        tsel.dataset["sig"] = tsig;
        const cur = tsel.value;
        tsel.innerHTML = list.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
        if ([...tsel.options].some((o) => o.value === cur)) tsel.value = cur;
      }
    }
    for (const s of stations.values()) {
      const tEl = document.getElementById(`stT_${s.station}`);
      const cv = document.getElementById(`stC_${s.station}`) as HTMLCanvasElement | null;
      if (!tEl || !cv) continue;
      tEl.innerHTML = `<b>${esc(s.students.join(" / ") || s.station)}</b> ${esc(s.batch)}<br>${esc(s.exercise)} &nbsp; ${mmss(s.time)} ${s.running ? "" : "(paused)"}<br>
        HDG ${String(Math.round(s.hdg)).padStart(3, "0")}° ${s.spd.toFixed(1)} kn (ordered ${String(Math.round(s.ordC)).padStart(3, "0")}° ${s.ordS} kn)<br>
        ${s.tracks} tracked &nbsp; ${esc(s.answered)}${s.alarms.length ? `<br><span class="no">${esc(s.alarms.slice(0, 2).join("; "))}</span>` : ""}`;
      const c = cv.getContext("2d");
      if (!c) continue;
      c.fillStyle = "#08100e";
      c.fillRect(0, 0, 110, 110);
      c.strokeStyle = "#223630";
      c.beginPath();
      c.arc(55, 55, 52, 0, Math.PI * 2);
      c.stroke();
      const k = 52 / s.rangeNm;
      c.fillStyle = "#5fe08a";
      c.fillRect(54, 54, 3, 3);
      c.strokeStyle = "#5fe08a";
      c.beginPath();
      c.moveTo(55, 55);
      c.lineTo(55 + 14 * Math.sin((s.hdg * Math.PI) / 180), 55 - 14 * Math.cos((s.hdg * Math.PI) / 180));
      c.stroke();
      c.fillStyle = "#ffd24a";
      for (const t of s.tg) if (Math.hypot(t.e, t.n) <= s.rangeNm) c.fillRect(55 + t.e * k - 1.5, 55 - t.n * k - 1.5, 3, 3);
    }
  };

  // ------------------------------------------------------------ records and replay
  let viewing: SessionRecord | null = null;
  // ---- Keeping the records beyond this browser: the classroom server's disk, and a backup file.
  const server = api.station ? new ServerStore((() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })(), location.protocol.startsWith("http")) : null;
  /** Every exercise this station knows of: those in this browser, then those only the server holds (without their replay). */
  const allHistory = (): SessionRecord[] => {
    const local = st.history();
    if (!server || server.state !== "on") return local;
    const ids = new Set(local.map((r) => r.id));
    return [...local, ...server.entries.filter((e) => !ids.has(e.light.id)).map((e) => e.light)];
  };
  let syncing = false;
  let lastSync = 0;
  let lastPull = 0;
  let sentAt = "";
  let stateMark = "";
  /** Send to the server what it does not have or has in an older form. One pass at a time. */
  const syncServer = async (): Promise<void> => {
    if (!server || syncing || server.state === "no-server" || server.state === "no-key") return;
    syncing = true;
    try {
      // Ask the server what it holds: at the start, after it was out of reach, and every two minutes (another station may have sent something).
      if (server.state !== "on" || Date.now() - lastPull > 120_000) {
        if ((await server.refresh()) !== "on") return;
        lastPull = Date.now();
        recSig = "";
      }
      const have = new Map(server.entries.map((e) => [e.light.id, e]));
      let sent = 0;
      for (const r of st.data.records) {
        const mark = recordMark(r);
        const e = have.get(r.id);
        if (e && e.sig === mark && e.replay) continue;
        if (!(await server.putRecord(lightRecord(r), mark, r))) return;
        sent++;
      }
      // An older record held here in short: sent only if the server has nothing of it.
      for (const r of st.data.archive ?? []) {
        if (have.has(r.id)) continue;
        if (!(await server.putRecord(r, recordMark(r)))) return;
        sent++;
      }
      // The class: never an empty one over a class the server holds (a new browser must take it first).
      const mark = textMark(JSON.stringify(st.classState()));
      if (mark !== stateMark && (st.data.batches.length > 0 || !server.hasState)) {
        if (await server.putState(st.classState() as unknown as Record<string, unknown>)) {
          stateMark = mark;
          sent++;
        }
      }
      if (sent > 0) {
        sentAt = new Date().toTimeString().slice(0, 8);
        recSig = "";
      }
    } finally {
      syncing = false;
      drawServer();
    }
  };
  const drawServer = (): void => {
    if (!server) return;
    const withReplay = server.entries.filter((e) => e.replay).length;
    const text: Record<string, string> = {
      "no-server": "No classroom server at this address: the records are kept in this browser only. Use the backup to keep them or to move them.",
      "no-key": "The classroom server can keep every record and the class on its own disk. Type the station key it prints when it starts.",
      "wrong-key": "The classroom server does not accept this key. Type the key it prints when it starts.",
      "out-of-reach": "The classroom server is out of reach: trying again.",
      on: `Kept on the classroom server: ${server.entries.length} exercise${server.entries.length === 1 ? "" : "s"} (${withReplay} with their replay), and the batches and settings.${sentAt ? ` Last sent at ${sentAt}.` : ""}`,
    };
    const line = text[server.state] ?? "";
    if ($("svState").textContent !== line) $("svState").textContent = line;
    $("svKeyRow").hidden = server.state === "no-server" || server.state === "on";
    // Exercises whose replay the server has and this browser has not.
    const here = new Set(st.data.records.map((r) => r.id));
    const old = server.state === "on" ? server.entries.filter((e) => e.replay && !here.has(e.light.id)) : [];
    const sel = $<HTMLSelectElement>("svOld");
    const sig = old.map((e) => e.light.id).join("|");
    if (sel.dataset["sig"] !== sig) {
      sel.dataset["sig"] = sig;
      sel.innerHTML = old.map((e) => `<option value="${esc(e.light.id)}">${esc(e.light.startedIso.slice(0, 10))} ${esc(e.light.students.join(" / ") || "no names")}: ${esc(e.light.title)}</option>`).join("");
    }
    $("svOldRow").hidden = old.length === 0;
    $("svOpen").hidden = old.length === 0;
    $("svRestore").hidden = !(server.state === "on" && server.hasState && st.data.batches.length === 0);
  };
  if (server) {
    // Asked once at the start, key or no key: is there a classroom server at this address at all?
    void server.refresh().then(() => drawServer());
    $("svKeySet").addEventListener("click", () => {
      server.setKey(inputValue("svKey"));
      ($("svKey") as HTMLInputElement).value = "";
      drawServer();
      void syncServer();
    });
    $("svOpen").addEventListener("click", () => {
      const id = inputValue("svOld");
      void server.getRecord(id).then((full) => {
        if (!full) {
          msg("The server could not give that exercise.");
          return;
        }
        st.addRecord(full);
        recSig = "";
        drawRecs();
        openRec(st.data.records.find((r) => r.id === id) ?? full);
        drawServer();
      });
    });
    $("svRestore").addEventListener("click", () => {
      void server.getState().then((s) => {
        if (s && st.applyClassState(s)) {
          stateMark = textMark(JSON.stringify(st.classState()));
          refresh();
          msg(`Taken from the server: ${st.data.batches.length} batch${st.data.batches.length === 1 ? "" : "es"} and the settings.`);
        } else msg("The server's settings could not be read.");
        drawServer();
      });
    });
  } else for (const id of ["svState", "svKeyRow"]) $(id).hidden = true;
  $("bkSave").addEventListener("click", () => download(`radar-sim-backup-${new Date().toISOString().slice(0, 10)}.json`, st.backup(new Date().toISOString()), "application/json"));
  $("bkLoad").addEventListener("click", () => $<HTMLInputElement>("bkFile").click());
  $("bkFile").addEventListener("change", () => {
    const f = $<HTMLInputElement>("bkFile").files?.[0];
    if (!f) return;
    void f.text().then((text) => {
      const r = st.restore(text);
      msg(r.ok ? `Restored: ${r.records} exercise${r.records === 1 ? "" : "s"} and ${r.batches} batch${r.batches === 1 ? "" : "es"} added${r.settings ? ", with the settings" : ""}. Nothing was deleted.` : r.error);
      ($("bkFile") as HTMLInputElement).value = "";
      if (r.ok) {
        recSig = "";
        refresh();
      }
    });
  });
  /** The trainee chosen under the records list (a name within a batch), and the records of that batch. */
  const chosenTrainee = (): { name: string; label: string; records: SessionRecord[] } | null => {
    const v = inputValue("tfWho");
    if (!v) return null;
    const [batch = "", name = ""] = v.split("\u0001");
    return { name, label: batch ? `${name} (${batch})` : name, records: allHistory().filter((r) => r.batch === batch) };
  };
  $("phShow").addEventListener("click", () => {
    const t = chosenTrainee();
    $("phOut").innerHTML = t ? progressHtml(traineeAttempts(t.records, t.name), t.label, st.data.scoring.passPercent) : '<p class="small">No trainee is named in the records yet.</p>';
  });
  $("bmShow").addEventListener("click", () => {
    const b = st.data.batches.find((x) => x.id === batchSel.value);
    if (!b) {
      $("bmOut").innerHTML = '<p class="small">Choose a batch.</p>';
      return;
    }
    const records = allHistory().filter((r) => r.batch === b.name);
    // The exercises assigned to the batch; with none assigned, those its trainees have attempted.
    const done = new Set(records.map((r) => r.exerciseId));
    const list = allExercises.filter((e) => (b.assigned.length > 0 ? b.assigned.includes(e.id) : done.has(e.id)));
    $("bmOut").innerHTML = batchMatrixHtml(batchMatrix(records, b.students, list.map((e) => e.id)), list);
  });
  /** Radar pictures recorded with the record being viewed (loaded when it is opened; may be none). */
  let pictures: PictureFrame[] = [];
  let playing = false;
  /** Replay time in seconds of the exercise; kept apart from the slider, which moves in whole seconds. */
  let replayT = 0;
  let recSig = "";
  const replayCanvas = $<HTMLCanvasElement>("inReplay");
  const scrub = $<HTMLInputElement>("inScrub");
  const drawRec = (): void => {
    if (!viewing) return;
    const size = Math.max(200, Math.round(replayCanvas.getBoundingClientRect().width));
    if (replayCanvas.width !== size) {
      replayCanvas.width = size;
      replayCanvas.height = size;
    }
    const t = replayT;
    const pic = pictureAt(pictures, t);
    const img = $<HTMLImageElement>("inPic");
    img.hidden = !pic;
    if (pic && img.dataset["t"] !== String(pic.t)) {
      img.dataset["t"] = String(pic.t);
      img.src = pic.url;
    }
    $("inPicNote").textContent = pic
      ? `Radar picture as the trainee saw it, at ${mmss(pic.t)} (one is kept every ${PICTURE_INTERVAL_SEC} seconds):`
      : "No radar pictures are kept with this record (it was made before pictures were recorded, or on another computer or browser).";
    const c = replayCanvas.getContext("2d");
    if (c) drawReplay(c, size, viewing, t);
    $("inScrubT").textContent = mmss(t);
    const f = frameAt(viewing, t);
    const near = viewing.events.filter((e) => e.t <= t).slice(-8);
    $("inRecEvents").innerHTML = near.map((e) => `<div class="${e.instructor ? "i" : ""}">${mmss(e.t)} ${esc(e.text)}</div>`).join("") + (f && f.alarms.length ? `<div class="i">Alarms showing: ${esc(f.alarms.join("; "))}</div>` : "");
  };
  const openRec = (r: SessionRecord): void => {
    viewing = r;
    playing = false;
    $("inRecView").hidden = false;
    $("inRecTitle").textContent = `${r.title} | ${r.students.join(" / ") || "no names"} | ${r.startedIso.slice(0, 16).replace("T", " ")}`;
    scrub.max = String(Math.max(1, Math.round(r.simSeconds)));
    scrub.value = "0";
    replayT = 0;
    pictures = [];
    delete $<HTMLImageElement>("inPic").dataset["t"];
    void loadPictures(r.id).then((p) => {
      if (viewing !== r) return;
      pictures = p;
      drawRec();
    });
    $("inRecResult").innerHTML = r.result ? resultHtml(r.result) : `<p class="small">${r.summary.map(esc).join("<br>")}</p>`;
    $("inRecDebrief").innerHTML = debriefHtml(r) + observedHtml(r);
    $("inRecBy").innerHTML = traineeTableHtml(r);
    $("inRecEvid").innerHTML = evidenceHtml(r, st.data.scoring);
    // The guided debrief, laid out from this record.
    const pack = debriefPack(r);
    const li = (xs: string[]): string => (xs.length > 0 ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>-</p>");
    const body = [
      r.debrief && (r.debrief.self || r.debrief.peer) ? `<p><b>Their review:</b> ${esc(r.debrief.self || "-")}<br><b>Peer comments:</b> ${esc(r.debrief.peer || "-")}</p>` : "<p>No notes were entered by the trainees.</p>",
      `<div class="btns" id="gdMoments">${pack.timeline.map((m) => `<button data-t="${m.t}" title="${esc(m.text)}"${m.kind === "flag" ? ' class="on"' : ""}>${mmss(m.t)} ${esc(m.text.slice(0, 70))}</button>`).join("")}</div>`,
      `<p><b>Met</b></p>${li(pack.well)}<p><b>Not met</b></p>${li(pack.improve)}`,
      `<ol>${pack.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>`,
      "",
    ];
    $("gdSteps").innerHTML = DEBRIEF_STEPS.map((d, i) => `<div style="margin:6px 0;padding-top:4px;border-top:1px solid var(--line)"><div class="check"><input type="checkbox" id="gd_${i}"${r.debriefDone?.steps[i] ? " checked" : ""}><label for="gd_${i}"><b>${i + 1}. ${esc(d.title)}</b></label></div><p class="hint">${esc(d.guide)}</p><div class="small">${body[i]}</div></div>`).join("");
    ($("gdGoals") as HTMLTextAreaElement).value = r.debriefDone?.goals ?? r.debrief?.goals ?? "";
    $("gdMsg").textContent = r.debriefDone ? `Debrief saved on ${r.debriefDone.atIso.slice(0, 10)}.` : "";
    $("clsOut").innerHTML = "";
    // Bookmarks: the moments an attention flag was raised on the display. A click takes the replay to ten seconds before.
    const marks = bookmarks(r);
    $("inRecMarksT").textContent = marks.length > 0 ? `Bookmarks (${marks.length}): what needed attention during the exercise. Click one to go there.` : "No bookmarks: nothing was flagged during this exercise.";
    $("inRecMarks").innerHTML = marks.map((m) => `<button data-t="${m.t}" title="${esc(m.text)}"${m.flag === 3 ? ' class="on"' : ""}>${mmss(m.t)} ${esc(m.text.replace(/^ATTENTION: /, "").slice(0, 60))}</button>`).join("");
    // In a group, a decision for each trainee as well as the one for the group.
    $("asBy").innerHTML = r.students.length > 1 ? `<p class="small" style="margin:6px 0 2px">For each trainee (the record shows who was at the controls):</p>` + r.students.map((n, i) => {
      const v = r.assessorBy?.[n];
      return `<div class="grid2"><div><label for="asBy_${i}">${esc(n)}</label><select id="asBy_${i}"><option value="">not yet decided</option><option value="competent"${v?.decision === "competent" ? " selected" : ""}>Competent</option><option value="not-yet"${v?.decision === "not-yet" ? " selected" : ""}>Not yet competent</option></select></div><div><label for="asByR_${i}">Remarks</label><input type="text" id="asByR_${i}" value="${esc(v?.remarks ?? "")}"></div></div>`;
    }).join("") : "";
    ($("asDec") as HTMLSelectElement).value = r.assessor?.decision ?? "";
    ($("asName") as HTMLInputElement).value = r.assessor?.name ?? "";
    ($("asRem") as HTMLTextAreaElement).value = r.assessor?.remarks ?? "";
    $("asMsg").textContent = "";
    checkDecision();
    drawRec();
  };
  type Decision = "" | "competent" | "not-yet";
  /** Where the decisions chosen go against the record, and whether a reason has been written for each. */
  const checkDecision = (): { open: number } => {
    if (!viewing) return { open: 0 };
    const rows: { who: string; why: string[]; reasoned: boolean }[] = [];
    const group = decisionConflicts(viewing, inputValue("asDec") as Decision, st.data.scoring);
    if (group.length > 0) rows.push({ who: viewing.students.length > 1 ? "The group" : "The decision", why: group, reasoned: inputValue("asRem").trim() !== "" });
    if (viewing.students.length > 1) viewing.students.forEach((n, i) => {
      const why = traineeConflicts(viewing!, n, inputValue(`asBy_${i}`) as Decision);
      if (why.length > 0) rows.push({ who: n, why, reasoned: inputValue(`asByR_${i}`).trim() !== "" });
    });
    $("asCheck").innerHTML = rows.length === 0 ? "" : `<p class="wn" style="margin:6px 0 2px"><b>This goes against the record.</b> It can still be decided so: write the reason in the remarks.</p><ul>` +
      rows.map((r) => `<li><b>${esc(r.who)}</b>${r.reasoned ? " (reason written)" : ""}: ${r.why.map(esc).join(" ")}</li>`).join("") + "</ul>";
    return { open: rows.filter((r) => !r.reasoned).length };
  };
  for (const id of ["asDec", "asRem", "asBy"]) {
    $(id).addEventListener("change", checkDecision);
    $(id).addEventListener("input", checkDecision);
  }
  $("asSave").addEventListener("click", () => {
    if (!viewing) return;
    if (checkDecision().open > 0) {
      $("asMsg").textContent = "Not saved: the decision goes against the record. Write the reason in the remarks, then save again.";
      return;
    }
    viewing.assessor = { decision: inputValue("asDec") as Decision, name: inputValue("asName").trim(), remarks: inputValue("asRem").trim() };
    if (viewing.students.length > 1) {
      viewing.assessorBy = Object.fromEntries(viewing.students.map((n, i) => [n, { decision: inputValue(`asBy_${i}`) as Decision, remarks: inputValue(`asByR_${i}`).trim() }]));
    }
    $("asMsg").textContent = st.save() ? "Saved." : "Could not save.";
    $("inRecDebrief").innerHTML = debriefHtml(viewing) + observedHtml(viewing);
  });
  // The guided debrief: the steps done and the goals agreed are kept with the record.
  $("gdSave").addEventListener("click", () => {
    if (!viewing) return;
    viewing.debriefDone = { steps: DEBRIEF_STEPS.map((_, i) => $<HTMLInputElement>(`gd_${i}`).checked), goals: inputValue("gdGoals").trim(), atIso: new Date().toISOString() };
    $("gdMsg").textContent = st.save() ? `Debrief saved: ${viewing.debriefDone.steps.filter(Boolean).length} of ${DEBRIEF_STEPS.length} steps done.` : "Could not save.";
  });
  $("gdSteps").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (!b || !viewing || b.dataset["t"] === undefined) return;
    replayT = Math.max(0, Math.min(Number(scrub.max), Number(b.dataset["t"]) - 10));
    scrub.value = String(replayT);
    playing = false;
    $("inPlay").textContent = "Play";
    drawRec();
    $("inReplay").scrollIntoView({ block: "nearest" });
  });
  $("clsShow").addEventListener("click", () => {
    if (!viewing) return;
    const rows = classComparison(allHistory(), viewing.exerciseId);
    const full = new Set(st.data.records.map((r) => r.id));
    $("clsOut").innerHTML = `<table class="res" id="clsTable"><thead><tr><th>Trainees</th><th>Date</th><th>%</th><th>Min</th><th>First action</th><th>Closest vessel</th><th>Flags</th><th></th></tr></thead><tbody>` +
      rows.map((c) => `<tr${c.recId === viewing!.id ? ' style="font-weight:600"' : ""}><td>${esc(c.who)}</td><td>${esc(c.date)}</td><td>${c.percent === null ? "-" : c.percent}</td><td>${c.minutes}</td><td>${c.actedAt === null ? "-" : `at ${mmss(c.actedAt)}`}</td><td>${c.closest ? `${esc(c.closest.name)} ${c.closest.nm.toFixed(2)} NM` : "-"}</td><td>${c.flagsNow} now, ${c.flagsSoon} soon</td><td>${full.has(c.recId) && c.recId !== viewing!.id ? `<button data-rec="${esc(c.recId)}">Open</button>` : ""}</td></tr>`).join("") +
      `</tbody></table><p class="small">${rows.length} recorded attempt${rows.length === 1 ? "" : "s"} at this exercise, the best score first. The first action and the closest vessel are kept from this version of the simulator on.</p>`;
  });
  $("clsOut").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    const r = st.data.records.find((x) => x.id === b?.dataset["rec"]);
    if (r) openRec(r);
  });
  $("inRecMarks").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (!b || !viewing) return;
    replayT = Math.max(0, Number(b.dataset["t"]) - 10);
    scrub.value = String(replayT);
    playing = false;
    $("inPlay").textContent = "Play";
    drawRec();
  });
  scrub.addEventListener("input", () => {
    replayT = Number(scrub.value);
    drawRec();
  });
  $("inPlay").addEventListener("click", () => {
    if (!playing && replayT >= Number(scrub.max)) replayT = 0; // at the end: play again from the start
    playing = !playing;
    $("inPlay").textContent = playing ? "Stop" : "Play";
  });
  $("inRecs").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    const r = st.data.records.find((x) => x.id === b?.dataset["rec"]);
    if (!r || !b) return;
    if (b.dataset["act"] === "open") openRec(r);
    if (b.dataset["act"] === "del" && confirm("Delete this record?")) {
      st.removeRecord(r.id);
      void server?.removeRecord(r.id);
      void deletePictures(r.id);
      if (viewing === r) {
        viewing = null;
        $("inRecView").hidden = true;
      }
    }
  });
  $("inCsvAll").addEventListener("click", () => download("exercise-records.csv", recordsCsv(st.data.records), "text/csv"));
  $("inRecCsv").addEventListener("click", () => viewing && download("exercise-result.csv", resultCsv(viewing), "text/csv"));
  $("inRecJson").addEventListener("click", () => viewing && download("exercise-record.json", JSON.stringify(viewing, null, 2), "application/json"));
  /** Open a document in a new window and print it; if the browser blocks the window, download it instead. */
  const printDoc = (html: string, file: string, what: string): void => {
    const win = window.open("", "_blank");
    if (!win) {
      download(file, html, "text/html");
      msg(`The browser blocked the print window, so the ${what} was downloaded as a file: open it and print.`);
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };
  $("inRecPrint").addEventListener("click", () => {
    if (viewing) printDoc(reportHtml(viewing, st.data.scoring), "exercise-report.html", "report");
  });
  $("gdPrint").addEventListener("click", () => {
    if (viewing) printDoc(debriefPackHtml(viewing), "debrief-pack.html", "debrief pack");
  });
  $("tfPrint").addEventListener("click", () => {
    const t = chosenTrainee();
    if (!t) {
      msg("No trainee is named in the records yet.");
      return;
    }
    printDoc(traineeFileHtml(t.records, t.name, progressHtml(traineeAttempts(t.records, t.name), t.label, st.data.scoring.passPercent)), `trainee-file-${t.name.replace(/[^\w-]+/g, "-")}.html`, "trainee file");
  });
  $("asCmp").addEventListener("click", () => {
    const rows = assessorStats(allHistory(), st.data.scoring);
    const pc = (x: number | null): string => (x === null ? "-" : `${x}%`);
    $("asCmpOut").innerHTML = rows.length === 0 ? '<p class="small">No assessor has saved a decision yet.</p>'
      : `<table class="res" id="asCmpTable"><thead><tr><th>Assessor</th><th>Decided</th><th>Competent</th><th>Mean score when competent</th><th>Mean score when not yet</th><th>Against the record</th></tr></thead><tbody>` +
        rows.map((a) => `<tr><td>${esc(a.name)}</td><td>${a.decided}</td><td>${a.competent} (${Math.round((100 * a.competent) / a.decided)}%)</td><td>${pc(a.meanCompetent)}</td><td>${pc(a.meanNotYet)}</td><td>${a.against}</td></tr>`).join("") + "</tbody></table>";
  });
  // Exercise sheets: one form for every exercise, made from the criteria that do the marking.
  const xsList = [...SELF_TEST_EXERCISES].sort((a, b) => a.number - b.number);
  $("xsEx").innerHTML = `<option value="">All exercises (${xsList.length + EXERCISES.length} pages)</option>` + xsList.map((e) => `<option value="${esc(e.id)}">${e.number}. ${esc(e.title)}</option>`).join("") +
    EXERCISES.map((e) => `<option value="roc-${e.id}">ROC: ${esc(e.name)}</option>`).join("");
  $("xsPrint").addEventListener("click", () => {
    const id = $<HTMLSelectElement>("xsEx").value;
    const list = checklist();
    const sheets = [
      ...xsList.filter((e) => !id || e.id === id).map((e) => exerciseSheetHtml(e, st.data.scoring, list, syllabusRefs(e))),
      ...EXERCISES.filter((e) => !id || `roc-${e.id}` === id).map((e) => rocSheetHtml(e, st.data.scoring, list)),
    ];
    printDoc(exerciseSheetsHtml(sheets), id ? `exercise-sheet-${id}.html` : "exercise-sheets.html", "exercise sheet");
  });
  // Examinations: the parts of each, started on a display, and the combined result.
  const examPartsOf = (which: "roc" | "arpa"): string[] => st.data.exams?.[which] ?? DEFAULT_EXAMS[which].parts;
  const fillExams = (): void => {
    for (const [id, which] of [["exmRoc", "roc"], ["exmArpa", "arpa"]] as const) {
      const chosen = examPartsOf(which);
      for (const o of $<HTMLSelectElement>(id).options) o.selected = chosen.includes(o.value);
    }
    $("exmNow").textContent = `ROC: ${examPartsOf("roc").length} parts. ARPA: ${examPartsOf("arpa").length} parts.${st.data.exams ? "" : " (the proposed parts)"}`;
  };
  fillExams();
  $("exmSave").addEventListener("click", () => {
    const pick = (id: string): string[] => [...$<HTMLSelectElement>(id).selectedOptions].map((o) => o.value);
    st.data.exams = { roc: pick("exmRoc"), arpa: pick("exmArpa") };
    msg(st.save() ? "Examination parts saved." : "Could not save.");
    fillExams();
  });
  $("exmReset").addEventListener("click", () => {
    delete st.data.exams;
    st.save();
    fillExams();
  });
  for (const [id, which] of [["exmStartRoc", "roc"], ["exmStartArpa", "arpa"]] as const) {
    $(id).addEventListener("click", () => {
      const parts = examPartsOf(which);
      if (parts.length === 0) {
        msg("Choose the parts of the examination first.");
        return;
      }
      const to = inputValue("exmTo") || "all";
      api.link.sendCommand({ to, cmd: "startExam", examId: `${which}-${Date.now().toString(36)}`, name: DEFAULT_EXAMS[which].name, parts });
      msg(`${DEFAULT_EXAMS[which].name} started on ${to === "all" ? "all displays" : `display ${to}`}: ${parts.length} parts.`);
    });
  }
  $("exmPrint").addEventListener("click", () => printDoc(examSheetsHtml(st.data.records, st.data.scoring), "examination-results.html", "examination results"));
  // Marking sheets: every exercise, listed by number.
  const sheetExercises = [...SELF_TEST_EXERCISES].sort((a, b) => a.number - b.number);
  $("msEx").innerHTML = `<option value="">All exercises (${sheetExercises.length} pages)</option>` + sheetExercises.map((e) => `<option value="${esc(e.id)}">${e.number}. ${esc(e.title)}</option>`).join("");
  $("msPrint").addEventListener("click", () => {
    const id = $<HTMLSelectElement>("msEx").value;
    const list = id ? sheetExercises.filter((e) => e.id === id) : sheetExercises;
    printDoc(markingSheetsHtml(list, st.data.scoring), id ? `marking-sheet-${id}.html` : "marking-sheets.html", "marking sheet");
  });
  const drawRecs = (): void => {
    const sig = st.data.records.map((r) => r.id).join("|");
    if (sig === recSig) return;
    recSig = sig;
    const who = $<HTMLSelectElement>("tfWho");
    const cur = who.value;
    // A name within a batch: two trainees of the same name in different batches are kept apart.
    const keys = traineeKeys(allHistory()).map((k) => ({ value: `${k.batch}\u0001${k.name}`, label: k.batch ? `${k.name} (${k.batch})` : k.name }));
    who.innerHTML = keys.map((k) => `<option value="${esc(k.value)}">${esc(k.label)}</option>`).join("") || '<option value="">no names yet</option>';
    if (keys.some((k) => k.value === cur)) who.value = cur;
    $("inRecs").innerHTML = st.data.records.map((r) => `<tr><td>${esc(r.startedIso.slice(5, 16).replace("T", " "))}</td><td>${esc(r.students.join(" / "))}</td><td>${esc(r.title)}</td><td>${r.result ? r.result.percent.toFixed(0) : "-"}</td>
      <td><button data-rec="${esc(r.id)}" data-act="open">Open</button> <button data-rec="${esc(r.id)}" data-act="del">✕</button></td></tr>`).join("") || '<tr><td colspan="5" class="small">No records yet. A record is saved when an exercise is finished.</td></tr>';
  };

  // ------------------------------------------------------------ scoring
  const scoreFields: { key: string; label: string; get: (c: ScoringConfig) => number | null; set: (c: ScoringConfig, v: number | null) => void }[] = [
    { key: "cpa", label: "CPA tolerance (NM)", get: (c) => c.tol.cpaNm, set: (c, v) => (c.tol.cpaNm = v ?? c.tol.cpaNm) },
    { key: "tcpa", label: "TCPA tolerance (min)", get: (c) => c.tol.tcpaMin, set: (c, v) => (c.tol.tcpaMin = v ?? c.tol.tcpaMin) },
    { key: "crs", label: "Course tolerance (°)", get: (c) => c.tol.courseDeg, set: (c, v) => (c.tol.courseDeg = v ?? c.tol.courseDeg) },
    { key: "spd", label: "Speed tolerance (kn)", get: (c) => c.tol.speedKn, set: (c, v) => (c.tol.speedKn = v ?? c.tol.speedKn) },
    { key: "rng", label: "Range tolerance (NM)", get: (c) => c.tol.rangeNm, set: (c, v) => (c.tol.rangeNm = v ?? c.tol.rangeNm) },
    { key: "gy", label: "Gyro error tolerance (°)", get: (c) => c.tol.errorDeg, set: (c, v) => (c.tol.errorDeg = v ?? c.tol.errorDeg) },
    { key: "dr", label: "Drift / log tolerance (kn)", get: (c) => c.tol.errorKn, set: (c, v) => (c.tol.errorKn = v ?? c.tol.errorKn) },
    { key: "set", label: "Set tolerance (°)", get: (c) => c.tol.setDeg, set: (c, v) => (c.tol.setDeg = v ?? c.tol.setDeg) },
    { key: "brg", label: "Radar bearing / course to steer tolerance (°)", get: (c) => c.tol.bearingDeg, set: (c, v) => (c.tol.bearingDeg = v ?? c.tol.bearingDeg) },
    { key: "pq", label: "Points per question", get: (c) => c.points.question, set: (c, v) => (c.points.question = v ?? c.points.question) },
    { key: "pa", label: "Points per action", get: (c) => c.points.action, set: (c, v) => (c.points.action = v ?? c.points.action) },
    { key: "ps", label: "Points per safety outcome", get: (c) => c.points.safety, set: (c, v) => (c.points.safety = v ?? c.points.safety) },
    { key: "turn", label: "Substantial turn (°)", get: (c) => c.substantialTurnDeg, set: (c, v) => (c.substantialTurnDeg = v ?? c.substantialTurnDeg) },
    { key: "cut", label: "Substantial speed cut (0-1)", get: (c) => c.substantialSpeedCut, set: (c, v) => (c.substantialSpeedCut = v ?? c.substantialSpeedCut) },
    { key: "pass", label: "Pass mark % (blank = none)", get: (c) => c.passPercent, set: (c, v) => (c.passPercent = v) },
    // Radar 22, switching on and setting up: what counts as set right.
    ...([
      ["suSpMin", "Set-up: lightest speckle (0-1)", "speckleMin"],
      ["suSpMax", "Set-up: heaviest speckle (0-1)", "speckleMax"],
      ["suTune", "Set-up: tuning tolerance (0-100 scale)", "tuningTol"],
      ["suBrill", "Set-up: least brilliance (10-100)", "minBrilliance"],
      ["suClut", "Set-up: sea / rain at zero up to", "clutterZero"],
    ] as const).map(([key, label, k]) => ({
      key, label,
      get: (c: ScoringConfig): number | null => (c.setup ?? SETUP_LIMITS)[k],
      set: (c: ScoringConfig, v: number | null): void => {
        c.setup = { ...(c.setup ?? SETUP_LIMITS), [k]: v ?? (c.setup ?? SETUP_LIMITS)[k] };
      },
    })),
  ];
  const fillScore = (): void => {
    $("inScore").innerHTML = scoreFields.map((f) => `<div><label for="sc_${f.key}">${f.label}</label><input type="number" step="any" min="0" id="sc_${f.key}" value="${f.get(st.data.scoring) ?? ""}"></div>`).join("");
  };
  $("inScoreSave").addEventListener("click", () => {
    for (const f of scoreFields) {
      const raw = inputValue(`sc_${f.key}`);
      const v = raw === "" ? null : Number(raw);
      if (v === null || (Number.isFinite(v) && v >= 0)) f.set(st.data.scoring, v);
    }
    msg(st.save() ? "Scoring saved. It applies to exercises started from now on." : "Could not save.");
    fillScore();
  });
  const showTl = (): void => {
    const id = inputValue("inTlEx");
    const v = st.data.scoring.timeLimits?.[id];
    $<HTMLInputElement>("inTlMin").value = typeof v === "number" ? String(v) : "";
    const all = Object.entries(st.data.scoring.timeLimits ?? {}).filter(([, m]) => typeof m === "number");
    $("inTlNow").textContent = all.length ? `Limits set: ${all.map(([k, m]) => `${k} ${m} min`).join(", ")}.` : "No time limits set by the instructor.";
  };
  $("inTlEx").addEventListener("change", showTl);
  $("inTlSet").addEventListener("click", () => {
    const raw = inputValue("inTlMin");
    const v = raw === "" ? null : Number(raw);
    if (v !== null && !(Number.isFinite(v) && v > 0)) return;
    st.data.scoring.timeLimits = { ...(st.data.scoring.timeLimits ?? {}), [inputValue("inTlEx")]: v };
    msg(st.save() ? "Time limit saved. It applies to exercises started from now on." : "Could not save.");
    showTl();
  });
  showTl();
  $("inScoreReset").addEventListener("click", () => {
    st.data.scoring = JSON.parse(JSON.stringify(PLACEHOLDER_SCORING)) as ScoringConfig;
    st.save();
    fillScore();
  });

  // ------------------------------------------------------------ scenario editor
  let edBase: Scenario | null = null;
  const edSel = $<HTMLSelectElement>("edBase");
  const edMsg = (lines: string[], ok = false): void => {
    $("edMsg").innerHTML = lines.map((l) => `<li class="${ok ? "ok" : "no"}">${esc(l)}</li>`).join("");
  };
  const rowHtml = (t?: Scenario["targets"][number], own?: { e: number; n: number }): string => {
    const rel = t ? { e: t.pos.e - (own?.e ?? 0), n: t.pos.n - (own?.n ?? 0) } : { e: 0, n: 5 };
    const ev = t?.events[0];
    const cell = (cls: string, v: string | number, w = 52): string => `<td><input type="${cls === "nm" ? "text" : "number"}" step="any" data-f="${cls}" value="${esc(String(v))}" style="width:${w}px;padding:2px 3px"></td>`;
    return `<tr>${cell("nm", t?.name ?? "Target", 84)}<td><select data-f="kind" style="width:120px;padding:2px">${typeOptions(t ? (t.typeId ?? `kind:${t.kind}`) : "general-cargo")}</select></td>${cell("brg", Math.round(bearingOf(rel)))}${cell("rng", +length(rel).toFixed(2))}${cell("crs", t?.course ?? 180)}${cell("spd", t?.speed ?? 10)}${cell("at", ev ? +(ev.atSeconds / 60).toFixed(1) : "")}${cell("ec", ev?.course ?? "")}${cell("es", ev?.speed ?? "")}<td><button data-f="del">✕</button></td></tr>`;
  };
  const fillEditor = (sc: Scenario): void => {
    edBase = sc;
    ($("edName") as HTMLInputElement).value = sc.name;
    ($("edSea") as HTMLInputElement).value = String(sc.env.seaState ?? 3);
    ($("edHdg") as HTMLInputElement).value = String(sc.own.heading);
    ($("edSpd") as HTMLInputElement).value = String(sc.own.speed);
    ($("edSet") as HTMLInputElement).value = String(sc.env.current?.set ?? 0);
    ($("edDrift") as HTMLInputElement).value = String(sc.env.current?.drift ?? 0);
    ($("edVis") as HTMLInputElement).value = sc.env.visibilityNm ? String(sc.env.visibilityNm) : "";
    $("edRows").innerHTML = sc.targets.map((t) => rowHtml(t, sc.own.pos)).join("");
    edMsg([]);
  };
  const fillBases = (): void => {
    const list = api.baseScenarios();
    edSel.innerHTML = list.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join("");
  };
  edSel.addEventListener("change", () => {
    const sc = api.baseScenarios()[Number(edSel.value)];
    if (sc) fillEditor(sc);
  });
  $("edAdd").addEventListener("click", () => $("edRows").insertAdjacentHTML("beforeend", rowHtml()));
  $("edRows").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest("button");
    if (b?.dataset["f"] === "del") b.closest("tr")?.remove();
  });
  /** Build a scenario from the form. Problems come back from the same validator as files. */
  const readEditor = (): Scenario | null => {
    if (!edBase) return null;
    const own = edBase.own.pos ?? { e: 0, n: 0 };
    const name = inputValue("edName").trim() || "Untitled scenario";
    const rows = [...$("edRows").querySelectorAll("tr")];
    const targets = rows.map((tr, i) => {
      const g = (f: string): string => (tr.querySelector(`[data-f="${f}"]`) as HTMLInputElement | HTMLSelectElement).value;
      const rel = fromPolar(Number(g("brg")) || 0, Number(g("rng")) || 0);
      const events = g("at") !== "" ? [{ atSeconds: Math.max(0, Number(g("at")) * 60), ...(g("ec") !== "" ? { course: normalizeDeg(Number(g("ec"))) } : {}), ...(g("es") !== "" ? { speed: Math.max(0, Number(g("es"))) } : {}) }] : [];
      return { id: i + 1, name: g("nm") || `Target ${i + 1}`, pos: { e: +(own.e + rel.e).toFixed(4), n: +(own.n + rel.n).toFixed(4) }, course: normalizeDeg(Number(g("crs")) || 0), speed: Number(g("spd")) || 0, ...fieldsFor(g("kind")), events };
    });
    const sc: Scenario = {
      ...edBase,
      id: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      description: `Instructor scenario "${name}".`,
      own: { ...edBase.own, heading: normalizeDeg(Number(inputValue("edHdg")) || 0), speed: Number(inputValue("edSpd")) || 0 },
      env: (() => {
        const env = { ...edBase!.env, seaState: Number(inputValue("edSea")) || 0, current: { set: normalizeDeg(Number(inputValue("edSet")) || 0), drift: Number(inputValue("edDrift")) || 0 } };
        const vis = Number(inputValue("edVis"));
        if (inputValue("edVis") !== "" && vis > 0) env.visibilityNm = Math.min(20, vis);
        else delete env.visibilityNm;
        return env;
      })(),
      targets,
    };
    const back = scenarioFromJson(scenarioToJson(sc));
    if ("errors" in back) {
      edMsg(back.errors);
      return null;
    }
    return back.scenario;
  };
  $("edLoad").addEventListener("click", () => {
    const sc = readEditor();
    if (sc) {
      api.loadScenario(sc);
      edMsg(["Loaded in the simulator (free practice)."], true);
    }
  });
  $("edSave").addEventListener("click", () => {
    const sc = readEditor();
    if (!sc) return;
    st.saveScenario(sc);
    api.scenariosChanged();
    fillBases();
    edMsg([`Saved "${sc.name}" to the library on this computer.`], true);
  });
  $("edDown").addEventListener("click", () => {
    const sc = readEditor();
    if (sc) download(`${sc.id}.json`, scenarioToJson(sc), "application/json");
  });
  $("edDel").addEventListener("click", () => {
    const sc = readEditor();
    if (sc && st.data.scenarios.some((s) => s.id === sc.id) && confirm(`Delete "${sc.name}" from the library?`)) {
      st.removeScenario(sc.id);
      api.scenariosChanged();
      fillBases();
      edMsg(["Deleted from the library."], true);
    } else if (sc) edMsg(["That scenario is not in the library (built-in scenarios cannot be deleted)."]);
  });
  $("edUp").addEventListener("click", () => $("edFile").click());
  $("edFile").addEventListener("change", () => {
    const f = ($("edFile") as HTMLInputElement).files?.[0];
    if (!f) return;
    void f.text().then((text) => {
      const r = scenarioFromJson(text);
      if ("errors" in r) edMsg(r.errors);
      else {
        fillEditor(r.scenario);
        edMsg([`Opened "${r.scenario.name}". Check it, then Load or Save.`], true);
      }
      ($("edFile") as HTMLInputElement).value = "";
    });
  });

  const refresh = (): void => {
    const instr = api.role() === "instructor";
    $("inLogin").hidden = instr;
    $("inLogged").hidden = !instr;
    fillBatches();
    fillScore();
    fillBases();
    if (!edBase) {
      const first = api.baseScenarios()[0];
      if (first) fillEditor(first);
    }
    recSig = "";
  };
  refresh();

  let lastWall = 0;
  const tick = (app: AppState): void => {
    if (api.role() !== "instructor" || (pane.hidden && !api.station)) return;
    const sig = app.world.targets.map((t) => `${t.id}${t.name}`).join("|");
    if (sig !== tgtSig) {
      tgtSig = sig;
      const cur = tgtSel.value;
      tgtSel.innerHTML = app.world.targets.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
      if (app.world.targets.some((t) => String(t.id) === cur)) tgtSel.value = cur;
    }
    // Track status for the chosen target, and the track being programmed.
    const ed = app.routeEdit;
    const edT = ed ? app.world.targets.find((t) => t.id === ed.targetId) : undefined;
    if (ed && !edT) app.routeEdit = null;
    const selT = selTarget(app);
    const ahead = selT ? routeAhead(selT).length : 0;
    const rtText = ed && edT
      ? `Programming ${edT.name}: ${ed.points.length} of ${MAX_ROUTE_WAYPOINTS} points. Click on the radar picture, then press "Set track".`
      : selT
        ? selT.route
          ? ahead > 0 ? `${selT.name}: on a track, ${ahead} point${ahead === 1 ? "" : "s"} ahead.` : `${selT.name}: track finished, carrying on as it goes.`
          : `${selT.name}: no track.`
        : "";
    const rtShown = performance.now() < rtWarn.until ? rtWarn.text : rtText;
    if ($("inRtMsg").textContent !== rtShown) $("inRtMsg").textContent = rtShown;
    $<HTMLInputElement>("inRtShow").checked = app.showRoutes;
    $("inLinkMode").textContent = `Link: ${api.link.mode}. This display is ${api.link.station}.`;
    drawStations();
    drawRecs();
    if (server) {
      drawServer();
      if (app.wall - lastSync > 10 || lastSync === 0) {
        lastSync = app.wall || 0.001;
        void syncServer();
      }
    }
    if (viewing && playing) {
      const dt = app.wall - lastWall;
      const speed = Number(inputValue("inReplaySpeed")) || 30;
      const next = replayT + Math.max(0, Math.min(dt, 0.5)) * speed;
      if (next >= Number(scrub.max)) {
        playing = false;
        $("inPlay").textContent = "Play";
      }
      replayT = Math.min(Number(scrub.max), next);
      scrub.value = String(Math.floor(replayT));
      drawRec();
    }
    lastWall = app.wall;
  };

  return { tick, refresh, recordsChanged: () => (recSig = ""), history: allHistory, accountsChanged: drawAccounts };
}
