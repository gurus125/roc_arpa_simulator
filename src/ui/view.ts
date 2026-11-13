import { G, bgOuter, bgPpi, echoColour } from "./palette";
import { fromPolar, normalizeDeg } from "../core/vec";
import { rangeBearing } from "../core/nav";
import { pulseFor, radarPower, warmUpLeftSec, ringInterval, worldToDisplayNm, toScreenNm, centreRef, toRef, screenRotation, measuredRotation, measuredHeading, logSpeed, routeAhead } from "../engine/index";
import { AppState, ECHO_LIFETIME_S } from "./app";
import { ShipType, shipTypeById } from "../core/shipmodel";

/**
 * Sizes of own ship's symbol. IEC 62288 gives them in millimetres at a viewing distance of 1 m;
 * they are taken here at 96 pixels to the inch (3.78 pixels to the millimetre), the size a CSS
 * pixel is defined to be.
 */
export const ownShipSymbol = {
  /** Beam line: at least 5 mm each side of the reference point (symbol 1.4). */
  beamLineHalfPx: 19,
  /** The outline is not used when the ship's beam would be less than 3 mm on the screen (symbol 1.1a). */
  minBeamPx: 11.3,
};

/**
 * The radar antenna mark (IEC 62288 Annex A, symbol 1.2): crossed lines 1 to 2 mm long in all, at the
 * antenna's place on own ship's outline. Returns its centre in pixels from the reference point (x to
 * starboard, y ahead) and the half-length of each line, or null when the outline is not shown.
 */
export function antennaMarkPx(offsetM: { ahead: number; stbd: number }, type: Pick<ShipType, "lengthM" | "beamM"> | null, pxPerNm: number): { x: number; y: number; halfPx: number } | null {
  if (!ownOutline(type, pxPerNm)) return null;
  // 6 pixels in all: 1.6 mm at 3.78 pixels to the millimetre.
  return { x: (offsetM.stbd / 1852) * pxPerNm, y: (offsetM.ahead / 1852) * pxPerNm, halfPx: 3 };
}

/**
 * Own ship's outline to the scale of the picture, as points in pixels (x to starboard, y ahead)
 * round the middle of the ship, or null when the ship's beam would show smaller than 3 mm or the
 * ship's size is not known. `pxPerNm` is the scale of the picture.
 */
export function ownOutline(type: Pick<ShipType, "lengthM" | "beamM"> | null, pxPerNm: number): { x: number; y: number }[] | null {
  if (!type) return null;
  const L = (type.lengthM / 1852) * pxPerNm;
  const B = (type.beamM / 1852) * pxPerNm;
  if (B < ownShipSymbol.minBeamPx) return null;
  // A ship's plan: square stern, parallel sides, the bow tapering over the forward fifth of the length.
  return [
    { x: -B / 2, y: -L / 2 }, { x: -B / 2, y: L * 0.3 }, { x: 0, y: L / 2 }, { x: B / 2, y: L * 0.3 }, { x: B / 2, y: -L / 2 },
  ];
}
import { drawArpa, drawArpaHud, hudText } from "./arpa-view";
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
  false: "#9dffb0",
  indirect: "#9dffb0",
  "power-line": "#9dffb0",
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
  ctx.fillStyle = bgOuter();
  ctx.fillRect(0, 0, size, size);
  // Switched off, or warming up: the display shows nothing but the state of the radar.
  const pwr = radarPower(w);
  if (pwr === "off" || pwr === "warming") {
    const hudM = hudText(size);
    ctx.textAlign = "center";
    ctx.fillStyle = G("#ffb347");
    ctx.font = `bold ${hudM.big}px monospace`;
    const left = Math.ceil(warmUpLeftSec(w));
    ctx.fillText(pwr === "off" ? "RADAR OFF" : `WARMING UP ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, size / 2, size / 2);
    ctx.font = `${hudM.fs}px monospace`;
    ctx.fillStyle = G("#8fd9a6");
    ctx.fillText(pwr === "off" ? "Press the RADAR key to switch on" : "Then STANDBY: press the RADAR key to transmit", size / 2, size / 2 + 2 * hudM.lh);
    ctx.restore();
    return;
  }
  ctx.fillStyle = bgPpi();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // Range rings
  const step = ringInterval(c.rangeNm);
  ctx.strokeStyle = G("#1f6b3a");
  ctx.lineWidth = 1;
  ctx.fillStyle = G("#4fa56d");
  ctx.font = "11px monospace";
  // While the "graphics off" key is held, everything drawn over the radar video is left out, so that only the
  // video and the trails remain (IEC 62288 6.2.2.1; IEC 62388 8.2.3.1 lets the heading line go with the rest).
  const gfx = !app.hlOff;
  // Rings are centred on own ship, so they follow it when the picture is off-centred or in true motion.
  for (let r = step; gfx && app.ringsOn && r <= c.rangeNm * 2 + 1e-9; r += step) {
    ctx.beginPath();
    ctx.arc(own.x, own.y, r * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(fmtNm(Math.round(r * 100) / 100), own.x + 4, own.y - r * k - 3);
  }

  // Blind (shadow) sectors, as a study aid
  if (app.showShadow) {
    ctx.fillStyle = G("rgba(255,90,90,0.16)");
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
    ctx.fillStyle = G("#c8ffd4");
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
    const colour = echoColour(KIND_COLOUR[lh.hit.kind]);
    const h = lh.hit;
    if (h.arcDeg !== undefined && h.depthNm !== undefined) {
      // Painted as the radar would: an arc as wide as the beam (plus the target), as deep as the pulse (plus the target).
      const dx = p.x - own.x;
      const dy = p.y - own.y;
      const r = Math.hypot(dx, dy);
      const depth = Math.max(2, h.depthNm * k);
      const half = Math.max((h.arcDeg * Math.PI) / 360, 1.2 / Math.max(r, 1));
      const ang = Math.atan2(dy, dx);
      const rMid = Math.max(h.outward ? r + depth / 2 : r, depth / 2);
      ctx.strokeStyle = colour;
      ctx.lineWidth = depth;
      ctx.beginPath();
      ctx.arc(own.x, own.y, rMid, ang - half, ang + half);
      ctx.stroke();
    } else {
      ctx.fillStyle = colour;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    if (lh.hit.kind === "target" && lh.hit.targetId !== undefined) named.set(lh.hit.targetId, p);
  }
  ctx.globalAlpha = 1;

  if (app.showNames) {
    ctx.fillStyle = G("#e8ffee");
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
  ctx.strokeStyle = G("#ff9cf0");
  ctx.lineWidth = 1.4;
  for (const m of gfx ? app.navMarks : []) {
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
    ctx.strokeStyle = G("#c8ff9d");
    ctx.lineWidth = 2;
    for (let r = 0.08 * R; r <= 0.08 * R + full * perf; r += 6) {
      ctx.beginPath();
      ctx.arc(own.x, own.y, r, base - 0.26, base + 0.26);
      ctx.stroke();
    }
    ctx.strokeStyle = G("rgba(200,255,157,0.45)");
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(own.x, own.y, 0.08 * R + full, base - 0.3, base + 0.3);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!app.hlOff) {
    ctx.strokeStyle = G("#e0ffe8");
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(own.x, own.y);
    ctx.lineTo(own.x + hd.dx * R * 2, own.y + hd.dy * R * 2);
    ctx.stroke();
    // Stern line (IEC 62288 Annex A, symbol 1.5, optional): thin and dotted, from the reference point astern to the bearing scale.
    if (app.sternLine) {
      ctx.lineWidth = 1;
      ctx.setLineDash([1.5, 3]);
      ctx.beginPath();
      ctx.moveTo(own.x, own.y);
      ctx.lineTo(own.x - hd.dx * R * 2, own.y - hd.dy * R * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (gfx) {
  // EBL and VRM
  ctx.strokeStyle = G("#ffd24a");
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
  ctx.strokeStyle = G("#ffa64a");
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
  ctx.strokeStyle = G("#ff9cf0");
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
  // Instructor only: tracks programmed for the targets, and the track being programmed now.
  if (app.showRoutes || app.routeEdit) {
    const track = (from: { e: number; n: number }, pts: { e: number; n: number }[], colour: string, numbered: boolean): void => {
      if (pts.length === 0) return;
      ctx.strokeStyle = colour;
      ctx.fillStyle = colour;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      const a = px(worldToDisplayNm(w, ds, from));
      ctx.moveTo(a.x, a.y);
      for (const q of pts) {
        const s = px(worldToDisplayNm(w, ds, q));
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach((q, i) => {
        const s = px(worldToDisplayNm(w, ds, q));
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.stroke();
        if (numbered) ctx.fillText(String(i + 1), s.x + 5, s.y - 5);
      });
    };
    if (app.showRoutes) for (const t of w.targets) if (t.route && t.id !== app.routeEdit?.targetId) track(t.pos, routeAhead(t), G("#7fb7ff"), false);
    const ed = app.routeEdit;
    const edT = ed ? w.targets.find((t) => t.id === ed.targetId) : undefined;
    if (ed && edT) track(edT.pos, ed.points, "#ffb347", true);
  }
  // Parallel index lines: fixed to own ship, parallel to a chosen bearing, at a chosen distance off.
  ctx.strokeStyle = G("#7ad1ff");
  ctx.setLineDash([10, 4, 2, 4]);
  ctx.font = "10px monospace";
  ctx.fillStyle = G("#7ad1ff");
  app.pi.forEach((p, i) => {
    if (!p.on) return;
    const d = dirOf(p.bearing - orientM);
    const nx = -d.dy, ny = d.dx; // starboard side of the line's direction, on the screen
    const cxp = own.x + nx * p.range * k, cyp = own.y + ny * p.range * k;
    // A truncated line runs only the set distances from the point abeam of own ship.
    const fwd = p.ahead === null ? R * 3 : p.ahead * k;
    const back = p.astern === null ? R * 3 : p.astern * k;
    ctx.beginPath();
    ctx.moveTo(cxp - d.dx * back, cyp - d.dy * back);
    ctx.lineTo(cxp + d.dx * fwd, cyp + d.dy * fwd);
    ctx.stroke();
    ctx.fillText(`PI${i + 1}`, cxp + 4, cyp - 4);
  });
  ctx.setLineDash([]);

  // ARPA symbols, vectors and zones
  drawArpa(ctx, app, px, ownNm, k, size);

  // Own ship, as on a radar display (IEC 62288 Annex A, symbols 1.1a, 1.1c and 1.4): the minimised symbol, which
  // is the heading line with a beam line across it through the reference point; and, when the range scale is
  // short enough for the ship's beam to show, the ship's outline to scale. No circle is drawn round own ship.
  ctx.strokeStyle = G("#e0ffe8");
  ctx.fillStyle = G("#e0ffe8");
  ctx.lineWidth = 1;
  const beamHalf = ownShipSymbol.beamLineHalfPx;
  ctx.beginPath();
  ctx.moveTo(own.x - hd.dy * beamHalf, own.y + hd.dx * beamHalf);
  ctx.lineTo(own.x + hd.dy * beamHalf, own.y - hd.dx * beamHalf);
  ctx.stroke();
  const ownType = w.own.model ? shipTypeById(w.own.model.typeId) : null;
  const shape = ownOutline(ownType, k);
  // Radar antenna position (symbol 1.2, optional): only with the outline. The picture itself stays referenced to the reference point.
  const ant = app.antennaMark ? antennaMarkPx(app.antennaOffsetM, ownType, k) : null;
  if (ant) {
    const ax = own.x + hd.dx * ant.y - hd.dy * ant.x;
    const ay = own.y + hd.dy * ant.y + hd.dx * ant.x;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - ant.halfPx, ay);
    ctx.lineTo(ax + ant.halfPx, ay);
    ctx.moveTo(ax, ay - ant.halfPx);
    ctx.lineTo(ax, ay + ant.halfPx);
    ctx.stroke();
  }
  if (shape) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    shape.forEach((q, i) => {
      // q.x to starboard, q.y ahead, pixels; hd is the direction of the ship's head on the screen.
      const sx = own.x + hd.dx * q.y - hd.dy * q.x;
      const sy = own.y + hd.dy * q.y + hd.dx * q.x;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // Cursor
  if (app.cursor) {
    const p = px(app.cursor);
    ctx.strokeStyle = G("rgba(255,255,255,0.7)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y);
    ctx.lineTo(p.x + 8, p.y);
    ctx.moveTo(p.x, p.y - 8);
    ctx.lineTo(p.x, p.y + 8);
    ctx.stroke();
  }

  }

  // Sweep line with a smooth fading tail
  const sweepScreen = w.own.heading - orient + app.sweep;
  const toCanvasRad = (screenDeg: number): number => ((screenDeg - 90) * Math.PI) / 180;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = G(`rgba(110,255,150,${0.13 * (1 - i / 16)})`);
    ctx.beginPath();
    ctx.moveTo(own.x, own.y);
    ctx.arc(own.x, own.y, R * 2, toCanvasRad(sweepScreen - (i + 1) * 2), toCanvasRad(sweepScreen - i * 2));
    ctx.closePath();
    ctx.fill();
  }
  const sd = dirOf(sweepScreen);
  ctx.strokeStyle = G("rgba(140,255,170,0.8)");
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(own.x, own.y);
  ctx.lineTo(own.x + sd.dx * R * 2, own.y + sd.dy * R * 2);
  ctx.stroke();
  ctx.restore();

  // Bearing scale (outside the clip)
  ctx.strokeStyle = G("#2f8f4e");
  ctx.fillStyle = G("#6dcf88");
  ctx.lineWidth = 1;
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  // Numbered every 30 degrees, with a mark every 5 degrees; the 5 and 10 degree marks differ in length
  // (IEC 62388 9.10.2.1, IEC 62288 5.9.4.1).
  for (let sa = 0; sa < 360; sa += 5) {
    const d = dirOf(sa);
    const major = sa % 30 === 0;
    const len = major ? 10 : sa % 10 === 0 ? 7 : 3;
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
  ctx.fillStyle = G("#e0ffe8");
  ctx.beginPath();
  ctx.moveTo(cx + hm.dx * (R + 1), cy + hm.dy * (R + 1));
  ctx.lineTo(cx + hm.dx * (R + 11) - hm.dy * 5, cy + hm.dy * (R + 11) + hm.dx * 5);
  ctx.lineTo(cx + hm.dx * (R + 11) + hm.dy * 5, cy + hm.dy * (R + 11) - hm.dx * 5);
  ctx.closePath();
  ctx.fill();

  drawArpaHud(ctx, app, size);

  // In standby the graphics stay, with no echoes: say so in the middle of the picture.
  if (pwr === "standby") {
    const hudM = hudText(size);
    ctx.textAlign = "center";
    ctx.fillStyle = G("#ffb347");
    ctx.font = `bold ${hudM.big}px monospace`;
    ctx.fillText("STANDBY", size / 2, size / 2 - 3 * hudM.lh);
  }

  // Corner readouts, as on a radar screen: the range scale in large figures, the rings and the presentation
  // mode at the top left; band and pulse length at the top right, with the ARPA's lines under it (drawArpaHud).
  // The lines are short because the corners are the only room outside the circle.
  // (Heading and speeds are in the own ship box; the bottom-left corner carries the EBL/VRM and target keys.)
  const hud = hudText(size);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = G("#8fd9a6");
  ctx.font = `bold ${hud.big}px monospace`;
  ctx.fillText(`${c.rangeNm} NM`, 8, hud.big);
  ctx.font = `${hud.fs}px monospace`;
  const orientLabel = ds.orientation === "north-up" ? "N UP" : ds.orientation === "head-up" ? "H UP" : "C UP";
  ctx.fillText(`RINGS ${app.ringsOn ? `${fmtNm(step)} NM` : "OFF"}`, 8, hud.big + hud.lh);
  ctx.fillText(`${orientLabel}  ${ds.motion === "relative" ? "RM" : "TM"}`, 8, hud.big + 2 * hud.lh);
  ctx.fillText(ds.stabilisation === "sea" ? "SEA STAB" : "GND STAB", 8, hud.big + 3 * hud.lh);
  ctx.textAlign = "right";
  const pulse = pulseFor(c.rangeNm, c.pulse).name;
  ctx.fillText(`${w.radar.band}-BAND  ${pulse === "short" ? "SP" : pulse === "medium" ? "MP" : "LP"}`, size - 8, hud.lh);
  if (app.headingLost) {
    // Steady, in the colour of a warning (the failure itself is alerted by the ARPA): two short lines under the
    // presentation mode at the top left.
    ctx.textAlign = "left";
    ctx.fillStyle = G("#ffb347");
    ctx.fillText("HDG FAIL: UNSTAB", 8, hud.big + 4 * hud.lh);
    ctx.fillText("REL BRG ONLY", 8, hud.big + 5 * hud.lh);
    ctx.textAlign = "right";
  }
  ctx.fillStyle = G("#58a56f");
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
