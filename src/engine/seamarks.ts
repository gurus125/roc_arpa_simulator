import { Vec2 } from "../core/vec";
import { rcsForDetectionRange } from "./band";
import type { Target } from "./types";

/**
 * Buoys, beacons and lights of a real area (engine/real-seamarks.ts, made by scripts/make-seamarks.mjs from the sea
 * marks mapped in OpenStreetMap): where each one is in the scenario's frame, what it is, its light and its racon. As
 * mapped there by volunteers: some are missing, and some may have been moved or changed since. Not a chart and not
 * for navigation.
 */
export type SeaMarkShape = "buoy" | "beacon" | "light" | "light-vessel" | "danger";
export type SeaMarkCategory =
  | "port" | "starboard" | "preferred-port" | "preferred-starboard"
  | "north" | "east" | "south" | "west"
  | "isolated-danger" | "safe-water" | "special" | "mooring" | "major-light" | "minor-light"
  | "rock" | "wreck" | "other";

export interface SeaMark {
  name: string;
  shape: SeaMarkShape;
  category: SeaMarkCategory;
  /** NM east and north of the area's origin. */
  pos: Vec2;
  /** The light as a chart writes it, for example "Fl(2) G 6s 12m 5M". */
  light?: string;
  /** The racon's Morse letter. */
  racon?: string;
  /** Carries a radar reflector. */
  reflector?: boolean;
}

const LATERAL: Record<string, SeaMarkCategory> = { port: "port", starboard: "starboard", preferred_channel_port: "preferred-port", preferred_channel_starboard: "preferred-starboard" };
const CARDINAL: Record<string, SeaMarkCategory> = { north: "north", east: "east", south: "south", west: "west" };
const COLOUR: Record<string, string> = { white: "W", red: "R", green: "G", yellow: "Y", blue: "Bu", orange: "Or", violet: "Vi", amber: "Am" };
/** The chart abbreviations of the light characters OpenStreetMap uses. */
const CHARACTER = new Set(["F", "Fl", "LFl", "Q", "VQ", "UQ", "IQ", "IVQ", "IUQ", "Iso", "Oc", "Mo", "Al.Fl", "Al.Oc", "Al.LFl", "Al.Iso", "Al.F", "FFl", "Fl+LFl", "Q+LFl", "VQ+LFl", "Al.Q", "Al.VQ"]);

const NAMES: Record<SeaMarkCategory, string> = {
  port: "Port-hand", starboard: "Starboard-hand", "preferred-port": "Preferred channel to port", "preferred-starboard": "Preferred channel to starboard",
  north: "North cardinal", east: "East cardinal", south: "South cardinal", west: "West cardinal",
  "isolated-danger": "Isolated danger", "safe-water": "Safe water", special: "Special", mooring: "Mooring", "major-light": "Light", "minor-light": "Light",
  rock: "Rock", wreck: "Wreck", other: "Mark",
};
const ROCKS: Record<string, string> = { covers: "Rock that covers and uncovers", awash: "Rock awash", submerged: "Underwater rock", dry: "Rock above water" };
const WRECKS: Record<string, string> = { dangerous: "Dangerous wreck", "non-dangerous": "Wreck, not dangerous", hull_showing: "Wreck showing its hull", mast_showing: "Wreck showing its mast" };
/** A light whose range is at least this, NM, is drawn as a major light when the map gives it only as a landmark. PLACEHOLDER. */
export const MAJOR_LIGHT_RANGE_NM = 15;

/** What a sea mark is, from its OpenStreetMap tags; null when it is not a buoy, beacon or light this simulator shows. */
export function seaMarkFromTags(tags: Record<string, string>, pos: Vec2): SeaMark | null {
  const type = tags["seamark:type"] ?? "";
  const sub = (key: string): string => tags[`seamark:${type}:${key}`] ?? "";
  let shape: SeaMarkShape;
  let category: SeaMarkCategory;
  if (type.startsWith("buoy_") || type.startsWith("beacon_")) {
    shape = type.startsWith("buoy_") ? "buoy" : "beacon";
    const kind = type.slice(type.indexOf("_") + 1);
    category =
      kind === "lateral" ? LATERAL[sub("category")] ?? "other"
      : kind === "cardinal" ? CARDINAL[sub("category")] ?? "other"
      : kind === "isolated_danger" ? "isolated-danger"
      : kind === "safe_water" ? "safe-water"
      : kind === "special_purpose" ? "special"
      : "other";
  } else if (type === "light_major" || type === "light_minor") {
    shape = "light";
    category = type === "light_major" ? "major-light" : "minor-light";
  } else if (type === "light_vessel" || type === "light_float") {
    shape = "light-vessel";
    category = "major-light";
  } else if (type === "mooring" && (sub("category") === "buoy" || tags["seamark:mooring:category"] === "buoy")) {
    shape = "buoy";
    category = "mooring";
  } else if ((type === "landmark" || type === "pile") && lightText(tags)) {
    // A lighthouse is often mapped as a landmark that carries a light, and a small light as a pile.
    shape = "light";
    const range = Number.parseFloat(tags["seamark:light:range"] ?? tags["seamark:light:1:range"] ?? "");
    category = Number.isFinite(range) && range >= MAJOR_LIGHT_RANGE_NM ? "major-light" : "minor-light";
  } else if (type === "rock" || type === "wreck") {
    // Dangers: drawn on the area map only.
    shape = "danger";
    category = type;
  } else {
    return null;
  }
  let light = lightText(tags);
  // What the map says of a light out of use, kept with it.
  const info = `${tags["seamark:information"] ?? ""} ${tags["information"] ?? ""}`;
  const out = /temporarily (extinguished|discontinued)\s*\(?(\d{4})?\)?/i.exec(info);
  if (light && out) light += ` (temporarily ${out[1]!.toLowerCase()}${out[2] ? `, ${out[2]}` : ""})`;
  const racon = raconLetter(tags);
  const named = (tags["seamark:name"] ?? tags["name"] ?? "").trim();
  const what =
    shape === "light" ? NAMES[category]
    : shape === "light-vessel" ? (type === "light_float" ? "Light float" : "Light vessel")
    : shape === "danger" ? (type === "rock" ? ROCKS[tags["seamark:rock:water_level"] ?? ""] ?? "Rock" : WRECKS[tags["seamark:wreck:category"] ?? ""] ?? "Wreck")
    : `${NAMES[category]} ${shape}`;
  return {
    name: named || what,
    shape,
    category,
    pos,
    ...(light ? { light } : {}),
    ...(racon ? { racon } : {}),
    ...((tags["seamark:radar_reflector"] ?? "") === "yes" || tags["seamark:radar_reflector"] === "true" ? { reflector: true } : {}),
  };
}

/** The light as a chart writes it (character, group, colours, period, height, range), from the tags; "" without one. */
export function lightText(tags: Record<string, string>): string {
  // An unnumbered light, else the first sector of a sectored light (seamark:light:1:...).
  const pick = (k: string): string => tags[`seamark:light:${k}`] ?? tags[`seamark:light:1:${k}`] ?? "";
  const ch = pick("character").trim();
  if (!ch || !CHARACTER.has(ch)) return "";
  const group = pick("group").replace(/[()]/g, "").trim();
  // The colours of every sector, once each.
  const colours: string[] = [];
  for (const [k, v] of Object.entries(tags)) {
    if (!/^seamark:light:(\d+:)?colour$/.test(k)) continue;
    for (const c of v.split(";")) {
      const a = COLOUR[c.trim()];
      if (a && !colours.includes(a)) colours.push(a);
    }
  }
  const order = ["W", "R", "G", "Y", "Bu", "Or", "Vi", "Am"];
  colours.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const num = (k: string): string => {
    const v = Number.parseFloat(pick(k));
    return Number.isFinite(v) && v > 0 ? String(Math.round(v * 10) / 10) : "";
  };
  const period = num("period"), height = num("height"), range = num("range");
  return [`${ch}${group ? `(${group})` : ""}`, colours.join(""), period && `${period}s`, height && `${height}m`, range && `${range}M`].filter(Boolean).join(" ");
}

/** The racon's Morse letter from the tags, if it has one. */
export function raconLetter(tags: Record<string, string>): string {
  const cat = tags["seamark:radar_transponder:category"] ?? "";
  if (cat && cat !== "racon") return "";
  const g = (tags["seamark:radar_transponder:group"] ?? "").replace(/Mo|[()\s]/g, "").toUpperCase();
  if (/^[A-Z0-9]$/.test(g)) return g;
  return cat === "racon" ? "?" : "";
}

/** International Morse code of the letters and figures a racon sends. */
export const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--",
  N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
};

/**
 * The echoes the radar gets from the sea marks: buoys, beacons, light vessels and lights standing in the water (a
 * light on the land is part of the land's echo, but its racon answers). Detection ranges on X band from IMO MSC.192(79) table 2 for buoys
 * (4.9 NM with a corner reflector, 4.6 NM without); the beacon, light structure and light vessel ranges and heights
 * are PLACEHOLDERS, typical of the kind. Numbered from `firstId`.
 */
export function seaMarkEchoes(marks: SeaMark[], firstId: number, onLand: (p: Vec2) => boolean): Omit<Target, "nextEvent">[] {
  const out: Omit<Target, "nextEvent">[] = [];
  marks.forEach((m, k) => {
    // Dangers are for the map.
    if (m.shape === "danger") return;
    const base = { id: firstId + k, name: m.name, pos: { ...m.pos }, course: 0, speed: 0, events: [], ais: false };
    const racon = m.racon && MORSE[m.racon] ? { transponder: "racon" as const, raconCode: MORSE[m.racon]!, raconBand: "both" as const } : {};
    if (onLand(m.pos)) {
      // A light on the land is part of the land's echo; its racon still answers, painted beyond the land, from the
      // height of the light (or 20 m, a PLACEHOLDER, when the map does not give it). No echo of its own.
      const h = Number.parseFloat(/(\d+(?:\.\d+)?)m\b/.exec(m.light ?? "")?.[1] ?? "");
      if (m.racon && MORSE[m.racon]) out.push({ ...base, name: `${m.name} (racon)`, kind: "beacon", rcs: 1e-6, height: Number.isFinite(h) ? h : 20, ...racon });
      return;
    }
    if (m.shape === "buoy") {
      out.push({ ...base, kind: "buoy", rcs: rcsForDetectionRange(m.reflector || m.category === "mooring" ? 4.9 : 4.6), height: 3.5, ...racon });
    } else if (m.shape === "beacon") {
      out.push({ ...base, kind: "beacon", rcs: rcsForDetectionRange(3), height: 5, ...racon });
    } else if (m.shape === "light-vessel") {
      out.push({ ...base, kind: "beacon", rcs: rcsForDetectionRange(8), height: 8, ...racon });
    } else {
      // A light standing in the water: a lighthouse on a reef, or a light on a pile.
      out.push({ ...base, kind: "beacon", ...(m.category === "major-light" ? { rcs: rcsForDetectionRange(12), height: 15 } : { rcs: rcsForDetectionRange(4), height: 6 }), ...racon });
    }
  });
  return out;
}

/** The ids the sea marks' echoes are numbered from (clear of a scenario's own targets). */
export const SEA_MARK_FIRST_ID = 9001;
