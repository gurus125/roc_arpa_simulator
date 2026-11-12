import { describe, expect, it } from "vitest";
import {
  alongTrack, angleOfCut, combineFixes, crossTrackError, distanceToSegment, fixFromRangeBearing, fromPolar,
  pointInPolygon, rangeBearing, runOn, setDriftFromFixes,
} from "../src/index";

describe("range, bearing and fixes", () => {
  it("range and bearing between points", () => {
    const r = rangeBearing({ e: 1, n: 1 }, { e: 4, n: 5 });
    expect(r.range).toBeCloseTo(5, 9);
    expect(r.bearing).toBeCloseTo(36.8699, 3);
  });
  it("a lighthouse 3 NM due east means own ship is 3 NM west of it", () => {
    const p = fixFromRangeBearing({ e: 10, n: 4 }, 90, 3);
    expect(p.e).toBeCloseTo(7, 9);
    expect(p.n).toBeCloseTo(4, 9);
  });
  it("round trip: bearing and range of a known object give back own position", () => {
    const own = { e: 2.3, n: -1.1 };
    const obj = { e: 5.7, n: 3.2 };
    const rb = rangeBearing(own, obj);
    const p = fixFromRangeBearing(obj, rb.bearing, rb.range);
    expect(p.e).toBeCloseTo(own.e, 9);
    expect(p.n).toBeCloseTo(own.n, 9);
  });
  it("runs a position on by dead reckoning", () => {
    const p = runOn({ e: 0, n: 0 }, { course: 90, speed: 12 }, 0.5);
    expect(p.e).toBeCloseTo(6, 9);
    expect(p.n).toBeCloseTo(0, 9);
  });
  it("combines fixes taken at different times at a common time", () => {
    const cs = { course: 0, speed: 6 };
    // True track: own ship at (0, t*0.1) per minute. Two estimates, one minute apart.
    const e1 = { pos: { e: 0, n: 0 }, time: 0 };
    const e2 = { pos: { e: 0, n: 0.1 }, time: 60 };
    const p = combineFixes([e1, e2], 60, cs);
    expect(p.e).toBeCloseTo(0, 9);
    expect(p.n).toBeCloseTo(0.1, 9);
  });
  it("angle of cut of two position lines", () => {
    expect(angleOfCut(0, 90)).toBeCloseTo(90, 9);
    expect(angleOfCut(10, 40)).toBeCloseTo(30, 9);
    expect(angleOfCut(0, 170)).toBeCloseTo(10, 9);
    expect(angleOfCut(350, 10)).toBeCloseTo(20, 9);
  });
});

describe("set and drift from two fixes", () => {
  it("finds the current from a DR position and a fix", () => {
    // Steered 000 at 10 kn for 1 hour from the origin. Fix 2 is at (2, 10): the current set 090 at 2 kn.
    const sd = setDriftFromFixes({ pos: { e: 0, n: 0 }, time: 0 }, { pos: { e: 2, n: 10 }, time: 3600 }, { course: 0, speed: 10 });
    expect(sd.set).toBeCloseTo(90, 6);
    expect(sd.drift).toBeCloseTo(2, 6);
  });
  it("works over a shorter interval and an oblique current", () => {
    // 30 min at 8 kn on 045, current set 200 at 1.5 kn.
    const water = { course: 45, speed: 8 };
    const dr = runOn({ e: 1, n: 1 }, water, 0.5);
    const cur = fromPolar(200, 1.5);
    const fix2 = { e: dr.e + cur.e * 0.5, n: dr.n + cur.n * 0.5 };
    const sd = setDriftFromFixes({ pos: { e: 1, n: 1 }, time: 100 }, { pos: fix2, time: 1900 }, water);
    expect(sd.set).toBeCloseTo(200, 6);
    expect(sd.drift).toBeCloseTo(1.5, 6);
  });
  it("rejects a second fix that is not later", () => {
    expect(() => setDriftFromFixes({ pos: { e: 0, n: 0 }, time: 10 }, { pos: { e: 0, n: 0 }, time: 10 }, { course: 0, speed: 5 })).toThrow();
  });
});

describe("track keeping", () => {
  const a = { e: 0, n: 0 };
  const b = { e: 0, n: 10 };
  it("cross-track error is positive to starboard", () => {
    expect(crossTrackError({ e: 0.4, n: 5 }, a, b)).toBeCloseTo(0.4, 9);
    expect(crossTrackError({ e: -0.3, n: 5 }, a, b)).toBeCloseTo(-0.3, 9);
  });
  it("works on a track heading west", () => {
    // Heading 270: starboard is north.
    expect(crossTrackError({ e: -5, n: 0.5 }, { e: 0, n: 0 }, { e: -10, n: 0 })).toBeCloseTo(0.5, 9);
  });
  it("along-track distance and distance to a segment", () => {
    expect(alongTrack({ e: 1, n: 4 }, a, b)).toBeCloseTo(4, 9);
    expect(distanceToSegment({ e: 1, n: 4 }, a, b)).toBeCloseTo(1, 9);
    expect(distanceToSegment({ e: 0, n: 13 }, a, b)).toBeCloseTo(3, 9);
  });
  it("point in polygon", () => {
    const sq = [{ e: 0, n: 0 }, { e: 4, n: 0 }, { e: 4, n: 4 }, { e: 0, n: 4 }];
    expect(pointInPolygon({ e: 2, n: 2 }, sq)).toBe(true);
    expect(pointInPolygon({ e: 5, n: 2 }, sq)).toBe(false);
    expect(pointInPolygon({ e: -1, n: -1 }, sq)).toBe(false);
  });
});
