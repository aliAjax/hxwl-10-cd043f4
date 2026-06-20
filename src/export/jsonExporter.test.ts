import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  serializeDataPackage,
  downloadJsonFile,
  downloadJsonFromSnapshot,
  formatFileSize,
} from "./jsonExporter";
import type { ExportDataPackage, ExportOptions } from "./types";

const baseDataPackage = (): ExportDataPackage => ({
  schemaVersion: "1.0.0",
  projectInfo: {
    id: "proj-001",
    title: "测试考古项目",
    subtitle: "测试副标题",
    domain: "考古",
    exportedAt: new Date().toISOString(),
    exporter: "测试用户",
  },
  metrics: {
    trenchCount: 2,
    stratumCount: 3,
    artifactCount: 10,
    pendingReviewCount: 2,
    approvedCount: 7,
    rejectedCount: 1,
    archivedCount: 0,
    relationCount: 4,
    logCount: 3,
    metricsLabels: [],
    filterLabels: [],
  },
  filters: {
    searchFilters: { trenchNumber: "", stratum: "", relicUnit: "", artifactKeyword: "" },
    hasActiveFilters: false,
  },
  trenchRecords: [],
  stratumRelations: [],
  artifacts: [],
  excavationLogs: [],
  consistencyReport: {
    generatedAt: new Date().toISOString(),
    blockingCount: 0,
    warningCount: 0,
    issues: [],
    isExportable: true,
  },
});

describe("jsonExporter - serializeDataPackage", () => {
  it("should serialize data package to formatted JSON string", () => {
    const data = baseDataPackage();
    const result = serializeDataPackage(data);
    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result);
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.projectInfo.id).toBe("proj-001");
    expect(parsed.consistencyReport.isExportable).toBe(true);
  });

  it("should preserve all nested fields", () => {
    const data = baseDataPackage();
    data.metrics.trenchCount = 5;
    data.artifacts = [
      {
        id: 1,
        trenchNumber: "T0101",
        stratum: "第1层",
        artifactType: "陶片",
        eCoordinate: "E100m",
        nCoordinate: "N200m",
        depth: "0.5m",
        remarks: "",
        createdAt: new Date().toISOString(),
        status: "approved",
      },
    ];
    const result = serializeDataPackage(data);
    const parsed = JSON.parse(result);
    expect(parsed.metrics.trenchCount).toBe(5);
    expect(parsed.artifacts.length).toBe(1);
    expect(parsed.artifacts[0].artifactType).toBe("陶片");
  });
});

describe("jsonExporter - downloadJsonFile", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should return success when data is exportable", () => {
    const data = baseDataPackage();
    const options: ExportOptions = {
      includePendingRecords: true,
      includeRejectedRecords: false,
      includeLogs: true,
      fileName: "test-export.json",
    };

    const result = downloadJsonFile(data, options);
    expect(result.success).toBe(true);
    expect(result.fileName).toBe("test-export.json");
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  });

  it("should generate default filename when not specified", () => {
    const data = baseDataPackage();
    const result = downloadJsonFile(data);
    expect(result.success).toBe(true);
    expect(result.fileName).toContain("proj-001");
    expect(result.fileName).toContain("data_package");
    expect(result.fileName).toMatch(/\.json$/);
  });

  it("should block export when requireConsistencyPass is true and there are blocking issues", () => {
    const data = baseDataPackage();
    data.consistencyReport.blockingCount = 3;
    data.consistencyReport.isExportable = false;

    const result = downloadJsonFile(data, {
      includePendingRecords: false,
      includeRejectedRecords: false,
      includeLogs: true,
      requireConsistencyPass: true,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("阻断问题");
    expect(result.error).toContain("3");
    expect(result.sizeBytes).toBe(0);
  });

  it("should allow export when requireConsistencyPass is false even with blocking issues", () => {
    const data = baseDataPackage();
    data.consistencyReport.blockingCount = 3;
    data.consistencyReport.isExportable = false;

    const result = downloadJsonFile(data, {
      includePendingRecords: false,
      includeRejectedRecords: false,
      includeLogs: true,
      requireConsistencyPass: false,
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should create and clean up download link in DOM", async () => {
    vi.useFakeTimers();
    const data = baseDataPackage();
    const result = downloadJsonFile(data);
    expect(result.success).toBe(true);

    const linksBefore = document.querySelectorAll("a[download]");
    expect(linksBefore.length).toBe(1);

    vi.advanceTimersByTime(200);

    const linksAfter = document.querySelectorAll("a[download]");
    expect(linksAfter.length).toBe(0);

    vi.useRealTimers();
  });

  it("should handle errors gracefully", () => {
    const originalCreateElement = document.createElement;
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("DOM error");
    });

    const data = baseDataPackage();
    const result = downloadJsonFile(data);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sizeBytes).toBe(0);

    document.createElement = originalCreateElement;
  });
});

describe("jsonExporter - downloadJsonFromSnapshot", () => {
  it("should download from valid JSON snapshot", () => {
    const snapshot = JSON.stringify({ test: "data", value: 123 });
    const result = downloadJsonFromSnapshot(snapshot, "snapshot.json");
    expect(result.success).toBe(true);
    expect(result.fileName).toBe("snapshot.json");
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("should reject empty snapshot", () => {
    const result = downloadJsonFromSnapshot("", "empty.json");
    expect(result.success).toBe(false);
    expect(result.error).toContain("为空");
    expect(result.sizeBytes).toBe(0);
  });

  it("should reject whitespace-only snapshot", () => {
    const result = downloadJsonFromSnapshot("   \t\n  ", "empty.json");
    expect(result.success).toBe(false);
    expect(result.error).toContain("为空");
  });

  it("should handle errors gracefully", () => {
    const originalCreateElement = document.createElement;
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("DOM error");
    });

    const snapshot = JSON.stringify({ test: "data" });
    const result = downloadJsonFromSnapshot(snapshot, "test.json");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    document.createElement = originalCreateElement;
  });
});

describe("jsonExporter - formatFileSize", () => {
  it("should format bytes correctly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("should format kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1024 * 1023)).toBe("1023.0 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.00 MB");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.50 MB");
    expect(formatFileSize(1024 * 1024 * 10)).toBe("10.00 MB");
  });
});
