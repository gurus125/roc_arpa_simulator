import { describe, expect, it } from "vitest";
import { WHISTLE_SIGNALS, fogSignalFor, signalDuration, whistleFrequencyHz, whistleSignal } from "../src/core/signals";

describe("whistle signals (COLREG rules 32, 34, 35 and Annex III)", () => {
  it("Rule 32: a short blast is about one second, a prolonged blast four to six seconds", () => {
    for (const s of WHISTLE_SIGNALS) {
      for (const b of s.blasts) expect(b === 1 || (b >= 4 && b <= 6)).toBe(true);
    }
  });
  it("Rule 34: one short blast for starboard, two for port, three for astern propulsion, at least five in doubt", () => {
    expect(whistleSignal("starboard").blasts).toEqual([1]);
    expect(whistleSignal("port").blasts).toEqual([1, 1]);
    expect(whistleSignal("astern").blasts).toEqual([1, 1, 1]);
    expect(whistleSignal("doubt").blasts.length).toBeGreaterThanOrEqual(5);
  });
  it("Rule 35: one prolonged blast making way; two prolonged about 2 s apart when stopped", () => {
    expect(whistleSignal("fog-making-way").blasts).toHaveLength(1);
    expect(whistleSignal("fog-stopped").blasts).toHaveLength(2);
    expect(whistleSignal("fog-stopped").gap).toBe(2);
    expect(fogSignalFor(12)).toBe("fog-making-way");
    expect(fogSignalFor(0)).toBe("fog-stopped");
  });
  it("a signal's length is its blasts plus the gaps between them", () => {
    expect(signalDuration(whistleSignal("astern"))).toBe(1 + 1 + 1 + 1 + 1); // three blasts, two gaps of 1 s
    expect(signalDuration(whistleSignal("fog-stopped"))).toBe(5 + 2 + 5);
  });
  it("Annex III: the longer the ship, the lower the whistle", () => {
    expect(whistleFrequencyHz(230)).toBeGreaterThanOrEqual(70);
    expect(whistleFrequencyHz(230)).toBeLessThanOrEqual(200);
    expect(whistleFrequencyHz(180)).toBeGreaterThanOrEqual(130);
    expect(whistleFrequencyHz(180)).toBeLessThanOrEqual(350);
    expect(whistleFrequencyHz(40)).toBeGreaterThanOrEqual(250);
    expect(whistleFrequencyHz(40)).toBeLessThanOrEqual(700);
  });
});
