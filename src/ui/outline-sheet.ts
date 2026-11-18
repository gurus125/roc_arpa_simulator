import { formatLatLon, latLonOf } from "../core/nav";
import { World } from "../engine/index";
import { esc } from "./dom";

/**
 * A printable outline of the scenario's area: the charted coastline, a latitude and longitude grid, a scale
 * and own ship's present position if wanted. It is for comparing the radar picture with charted information
 * and for plotting radar position lines by hand. It is NOT a chart: no depths, lights or buoys.
 */
export function outlineSheetHtml(w: World, title: string): string {
  const pts = w.coasts.flatMap((c) => c.points);
  const xs = [...pts.map((p) => p.e), w.own.pos.e], ys = [...pts.map((p) => p.n), w.own.pos.n];
  const pad = 1;
  const minE = Math.min(...xs) - pad, maxE = Math.max(...xs) + pad, minN = Math.min(...ys) - pad, maxN = Math.max(...ys) + pad;
  const W = 1000, H = Math.max(300, Math.round((W * (maxN - minN)) / (maxE - minE)));
  const k = W / (maxE - minE);
  const X = (e: number): number => (e - minE) * k;
  const Y = (n: number): number => H - (n - minN) * k;
  // A grid line every 5 minutes of latitude (5 NM) and the same number of minutes of longitude.
  const o = latLonOf(w.origin, { e: 0, n: 0 });
  const cosLat = Math.cos((o.lat * Math.PI) / 180);
  const stepMin = maxN - minN > 60 ? 10 : 5;
  let grid = "";
  const lat0 = latLonOf(w.origin, { e: 0, n: minN }).lat, lat1 = latLonOf(w.origin, { e: 0, n: maxN }).lat;
  for (let m = Math.ceil((lat0 * 60) / stepMin) * stepMin; m <= lat1 * 60; m += stepMin) {
    const n = (m / 60 - o.lat) * 60;
    grid += `<line x1="0" y1="${Y(n).toFixed(1)}" x2="${W}" y2="${Y(n).toFixed(1)}"/><text x="4" y="${(Y(n) - 3).toFixed(1)}">${formatLatLon(m / 60, "lat", 0)}</text>`;
  }
  const lon0 = latLonOf(w.origin, { e: minE, n: 0 }).lon, lon1 = latLonOf(w.origin, { e: maxE, n: 0 }).lon;
  for (let m = Math.ceil((lon0 * 60) / stepMin) * stepMin; m <= lon1 * 60; m += stepMin) {
    const e = (m / 60 - o.lon) * 60 * cosLat;
    grid += `<line x1="${X(e).toFixed(1)}" y1="0" x2="${X(e).toFixed(1)}" y2="${H}"/><text x="${(X(e) + 3).toFixed(1)}" y="${H - 5}">${formatLatLon(m / 60, "lon", 0)}</text>`;
  }
  const coast = w.coasts.map((c) => `<path d="M${c.points.map((p) => `${X(p.e).toFixed(1)},${Y(p.n).toFixed(1)}`).join(" L")}${c.closed ? " Z" : ""}"/>`).join("");
  const names = w.coasts.filter((c) => c.name).map((c) => {
    const e = c.points.reduce((s, p) => s + p.e, 0) / c.points.length, n = c.points.reduce((s, p) => s + p.n, 0) / c.points.length;
    return `<text class="nm" x="${X(e).toFixed(1)}" y="${Y(n).toFixed(1)}">${esc(c.name)}</text>`;
  }).join("");
  const tss = w.tss.map((t) => `<line class="tss" x1="${X(t.a.e).toFixed(1)}" y1="${Y(t.a.n).toFixed(1)}" x2="${X(t.b.e).toFixed(1)}" y2="${Y(t.b.n).toFixed(1)}"/>`).join("");
  const bar = 5 * k;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}: outline sheet</title><style>
    body{font:13px sans-serif;margin:12mm;color:#000} h1{font-size:17px;margin:0 0 2px} p{margin:2px 0 8px}
    svg{width:100%;height:auto;border:1px solid #000} .g line{stroke:#9ab;stroke-width:.6} .g text{font-size:11px;fill:#456}
    .c path{fill:#f1ead2;stroke:#000;stroke-width:1.2} .nm{font-size:11px;text-anchor:middle} .tss{stroke:#b0b;stroke-width:1;stroke-dasharray:6 5}
    @media print{button{display:none}}</style></head><body>
    <h1>${esc(title)}: outline for comparing with the radar</h1>
    <p><b>NOT A CHART.</b> Coastline only, as the simulator has it: no depths, lights, buoys or dangers. Training simulator, not for navigation.
    One minute of latitude is one nautical mile. <button onclick="print()">Print</button></p>
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><g class="c">${coast}</g><g class="g">${grid}</g>${tss}${names}
    <line x1="20" y1="20" x2="${(20 + bar).toFixed(1)}" y2="20" stroke="#000" stroke-width="3"/><text x="20" y="36" font-size="12">5 NM</text></svg>
    </body></html>`;
}
