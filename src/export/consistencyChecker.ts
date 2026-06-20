import type {
  ArtifactRecord,
  StratumRelation,
} from "../types";
import type {
  ConsistencyIssue,
  ConsistencyReport,
  DataCollectionInput,
  IssueCategory,
} from "./types";
import { runChronologyInference } from "../chronologyInference";
import {
  isValidCoordinateFormat as _isValidCoordinateFormat,
  isFieldEmpty,
  checkAllStratumRelationConflicts,
  REQUIRED_FIELDS,
} from "../domainValidators";

export const isValidCoordinateFormat = (
  value: string
): { valid: boolean; reason?: string } => {
  const result = _isValidCoordinateFormat(value);
  return { valid: result.valid, reason: result.reason };
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
    if (isFieldEmpty(record, "trenchNumber")) {
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
  const conflicts = checkAllStratumRelationConflicts(relations);

  conflicts.forEach((conflict) => {
    if (conflict.conflictKind === "stratum_self_reference") {
      issues.push(
        createIssue({
          severity: "blocking",
          category: "stratum_relation_conflict",
          message: conflict.message,
          stratumName: conflict.relation1.stratumA,
          details: { relationId: conflict.relation1.id, relationType: conflict.relation1.relationType },
        })
      );
    } else if (conflict.conflictKind === "stratum_duplicate_relation") {
      issues.push(
        createIssue({
          severity: "blocking",
          category: "duplicate_relation",
          message: conflict.message,
          stratumName: conflict.relation1.stratumA,
          details: { relation1: conflict.relation1, relation2: conflict.relation2 },
        })
      );
    } else {
      issues.push(
        createIssue({
          severity: "blocking",
          category: "stratum_relation_conflict",
          message: conflict.message,
          stratumName: conflict.relation1.stratumA,
          details: { relation1: conflict.relation1, relation2: conflict.relation2 },
        })
      );
    }
  });
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

const checkChronology = (
  input: DataCollectionInput,
  issues: ConsistencyIssue[]
): ReturnType<typeof runChronologyInference> => {
  const chronoReport = runChronologyInference(input.artifactRecords, input.stratumRelations);

  chronoReport.cycles.forEach((cycle) => {
    issues.push(
      createIssue({
        severity: "blocking",
        category: "stratum_relation_conflict",
        message: `地层年代存在循环依赖：${cycle.nodeNames.join(" → ")} → ${cycle.nodeNames[0]}，关系逻辑矛盾，无法确定年代顺序`,
        stratumName: cycle.nodeNames[0],
        details: {
          chronoCycle: cycle,
          involvedRelationIds: cycle.involvedRelationIds,
        },
      })
    );
  });

  chronoReport.namingConflicts.forEach((nc) => {
    const trenches = nc.occurrences.map((o) => o.trenchNumber || "未知探方").join("、");
    issues.push(
      createIssue({
        severity: "warning",
        category: "stratum_relation_conflict",
        message: `跨探方命名冲突：${nc.name} 同时出现在 ${trenches}，请确认是否为同一层位/遗迹`,
        details: { namingConflict: nc },
      })
    );
  });

  chronoReport.risks
    .filter((r) => r.type === "unreviewed_in_chain")
    .forEach((risk) => {
      issues.push(
        createIssue({
          severity: "warning",
          category: "unreviewed_record",
          message: `年代推断警告：${risk.message}`,
          recordId: risk.recordIds?.[0],
          trenchNumber: risk.trenchNumber,
          stratumName: risk.nodeName,
          details: risk.details,
        })
      );
    });

  return chronoReport;
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
  const chronologyReport = checkChronology(input, issues);

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
    chronologyReport,
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
