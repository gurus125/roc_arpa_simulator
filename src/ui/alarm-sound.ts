/**
 * Audible alarm for the ARPA, made with the browser's Web Audio. A fast high beep for danger
 * (CPA/TCPA, lost target, equipment malfunction) and a slow lower beep for other alarms, until the
 * alarm is acknowledged. Browsers only allow sound after the user has clicked or pressed a key
 * on the page, so it stays silent until then.
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
      if (!unlocked || !enabled || urgency === "none") {
        if (gain) gain.gain.value = 0;
        return;
      }
      if (!ensure() || !ctx || !gain || !osc) return;
      if (ctx.state === "suspended") void ctx.resume();
      const period = urgency === "danger" ? 0.3 : 1.5;
      const onTime = urgency === "danger" ? 0.15 : 0.3;
      osc.frequency.value = urgency === "danger" ? 880 : 520;
      gain.gain.value = wall % period < onTime ? 0.06 : 0;
    },
  };
}
