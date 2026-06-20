import { indexedDB } from "fake-indexeddb";
import "jsdom-worker";
import { beforeEach, afterEach } from "vitest";

if (typeof window !== "undefined") {
  window.indexedDB = indexedDB;
  (window as any).IDBKeyRange = (globalThis as any).IDBKeyRange;
}

globalThis.indexedDB = indexedDB;

Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  value: () => "blob:test-url",
});

Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  value: () => {},
});

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(async () => {
  const dbs = indexedDB.databases ? await indexedDB.databases() : [];
  await Promise.all(
    dbs.map((db) => {
      if (db.name) {
        return new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      return Promise.resolve();
    })
  );
});
