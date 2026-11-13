/**
 * Control panel: which radar function each key and each knob of a hardware panel works.
 *
 * Two kinds of panel are supported, both plugged in by USB with no driver:
 *  - a panel that acts as a KEYBOARD (most key pads, and rotary encoders that send one key per
 *    click each way): every function has a key, which can be changed under SETTINGS;
 *  - a panel that acts as a GAME CONTROLLER (a box of knobs and push buttons): the first four
 *    knobs set gain, sea clutter, rain clutter and brilliance, and the buttons work the
 *    functions in BUTTON_ACTIONS, in order.
 * The default keys are this simulator's own choice, not those of any maker's radar.
 */
export interface PanelAction {
  id: string;
  label: string;
  /** Default key, as a KeyboardEvent.code (the physical key, whatever the keyboard language). */
  key: string;
}

export const PANEL_ACTIONS: PanelAction[] = [
  { id: "gainUp", label: "Gain up", key: "KeyQ" },
  { id: "gainDown", label: "Gain down", key: "KeyA" },
  { id: "seaUp", label: "Sea clutter up", key: "KeyW" },
  { id: "seaDown", label: "Sea clutter down", key: "KeyS" },
  { id: "rainUp", label: "Rain clutter up", key: "KeyE" },
  { id: "rainDown", label: "Rain clutter down", key: "KeyD" },
  { id: "brillUp", label: "Brilliance up", key: "KeyR" },
  { id: "brillDown", label: "Brilliance down", key: "KeyF" },
  { id: "rangeUp", label: "Range scale up (longer)", key: "PageUp" },
  { id: "rangeDown", label: "Range scale down (shorter)", key: "PageDown" },
  { id: "eblRight", label: "EBL 1 clockwise", key: "ArrowRight" },
  { id: "eblLeft", label: "EBL 1 anticlockwise", key: "ArrowLeft" },
  { id: "vrmOut", label: "VRM 1 out", key: "ArrowUp" },
  { id: "vrmIn", label: "VRM 1 in", key: "ArrowDown" },
  { id: "eblOnOff", label: "EBL 1 on / off", key: "KeyZ" },
  { id: "vrmOnOff", label: "VRM 1 on / off", key: "KeyX" },
  { id: "ack", label: "Alarm acknowledge", key: "Space" },
  { id: "enter", label: "Act at the cursor (acquire, select or cancel)", key: "Enter" },
  { id: "modeAcquire", label: "Cursor mode: acquire", key: "Digit1" },
  { id: "modeSelect", label: "Cursor mode: select", key: "Digit2" },
  { id: "modeCancel", label: "Cursor mode: cancel", key: "Digit3" },
  { id: "standby", label: "Radar on / standby", key: "F2" },
  { id: "bandX", label: "X band", key: "F3" },
  { id: "bandS", label: "S band", key: "F4" },
  { id: "rings", label: "Range rings on / off", key: "F7" },
  { id: "dayNight", label: "Day / night", key: "F8" },
  { id: "headingLineOff", label: "Heading line and graphics off (while held)", key: "KeyH" },
];

/** Knobs of a game-controller panel, in order: the slider each one sets. */
export const AXIS_CONTROLS = ["gain", "stc", "ftc", "brill"] as const;
/** Push buttons of a game-controller panel, in order: the function each one works. */
export const BUTTON_ACTIONS = ["ack", "enter", "rangeDown", "rangeUp", "eblOnOff", "vrmOnOff", "modeAcquire", "modeSelect", "modeCancel", "standby", "bandX", "bandS", "rings", "dayNight"] as const;
/** A knob must move by more than this (on its -1 to +1 travel) before it takes the control over. */
export const AXIS_DEADBAND = 0.02;

/** Keys in use: the user's own choices over the defaults. Returns key code -> action id. An action given "" has no key. */
export function keyMap(custom: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of PANEL_ACTIONS) {
    const code = custom[a.id] ?? a.key;
    if (code) map.set(code, a.id);
  }
  return map;
}

/** The key now given to an action ("" if none). */
export function keyFor(actionId: string, custom: Record<string, string> = {}): string {
  return custom[actionId] ?? PANEL_ACTIONS.find((a) => a.id === actionId)?.key ?? "";
}

/**
 * Give a key to an action. Any other action that had that key loses it (it is left with no key),
 * so that one key never works two functions. Returns the new set of choices.
 */
export function assignKey(custom: Record<string, string>, actionId: string, code: string): Record<string, string> {
  const out: Record<string, string> = { ...custom };
  for (const a of PANEL_ACTIONS) if (a.id !== actionId && keyFor(a.id, out) === code) out[a.id] = "";
  out[actionId] = code;
  return out;
}

/** Position of a knob (-1 fully anticlockwise to +1 fully clockwise) as a value between lo and hi. */
export function axisToValue(v: number, lo: number, hi: number): number {
  const x = Math.min(1, Math.max(-1, v));
  return Math.round(lo + ((x + 1) / 2) * (hi - lo));
}

/** Indexes of the knobs that have moved by more than the deadband since `prev`. */
export function movedAxes(prev: readonly number[], now: readonly number[], deadband = AXIS_DEADBAND): number[] {
  const out: number[] = [];
  for (let i = 0; i < now.length; i++) if (Math.abs(now[i]! - (prev[i] ?? now[i]!)) > deadband) out.push(i);
  return out;
}

/** A key code as a person would name the key: "KeyQ" -> "Q", "Digit1" -> "1", "ArrowUp" -> "Up arrow". */
export function keyName(code: string): string {
  if (!code) return "none";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return `${code.slice(5)} arrow`;
  if (code.startsWith("Numpad")) return `Number pad ${code.slice(6)}`;
  return code === "Space" ? "Space bar" : code === "PageUp" ? "Page Up" : code === "PageDown" ? "Page Down" : code;
}
