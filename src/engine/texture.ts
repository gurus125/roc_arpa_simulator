import { Vec2, bearingOf, length, sub, velocityOf } from "../core/vec";
import type { World } from "./types";
import { seaFromDeg } from "./world";

/**
 * The texture of the radar picture: what makes sea clutter spiky, rain irregular and small echoes fade in runs.
 * Everything here is worked from the position and the time alone (a hash, not a stored random state), so the
 * picture is the same however the simulation is stepped, and nothing needs copying with the world. None of it
 * changes how much clutter there is on average, nor how often a target is painted in the long run: the IMO
 * MSC.192(79) table 2 detection ranges and the clutter controls keep their calibration.
 *
 * The figures are PLACEHOLDERS that give the look described in the Radar and ARPA Manual (3rd edition): sea clutter
 * made of spikes that come and go from one scan to the next, stronger in streaks along the wave crests (3.6.1);
 * rain as an irregular, woolly area, heavier in its core (3.7.1); a small target in a seaway fading for several
 * scans together, not at random on single scans (3.6.2). They are not measured values.
 */
export const TEXTURE = {
  /** Size of a patch of sea clutter: along the direction the sea comes from, and along the crests, NM. */
  seaCellAlongNm: 0.03,
  seaCellCrestNm: 0.12,
  /** How spiky the sea clutter is: the patch strength is an exponential variable to this power (1 = no spikier than exponential). */
  seaSpikiness: 1.5,
  /** The ragged edge of a rain area: its radius varies between this share of the set radius and the whole of it. */
  rainEdgeMin: 0.72,
  /** Size of the lumps inside rain, NM, and how long its edge takes to change shape, seconds. */
  rainLumpNm: 0.4,
  rainEdgeChangeSec: 90,
  /** Rain drifts with the wind at this share of the wind's speed. */
  rainDriftShare: 0.6,
  /** A small target's fading changes over about this many seconds (two scans at 24 rpm). */
  fadeStepSec: 5,
  /** Sea state from which buoys and small craft fade in runs. */
  fadeFromSeaState: 2,
};

/** A hash of four whole numbers, 0 to 2^32 - 1. */
export function hash4(a: number, b: number, c: number, d: number): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (b | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ (c | 0), 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15) ^ (d | 0), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

/** A hash as a number strictly between 0 and 1. */
export const unitOf = (h: number): number => (h + 0.5) / 4294967296;

/** A standard normal number from a hash (Box and Muller). */
export function normalOf(h: number): number {
  const u1 = unitOf(h);
  const u2 = unitOf(hash4(h, 0x51ed270b, 7, 11));
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** The standard normal distribution function (Abramowitz and Stegun 7.1.26 for erf, error under 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

const smooth = (f: number): number => f * f * (3 - 2 * f);

/**
 * A random process in time, standard normal at every moment and changing over about `stepSec`: independent normal
 * values every `stepSec`, blended smoothly, and scaled so that the blend is again exactly standard normal.
 */
export function smoothNormal(id: number, salt: number, tSec: number, stepSec: number): number {
  const x = tSec / stepSec;
  const k = Math.floor(x);
  const s = smooth(x - k);
  const z0 = normalOf(hash4(id, salt, k, 0x2545f491));
  const z1 = normalOf(hash4(id, salt, k + 1, 0x2545f491));
  return ((1 - s) * z0 + s * z1) / Math.sqrt((1 - s) * (1 - s) + s * s);
}

/**
 * The draw that decides whether a target's echo is painted on this scan, in place of an independent random number:
 * every draw is evenly spread between 0 and 1, as a random number is, so the share of scans on which an echo is
 * painted is unchanged, but draws close in time are alike, so a weak echo fades and returns over several scans.
 */
export function fadeDraw(id: number, tSec: number): number {
  return normalCdf(smoothNormal(id, 0x0fade, tSec, TEXTURE.fadeStepSec));
}

/** Γ(k + 1) for the spikiness: the mean of an exponential variable to the power k. */
function gammaKPlus1(k: number): number {
  // Lanczos approximation (g = 7), good to about 15 figures for the arguments used here.
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const x = k; // Γ(x + 1)
  let a = c[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}
const SEA_MEAN = gammaKPlus1(TEXTURE.seaSpikiness);

/**
 * The strength of the sea clutter's patch at a position on this scan, as a multiple of its mean (the mean over many
 * patches is 1). Patches are short in the direction the sea comes from and long along the crests, so the spikes lie
 * in streaks across the sea; the pattern is new on every turn of the antenna.
 */
export function seaTexture(w: World, p: Vec2): number {
  const a = (seaFromDeg(w) * Math.PI) / 180;
  const ux = Math.sin(a), uy = Math.cos(a);
  const along = p.e * ux + p.n * uy;
  const crest = -p.e * uy + p.n * ux;
  const scan = Math.floor((w.time * w.radar.rpm) / 60 + 1e-9);
  const h = hash4(Math.floor(along / TEXTURE.seaCellAlongNm), Math.floor(crest / TEXTURE.seaCellCrestNm), scan, 0x5eac1);
  return Math.pow(-Math.log(unitOf(h)), TEXTURE.seaSpikiness) / SEA_MEAN;
}

/** Value noise between 0 and 1 on a lattice of unit spacing, smoothly blended. */
function valueNoise2(x: number, y: number, seed: number): number {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = smooth(x - i), fy = smooth(y - j);
  const v = (a: number, b: number): number => unitOf(hash4(a, b, seed, 0x7a1e));
  const bottom = v(i, j) + (v(i + 1, j) - v(i, j)) * fx;
  const top = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * fx;
  return bottom + (top - bottom) * fy;
}

/** Value noise between 0 and 1 round a circle (`turn` 0 to 1), with `knots` lattice points, changing over time. */
function ringNoise(turn: number, knots: number, seed: number, tSec: number): number {
  const x = turn * knots;
  const i = Math.floor(x);
  const f = smooth(x - i);
  const tt = tSec / TEXTURE.rainEdgeChangeSec;
  const k = Math.floor(tt);
  const g = smooth(tt - k);
  const v = (n: number, step: number): number => unitOf(hash4(((n % knots) + knots) % knots, seed, step, 0x3d9e));
  const at = (step: number): number => v(i, step) + (v(i + 1, step) - v(i, step)) * f;
  return at(k) + (at(k + 1) - at(k)) * g;
}

/**
 * How dense the rain clutter is at a position, as a multiple of the rain's mean (0 outside the rain): each area of
 * rain has a ragged edge that changes shape slowly, heavier rain in its core, and lumps that drift with the wind.
 * Over the rain's ragged area the mean is 1. Only the picture uses it: the loss of echo through rain is worked from
 * the rain's set circle and intensity (signal.ts).
 */
export function rainTexture(w: World, p: Vec2): number {
  let best = 0;
  w.env.rain.forEach((z, k) => {
    const d = sub(p, z.center);
    const dist = length(d);
    if (dist > z.radius || z.radius <= 0) return;
    const edge = z.radius * (TEXTURE.rainEdgeMin + (1 - TEXTURE.rainEdgeMin) * ringNoise(bearingOf(d) / 360, 9, k, w.time));
    if (dist > edge) return;
    const core = 1.25 - 0.5 * (dist / edge) ** 2;
    best = Math.max(best, core * (0.35 + 1.3 * rainLumps(w, k, p)));
  });
  return best;
}

/** The lumps inside the `k`th area of rain at a position (0 to 1, mean 0.5): a pattern that drifts with the wind. */
export function rainLumps(w: World, k: number, p: Vec2): number {
  const wind = w.env.wind;
  const drift = wind && wind.speedKn > 0 ? velocityOf({ course: (wind.from + 180) % 360, speed: wind.speedKn * TEXTURE.rainDriftShare }) : { e: 0, n: 0 };
  const hours = w.time / 3600;
  return valueNoise2((p.e - drift.e * hours) / TEXTURE.rainLumpNm, (p.n - drift.n * hours) / TEXTURE.rainLumpNm, k);
}
