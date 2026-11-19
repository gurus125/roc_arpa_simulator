import type { Batch } from "./store";

/**
 * Trainee accounts. Each trainee of a batch can have a PIN of his or her own, chosen at the first login and
 * reset by the instructor. The PIN itself is not kept: only a digest of it (SHA-256 of the batch, the name and
 * the PIN).
 *
 * What this is for: to keep one trainee from logging in as another in a classroom, so that a record and a
 * result belong to the person named. It is NOT real security. A PIN of four digits has only 10,000 values, so
 * anyone who has the digest can find the PIN by trying them all, and the digests go to every display with the
 * batches. Nothing on the classroom network is encrypted.
 */

/** A trainee's PIN: 4 to 8 digits. */
export const validStudentPin = (pin: string): boolean => /^\d{4,8}$/.test(pin);

// SHA-256 (FIPS 180-4), written out because the browser's own (crypto.subtle) is not available on a page
// served over plain http from another computer, which is how a classroom server serves it.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Text as UTF-8 bytes. */
function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** SHA-256 of a text (as UTF-8), in hexadecimal. */
export function sha256Hex(text: string): string {
  const bytes = utf8(text);
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // The length in bits as 64 bits, high word first (texts here are far below 2^32 bits, but the high word is kept right).
  const hi = Math.floor(bits / 0x100000000), lo = bits >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = ((bytes[o + 4 * i]! << 24) | (bytes[o + 4 * i + 1]! << 16) | (bytes[o + 4 * i + 2]! << 8) | bytes[o + 4 * i + 3]!) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }
  return [...h].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** What is kept in place of a trainee's PIN. The batch and the name are part of it, so two trainees with the same PIN have different digests. */
export function pinDigest(batchId: string, name: string, pin: string): string {
  return sha256Hex(`radar-sim trainee|${batchId}|${name}|${pin}`);
}

/** Whether this trainee of the batch has chosen a PIN. */
export const hasPin = (batch: Pick<Batch, "pins">, name: string): boolean => typeof batch.pins?.[name] === "string";

/** Whether the PIN typed is this trainee's. */
export function pinMatches(batch: Pick<Batch, "id" | "pins">, name: string, pin: string): boolean {
  const kept = batch.pins?.[name];
  return typeof kept === "string" && kept === pinDigest(batch.id, name, pin);
}

export type LoginCheck = { ok: true; newPins: { name: string; digest: string }[] } | { ok: false; message: string };

/**
 * Check a login of one or more trainees of a batch, each with the PIN typed (and, at a first login, typed again).
 * A trainee with no PIN yet chooses one now: it comes back in `newPins` to be kept.
 */
export function checkLogin(batch: Batch | undefined, entries: { name: string; pin: string; again: string }[]): LoginCheck {
  if (!batch) return { ok: false, message: "Choose your batch." };
  if (entries.length === 0) return { ok: false, message: "Choose your name." };
  const names = entries.map((e) => e.name);
  if (new Set(names).size !== names.length) return { ok: false, message: "The same name is chosen twice." };
  const newPins: { name: string; digest: string }[] = [];
  for (const e of entries) {
    if (!batch.students.includes(e.name)) return { ok: false, message: `${e.name} is not in this batch.` };
    if (hasPin(batch, e.name)) {
      if (!pinMatches(batch, e.name, e.pin)) return { ok: false, message: `Wrong PIN for ${e.name}. If it is forgotten, the instructor can reset it.` };
    } else {
      if (!validStudentPin(e.pin)) return { ok: false, message: `${e.name}: first login. Choose a PIN of 4 to 8 digits.` };
      if (e.pin !== e.again) return { ok: false, message: `${e.name}: the two PINs are not the same.` };
      newPins.push({ name: e.name, digest: pinDigest(batch.id, e.name, e.pin) });
    }
  }
  return { ok: true, newPins };
}
