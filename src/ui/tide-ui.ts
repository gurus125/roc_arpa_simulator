import { hoursFromNearestHw } from "../core/tide";
import { formatLatLon, latLonOf } from "../core/nav";
import { AREA_TIDES, AREA_TIDE_NOTE, World, tideClockH } from "../engine/index";
import { esc } from "./dom";

/** The tide's clock as a navigator says it: "HW-2.5 h", "HW", "HW+1.0 h" (from the nearest high water). */
export function hwText(hoursFromHw: number): string {
  const o = hoursFromNearestHw(hoursFromHw);
  if (Math.abs(o) < 0.05) return "HW";
  return `HW${o > 0 ? "+" : "−"}${Math.abs(o).toFixed(1)} h`;
}

const pad3 = (x: number): string => String(Math.round(((x % 360) + 360) % 360) % 360).padStart(3, "0");

/**
 * The tidal stream table of the scenario or the real area, as on a chart: one column per diamond (its position),
 * one row per hour from HW-6 to HW+6, each cell "set  spring rate / neap rate". The row of the hour now is marked when
 * the tide is on. Below it, the heights of the tide. Empty text when there is no table.
 */
export function tideTableHtml(w: World): string {
  const area = w.area ? AREA_TIDES[w.area] : undefined;
  const diamonds = w.env.tide?.diamonds ?? area?.diamonds ?? [];
  const heights = w.env.tide?.heights ?? area?.heights ?? null;
  if (diamonds.length === 0 && !heights) return "<p>No tidal stream table for this scenario.</p>";
  const invented = !w.env.tide?.diamonds && !!area;
  const now = w.env.tide ? Math.round(Math.max(-6, Math.min(6, hoursFromNearestHw(tideClockH(w))))) : null;
  const head = diamonds
    .map((d) => {
      const ll = latLonOf(w.origin, d.pos);
      return `<th>${esc(d.id)}<br><span class="small">${formatLatLon(ll.lat, "lat")}<br>${formatLatLon(ll.lon, "lon")}</span></th>`;
    })
    .join("");
  const rows: string[] = [];
  for (let k = 0; k <= 12; k++) {
    const h = k - 6;
    const label = h === 0 ? "HW" : `HW${h > 0 ? "+" : "−"}${Math.abs(h)}`;
    const cells = diamonds.map((d) => {
      const x = d.hours[k]!;
      return `<td>${pad3(x.set)}° ${x.spring.toFixed(1)}/${x.neap.toFixed(1)}</td>`;
    });
    rows.push(`<tr${now === h ? ' class="now"' : ""}><th>${label}</th>${cells.join("")}</tr>`);
  }
  const port = area?.port ? ` at ${esc(area.port)}` : "";
  const hts = heights
    ? `<p>Heights above chart datum${port}: MHWS ${heights.mhws.toFixed(1)} m, MHWN ${heights.mhwn.toFixed(1)} m, MLWN ${heights.mlwn.toFixed(1)} m, MLWS ${heights.mlws.toFixed(1)} m.</p>`
    : "";
  return (
    (diamonds.length
      ? `<p>Hours from high water${port}. Each cell: direction the stream runs towards, rate at springs / neaps (kn).</p>` +
        `<table class="tideTable"><thead><tr><th>Hour</th>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`
      : "") +
    hts +
    (invented ? `<p><strong>${esc(AREA_TIDE_NOTE)}</strong></p>` : "<p>Training simulator: not for navigation.</p>")
  );
}
