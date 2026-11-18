import { Vec2, add, fromPolar } from "./vec";

/**
 * Search patterns for one ship, as described in the IAMSAR Manual, volume III (the patterns are given here in
 * our own words and figures; nothing is copied). NM, degrees true, flat east/north frame.
 */

/**
 * Expanding square search: starts at the datum; legs of S, S, 2S, 2S, 3S, 3S ... where S is the track
 * spacing; every turn is 90 degrees to starboard. Returns the datum and the end of each leg.
 */
export function expandingSquare(datum: Vec2, firstCourse: number, spacingNm: number, legs: number): Vec2[] {
  const out: Vec2[] = [{ ...datum }];
  let p = { ...datum };
  for (let i = 0; i < legs; i++) {
    p = add(p, fromPolar(firstCourse + 90 * i, spacingNm * (Math.floor(i / 2) + 1)));
    out.push(p);
  }
  return out;
}

/**
 * Sector search: starts at the datum; out along the first course for the radius R, then every turn is 120
 * degrees to starboard, with legs of R, 2R, R, 2R, R, R: three passes through the datum, ending on it. The
 * turning points all lie R from the datum; the whole pattern is 9R long. Returns the eight points in order.
 */
export function sectorSearch(datum: Vec2, firstCourse: number, radiusNm: number): Vec2[] {
  const out: Vec2[] = [{ ...datum }];
  let p = { ...datum };
  const legs = [1, 1, 2, 1, 2, 1, 1];
  legs.forEach((k, i) => {
    p = add(p, fromPolar(firstCourse + 120 * i, radiusNm * k));
    out.push(p);
  });
  out[out.length - 1] = { ...datum }; // the pattern closes on the datum exactly
  return out;
}

/**
 * A Williamson turn, in the usual textbook form: put the rudder hard over to the side of the casualty; when the
 * heading has changed by 60 degrees, put it hard over the other way; steady on the reciprocal of the first course.
 */
export function williamsonHeadings(course: number, side: "port" | "starboard"): { first: number; reciprocal: number } {
  const s = side === "starboard" ? 1 : -1;
  return { first: (((course + 60 * s) % 360) + 360) % 360, reciprocal: (course + 180) % 360 };
}
