import { describe, expect, it } from "vitest";
import {
  advanceLeg, monitorRoute, routeLegs, routeLength, segmentHitsCircle, segmentHitsPolygon, segmentToPolygonDistance, segmentToSegmentDistance,
  segmentsIntersect, wheelOverDistance,
} from "../src/core/route";

const P = (e: number, n: number): { e: number; n: number } => ({ e, n });

describe("core: route maths (hand-worked 3-4-5 route)", () => {
  // Waypoints (0,0) -> (0,4) -> (3,8): leg 1 is 000 x 4 NM, leg 2 is atan(3/4) = 036.870 x 5 NM.
  const wps = [P(0, 0), P(0, 4), P(3, 8)];

  it("legs and total length", () => {
    const legs = routeLegs(wps);
    expect(legs[0]!.bearing).toBeCloseTo(0, 9);
    expect(legs[0]!.distance).toBeCloseTo(4, 9);
    expect(legs[1]!.bearing).toBeCloseTo(36.8699, 3);
    expect(legs[1]!.distance).toBeCloseTo(5, 9);
    expect(routeLength(wps)).toBeCloseTo(9, 9);
  });

  it("wheel-over distance is R tan(turn/2)", () => {
    expect(wheelOverDistance(90, 0.5)).toBeCloseTo(0.5, 9);
    expect(wheelOverDistance(60, 0.3)).toBeCloseTo(0.173205, 5);
    expect(wheelOverDistance(-90, 0.5)).toBeCloseTo(0.5, 9);
  });

  it("monitoring from (0.2, 1): XTD, bearing and distance to waypoint, distance and time to go, wheel-over", () => {
    const m = monitorRoute(wps, P(0.2, 1), 0, 10, 0.5)!;
    expect(m.xtd).toBeCloseTo(0.2, 9); // east of a northerly track = starboard
    expect(m.distanceToWp).toBeCloseTo(Math.hypot(0.2, 3), 9); // 3.00666
    expect(m.bearingToWp).toBeCloseTo(356.186, 2); // 360 - atan(0.2/3)
    expect(m.distanceToGo).toBeCloseTo(8, 9); // 3 left on leg 1 + 5
    expect(m.ttgHours).toBeCloseTo(0.8, 9);
    expect(m.nextTurnDeg).toBeCloseTo(36.8699, 3);
    // tan(36.87/2) = 1/3 exactly for a 3-4-5 triangle: wheel-over 0.5/3 before the waypoint.
    expect(m.toWheelOver).toBeCloseTo(3 - 0.5 / 3, 6);
    expect(monitorRoute(wps, P(-0.3, 1), 0, 0, 0.5)!.xtd).toBeCloseTo(-0.3, 9);
    expect(monitorRoute(wps, P(0, 1), 0, 0, 0.5)!.ttgHours).toBeNull();
  });

  it("the active leg advances at the wheel-over point, not before, and stops on the last leg", () => {
    expect(advanceLeg(wps, P(0, 3.8), 0, 0.5)).toBe(0); // 0.2 to go, wheel-over at 0.1667
    expect(advanceLeg(wps, P(0, 3.9), 0, 0.5)).toBe(1);
    expect(advanceLeg(wps, P(3, 9), 1, 0.5)).toBe(1);
  });

  it("segment and polygon tests", () => {
    const sq = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
    expect(segmentsIntersect(P(0, 0), P(2, 2), P(0, 2), P(2, 0))).toBe(true);
    expect(segmentsIntersect(P(0, 0), P(1, 0), P(0, 1), P(1, 1))).toBe(false);
    expect(segmentsIntersect(P(0, 0), P(1, 0), P(1, 0), P(2, 5))).toBe(true); // touching at an end
    expect(segmentHitsPolygon(P(-1, 0.5), P(2, 0.5), sq)).toBe(true); // straight through
    expect(segmentHitsPolygon(P(0.2, 0.2), P(0.8, 0.8), sq)).toBe(true); // wholly inside
    expect(segmentHitsPolygon(P(2, 0), P(2, 1), sq)).toBe(false);
    expect(segmentToPolygonDistance(P(2, 0), P(2, 1), sq)).toBeCloseTo(1, 9);
    expect(segmentToPolygonDistance(P(2, 2), P(3, 3), sq)).toBeCloseTo(Math.SQRT2, 9); // corner to corner
    expect(segmentToSegmentDistance(P(0, 0), P(1, 0), P(0, 2), P(1, 2))).toBeCloseTo(2, 9);
    expect(segmentHitsCircle(P(0, 0), P(4, 0), P(2, 0.5), 0.5)).toBe(true);
    expect(segmentHitsCircle(P(0, 0), P(4, 0), P(2, 0.51), 0.5)).toBe(false);
  });
});

