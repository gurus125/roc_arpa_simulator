import { describe, expect, it } from "vitest";
import { AXIS_CONTROLS, BUTTON_ACTIONS, PANEL_ACTIONS, assignKey, axisToValue, keyFor, keyMap, keyName, movedAxes } from "../src/ui/panel-map";

describe("control panel key and knob mapping", () => {
  it("every function has its own starting key, and every knob and button works a real control", () => {
    const keys = PANEL_ACTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(PANEL_ACTIONS.map((a) => a.id)).size).toBe(PANEL_ACTIONS.length);
    for (const b of BUTTON_ACTIONS) expect(PANEL_ACTIONS.some((a) => a.id === b)).toBe(true);
    expect(AXIS_CONTROLS).toEqual(["gain", "stc", "ftc", "brill"]);
    for (const k of ["F5", "F11", "F12", "Tab", "Escape"]) expect(keys).not.toContain(k); // keys the browser needs
  });
  it("finds the function for a key, with the user's own choices over the starting keys", () => {
    expect(keyMap().get("KeyQ")).toBe("gainUp");
    expect(keyMap().get("Space")).toBe("ack");
    const mine = assignKey({}, "gainUp", "KeyP");
    expect(keyMap(mine).get("KeyP")).toBe("gainUp");
    expect(keyMap(mine).get("KeyQ")).toBeUndefined();
    expect(keyFor("gainUp", mine)).toBe("KeyP");
  });
  it("one key never works two functions: the old owner is left without a key", () => {
    const mine = assignKey({}, "ack", "KeyQ"); // Q was gain up
    expect(keyMap(mine).get("KeyQ")).toBe("ack");
    expect(keyFor("gainUp", mine)).toBe("");
    expect([...keyMap(mine).values()].filter((id) => id === "gainUp")).toHaveLength(0);
    expect(keyMap(mine).get("Space")).toBeUndefined(); // ack moved off the space bar
  });
  it("a knob's travel becomes the control's range: fully back is the least, half way the middle, fully on the most", () => {
    expect(axisToValue(-1, 0, 100)).toBe(0);
    expect(axisToValue(0, 0, 100)).toBe(50);
    expect(axisToValue(1, 0, 100)).toBe(100);
    expect(axisToValue(0.5, 0, 100)).toBe(75);
    expect(axisToValue(0, 10, 100)).toBe(55); // brilliance runs from 10 to 100
    expect(axisToValue(7, 0, 100)).toBe(100); // out-of-range readings are held at the ends
  });
  it("only a knob that has really moved takes its control over", () => {
    expect(movedAxes([0, 0, 0, 0], [0.01, 0.5, 0, -0.03])).toEqual([1, 3]);
    expect(movedAxes([], [0.4, 0.4])).toEqual([]); // first reading: nothing to compare with
  });
  it("names keys as a person would", () => {
    expect(keyName("KeyQ")).toBe("Q");
    expect(keyName("Digit1")).toBe("1");
    expect(keyName("ArrowUp")).toBe("Up arrow");
    expect(keyName("Space")).toBe("Space bar");
    expect(keyName("")).toBe("none");
  });
});
