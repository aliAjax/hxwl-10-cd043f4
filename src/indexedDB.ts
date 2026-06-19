export interface DraftRecord {
  id: number;
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  remarks: string;
  savedAt: string;
  draftName: string;
}

type DraftFormData = Omit<DraftRecord, "id" | "savedAt">;

const DB_NAME = "ArchaeologyDraftDB";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

export const isIndexedDBSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    "indexedDB" in window &&
    window.indexedDB !== null
  );
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error("当前浏览器不支持 IndexedDB，草稿功能不可用"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("无法打开数据库连接"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("trenchNumber", "trenchNumber", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
  });
};

export const saveDraft = (
  draftData: DraftFormData,
  existingId?: number
): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const now = new Date().toLocaleString("zh-CN");
      const draftName =
        draftData.draftName ||
        `${draftData.trenchNumber || "未命名"}-${now.split(" ")[0]}`;

      const record: Omit<DraftRecord, "id"> & { id?: number } = {
        ...draftData,
        draftName,
        savedAt: now,
      };

      if (existingId) {
        record.id = existingId;
      }

      const request = store.put(record);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as number);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("保存草稿失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const getDraft = (id: number): Promise<DraftRecord | undefined> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as DraftRecord | undefined);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("获取草稿失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const getAllDrafts = (): Promise<DraftRecord[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        const drafts = request.result as DraftRecord[];
        drafts.sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        resolve(drafts);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("获取草稿列表失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteDraft = (id: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(new Error("删除草稿失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const clearAllDrafts = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(new Error("清空草稿失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const getDraftsByTrench = (
  trenchNumber: string
): Promise<DraftRecord[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("trenchNumber");
      const request = index.getAll(trenchNumber);

      request.onsuccess = () => {
        db.close();
        const drafts = request.result as DraftRecord[];
        drafts.sort(
          (a, b) =>
            new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        resolve(drafts);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("按探方获取草稿失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};
