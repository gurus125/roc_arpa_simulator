import { fromPolar, normalizeDeg } from "../core/vec";
import { rangeBearing } from "../core/nav";
import { ringInterval, worldToDisplayNm, toScreenNm, centreRef, toRef, ownCogSog, screenRotation, measuredRotation, measuredHeading, logSpeed } from "../engine/index";
import { AppState, ECHO_LIFETIME_S } from "./app";
import { drawArpa, drawArpaHud } from "./arpa-view";
import { HitKind } from "../engine/scan";

type Ctx = CanvasRenderingContext2D;

const MARGIN = 34;
const KIND_COLOUR: Record<HitKind, string> = {
  target: "#9dffb0",
  coast: "#7dff9f",
  multiple: "#6fe08a",
  sidelobe: "#6fe08a",
  "sea-clutter": "#4fbf70",
  "rain-clutter": "#58c47a",
  noise: "#3f9f5c",
  racon: "#c8ff9d",
  sart: "#c8ff9d",
  ramark: "#c8ff9d",
  "second-trace": "#9dffb0",
  interference: "#8fe8a8",
};

function fmtNm(x: number): string {
  return x < 1 ? x.toFixed(2).replace(/0$/, "") : String(x);
}

export function radarGeometry(size: number, rangeNm: number): { cx: number; cy: number; R: number; k: number } {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - MARGIN;
  return { cx, cy, R, k: R / rangeNm };
}

/** Draw the whole PPI into a square canvas of `size` CSS pixels. */
export function drawPpi(ctx: Ctx, size: number, app: AppState): void {
  const w = app.world;
  const ds = app.display;
  const c = w.radar.controls;
  const { cx, cy, R, k } = radarGeometry(size, c.rangeNm);
  /** True frame to screen. */
  const orient = screenRotation(w, ds);
  /** Gyro (measured) frame to screen: EBL and bearing scale. */
  const orientM = measuredRotation(w, ds);
  const px = (v: { x: number; y: number }): { x: number; y: number } => ({ x: cx + v.x * k, y: cy - v.y * k });
  const ownNm = worldToDisplayNm(w, ds, w.own.pos);
  const own = px(ownNm);
  const brill = Math.min(1.4, c.brilliance / 70);
  const dirOf = (screenDeg: number): { dx: number; dy: number } => {
    const a = (screenDeg * Math.PI) / 180;
    return { dx: Math.sin(a), dy: -Math.cos(a) };
  };

  ctx.save();
  ctx.fillStyle = "#010604";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#021109";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // Range rings
  const step = ringInterval(c.rangeNm);
  ctx.strokeStyle = "#1f6b3a";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#4fa56d";
  ctx.font = "11px monospace";
  // Rings are centred on own ship, so they follow it when the picture is off-centred or in true motion.
  for (let r = step; app.ringsOn && r <= c.rangeNm * 2 + 1e-9; r += step) {
    ctx.beginPath();
    ctx.arc(own.x, own.y, r * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(fmtNm(Math.round(r * 100) / 100), own.x + 4, own.y - r * k - 3);
  }

  // Blind (shadow) sectors, as a study aid
  if (app.showShadow) {
    ctx.fillStyle = "rgba(255,90,90,0.16)";
    for (const s of w.radar.shadowSectors) {
      const a0 = (w.own.heading - orient + s.from - 90) * (Math.PI / 180);
      let width = normalizeDeg(s.to - s.from);
      if (width === 0) width = 1;
      ctx.beginPath();
      ctx.moveTo(own.x, own.y);
      ctx.arc(own.x, own.y, R * 2, a0, a0 + (width * Math.PI) / 180);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Trails
  if (app.trailMode !== "off") {
    ctx.fillStyle = "#c8ffd4";
    const ctr = centreRef(w, ds);
    for (const t of w.targets) {
      const dots = app.trails.recent(t.id, w.time, app.trailMinutes);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]!;
        const age = (w.time - d.time) / (app.trailMinutes * 60);
        const v =
          app.trailMode === "relative"
            ? toScreenNm({ e: d.rel.e, n: d.rel.n }, orient)
            : toScreenNm({ e: d.ref.e - ctr.e, n: d.ref.n - ctr.n }, orient);
        const p =
          app.trailMode === "relative" ? px({ x: ownNm.x + v.x, y: ownNm.y + v.y }) : px(v);
        ctx.globalAlpha = Math.max(0.15, 0.8 * (1 - age));
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Echoes
  const named = new Map<number, { x: number; y: number }>();
  for (const lh of app.hits) {
    const age = app.wall - lh.born;
    const a = Math.min(1, lh.hit.strength * brill * Math.exp(-age / (ECHO_LIFETIME_S * 0.38)));
    if (a < 0.03) continue;
    const p = px(worldToDisplayNm(w, ds, lh.hit.pos));
    const s = lh.hit.size;
    ctx.globalAlpha = a;
    ctx.fillStyle = KIND_COLOUR[lh.hit.kind];
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    if (lh.hit.kind === "target" && lh.hit.targetId !== undefined) named.set(lh.hit.targetId, p);
  }
  ctx.globalAlpha = 1;

  if (app.showNames) {
    ctx.fillStyle = "#e8ffee";
    ctx.font = "11px sans-serif";
    for (const t of w.targets) {
      const p = named.get(t.id);
      if (p) ctx.fillText(t.name, p.x + 8, p.y - 6);
    }
  }

  // Heading line (can be suppressed for a moment to look for a small echo under it)
  // A heading marker error (instructor fault) paints the line off the ship's head.
  const hd = dirOf(w.own.heading - orient + (w.sensors.headingMarkerErrorDeg ?? 0));
  // Nav marks (radar map symbols), fixed to the ground.
  ctx.strokeStyle = "#ff9cf0";
  ctx.lineWidth = 1.4;
  for (const m of app.navMarks) {
    const s2 = px(worldToDisplayNm(w, ds, m));
    ctx.beginPath();
    ctx.moveTo(s2.x, s2.y - 7);
    ctx.lineTo(s2.x + 7, s2.y);
    ctx.lineTo(s2.x, s2.y + 7);
    ctx.lineTo(s2.x - 7, s2.y);
    ctx.closePath();
    ctx.stroke();
  }
  // Performance monitor: a plume of arcs astern whose length shows transmitter and receiver performance.
  if (app.pmOn) {
    const perf = Math.max(0, Math.min(1, w.radar.performance ?? 1));
    const full = 0.45 * R; // plume length with the set as new
    const base = (w.own.heading - orient + 180 - 90) * (Math.PI / 180);
    ctx.strokeStyle = "#c8ff9d";
    ctx.lineWidth = 2;
    for (let r = 0.08 * R; r <= 0.08 * R + full * perf; r += 6) {
      ctx.beginPath();
      ctx.arc(own.x, own.y, r, base - 0.26, base + 0.26);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(200,255,157,0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(own.x, own.y, 0.08 * R + full, base - 0.3, base + 0.3);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!app.hlOff) {
    ctx.strokeStyle = "#e0ffe8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(own.x, own.y);
    ctx.lineTo(own.x + hd.dx * R * 2, own.y + hd.dy * R * 2);
    ctx.stroke();
  }

  // EBL and VRM
  ctx.strokeStyle = "#ffd24a";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  if (app.ebl.on) {
    const d = dirOf(app.ebl.bearing - orientM);
    // EBL 1 may start from a fixed point instead of own ship (offset EBL).
    const o = app.eblOrigin ? px(worldToDisplayNm(w, ds, app.eblOrigin)) : own;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + d.dx * R * 4, o.y + d.dy * R * 4);
    ctx.stroke();
    if (app.eblOrigin) ctx.strokeRect(o.x - 3, o.y - 3, 6, 6);
  }
  // A VRM error (instructor fault) paints the ring at the wrong radius for its readout.
  const vrmK = 1 + (w.sensors.vrmErrorPct ?? 0) / 100;
  if (app.vrm.on) {
    ctx.beginPath();
    ctx.arc(own.x, own.y, app.vrm.range * vrmK * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#ffa64a";
  ctx.setLineDash([2, 4]);
  if (app.ebl2.on) {
    const d = dirOf(app.ebl2.bearing - orientM);
    ctx.beginPath();
    ctx.moveTo(own.x, own.y);
    ctx.lineTo(own.x + d.dx * R * 2, own.y + d.dy * R * 2);
    ctx.stroke();
  }
  if (app.vrm2.on) {
    ctx.beginPath();
    ctx.arc(own.x, own.y, app.vrm2.range * vrmK * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Radar map: navigation lines fixed to the ground (they need a ground-stabilised picture to stay on the land).
  ctx.strokeStyle = "#ff9cf0";
  ctx.setLineDash([]);
  for (const ln of app.navLines) {
    ctx.beginPath();
    ln.forEach((q, i) => {
      const s = px(worldToDisplayNm(w, ds, q));
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
      ctx.strokeRect(s.x - 2, s.y - 2, 4, 4);
    });
    ctx.stroke();
  }
  // Parallel index lines: fixed to own ship, parallel to a chosen bearing, at a chosen distance off.
  ctx.strokeStyle = "#7ad1ff";
  ctx.setLineDash([10, 4, 2, 4]);
  ctx.font = "10px monospace";
  ctx.fillStyle = "#7ad1ff";
  app.pi.forEach((p, i) => {
    if (!p.on) return;
    const d = dirOf(p.bearing - orientM);
    const nx = -d.dy, ny = d.dx; // starboard side of the line's direction, on the screen
    const cxp = own.x + nx * p.range * k, cyp = own.y + ny * p.range * k;
    ctx.beginPath();
    ctx.moveTo(cxp - d.dx * R * 3, cyp - d.dy * R * 3);
    ctx.lineTo(cxp + d.dx * R * 3, cyp + d.dy * R * 3);
    ctx.stroke();
    ctx.fillText(`PI${i + 1}`, cxp + 4, cyp - 4);
  });
  ctx.setLineDash([]);

  // ARPA symbols, vectors and zones
  drawArpa(ctx, app, px, ownNm, k, size);

  // Own ship
  ctx.strokeStyle = "#e0ffe8";
  ctx.fillStyle = "#e0ffe8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(own.x, own.y, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(own.x - 7, own.y);
  ctx.lineTo(own.x + 7, own.y);
  ctx.moveTo(own.x, own.y - 7);
  ctx.lineTo(own.x, own.y + 7);
  ctx.stroke();

  // Cursor
  if (app.cursor) {
    const p = px(app.cursor);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y);
    ctx.lineTo(p.x + 8, p.y);
    ctx.moveTo(p.x, p.y - 8);
    ctx.lineTo(p.x, p.y + 8);
    ctx.stroke();
  }

  // Sweep line with a smooth fading tail
  const sweepScreen = w.own.heading - orient + app.sweep;
  const toCanvasRad = (screenDeg: number): number => ((screenDeg - 90) * Math.PI) / 180;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `rgba(110,255,150,${0.13 * (1 - i / 16)})`;
    ctx.beginPath();
    ctx.moveTo(own.x, own.y);
    ctx.arc(own.x, own.y, R * 2, toCanvasRad(sweepScreen - (i + 1) * 2), toCanvasRad(sweepScreen - i * 2));
    ctx.closePath();
    ctx.fill();
  }
  const sd = dirOf(sweepScreen);
  ctx.strokeStyle = "rgba(140,255,170,0.8)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(own.x, own.y);
  ctx.lineTo(own.x + sd.dx * R * 2, own.y + sd.dy * R * 2);
  ctx.stroke();
  ctx.restore();

  // Bearing scale (outside the clip)
  ctx.strokeStyle = "#2f8f4e";
  ctx.fillStyle = "#6dcf88";
  ctx.lineWidth = 1;
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  for (let sa = 0; sa < 360; sa += 10) {
    const d = dirOf(sa);
    const major = sa % 30 === 0;
    const len = major ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(cx + d.dx * R, cy + d.dy * R);
    ctx.lineTo(cx + d.dx * (R + len), cy + d.dy * (R + len));
    ctx.stroke();
    if (major) {
      const label = ds.orientation === "head-up" ? sa : normalizeDeg(sa + orientM);
      ctx.fillText(String(Math.round(label)).padStart(3, "0"), cx + d.dx * (R + 21), cy + d.dy * (R + 21));
    }
  }
  const hm = dirOf(w.own.heading - orient);
  ctx.fillStyle = "#e0ffe8";
  ctx.beginPath();
  ctx.moveTo(cx + hm.dx * (R + 1), cy + hm.dy * (R + 1));
  ctx.lineTo(cx + hm.dx * (R + 11) - hm.dy * 5, cy + hm.dy * (R + 11) + hm.dx * 5);
  ctx.lineTo(cx + hm.dx * (R + 11) + hm.dy * 5, cy + hm.dy * (R + 11) - hm.dx * 5);
  ctx.closePath();
  ctx.fill();

  drawArpaHud(ctx, app, size);

  // HUD
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#8fd9a6";
  ctx.font = "12px monospace";
  const orientLabel = ds.orientation === "north-up" ? "N-UP" : ds.orientation === "head-up" ? "H-UP" : "C-UP";
  ctx.fillText(`${ds.motion === "relative" ? "RM" : "TM"}  ${orientLabel}  ${ds.stabilisation === "sea" ? "SEA" : "GND"}`, 8, 16);
  ctx.textAlign = "right";
  ctx.fillText(`${w.radar.band}-BAND   RANGE ${c.rangeNm} NM   RINGS ${app.ringsOn ? `${fmtNm(step)} NM` : "OFF"}`, size - 8, 16);
  ctx.textAlign = "left";
  const cog = ownCogSog(w);
  // (Heading and speeds are in the OWN SHIP box; the bottom-left corner carries the EBL/VRM and target keys.)
  ctx.textAlign = "right";
  ctx.fillStyle = "#58a56f";
  ctx.fillText("TRAINING USE ONLY", size - 8, size - 8);
  ctx.restore();
}

/**
 * Bearing and range of a point on the display, from own ship, as the radar reads them.
 * `trueBearing` is gyro-referenced, so it includes any injected gyro error.
 */
export function readoutAt(app: AppState, world: { e: number; n: number }): { range: number; trueBearing: number; relBearing: number } {
  const r = rangeBearing(app.world.own.pos, world);
  const trueBearing = normalizeDeg(r.bearing + app.world.sensors.gyroErrorDeg);
  return { range: r.range, trueBearing, relBearing: normalizeDeg(trueBearing - measuredHeading(app.world)) };
}

export { fromPolar, toRef };
