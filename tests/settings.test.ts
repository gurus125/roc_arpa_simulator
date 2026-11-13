import { describe, expect, it } from "vitest";
import { formatLatLon, latLonOf } from "../src/core/nav";
import { G, K, echoColour, landEchoColour, setDisplayPalette } from "../src/ui/palette";

describe("ship position as latitude and longitude", () => {
  const origin = { lat: 18 + 50 / 60, lon: 72 + 30 / 60 };
  it("one nautical mile north is one minute of latitude", () => {
    expect(latLonOf(origin, { e: 0, n: 6 }).lat).toBeCloseTo(18 + 56 / 60, 9);
    expect(latLonOf(origin, { e: 0, n: -60 }).lat).toBeCloseTo(17 + 50 / 60, 9);
    expect(latLonOf(origin, { e: 0, n: 6 }).lon).toBeCloseTo(origin.lon, 9);
  });
  it("at latitude 60 one nautical mile east is two minutes of longitude", () => {
    expect(latLonOf({ lat: 60, lon: 10 }, { e: 1, n: 0 }).lon).toBeCloseTo(10 + 2 / 60, 6);
    expect(latLonOf({ lat: 0, lon: 10 }, { e: 1, n: 0 }).lon).toBeCloseTo(10 + 1 / 60, 9);
  });
  it("is written in degrees and decimal minutes with the hemisphere", () => {
    expect(formatLatLon(18 + 50 / 60, "lat")).toBe("18°50.0'N");
    expect(formatLatLon(72.5, "lon")).toBe("072°30.0'E");
    expect(formatLatLon(-(33 + 12.34 / 60), "lat")).toBe("33°12.3'S");
    expect(formatLatLon(-5.25, "lon")).toBe("005°15.0'W");
    expect(formatLatLon(10 + 59.97 / 60, "lat")).toBe("11°00.0'N"); // minutes round up into the next degree
  });
  it("can be written with three decimals of the minutes, as a radar display shows it", () => {
    // Worked by hand: 18 deg 50.1234 min is 18°50.123'; 72.5 deg is 072°30.000'; 0.0004 min short of 11 deg rounds up.
    expect(formatLatLon(18 + 50.1234 / 60, "lat", 3)).toBe("18°50.123'N");
    expect(formatLatLon(72.5, "lon", 3)).toBe("072°30.000'E");
    expect(formatLatLon(-(5 + 7.0056 / 60), "lon", 3)).toBe("005°07.006'W");
    expect(formatLatLon(10 + 59.9996 / 60, "lat", 3)).toBe("11°00.000'N");
  });
});

describe("day and night palettes", () => {
  const hue = (c: string): number => Number(/hsla\((\d+)/.exec(c)![1]);
  const light = (c: string): number => Number(/hsla\(\d+,\d+%,(\d+)%/.exec(c)![1]);
  it("day: echoes are amber, green graphics become a light blue-white, red danger stays red", () => {
    setDisplayPalette("day");
    // The institute's amber #FFC928: hue 60 x (201 - 40) / (255 - 40) = 44.9, so 45 degrees.
    expect(hue(echoColour("#9dffb0"))).toBe(45);
    expect(light(G("#1f6b3a"))).toBeGreaterThan(40);
    expect(hue(G("#1f6b3a"))).toBe(214);
    expect(hue(G("#ff5a4a"))).toBeLessThan(10);
  });
  it("night: everything is dimmer than by day and the danger colour is still red", () => {
    setDisplayPalette("day");
    const dayEcho = light(echoColour("#9dffb0"));
    const dayRed = light(G("#ff5a4a"));
    setDisplayPalette("night");
    expect(light(echoColour("#9dffb0"))).toBeLessThan(dayEcho);
    expect(light(G("#ff5a4a"))).toBeLessThan(dayRed);
    expect(hue(G("#ff5a4a"))).toBeLessThan(10);
    setDisplayPalette("day");
  });
  it("land echoes are painted dimmer than other echoes, by day and by night", () => {
    for (const m of ["day", "night"] as const) {
      setDisplayPalette(m);
      expect(light(landEchoColour("#7dff9f"))).toBeLessThan(light(echoColour("#7dff9f")));
    }
    setDisplayPalette("day");
  });
  it("the scheme's status colours are kept exactly by day and dimmed at night", () => {
    setDisplayPalette("day");
    for (const c of ["#20d98a", "#ff3b4e", "#ff9f1c", "#00d6c9", "#00bfff"]) expect(K(c)).toBe(c);
    setDisplayPalette("night");
    // #20d98a has lightness (217 + 32) / 2 / 255 = 49%; at night 0.55 of that, 27%.
    expect(light(K("#20d98a"))).toBe(27);
    setDisplayPalette("day");
  });
});
