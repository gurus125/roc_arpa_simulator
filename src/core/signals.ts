/**
 * Whistle signals of the collision regulations (COLREG 1972).
 *
 *  - Rule 32: a short blast lasts about one second; a prolonged blast four to six seconds.
 *  - Rule 34 (vessels in sight of one another): one short blast "I am altering my course to
 *    starboard"; two short "to port"; three short "I am operating astern propulsion"; at least
 *    five short and rapid blasts when in doubt about the other vessel's action.
 *  - Rule 35 (restricted visibility), power-driven vessel: making way, one prolonged blast at
 *    intervals of not more than 2 minutes; under way but stopped, two prolonged blasts about
 *    2 seconds apart, at intervals of not more than 2 minutes.
 *  - Annex III: the whistle's fundamental frequency is 70-200 Hz for a vessel of 200 m or more,
 *    130-350 Hz for 75 m to under 200 m, and 250-700 Hz for under 75 m.
 */
export const SHORT_BLAST_S = 1;
export const PROLONGED_BLAST_S = 5;
/** Silence between the blasts of one signal, seconds. */
export const BLAST_GAP_S = 1;
/** Rule 35: about two seconds between the two prolonged blasts of a vessel under way but stopped. */
export const STOPPED_GAP_S = 2;
export const FOG_SIGNAL_INTERVAL_S = 120;

export type SignalId = "starboard" | "port" | "astern" | "doubt" | "fog-making-way" | "fog-stopped";

export interface WhistleSignal {
  id: SignalId;
  label: string;
  meaning: string;
  /** Blast lengths in seconds, in order. */
  blasts: number[];
  /** Silence between blasts, seconds. */
  gap: number;
}

export const WHISTLE_SIGNALS: WhistleSignal[] = [
  { id: "starboard", label: "1 SHORT", meaning: "I am altering my course to starboard (Rule 34)", blasts: [SHORT_BLAST_S], gap: BLAST_GAP_S },
  { id: "port", label: "2 SHORT", meaning: "I am altering my course to port (Rule 34)", blasts: [SHORT_BLAST_S, SHORT_BLAST_S], gap: BLAST_GAP_S },
  { id: "astern", label: "3 SHORT", meaning: "I am operating astern propulsion (Rule 34)", blasts: [SHORT_BLAST_S, SHORT_BLAST_S, SHORT_BLAST_S], gap: BLAST_GAP_S },
  { id: "doubt", label: "5 SHORT", meaning: "In doubt about your intentions or action (Rule 34)", blasts: [SHORT_BLAST_S, SHORT_BLAST_S, SHORT_BLAST_S, SHORT_BLAST_S, SHORT_BLAST_S], gap: 0.5 },
  { id: "fog-making-way", label: "1 PROLONGED", meaning: "Restricted visibility: power-driven vessel making way (Rule 35)", blasts: [PROLONGED_BLAST_S], gap: BLAST_GAP_S },
  { id: "fog-stopped", label: "2 PROLONGED", meaning: "Restricted visibility: under way but stopped (Rule 35)", blasts: [PROLONGED_BLAST_S, PROLONGED_BLAST_S], gap: STOPPED_GAP_S },
];

export const whistleSignal = (id: SignalId): WhistleSignal => WHISTLE_SIGNALS.find((s) => s.id === id)!;

/** Total time a signal takes to sound, seconds. */
export function signalDuration(s: WhistleSignal): number {
  return s.blasts.reduce((a, b) => a + b, 0) + s.gap * (s.blasts.length - 1);
}

/** The fog signal a power-driven vessel should be sounding at this speed through the water. */
export function fogSignalFor(speedThroughWaterKn: number): SignalId {
  return Math.abs(speedThroughWaterKn) > 0.2 ? "fog-making-way" : "fog-stopped";
}

/** Whistle frequency (Hz) for a ship of this length, taken in the middle of the Annex III band. */
export function whistleFrequencyHz(lengthM: number): number {
  if (lengthM >= 200) return 135;
  if (lengthM >= 75) return 240;
  return 475;
}
