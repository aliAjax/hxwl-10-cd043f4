import { describe, it, expect } from "vitest";
import { runChronologyInference } from "./chronologyInference";
import type { ArtifactRecord, StratumRelation } from "./types";

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

describe("chronologyInference - Basic Graph Construction", () => {
  it("should handle empty input", () => {
    const report = runChronologyInference([], []);
    expect(report.nodes.length).toBe(0);
    expect(report.directEdges.length).toBe(0);
    expect(report.orderedSequence.length).toBe(0);
    expect(report.cycles.length).toBe(0);
    expect(report.hasInconsistency).toBe(false);
    expect(report.summary.totalNodes).toBe(0);
  });

  it("should create nodes from artifact records", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层" }),
      baseArtifact({ id: 2, stratum: "第2层" }),
      baseArtifact({ id: 3, stratum: "第1层", artifactType: "石器" }),
    ];

    const report = runChronologyInference(artifacts, []);
    expect(report.nodes.length).toBe(2);

    const stratum1 = report.nodes.find(n => n.name === "第1层");
    const stratum2 = report.nodes.find(n => n.name === "第2层");

    expect(stratum1).toBeDefined();
    expect(stratum1?.artifactCount).toBe(2);
    expect(stratum1?.approvedArtifactCount).toBe(2);

    expect(stratum2).toBeDefined();
    expect(stratum2?.artifactCount).toBe(1);
  });

  it("should create nodes from relations", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "第2层" }),
      baseRelation({ id: 2, stratumA: "第2层", stratumB: "第3层" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.nodes.length).toBe(3);
    expect(report.nodes.map(n => n.name).sort()).toEqual(["第1层", "第2层", "第3层"]);
  });

  it("should detect node kind correctly", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层" }),
      baseArtifact({ id: 2, relicUnit: "H1", stratum: "第1层" }),
      baseArtifact({ id: 3, relicUnit: "M2", stratum: "第2层" }),
      baseArtifact({ id: 4, relicUnit: "F1", stratum: "第3层" }),
    ];

    const report = runChronologyInference(artifacts, []);

    const stratum = report.nodes.find(n => n.name === "第1层");
    const h1 = report.nodes.find(n => n.name === "H1");
    const m2 = report.nodes.find(n => n.name === "M2");
    const f1 = report.nodes.find(n => n.name === "F1");

    expect(stratum?.kind).toBe("stratum");
    expect(h1?.kind).toBe("relic_unit");
    expect(m2?.kind).toBe("relic_unit");
    expect(f1?.kind).toBe("relic_unit");
  });
});

describe("chronologyInference - Topological Sorting", () => {
  it("should sort simple linear chain correctly", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "第3层", stratumB: "第2层", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "第2层", stratumB: "第1层", relationType: "earlier" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.hasInconsistency).toBe(false);
    expect(report.cycles.length).toBe(0);

    const order = report.orderedSequence.filter(o => o.layerGroup !== -1);
    expect(order.length).toBe(3);

    const names = order.map(o => o.nodeName);
    expect(names.indexOf("第3层")).toBeLessThan(names.indexOf("第2层"));
    expect(names.indexOf("第2层")).toBeLessThan(names.indexOf("第1层"));
  });

  it("should handle breaks relation correctly (broken is earlier)", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "H1", stratumB: "第2层", relationType: "breaks" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.hasInconsistency).toBe(false);

    const order = report.orderedSequence.filter(o => o.layerGroup !== -1);
    const h1 = order.find(o => o.nodeName === "H1");
    const s2 = order.find(o => o.nodeName === "第2层");

    expect(s2?.layerGroup).toBeLessThan(h1?.layerGroup ?? 999);
  });

  it("should handle contains relation correctly", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "H1", relationType: "contains" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.hasInconsistency).toBe(false);

    const order = report.orderedSequence.filter(o => o.layerGroup !== -1);
    const h1 = order.find(o => o.nodeName === "H1");
    const s1 = order.find(o => o.nodeName === "第1层");

    expect(h1?.layerGroup).toBeLessThan(s1?.layerGroup ?? 999);
  });

  it("should generate inferred edges for transitive relations", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "C", relationType: "earlier" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.inferredEdges.length).toBeGreaterThan(0);

    const hasInferredAToC = report.inferredEdges.some(
      e => e.sourceKey === "A" && e.targetKey === "C"
    );
    expect(hasInferredAToC).toBe(true);
  });

  it("should calculate totalLayers correctly", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "D", stratumB: "C", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "C", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 3, stratumA: "B", stratumB: "A", relationType: "earlier" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.totalLayers).toBe(4);
  });
});

describe("chronologyInference - Cycle Detection", () => {
  it("should detect simple cycle", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "C", relationType: "earlier" }),
      baseRelation({ id: 3, stratumA: "C", stratumB: "A", relationType: "earlier" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.hasInconsistency).toBe(true);
    expect(report.cycles.length).toBeGreaterThan(0);
    expect(report.summary.cycleCount).toBeGreaterThan(0);
    expect(report.summary.criticalRiskCount).toBeGreaterThan(0);
  });

  it("should detect mutual breaks as cycle", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "breaks" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "A", relationType: "breaks" }),
    ];

    const report = runChronologyInference([], relations);
    expect(report.hasInconsistency).toBe(true);
    expect(report.cycles.length).toBeGreaterThan(0);
  });

  it("should mark cyclic nodes with isUncertain=true and rank=-1", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "A", relationType: "earlier" }),
    ];

    const report = runChronologyInference([], relations);
    const cyclicNodes = report.orderedSequence.filter(o => o.layerGroup === -1);

    expect(cyclicNodes.length).toBe(2);
    expect(cyclicNodes.every(o => o.isUncertain)).toBe(true);
    expect(cyclicNodes.every(o => o.rank === -1)).toBe(true);
    expect(cyclicNodes.map(o => o.nodeName).sort()).toEqual(["A", "B"]);
  });
});

describe("chronologyInference - Naming Conflicts", () => {
  it("should detect cross-trench naming conflicts", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01", stratum: "第1层" }),
      baseArtifact({ id: 2, trenchNumber: "T02", stratum: "第1层" }),
    ];

    const report = runChronologyInference(artifacts, []);
    expect(report.namingConflicts.length).toBe(1);
    expect(report.summary.namingConflictCount).toBe(1);
  });

  it("should not report conflict for same trench", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01", stratum: "第1层" }),
      baseArtifact({ id: 2, trenchNumber: "T01", stratum: "第1层" }),
    ];

    const report = runChronologyInference(artifacts, []);
    expect(report.namingConflicts.length).toBe(0);
  });

  it("should detect conflicts for relic units too", () => {
    const artifacts = [
      baseArtifact({ id: 1, trenchNumber: "T01", relicUnit: "H1", stratum: "第1层" }),
      baseArtifact({ id: 2, trenchNumber: "T02", relicUnit: "H1", stratum: "第2层" }),
    ];

    const report = runChronologyInference(artifacts, []);
    expect(report.namingConflicts.some(nc => nc.name.includes("H1"))).toBe(true);
  });
});

describe("chronologyInference - Risk Assessment", () => {
  it("should identify unreviewed records in nodes", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层", status: "pending" }),
      baseArtifact({ id: 2, stratum: "第1层", status: "approved" }),
    ];

    const report = runChronologyInference(artifacts, []);
    const unreviewedRisks = report.risks.filter(r => r.type === "unreviewed_in_chain");

    expect(unreviewedRisks.length).toBe(1);
    expect(unreviewedRisks[0].level).toBe("warning");
    expect(unreviewedRisks[0].nodeName).toBe("第1层");
  });

  it("should identify orphan nodes with artifacts but no relations", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层" }),
    ];
    const relations = [
      baseRelation({ id: 1, stratumA: "第2层", stratumB: "第3层" }),
    ];

    const report = runChronologyInference(artifacts, relations);
    const orphanRisks = report.risks.filter(r => r.type === "orphan_node");

    expect(orphanRisks.length).toBe(1);
    expect(orphanRisks[0].level).toBe("info");
    expect(orphanRisks[0].nodeName).toBe("第1层");
  });

  it("should not report orphan nodes when there are no relations", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层" }),
      baseArtifact({ id: 2, stratum: "第2层" }),
    ];

    const report = runChronologyInference(artifacts, []);
    const orphanRisks = report.risks.filter(r => r.type === "orphan_node");
    expect(orphanRisks.length).toBe(0);
  });

  it("should report inferred relations risk", () => {
    const relations = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "C", relationType: "earlier" }),
      baseRelation({ id: 3, stratumA: "C", stratumB: "D", relationType: "earlier" }),
    ];

    const report = runChronologyInference([], relations);
    const inferredRisks = report.risks.filter(r => r.type === "inferred_relation");

    expect(inferredRisks.length).toBeGreaterThan(0);
  });
});

describe("chronologyInference - Weak Relations", () => {
  it("should add weak relations from artifact co-occurrence", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层", relicUnit: "H1" }),
      baseArtifact({ id: 2, stratum: "第1层", relicUnit: "H1" }),
    ];

    const report = runChronologyInference(artifacts, []);
    expect(report.summary.totalWeakRelations).toBe(1);

    const weakEdges = report.directEdges.filter(e => e.id.startsWith("edge-weak-"));
    expect(weakEdges.length).toBe(1);
    expect(weakEdges[0].isDirect).toBe(false);
    expect(weakEdges[0].isInferred).toBe(false);
  });

  it("should not add weak relation if direct relation exists", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层", relicUnit: "H1" }),
    ];
    const relations = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "H1", relationType: "contains" }),
    ];

    const report = runChronologyInference(artifacts, relations);
    expect(report.summary.totalWeakRelations).toBe(0);
  });
});

describe("chronologyInference - Summary Statistics", () => {
  it("should calculate correct summary counts", () => {
    const artifacts = [
      baseArtifact({ id: 1, stratum: "第1层", status: "approved" }),
      baseArtifact({ id: 2, stratum: "第2层", status: "pending" }),
      baseArtifact({ id: 3, stratum: "第2层", status: "rejected" }),
      baseArtifact({ id: 4, stratum: "第2层", relicUnit: "H1", status: "approved" }),
    ];
    const relations = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "第2层", relationType: "earlier" }),
    ];

    const report = runChronologyInference(artifacts, relations);

    expect(report.summary.totalNodes).toBe(3);
    expect(report.summary.totalDirectRelations).toBe(1);
    expect(report.summary.totalWeakRelations).toBe(1);
    expect(report.summary.unreviewedNodeCount).toBe(1);
    expect(report.summary.riskCount).toBeGreaterThan(0);
  });
});
