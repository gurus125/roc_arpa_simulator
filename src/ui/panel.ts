import { Store } from "../train/index";
import { $, esc } from "./dom";
import { AXIS_CONTROLS, BUTTON_ACTIONS, PANEL_ACTIONS, assignKey, axisToValue, keyFor, keyMap, keyName, movedAxes } from "./panel-map";

/** Hardware control panel: keys and knobs work the same controls as the mouse does (see panel-map.ts). */
export interface PanelUi {
  /** Call every frame: reads the knobs and buttons of a game-controller panel. */
  tick: () => void;
  /** Do one panel function (also used by the tests). */
  act: (actionId: string, down?: boolean) => void;
}

export function initPanel(store: Store): PanelUi {
  const canvas = $<HTMLCanvasElement>("ppi");
  let lastPointer: { x: number; y: number } | null = null;
  canvas.addEventListener("pointermove", (ev) => (lastPointer = { x: ev.clientX, y: ev.clientY }));

  const slider = (id: string): HTMLInputElement => $<HTMLInputElement>(id);
  const setSlider = (id: string, value: number): void => {
    const el = slider(id);
    const lo = Number(el.min), hi = Number(el.max);
    const v = Math.min(hi, Math.max(lo, value));
    if (Number(el.value) === v) return;
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const step = (id: string, delta: number, wrap = false): void => {
    const el = slider(id);
    let v = Number(el.value) + delta;
    if (wrap) v = ((v % 360) + 360) % 360;
    setSlider(id, Math.round(v * 100) / 100);
  };
  const click = (sel: string): void => document.querySelector<HTMLElement>(sel)?.click();
  const pointer = (el: Element, type: string, at?: { x: number; y: number }): void => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: at?.x ?? 0, clientY: at?.y ?? 0, pointerType: "mouse" }));
  };

  const act = (id: string, down = true): void => {
    if (id === "headingLineOff") return pointer($("hlOff"), down ? "pointerdown" : "pointerup");
    if (!down) return;
    switch (id) {
      case "gainUp": return step("gain", 2);
      case "gainDown": return step("gain", -2);
      case "seaUp": return step("stc", 2);
      case "seaDown": return step("stc", -2);
      case "rainUp": return step("ftc", 2);
      case "rainDown": return step("ftc", -2);
      case "brillUp": return step("brill", 2);
      case "brillDown": return step("brill", -2);
      case "rangeUp": return click("#rngUp");
      case "rangeDown": return click("#rngDn");
      case "eblRight": return step("eblBrg", 0.5, true);
      case "eblLeft": return step("eblBrg", -0.5, true);
      case "vrmOut": return step("vrmRng", Number(slider("vrmRng").value) < 3 ? 0.05 : 0.1);
      case "vrmIn": return step("vrmRng", Number(slider("vrmRng").value) <= 3 ? -0.05 : -0.1);
      case "eblOnOff": return click("#eblOn");
      case "vrmOnOff": return click("#vrmOn");
      case "ack": return click("#ackKey");
      case "enter": if (lastPointer) pointer(canvas, "pointerdown", lastPointer); return;
      case "modeAcquire": return click("#cmAcq");
      case "modeSelect": return click("#cmSel");
      case "modeCancel": return click("#cmCan");
      case "standby": return click("#radarSb");
      case "bandX": return click('#bandKeys button[data-b="X"]');
      case "bandS": return click('#bandKeys button[data-b="S"]');
      case "rings": return click("#ringsKey");
      case "dayNight": return click("#nightKey");
    }
  };

  // ---- keys (a panel that acts as a keyboard)
  let capture: string | null = null; // the action waiting to be given a key
  const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(t instanceof HTMLInputElement && (t.type === "range" || t.type === "checkbox")));
  const draw = (): void => {
    const keys = store.data.panelKeys;
    $("pnKeys").innerHTML = PANEL_ACTIONS.map((a) => `<tr><td>${esc(a.label)}</td><td class="val">${capture === a.id ? "press a key..." : esc(keyName(keyFor(a.id, keys)))}</td><td><button data-pn="${a.id}">Set</button></td></tr>`).join("");
  };
  window.addEventListener("keydown", (ev) => {
    if (capture) {
      ev.preventDefault();
      if (ev.code !== "Escape") {
        store.data.panelKeys = assignKey(store.data.panelKeys, capture, ev.code);
        store.save();
      }
      capture = null;
      draw();
      return;
    }
    if (ev.ctrlKey || ev.altKey || ev.metaKey || typing(ev.target)) return;
    // A slider that has been clicked keeps its own arrow and page keys.
    if (ev.target instanceof HTMLInputElement && ev.target.type === "range" && /^(Arrow|Page|Home|End)/.test(ev.code)) return;
    const id = keyMap(store.data.panelKeys).get(ev.code);
    if (!id) return;
    ev.preventDefault();
    if (ev.repeat && id === "headingLineOff") return;
    act(id, true);
  });
  window.addEventListener("keyup", (ev) => {
    if (keyMap(store.data.panelKeys).get(ev.code) === "headingLineOff") act("headingLineOff", false);
  });
  $("pnKeys").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("button[data-pn]");
    if (!b) return;
    capture = b.dataset["pn"]!;
    b.blur();
    draw();
  });
  $("pnReset").addEventListener("click", () => {
    store.data.panelKeys = {};
    store.save();
    capture = null;
    draw();
  });
  draw();

  // ---- knobs and buttons (a panel that acts as a game controller)
  let prevAxes: number[] = [];
  let prevButtons: boolean[] = [];
  let padSig = "";
  const tick = (): void => {
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p) { pad = p; break; }
    const sig = pad ? `Control box connected: ${pad.id} (${pad.axes.length} knobs, ${pad.buttons.length} buttons).` : "No control box found. A box of knobs is found when it is plugged in and one of its buttons is pressed.";
    if (sig !== padSig) {
      padSig = sig;
      $("pnPad").textContent = sig;
      prevAxes = pad ? [...pad.axes] : [];
      prevButtons = pad ? pad.buttons.map((b) => b.pressed) : [];
      return;
    }
    if (!pad) return;
    const axes = [...pad.axes];
    for (const i of movedAxes(prevAxes, axes)) {
      const id = AXIS_CONTROLS[i];
      if (id) setSlider(id, axisToValue(axes[i]!, Number(slider(id).min), Number(slider(id).max)));
      prevAxes[i] = axes[i]!;
    }
    pad.buttons.forEach((b, i) => {
      const id = BUTTON_ACTIONS[i];
      if (id && b.pressed !== (prevButtons[i] ?? false)) act(id, b.pressed);
      prevButtons[i] = b.pressed;
    });
  };
  return { tick, act };
}
