import { alarmToneOn, warningToneOn } from "../arpa/index";

/**
 * Audible alert signals, made with the browser's Web Audio, in the patterns of IEC 62288:2014
 * Table 2: an alarm ("danger" here) gives three short signals, repeated every few seconds until it
 * is acknowledged or silenced; a warning gives two short signals each time it is due. Browsers only
 * allow sound after the user has clicked or pressed a key on the page, so it stays silent until then.
 */
export type Urgency = "none" | "warning" | "danger";

export interface AlarmSound {
  update: (urgency: Urgency, wallSeconds: number) => void;
  setEnabled: (on: boolean) => void;
}

export function createAlarmSound(): AlarmSound {
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let osc: OscillatorNode | null = null;
  let enabled = true;
  let unlocked = false;
  /** Wall-clock time at which the alarm signal began, and at which the last warning signal began. */
  let alarmStart: number | null = null;
  let warnStart: number | null = null;
  let lastUrgency: Urgency = "none";
  const unlock = (): void => {
    unlocked = true;
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  const ensure = (): boolean => {
    if (ctx) return true;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      ctx = new Ctor();
      gain = ctx.createGain();
      gain.gain.value = 0;
      osc = ctx.createOscillator();
      osc.type = "square";
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      return true;
    } catch {
      return false;
    }
  };

  return {
    setEnabled: (on) => {
      enabled = on;
    },
    update: (urgency, wall) => {
      // An alarm's pattern runs from the moment the alarm signal begins; a warning's two signals are
      // played once each time a warning becomes due, and are finished even if the call ends early.
      if (urgency === "danger") alarmStart = alarmStart ?? wall;
      else alarmStart = null;
      if (urgency === "warning" && lastUrgency !== "warning") warnStart = wall;
      lastUrgency = urgency;
      const alarmOn = alarmStart !== null && alarmToneOn(wall - alarmStart);
      const warnOn = alarmStart === null && warnStart !== null && warningToneOn(wall - warnStart);
      if (!unlocked || !enabled || (!alarmOn && !warnOn)) {
        if (gain) gain.gain.value = 0;
        return;
      }
      if (!ensure() || !ctx || !gain || !osc) return;
      if (ctx.state === "suspended") void ctx.resume();
      osc.frequency.value = alarmOn ? 880 : 520;
      gain.gain.value = 0.06;
    },
  };
}
