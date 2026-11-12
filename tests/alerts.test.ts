import { describe, expect, it } from "vitest";
import { SILENCE_SEC, WARNING_REPEAT_SEC, alertPriority, alertSound, nextToAcknowledge } from "../src/arpa/index";

/*
 * Expected behaviour is taken from IMO resolution MSC.302(87), not from the code:
 * 7.3: an alarm's audible signal continues until it is acknowledged; 7.4: a warning gives a
 * momentary signal; 7.6.2: an unacknowledged warning is repeated within 5 minutes; 9.9: alerts
 * are acknowledged one at a time; 9.10 and 7.3.5: sound can be silenced, for 30 seconds.
 */
const alarm = (raisedAt: number, acked = false) => ({ priority: "alarm" as const, acked, raisedAt });
const warning = (raisedAt: number, acked = false) => ({ priority: "warning" as const, acked, raisedAt });

describe("alert priorities and sound (MSC.302(87))", () => {
  it("a dangerous target is an alarm; the other alerts are warnings", () => {
    expect(alertPriority("cpa")).toBe("alarm");
    expect(alertPriority("ais-cpa")).toBe("alarm");
    for (const k of ["lost", "new", "guard", "capacity", "groundref", "malfunction", "ais-lost"] as const) expect(alertPriority(k)).toBe("warning");
  });
  it("an alarm sounds until it is acknowledged", () => {
    expect(alertSound([], 0, false)).toBe("none");
    expect(alertSound([alarm(100)], 100, false)).toBe("alarm");
    expect(alertSound([alarm(100)], 5000, false)).toBe("alarm");
    expect(alertSound([alarm(100, true)], 200, false)).toBe("none");
  });
  it("a warning gives one short signal, and is announced again every 5 minutes while unacknowledged", () => {
    expect(WARNING_REPEAT_SEC).toBeLessThanOrEqual(300);
    expect(alertSound([warning(100)], 100.5, false)).toBe("warning");
    expect(alertSound([warning(100)], 103, false)).toBe("none");
    expect(alertSound([warning(100)], 399, false)).toBe("none");
    expect(alertSound([warning(100)], 400.5, false)).toBe("warning");
    expect(alertSound([warning(100, true)], 400.5, false)).toBe("none");
  });
  it("an alarm is heard over a warning; silence stops all sound without acknowledging", () => {
    expect(alertSound([warning(100), alarm(90)], 150, false)).toBe("alarm");
    expect(alertSound([warning(100), alarm(90)], 150, true)).toBe("none");
    expect(SILENCE_SEC).toBe(30);
  });
  it("alerts are acknowledged one at a time: alarms first, then the oldest warning", () => {
    const list = [warning(50), alarm(80), warning(20), alarm(60), alarm(10, true)];
    expect(nextToAcknowledge(list)).toBe(list[3]); // the older of the two open alarms
    expect(nextToAcknowledge([warning(50), warning(20)])!.raisedAt).toBe(20);
    expect(nextToAcknowledge([alarm(10, true)])).toBeNull();
    expect(nextToAcknowledge([])).toBeNull();
  });
});
