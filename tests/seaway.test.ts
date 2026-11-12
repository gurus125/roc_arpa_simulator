import { describe, expect, it } from "vitest";
import { beamTiltDeg, encounterPeriodS, seawayResponse, verticalPatternFactor, waveHeightM, wavePeriodS, waveSpeedMs } from "../src/core/seaway";

/*
 * Hand-worked.
 * - A 10 s deep-water wave travels at g T / (2 pi) = 9.80665 x 10 / 6.28319 = 15.608 m/s (30.34 kn).
 * - A ship steaming into it at that same speed meets the crests twice as often: 5 s. With the sea
 *   astern at half the wave's speed (15.17 kn) the crests overtake at half speed: 20 s. Beam sea: 10 s.
 * - Gaussian beam, out and back: at half the beamwidth 1/2 x 1/2 = 1/4 is left; at a full beamwidth 2^-8.
 * - Response (placeholder figures, 120 m ship): sea state 5 is 3.25 m; beam sea roll 3 x 3.25 = 9.75 deg;
 *   sea 45 deg on the bow: roll 9.75 x 0.7071 = 6.894, pitch 3.25 x 0.7071 = 2.298, yaw 0.6 x 3.25 = 1.95.
 */
describe("seaway (core)", () => {
  it("wave height by sea state (WMO), wave period and speed", () => {
    expect(waveHeightM(0)).toBe(0);
    expect(waveHeightM(4)).toBe(1.875);
    expect(waveHeightM(4.5)).toBeCloseTo((1.875 + 3.25) / 2, 9);
    expect(waveHeightM(12)).toBe(14);
    expect(wavePeriodS(4)).toBeCloseTo(10, 9);
    expect(waveSpeedMs(10)).toBeCloseTo(15.608, 3);
  });
  it("period of encounter: shorter into the sea, longer running with it", () => {
    expect(encounterPeriodS(10, 30.34, 0)).toBeCloseTo(5, 2);
    expect(encounterPeriodS(10, 12, 90)).toBeCloseTo(10, 6);
    expect(encounterPeriodS(10, 15.17, 180)).toBeCloseTo(20, 1);
  });
  it("rolls most in a beam sea, pitches in a head sea, yaws with the sea on the bow", () => {
    const beam = seawayResponse(5, 90, 12, 120);
    expect(beam.rollDeg).toBeCloseTo(9.75, 6);
    expect(beam.pitchDeg).toBeCloseTo(0, 6);
    expect(beam.yawDeg).toBeCloseTo(0, 6);
    const bow = seawayResponse(5, 45, 12, 120);
    expect(bow.rollDeg).toBeCloseTo(6.894, 3);
    expect(bow.pitchDeg).toBeCloseTo(2.298, 3);
    expect(bow.yawDeg).toBeCloseTo(1.95, 6);
    const head = seawayResponse(5, 0, 12, 120);
    expect(head.rollDeg).toBeCloseTo(0, 6);
    expect(head.pitchDeg).toBeCloseTo(3.25, 6);
    expect(seawayResponse(0, 90, 12, 120).rollDeg).toBe(0);
    expect(seawayResponse(9, 90, 12, 48).rollDeg).toBe(30); // capped
    expect(seawayResponse(5, 90, 12, 240).rollDeg).toBeCloseTo(9.75 / 2, 6); // a ship twice as long moves half as much
  });
  it("beam tilt and what is left of the echo", () => {
    expect(beamTiltDeg(10, 0, 90)).toBeCloseTo(10, 9);
    expect(beamTiltDeg(10, 0, 0)).toBeCloseTo(0, 9);
    expect(beamTiltDeg(0, 4, 0)).toBeCloseTo(4, 9);
    expect(beamTiltDeg(0, 4, 180)).toBeCloseTo(-4, 9);
    expect(verticalPatternFactor(0, 20)).toBe(1);
    expect(verticalPatternFactor(10, 20)).toBeCloseTo(0.25, 9);
    expect(verticalPatternFactor(-10, 20)).toBeCloseTo(0.25, 9);
    expect(verticalPatternFactor(20, 20)).toBeCloseTo(1 / 256, 9);
  });
});

import { createWorld, effectiveSignal, setShipModel, stepWorld } from "../src/engine/index";

/*
 * In the simulation. Coaster (90 m: size factor 120 / 90 = 1.333), heading 000, sea state 6 (5 m),
 * wind and sea from 270: a beam sea. Roll amplitude = 3 x 5 x 1.333 = 20 deg; no pitch and no yaw
 * in a dead beam sea. Vertical beamwidth on X band is 20 deg, so at full roll an echo abeam keeps
 * 2^-8 of its strength, while an echo dead ahead keeps all of it.
 */
describe("own ship in a seaway (engine)", () => {
  const scenario = (seaState: number, model = true) => {
    const w = createWorld({ id: "s", name: "s", description: "", own: { heading: 0, speed: 10 }, coasts: [], targets: [], env: { seaState, wind: { from: 270, speedKn: 30 } } });
    if (model) setShipModel(w, "coaster");
    return w;
  };
  it("rolls to the size the sea gives, and steadies in a calm", () => {
    const w = scenario(6);
    let maxRoll = 0, maxYawOff = 0;
    for (let i = 0; i < 600; i++) {
      stepWorld(w, 0.2);
      maxRoll = Math.max(maxRoll, Math.abs(w.own.seaway!.rollDeg));
      maxYawOff = Math.max(maxYawOff, Math.abs(w.own.seaway!.yawDeg));
    }
    expect(maxRoll).toBeGreaterThan(19);
    expect(maxRoll).toBeLessThanOrEqual(20.0001);
    expect(maxYawOff).toBeLessThan(1); // a beam sea hardly yaws her (she falls a little off 000 as the wind takes her)
    w.env.seaState = 0;
    stepWorld(w, 0.2);
    expect(w.own.seaway).toBeUndefined();
  });
  it("the exercise ship (no manoeuvring model) is not moved by the sea", () => {
    const w = scenario(6, false);
    for (let i = 0; i < 100; i++) stepWorld(w, 0.2);
    expect(w.own.seaway).toBeUndefined();
    expect(w.own.heading).toBe(0);
  });
  it("at full roll an echo abeam is nearly lost; one ahead is not touched", () => {
    const w = scenario(6);
    stepWorld(w, 0.2);
    const sig = (rel: number): number => effectiveSignal(w, { rcs: 1, height: 20, rangeNm: 3, relBearing: rel, pos: { e: 3, n: 0 } });
    w.own.seaway!.rollDeg = 0;
    w.own.seaway!.pitchDeg = 0;
    const abeamUpright = sig(90), aheadUpright = sig(0);
    w.own.seaway!.rollDeg = 20;
    expect(sig(90) / abeamUpright).toBeCloseTo(1 / 256, 6);
    expect(sig(0) / aheadUpright).toBeCloseTo(1, 9);
    w.own.seaway!.rollDeg = 10;
    expect(sig(90) / abeamUpright).toBeCloseTo(0.25, 6);
  });
  it("with the sea on the bow she yaws about her course", () => {
    const w = scenario(6);
    w.env.wind = { from: 315, speedKn: 30 }; // 45 degrees on the port bow: yaw amplitude 0.6 x 5 x 1.333 = 4 deg
    let lo = 999, hi = -999;
    for (let i = 0; i < 1500; i++) {
      stepWorld(w, 0.2);
      const h = ((w.own.heading + 180) % 360) - 180;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    expect(hi - lo).toBeGreaterThan(4); // swings several degrees in all
    expect(hi - lo).toBeLessThan(14);
  });
});
