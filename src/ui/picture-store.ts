import { PictureFrame } from "../train/index";

/**
 * Radar pictures recorded during an exercise, for the replay. They are far too big for the
 * records store, so they are kept in the browser's IndexedDB, one list per record id. Everything
 * here fails quietly: with no IndexedDB (or a full disk) the pictures of this session are still
 * shown from memory, and a record simply has no pictures after the page is closed.
 */
const DB = "radar-sim-pictures";
const STORE = "pictures";
const memory = new Map<string, PictureFrame[]>();
/** Records whose pictures are known to be in IndexedDB; only these may be dropped from memory. */
const stored = new Set<string>();
/** How many records' pictures stay in memory as well, once they are safely in IndexedDB. */
const MEMORY_RECORDS = 3;

function hold(recordId: string, pictures: PictureFrame[]): void {
  memory.delete(recordId); // so that the newest is last
  memory.set(recordId, pictures);
}

function trimMemory(): void {
  const safe = [...memory.keys()].filter((id) => stored.has(id));
  for (const id of safe.slice(0, Math.max(0, safe.length - MEMORY_RECORDS))) memory.delete(id);
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function done(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

/** Keep the pictures of a record, and drop those of records that are no longer in the list `keepIds`. */
export async function savePictures(recordId: string, pictures: PictureFrame[], keepIds: string[]): Promise<void> {
  hold(recordId, pictures);
  stored.delete(recordId);
  for (const id of [...memory.keys()]) if (id !== recordId && !keepIds.includes(id)) memory.delete(id);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    os.put(pictures, recordId);
    const keys = os.getAllKeys();
    keys.onsuccess = () => {
      for (const k of keys.result) if (k !== recordId && !keepIds.includes(String(k))) os.delete(k);
    };
    if (await done(tx)) {
      stored.add(recordId);
      trimMemory();
    }
  } catch {
    // Not stored: the pictures stay in memory for this session.
  } finally {
    db.close();
  }
}

/** The pictures of a record, or an empty list when there are none. */
export async function loadPictures(recordId: string): Promise<PictureFrame[]> {
  const held = memory.get(recordId);
  if (held) return held;
  const db = await open();
  if (!db) return [];
  try {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(recordId);
    const out = await new Promise<PictureFrame[]>((resolve) => {
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as PictureFrame[]) : []);
      req.onerror = () => resolve([]);
    });
    if (out.length > 0) {
      hold(recordId, out);
      stored.add(recordId);
      trimMemory();
    }
    return out;
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function deletePictures(recordId: string): Promise<void> {
  memory.delete(recordId);
  stored.delete(recordId);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(recordId);
    await done(tx);
  } catch {
    // Nothing to do.
  } finally {
    db.close();
  }
}
