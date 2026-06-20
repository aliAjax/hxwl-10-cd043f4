import type {
  ExportTaskRecord,
  ExportTaskType,
  ExportTaskStatus,
  ExportTaskSnapshot,
  ExportTaskCheckResult,
  SearchFilters,
} from "../types";
import {
  EXPORT_TASK_SCHEMA_VERSION,
  isExportTaskRecord,
} from "../types";
import type {
  ExportOptions,
  ConsistencyReport,
} from "./types";

const DB_NAME = "ArchaeologyDraftDB";
const DB_VERSION = 2;
const EXPORT_TASKS_STORE = "exportTasks";

const isIndexedDBSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    "indexedDB" in window &&
    window.indexedDB !== null
  );
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error("当前浏览器不支持 IndexedDB，任务历史功能不可用"));
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
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains("drafts")) {
        const draftsStore = db.createObjectStore("drafts", {
          keyPath: "id",
          autoIncrement: true,
        });
        draftsStore.createIndex("trenchNumber", "trenchNumber", { unique: false });
        draftsStore.createIndex("savedAt", "savedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(EXPORT_TASKS_STORE)) {
        const tasksStore = db.createObjectStore(EXPORT_TASKS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        tasksStore.createIndex("taskType", "taskType", { unique: false });
        tasksStore.createIndex("status", "status", { unique: false });
        tasksStore.createIndex("createdAt", "createdAt", { unique: false });
        tasksStore.createIndex("projectId", "snapshot.projectId", { unique: false });
      }

      if (oldVersion < 2 && db.objectStoreNames.contains(EXPORT_TASKS_STORE)) {
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (transaction) {
          const store = transaction.objectStore(EXPORT_TASKS_STORE);
          if (!store.indexNames.contains("projectId")) {
            store.createIndex("projectId", "snapshot.projectId", { unique: false });
          }
        }
      }
    };
  });
};

const normalizeTaskRecord = (record: unknown): ExportTaskRecord | null => {
  if (!isExportTaskRecord(record)) {
    return null;
  }

  const task = record as ExportTaskRecord;

  try {
    if (!task.snapshot.exportOptions) {
      task.snapshot.exportOptions = {
        includePendingRecords: true,
        includeRejectedRecords: true,
        includeLogs: true,
      };
    }

    if (!task.snapshot.searchFilters) {
      task.snapshot.searchFilters = {
        trenchNumber: "",
        stratum: "",
        relicUnit: "",
        artifactKeyword: "",
      };
    }

    if (task.checkResult && typeof task.checkResult.totalIssues !== "number") {
      task.checkResult.totalIssues =
        task.checkResult.blockingCount + task.checkResult.warningCount;
    }

    return task;
  } catch {
    return null;
  }
};

export interface CreateTaskParams {
  taskType: ExportTaskType;
  snapshot: ExportTaskSnapshot;
  checkResult?: ExportTaskCheckResult;
  fileName?: string;
  fileSizeBytes?: number;
  error?: string;
  taskId?: string;
  message?: string;
  dataPackageSchemaVersion?: string;
}

export const buildTaskSnapshot = (
  project: { id: string; title: string },
  exportOptions: ExportOptions,
  searchFilters: SearchFilters,
  hasActiveFilters: boolean
): ExportTaskSnapshot => {
  return {
    exportOptions: {
      includePendingRecords: exportOptions.includePendingRecords,
      includeRejectedRecords: exportOptions.includeRejectedRecords,
      includeLogs: exportOptions.includeLogs,
    },
    searchFilters: { ...searchFilters },
    hasActiveFilters,
    projectId: project.id,
    projectTitle: project.title,
  };
};

export const buildCheckResult = (
  report: ConsistencyReport
): ExportTaskCheckResult => {
  return {
    blockingCount: report.blockingCount,
    warningCount: report.warningCount,
    totalIssues: report.issues.length,
    isExportable: report.isExportable,
  };
};

const createTaskRecord = (
  params: CreateTaskParams,
  status: ExportTaskStatus
): Omit<ExportTaskRecord, "id"> => {
  const now = new Date().toISOString();
  return {
    schemaVersion: EXPORT_TASK_SCHEMA_VERSION,
    taskType: params.taskType,
    status,
    createdAt: now,
    completedAt: status !== "pending" ? now : undefined,
    snapshot: params.snapshot,
    checkResult: params.checkResult,
    fileName: params.fileName,
    fileSizeBytes: params.fileSizeBytes,
    error: params.error,
    taskId: params.taskId,
    message: params.message,
    dataPackageSchemaVersion: params.dataPackageSchemaVersion,
  };
};

export const saveExportTask = (
  params: CreateTaskParams,
  status: ExportTaskStatus = "success"
): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readwrite");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);

      const record = createTaskRecord(params, status);
      const request = store.add(record);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as number);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("保存任务历史失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const updateExportTask = (
  id: number,
  updates: Partial<Omit<ExportTaskRecord, "id" | "schemaVersion" | "createdAt">>
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readwrite");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          db.close();
          reject(new Error("任务记录不存在"));
          return;
        }

        const now = new Date().toISOString();
        const updated: ExportTaskRecord = {
          ...existing,
          ...updates,
          completedAt: updates.status !== "pending" ? now : existing.completedAt,
        };

        const putRequest = store.put(updated);
        putRequest.onsuccess = () => {
          db.close();
          resolve();
        };
        putRequest.onerror = () => {
          db.close();
          reject(new Error("更新任务历史失败"));
        };
      };

      getRequest.onerror = () => {
        db.close();
        reject(new Error("获取任务记录失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const getExportTask = (id: number): Promise<ExportTaskRecord | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readonly");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        db.close();
        const record = request.result;
        const normalized = normalizeTaskRecord(record);
        resolve(normalized);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("获取任务记录失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const getAllExportTasks = (
  options?: { projectId?: string; taskType?: ExportTaskType; limit?: number }
): Promise<ExportTaskRecord[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readonly");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);

      let request: IDBRequest;
      if (options?.projectId && store.indexNames.contains("projectId")) {
        const index = store.index("projectId");
        request = index.getAll(options.projectId);
      } else if (options?.taskType && store.indexNames.contains("taskType")) {
        const index = store.index("taskType");
        request = index.getAll(options.taskType);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        db.close();
        const records = (request.result as unknown[]).map(normalizeTaskRecord).filter(
          (r): r is ExportTaskRecord => r !== null
        );

        records.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (options?.limit) {
          resolve(records.slice(0, options.limit));
        } else {
          resolve(records);
        }
      };

      request.onerror = () => {
        db.close();
        reject(new Error("获取任务历史列表失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteExportTask = (id: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readwrite");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(new Error("删除任务记录失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const clearAllExportTasks = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readwrite");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(new Error("清空任务历史失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};

export const getTaskCount = (): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(EXPORT_TASKS_STORE, "readonly");
      const store = transaction.objectStore(EXPORT_TASKS_STORE);
      const request = store.count();

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(new Error("获取任务数量失败"));
      };
    } catch (error) {
      reject(error);
    }
  });
};
