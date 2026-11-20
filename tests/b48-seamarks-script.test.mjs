import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** scripts/make-seamarks.mjs on small hand-made exports from overpass-turbo (plain JavaScript: the script runs in node). */
describe("scripts/make-seamarks.mjs", () => {
  it("reads raw OSM JSON and GeoJSON from overpass-turbo, keeps each mark once and writes the data file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "seamarks-"));
    const raw = { elements: [
      { type: "node", id: 1, lat: 15.41, lon: 73.75, tags: { "seamark:type": "buoy_lateral", "seamark:buoy_lateral:category": "starboard", "seamark:name": "G1" } },
      // The same buoy as a way, about 10 m away: kept once.
      { type: "way", id: 2, center: { lat: 15.4101, lon: 73.7501 }, tags: { "seamark:type": "buoy_lateral", "seamark:buoy_lateral:category": "starboard" } },
      { type: "node", id: 3, lat: 18.9, lon: 72.8, tags: { "seamark:type": "light_major", name: "Test light" } },
      // Outside every area, and a kind that is not shown.
      { type: "node", id: 4, lat: 12.0, lon: 74.0, tags: { "seamark:type": "buoy_special_purpose" } },
      { type: "node", id: 5, lat: 15.5, lon: 73.8, tags: { "seamark:type": "harbour" } },
    ] };
    const geo = { type: "FeatureCollection", features: [{ type: "Feature", properties: { "seamark:type": "buoy_isolated_danger" }, geometry: { type: "Point", coordinates: [69.9, 22.8] } }] };
    for (const [name, data] of [["raw.json", raw], ["geo.json", geo]]) {
      const input = path.join(dir, name), output = path.join(dir, `${name}.ts`);
      writeFileSync(input, JSON.stringify(data));
      execFileSync("node", ["scripts/make-seamarks.mjs", input, output], { stdio: "pipe" });
      const text = readFileSync(output, "utf8");
      expect(text).toMatch(/OpenStreetMap contributors, Open Database License/);
      if (name === "raw.json") {
        expect(text.match(/"shape"/g)).toHaveLength(2);
        expect(text).toMatch(/goa: \[\n {4}\{"name":"G1","shape":"buoy","category":"starboard"/);
        expect(text).toMatch(/mumbai: \[\n {4}\{"name":"Test light","shape":"light"/);
      } else {
        expect(text).toMatch(/kutch: \[\n {4}\{"name":"Isolated danger buoy"/);
      }
    }
  });
});
