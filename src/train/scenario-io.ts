import { Scenario } from "../engine/index";

/**
 * Scenario files (JSON). `SCENARIO_SCHEMA` documents the format (JSON Schema, draft 2020-12);
 * `validateScenario` checks an object against the same rules and returns readable messages.
 * Units: NM, knots, degrees true, seconds; positions are east/north from the scenario origin.
 */
export const SCENARIO_FORMAT = "radar-sim-scenario/1";

const vec = { type: "object", required: ["e", "n"], properties: { e: { type: "number" }, n: { type: "number" } } };

export const SCENARIO_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Radar / ARPA simulator scenario",
  type: "object",
  required: ["format", "id", "name", "own", "targets", "coasts"],
  properties: {
    format: { const: SCENARIO_FORMAT },
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    description: { type: "string" },
    own: {
      type: "object",
      required: ["heading", "speed"],
      properties: { heading: { type: "number", minimum: 0, exclusiveMaximum: 360 }, speed: { type: "number", minimum: 0, maximum: 40 }, pos: vec },
    },
    env: {
      type: "object",
      properties: {
        current: { type: "object", required: ["set", "drift"], properties: { set: { type: "number" }, drift: { type: "number", minimum: 0 } } },
        seaState: { type: "number", minimum: 0, maximum: 9 },
        ducting: { type: "boolean" },
        refraction: { enum: ["standard", "sub", "super"] },
        rain: {
          type: "array",
          items: { type: "object", required: ["center", "radius", "intensity"], properties: { center: vec, radius: { type: "number", exclusiveMinimum: 0 }, intensity: { type: "number", minimum: 0, maximum: 1 } } },
        },
      },
    },
    targets: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "kind", "pos", "course", "speed", "rcs", "height", "events"],
        properties: {
          id: { type: "integer", minimum: 1 },
          name: { type: "string" },
          kind: { enum: ["ship", "small-craft", "buoy", "beacon"] },
          pos: vec,
          course: { type: "number", minimum: 0, exclusiveMaximum: 360 },
          speed: { type: "number", minimum: 0, maximum: 99 },
          rcs: { type: "number", exclusiveMinimum: 0 },
          transponder: { enum: ["racon", "sart", "ramark"] },
          raconCode: { type: "string", pattern: "^[.-]{1,5}$" },
          ais: { type: "boolean" },
          lengthM: { type: "number", minimum: 0 },
          height: { type: "number", minimum: 0 },
          events: {
            type: "array",
            items: { type: "object", required: ["atSeconds"], properties: { atSeconds: { type: "number", minimum: 0 }, course: { type: "number" }, speed: { type: "number", minimum: 0 } } },
          },
          route: {
            type: "object",
            required: ["points"],
            properties: { points: { type: "array", items: vec, minItems: 1, maxItems: 20 }, speeds: { type: "array", items: { type: ["number", "null"], minimum: 0 } } },
          },
        },
      },
    },
    coasts: {
      type: "array",
      items: { type: "object", required: ["name", "points", "closed"], properties: { name: { type: "string" }, points: { type: "array", items: vec, minItems: 2 }, closed: { type: "boolean" } } },
    },
    hazards: { type: "array", items: { type: "object", required: ["name", "center", "radius"], properties: { name: { type: "string" }, center: vec, radius: { type: "number", exclusiveMinimum: 0 } } } },
    route: { type: "array", items: vec },
    depths: { type: "array", items: { type: "object", required: ["name", "points", "depthM"], properties: { name: { type: "string" }, points: { type: "array", items: vec, minItems: 3 }, depthM: { type: "number", minimum: 0 } } } },
  },
} as const;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Returns a list of problems; an empty list means the object is a usable scenario. */
export function validateScenario(x: unknown): string[] {
  const errs: string[] = [];
  const need = (ok: boolean, msg: string): void => {
    if (!ok) errs.push(msg);
  };
  const vecOk = (v: unknown): boolean => isObj(v) && isNum(v["e"]) && isNum(v["n"]);
  if (!isObj(x)) return ["The file is not a JSON object."];
  need(x["format"] === SCENARIO_FORMAT, `"format" must be "${SCENARIO_FORMAT}".`);
  need(typeof x["id"] === "string" && x["id"].length > 0, '"id" must be a non-empty text.');
  need(typeof x["name"] === "string" && x["name"].length > 0, '"name" must be a non-empty text.');
  const own = x["own"];
  if (!isObj(own)) errs.push('"own" (own ship) is missing.');
  else {
    need(isNum(own["heading"]) && own["heading"] >= 0 && own["heading"] < 360, "Own ship heading must be 0 to 359.9.");
    need(isNum(own["speed"]) && own["speed"] >= 0 && own["speed"] <= 40, "Own ship speed must be 0 to 40 kn.");
    need(own["pos"] === undefined || vecOk(own["pos"]), "Own ship position must have numbers e and n.");
  }
  const env = x["env"];
  if (env !== undefined) {
    if (!isObj(env)) errs.push('"env" must be an object.');
    else {
      const c = env["current"];
      need(c === undefined || (isObj(c) && isNum(c["set"]) && isNum(c["drift"]) && c["drift"] >= 0), "Current needs set (degrees) and drift (kn, not negative).");
      need(env["ducting"] === undefined || typeof env["ducting"] === "boolean", "ducting must be true or false.");
      need(env["refraction"] === undefined || ["standard", "sub", "super"].includes(env["refraction"] as string), 'refraction must be "standard", "sub" or "super".');
      need(env["interference"] === undefined || typeof env["interference"] === "boolean", "interference must be true or false.");
      const td = env["tidal"];
      need(td === undefined || (isObj(td) && isNum(td["floodSet"]) && isNum(td["maxRateKn"]) && td["maxRateKn"] >= 0 && isNum(td["hoursAfterSlackAtStart"])), "Tidal stream needs floodSet (degrees), maxRateKn (not negative) and hoursAfterSlackAtStart.");
      need(env["seaState"] === undefined || (isNum(env["seaState"]) && env["seaState"] >= 0 && env["seaState"] <= 9), "Sea state must be 0 to 9.");
      const rain = env["rain"];
      need(
        rain === undefined ||
          (Array.isArray(rain) && rain.every((r) => isObj(r) && vecOk(r["center"]) && isNum(r["radius"]) && r["radius"] > 0 && isNum(r["intensity"]) && r["intensity"] >= 0 && r["intensity"] <= 1)),
        "Each rain area needs a centre, a radius above 0 and an intensity from 0 to 1.",
      );
    }
  }
  const targets = x["targets"];
  if (!Array.isArray(targets)) errs.push('"targets" must be a list (it may be empty).');
  else {
    const ids = new Set<number>();
    targets.forEach((t, i) => {
      const n = `Target ${i + 1}`;
      if (!isObj(t)) {
        errs.push(`${n} is not an object.`);
        return;
      }
      need(Number.isInteger(t["id"]) && (t["id"] as number) >= 1, `${n}: id must be a whole number from 1.`);
      if (isNum(t["id"])) {
        need(!ids.has(t["id"]), `${n}: id ${t["id"]} is used twice.`);
        ids.add(t["id"]);
      }
      need(typeof t["name"] === "string", `${n}: name is missing.`);
      need(["ship", "small-craft", "buoy", "beacon"].includes(t["kind"] as string), `${n}: kind must be ship, small-craft, buoy or beacon.`);
      need(vecOk(t["pos"]), `${n}: position must have numbers e and n.`);
      need(isNum(t["course"]) && t["course"] >= 0 && t["course"] < 360, `${n}: course must be 0 to 359.9.`);
      need(isNum(t["speed"]) && t["speed"] >= 0 && t["speed"] <= 99, `${n}: speed must be 0 to 99 kn.`);
      need(isNum(t["rcs"]) && t["rcs"] > 0, `${n}: rcs (echo strength) must be above 0.`);
      need(isNum(t["height"]) && t["height"] >= 0, `${n}: height must not be negative.`);
      need(t["transponder"] === undefined || t["transponder"] === "racon" || t["transponder"] === "sart" || t["transponder"] === "ramark", `${n}: transponder must be "racon", "sart" or "ramark".`);
      need(t["raconCode"] === undefined || (typeof t["raconCode"] === "string" && /^[.-]{1,5}$/.test(t["raconCode"])), `${n}: raconCode must be 1 to 5 dots and dashes.`);
      need(t["lengthM"] === undefined || (isNum(t["lengthM"]) && t["lengthM"] >= 0), `${n}: lengthM must not be negative.`);
      need(t["raconBand"] === undefined || ["X", "S", "both"].includes(t["raconBand"] as string), `${n}: raconBand must be X, S or both.`);
      need(t["ais"] === undefined || typeof t["ais"] === "boolean", `${n}: ais must be true or false.`);
      const ev = t["events"];
      need(
        Array.isArray(ev) &&
          ev.every((e) => isObj(e) && isNum(e["atSeconds"]) && e["atSeconds"] >= 0 && (e["course"] === undefined || isNum(e["course"])) && (e["speed"] === undefined || (isNum(e["speed"]) && e["speed"] >= 0))),
        `${n}: each event needs atSeconds, and an optional course and speed.`,
      );
      const rt = t["route"];
      if (rt !== undefined) {
        const pts = isObj(rt) ? rt["points"] : undefined;
        const sp = isObj(rt) ? rt["speeds"] : undefined;
        need(Array.isArray(pts) && pts.length >= 1 && pts.length <= 20 && pts.every(vecOk), `${n}: route needs 1 to 20 points, each with numbers e and n.`);
        need(
          sp === undefined || (Array.isArray(sp) && Array.isArray(pts) && sp.length <= pts.length && sp.every((v) => v === null || (isNum(v) && v >= 0 && v <= 99))),
          `${n}: route speeds must be numbers from 0 to 99 kn (or null for no change), no more of them than points.`,
        );
      }
    });
  }
  const coasts = x["coasts"];
  if (!Array.isArray(coasts)) errs.push('"coasts" must be a list (it may be empty).');
  else
    coasts.forEach((c, i) => {
      need(
        isObj(c) && typeof c["name"] === "string" && typeof c["closed"] === "boolean" && Array.isArray(c["points"]) && c["points"].length >= 2 && c["points"].every(vecOk),
        `Coast ${i + 1} needs a name, "closed" (true/false) and at least two points.`,
      );
    });
  const hz = x["hazards"];
  need(hz === undefined || (Array.isArray(hz) && hz.every((h) => isObj(h) && typeof h["name"] === "string" && vecOk(h["center"]) && isNum(h["radius"]) && h["radius"] > 0)), "Each hazard needs a name, a centre and a radius above 0.");
  const rt = x["route"];
  need(rt === undefined || (Array.isArray(rt) && rt.every(vecOk)), "Route points must have numbers e and n.");
  const dp = x["depths"];
  need(
    dp === undefined || (Array.isArray(dp) && dp.every((d) => isObj(d) && typeof d["name"] === "string" && isNum(d["depthM"]) && d["depthM"] >= 0 && Array.isArray(d["points"]) && d["points"].length >= 3 && d["points"].every(vecOk))),
    "Each depth area needs a name, a depth in metres and at least three points.",
  );
  const stx = x["structures"];
  need(
    stx === undefined ||
      (Array.isArray(stx) && stx.every((q) => isObj(q) && typeof q["name"] === "string" && ["power-line", "bridge", "reflector"].includes(q["kind"] as string) && vecOk(q["a"]) && vecOk(q["b"]))),
    'Each structure needs a name, a kind ("power-line", "bridge" or "reflector") and two end points a and b.',
  );
  return errs;
}

export function scenarioToJson(sc: Scenario): string {
  return JSON.stringify({ format: SCENARIO_FORMAT, ...sc, description: sc.description ?? "" }, null, 2);
}

/** Parse and validate. Returns the scenario or the list of problems. */
export function scenarioFromJson(text: string): { scenario: Scenario } | { errors: string[] } {
  let x: unknown;
  try {
    x = JSON.parse(text);
  } catch (e) {
    return { errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const errors = validateScenario(x);
  if (errors.length > 0) return { errors };
  const o = x as Obj;
  const { format: _format, ...rest } = o;
  void _format;
  const sc = rest as unknown as Scenario;
  return { scenario: { ...sc, description: sc.description ?? "", env: sc.env ?? {} } };
}
