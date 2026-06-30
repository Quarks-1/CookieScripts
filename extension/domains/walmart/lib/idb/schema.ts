import { WALMART_DB_NAME, WALMART_DB_VERSION } from "@ext/domains/walmart/lib/constants.ts";

export const STORE_SESSIONS = "sessions";
export const STORE_EVENTS = "events";
export const STORE_PAGES = "pages";
export const STORE_ENDPOINTS = "endpoints";

export function openWalmartDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WALMART_DB_NAME, WALMART_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("idb open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const events = db.createObjectStore(STORE_EVENTS, { keyPath: "id", autoIncrement: true });
        events.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PAGES)) {
        const pages = db.createObjectStore(STORE_PAGES, { keyPath: "pageId" });
        pages.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ENDPOINTS)) {
        const endpoints = db.createObjectStore(STORE_ENDPOINTS, { keyPath: "id", autoIncrement: true });
        endpoints.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function withWalmartDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openWalmartDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("idb tx aborted"));
  });
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return withWalmartDb(async (db) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return result;
  });
}

export async function idbPut(storeName: string, value: unknown): Promise<void> {
  return withWalmartDb(async (db) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    await txDone(tx);
  });
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  return withWalmartDb(async (db) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    await txDone(tx);
  });
}

export async function idbGetAllByIndex<T>(
  storeName: string,
  indexName: string,
  query: IDBValidKey,
): Promise<T[]> {
  return withWalmartDb(async (db) => {
    const tx = db.transaction(storeName, "readonly");
    const index = tx.objectStore(storeName).index(indexName);
    const result = await new Promise<T[]>((resolve, reject) => {
      const req = index.getAll(query);
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return result;
  });
}

export async function idbDeleteByIndex(
  storeName: string,
  indexName: string,
  query: IDBValidKey,
): Promise<void> {
  const rows = await idbGetAllByIndex<{ id?: number; pageId?: string }>(storeName, indexName, query);
  return withWalmartDb(async (db) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const row of rows) {
      const key = row.id ?? row.pageId;
      if (key !== undefined) {
        store.delete(key);
      }
    }
    await txDone(tx);
  });
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  return withWalmartDb(async (db) => {
    const tx = db.transaction(storeName, "readonly");
    const result = await new Promise<T[]>((resolve, reject) => {
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return result;
  });
}
