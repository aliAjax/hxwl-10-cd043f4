import type {
  ArtifactRecord,
  RelationType,
  StratumRelation,
} from "./types";

// ============================================================
// 领域校验规则收敛模块
// ============================================================
// 坐标解析、地层关系冲突判断、字段缺失判断三类规则的单一定义源。
// 每条规则标注其生效场景（ValidationContext），便于追溯：
//   - entry_hint    : 录入表单 / 批量导入时提示用户
//   - export_blocking: 一致性检查时阻断导出
//   - overview_risk  : 总览面板仅作风险展示
// ============================================================

// —— 规则生效场景 ——
export type ValidationContext =
  | "entry_hint"
  | "export_blocking"
  | "overview_risk";

// —— 规则元信息 ——
export interface ValidationRuleMeta {
  ruleId: string;
  contexts: ValidationContext[];
  description: string;
}

// ============================================================
// 1. 规则注册表
// ============================================================

export const VALIDATION_RULE_REGISTRY: ValidationRuleMeta[] = [
  {
    ruleId: "coord_format",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "坐标格式校验：前缀须为 E/N/W/S/东/北/西/南，后缀须为 m/cm/mm/米/厘米/毫米，数值须非负",
  },
  {
    ruleId: "coord_empty",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "坐标为空检测：E 或 N 坐标为空视为异常",
  },
  {
    ruleId: "coord_parse_point",
    contexts: ["entry_hint"],
    description: "坐标点文本解析：从 \"E3.25 N4.50\" 等格式拆分 E / N 分量",
  },
  {
    ruleId: "field_missing",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "必填字段缺失检测：探方编号/地层/类型/E坐标/N坐标/深度",
  },
  {
    ruleId: "field_missing_quantity",
    contexts: ["entry_hint", "overview_risk"],
    description: "数量字段缺失检测（非导出阻断级）",
  },
  {
    ruleId: "stratum_self_reference",
    contexts: ["export_blocking", "overview_risk"],
    description: "自环关系检测：关系两端地层名相同",
  },
  {
    ruleId: "stratum_duplicate_relation",
    contexts: ["export_blocking", "overview_risk"],
    description: "重复关系检测：A→B 同类型关系存在多条",
  },
  {
    ruleId: "stratum_mutual_earlier",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "互相早于检测：A 早于 B 同时 B 早于 A",
  },
  {
    ruleId: "stratum_mutual_breaks",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "互相打破检测：A 打破 B 同时 B 打破 A",
  },
  {
    ruleId: "stratum_mutual_contains",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "互相包含检测：A 包含 B 同时 B 包含 A",
  },
  {
    ruleId: "stratum_breaks_vs_earlier",
    contexts: ["entry_hint", "export_blocking", "overview_risk"],
    description: "打破与早于同向矛盾：A 打破 B 同时 A 早于 B（打破意味着更晚）",
  },
];

// ============================================================
// 2. 坐标解析规则
// ============================================================

const COORD_PREFIXES = new Set(["e", "n", "w", "s", "东", "北", "西", "南"]);
const COORD_SUFFIXES = new Set(["m", "cm", "mm", "米", "厘米", "毫米"]);

export const isValidCoordinateFormat = (
  value: string
): { valid: boolean; extracted: number | null; reason?: string } => {
  if (!value || value.trim() === "") {
    return { valid: false, extracted: null, reason: "坐标为空" };
  }
  const clean = value.trim();
  const numMatch = clean.match(/-?\d+(\.\d+)?/);
  if (!numMatch) {
    return { valid: false, extracted: null, reason: "未找到有效数字" };
  }
  const numStr = numMatch[0];
  const num = parseFloat(numStr);
  if (isNaN(num)) return { valid: false, extracted: num, reason: "数字解析失败" };
  const numStart = numMatch.index || 0;
  const numEnd = numStart + numStr.length;
  const prefix = clean.slice(0, numStart).trim().toLowerCase();
  const suffix = clean.slice(numEnd).trim().toLowerCase();

  if (prefix && !COORD_PREFIXES.has(prefix)) {
    return { valid: false, extracted: num, reason: `前缀"${prefix}"不是有效的坐标标识` };
  }
  if (suffix && !COORD_SUFFIXES.has(suffix)) {
    return { valid: false, extracted: num, reason: `后缀"${suffix}"不是有效的单位标识` };
  }
  if (num < 0) {
    return { valid: false, extracted: num, reason: "坐标不能为负数" };
  }
  return { valid: true, extracted: num };
};

export const parseNumber = (value: string): number | null => {
  if (!value || value.trim() === "") return null;
  const clean = value.trim();
  const match = clean.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
};

export const parseCoordinatePoint = (
  coord: string
): { eCoordinate: string; nCoordinate: string } => {
  const clean = coord.trim().toUpperCase();
  const eMatch = clean.match(/E\s*([\d.]+)/);
  const nMatch = clean.match(/N\s*([\d.]+)/);
  if (eMatch && nMatch) {
    return { eCoordinate: eMatch[1], nCoordinate: nMatch[1] };
  }
  const parts = clean.split(/[\s,，、]+/).filter(Boolean);
  if (parts.length >= 2) {
    return { eCoordinate: parts[0], nCoordinate: parts[1] };
  }
  return { eCoordinate: "", nCoordinate: "" };
};

export interface ValidatedArtifactRecord extends ArtifactRecord {
  eValue: number | null;
  nValue: number | null;
  isCoordinateValid: boolean;
  coordinateError?: string;
}

export const validateRecordCoordinates = (
  record: ArtifactRecord
): ValidatedArtifactRecord => {
  const eCheck = isValidCoordinateFormat(record.eCoordinate);
  const nCheck = isValidCoordinateFormat(record.nCoordinate);
  const eValue = eCheck.extracted;
  const nValue = nCheck.extracted;
  let isCoordinateValid = true;
  let coordinateError: string | undefined;

  const eEmpty = !record.eCoordinate || record.eCoordinate.trim() === "";
  const nEmpty = !record.nCoordinate || record.nCoordinate.trim() === "";

  if (eEmpty && nEmpty) {
    isCoordinateValid = false;
    coordinateError = "E和N坐标均为空";
  } else if (eEmpty) {
    isCoordinateValid = false;
    coordinateError = "E坐标为空";
  } else if (nEmpty) {
    isCoordinateValid = false;
    coordinateError = "N坐标为空";
  } else if (!eCheck.valid && !nCheck.valid) {
    isCoordinateValid = false;
    coordinateError = `E坐标${eCheck.reason}，N坐标${nCheck.reason}`;
  } else if (!eCheck.valid) {
    isCoordinateValid = false;
    coordinateError = `E坐标${eCheck.reason}`;
  } else if (!nCheck.valid) {
    isCoordinateValid = false;
    coordinateError = `N坐标${nCheck.reason}`;
  } else if (eValue !== null && nValue !== null && (eValue < 0 || nValue < 0)) {
    isCoordinateValid = false;
    coordinateError = "坐标不能为负数";
  }

  return { ...record, eValue, nValue, isCoordinateValid, coordinateError };
};

// ============================================================
// 3. 字段缺失判断规则
// ============================================================

export const FIELD_LABELS: Partial<Record<keyof ArtifactRecord, string>> = {
  eCoordinate: "E坐标",
  nCoordinate: "N坐标",
  depth: "深度",
  artifactType: "出土物类型",
  stratum: "地层",
  trenchNumber: "探方编号",
  quantity: "数量",
  relicUnit: "遗迹单位",
  remarks: "备注",
};

export const REQUIRED_FIELDS: (keyof ArtifactRecord)[] = [
  "trenchNumber",
  "stratum",
  "artifactType",
  "eCoordinate",
  "nCoordinate",
  "depth",
];

export const isFieldEmpty = (
  record: ArtifactRecord,
  field: keyof ArtifactRecord
): boolean => {
  const value = record[field];
  return typeof value === "string" && (!value || value.trim() === "");
};

export const getMissingRequiredFields = (
  record: ArtifactRecord
): (keyof ArtifactRecord)[] => {
  return REQUIRED_FIELDS.filter((f) => isFieldEmpty(record, f));
};

// ============================================================
// 4. 地层关系冲突判断规则
// ============================================================

export const RELATION_LABEL_MAP: Record<RelationType, string> = {
  earlier: "早于",
  breaks: "打破",
  contains: "包含",
};

export interface StratumConflictResult {
  hasConflict: boolean;
  conflictKind?: string;
  message: string;
}

export const checkStratumRelationConflict = (
  stratumA: string,
  stratumB: string,
  relationType: RelationType,
  allRelations: StratumRelation[]
): StratumConflictResult => {
  const labelA = RELATION_LABEL_MAP[relationType];

  for (const r of allRelations) {
    const rLabelA = `"${r.stratumA}" ${RELATION_LABEL_MAP[r.relationType]} "${r.stratumB}"`;
    const newLabel = `"${stratumA}" ${labelA} "${stratumB}"`;

    if (stratumA === stratumB) {
      return {
        hasConflict: true,
        conflictKind: "stratum_self_reference",
        message: `关系地层A与地层B相同（"${stratumA}"）`,
      };
    }

    if (
      r.stratumA === stratumA &&
      r.stratumB === stratumB &&
      r.relationType === relationType
    ) {
      return {
        hasConflict: true,
        conflictKind: "stratum_duplicate_relation",
        message: `存在重复关系：${newLabel}（关系 #${r.id}）`,
      };
    }

    if (r.relationType === relationType) {
      if (r.stratumA === stratumB && r.stratumB === stratumA) {
        const kindMap: Record<RelationType, string> = {
          earlier: "stratum_mutual_earlier",
          breaks: "stratum_mutual_breaks",
          contains: "stratum_mutual_contains",
        };
        const descMap: Record<RelationType, string> = {
          earlier: "互斥",
          breaks: "互相打破，不可能",
          contains: "互相包含，不可能",
        };
        return {
          hasConflict: true,
          conflictKind: kindMap[relationType],
          message: `地层关系矛盾：${rLabelA} 与 ${newLabel} ${descMap[relationType]}`,
        };
      }
    }

    if (relationType === "breaks" && r.relationType === "earlier") {
      if (r.stratumA === stratumA && r.stratumB === stratumB) {
        return {
          hasConflict: true,
          conflictKind: "stratum_breaks_vs_earlier",
          message: `地层关系矛盾：${rLabelA} 与 ${newLabel} 逻辑冲突（打破意味着年代更晚，不能同时早于）`,
        };
      }
    }

    if (relationType === "earlier" && r.relationType === "breaks") {
      if (r.stratumA === stratumA && r.stratumB === stratumB) {
        return {
          hasConflict: true,
          conflictKind: "stratum_breaks_vs_earlier",
          message: `地层关系矛盾：${rLabelA} 与 ${newLabel} 逻辑冲突（打破意味着年代更晚，不能同时早于）`,
        };
      }
    }
  }

  return { hasConflict: false, message: "" };
};

export interface PairwiseConflictResult {
  conflictKind: string;
  relation1: StratumRelation;
  relation2: StratumRelation;
  message: string;
}

export const checkAllStratumRelationConflicts = (
  relations: StratumRelation[]
): PairwiseConflictResult[] => {
  const results: PairwiseConflictResult[] = [];

  for (let i = 0; i < relations.length; i++) {
    const r1 = relations[i];

    if (r1.stratumA === r1.stratumB) {
      results.push({
        conflictKind: "stratum_self_reference",
        relation1: r1,
        relation2: r1,
        message: `关系 #${r1.id} 地层A与地层B相同（"${r1.stratumA}"）`,
      });
    }

    for (let j = i + 1; j < relations.length; j++) {
      const r2 = relations[j];

      const r1Label = `"${r1.stratumA}" ${RELATION_LABEL_MAP[r1.relationType]} "${r1.stratumB}"`;
      const r2Label = `"${r2.stratumA}" ${RELATION_LABEL_MAP[r2.relationType]} "${r2.stratumB}"`;

      if (
        r1.stratumA === r2.stratumA &&
        r1.stratumB === r2.stratumB &&
        r1.relationType === r2.relationType
      ) {
        results.push({
          conflictKind: "stratum_duplicate_relation",
          relation1: r1,
          relation2: r2,
          message: `存在重复关系：${r1Label}（关系 #${r1.id} 与 #${r2.id}）`,
        });
      }

      if (r1.relationType === r2.relationType) {
        if (r1.stratumA === r2.stratumB && r1.stratumB === r2.stratumA) {
          const descMap: Record<RelationType, string> = {
            earlier: "互斥",
            breaks: "互相打破，不可能",
            contains: "互相包含，不可能",
          };
          const kindMap: Record<RelationType, string> = {
            earlier: "stratum_mutual_earlier",
            breaks: "stratum_mutual_breaks",
            contains: "stratum_mutual_contains",
          };
          results.push({
            conflictKind: kindMap[r1.relationType],
            relation1: r1,
            relation2: r2,
            message: `地层关系矛盾：${r1Label} 与 ${r2Label} ${descMap[r1.relationType]}`,
          });
        }
      }

      if (r1.relationType === "breaks" && r2.relationType === "earlier") {
        if (r1.stratumA === r2.stratumA && r1.stratumB === r2.stratumB) {
          results.push({
            conflictKind: "stratum_breaks_vs_earlier",
            relation1: r1,
            relation2: r2,
            message: `地层关系矛盾：${r1Label} 与 ${r2Label} 逻辑冲突（打破意味着年代更晚，不能同时早于）`,
          });
        }
      }
      if (r1.relationType === "earlier" && r2.relationType === "breaks") {
        if (r1.stratumA === r2.stratumA && r1.stratumB === r2.stratumB) {
          results.push({
            conflictKind: "stratum_breaks_vs_earlier",
            relation1: r1,
            relation2: r2,
            message: `地层关系矛盾：${r1Label} 与 ${r2Label} 逻辑冲突（打破意味着年代更晚，不能同时早于）`,
          });
        }
      }
    }
  }

  return results;
};
