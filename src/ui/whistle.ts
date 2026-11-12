import { WhistleSignal } from "../core/signals";

/**
 * Sounds a whistle signal with the browser's Web Audio. Browsers allow sound only after the
 * user has clicked on the page; the signal keys are clicks, so that is always the case here.
 */
let ctx: AudioContext | null = null;
let busyUntil = 0;

export function soundWhistle(signal: WhistleSignal, frequencyHz: number): boolean {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    ctx ??= new Ctor();
    if (ctx.currentTime < busyUntil) return false; // one signal at a time
    let t = ctx.currentTime + 0.05;
    for (const len of signal.blasts) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // A sawtooth has strong harmonics, so a low whistle is still heard on small speakers.
      osc.type = "sawtooth";
      osc.frequency.value = frequencyHz;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.08);
      gain.gain.setValueAtTime(0.25, t + len - 0.1);
      gain.gain.linearRampToValueAtTime(0, t + len);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
      t += len + signal.gap;
    }
    busyUntil = t - signal.gap;
    return true;
  } catch {
    return false;
  }
}
