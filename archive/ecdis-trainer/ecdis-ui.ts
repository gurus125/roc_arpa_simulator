import { Vec2, add, bearingOf, length, normalizeDeg, scale, sub, velocityOf } from "../core/vec";
import { routeLegs, wheelOverDistance } from "../core/route";
import { measuredHeading } from "../engine/index";
import {
  ackEcdisAlarm, aisTargets, arpaOverlay, checkRoute, depthAt, ecdisCogSog, ecdisPosition, routeMonitor,
} from "../ecdis/index";
import { AppState } from "./app";
import { createAlarmSound } from "./alarm-sound";
import { $, esc, inputValue, mmss } from "./dom";

export interface EcdisUiApi {
  getApp: () => AppState;
  loadHarbour: () => void;
}
export interface EcdisUi {
  tick: (app: AppState) => void;
  draw: (app: AppState) => void;
  onAppChanged: (app: AppState) => void;
}

/** Fictional chart datum for latitude / longitude readouts (the charts are not real places). */
const DATUM = { lat: 18 + 50 / 60, lon: 72 + 45 / 60 };
export function latLon(p: Vec2): string {
  const lat = DATUM.lat + p.n / 60;
  const lon = DATUM.lon + p.e / (60 * Math.cos((DATUM.lat * Math.PI) / 180));
  const f = (v: number, pos: string, neg: string, w: number): string => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    return `${String(d).padStart(w, "0")}°${((a - d) * 60).toFixed(3).padStart(6, "0")}'${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, "N", "S", 2)} ${f(lon, "E", "W", 3)}`;
}

const PALETTES = {
  day: { deep: "#d6ecf5", safe: "#b9dcee", unsafe: "#6fa8d6", land: "#e2cf9a", coast: "#5b4a1e", text: "#1b2a33", route: "#c2185b", own: "#111111", ais: "#1b5e20", arpa: "#0d47a1", grid: "#9fb7c4", danger: "#c62828" },
  dusk: { deep: "#243746", safe: "#1c2f3d", unsafe: "#0f1f2c", land: "#4a4230", coast: "#a08c58", text: "#c9d6dd", route: "#ff6fa5", own: "#f2f2f2", ais: "#7fd48a", arpa: "#82b1ff", grid: "#3d5566", danger: "#ff6b5e" },
  night: { deep: "#0a1218", safe: "#081016", unsafe: "#04090d", land: "#1c1a12", coast: "#5e5433", text: "#7c8a91", route: "#a8436b", own: "#9a9a9a", ais: "#3f7a48", arpa: "#3f5f99", grid: "#182630", danger: "#a8433a" },
} as const;

const SCALES = [0.75, 1.5, 3, 6, 12, 24];

export function initEcdisUi(api: EcdisUiApi): EcdisUi {
  const pane = $("paneEcdis");
  pane.innerHTML = `
    <section><h2>ECDIS trainer</h2>
      <p class="small">Chart work on the simulator's own chart. It is a trainer for ECDIS functions, not an ECDIS: no official ENC charts, no chart updates, not type-approved.</p>
      <div class="btns"><button id="ecHarbour">Load the harbour approach chart</button></div>
      <div class="row two"><label for="ecScale">Chart range</label><select id="ecScale">${SCALES.map((s) => `<option value="${s}" ${s === 6 ? "selected" : ""}>${s} NM</option>`).join("")}</select></div>
      <div class="row two"><label for="ecPal">Palette</label><select id="ecPal"><option value="day">Day</option><option value="dusk">Dusk</option><option value="night">Night</option></select></div>
      <div class="check"><input type="checkbox" id="ecFollow" checked><label for="ecFollow">Keep own ship on the chart (follow)</label></div>
      <div class="check"><input type="checkbox" id="ecAis" checked><label for="ecAis">AIS targets</label></div>
      <div class="check"><input type="checkbox" id="ecArpa" checked><label for="ecArpa">Radar (ARPA) tracked targets</label></div>
      <div class="check"><input type="checkbox" id="ecTrack" checked><label for="ecTrack">Past track</label></div>
      <p class="hint">Drag the chart to move it (follow switches off). Mouse wheel or the range list zooms.</p></section>
    <section><h2>Position and safety</h2>
      <div class="small" id="ecPos"></div>
      <div class="grid2" style="margin-top:6px">
        <div><label for="ecSafe">Safety depth (m)</label><input type="number" id="ecSafe" min="0" max="50" step="1" value="10"></div>
        <div><label for="ecLook">Look-ahead (min)</label><input type="number" id="ecLook" min="1" max="30" step="1" value="6"></div>
        <div><label for="ecVec">Own vector (min)</label><input type="number" id="ecVec" min="1" max="60" step="1" value="6"></div>
        <div><label>&nbsp;</label><button id="ecMob">MOB</button></div></div>
      <p class="small" id="ecMobInfo"></p>
      <div class="instr-only"><div class="check"><input type="checkbox" id="ecGnssFail"><label for="ecGnssFail">Instructor: GNSS failed (ECDIS goes to dead reckoning)</label></div>
        <div class="grid2"><div><label for="ecOffE">GNSS error east (NM)</label><input type="number" id="ecOffE" step="0.05" value="0"></div><div><label for="ecOffN">GNSS error north (NM)</label><input type="number" id="ecOffN" step="0.05" value="0"></div></div></div></section>
    <section><h2>Route planning</h2>
      <div class="btns"><button id="ecAddWp">Add waypoints: OFF</button><button id="ecUndo">Remove last</button><button id="ecClear">Clear</button><button id="ecPlan">Scenario route</button></div>
      <div class="grid2" style="margin-top:6px"><div><label for="ecXtd">Cross-track limit (NM)</label><input type="number" id="ecXtd" min="0.05" max="2" step="0.05" value="0.25"></div>
        <div><label for="ecRad">Turn radius (NM)</label><input type="number" id="ecRad" min="0.05" max="2" step="0.05" value="0.3"></div></div>
      <table class="res"><thead><tr><th>Leg</th><th>Course</th><th>Dist</th><th>Total</th></tr></thead><tbody id="ecLegs"></tbody></table>
      <div class="btns"><button id="ecCheck">Check route</button></div><ul class="msgs" id="ecIssues"></ul>
      <p class="hint">Switch "Add waypoints" on and click the chart. Always check the route before using it: every leg is tested, with its cross-track limit, against land, depths less than the safety depth and isolated dangers.</p></section>
    <section><h2>Route monitoring</h2>
      <div class="btns"><button id="ecMon">Start monitoring</button></div>
      <div class="small" id="ecMonInfo" style="font-family:ui-monospace,Consolas,monospace"></div></section>
    <section><h2>Alarms</h2><div class="check"><input type="checkbox" id="ecSound" checked><label for="ecSound">Audible alarms</label></div><ul class="alarms" id="ecAlarms"></ul></section>
    <section><h2>AIS targets</h2><table class="trk"><thead><tr><th>Name</th><th>BRG</th><th>RNG</th><th>COG</th><th>SOG</th><th>CPA</th><th>TCPA</th></tr></thead><tbody id="ecAisRows"></tbody></table>
      <p class="hint">AIS data is what the other ship transmits (its course and speed over the ground). Small craft and buoys carry no AIS here: they are seen only by radar. CPA here uses own GNSS position, course and speed over the ground.</p></section>`;

  const canvas = $<HTMLCanvasElement>("ecdis");
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const sound = createAlarmSound();
  let centre: Vec2 = { e: 0, n: 0 };
  let half = 6;
  let follow = true;
  let addWp = false;
  let cursor: Vec2 | null = null;
  let size = 600;
  let alarmSig = "";
  let legsSig = "";

  const k = (): number => size / (2 * half);
  const toScreen = (p: Vec2): { x: number; y: number } => ({ x: size / 2 + (p.e - centre.e) * k(), y: size / 2 - (p.n - centre.n) * k() });
  const toWorld = (x: number, y: number): Vec2 => ({ e: centre.e + (x - size / 2) / k(), n: centre.n - (y - size / 2) / k() });
  const evPos = (ev: PointerEvent | WheelEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * size, y: ((ev.clientY - r.top) / r.height) * size };
  };

  // ------------------------------------------------------------ controls
  const apply = (): void => {
    const s = api.getApp().ecdis.settings;
    half = Number(inputValue("ecScale"));
    s.palette = inputValue("ecPal") as "day" | "dusk" | "night";
    follow = ($("ecFollow") as HTMLInputElement).checked;
    s.showAis = ($("ecAis") as HTMLInputElement).checked;
    s.showArpa = ($("ecArpa") as HTMLInputElement).checked;
    s.showPastTrack = ($("ecTrack") as HTMLInputElement).checked;
    s.safetyDepthM = Math.max(0, Number(inputValue("ecSafe")) || 0);
    s.lookAheadMin = Math.min(30, Math.max(1, Number(inputValue("ecLook")) || 6));
    s.vectorMin = Math.min(60, Math.max(1, Number(inputValue("ecVec")) || 6));
    s.xtdLimitNm = Math.min(2, Math.max(0.05, Number(inputValue("ecXtd")) || 0.25));
    s.turnRadiusNm = Math.min(2, Math.max(0.05, Number(inputValue("ecRad")) || 0.3));
    const st = api.getApp().ecdis;
    st.gnss.failed = ($("ecGnssFail") as HTMLInputElement).checked;
    st.gnss.offset = { e: Number(inputValue("ecOffE")) || 0, n: Number(inputValue("ecOffN")) || 0 };
    sound.setEnabled(($("ecSound") as HTMLInputElement).checked);
  };
  for (const id of ["ecScale", "ecPal", "ecFollow", "ecAis", "ecArpa", "ecTrack", "ecSafe", "ecLook", "ecVec", "ecXtd", "ecRad", "ecGnssFail", "ecOffE", "ecOffN", "ecSound"]) {
    $(id).addEventListener("input", apply);
    $(id).addEventListener("change", apply);
  }
  $("ecHarbour").addEventListener("click", () => api.loadHarbour());
  $("ecAddWp").addEventListener("click", () => {
    addWp = !addWp;
    $("ecAddWp").textContent = `Add waypoints: ${addWp ? "ON" : "OFF"}`;
    $("ecAddWp").classList.toggle("on", addWp);
  });
  const routeChanged = (app: AppState): void => {
    app.ecdis.monitoring = false;
    app.ecdis.activeLeg = 0;
    $("ecIssues").innerHTML = '<li class="wn">Route changed: check it again.</li>';
  };
  $("ecUndo").addEventListener("click", () => {
    const app = api.getApp();
    app.ecdis.route.pop();
    routeChanged(app);
  });
  $("ecClear").addEventListener("click", () => {
    const app = api.getApp();
    app.ecdis.route = [];
    routeChanged(app);
  });
  $("ecPlan").addEventListener("click", () => {
    const app = api.getApp();
    app.ecdis.route = app.world.route.map((p) => ({ ...p }));
    routeChanged(app);
    if (app.ecdis.route.length === 0) $("ecIssues").innerHTML = '<li class="wn">This scenario has no prepared route.</li>';
  });
  $("ecCheck").addEventListener("click", () => {
    const app = api.getApp();
    const issues = checkRoute(app.world, app.ecdis.route, app.ecdis.settings);
    $("ecIssues").innerHTML = issues.length === 0
      ? `<li class="ok">No charted danger within ${app.ecdis.settings.xtdLimitNm} NM of the route at safety depth ${app.ecdis.settings.safetyDepthM} m.</li>`
      : issues.map((i) => `<li class="no">${i.leg > 0 ? `Leg ${i.leg}: ` : ""}${esc(i.text)}</li>`).join("");
    app.recorder?.note(app.world, `ECDIS route check: ${issues.length === 0 ? "clear" : `${issues.length} issue(s)`}.`);
  });
  $("ecMon").addEventListener("click", () => {
    const app = api.getApp();
    const st = app.ecdis;
    if (!st.monitoring && st.route.length < 2) {
      $("ecMonInfo").textContent = "Plan a route with at least two waypoints first.";
      return;
    }
    st.monitoring = !st.monitoring;
    st.activeLeg = 0;
  });
  $("ecMob").addEventListener("click", () => {
    const app = api.getApp();
    app.ecdis.mob = app.ecdis.mob ? null : { pos: { ...ecdisPosition(app.world, app.ecdis).pos }, time: app.world.time };
  });
  $("ecAlarms").addEventListener("pointerdown", (ev) => {
    const key = (ev.target as HTMLElement).closest("button")?.dataset["key"];
    if (key) {
      ackEcdisAlarm(api.getApp().ecdis, key);
      alarmSig = "";
    }
  });

  // ------------------------------------------------------------ pointer
  let drag: { x: number; y: number; moved: boolean } | null = null;
  canvas.addEventListener("pointerdown", (ev) => {
    const p = evPos(ev);
    drag = { x: p.x, y: p.y, moved: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener("pointermove", (ev) => {
    const p = evPos(ev);
    cursor = toWorld(p.x, p.y);
    if (drag && ev.buttons) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (drag.moved || Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        centre = { e: centre.e - dx / k(), n: centre.n + dy / k() };
        drag.x = p.x;
        drag.y = p.y;
        if (follow) {
          follow = false;
          ($("ecFollow") as HTMLInputElement).checked = false;
        }
      }
    }
  });
  canvas.addEventListener("pointerup", (ev) => {
    const p = evPos(ev);
    if (drag && !drag.moved && addWp) {
      const app = api.getApp();
      const w = toWorld(p.x, p.y);
      app.ecdis.route.push({ e: +w.e.toFixed(3), n: +w.n.toFixed(3) });
      routeChanged(app);
    }
    drag = null;
  });
  canvas.addEventListener("pointerleave", () => {
    cursor = null;
  });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const i = SCALES.indexOf(half);
    const j = Math.min(SCALES.length - 1, Math.max(0, (i < 0 ? 3 : i) + (ev.deltaY > 0 ? 1 : -1)));
    half = SCALES[j]!;
    ($("ecScale") as HTMLSelectElement).value = String(half);
  }, { passive: false });

  // ------------------------------------------------------------ drawing
  const draw = (app: AppState): void => {
    if (canvas.hidden) return;
    const w = app.world;
    const st = app.ecdis;
    const s = st.settings;
    const C = PALETTES[s.palette];
    const css = Math.max(280, Math.round(canvas.getBoundingClientRect().width));
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    size = css;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const own = ecdisPosition(w, st);
    if (follow) {
      const d = sub(own.pos, centre);
      if (Math.abs(d.e) > half * 0.6 || Math.abs(d.n) > half * 0.6) centre = { ...own.pos };
    }
    const poly = (pts: Vec2[], close: boolean): void => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = toScreen(p);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      if (close) ctx.closePath();
    };
    ctx.fillStyle = C.deep;
    ctx.fillRect(0, 0, size, size);
    // Depth areas: unsafe water (shallower than the safety depth) is the darker blue, bounded by the safety contour.
    ctx.font = "10px sans-serif";
    for (const d of [...w.depths].sort((a, b) => b.depthM - a.depthM)) {
      const unsafe = d.depthM < s.safetyDepthM;
      poly(d.points, true);
      ctx.fillStyle = unsafe ? C.unsafe : C.safe;
      ctx.fill();
      ctx.strokeStyle = unsafe ? C.text : C.grid;
      ctx.lineWidth = unsafe ? 2 : 0.8;
      ctx.stroke();
      const c = d.points.reduce((a, p) => add(a, p), { e: 0, n: 0 });
      const q = toScreen(scale(c, 1 / d.points.length));
      ctx.fillStyle = C.text;
      ctx.fillText(`${d.depthM} m`, q.x - 8, q.y + 3);
    }
    for (const c of w.coasts) {
      poly(c.points, c.closed);
      if (c.closed) {
        ctx.fillStyle = C.land;
        ctx.fill();
      }
      ctx.strokeStyle = C.coast;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Isolated dangers.
    for (const h of w.hazards) {
      const q = toScreen(h.center);
      const r = Math.max(5, h.radius * k());
      ctx.strokeStyle = C.danger;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.moveTo(q.x - 4, q.y - 4);
      ctx.lineTo(q.x + 4, q.y + 4);
      ctx.moveTo(q.x + 4, q.y - 4);
      ctx.lineTo(q.x - 4, q.y + 4);
      ctx.stroke();
      ctx.fillStyle = C.danger;
      ctx.fillText(h.name, q.x + r + 3, q.y + 3);
    }
    // Charted marks (buoys and beacons).
    for (const t of w.targets) {
      if (t.kind !== "buoy" && t.kind !== "beacon") continue;
      const q = toScreen(t.pos);
      ctx.fillStyle = C.text;
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (t.kind === "buoy") {
        ctx.moveTo(q.x - 4, q.y + 3);
        ctx.lineTo(q.x, q.y - 6);
        ctx.lineTo(q.x + 4, q.y + 3);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        for (let a = 0; a < 5; a++) {
          const an = (a * 72 - 90) * (Math.PI / 180);
          ctx.moveTo(q.x + 4 * Math.cos(an), q.y + 4 * Math.sin(an));
          ctx.lineTo(q.x + 8 * Math.cos(an), q.y + 8 * Math.sin(an));
        }
        ctx.stroke();
      }
      if (half <= 12) ctx.fillText(t.name, q.x + 7, q.y - 5);
    }
    // Route: legs, cross-track corridor, waypoints, wheel-over marks.
    const legs = routeLegs(st.route);
    legs.forEach((l, i) => {
      const a = toScreen(l.from), b = toScreen(l.to);
      const active = st.monitoring && i === st.activeLeg;
      ctx.strokeStyle = C.route;
      ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const u = scale(sub(l.to, l.from), 1 / Math.max(l.distance, 1e-9));
      const right = { e: u.n, n: -u.e };
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 0.8;
      for (const sgn of [1, -1]) {
        const p = toScreen(add(l.from, scale(right, sgn * s.xtdLimitNm))), q = toScreen(add(l.to, scale(right, sgn * s.xtdLimitNm)));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const next = legs[i + 1];
      if (next) {
        const wo = toScreen(add(l.to, scale(u, -wheelOverDistance(next.bearing - l.bearing, s.turnRadiusNm))));
        const p1 = { x: wo.x + right.e * 6, y: wo.y - right.n * 6 }, p2 = { x: wo.x - right.e * 6, y: wo.y + right.n * 6 };
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });
    st.route.forEach((p, i) => {
      const q = toScreen(p);
      ctx.strokeStyle = C.route;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = C.route;
      ctx.fillText(`WP${i + 1}`, q.x + 8, q.y + 12);
    });
    // Past track.
    if (s.showPastTrack && st.pastTrack.length > 1) {
      ctx.strokeStyle = C.own;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 3]);
      poly(st.pastTrack, false);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // AIS targets.
    if (s.showAis) {
      for (const t of aisTargets(w, st)) {
        const q = toScreen(t.pos);
        const a = (t.cog * Math.PI) / 180;
        ctx.strokeStyle = C.ais;
        ctx.fillStyle = C.ais;
        ctx.lineWidth = 1.5;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(5, 6);
        ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        const e = toScreen(add(t.pos, scale(velocityOf({ course: t.cog, speed: t.sog }), s.vectorMin / 60)));
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(t.name, q.x + 9, q.y + 3);
      }
    }
    // Radar (ARPA) tracked targets.
    if (s.showArpa && !app.roc && !app.arpa.settings.standby) {
      for (const t of arpaOverlay(w, st, app.arpa)) {
        const q = toScreen(t.pos);
        ctx.strokeStyle = t.dangerous ? C.danger : C.arpa;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        const e = toScreen(add(t.pos, scale(t.vel, s.vectorMin / 60)));
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        ctx.fillStyle = C.arpa;
        ctx.fillText(`R${t.id}`, q.x - 20, q.y - 8);
      }
    }
    // MOB.
    if (st.mob) {
      const q = toScreen(st.mob.pos);
      ctx.fillStyle = C.danger;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("MOB", q.x + 6, q.y - 6);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "10px sans-serif";
    }
    // Own ship: symbol, heading line, vector over the ground, look-ahead.
    const q = toScreen(own.pos);
    const cs = ecdisCogSog(w, st);
    const hd = (measuredHeading(w) * Math.PI) / 180;
    ctx.strokeStyle = C.own;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x + Math.sin(hd) * size, q.y - Math.cos(hd) * size);
    ctx.stroke();
    const v = toScreen(add(own.pos, scale(velocityOf(cs), s.vectorMin / 60)));
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(v.x, v.y);
    ctx.stroke();
    const la = toScreen(add(own.pos, scale(velocityOf(cs), s.lookAheadMin / 60)));
    ctx.strokeStyle = st.alarms.some((a) => a.kind === "grounding") ? C.danger : C.grid;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(la.x, la.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.own;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Furniture: scale bar, north, source, cursor.
    const bar = half >= 12 ? 5 : half >= 3 ? 1 : 0.25;
    ctx.strokeStyle = C.text;
    ctx.fillStyle = C.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, size - 14);
    ctx.lineTo(12 + bar * k(), size - 14);
    ctx.stroke();
    ctx.font = "11px sans-serif";
    ctx.fillText(`${bar} NM`, 12, size - 20);
    ctx.fillText("N ↑", size - 34, 18);
    ctx.fillText(`Position: ${own.source}${own.source === "DR" ? " (no GNSS)" : ""}   Safety depth ${s.safetyDepthM} m   NOT FOR NAVIGATION`, 12, 16);
    if (cursor) {
      const rel = sub(cursor, own.pos);
      const d = depthAt(w, cursor);
      ctx.fillText(`Cursor ${latLon(cursor)}  ${String(Math.round(bearingOf(rel))).padStart(3, "0")}° ${length(rel).toFixed(2)} NM  ${d === null ? "deep" : d === 0 ? "land" : `${d} m`}`, 12, 32);
    }
    const al = st.alarms.find((a) => !a.acked);
    if (al && Math.floor(app.wall * 2) % 2 === 0) {
      ctx.fillStyle = C.danger;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(al.text, size / 2, size - 36);
      ctx.textAlign = "left";
    }
  };

  // ------------------------------------------------------------ panel readouts
  const tick = (app: AppState): void => {
    const w = app.world;
    const st = app.ecdis;
    const un = st.alarms.filter((a) => !a.acked);
    sound.update(un.some((a) => a.kind === "grounding" || a.kind === "contour" || a.kind === "position") ? "danger" : un.length > 0 ? "warning" : "none", app.wall);
    if (pane.hidden) return;
    const own = ecdisPosition(w, st);
    const cs = ecdisCogSog(w, st);
    const d = depthAt(w, own.pos);
    $("ecPos").innerHTML = `${own.source === "GNSS" ? "GNSS" : '<span class="no">DEAD RECKONING</span>'} ${latLon(own.pos)}<br>HDG ${String(Math.round(measuredHeading(w))).padStart(3, "0")}° &nbsp; COG ${String(Math.round(cs.course)).padStart(3, "0")}° &nbsp; SOG ${cs.speed.toFixed(1)} kn<br>Charted depth here: ${d === null ? "deep water" : d === 0 ? "LAND" : `${d} m or less`}`;
    $("ecMobInfo").textContent = st.mob ? `MOB at ${mmss(st.mob.time)}: ${String(Math.round(bearingOf(sub(st.mob.pos, own.pos)))).padStart(3, "0")}° ${length(sub(st.mob.pos, own.pos)).toFixed(2)} NM from own ship. Press MOB again to clear.` : "";
    $("ecMon").textContent = st.monitoring ? "Stop monitoring" : "Start monitoring";
    const m = routeMonitor(w, st);
    if (m) {
      const legs = routeLegs(st.route);
      const ttg = m.ttgHours === null ? "---" : mmss(m.ttgHours * 3600);
      $("ecMonInfo").innerHTML = `To WP${m.leg + 2}: ${String(Math.round(m.bearingToWp)).padStart(3, "0")}° ${m.distanceToWp.toFixed(2)} NM<br>Track ${String(Math.round(legs[m.leg]!.bearing)).padStart(3, "0")}° &nbsp; XTD ${Math.abs(m.xtd).toFixed(2)} NM ${m.xtd > 0.005 ? "STBD" : m.xtd < -0.005 ? "PORT" : ""}<br>Distance to go ${m.distanceToGo.toFixed(2)} NM &nbsp; time to go ${ttg} (min:s)<br>${m.leg < legs.length - 1 ? `Next course ${String(Math.round(legs[m.leg + 1]!.bearing)).padStart(3, "0")}° (${m.nextTurnDeg >= 0 ? "stbd" : "port"} ${Math.abs(m.nextTurnDeg).toFixed(0)}°), wheel over in ${Math.max(0, m.toWheelOver).toFixed(2)} NM` : "Last leg"}`;
    } else if (!st.monitoring) $("ecMonInfo").textContent = "Not monitoring.";
    const lsig = JSON.stringify(st.route);
    if (lsig !== legsSig) {
      legsSig = lsig;
      let total = 0;
      $("ecLegs").innerHTML = routeLegs(st.route).map((l, i) => {
        total += l.distance;
        return `<tr><td>WP${i + 1} → WP${i + 2}</td><td>${String(Math.round(normalizeDeg(l.bearing))).padStart(3, "0")}°</td><td>${l.distance.toFixed(2)}</td><td>${total.toFixed(2)}</td></tr>`;
      }).join("") || '<tr><td colspan="4" class="small">No route.</td></tr>';
    }
    const sig = st.alarms.map((a) => `${a.key}${a.acked}${a.text}`).join("|");
    if (sig !== alarmSig) {
      alarmSig = sig;
      $("ecAlarms").innerHTML = st.alarms.map((a) => `<li class="${a.acked ? "" : "un"}"><span>${mmss(a.raisedAt)} ${esc(a.text)}</span>${a.acked ? "" : `<button data-key="${esc(a.key)}">Ack</button>`}</li>`).join("") || '<li><span class="small">No alarms.</span></li>';
    }
    $("ecAisRows").innerHTML = st.settings.showAis
      ? aisTargets(w, st).map((t) => `<tr><td>${esc(t.name)}</td><td>${String(Math.round(t.bearing)).padStart(3, "0")}</td><td>${t.range.toFixed(2)}</td><td>${String(Math.round(t.cog)).padStart(3, "0")}</td><td>${t.sog.toFixed(1)}</td><td>${t.cpa.opening ? "open" : t.cpa.cpa.toFixed(2)}</td><td>${t.cpa.tcpaMinutes === null ? "---" : t.cpa.tcpaMinutes.toFixed(1)}</td></tr>`).join("") || '<tr><td colspan="7" class="small">No AIS targets.</td></tr>'
      : '<tr><td colspan="7" class="small">AIS layer is off.</td></tr>';
  };

  const onAppChanged = (app: AppState): void => {
    centre = { ...app.world.own.pos };
    ($("ecGnssFail") as HTMLInputElement).checked = false;
    ($("ecOffE") as HTMLInputElement).value = "0";
    ($("ecOffN") as HTMLInputElement).value = "0";
    $("ecIssues").innerHTML = "";
    legsSig = "";
    alarmSig = "";
    apply();
  };

  return { tick, draw, onAppChanged };
}
