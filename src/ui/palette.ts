/**
 * Display palettes. DAY: dark-blue picture with yellow echoes and white graphics. NIGHT: black
 * picture, everything dimmed, so the display does not spoil night vision. These follow the usual
 * day and night presentations of marine radars in general; they are not a copy of any maker's.
 *
 * The picture code is written with one set of base colours (green graphics on black). `G` maps a
 * base colour to the palette in use; `echoColour` does the same for echoes.
 */
export type DisplayMode = "day" | "night";

let mode: DisplayMode = "day";
export const displayMode = (): DisplayMode => mode;
export function setDisplayPalette(m: DisplayMode): void {
  mode = m;
  cache.clear();
}

/** Background outside the radar circle, and inside it. */
export const bgOuter = (): string => (mode === "day" ? "#04103a" : "#000000");
export const bgPpi = (): string => (mode === "day" ? "#061a5c" : "#000000");

const cache = new Map<string, string>();

function parse(c: string): [number, number, number, number] | null {
  let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (m) return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16), 1];
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
}
function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}
const css = (h: number, s: number, l: number, a: number): string => `hsla(${h.toFixed(0)},${(s * 100).toFixed(0)}%,${(l * 100).toFixed(0)}%,${a})`;

/** A graphics colour (rings, scales, lines, symbols, text) in the palette in use. */
export function G(base: string): string {
  const hit = cache.get(base);
  if (hit) return hit;
  const p = parse(base);
  let out = base;
  if (p) {
    const [h, s, l] = toHsl(p[0], p[1], p[2]);
    const greenFamily = s > 0.2 && h >= 90 && h <= 165;
    if (mode === "day") {
      // Green graphics of the base scheme become near-white; other colours (cyan ARPA symbols, red danger, amber EBL) keep their meaning.
      out = greenFamily ? css(215, 0.35, Math.min(0.92, l + 0.18), p[3]) : css(h, s, l, p[3]);
    } else {
      out = css(h, s * 0.9, l * 0.55, p[3]);
    }
  }
  cache.set(base, out);
  return out;
}

/** An echo colour: yellow by day, dim green by night; the brightness of the base colour is kept. */
export function echoColour(base: string): string {
  const key = `e:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = parse(base);
  let out = base;
  if (p) {
    const [, , l] = toHsl(p[0], p[1], p[2]);
    out = mode === "day" ? css(54, 1, Math.min(0.62, l * 0.8), p[3]) : css(75, 0.8, l * 0.5, p[3]);
  }
  cache.set(key, out);
  return out;
}
