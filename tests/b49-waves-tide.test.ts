import { describe, expect, it } from "vitest";
import { SHIP_TYPES, shipTypeById, stepShip } from "../src/core/shipmodel";
import { TidalDiamond, diamondStream, hoursFromNearestHw, streamAt, tideHeightM, twelfthsFraction } from "../src/core/tide";
import { MAX_WAVE_SPEED_LOSS, lossAfterSeaMargin, beaufortOfWaveHeight, combinedWaveHeightM, displacementM3, seasSpeedLoss, waveDirectionFactor, waveDriftKn, waveSpeedLoss } from "../src/core/waves";

/** Expected values worked by hand (and checked in Python), not taken from the functions under test. */
describe("speed lost in waves", () => {
  it("turns a wave height into a Beaufort number by the WMO probable heights", () => {
    expect(beaufortOfWaveHeight(3)).toBeCloseTo(6, 9);
    expect(beaufortOfWaveHeight(2.5)).toBeCloseTo(5.5, 9);
    expect(beaufortOfWaveHeight(4.75)).toBeCloseTo(7.5, 9);
    expect(beaufortOfWaveHeight(0.05)).toBeCloseTo(0.5, 9);
    expect(beaufortOfWaveHeight(0)).toBe(0);
    expect(beaufortOfWaveHeight(20)).toBe(12);
  });

  it("direction factor: head 1, bow, beam and following by their formulas, never below 0", () => {
    expect(waveDirectionFactor(6, 0)).toBe(1);
    expect(waveDirectionFactor(6, 20)).toBe(1);
    expect(waveDirectionFactor(6, -20)).toBe(1);
    expect(waveDirectionFactor(6, 45)).toBeCloseTo((1.7 - 0.03 * 4) / 2, 9); // 0.79
    expect(waveDirectionFactor(6, 90)).toBeCloseTo(0.45, 9);
    expect(waveDirectionFactor(6, 270)).toBeCloseTo(0.45, 9);
    expect(waveDirectionFactor(6, 180)).toBeCloseTo(0.14, 9);
    expect(waveDirectionFactor(12, 180)).toBe(0);
  });

  it("KCS (52 030 m3): 7.93 % at force 6 and 29.8 % at force 8 in a head sea; capped", () => {
    expect(waveSpeedLoss(6, 0, 52030)).toBeCloseTo(0.0792727, 6);
    expect(waveSpeedLoss(8, 0, 52030)).toBeCloseTo(0.2978204, 6);
    expect(waveSpeedLoss(12, 0, 100)).toBe(MAX_WAVE_SPEED_LOSS);
    expect(waveSpeedLoss(0, 0, 52030)).toBe(0);
    // The container ship type comes to 52 070 m3 from its dimensions and the published block coefficient 0.651.
    const c = shipTypeById("container");
    expect(displacementM3(c.lengthM, c.beamM, c.draughtM, c.blockCoeff)).toBeCloseTo(52070.1048, 3);
    for (const t of SHIP_TYPES) expect(t.blockCoeff).toBeGreaterThan(0.5);
  });

  it("two seas: heights add as squares; direction factors weighted by energy", () => {
    const seas = [{ fromDeg: 0, heightM: 3 }, { fromDeg: 90, heightM: 3 }];
    expect(combinedWaveHeightM(seas)).toBeCloseTo(Math.sqrt(18), 9);
    // H 4.2426 m -> force 7.1618; factor 0.5 x 1 + 0.5 x 0.4095 = 0.7048; loss 11.83 %.
    expect(seasSpeedLoss(seas, 0, 52030)).toBeCloseTo(0.1183303, 6);
    expect(seasSpeedLoss([{ fromDeg: 30, heightM: 3 }], 30, 52030)).toBeCloseTo(0.0792727, 6);
    expect(seasSpeedLoss([], 0, 52030)).toBe(0);
  });

  it("the sea margin: no loss until the waves would cost more than 5 % of the speed", () => {
    expect(lossAfterSeaMargin(0.03)).toBe(0);
    expect(lossAfterSeaMargin(0.0792727)).toBeCloseTo(0.0292727, 9);
  });

  it("a beam sea pushes a ship away from it: 0.03 kn per m2 for 120 m, more for small ships, capped", () => {
    expect(waveDriftKn([{ fromDeg: 90, heightM: 2 }], 0, 120)).toBeCloseTo(-0.12, 9);
    expect(waveDriftKn([{ fromDeg: 270, heightM: 2 }], 0, 120)).toBeCloseTo(0.12, 9);
    expect(waveDriftKn([{ fromDeg: 90, heightM: 2 }], 0, 60)).toBeCloseTo(-0.24, 9);
    expect(waveDriftKn([{ fromDeg: 90, heightM: 2 }], 0, 20)).toBeCloseTo(-0.24, 9);
    expect(waveDriftKn([{ fromDeg: 0, heightM: 4 }], 0, 120)).toBeCloseTo(0, 9);
    expect(waveDriftKn([{ fromDeg: 90, heightM: 9 }], 0, 120)).toBe(-1);
  });

  it("the ship model settles at (1 - loss) of her calm-water speed and drifts sideways at the given speed", () => {
    const type = shipTypeById("container");
    let m = { u: 24, v: 0, r: 0, rudder: 0, engine: 24 };
    for (let t = 0; t < 20000; t++) m = stepShip(type, m, { rudder: 0, speed: 24 }, null, 1, { loss: 0.2, driftKn: -0.3 });
    expect(m.u).toBeCloseTo(19.2, 2);
    expect(m.v).toBeCloseTo(-0.3, 6);
    let calm = { u: 24, v: 0, r: 0, rudder: 0, engine: 24 };
    for (let t = 0; t < 100; t++) calm = stepShip(type, calm, { rudder: 0, speed: 24 }, null, 1);
    expect(calm.u).toBeCloseTo(24, 6);
  });
});

describe("tidal streams from diamonds", () => {
  // East-going (090) 2 kn springs / 1 kn neaps before HW, slack at HW, west-going after.
  const D: TidalDiamond = { id: "A", pos: { e: 0, n: 0 }, hours: Array.from({ length: 13 }, (_, k) => (k === 6 ? { set: 90, spring: 0, neap: 0 } : { set: k < 6 ? 90 : 270, spring: 2, neap: 1 })) };

  it("folds the tidal clock to the nearest high water", () => {
    expect(hoursFromNearestHw(7)).toBeCloseTo(-5.42, 9);
    expect(hoursFromNearestHw(-7)).toBeCloseTo(5.42, 9);
    expect(hoursFromNearestHw(6)).toBeCloseTo(6, 9);
    expect(hoursFromNearestHw(6.3)).toBeCloseTo(-6.12, 9);
    expect(hoursFromNearestHw(12.42 * 3 - 1)).toBeCloseTo(-1, 9);
  });

  it("reads a diamond by the hour, between springs and neaps, and between hours", () => {
    const at = (h: number, s: number): number[] => { const v = diamondStream(D, h, s); return [v.e, v.n]; };
    expect(at(-3, 1)[0]).toBeCloseTo(2, 9);
    expect(at(-3, 0)[0]).toBeCloseTo(1, 9);
    expect(at(-3, 0.5)[0]).toBeCloseTo(1.5, 9);
    expect(at(-2.5, 1)[0]).toBeCloseTo(2, 9);
    expect(at(0.5, 1)[0]).toBeCloseTo(-1, 9);
    expect(at(2, 1)[0]).toBeCloseTo(-2, 9);
    expect(at(12.42 - 3, 1)[0]).toBeCloseTo(2, 9);
    expect(at(-6.15, 1)[0]).toBeCloseTo(2, 9);
    expect(Math.abs(at(-3, 1)[1]!)).toBeLessThan(1e-9);
  });

  it("between diamonds: weighted by the inverse square of the distance", () => {
    const hours = (set: number) => Array.from({ length: 13 }, () => ({ set, spring: 1, neap: 1 }));
    const A: TidalDiamond = { id: "A", pos: { e: 0, n: 0 }, hours: hours(90) };
    const B: TidalDiamond = { id: "B", pos: { e: 2, n: 0 }, hours: hours(0) };
    const mid = streamAt([A, B], { e: 1, n: 0 }, 0, 1);
    expect(mid.e).toBeCloseTo(0.5, 9);
    expect(mid.n).toBeCloseTo(0.5, 9);
    // Weights 1 / 0.25 = 4 and 1 / 2.25: east 4 / 4.444 = 0.9, north 0.1.
    const near = streamAt([A, B], { e: 0.5, n: 0 }, 0, 1);
    expect(near.e).toBeCloseTo(0.9, 9);
    expect(near.n).toBeCloseTo(0.1, 9);
    expect(streamAt([A, B], { e: 0, n: 0 }, 0, 1).e).toBeCloseTo(1, 9);
    expect(streamAt([], { e: 0, n: 0 }, 0, 1)).toEqual({ e: 0, n: 0 });
  });
});

describe("height of tide by the rule of twelfths", () => {
  it("1, 2, 3, 3, 2, 1 twelfths in the six hours of the rise", () => {
    expect(twelfthsFraction(0)).toBe(0);
    expect(twelfthsFraction(1.5)).toBeCloseTo(2 / 12, 9);
    expect(twelfthsFraction(3)).toBeCloseTo(0.5, 9);
    expect(twelfthsFraction(4.5)).toBeCloseTo(10 / 12, 9);
    expect(twelfthsFraction(6)).toBe(1);
  });

  it("HW and LW heights between springs and neaps; half the range at mid-tide", () => {
    const t = { mhws: 5, mhwn: 4, mlwn: 2, mlws: 1 };
    const P = 12.42;
    expect(tideHeightM(t, 0, 1)).toBeCloseTo(5, 9);
    expect(tideHeightM(t, -P / 2, 1)).toBeCloseTo(1, 9);
    expect(tideHeightM(t, P / 2, 1)).toBeCloseTo(1, 9);
    expect(tideHeightM(t, -P / 4, 1)).toBeCloseTo(3, 9);
    expect(tideHeightM(t, 0, 0)).toBeCloseTo(4, 9);
    expect(tideHeightM(t, P / 2, 0)).toBeCloseTo(2, 9);
    expect(tideHeightM(t, 0, 0.5)).toBeCloseTo(4.5, 9);
    // One "hour" after HW at springs: 1 - 1/12 of the 4 m range above LW: 1 + 4 x 11/12.
    expect(tideHeightM(t, P / 12, 1)).toBeCloseTo(1 + (4 * 11) / 12, 9);
  });
});
