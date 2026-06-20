import { describe, it, expect } from "vitest";
import { computeMetrics, summarizeTrenches, collectExportData } from "./dataCollector";
import type { DataCollectionInput, ConsistencyReport } from "./types";
import type { ArtifactRecord, StratumRelation, ExcavationLog } from "../types";

const baseArtifact = (overrides: Partial<ArtifactRecord> = {}): ArtifactRecord => ({
  id: 1,
  trenchNumber: "T0101",
  stratum: "第1层",
  artifactType: "陶片",
  eCoordinate: "E123.45m",
  nCoordinate: "N67.89m",
  depth: "0.5m",
  remarks: "",
  createdAt: new Date().toISOString(),
  status: "approved",
  ...overrides,
});

const baseRelation = (overrides: Partial<StratumRelation> = {}): StratumRelation => ({
  id: 1,
  stratumA: "第1层",
  stratumB: "第2层",
  relationType: "earlier",
  createdAt: new Date().toISOString(),
  ...overrides,
});

const baseLog = (overrides: Partial<ExcavationLog> = {}): ExcavationLog => ({
  id: 1,
  date: "2024-01-01",
  weather: "晴",
  participants: "张三、李四",
  excavationArea: "T0101",
  mainFindings: "出土陶片若干",
  pendingReview: "",
  createdAt: new Date().toISOString(),
  ...overrides,
});

const baseInput = (
  artifacts: ArtifactRecord[] = [],
  relations: StratumRelation[] = [],
  logs: ExcavationLog[] = []
): DataCollectionInput => ({
  project: {
    id: "proj-001",
    title: "测试考古项目",
    subtitle: "测试副标题",
    domain: "考古",
    metrics: ["探方数", "出土物总数"],
    filters: ["探方", "地层"],
  },
  searchFilters: { trenchNumber: "", stratum: "", relicUnit: "", artifactKeyword: "" },
  hasActiveFilters: false,
  artifactRecords: artifacts,
  stratumRelations: relations,
  excavationLogs: logs,
});

const baseConsistencyReport = (): ConsistencyReport => ({
  generatedAt: new Date().toISOString(),
  blockingCount: 0,
  warningCount: 0,
  issues: [],
  isExportable: true,
});

describe("dataCollector - computeMetrics", () => {
  it("should return zero metrics for empty input", () => {
    const input = baseInput();
    const metrics = computeMetrics(input);

    expect(metrics.trenchCount).toBe(0);
    expect(metrics.stratumCount).toBe(0);
    expect(metrics.artifactCount).toBe(0);
    expect(metrics.pendingReviewCount).toBe(0);
    expect(metrics.approvedCount).toBe(0);
    expect(metrics.rejectedCount).toBe(0);
    expect(metrics.archivedCount).toBe(0);
    expect(metrics.relationCount).toBe(0);
    expect(metrics.logCount).toBe(0);
  });

  it("should count unique trenches correctly", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01" }),
      baseArtifact({ id: 2, trenchNumber: "T01" }),
      baseArtifact({ id: 3, trenchNumber: "T02" }),
      baseArtifact({ id: 4, trenchNumber: "T03" }),
    ];
    const input = baseInput(artifacts);
    const metrics = computeMetrics(input);

    expect(metrics.trenchCount).toBe(3);
  });

  it("should trim whitespace from trench numbers when counting", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01" }),
      baseArtifact({ id: 2, trenchNumber: "  T01  " }),
      baseArtifact({ id: 3, trenchNumber: "\tT01\n" }),
    ];
    const input = baseInput(artifacts);
    const metrics = computeMetrics(input);

    expect(metrics.trenchCount).toBe(1);
  });

  it("should count unique strata from both artifacts and relations", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层" }),
      baseArtifact({ id: 2, stratum: "第2层" }),
    ];
    const relations = [
      baseRelation({ id: 1, stratumA: "第2层", stratumB: "第3层" }),
    ];
    const input = baseInput(artifacts, relations);
    const metrics = computeMetrics(input);

    expect(metrics.stratumCount).toBe(3);
  });

  it("should count artifacts by status correctly", () => {
    const artifacts = [
      baseArtifact({ id: 1, status: "approved" }),
      baseArtifact({ id: 2, status: "approved" }),
      baseArtifact({ id: 3, status: "pending" }),
      baseArtifact({ id: 4, status: "rejected" }),
      baseArtifact({ id: 5, status: "archived" }),
    ];
    const input = baseInput(artifacts);
    const metrics = computeMetrics(input);

    expect(metrics.artifactCount).toBe(5);
    expect(metrics.approvedCount).toBe(2);
    expect(metrics.pendingReviewCount).toBe(1);
    expect(metrics.rejectedCount).toBe(1);
    expect(metrics.archivedCount).toBe(1);
  });

  it("should count relations and logs", () => {
    const relations = [baseRelation({ id: 1 }), baseRelation({ id: 2 })];
    const logs = [baseLog({ id: 1 }), baseLog({ id: 2 }), baseLog({ id: 3 })];
    const input = baseInput([], relations, logs);
    const metrics = computeMetrics(input);

    expect(metrics.relationCount).toBe(2);
    expect(metrics.logCount).toBe(3);
  });

  it("should preserve project metrics and filter labels", () => {
    const input = baseInput();
    const metrics = computeMetrics(input);

    expect(metrics.metricsLabels).toEqual(["探方数", "出土物总数"]);
    expect(metrics.filterLabels).toEqual(["探方", "地层"]);
  });
});

describe("dataCollector - summarizeTrenches", () => {
  it("should return empty array for no records", () => {
    const result = summarizeTrenches([]);
    expect(result).toEqual([]);
  });

  it("should group records by trench", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01", stratum: "第1层", artifactType: "陶片" }),
      baseArtifact({ id: 2, trenchNumber: "T01", stratum: "第2层", artifactType: "石器" }),
      baseArtifact({ id: 3, trenchNumber: "T02", stratum: "第1层", artifactType: "陶片" }),
    ];

    const result = summarizeTrenches(artifacts);
    expect(result.length).toBe(2);

    const t01 = result.find(t => t.trenchNumber === "T01")!;
    const t02 = result.find(t => t.trenchNumber === "T02")!;

    expect(t01.artifactCount).toBe(2);
    expect(t01.strata).toEqual(["第1层", "第2层"]);
    expect(t01.artifactTypes).toEqual(["陶片", "石器"]);

    expect(t02.artifactCount).toBe(1);
    expect(t02.strata).toEqual(["第1层"]);
    expect(t02.artifactTypes).toEqual(["陶片"]);
  });

  it("should handle empty trench numbers", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "" }),
      baseArtifact({ id: 2, trenchNumber: "   " }),
    ];

    const result = summarizeTrenches(artifacts);
    expect(result.length).toBe(1);
    expect(result[0].trenchNumber).toBe("(未填写探方)");
    expect(result[0].artifactCount).toBe(2);
  });

  it("should not duplicate strata or artifact types", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01", stratum: "第1层", artifactType: "陶片" }),
      baseArtifact({ id: 2, trenchNumber: "T01", stratum: "第1层", artifactType: "陶片" }),
      baseArtifact({ id: 3, trenchNumber: "T01", stratum: "第1层", artifactType: "石器" }),
    ];

    const result = summarizeTrenches(artifacts);
    const t01 = result[0];

    expect(t01.strata).toEqual(["第1层"]);
    expect(t01.artifactTypes).toEqual(["陶片", "石器"]);
  });

  it("should sort trenches by name in Chinese", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T02" }),
      baseArtifact({ id: 2, trenchNumber: "T01" }),
      baseArtifact({ id: 3, trenchNumber: "T10" }),
    ];

    const result = summarizeTrenches(artifacts);
    expect(result.map(t => t.trenchNumber)).toEqual(["T01", "T02", "T10"]);
  });
});

describe("dataCollector - collectExportData", () => {
  it("should build complete data package structure", () => {
    const input = baseInput();
    const report = baseConsistencyReport();
    const result = collectExportData(input, report);

    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.projectInfo.id).toBe("proj-001");
    expect(result.projectInfo.title).toBe("测试考古项目");
    expect(result.projectInfo.domain).toBe("考古");
    expect(result.projectInfo.exportedAt).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.filters).toBeDefined();
    expect(result.trenchRecords).toBeDefined();
    expect(result.stratumRelations).toEqual([]);
    expect(result.artifacts).toEqual([]);
    expect(result.excavationLogs).toEqual([]);
    expect(result.consistencyReport).toBe(report);
  });

  it("should include logs by default", () => {
    const logs = [baseLog({ id: 1 }), baseLog({ id: 2 })];
    const input = baseInput([], [], logs);
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.excavationLogs.length).toBe(2);
  });

  it("should exclude logs when includeLogs is false", () => {
    const logs = [baseLog({ id: 1 }), baseLog({ id: 2 })];
    const input = baseInput([], [], logs);
    const result = collectExportData(input, baseConsistencyReport(), { includeLogs: false });

    expect(result.excavationLogs).toEqual([]);
  });

  it("should set exporter from currentUser if available", () => {
    const input = {
      ...baseInput(),
      currentUser: "考古队员张三",
      currentRole: "excavator",
    };
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.projectInfo.exporter).toBe("考古队员张三");
  });

  it("should set exporter from currentRole if currentUser not available", () => {
    const input = {
      ...baseInput(),
      currentRole: "leader",
    };
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.projectInfo.exporter).toBe("leader");
  });

  it("should include all artifacts and relations", () => {
    const artifacts = [
      baseArtifact({ id: 1 }),
      baseArtifact({ id: 2 }),
      baseArtifact({ id: 3 }),
    ];
    const relations = [
      baseRelation({ id: 1 }),
      baseRelation({ id: 2 }),
    ];
    const input = baseInput(artifacts, relations);
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.artifacts.length).toBe(3);
    expect(result.stratumRelations.length).toBe(2);
  });

  it("should include search filter information", () => {
    const input = {
      ...baseInput(),
      searchFilters: {
        trenchNumber: "T01",
        stratum: "第2层",
        relicUnit: "H1",
        artifactKeyword: "陶",
      },
      hasActiveFilters: true,
    };
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.filters.searchFilters.trenchNumber).toBe("T01");
    expect(result.filters.searchFilters.stratum).toBe("第2层");
    expect(result.filters.hasActiveFilters).toBe(true);
  });

  it("should set exportedAt timestamp", () => {
    const before = new Date();
    const result = collectExportData(baseInput(), baseConsistencyReport());
    const after = new Date();

    const exportedAt = new Date(result.projectInfo.exportedAt);
    expect(exportedAt >= before).toBe(true);
    expect(exportedAt <= after).toBe(true);
  });

  it("should include trench summaries in data package", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01", stratum: "第1层" }),
      baseArtifact({ id: 2, trenchNumber: "T02", stratum: "第2层" }),
    ];
    const input = baseInput(artifacts);
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.trenchRecords.length).toBe(2);
    expect(result.trenchRecords[0].trenchNumber).toBe("T01");
    expect(result.trenchRecords[1].trenchNumber).toBe("T02");
  });

  it("should include computed metrics in data package", () => {
    const artifacts = [
      baseArtifact({ id: 1, status: "approved" }),
      baseArtifact({ id: 2, status: "pending" }),
    ];
    const input = baseInput(artifacts);
    const result = collectExportData(input, baseConsistencyReport());

    expect(result.metrics.artifactCount).toBe(2);
    expect(result.metrics.approvedCount).toBe(1);
    expect(result.metrics.pendingReviewCount).toBe(1);
  });
});
