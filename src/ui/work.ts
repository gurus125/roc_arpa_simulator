import { DEG, Vec2, bearingOf, fromPolar, length, normalizeDeg, sub, velocityOf } from "../core/vec";
import { AppState } from "./app";
import { PlotReport, computeFix } from "../roc/index";

type Ctx = CanvasRenderingContext2D;

const PAPER = "#f2eedd";
const INK = "#2b3a35";
const FAINT = "#b9b7a4";

const mmss = (sec: number): string => {
  const s = Math.floor(sec + 1e-6);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function niceCeil(x: number): number {
  const steps = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
  return steps.find((s) => s >= x) ?? Math.ceil(x);
}

/** Plotting board: polar sheet centred on own ship, north up. */
export function drawBoard(ctx: Ctx, size: number, app: AppState): void {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);
  const session = app.roc;
  const obs = session ? session.observations.filter((o) => o.range > 0) : [];
  const maxR = niceCeil(Math.max(2, ...obs.map((o) => o.range * 1.15)));
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 26;
  const k = R / maxR;

  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6b6a58";
  ctx.font = "10px monospace";
  const ringStep = maxR <= 2 ? 0.5 : maxR <= 6 ? 1 : maxR <= 12 ? 2 : 4;
  for (let r = ringStep; r <= maxR + 1e-9; r += ringStep) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(String(r), cx + 3, cy - r * k - 2);
  }
  for (let b = 0; b < 360; b += 10) {
    const a = b * DEG;
    const major = b % 30 === 0;
    ctx.strokeStyle = major ? "#c9c6b0" : "#e0ddc8";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = "#6b6a58";
      ctx.textAlign = "center";
      ctx.fillText(String(b).padStart(3, "0"), cx + Math.sin(a) * (R + 14), cy - Math.cos(a) * (R + 14) + 3);
    }
  }
  ctx.textAlign = "left";

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText("O", cx + 6, cy - 5);

  const px = (v: Vec2): { x: number; y: number } => ({ x: cx + v.e * k, y: cy - v.n * k });
  const sorted = [...obs].sort((a, b) => a.timeSec - b.timeSec);
  const t0 = sorted[0]?.timeSec ?? 0;

  if (sorted.length >= 2) {
    // Relative motion line through the plotted points (least squares line is shown by the report; here join first and last).
    const p0 = fromPolar(sorted[0]!.bearing, sorted[0]!.range);
    const p1 = fromPolar(sorted[sorted.length - 1]!.bearing, sorted[sorted.length - 1]!.range);
    const d = sub(p1, p0);
    const len = length(d) || 1;
    const u = { e: d.e / len, n: d.n / len };
    ctx.strokeStyle = "#c0502d";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    const a = px({ e: p0.e - u.e * maxR * 2, n: p0.n - u.n * maxR * 2 });
    const b = px({ e: p1.e + u.e * maxR * 2, n: p1.n + u.n * maxR * 2 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
  }
  ctx.lineWidth = 1.5;
  for (let i = 0; i < sorted.length; i++) {
    const o = sorted[i]!;
    const p = px(fromPolar(o.bearing, o.range));
    ctx.strokeStyle = o.objectId === null ? "#a32d2d" : "#c0502d";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(`R${i + 1}  +${Math.round((o.timeSec - t0) / 60)}m`, p.x + 7, p.y - 5);
  }
  if (sorted.length === 0) {
    ctx.fillStyle = "#6b6a58";
    ctx.font = "12px sans-serif";
    ctx.fillText("Take observations to plot them here.", 12, size - 12);
  }
  ctx.restore();
}

/** Vector triangle for the last plot: own ship, target true and target relative vectors. */
export function drawTriangle(ctx: Ctx, size: number, report: PlotReport | null, student: { trueCourse: number; trueSpeed: number } | null): void {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);
  ctx.font = "11px sans-serif";
  if (!report || !report.valid || !report.truth || !report.fromPlot) {
    ctx.fillStyle = "#6b6a58";
    ctx.fillText("Check a valid plot first.", 12, 24);
    ctx.restore();
    return;
  }
  const truth = report.truth;
  // Own velocity = true target velocity minus relative velocity.
  const tv = velocityOf({ course: truth.trueCourse, speed: truth.trueSpeed });
  const rv = velocityOf({ course: truth.relativeCourse, speed: truth.relativeSpeed });
  const ov = { e: tv.e - rv.e, n: tv.n - rv.n };
  const pts = [{ e: 0, n: 0 }, ov, tv];
  const maxMag = Math.max(...pts.map((p) => Math.hypot(p.e, p.n)), 1);
  const k = (size * 0.34) / maxMag;
  const cx = size / 2 - ((ov.e + tv.e) / 3) * k;
  const cy = size / 2 + ((ov.n + tv.n) / 3) * k;
  const P = (v: Vec2): { x: number; y: number } => ({ x: cx + v.e * k, y: cy - v.n * k });
  const arrow = (a: Vec2, b: Vec2, colour: string, label: string, dashed = false, dx = 6, dy = -6, align: CanvasTextAlign = "left"): void => {
    const pa = P(a);
    const pb = P(b);
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    ctx.beginPath();
    ctx.moveTo(pb.x, pb.y);
    ctx.lineTo(pb.x - 9 * Math.cos(ang - 0.4), pb.y - 9 * Math.sin(ang - 0.4));
    ctx.lineTo(pb.x - 9 * Math.cos(ang + 0.4), pb.y - 9 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = align;
    ctx.fillText(label, (pa.x + pb.x) / 2 + dx, (pa.y + pb.y) / 2 + dy);
    ctx.textAlign = "left";
  };
  const O = { e: 0, n: 0 };
  arrow(O, ov, "#1f5fa5", `Own ship ${Math.hypot(ov.e, ov.n).toFixed(1)} kn`, false, 8, 0, "left");
  arrow(O, tv, "#2a7a3a", `Target true ${truth.trueSpeed.toFixed(1)} kn`, false, 0, 16, "center");
  arrow(ov, tv, "#c0502d", `Relative ${truth.relativeSpeed.toFixed(1)} kn`, false, -8, 0, "right");
  if (student) {
    const sv = velocityOf({ course: student.trueCourse, speed: student.trueSpeed });
    arrow(O, sv, "#7a7a7a", "Your true vector (dashed)", true, 0, 32, "center");
  }
  ctx.fillStyle = INK;
  const o = P(O);
  ctx.fillText("O", o.x - 12, o.y + 4);
  ctx.fillStyle = "#6b6a58";
  ctx.fillText("Vectors are speeds in knots on one scale.", 10, size - 24);
  ctx.fillText("Own ship + relative = target true.", 10, size - 10);
  ctx.restore();
}

/** Chart: land, charted objects, hazards, planned route, fixes, and (at the end) the track. */
export function drawChart(ctx: Ctx, size: number, app: AppState, hover: Vec2 | null): { toWorld: (x: number, y: number) => Vec2 } {
  const w = app.world;
  const session = app.roc;
  ctx.save();
  ctx.fillStyle = "#dbe8ee";
  ctx.fillRect(0, 0, size, size);

  const pts: Vec2[] = [w.own.pos, ...w.route, ...w.hazards.map((h) => h.center)];
  for (const c of w.coasts) pts.push(...c.points);
  for (const t of w.targets) if (t.kind === "beacon" || t.kind === "buoy") pts.push(t.pos);
  if (session?.finished) pts.push(...session.log.track.map((s) => s.pos));
  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  for (const p of pts) {
    minE = Math.min(minE, p.e);
    maxE = Math.max(maxE, p.e);
    minN = Math.min(minN, p.n);
    maxN = Math.max(maxN, p.n);
  }
  const span = Math.max(maxE - minE, maxN - minN, 4) + 2;
  const cE = (minE + maxE) / 2;
  const cN = (minN + maxN) / 2;
  const k = size / span;
  const P = (v: Vec2): { x: number; y: number } => ({ x: size / 2 + (v.e - cE) * k, y: size / 2 - (v.n - cN) * k });
  const toWorld = (x: number, y: number): Vec2 => ({ e: cE + (x - size / 2) / k, n: cN - (y - size / 2) / k });

  // Grid
  ctx.strokeStyle = "#b7cad3";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5d7480";
  ctx.font = "10px monospace";
  const gStep = span > 22 ? 4 : span > 11 ? 2 : 1;
  for (let e = Math.ceil((cE - span / 2) / gStep) * gStep; e <= cE + span / 2; e += gStep) {
    const a = P({ e, n: cN - span / 2 });
    const b = P({ e, n: cN + span / 2 });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillText(`E${e}`, a.x + 2, size - 3);
  }
  for (let n = Math.ceil((cN - span / 2) / gStep) * gStep; n <= cN + span / 2; n += gStep) {
    const a = P({ e: cE - span / 2, n });
    const b = P({ e: cE + span / 2, n });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillText(`N${n}`, 2, a.y - 2);
  }

  // Land
  for (const c of w.coasts) {
    ctx.beginPath();
    c.points.forEach((p, i) => {
      const q = P(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    if (c.closed) ctx.closePath();
    ctx.fillStyle = "#e6d9a8";
    ctx.strokeStyle = "#8a7a3c";
    ctx.lineWidth = 1.2;
    if (c.closed) ctx.fill();
    ctx.stroke();
  }

  // Hazards
  for (const h of w.hazards) {
    const c = P(h.center);
    ctx.strokeStyle = "#b02a2a";
    ctx.fillStyle = "rgba(176,42,42,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(3, h.radius * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8a1f1f";
    ctx.fillText(h.name, c.x + 6, c.y - 6);
  }

  // Planned route
  if (w.route.length > 1) {
    ctx.strokeStyle = "#8a1f6b";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    w.route.forEach((p, i) => {
      const q = P(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    for (const p of w.route) {
      const q = P(p);
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Charted objects
  for (const t of w.targets) {
    if (!(t.kind === "beacon" || t.kind === "buoy") || t.speed !== 0) continue;
    const q = P(t.pos);
    ctx.fillStyle = "#1f3b57";
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - 5);
    ctx.lineTo(q.x + 4.5, q.y + 4);
    ctx.lineTo(q.x - 4.5, q.y + 4);
    ctx.closePath();
    ctx.fill();
    if (t.pos.e < cE && q.x > 90) {
      ctx.textAlign = "right";
      ctx.fillText(t.name, q.x - 7, q.y + 3);
      ctx.textAlign = "left";
    } else {
      ctx.fillText(t.name, q.x + 7, q.y + 3);
    }
  }

  // Clearing ring
  if (session?.clearing) {
    const obj = w.targets.find((t) => t.id === session.clearing!.objectId);
    if (obj) {
      const c = P(obj.pos);
      ctx.strokeStyle = "#e0a82e";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, session.clearing.range * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Student's fixes
  if (session && (session.ex.id === "fix" || session.ex.id === "setdrift" || session.ex.id === "pilotage")) {
    for (let g = 1; g <= session.group; g++) {
      const f = computeFix(session.observations, session.charted, g);
      if (f.valid && f.pos) {
        const q = P(f.pos);
        ctx.strokeStyle = "#c0502d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(q.x - 6, q.y - 6);
        ctx.lineTo(q.x + 6, q.y + 6);
        ctx.moveTo(q.x - 6, q.y + 6);
        ctx.lineTo(q.x + 6, q.y - 6);
        ctx.stroke();
        ctx.fillStyle = "#7a2f12";
        ctx.fillText(`Fix ${g} ${mmss(f.time!)}`, q.x + 8, q.y - 6);
      }
    }
  }

  // Own track, shown at the end
  if (session?.finished && session.log.track.length > 1) {
    ctx.strokeStyle = "#1f5fa5";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    session.log.track.forEach((s, i) => {
      const q = P(s.pos);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    const end = P(w.own.pos);
    ctx.fillStyle = "#1f5fa5";
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("Own track", end.x + 7, end.y + 3);
  } else if (session && session.ex.id === "setdrift") {
    // no live position: the chart does not show where you are
  }

  if (hover) {
    const q = P(hover);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q.x - 7, q.y);
    ctx.lineTo(q.x + 7, q.y);
    ctx.moveTo(q.x, q.y - 7);
    ctx.lineTo(q.x, q.y + 7);
    ctx.stroke();
  }
  ctx.restore();
  return { toWorld };
}

export { bearingOf, normalizeDeg };
