import { describe, expect, it } from "vitest";
import { positionOfLatLon } from "../src/core/nav";
import { REAL_SEAMARKS, SCENARIOS, SEA_MARK_FIRST_ID, SeaMark, createWorld, lightText, raconLetter, rcsForDetectionRange, seaMarkEchoes, seaMarkFromTags } from "../src/engine/index";

/**
 * Buoys, beacons and lights from OpenStreetMap's sea-mark tags (engine/seamarks.ts, scripts/make-seamarks.mjs). The
 * expected texts are written out by hand from the tags, as a chart would print them.
 */
const P = { e: 1, n: 2 };

describe("reading OpenStreetMap sea marks", () => {
  it("a port-hand buoy with a light and a racon", () => {
    const m = seaMarkFromTags({
      "seamark:type": "buoy_lateral", "seamark:buoy_lateral:category": "port", "seamark:name": "No. 3",
      "seamark:light:character": "Fl", "seamark:light:group": "(2)", "seamark:light:colour": "red", "seamark:light:period": "6",
      "seamark:radar_transponder:category": "racon", "seamark:radar_transponder:group": "(K)", "seamark:radar_reflector": "yes",
    }, P);
    expect(m).toEqual({ name: "No. 3", shape: "buoy", category: "port", pos: P, light: "Fl(2) R 6s", racon: "K", reflector: true });
  });

  it("a cardinal beacon without a name is named for what it is", () => {
    const m = seaMarkFromTags({ "seamark:type": "beacon_cardinal", "seamark:beacon_cardinal:category": "west", "seamark:light:character": "Q", "seamark:light:group": "(9)", "seamark:light:colour": "white", "seamark:light:period": "15" }, P);
    expect(m).toEqual({ name: "West cardinal beacon", shape: "beacon", category: "west", pos: P, light: "Q(9) W 15s" });
  });

  it("a major light with sectors: every colour once, in chart order", () => {
    const tags = {
      "seamark:type": "light_major", name: "Aguada",
      "seamark:light:1:character": "Fl", "seamark:light:1:colour": "green", "seamark:light:1:period": "10", "seamark:light:1:height": "79", "seamark:light:1:range": "20",
      "seamark:light:2:character": "Fl", "seamark:light:2:colour": "white", "seamark:light:2:period": "10",
      "seamark:light:3:character": "Fl", "seamark:light:3:colour": "red", "seamark:light:3:period": "10",
    };
    expect(lightText(tags)).toBe("Fl WRG 10s 79m 20M");
    expect(seaMarkFromTags(tags, P)).toEqual({ name: "Aguada", shape: "light", category: "major-light", pos: P, light: "Fl WRG 10s 79m 20M" });
  });

  it("light floats, mooring buoys and the rest", () => {
    expect(seaMarkFromTags({ "seamark:type": "light_float" }, P)).toMatchObject({ shape: "light-vessel", name: "Light float" });
    expect(seaMarkFromTags({ "seamark:type": "mooring", "seamark:mooring:category": "buoy", name: "SPM 2" }, P)).toMatchObject({ shape: "buoy", category: "mooring", name: "SPM 2" });
    expect(seaMarkFromTags({ "seamark:type": "buoy_safe_water", "seamark:light:character": "LFl", "seamark:light:colour": "white", "seamark:light:period": "10" }, P)).toMatchObject({ name: "Safe water buoy", light: "LFl W 10s" });
    expect(seaMarkFromTags({ "seamark:type": "harbour" }, P)).toBeNull();
    expect(seaMarkFromTags({ "seamark:type": "mooring", "seamark:mooring:category": "bollard" }, P)).toBeNull();
    // A landmark is only a light when it carries one.
    expect(seaMarkFromTags({ "seamark:type": "landmark", "seamark:landmark:category": "tower" }, P)).toBeNull();
    // An unknown light character is left out rather than guessed.
    expect(lightText({ "seamark:light:character": "Blink", "seamark:light:colour": "white" })).toBe("");
  });

  it("a lighthouse mapped as a landmark is a light, major from 15 NM; a light out of use says so", () => {
    const tags = { "seamark:type": "landmark", "seamark:name": "Aguada", "seamark:light:character": "Fl", "seamark:light:group": "3", "seamark:light:colour": "white", "seamark:light:period": "20", "seamark:light:height": "85", "seamark:light:range": "27" };
    expect(seaMarkFromTags(tags, P)).toEqual({ name: "Aguada", shape: "light", category: "major-light", pos: P, light: "Fl(3) W 20s 85m 27M" });
    expect(seaMarkFromTags({ ...tags, "seamark:light:range": "12" }, P)).toMatchObject({ category: "minor-light" });
    expect(seaMarkFromTags({ ...tags, "seamark:information": "Temporarily extinguished (2014)" }, P)!.light).toBe("Fl(3) W 20s 85m 27M (temporarily extinguished, 2014)");
    expect(seaMarkFromTags({ "seamark:type": "pile", "seamark:light:character": "F", "seamark:light:colour": "red", "seamark:light:height": "8" }, P)).toMatchObject({ shape: "light", category: "minor-light", light: "F R 8m" });
  });

  it("rocks and wrecks are dangers, named by how they lie", () => {
    expect(seaMarkFromTags({ "seamark:type": "rock", "seamark:rock:water_level": "covers" }, P)).toEqual({ name: "Rock that covers and uncovers", shape: "danger", category: "rock", pos: P });
    expect(seaMarkFromTags({ "seamark:type": "rock", "seamark:rock:water_level": "awash" }, P)!.name).toBe("Rock awash");
    expect(seaMarkFromTags({ "seamark:type": "rock", "seamark:rock:water_level": "submerged" }, P)!.name).toBe("Underwater rock");
    expect(seaMarkFromTags({ "seamark:type": "wreck", "seamark:wreck:category": "dangerous" }, P)).toMatchObject({ name: "Dangerous wreck", shape: "danger", category: "wreck" });
    expect(seaMarkFromTags({ "seamark:type": "wreck" }, P)!.name).toBe("Wreck");
  });

  it("racon letters", () => {
    expect(raconLetter({ "seamark:radar_transponder:category": "racon", "seamark:radar_transponder:group": "Mo(T)" })).toBe("T");
    expect(raconLetter({ "seamark:radar_transponder:group": "B" })).toBe("B");
    expect(raconLetter({ "seamark:radar_transponder:category": "racon" })).toBe("?");
    expect(raconLetter({ "seamark:radar_transponder:category": "ramark", "seamark:radar_transponder:group": "K" })).toBe("");
  });
});

describe("sea marks on the radar", () => {
  const marks: SeaMark[] = [
    { name: "Buoy R", shape: "buoy", category: "port", pos: { e: 0, n: 1 }, reflector: true, racon: "K" },
    { name: "Buoy", shape: "buoy", category: "starboard", pos: { e: 0, n: 2 } },
    { name: "Light on land", shape: "light", category: "major-light", pos: { e: 5, n: 5 } },
    { name: "Reef light", shape: "light", category: "major-light", pos: { e: 1, n: 1 } },
    { name: "Beacon", shape: "beacon", category: "north", pos: { e: 2, n: 1 } },
    { name: "Headland light", shape: "light", category: "major-light", pos: { e: 5, n: 7 }, light: "Fl(3) W 20s 85m 27M", racon: "O" },
    { name: "Rock awash", shape: "danger", category: "rock", pos: { e: 0.5, n: 0.5 } },
  ];
  it("each mark standing in the water gives an echo, with the buoy detection ranges of IMO table 2", () => {
    const echoes = seaMarkEchoes(marks, 9001, (p) => p.e === 5);
    expect(echoes.map((t) => t.name)).toEqual(["Buoy R", "Buoy", "Reef light", "Beacon", "Headland light (racon)"]);
    expect(echoes.map((t) => t.id)).toEqual([9001, 9002, 9004, 9005, 9006]);
    // The racon of a light on the land answers from the light's height, with no echo of its own to speak of.
    expect(echoes[4]).toMatchObject({ kind: "beacon", height: 85, transponder: "racon", raconCode: "---" });
    expect(echoes[4]!.rcs).toBeLessThan(1e-5);
    expect(echoes[0]).toMatchObject({ kind: "buoy", rcs: rcsForDetectionRange(4.9), height: 3.5, transponder: "racon", raconCode: "-.-", speed: 0, ais: false });
    expect(echoes[1]!.rcs).toBe(rcsForDetectionRange(4.6));
    expect(echoes[1]!.transponder).toBeUndefined();
    expect(echoes[2]).toMatchObject({ kind: "beacon", height: 15, rcs: rcsForDetectionRange(12) });
    expect(echoes[3]).toMatchObject({ kind: "beacon" });
  });

  it("a real-area scenario with sea marks puts them among its targets, clear of its own ids and off the land", () => {
    const goa = REAL_SEAMARKS["goa"]!;
    const saved = [...goa];
    try {
      const sc = SCENARIOS.find((s) => s.terrain === "goa")!;
      const w0 = createWorld({ ...sc, seaMarks: true });
      const before = w0.targets.length;
      // Two marks for the test: one at sea off the coast, one on the land (Panaji).
      goa.push({ name: "Test buoy", shape: "buoy", category: "port", pos: positionOfLatLon(w0.origin, 15.4, 73.7) });
      goa.push({ name: "Test light", shape: "light", category: "minor-light", pos: positionOfLatLon(w0.origin, 15.49, 73.83) });
      const w = createWorld({ ...sc, seaMarks: true });
      const added = w.targets.slice(before);
      expect(added.map((t) => [t.name, t.id])).toEqual([["Test buoy", SEA_MARK_FIRST_ID + saved.length]]);
      // Left out unless the scenario asks for them.
      expect(createWorld({ ...sc, seaMarks: false }).targets.length).toBe(sc.targets.length);
    } finally {
      goa.length = 0;
      goa.push(...saved);
    }
  });
});
