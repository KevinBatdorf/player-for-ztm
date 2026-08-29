/** IndexedDB, not `storage.local`: the lesson index runs to seventeen thousand rows. */
const DB_NAME = 'ztm';
const DB_VERSION = 1;
const STORE = 'cache';

/** Two documents read these; a drifting name is a silent cache miss. */
export const KEYS = {
  courses: 'courses',
  catalog: 'catalog',
  lessons: 'lessons',
  watched: 'watched',
  last: 'last',
} as const;

/** A blocked upgrade fires neither callback, so the open needs its own deadline. */
const OPEN_MS = 5_000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = setTimeout(() => reject(new Error('IndexedDB did not open.')), OPEN_MS);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error('IndexedDB refused to open.'));
    };
  });
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = act(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'));
      }).finally(() => db.close()),
  );
}

/** A dead database reads as a miss; the caller refetches either way. */
export const read = <T>(key: string): Promise<T | null> =>
  run<T | null>('readonly', (store) => store.get(key)).then((value) => value ?? null).catch(() => null);

/** A failed write costs one refetch next open. */
export const write = (key: string, value: unknown): Promise<void> =>
  run<void>('readwrite', (store) => store.put(value, key))
    .then(() => undefined)
    .catch(() => undefined);
