import { describe, it, expect, beforeEach } from "vitest";
import {
  saveExportTask,
  getExportTask,
  getAllExportTasks,
  updateExportTask,
  deleteExportTask,
  clearAllExportTasks,
  getTaskCount,
  buildTaskSnapshot,
  buildCheckResult,
} from "./exportTaskStore";
import type { ExportTaskSnapshot, ExportTaskCheckResult } from "../types";
import type { ConsistencyReport } from "./types";

const baseSnapshot = (): ExportTaskSnapshot => ({
  exportOptions: {
    includePendingRecords: true,
    includeRejectedRecords: false,
    includeLogs: true,
  },
  searchFilters: { trenchNumber: "", stratum: "", relicUnit: "", artifactKeyword: "" },
  hasActiveFilters: false,
  projectId: "proj-001",
  projectTitle: "测试项目",
});

const baseCheckResult = (): ExportTaskCheckResult => ({
  blockingCount: 0,
  warningCount: 2,
  totalIssues: 2,
  isExportable: true,
});

describe("exportTaskStore - CRUD Operations", () => {
  beforeEach(async () => {
    await clearAllExportTasks();
  });

  describe("saveExportTask", () => {
    it("should save a new export task successfully", async () => {
      const id = await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
        checkResult: baseCheckResult(),
        fileName: "test-export.json",
        fileSizeBytes: 1024,
      }, "success");

      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);

      const saved = await getExportTask(id);
      expect(saved).not.toBeNull();
      expect(saved?.taskType).toBe("json_export");
      expect(saved?.status).toBe("success");
      expect(saved?.fileName).toBe("test-export.json");
      expect(saved?.fileSizeBytes).toBe(1024);
    });

    it("should save task with error status", async () => {
      const id = await saveExportTask({
        taskType: "backend_upload",
        snapshot: baseSnapshot(),
        error: "网络连接失败",
      }, "error");

      const saved = await getExportTask(id);
      expect(saved?.status).toBe("error");
      expect(saved?.error).toBe("网络连接失败");
    });

    it("should save task with pending status", async () => {
      const id = await saveExportTask({
        taskType: "pdf_generation",
        snapshot: baseSnapshot(),
        message: "正在生成PDF...",
      }, "pending");

      const saved = await getExportTask(id);
      expect(saved?.status).toBe("pending");
      expect(saved?.message).toBe("正在生成PDF...");
      expect(saved?.completedAt).toBeUndefined();
    });

    it("should auto-generate timestamps", async () => {
      const before = new Date().toISOString();
      const id = await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
      }, "success");
      const after = new Date().toISOString();

      const saved = await getExportTask(id);
      expect(saved).toBeDefined();
      expect(saved?.createdAt).toBeDefined();
      expect(saved!.createdAt >= before).toBe(true);
      expect(saved!.createdAt <= after).toBe(true);
      expect(saved?.completedAt).toBeDefined();
    });
  });

  describe("getExportTask", () => {
    it("should return null for non-existent task", async () => {
      const task = await getExportTask(99999);
      expect(task).toBeNull();
    });

    it("should return normalized task with default values for legacy data", async () => {
      const id = await saveExportTask({
        taskType: "json_export",
        snapshot: {
          ...baseSnapshot(),
          exportOptions: undefined as any,
          searchFilters: undefined as any,
        },
      }, "success");

      const saved = await getExportTask(id);
      expect(saved).not.toBeNull();
      expect(saved?.snapshot.exportOptions).toBeDefined();
      expect(saved?.snapshot.searchFilters).toBeDefined();
    });
  });

  describe("getAllExportTasks", () => {
    it("should return empty array when no tasks exist", async () => {
      const tasks = await getAllExportTasks();
      expect(tasks).toEqual([]);
    });

    it("should return all tasks sorted by createdAt descending", async () => {
      const id1 = await saveExportTask({
        taskType: "json_export",
        snapshot: { ...baseSnapshot(), projectId: "proj-1" },
      }, "success");

      await new Promise(resolve => setTimeout(resolve, 10));

      const id2 = await saveExportTask({
        taskType: "backend_upload",
        snapshot: { ...baseSnapshot(), projectId: "proj-2" },
      }, "success");

      const tasks = await getAllExportTasks();
      expect(tasks.length).toBe(2);
      expect(tasks[0].id).toBe(id2);
      expect(tasks[1].id).toBe(id1);
    });

    it("should filter by projectId when specified", async () => {
      await saveExportTask({
        taskType: "json_export",
        snapshot: { ...baseSnapshot(), projectId: "proj-A" },
      }, "success");

      await saveExportTask({
        taskType: "json_export",
        snapshot: { ...baseSnapshot(), projectId: "proj-B" },
      }, "success");

      const tasks = await getAllExportTasks({ projectId: "proj-A" });
      expect(tasks.length).toBe(1);
      expect(tasks[0].snapshot.projectId).toBe("proj-A");
    });

    it("should filter by taskType when specified", async () => {
      await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
      }, "success");

      await saveExportTask({
        taskType: "backend_upload",
        snapshot: baseSnapshot(),
      }, "success");

      const tasks = await getAllExportTasks({ taskType: "json_export" });
      expect(tasks.length).toBe(1);
      expect(tasks[0].taskType).toBe("json_export");
    });

    it("should limit results when limit is specified", async () => {
      for (let i = 0; i < 5; i++) {
        await saveExportTask({
          taskType: "json_export",
          snapshot: { ...baseSnapshot(), projectId: `proj-${i}` },
        }, "success");
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const tasks = await getAllExportTasks({ limit: 3 });
      expect(tasks.length).toBe(3);
    });
  });

  describe("updateExportTask", () => {
    it("should update existing task fields", async () => {
      const id = await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
      }, "pending");

      await updateExportTask(id, {
        status: "success",
        fileName: "updated.json",
        fileSizeBytes: 2048,
        message: "导出完成",
      });

      const updated = await getExportTask(id);
      expect(updated?.status).toBe("success");
      expect(updated?.fileName).toBe("updated.json");
      expect(updated?.fileSizeBytes).toBe(2048);
      expect(updated?.message).toBe("导出完成");
      expect(updated?.completedAt).toBeDefined();
    });

    it("should reject update for non-existent task", async () => {
      await expect(
        updateExportTask(99999, { status: "success" })
      ).rejects.toThrow("任务记录不存在");
    });
  });

  describe("deleteExportTask", () => {
    it("should delete existing task", async () => {
      const id = await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
      }, "success");

      await deleteExportTask(id);

      const deleted = await getExportTask(id);
      expect(deleted).toBeNull();
    });

    it("should not throw when deleting non-existent task", async () => {
      await expect(deleteExportTask(99999)).resolves.not.toThrow();
    });
  });

  describe("clearAllExportTasks", () => {
    it("should clear all tasks", async () => {
      await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
      }, "success");
      await saveExportTask({
        taskType: "backend_upload",
        snapshot: baseSnapshot(),
      }, "error");

      expect(await getTaskCount()).toBe(2);

      await clearAllExportTasks();

      expect(await getTaskCount()).toBe(0);
    });
  });

  describe("getTaskCount", () => {
    it("should return correct count", async () => {
      expect(await getTaskCount()).toBe(0);

      await saveExportTask({
        taskType: "json_export",
        snapshot: baseSnapshot(),
      }, "success");

      expect(await getTaskCount()).toBe(1);

      await saveExportTask({
        taskType: "consistency_check",
        snapshot: baseSnapshot(),
      }, "success");

      expect(await getTaskCount()).toBe(2);
    });
  });
});

describe("exportTaskStore - Helper Functions", () => {
  describe("buildTaskSnapshot", () => {
    it("should build correct snapshot structure", () => {
      const project = { id: "test-123", title: "测试考古项目" };
      const exportOptions = {
        includePendingRecords: true,
        includeRejectedRecords: true,
        includeLogs: false,
      };
      const searchFilters = {
        trenchNumber: "T0101",
        stratum: "第2层",
        relicUnit: "H1",
        artifactKeyword: "陶片",
      };

      const snapshot = buildTaskSnapshot(project, exportOptions, searchFilters, true);

      expect(snapshot.projectId).toBe("test-123");
      expect(snapshot.projectTitle).toBe("测试考古项目");
      expect(snapshot.exportOptions).toEqual(exportOptions);
      expect(snapshot.searchFilters).toEqual(searchFilters);
      expect(snapshot.hasActiveFilters).toBe(true);
    });

    it("should create independent copy of searchFilters", () => {
      const filters = { trenchNumber: "T01", stratum: "", relicUnit: "", artifactKeyword: "" };
      const snapshot = buildTaskSnapshot(
        { id: "1", title: "Test" },
        { includePendingRecords: false, includeRejectedRecords: false, includeLogs: false },
        filters,
        false
      );

      filters.trenchNumber = "T02";
      expect(snapshot.searchFilters.trenchNumber).toBe("T01");
    });
  });

  describe("buildCheckResult", () => {
    it("should build correct check result from consistency report", () => {
      const report: ConsistencyReport = {
        generatedAt: new Date().toISOString(),
        blockingCount: 2,
        warningCount: 3,
        issues: [],
        isExportable: false,
      };

      const result = buildCheckResult(report);

      expect(result.blockingCount).toBe(2);
      expect(result.warningCount).toBe(3);
      expect(result.totalIssues).toBe(0);
      expect(result.isExportable).toBe(false);
    });

    it("should calculate totalIssues correctly from issues array", () => {
      const report: ConsistencyReport = {
        generatedAt: new Date().toISOString(),
        blockingCount: 1,
        warningCount: 2,
        issues: [
          { id: "1", severity: "blocking", category: "missing_trench_number", message: "" },
          { id: "2", severity: "warning", category: "unreviewed_record", message: "" },
          { id: "3", severity: "warning", category: "unreviewed_record", message: "" },
        ],
        isExportable: true,
      };

      const result = buildCheckResult(report);
      expect(result.totalIssues).toBe(3);
    });
  });
});
