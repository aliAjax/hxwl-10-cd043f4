import { describe, it, expect } from "vitest";
import {
  isValidCoordinateFormat,
  parseNumber,
  parseCoordinatePoint,
  validateRecordCoordinates,
  isFieldEmpty,
  getMissingRequiredFields,
  checkStratumRelationConflict,
  checkAllStratumRelationConflicts,
  REQUIRED_FIELDS,
  FIELD_LABELS,
  VALIDATION_RULE_REGISTRY,
} from "./domainValidators";
import type { ArtifactRecord, StratumRelation } from "./types";

describe("domainValidators - Coordinate Validation", () => {
  describe("isValidCoordinateFormat", () => {
    it("should return invalid for empty string", () => {
      const result = isValidCoordinateFormat("");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("坐标为空");
      expect(result.extracted).toBeNull();
    });

    it("should return invalid for whitespace only", () => {
      const result = isValidCoordinateFormat("   \t  \n  ");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("坐标为空");
    });

    it("should return invalid for string without numbers", () => {
      const result = isValidCoordinateFormat("abc");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("未找到有效数字");
    });

    it("should return invalid for negative numbers", () => {
      const result = isValidCoordinateFormat("-10.5");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("坐标不能为负数");
    });

    it("should return invalid for unknown prefix", () => {
      const result = isValidCoordinateFormat("X123.45");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("前缀");
    });

    it("should return invalid for unknown suffix", () => {
      const result = isValidCoordinateFormat("123.45公里");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("后缀");
    });

    it("should be valid for plain number", () => {
      const result = isValidCoordinateFormat("123.45");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(123.45);
    });

    it("should be valid for E prefix with m suffix", () => {
      const result = isValidCoordinateFormat("E123.45m");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(123.45);
    });

    it("should be valid for N prefix without suffix", () => {
      const result = isValidCoordinateFormat("N99");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(99);
    });

    it("should be valid for Chinese prefix and unit", () => {
      const result = isValidCoordinateFormat("东123.45米");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(123.45);
    });

    it("should be valid for cm unit", () => {
      const result = isValidCoordinateFormat("150cm");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(150);
    });

    it("should be valid for mm unit", () => {
      const result = isValidCoordinateFormat("1500mm");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(1500);
    });

    it("should be valid for Chinese 毫米 unit", () => {
      const result = isValidCoordinateFormat("1500毫米");
      expect(result.valid).toBe(true);
      expect(result.extracted).toBe(1500);
    });

    it("should be valid for W and S prefixes", () => {
      expect(isValidCoordinateFormat("W100m").valid).toBe(true);
      expect(isValidCoordinateFormat("S200m").valid).toBe(true);
      expect(isValidCoordinateFormat("西50米").valid).toBe(true);
      expect(isValidCoordinateFormat("南75米").valid).toBe(true);
    });
  });

  describe("parseNumber", () => {
    it("should parse valid numbers", () => {
      expect(parseNumber("123")).toBe(123);
      expect(parseNumber("123.45")).toBe(123.45);
      expect(parseNumber("-10.5")).toBe(-10.5);
    });

    it("should extract numbers from mixed strings", () => {
      expect(parseNumber("E123.45m")).toBe(123.45);
      expect(parseNumber("N67.89")).toBe(67.89);
    });

    it("should return null for empty string", () => {
      expect(parseNumber("")).toBeNull();
      expect(parseNumber("   ")).toBeNull();
    });

    it("should return null for non-numeric strings", () => {
      expect(parseNumber("abc")).toBeNull();
    });
  });

  describe("parseCoordinatePoint", () => {
    it("should parse E N format", () => {
      const result = parseCoordinatePoint("E3.25 N4.50");
      expect(result.eCoordinate).toBe("3.25");
      expect(result.nCoordinate).toBe("4.50");
    });

    it("should parse comma-separated format", () => {
      const result = parseCoordinatePoint("123.45, 67.89");
      expect(result.eCoordinate).toBe("123.45");
      expect(result.nCoordinate).toBe("67.89");
    });

    it("should parse space-separated format", () => {
      const result = parseCoordinatePoint("123.45 67.89");
      expect(result.eCoordinate).toBe("123.45");
      expect(result.nCoordinate).toBe("67.89");
    });

    it("should parse Chinese separator format", () => {
      const result = parseCoordinatePoint("123.45，67.89");
      expect(result.eCoordinate).toBe("123.45");
      expect(result.nCoordinate).toBe("67.89");
    });

    it("should return empty for unparseable format", () => {
      const result = parseCoordinatePoint("invalid");
      expect(result.eCoordinate).toBe("");
      expect(result.nCoordinate).toBe("");
    });

    it("should handle uppercase letters", () => {
      const result = parseCoordinatePoint("E100 N200");
      expect(result.eCoordinate).toBe("100");
      expect(result.nCoordinate).toBe("200");
    });
  });

  describe("validateRecordCoordinates", () => {
    const baseRecord = (): ArtifactRecord => ({
      id: 1,
      trenchNumber: "T0101",
      stratum: "第1层",
      artifactType: "陶片",
      eCoordinate: "",
      nCoordinate: "",
      depth: "0.5m",
      remarks: "",
      createdAt: new Date().toISOString(),
      status: "approved",
    });

    it("should detect both coordinates empty", () => {
      const record = baseRecord();
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("E和N坐标均为空");
    });

    it("should detect E coordinate empty", () => {
      const record = { ...baseRecord(), nCoordinate: "N100m" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("E坐标为空");
    });

    it("should detect N coordinate empty", () => {
      const record = { ...baseRecord(), eCoordinate: "E100m" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("N坐标为空");
    });

    it("should detect both coordinates invalid format", () => {
      const record = { ...baseRecord(), eCoordinate: "Xabc", nCoordinate: "Yxyz" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("E坐标");
      expect(result.coordinateError).toContain("N坐标");
    });

    it("should detect only E coordinate invalid", () => {
      const record = { ...baseRecord(), eCoordinate: "Xabc", nCoordinate: "N100m" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("E坐标");
    });

    it("should detect only N coordinate invalid", () => {
      const record = { ...baseRecord(), eCoordinate: "E100m", nCoordinate: "Yxyz" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("N坐标");
    });

    it("should detect negative coordinates", () => {
      const record = { ...baseRecord(), eCoordinate: "-10", nCoordinate: "100" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(false);
      expect(result.coordinateError).toContain("负数");
    });

    it("should pass valid coordinates", () => {
      const record = { ...baseRecord(), eCoordinate: "E123.45m", nCoordinate: "N67.89米" };
      const result = validateRecordCoordinates(record);
      expect(result.isCoordinateValid).toBe(true);
      expect(result.eValue).toBe(123.45);
      expect(result.nValue).toBe(67.89);
      expect(result.coordinateError).toBeUndefined();
    });

    it("should preserve original record fields", () => {
      const record = { ...baseRecord(), trenchNumber: "T999", artifactType: "青铜器" };
      const result = validateRecordCoordinates(record);
      expect(result.trenchNumber).toBe("T999");
      expect(result.artifactType).toBe("青铜器");
      expect(result.id).toBe(1);
    });
  });
});

describe("domainValidators - Field Validation", () => {
  const baseRecord = (): ArtifactRecord => ({
    id: 1,
    trenchNumber: "T0101",
    stratum: "第1层",
    artifactType: "陶片",
    eCoordinate: "E100m",
    nCoordinate: "N200m",
    depth: "0.5m",
    quantity: "1",
    relicUnit: "H1",
    remarks: "",
    createdAt: new Date().toISOString(),
    status: "approved",
  });

  describe("isFieldEmpty", () => {
    it("should return true for empty string", () => {
      const record = { ...baseRecord(), trenchNumber: "" };
      expect(isFieldEmpty(record, "trenchNumber")).toBe(true);
    });

    it("should return true for whitespace only", () => {
      const record = { ...baseRecord(), trenchNumber: "   \t  " };
      expect(isFieldEmpty(record, "trenchNumber")).toBe(true);
    });

    it("should return false for non-empty string", () => {
      const record = { ...baseRecord(), trenchNumber: "T0101" };
      expect(isFieldEmpty(record, "trenchNumber")).toBe(false);
    });
  });

  describe("getMissingRequiredFields", () => {
    it("should return empty array when all required fields present", () => {
      const record = baseRecord();
      const missing = getMissingRequiredFields(record);
      expect(missing).toEqual([]);
    });

    it("should return missing trenchNumber", () => {
      const record = { ...baseRecord(), trenchNumber: "" };
      const missing = getMissingRequiredFields(record);
      expect(missing).toContain("trenchNumber");
    });

    it("should return missing stratum", () => {
      const record = { ...baseRecord(), stratum: "   " };
      const missing = getMissingRequiredFields(record);
      expect(missing).toContain("stratum");
    });

    it("should return multiple missing fields", () => {
      const record = { ...baseRecord(), trenchNumber: "", stratum: "", eCoordinate: "" };
      const missing = getMissingRequiredFields(record);
      expect(missing).toContain("trenchNumber");
      expect(missing).toContain("stratum");
      expect(missing).toContain("eCoordinate");
    });

    it("should not include non-required fields", () => {
      const record = { ...baseRecord(), quantity: "", relicUnit: "" };
      const missing = getMissingRequiredFields(record);
      expect(missing).not.toContain("quantity");
      expect(missing).not.toContain("relicUnit");
    });
  });

  describe("REQUIRED_FIELDS", () => {
    it("should contain all expected required fields", () => {
      expect(REQUIRED_FIELDS).toContain("trenchNumber");
      expect(REQUIRED_FIELDS).toContain("stratum");
      expect(REQUIRED_FIELDS).toContain("artifactType");
      expect(REQUIRED_FIELDS).toContain("eCoordinate");
      expect(REQUIRED_FIELDS).toContain("nCoordinate");
      expect(REQUIRED_FIELDS).toContain("depth");
    });
  });

  describe("FIELD_LABELS", () => {
    it("should have Chinese labels for all required fields", () => {
      expect(FIELD_LABELS.trenchNumber).toBe("探方编号");
      expect(FIELD_LABELS.stratum).toBe("地层");
      expect(FIELD_LABELS.artifactType).toBe("出土物类型");
      expect(FIELD_LABELS.eCoordinate).toBe("E坐标");
      expect(FIELD_LABELS.nCoordinate).toBe("N坐标");
      expect(FIELD_LABELS.depth).toBe("深度");
    });
  });
});

describe("domainValidators - Stratum Relation Conflict Detection", () => {
  const baseRelations = (): StratumRelation[] => [
    { id: 1, stratumA: "第1层", stratumB: "第2层", relationType: "earlier", createdAt: "2024-01-01" },
  ];

  describe("checkStratumRelationConflict", () => {
    it("should detect self-reference", () => {
      const result = checkStratumRelationConflict("第1层", "第1层", "earlier", []);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictKind).toBe("stratum_self_reference");
    });

    it("should detect duplicate relation", () => {
      const relations = baseRelations();
      const result = checkStratumRelationConflict("第1层", "第2层", "earlier", relations);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictKind).toBe("stratum_duplicate_relation");
    });

    it("should detect mutual earlier", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "第1层", stratumB: "第2层", relationType: "earlier", createdAt: "2024-01-01" },
      ];
      const result = checkStratumRelationConflict("第2层", "第1层", "earlier", relations);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictKind).toBe("stratum_mutual_earlier");
    });

    it("should detect mutual breaks", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "H1", stratumB: "第2层", relationType: "breaks", createdAt: "2024-01-01" },
      ];
      const result = checkStratumRelationConflict("第2层", "H1", "breaks", relations);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictKind).toBe("stratum_mutual_breaks");
    });

    it("should detect mutual contains", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "第1层", stratumB: "H1", relationType: "contains", createdAt: "2024-01-01" },
      ];
      const result = checkStratumRelationConflict("H1", "第1层", "contains", relations);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictKind).toBe("stratum_mutual_contains");
    });

    it("should detect breaks vs earlier contradiction", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "H1", stratumB: "第2层", relationType: "breaks", createdAt: "2024-01-01" },
      ];
      const result = checkStratumRelationConflict("H1", "第2层", "earlier", relations);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictKind).toBe("stratum_breaks_vs_earlier");
    });

    it("should return no conflict for valid new relation", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "第1层", stratumB: "第2层", relationType: "earlier", createdAt: "2024-01-01" },
      ];
      const result = checkStratumRelationConflict("第2层", "第3层", "earlier", relations);
      expect(result.hasConflict).toBe(false);
    });
  });

  describe("checkAllStratumRelationConflicts", () => {
    it("should detect self-reference", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "第1层", stratumB: "第1层", relationType: "earlier", createdAt: "2024-01-01" },
      ];
      const conflicts = checkAllStratumRelationConflicts(relations);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictKind).toBe("stratum_self_reference");
    });

    it("should detect duplicate relation", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "A", stratumB: "B", relationType: "earlier", createdAt: "2024-01-01" },
        { id: 2, stratumA: "A", stratumB: "B", relationType: "earlier", createdAt: "2024-01-01" },
      ];
      const conflicts = checkAllStratumRelationConflicts(relations);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictKind).toBe("stratum_duplicate_relation");
    });

    it("should detect multiple conflicts", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "A", stratumB: "A", relationType: "earlier", createdAt: "2024-01-01" },
        { id: 2, stratumA: "B", stratumB: "C", relationType: "earlier", createdAt: "2024-01-01" },
        { id: 3, stratumA: "C", stratumB: "B", relationType: "earlier", createdAt: "2024-01-01" },
      ];
      const conflicts = checkAllStratumRelationConflicts(relations);
      expect(conflicts.length).toBe(2);
    });

    it("should return empty array for no conflicts", () => {
      const relations: StratumRelation[] = [
        { id: 1, stratumA: "A", stratumB: "B", relationType: "earlier", createdAt: "2024-01-01" },
        { id: 2, stratumA: "B", stratumB: "C", relationType: "breaks", createdAt: "2024-01-01" },
        { id: 3, stratumA: "C", stratumB: "D", relationType: "contains", createdAt: "2024-01-01" },
      ];
      const conflicts = checkAllStratumRelationConflicts(relations);
      expect(conflicts.length).toBe(0);
    });
  });
});

describe("domainValidators - Validation Rule Registry", () => {
  it("should have all expected rules registered", () => {
    const ruleIds = VALIDATION_RULE_REGISTRY.map(r => r.ruleId);
    expect(ruleIds).toContain("coord_format");
    expect(ruleIds).toContain("coord_empty");
    expect(ruleIds).toContain("field_missing");
    expect(ruleIds).toContain("stratum_self_reference");
    expect(ruleIds).toContain("stratum_duplicate_relation");
    expect(ruleIds).toContain("stratum_mutual_earlier");
    expect(ruleIds).toContain("stratum_mutual_breaks");
    expect(ruleIds).toContain("stratum_mutual_contains");
    expect(ruleIds).toContain("stratum_breaks_vs_earlier");
  });

  it("should have valid contexts for each rule", () => {
    VALIDATION_RULE_REGISTRY.forEach(rule => {
      expect(rule.contexts.length).toBeGreaterThan(0);
      rule.contexts.forEach(ctx => {
        expect(["entry_hint", "export_blocking", "overview_risk"]).toContain(ctx);
      });
    });
  });

  it("should have non-empty descriptions", () => {
    VALIDATION_RULE_REGISTRY.forEach(rule => {
      expect(rule.description.length).toBeGreaterThan(0);
    });
  });
});
