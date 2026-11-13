/**
 * Display palettes. DAY: deep navy picture with amber echoes, off-white and cyan graphics, green tracked targets
 * and red danger (the institute's colour scheme of 13 Nov 2026: navy #061329 / #0A1D3A, steel blue #24466F,
 * cyan #00BFFF, teal #00D6C9, amber #FFC928, green #20D98A, orange #FF9F1C, red #FF3B4E). NIGHT: black
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
export const bgOuter = (): string => (mode === "day" ? "#061329" : "#000000");
export const bgPpi = (): string => (mode === "day" ? "#0a1d3a" : "#000000");
/** Inside the radar circle by day: a little lighter at the centre than at the edge. */
export const ppiGradient = (): [string, string] => (mode === "day" ? ["#0f2a50", "#081a36"] : ["#000000", "#000000"]);

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
      out = greenFamily ? css(214, 0.45, Math.min(0.93, l + 0.18), p[3]) : css(h, s, l, p[3]);
    } else {
      out = css(h, s * 0.9, l * 0.55, p[3]);
    }
  }
  cache.set(base, out);
  return out;
}

/**
 * A colour that keeps its meaning by day exactly as given (the scheme's green, red, orange, teal and cyan);
 * at night it is dimmed like every other graphic.
 */
export function K(base: string): string {
  if (mode === "day") return base;
  const key = `k:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = parse(base);
  let out = base;
  if (p) {
    const [h, s, l] = toHsl(p[0], p[1], p[2]);
    out = css(h, s * 0.9, l * 0.55, p[3]);
  }
  cache.set(key, out);
  return out;
}

/** The colours of the picture's own graphics, by day and by night. */
export function pic(): { ring: string; ringText: string; edge: string; tick: string; scaleText: string; heading: string; own: string; sweep: (a: number) => string; sweepLine: string; trail: string } {
  if (mode === "day") {
    return {
      ring: "rgba(86,128,186,0.55)", ringText: "#91a8c5", edge: "#00bfff", tick: "#6f93c2", scaleText: "#eaf2ff",
      heading: "#cfeeff", own: "#00bfff", sweep: (a) => `rgba(0,170,255,${a})`, sweepLine: "rgba(140,225,255,0.9)", trail: "#d7a82a",
    };
  }
  return {
    ring: G("#1f6b3a"), ringText: G("#4fa56d"), edge: G("#2f8f4e"), tick: G("#2f8f4e"), scaleText: G("#6dcf88"),
    heading: G("#e0ffe8"), own: G("#e0ffe8"), sweep: (a) => G(`rgba(110,255,150,${a})`), sweepLine: G("rgba(140,255,170,0.8)"), trail: G("#c8ffd4"),
  };
}

/**
 * Land echoes: by day a deeper, dimmer amber than other echoes, so the coast does not glare and ships' echoes
 * stand out against it; by night dimmer green. (The institute asked for land that does not light up.)
 */
export function landEchoColour(base: string): string {
  const key = `l:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = parse(base);
  let out = base;
  if (p) {
    const [, , l] = toHsl(p[0], p[1], p[2]);
    out = mode === "day" ? css(36, 0.8, Math.min(0.36, l * 0.45), p[3]) : css(75, 0.7, l * 0.32, p[3]);
  }
  cache.set(key, out);
  return out;
}

/** An echo colour: amber by day, dim green by night; the brightness of the base colour is kept. */
export function echoColour(base: string): string {
  const key = `e:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = parse(base);
  let out = base;
  if (p) {
    const [, , l] = toHsl(p[0], p[1], p[2]);
    out = mode === "day" ? css(45, 1, Math.min(0.58, l * 0.76), p[3]) : css(75, 0.8, l * 0.5, p[3]);
  }
  cache.set(key, out);
  return out;
}
