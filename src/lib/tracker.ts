// Tiny IndexedDB wrapper for the "downloaded books" tracker.
// No dependency — raw IDB. One object store keyed by pid.

export type TrackedBook = {
  pid: string;
  title: string;
  author: string;
  year: number;
  addedAt: number; // epoch ms
  formats: string[]; // which formats the user downloaded
};

const DB_NAME = "fp-tracker";
const DB_VERSION = 1;
const STORE = "downloads";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "pid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function trackAdd(b: TrackedBook): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(b);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  notify();
}

export async function trackRemove(pid: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(pid);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  notify();
}

export async function trackHas(pid: string): Promise<boolean> {
  const db = await openDB();
  const v = await new Promise<TrackedBook | undefined>((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(pid);
    r.onsuccess = () => res(r.result as TrackedBook | undefined);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return !!v;
}

export async function trackAll(): Promise<TrackedBook[]> {
  const db = await openDB();
  const all = await new Promise<TrackedBook[]>((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result as TrackedBook[]);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return all;
}

export async function trackClear(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  notify();
}

export async function trackBulkAdd(items: TrackedBook[]): Promise<number> {
  const db = await openDB();
  let added = 0;
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const it of items) {
      // only add if not already present (don't overwrite addedAt)
      const get = store.get(it.pid);
      get.onsuccess = () => {
        if (!get.result) {
          store.put(it);
          added++;
        }
      };
    }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  notify();
  return added;
}

// --- pub/sub so React components can react to changes ---
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function notify() {
  listeners.forEach((l) => l());
}
