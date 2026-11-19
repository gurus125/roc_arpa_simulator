import { normalizeDeg } from "../core/vec";
import { MAX_ROUTE_WAYPOINTS } from "../core/route";

/**
 * Small tools of the instructor station that need no screen: reading what the instructor types.
 */

/**
 * A track typed for a target on a trainee's display: points as true bearing and range from that display's own
 * ship, in the order the target is to pass them, for example "045/6, 090/8.5" (or with spaces: "045 6; 090 8.5").
 * Returns null when a point cannot be read, a range is not above zero, or there are too many points.
 */
export function parseTrackText(text: string): { bearing: number; rangeNm: number }[] | null {
  const parts = text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_ROUTE_WAYPOINTS) return null;
  const out: { bearing: number; rangeNm: number }[] = [];
  for (const p of parts) {
    const m = /^(-?\d+(?:\.\d+)?)\s*(?:\/|\s)\s*(\d+(?:\.\d+)?)$/.exec(p);
    if (!m) return null;
    const bearing = Number(m[1]), rangeNm = Number(m[2]);
    if (!Number.isFinite(bearing) || !(rangeNm > 0) || rangeNm > 96) return null;
    out.push({ bearing: normalizeDeg(bearing), rangeNm });
  }
  return out;
}
