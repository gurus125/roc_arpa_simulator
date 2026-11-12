import { describe, expect, it } from "vitest";
import { distanceToSegment, formatLatLon, latLonOf, positionOfLatLon } from "../src/core/nav";
import { MUMBAI_APPROACH, MUMBAI_BOX, MUMBAI_COAST, MUMBAI_ORIGIN, SCENARIOS, createWorld } from "../src/engine/index";

/*
 * Hand-worked. One minute of latitude is one nautical mile. At 60 N a minute of longitude is half
 * a mile (cos 60 = 0.5), so 1 degree of longitude along 60 N is 30 NM.
 * Real places (from general knowledge of the area, not from the data set): Colaba Point, the
 * southern tip of Mumbai, is at about 18 deg 53.7' N 072 deg 48.7' E; the scenarios' origin,
 * 18 deg 50' N 072 deg 30' E, is open sea some 17 NM west of it.
 */
const nearestCoastNm = (p: { e: number; n: number }): number => {
  let best = Infinity;
  for (const c of MUMBAI_COAST) for (let i = 0; i + 1 < c.points.length; i++) best = Math.min(best, distanceToSegment(p, c.points[i]!, c.points[i + 1]!));
  return best;
};

describe("latitude and longitude to the local frame (core)", () => {
  it("a degree of latitude is 60 NM north; a degree of longitude along 60 N is 30 NM east", () => {
    const o = { lat: 60, lon: 0 };
    expect(positionOfLatLon(o, 61, 0).n).toBeCloseTo(60, 9);
    expect(positionOfLatLon(o, 61, 0).e).toBeCloseTo(0, 9);
    expect(positionOfLatLon(o, 60, 1).e).toBeCloseTo(30, 9);
    expect(positionOfLatLon(o, 60, -1).e).toBeCloseTo(-30, 9);
  });
  it("is the reverse of latLonOf", () => {
    const p = { e: 17.3, n: -8.4 };
    const ll = latLonOf(MUMBAI_ORIGIN, p);
    const back = positionOfLatLon(MUMBAI_ORIGIN, ll.lat, ll.lon);
    expect(back.e).toBeCloseTo(p.e, 9);
    expect(back.n).toBeCloseTo(p.n, 9);
  });
});

describe("the real coastline of the Mumbai approaches", () => {
  it("is laid out from 18 50 N 072 30 E and stays inside its box", () => {
    expect(formatLatLon(MUMBAI_ORIGIN.lat, "lat")).toBe("18°50.0'N");
    expect(formatLatLon(MUMBAI_ORIGIN.lon, "lon")).toBe("072°30.0'E");
    expect(MUMBAI_COAST.length).toBeGreaterThan(3);
    for (const c of MUMBAI_COAST) {
      expect(c.closed).toBe(false);
      for (const p of c.points) {
        const ll = latLonOf(MUMBAI_ORIGIN, p);
        expect(ll.lat).toBeGreaterThan(MUMBAI_BOX.south - 0.01);
        expect(ll.lat).toBeLessThan(MUMBAI_BOX.north + 0.01);
        expect(ll.lon).toBeGreaterThan(MUMBAI_BOX.west - 0.01);
        expect(ll.lon).toBeLessThan(MUMBAI_BOX.east + 0.01);
      }
    }
  });
  it("puts land where Mumbai is, and sea where the sea is", () => {
    const colaba = positionOfLatLon(MUMBAI_ORIGIN, 18 + 53.7 / 60, 72 + 48.7 / 60);
    expect(colaba.e).toBeGreaterThan(17);
    expect(colaba.e).toBeLessThan(18.5);
    expect(nearestCoastNm(colaba)).toBeLessThan(0.6); // the tip of the city is on the coastline
    expect(nearestCoastNm({ e: 0, n: 0 })).toBeGreaterThan(12); // the origin is well out at sea
    expect(nearestCoastNm({ e: -10, n: 0 })).toBeGreaterThan(20);
  });
  it("the scenario is listed, starts at sea and has every ship afloat and clear of the land", () => {
    expect(SCENARIOS).toContain(MUMBAI_APPROACH);
    const w = createWorld(MUMBAI_APPROACH);
    expect(w.coastSamples.length).toBeGreaterThan(2000);
    for (const t of w.targets) {
      expect(nearestCoastNm(t.pos)).toBeGreaterThan(1);
      expect(t.pos.e).toBeLessThan(16); // seaward of the harbour entrance
    }
  });
});
