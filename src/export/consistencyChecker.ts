import type {
  ArtifactRecord,
  StratumRelation,
  RelationType,
} from "../App";
import type {
  ConsistencyIssue,
  ConsistencyReport,
  DataCollectionInput,
  IssueCategory,
  IssueSeverity,
} from "./types";

const COORD_PREFIXES = new Set(["e", "n", "w", "s", "东", "北", "西", "南"]);
const COORD_SUFFIXES = new Set(["m", "cm", "mm", "米", "厘米", "毫米"]);

const isValidCoordinateFormat = (
  value: string
): { valid: boolean; reason?: string } => {
  if (!value || value.trim() === "") {
    return { valid: false, reason: "坐标为空" };
  }
  const clean = value.trim();
  const numMatch = clean.match(/-?\d+(\.\d+)?/);
  if (!numMatch) {
    return { valid: false, reason: "未找到有效数字" };
  }
  const numStr = numMatch[0];
  const num = parseFloat(numStr);
  if (isNaN(num)) return { valid: false, reason: "数字解析失败" };
  const numStart = numMatch.index || 0;
  const numEnd = numStart + numStr.length;
  const prefix = clean.slice(0, numStart).trim().toLowerCase();
  const suffix = clean.slice(numEnd).trim().toLowerCase();

  if (prefix && !COORD_PREFIXES.has(prefix)) {
    return { valid: false, reason: `前缀"${prefix}"不是有效的坐标标识` };
  }
  if (suffix && !COORD_SUFFIXES.has(suffix)) {
    return { valid: false, reason: `后缀"${suffix}"不是有效的单位标识` };
  }
  if (num < 0) {
    return { valid: false, reason: "坐标不能为负数" };
  }
  return { valid: true };
};

const relationLabelMap: Record<RelationType, string> = {
  earlier: "早于",
  breaks: "打破",
  contains: "包含",
};

const createIssue = (
  base: Omit<ConsistencyIssue, "id">
): ConsistencyIssue => {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    ...base,
    id: `${base.category}-${base.recordId ?? base.trenchNumber ?? base.stratumName ?? "gen"}-${ts}-${rand}`,
  };
};

const checkTrenchNumbers = (
  records: ArtifactRecord[],
  issues: ConsistencyIssue[]
): void => {
  records.forEach((record) => {
    if (!record.trenchNumber || record.trenchNumber.trim() === "") {
      issues.push(
        createIssue({
          severity: "blocking",
          category: "missing_trench_number",
          message: `记录 #${record.id} 缺失探方编号`,
          recordId: record.id,
          details: { artifactType: record.artifactType, stratum: record.stratum },
        })
      );
    }
  });
};

const checkCoordinates = (
  records: ArtifactRecord[],
  issues: ConsistencyIssue[]
): void => {
  records.forEach((record) => {
    const eCheck = isValidCoordinateFormat(record.eCoordinate);
    const nCheck = isValidCoordinateFormat(record.nCoordinate);

    const eEmpty = !record.eCoordinate || record.eCoordinate.trim() === "";
    const nEmpty = !record.nCoordinate || record.nCoordinate.trim() === "";

    let message = "";
    let category: IssueCategory = "invalid_coordinate";

    if (eEmpty && nEmpty) {
      message = `记录 #${record.id} 的E和N坐标均为空`;
    } else if (eEmpty) {
      message = `记录 #${record.id} 的E坐标为空`;
    } else if (nEmpty) {
      message = `记录 #${record.id} 的N坐标为空`;
    } else if (!eCheck.valid && !nCheck.valid) {
      message = `记录 #${record.id} 坐标格式异常：E坐标${eCheck.reason}，N坐标${nCheck.reason}`;
    } else if (!eCheck.valid) {
      message = `记录 #${record.id} 坐标格式异常：E坐标${eCheck.reason}`;
    } else if (!nCheck.valid) {
      message = `记录 #${record.id} 坐标格式异常：N坐标${nCheck.reason}`;
    }

    if (message) {
      issues.push(
        createIssue({
          severity: "blocking",
          category,
          message,
          recordId: record.id,
          trenchNumber: record.trenchNumber,
          details: {
            eCoordinate: record.eCoordinate,
            nCoordinate: record.nCoordinate,
          },
        })
      );
    }
  });
};

const checkStratumRelations = (
  relations: StratumRelation[],
  issues: ConsistencyIssue[]
): void => {
  for (let i = 0; i < relations.length; i++) {
    const r1 = relations[i];

    if (r1.stratumA === r1.stratumB) {
      issues.push(
        createIssue({
          severity: "blocking",
          category: "stratum_relation_conflict",
          message: `关系 #${r1.id} 地层A与地层B相同（"${r1.stratumA}"）`,
          stratumName: r1.stratumA,
          details: { relationId: r1.id, relationType: r1.relationType },
        })
      );
    }

    for (let j = i + 1; j < relations.length; j++) {
      const r2 = relations[j];

      const r1Label = `"${r1.stratumA}" ${relationLabelMap[r1.relationType]} "${r1.stratumB}"`;
      const r2Label = `"${r2.stratumA}" ${relationLabelMap[r2.relationType]} "${r2.stratumB}"`;

      if (
        r1.stratumA === r2.stratumA &&
        r1.stratumB === r2.stratumB &&
        r1.relationType === r2.relationType
      ) {
        issues.push(
          createIssue({
            severity: "blocking",
            category: "duplicate_relation",
            message: `存在重复关系：${r1Label}（关系 #${r1.id} 与 #${r2.id}）`,
            stratumName: r1.stratumA,
            details: { relation1: r1, relation2: r2 },
          })
        );
      }

      if (r1.relationType === r2.relationType) {
        if (r1.stratumA === r2.stratumB && r1.stratumB === r2.stratumA) {
          issues.push(
            createIssue({
              severity: "blocking",
              category: "stratum_relation_conflict",
              message: `地层关系矛盾：${r1Label} 与 ${r2Label} 互斥`,
              stratumName: r1.stratumA,
              details: { relation1: r1, relation2: r2 },
            })
          );
        }
      }

      if (r1.relationType === "breaks" && r2.relationType === "earlier") {
        if (r1.stratumA === r2.stratumA && r1.stratumB === r2.stratumB) {
          issues.push(
            createIssue({
              severity: "blocking",
              category: "stratum_relation_conflict",
              message: `地层关系矛盾：${r1Label} 与 ${r2Label} 逻辑冲突（打破意味着年代更晚，不能同时早于）`,
              stratumName: r1.stratumA,
              details: { relation1: r1, relation2: r2 },
            })
          );
        }
      }
      if (r1.relationType === "earlier" && r2.relationType === "breaks") {
        if (r1.stratumA === r2.stratumA && r1.stratumB === r2.stratumB) {
          issues.push(
            createIssue({
              severity: "blocking",
              category: "stratum_relation_conflict",
              message: `地层关系矛盾：${r1Label} 与 ${r2Label} 逻辑冲突（打破意味着年代更晚，不能同时早于）`,
              stratumName: r1.stratumA,
              details: { relation1: r1, relation2: r2 },
            })
          );
        }
      }

      if (r1.relationType === "breaks" && r2.relationType === "breaks") {
        if (r1.stratumA === r2.stratumB && r1.stratumB === r2.stratumA) {
          issues.push(
            createIssue({
              severity: "blocking",
              category: "stratum_relation_conflict",
              message: `地层关系矛盾：${r1Label} 与 ${r2Label} 互相打破，不可能`,
              stratumName: r1.stratumA,
              details: { relation1: r1, relation2: r2 },
            })
          );
        }
      }

      if (r1.relationType === "contains" && r2.relationType === "contains") {
        if (r1.stratumA === r2.stratumB && r1.stratumB === r2.stratumA) {
          issues.push(
            createIssue({
              severity: "blocking",
              category: "stratum_relation_conflict",
              message: `地层关系矛盾：${r1Label} 与 ${r2Label} 互相包含，不可能`,
              stratumName: r1.stratumA,
              details: { relation1: r1, relation2: r2 },
            })
          );
        }
      }
    }
  }
};

const checkOrphanStrata = (
  relations: StratumRelation[],
  artifacts: ArtifactRecord[],
  issues: ConsistencyIssue[]
): void => {
  const relationStrata = new Set<string>();
  relations.forEach((r) => {
    if (r.stratumA) relationStrata.add(r.stratumA);
    if (r.stratumB) relationStrata.add(r.stratumB);
  });

  const artifactStrata = new Set<string>();
  artifacts.forEach((r) => {
    if (r.stratum) artifactStrata.add(r.stratum);
  });

  artifactStrata.forEach((stratum) => {
    if (!relationStrata.has(stratum) && relations.length > 0) {
      issues.push(
        createIssue({
          severity: "warning",
          category: "orphan_stratum",
          message: `地层"${stratum}"存在出土物记录，但未建立任何地层关系`,
          stratumName: stratum,
        })
      );
    }
  });
};

const checkReviewStatus = (
  records: ArtifactRecord[],
  issues: ConsistencyIssue[]
): void => {
  records.forEach((record) => {
    if (record.status === "pending") {
      issues.push(
        createIssue({
          severity: "warning",
          category: "unreviewed_record",
          message: `记录 #${record.id}（${record.trenchNumber || "无探方"} · ${record.artifactType}）处于待审核状态`,
          recordId: record.id,
          trenchNumber: record.trenchNumber,
          details: {
            artifactType: record.artifactType,
            stratum: record.stratum,
            submittedBy: record.submittedBy,
          },
        })
      );
    }

    if (record.status === "rejected") {
      issues.push(
        createIssue({
          severity: "warning",
          category: "rejected_record",
          message: `记录 #${record.id}（${record.trenchNumber || "无探方"} · ${record.artifactType}）已被审核退回`,
          recordId: record.id,
          trenchNumber: record.trenchNumber,
          details: {
            artifactType: record.artifactType,
            stratum: record.stratum,
            reviewReason: record.reviewReason,
            reviewedBy: record.reviewedBy,
          },
        })
      );
    }
  });
};

export const runConsistencyChecks = (
  input: DataCollectionInput
): ConsistencyReport => {
  const issues: ConsistencyIssue[] = [];

  checkTrenchNumbers(input.artifactRecords, issues);
  checkCoordinates(input.artifactRecords, issues);
  checkStratumRelations(input.stratumRelations, issues);
  checkOrphanStrata(input.stratumRelations, input.artifactRecords, issues);
  checkReviewStatus(input.artifactRecords, issues);

  const blockingCount = issues.filter((i) => i.severity === "blocking").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const blockingPriority: IssueCategory[] = [
    "missing_trench_number",
    "empty_trench_number",
    "invalid_coordinate",
    "stratum_relation_conflict",
    "duplicate_relation",
  ];
  const warningPriority: IssueCategory[] = [
    "unreviewed_record",
    "rejected_record",
    "orphan_stratum",
  ];

  issues.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "blocking" ? -1 : 1;
    }
    const priority = a.severity === "blocking" ? blockingPriority : warningPriority;
    const aIndex = priority.indexOf(a.category);
    const bIndex = priority.indexOf(b.category);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return (a.recordId ?? 0) - (b.recordId ?? 0);
  });

  return {
    generatedAt: new Date().toISOString(),
    blockingCount,
    warningCount,
    issues,
    isExportable: blockingCount === 0,
  };
};

export const filterArtifactsForExport = (
  records: ArtifactRecord[],
  options: { includePending: boolean; includeRejected: boolean }
): ArtifactRecord[] => {
  return records.filter((r) => {
    if (!options.includePending && r.status === "pending") return false;
    if (!options.includeRejected && r.status === "rejected") return false;
    return true;
  });
};
