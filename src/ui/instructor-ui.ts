import { bearingOf, fromPolar, length, normalizeDeg } from "../core/vec";
import { IMO_TABLE2, Scenario, TARGET_TYPES, Target, TargetKind, clearTargetRoute, initTargetMotion, orderTarget, rcsForDetectionRange, routeAhead, setTargetRoute, targetFromType, targetTypeById } from "../engine/index";
import { MAX_ROUTE_WAYPOINTS } from "../core/route";
import { EXERCISES } from "../roc/index";
import {
  ARPA_EXERCISES, RADAR_EXERCISES, PLOTTING_EXERCISES, SELF_TEST_EXERCISES, SelfTestRow, selfTestExercise, markingSheetsHtml, PLACEHOLDER_SCORING, SETUP_LIMITS, ScoringConfig, SessionRecord, Store, frameAt, frameInterpolated, REPLAY_SPEEDS, PICTURE_INTERVAL_SEC, PictureFrame, pictureAt, recordsCsv, resultCsv, scenarioFromJson, scenarioToJson,
} from "../train/index";
import { AppState, rewind } from "./app";
import { deletePictures, loadPictures } from "./picture-store";
import { $, download, esc, inputValue, mmss } from "./dom";
import { FAULT_IDS, Link, StationStatus } from "./link";
import { resultHtml } from "./train-ui";

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
  { id: "perf", label: "Radar performance (%)", min: 20, max: 100, step: 5, off: 100 },
  { id: "logFail", label: "Speed log failed", off: false },
  { id: "gyroFail", label: "Gyro compass failed", off: false },
  { id: "gnssFail", label: "EPFS (GNSS) failed", off: false },
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

export function reportHtml(rec: SessionRecord): string {
  const res = rec.result;
  const events = rec.events.filter((e) => !e.instructor || true).map((e) => `<tr><td>${mmss(e.t)}</td><td>${esc(e.text)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Exercise report</title>
<style>body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px}h2{font-size:14px;margin-top:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left;font-size:12px}.ok{color:#0a6b2d}.no{color:#b3261e}.small{color:#555;font-size:11px}</style></head><body>
<h1>Radar / ARPA simulator: exercise report</h1>
<p><b>Exercise:</b> ${esc(rec.title)}<br><b>Students:</b> ${esc(rec.students.join(" / ") || "-")} &nbsp; <b>Batch:</b> ${esc(rec.batch || "-")}<br>
<b>Started:</b> ${esc(rec.startedIso)} &nbsp; <b>Simulated time:</b> ${mmss(rec.simSeconds)}</p>
${res ? resultHtml(res) : `<p>${rec.summary.map(esc).join("<br>")}</p>`}
<h2>Debrief</h2>${debriefHtml(rec)}
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
      <div class="btns"><button id="inBatchSave">Save batch</button><button id="inBatchDel">Delete batch</button></div>
      <div class="grid2" style="margin-top:8px"><div><label for="inMaxStu">Students per display</label><input type="number" id="inMaxStu" min="1" max="4" step="1"></div>
        <div><label for="inPairHrs">Hours per pair (blank = not set)</label><input type="number" id="inPairHrs" min="0" step="0.5"></div></div>
      <div id="inPairs" class="small" style="margin-top:6px"></div>
      <p class="hint">Time at the display is counted for each pair of names while a session is open. The limits are the academy's to set; none is enforced unless entered here.</p></section>
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
    <section><h2>Monitor other displays</h2><p class="small" id="inLinkMode"></p><div id="inStations"></div>
      <div class="btns"><button id="inAllPause">Pause all</button><button id="inAllRun">Run all</button></div>
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
      <div class="btns"><button id="inWxSend">Set this weather on all displays</button></div>
      <div class="btns"><button id="inLinked">Start a LINKED exercise on all displays with the scenario loaded here</button></div>
      <div class="btns"><input type="text" id="inMsgText" placeholder="Message to all displays" style="flex:1"><button id="inMsgSend">Send</button></div>
      <p class="hint">A linked exercise loads the same scenario on every display at the same moment, puts each own ship at a different start 5 NM from the scenario start, and shows every own ship to the others as a target. It runs at 1x. Other browser tabs on this computer appear here at once. For other computers, start "npm run serve" on one PC and open the address it prints on every display.</p></section>
    <section><h2>Records, replay and reports</h2>
      <table class="res"><thead><tr><th>When</th><th>Students</th><th>Exercise</th><th>%</th><th></th></tr></thead><tbody id="inRecs"></tbody></table>
      <div class="btns"><button id="inCsvAll">Export all (CSV)</button></div>
      <div id="inRecView" hidden><h2 style="margin-top:10px" id="inRecTitle"></h2>
        <canvas id="inReplay" style="aspect-ratio:1/1;background:#08100e"></canvas>
        <p class="small" id="inPicNote"></p>
        <img id="inPic" alt="The radar picture as the trainee saw it" style="width:100%;aspect-ratio:1/1;background:#000;display:block" hidden>
        <div class="btns"><button id="inPlay">Play</button><input type="range" id="inScrub" min="0" max="100" value="0" style="flex:1"><span class="val" id="inScrubT">00:00</span></div>
        <div class="row two"><label for="inReplaySpeed">Replay speed</label><select id="inReplaySpeed">${REPLAY_SPEEDS.map((v) => `<option value="${v}"${v === 30 ? " selected" : ""}>${v}x${v < 1 ? " (slow motion)" : v === 1 ? " (real time)" : ""}</option>`).join("")}</select></div>
        <div class="log" id="inRecEvents"></div><div id="inRecResult"></div>
        <div id="inRecDebrief" class="small"></div>
        <h2 style="margin-top:10px">Assessor's decision</h2>
        <div class="grid2"><div><label for="asDec">Decision</label><select id="asDec"><option value="">not yet decided</option><option value="competent">Competent: task carried out safely and effectively</option><option value="not-yet">Not yet competent</option></select></div>
          <div><label for="asName">Assessor</label><input type="text" id="asName"></div></div>
        <label class="small" for="asRem">Remarks</label><textarea id="asRem" rows="2"></textarea>
        <div class="btns"><button id="asSave">Save decision</button><span class="small" id="asMsg"></span></div>
        <p class="hint">The score is a guide only. The assessor's decision is the prime criterion (STCW Code A-I/12, paragraph 8).</p>
        <div class="btns"><button id="inRecCsv">Result (CSV)</button><button id="inRecPrint">Report (print or save as PDF)</button><button id="inRecJson">Record (JSON)</button></div></div></section>
    <section><h2>Self-test of the exercises</h2>
      <div class="btns"><button id="stRun">Run self-test (about half a minute)</button><span class="small" id="stMsg"></span></div>
      <table class="trk"><thead><tr><th></th><th>Exercise</th><th>Careful robot</th><th>Wrong robot</th><th>Idle robot</th></tr></thead><tbody id="stRows"></tbody></table>
      <ul class="alarms" id="stProblems"></ul>
      <p class="hint">Three robots work every ARPA, radar and plotting exercise in the background. The careful robot does what the briefing asks and answers from the answer key: it must get 100%. The wrong robot gives wrong answers: all must be rejected. The idle robot does nothing: it must not be credited. This checks that every exercise runs, can be completed and is marked properly. It does not check that the answer key is good seamanship. The ROC exercises are not included.</p>
    </section>
    <section><h2>Scoring settings (placeholders)</h2><div class="grid2" id="inScore"></div>
      <div class="btns"><button id="inScoreSave">Save scoring</button><button id="inScoreReset">Reset to placeholders</button></div>
      <p class="hint">None of these values comes from an approved marking scheme. Leave the pass mark blank to report scores without pass or fail.</p></section>
    <section><h2>Marking sheets</h2>
      <div class="row two"><label for="msEx">Exercise</label><select id="msEx"></select></div>
      <div class="btns"><button id="msPrint">Print marking sheet (or save as PDF)</button></div>
      <p class="hint">One page per exercise for the institute to fill in: what the simulator checks and the value it uses now, with empty boxes for the institute's own tolerances, points and pass mark, the items the assessor judges, and the assessor's decision and signature. The values printed are the scoring settings above: placeholders until the institute changes them. The syllabus references on each sheet are a draft (docs/SYLLABUS-MATRIX.md).</p></section>
    <section><h2>Scenario editor</h2>
      <div class="row two"><label for="edBase">Start from</label><select id="edBase"></select></div>
      <div class="grid2"><div><label for="edName">Scenario name</label><input type="text" id="edName"></div><div><label for="edSea">Sea state (0-9)</label><input type="number" id="edSea" min="0" max="9"></div>
        <div><label for="edHdg">Own heading (°)</label><input type="number" id="edHdg" min="0" max="359"></div><div><label for="edSpd">Own speed (kn)</label><input type="number" id="edSpd" min="0" max="40" step="0.5"></div>
        <div><label for="edSet">Current set (°)</label><input type="number" id="edSet" min="0" max="359"></div><div><label for="edDrift">Current drift (kn)</label><input type="number" id="edDrift" min="0" max="6" step="0.1"></div></div>
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
  const showBatch = (): void => {
    const b = st.data.batches.find((x) => x.id === batchSel.value);
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
    if (!id) return;
    st.setStudents(id, inputValue("inStudents").split("\n"));
    st.setAssigned(id, [...$("inAssign").querySelectorAll<HTMLInputElement>("input:checked")].map((c) => c.dataset["as"]!));
    st.data.maxStudentsPerDisplay = Math.min(4, Math.max(1, Math.round(Number(inputValue("inMaxStu")) || 2)));
    const h = inputValue("inPairHrs");
    st.data.targetHoursPerPair = h === "" ? null : Math.max(0, Number(h));
    msg(st.save() ? "Batch saved." : "Could not save: the browser's storage is full or blocked.");
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
      id: Math.max(0, ...w.targets.map((x) => x.id)) + 1, name: inputValue("inNewName") || "Intruder",
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
  $("inWxSend").addEventListener("click", () => {
    const chk = (id: string): boolean => ($(id) as HTMLInputElement).checked;
    api.link.sendCommand({ to: "all", cmd: "weather", seaState: Math.min(9, Math.max(0, Number(inputValue("inWxSea")) || 0)), rain: chk("inWxRain"), ducting: chk("inWxDuct"), interference: chk("inWxInt") });
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
  const drawStations = (): void => {
    const now = Date.now();
    for (const [k, s] of stations) if (now - s.at > 15000) stations.delete(k);
    const box = $("inStations");
    const sig = [...stations.keys()].join(",");
    if (box.dataset["sig"] !== sig) {
      box.dataset["sig"] = sig;
      box.innerHTML = [...stations.values()].map((s) => `<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;margin:8px 0;border-top:1px solid var(--line);padding-top:8px">
        <canvas id="stC_${s.station}" width="110" height="110" style="width:110px;height:110px;background:#08100e"></canvas>
        <div><div class="small" id="stT_${s.station}"></div><div class="btns"><button data-st="${s.station}" data-cmd="pause">Pause</button><button data-st="${s.station}" data-cmd="run">Run</button><button data-st="${s.station}" data-cmd="ex">Start exercise</button><button data-st="${s.station}" data-cmd="faults">Send faults</button><button data-st="${s.station}" data-cmd="clear">Clear faults</button></div></div></div>`).join("") || '<p class="small">No other display is reporting.</p>';
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
    $("inRecDebrief").innerHTML = debriefHtml(r);
    ($("asDec") as HTMLSelectElement).value = r.assessor?.decision ?? "";
    ($("asName") as HTMLInputElement).value = r.assessor?.name ?? "";
    ($("asRem") as HTMLTextAreaElement).value = r.assessor?.remarks ?? "";
    $("asMsg").textContent = "";
    drawRec();
  };
  $("asSave").addEventListener("click", () => {
    if (!viewing) return;
    viewing.assessor = { decision: inputValue("asDec") as "" | "competent" | "not-yet", name: inputValue("asName").trim(), remarks: inputValue("asRem").trim() };
    $("asMsg").textContent = st.save() ? "Saved." : "Could not save.";
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
    if (viewing) printDoc(reportHtml(viewing), "exercise-report.html", "report");
  });
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
      env: { ...edBase.env, seaState: Number(inputValue("edSea")) || 0, current: { set: normalizeDeg(Number(inputValue("edSet")) || 0), drift: Number(inputValue("edDrift")) || 0 } },
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

  return { tick, refresh, recordsChanged: () => (recSig = "") };
}
