import { G, K } from "./palette";
import { Vec2, add, length, normalizeDeg, scale, sub, velocityOf } from "../core/vec";
import { ZoneSetting, arpaAvailableOnScale } from "../arpa/index";
import { collisionPoints, dangerAreas } from "../core/pad";
import { measuredHeading, measuredRotation, ownGroundVelocity, toScreenNm } from "../engine/index";
import { AppState } from "./app";
import { AIS_TURNING_ROT, aisFilterLabel, aisFilterOn, aisFilteredOut } from "../ais/index";
import { ownShipSymbol } from "./view";
import { shipTypeById } from "../core/shipmodel";

type Ctx = CanvasRenderingContext2D;
type P = { x: number; y: number };

// Symbols as in IMO SN.1/Circ.243/Rev.2, in the institute's colours: tracked targets green, dangerous red,
// lost orange, AIS teal, own ship's vector cyan.
const COL_BASE = {
  track: "#20d98a",
  acquiring: "#20d98a",
  danger: "#ff3b4e",
  lost: "#ff9f1c",
  trial: "#ff9cf0",
  own: "#00bfff",
  guard: "rgba(0,214,201,0.75)",
  excl: "rgba(170,170,170,0.55)",
  ais: "#00d6c9",
};
/** Colours whose meaning is kept exactly by day (dimmed at night); the others follow the palette. */
const KEEP = new Set<string>(["track", "acquiring", "danger", "lost", "own", "guard", "ais"]);
/** The base colours in the palette in use (day or night). */
const COL = new Proxy(COL_BASE, { get: (t, k) => (KEEP.has(k as string) ? K : G)(t[k as keyof typeof COL_BASE]) });

/**
 * A target's data label beside its symbol (shown when the target is clicked, IEC 62288 6.1.5: a temporary
 * overlay the user puts on and takes off): its name or number, range, and course and speed.
 */
function drawLabel(ctx: Ctx, p: P, lines: string[], colour: string, size: number): void {
  const fs = Math.max(11, Math.min(14, Math.round(size / 78)));
  const lh = Math.round(fs * 1.2);
  // Placed on the side towards the middle of the picture, so that it stays inside the circle.
  const left = p.x > size * 0.62;
  const below = p.y < size * 0.3;
  const x = left ? p.x - 15 : p.x + 15;
  const y0 = below ? p.y + 18 + fs : p.y - 12 - (lines.length - 1) * lh;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = `600 ${fs}px Consolas, "DejaVu Sans Mono", ui-monospace, monospace`;
  ctx.textAlign = left ? "right" : "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(4,12,28,0.85)";
  ctx.fillStyle = colour;
  lines.forEach((t, i) => {
    ctx.strokeText(t, x, y0 + i * lh);
    ctx.fillText(t, x, y0 + i * lh);
  });
  ctx.restore();
}
const p3 = (x: number): string => String(Math.round(normalizeDeg(x)) % 360).padStart(3, "0");

/**
 * ARPA overlay on the PPI: zones, target symbols, vectors, trial manoeuvre and alarm banner.
 * All ARPA data is in the gyro frame, so it is drawn with the measured-frame rotation and
 * lands on the echoes even when a gyro error is injected.
 */
export function drawArpa(ctx: Ctx, app: AppState, px: (v: P) => P, ownNm: P, k: number, size: number): void {
  if (app.roc) return;
  const w = app.world;
  const a = app.arpa;
  const s = a.settings;
  // In standby, and on a range scale the ARPA is not offered on, nothing is drawn on the picture; the message is
  // written in the corner by drawArpaHud. (Tracking carries on inside the ARPA on the other range scales.)
  if (s.standby || !arpaAvailableOnScale(w.radar.controls.rangeNm)) return;
  if (!s.showData) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, s.brilliance / 100));
  drawArpaData(ctx, app, px, ownNm, k, size);
  ctx.restore();
}

function drawArpaData(ctx: Ctx, app: AppState, px: (v: P) => P, ownNm: P, k: number, size: number): void {
  const w = app.world;
  const a = app.arpa;
  const s = a.settings;
  const B = Math.max(0, Math.min(1, s.brilliance / 100));
  const orientM = measuredRotation(w, app.display);
  const scr = (v: Vec2): P => toScreenNm(v, orientM);
  const at = (rel: Vec2): P => {
    const v = scr(rel);
    return px({ x: ownNm.x + v.x, y: ownNm.y + v.y });
  };
  const own = px(ownNm);
  const flash = Math.floor(app.wall * 2) % 2 === 0;
  const hm = measuredHeading(w);

  // Zones (relative bearings, centred on own ship)
  const zone = (z: ZoneSetting, colour: string, fill: string | null): void => {
    if (!z.on) return;
    const full = normalizeDeg(z.toRel - z.fromRel) === 0;
    const a0 = ((hm + z.fromRel - orientM - 90) * Math.PI) / 180;
    const a1 = full ? a0 + 2 * Math.PI : a0 + (normalizeDeg(z.toRel - z.fromRel) * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(own.x, own.y, z.outerNm * k, a0, a1);
    ctx.arc(own.x, own.y, z.innerNm * k, a1, a0, true);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.setLineDash(fill ? [] : [5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  for (const z of s.guardZones) zone(z, COL.guard, null);
  for (const z of s.exclusionZones) zone(z, COL.excl, G("rgba(140,140,140,0.10)"));

  const T = s.vectorMinutes / 60;
  const trialOn = s.trial.on;
  const ownV = a.ownVelocity(w);
  const trialV = velocityOf({ course: s.trial.course, speed: s.trial.speed });
  // Remaining delay (counts down while the trial is on): vectors are unchanged until then, then bend.
  const delayH = a.trialRemainingMin(w) / 60;
  const trialRows = trialOn ? new Map(a.trial(w).map((r) => [r.trackId, r])) : null;

  const line = (p0: P, p1: P, colour: string, dashed: boolean, width = 1.6): void => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  /** Arrowheads at the end of own ship's vector: one = stabilised through the water, two = over the ground. */
  const arrowHeads = (p0: P, p1: P, colour: string, count: number): void => {
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (len < 12) return;
    const ux = (p1.x - p0.x) / len, uy = (p1.y - p0.y) / len;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const tx = p1.x - ux * i * 6, ty = p1.y - uy * i * 6;
      ctx.moveTo(tx - ux * 7 - uy * 4, ty - uy * 7 + ux * 4);
      ctx.lineTo(tx, ty);
      ctx.lineTo(tx - ux * 7 + uy * 4, ty - uy * 7 - ux * 4);
    }
    ctx.stroke();
  };

  // Own ship vector: true vectors only. With a trial on, it shows own ship's future track
  // (present course and speed for the delay, then the trial course and speed).
  if (s.vectorMode === "true") {
    if (trialOn) {
      const d = Math.min(T, delayH);
      const mid = scr(scale(ownV, d));
      const end = scr(add(scale(ownV, d), scale(trialV, T - d)));
      const m = { x: own.x + mid.x * k, y: own.y - mid.y * k };
      line(own, m, COL.own, true, 2);
      const e2 = { x: own.x + end.x * k, y: own.y - end.y * k };
      line(m, e2, COL.trial, true, 2);
      arrowHeads(m, e2, COL.trial, a.effectiveStab() === "ground" ? 2 : 1);
    } else {
      const v = scr(scale(ownV, T));
      const e2 = { x: own.x + v.x * k, y: own.y - v.y * k };
      line(own, e2, COL.own, true, 2);
      arrowHeads(own, e2, COL.own, a.effectiveStab() === "ground" ? 2 : 1);
    }
  }

  // Guard-zone warning: the echo that caused it is marked until the warning is acknowledged.
  if (flash) {
    ctx.strokeStyle = COL.lost;
    ctx.lineWidth = 1.5;
    for (const al of a.alarms) {
      if (al.kind !== "guard" || al.acked || !al.rel) continue;
      const g = at(al.rel);
      ctx.strokeRect(g.x - 9, g.y - 9, 18, 18);
    }
  }

  // Self-test: two test targets with known motion, drawn with the vector time in use.
  if (a.test) {
    ctx.save();
    ctx.font = "11px monospace";
    for (const tg of a.test.targets) {
      const p = at(tg.rel);
      ctx.strokeStyle = COL.acquiring;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      line(p, at(add(tg.rel, scale(tg.relVel, T))), COL.acquiring, false);
      ctx.fillStyle = COL.acquiring;
      ctx.fillText(tg.id, p.x + 9, p.y - 7);
    }
    const ok = a.test.results.every((r) => r.ok);
    ctx.fillStyle = ok ? COL.track : COL.danger;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(ok ? "ARPA TEST: PASSED" : "ARPA TEST: FAILED", size / 2, 76);
    ctx.restore();
  }

  // AIS reported targets (IMO MSC.192(79) 5.26 to 5.30). They are placed by their reported
  // position, so with a gyro error they do not sit exactly on their radar echoes.
  const aisViews = app.ais.targets(w, a, { cpaNm: s.cpaLimitNm, tcpaMin: s.tcpaLimitMin });
  const hideTrack = new Set<number>();
  const ownGround = ownGroundVelocity(w);
  ctx.font = "10px monospace";
  for (const v of aisViews) {
    if (v.associatedTrack !== null) {
      if (app.ais.settings.associatedShows === "radar") continue;
      hideTrack.add(v.associatedTrack);
    }
    // Sleeping targets the filter excludes are left off the picture; activated, dangerous and lost ones never are.
    if (aisFilteredOut(v, app.ais.settings.sleepFilter, app.ais.selected)) continue;
    const rel = sub(v.pos, w.own.pos);
    const p = at(rel);
    const active = v.state === "activated";
    // While the trial manoeuvre is on, an activated target is drawn in the trial colour, red if the trial would not clear it.
    const trialDanger = trialOn && active && !!v.trial?.dangerous;
    const col = v.lost ? COL.lost : v.dangerous || trialDanger ? COL.danger : trialOn && active ? COL.trial : COL.ais;
    // Past positions of an activated target (IEC 62288 5.5.7.1), as for tracked radar targets: small dots.
    if (active && !v.lost && s.past.mode !== "off") {
      ctx.fillStyle = col;
      for (const q of app.ais.pastPositions(w, v.report.id, s.past.mode, Math.min(s.past.points, a.cfg.pastMaxPoints), s.past.intervalMin)) {
        const pp = at(q);
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Symbols as in IMO SN.1/Circ.243/Rev.2: an isosceles triangle with the reported position at its centre,
    // pointing along the heading; smaller when sleeping; bold and red when dangerous, flashing until acknowledged;
    // a lost target carries a bold cross that does not turn with the triangle, and no vector or heading line.
    const half = active ? 6 : 3.5; // half the base
    const h = half * 1.3; // half the height
    const hp = at(add(rel, velocityOf({ course: v.report.heading, speed: 1 })));
    const ang = Math.atan2(hp.x - p.x, -(hp.y - p.y));
    const unacked = app.ais.alarms.some((x) => (x.key === `ais-cpa-${v.report.id}` || x.key === `ais-lost-${v.report.id}`) && !x.acked);
    if ((v.dangerous || v.lost) && unacked && !flash) continue;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = v.dangerous ? 3 : active ? 1.6 : 1.2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(half, h);
    ctx.lineTo(-half, h);
    ctx.closePath();
    ctx.stroke();
    if (active && !v.lost) {
      // Heading line: solid, thinner than the vector, twice the length of the triangle, from its apex.
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(0, -h - 4 * h);
      // Turn indicator (IEC 62288 Annex A, 2.7b): a short line across the end of the heading line, towards the turn.
      const rot = v.report.rot;
      if (rot !== null && Math.abs(rot) >= AIS_TURNING_ROT) {
        ctx.moveTo(0, -h - 4 * h);
        ctx.lineTo(Math.sign(rot) * 6, -h - 4 * h);
      }
      ctx.stroke();
      // The ship's outline to scale, round the triangle, when own ship is drawn to scale and the target's beam
      // shows 3 mm or more (IEC 62288 Annex A, 2.5b). Its heading is the reported one; it is centred on the position.
      const L = v.report.lengthM, B = v.report.beamM;
      const ownType = w.own.model ? shipTypeById(w.own.model.typeId) : null;
      const ownOutlineShown = !!ownType && (ownType.beamM / 1852) * k >= ownShipSymbol.minBeamPx;
      if (L !== null && B !== null && ownOutlineShown && (B / 1852) * k >= ownShipSymbol.minBeamPx) {
        const l = (L / 1852) * k, b = (B / 1852) * k;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-b / 2, l / 2);
        ctx.lineTo(-b / 2, -l * 0.3);
        ctx.lineTo(0, -l / 2);
        ctx.lineTo(b / 2, -l * 0.3);
        ctx.lineTo(b / 2, l / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    if (v.lost) {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y - 9);
      ctx.lineTo(p.x + 9, p.y + 9);
      ctx.moveTo(p.x + 9, p.y - 9);
      ctx.lineTo(p.x - 9, p.y + 9);
      ctx.stroke();
    }
    if (v.associatedTrack !== null) {
      // Associated with a radar track and shown by its AIS symbol: a circle round the triangle.
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, h + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (active && !v.lost) {
      const tv = velocityOf({ course: v.report.cog, speed: v.report.sog });
      const vec = s.vectorMode === "true" ? tv : sub(tv, ownGround);
      const e = at(add(rel, scale(vec, T)));
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!app.tgtLabels.has(`a:${v.report.id}`)) ctx.fillText(v.report.name + (v.associatedTrack !== null ? ` = R${v.associatedTrack}` : ""), p.x + 10, p.y - 8);
    }
    if (app.tgtLabels.has(`a:${v.report.id}`)) {
      drawLabel(ctx, p, [`AIS ${v.report.name}`.slice(0, 18), `${v.range.toFixed(1)} NM`, `${p3(v.report.cog)}° ${v.report.sog.toFixed(0)} kn`], col, size);
    }
    if (app.ais.selected === v.report.id) {
      // Selected: a square shown by its corners.
      ctx.lineWidth = 1.2;
      const r = 13, c = 4;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.moveTo(p.x + sx * r, p.y + sy * (r - c));
        ctx.lineTo(p.x + sx * r, p.y + sy * r);
        ctx.lineTo(p.x + sx * (r - c), p.y + sy * r);
      }
      ctx.stroke();
    }
  }

  ctx.font = "11px monospace";
  for (const t of a.tracks) {
    if (hideTrack.has(t.id) && t.state === "tracking" && app.arpaSelected !== t.id) continue;
    // Past positions (relative: where it was relative to us; true: its track over the water or ground).
    if (s.past.mode !== "off" && t.state === "tracking") {
      ctx.fillStyle = COL.track;
      for (const q of a.pastPositions(w, t)) {
        const pp = at(q);
        ctx.fillRect(pp.x - 1.5, pp.y - 1.5, 3, 3);
      }
    }
    const rel = t.est?.rel ?? a.predictRel(t, w.time);
    const p = at(rel);
    const sel = app.arpaSelected === t.id;
    ctx.globalAlpha = B * (t.fading ? 0.55 : 1);

    if (t.state === "lost") {
      if (flash) {
        ctx.strokeStyle = COL.lost;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - 9, p.y - 9);
        ctx.lineTo(p.x + 9, p.y + 9);
        ctx.moveTo(p.x + 9, p.y - 9);
        ctx.lineTo(p.x - 9, p.y + 9);
        ctx.stroke();
      }
    } else if (t.quality === "acquiring" || !t.est) {
      const autoNew = a.alarms.some((x) => x.key === `new-${t.id}` && !x.acked);
      if (!autoNew || flash) {
        ctx.strokeStyle = autoNew ? COL.danger : COL.acquiring;
        ctx.lineWidth = autoNew ? 3 : 1.4;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      const trialDanger = trialRows?.get(t.id)?.dangerous ?? false;
      const danger = trialOn ? trialDanger : t.dangerous;
      const unacked = a.alarms.some((x) => x.key === `cpa-${t.id}` && !x.acked);
      const colour = danger ? COL.danger : trialOn ? COL.trial : COL.track;
      // Vector
      // Vectors are not drawn for a stationary target (true mode) or one on the same course and speed as own ship (relative mode).
      const hideVec = s.vectorMode === "true" ? length(t.est.trueVel) < a.cfg.stationaryKn : length(t.est.relVel) < a.cfg.stationaryKn;
      // Safe limit vector suppression: no vector for a target inside the safe limits (it is still tracked).
      const suppressed = s.vectorSuppress && !danger && !trialOn;
      if ((hideVec && !trialOn) || suppressed) {
        // no vector
      } else if (trialOn && s.vectorMode === "relative") {
        // Relative vector with a trial: unchanged until the delay has run, then bent to the trial relative motion.
        const d = Math.min(T, delayH);
        const mid = add(rel, scale(t.est.relVel, d));
        const end2 = add(mid, scale(sub(t.est.trueVel, trialV), T - d));
        const va = ctx.globalAlpha;
        if (t.quality === "prelim") ctx.globalAlpha = va * 0.55;
        line(p, at(mid), colour, true);
        line(at(mid), at(end2), colour, true);
        ctx.globalAlpha = va;
      } else {
        const vec = s.vectorMode === "true" ? t.est.trueVel : t.est.relVel;
        const va = ctx.globalAlpha;
        if (t.quality === "prelim") ctx.globalAlpha = va * 0.55;
        line(p, at(add(rel, scale(vec, T))), colour, true);
        ctx.globalAlpha = va;
      }
      // Collision-danger graphics: PPC (small circle) or PAD (hexagon) for steady tracks, at own ship's present speed.
      if (s.graphics !== "off" && t.quality === "steady" && !trialOn) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.2;
        if (s.graphics === "ppc") {
          for (const c of collisionPoints(rel, t.est.trueVel, length(ownV))) {
            const q = at(c.point);
            line(p, q, colour, true, 1);
            ctx.beginPath();
            ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          for (const d of dangerAreas(rel, t.est.trueVel, length(ownV), s.cpaLimitNm)) {
            line(p, at(d.ppc.point), colour, true, 1);
            ctx.beginPath();
            d.outline.forEach((v, i) => {
              const q = at(v);
              if (i === 0) ctx.moveTo(q.x, q.y);
              else ctx.lineTo(q.x, q.y);
            });
            ctx.closePath();
            ctx.stroke();
          }
        }
      }
      // Symbol
      if (danger && (!unacked || flash || trialOn)) {
        ctx.strokeStyle = COL.danger;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (a.alarms.some((x) => x.key === `new-${t.id}` && !x.acked) && !flash) {
        // New (intruder) target acquired in a guard zone: the symbol flashes until acknowledged.
      } else if (!danger) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (sel) {
      ctx.strokeStyle = G("#ffffff");
      ctx.lineWidth = 1.2;
      const r = 12;
      const c = 4;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.moveTo(p.x + sx * r, p.y + sy * (r - c));
        ctx.lineTo(p.x + sx * r, p.y + sy * r);
        ctx.lineTo(p.x + sx * (r - c), p.y + sy * r);
      }
      ctx.stroke();
    }
    const tag = a.groundRefId === t.id ? `${t.id} R` : String(t.id);
    if (app.tgtLabels.has(`t:${t.id}`)) {
      // The label: number, range, and the true course and speed once the ARPA has them ("?" while preliminary).
      const est = t.est && t.quality !== "acquiring" && t.state !== "lost" ? t.est : null;
      const q = t.quality === "prelim" ? "?" : "";
      const lines = [`TGT ${String(t.id).padStart(3, "0")}${a.groundRefId === t.id ? " R" : ""}`, `${length(rel).toFixed(1)} NM`,
        t.state === "lost" ? "LOST" : est ? `${p3(est.trueCS.course)}° ${est.trueCS.speed.toFixed(0)} kn${q}` : "ACQ"];
      const lc = t.state === "lost" ? COL.lost : t.dangerous ? COL.danger : COL.track;
      drawLabel(ctx, p, lines, lc, size);
    } else {
      ctx.fillStyle = t.state === "lost" ? COL.lost : COL.track;
      ctx.fillText(tag, p.x + 10, p.y + 14);
    }
    ctx.globalAlpha = B;
  }

}

/**
 * Size of the text in the corners of the picture: it follows the size of the picture, so the
 * short lines stay clear of the bearing scale on a small screen and can be read on a large one.
 */
export function hudText(size: number): { fs: number; lh: number; big: number } {
  const fs = Math.max(11, Math.min(16, Math.round(size / 62)));
  return { fs, lh: Math.round(fs * 1.35), big: Math.round(fs * 1.7) };
}

/**
 * The ARPA's settings and state in short lines, for the ARPA panel beside the picture (they used to
 * be written in a corner of the picture; the data panels now hold them, so no text sits on the
 * radar picture: IEC 62288 5.5.14 and 6.1.5). `cls` is "wn" for a line that needs attention.
 */
export function arpaStatusLines(app: AppState): { text: string; cls: string }[] {
  if (app.roc) return [{ text: "ARPA OFF DURING ROC EXERCISE", cls: "wn" }];
  const a = app.arpa;
  const s = a.settings;
  const out: { text: string; cls: string }[] = [];
  const line = (text: string, cls = ""): void => void out.push({ text, cls });
  if (s.standby) line("ARPA STANDBY", "wn");
  else if (!arpaAvailableOnScale(app.world.radar.controls.rangeNm)) line("ARPA NOT AVAILABLE ON THIS RANGE SCALE: USE 3, 6, 12 OR 24 NM", "wn");
  else {
    line(a.stabLabel());
    if (!s.lostWarning) line("LOST TGT WARNING OFF", "wn");
    if (!app.ais.settings.lostAlarm) line("AIS LOST WARNING OFF", "wn");
    if (app.ais.settings.on && aisFilterOn(app.ais.settings.sleepFilter)) line(`AIS FILTER ${aisFilterLabel(app.ais.settings.sleepFilter)}`);
    if (s.vectorSuppress) line("SAFE VECTORS OFF");
    if (s.anchorWatch.trackId !== null) line(`ANCHOR WATCH ${s.anchorWatch.trackId}`);
    if (!s.showData) line("ARPA DATA OFF", "wn");
    if (s.trial.on) line(`TRIAL ${String(Math.round(s.trial.course)).padStart(3, "0")}° ${s.trial.speed} kn`, "wn");
  }
  return out;
}

/** On the picture itself only the trial manoeuvre's large T (IMO SN.1/Circ.243), drawn outside the radar circle clip. */
export function drawArpaHud(ctx: Ctx, app: AppState, size: number): void {
  if (app.roc) return;
  const s = app.arpa.settings;
  const trialOn = s.trial.on;
  ctx.save();
  if (trialOn) {
    ctx.fillStyle = COL.trial;
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    // Steady, not flashing: flashing is kept for alerts that have not been acknowledged (IEC 62288 4.7.4).
    ctx.fillText("TRIAL", size / 2, 58);
    // A large T, steady, low on the picture (IMO SN.1/Circ.243: trial manoeuvre shown by a large T on screen).
    ctx.font = "bold 44px monospace";
    ctx.fillText("T", size / 2, size - 52);
  }
  ctx.restore();
}
