/** Small DOM helpers shared by the panels. */

/**
 * Documents other than this page's that hold some of its controls: the ship control window (ship-window.ts)
 * borrows the steering, engine and exercise controls while it is open. Lookups search this page first, then those.
 */
const extraDocs: Document[] = [];
export const registerDoc = (d: Document): void => {
  if (!extraDocs.includes(d)) extraDocs.push(d);
};
export const unregisterDoc = (d: Document): void => {
  const i = extraDocs.indexOf(d);
  if (i >= 0) extraDocs.splice(i, 1);
};
/** An element by its id, in this page or in a window that has borrowed it; null if there is none. */
export const byId = <T extends HTMLElement = HTMLElement>(id: string): T | null => {
  const el = document.getElementById(id);
  if (el) return el as T;
  for (const d of extraDocs) {
    const x = d.getElementById(id);
    if (x) return x as T;
  }
  return null;
};
/** The first element matching a selector, in this page or in a window that has borrowed controls. */
export const query = <T extends HTMLElement = HTMLElement>(sel: string): T | null => {
  const el = document.querySelector<T>(sel);
  if (el) return el;
  for (const d of extraDocs) {
    const x = d.querySelector<T>(sel);
    if (x) return x;
  }
  return null;
};
export const $ = <T extends HTMLElement>(id: string): T => {
  const el = byId<T>(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
};
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
export const mmss = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec + 1e-6));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export const inputValue = (id: string): string => (byId(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
export function download(name: string, text: string, type = "text/plain"): void {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
