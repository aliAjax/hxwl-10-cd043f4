import { useState, useEffect, useCallback } from "react";
import "./styles.css";
import {
  isIndexedDBSupported,
  saveDraft as saveDraftToDB,
  getAllDrafts,
  deleteDraft as deleteDraftFromDB,
  clearAllDrafts as clearAllDraftsFromDB,
} from "./indexedDB";
import ExportModule from "./export";
import ExcavationOverview from "./ExcavationOverview";
import StratumRelationGraphView from "./StratumRelationGraphView";
import {
  type ReviewStatus,
  type UserRole,
  type ArtifactRecord,
  type ArtifactFormData,
  type ExcavationLog,
  type ExcavationLogFormData,
  type SearchFilters,
  type FormErrors,
  type ExcavationLogFormErrors,
  type RelationType,
  type StratumRelation,
  type StratumRelationFormData,
  type StratumRelationFormErrors,
  type BatchImportRow,
  type ParsedImportResult,
  type ValidatedBatchImportRow,
  type DuplicateCheckResult,
  type ImportResultSummary,
  type DraftRecord,
  type AnomalyType,
  type AnomalyRecord,
  type MissingFieldItem,
  type PendingRelationItem,
  type PendingArchiveItem,
  type TrenchSummary,
  type StratumSummary,
  type RelicUnitSummary,
  type UnorganizedStats,
  type OverviewState,
  type RoleBasedViewData,
  type OverviewFilters,
  batchImportHeaders,
  type ExceptionAction,
} from "./types";



const HEADER_ALIASES: Record<string, string> = {
  "探方": "trenchNumber", "探方编号": "trenchNumber", "trench": "trenchNumber", "trenchnumber": "trenchNumber",
  "地层": "stratum", "层位": "stratum", "stratum": "stratum",
  "遗迹单位": "relicUnit", "遗迹": "relicUnit", "relic": "relicUnit", "relicunit": "relicUnit",
  "坐标点": "coordinatePoint", "坐标": "coordinatePoint", "coordinate": "coordinatePoint", "coordinates": "coordinatePoint",
  "深度": "depth", "depth": "depth",
  "类型": "artifactType", "出土物类型": "artifactType", "type": "artifactType", "artifacttype": "artifactType",
  "数量": "quantity", "件数": "quantity", "qty": "quantity", "quantity": "quantity"
};

const relationTypeOptions: { value: RelationType; label: string; description: string; inverse: string }[] = [
  { value: "earlier", label: "早于", description: "A 的年代早于 B", inverse: "晚于" },
  { value: "breaks", label: "打破", description: "A 地层打破了 B 地层", inverse: "被打破" },
  { value: "contains", label: "包含", description: "A 地层包含 B 遗迹/地层", inverse: "被包含于" }
];

const initialStratumRelations: StratumRelation[] = [
  {
    id: 1,
    stratumA: "第2层",
    stratumB: "第3层",
    relationType: "earlier",
    createdAt: "2024/6/17 10:15:00"
  },
  {
    id: 2,
    stratumA: "H12灰坑",
    stratumB: "第3层",
    relationType: "breaks",
    createdAt: "2024/6/17 11:30:00"
  }
];

const project = {
  "id": "hxwl-10",
  "port": 5110,
  "title": "考古探方记录",
  "subtitle": "遗址探方、地层关系与出土物坐标档案",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#854d0e",
    "#047857",
    "#475569"
  ],
  "domain": "考古发掘",
  "users": [
    "发掘队员",
    "领队",
    "资料整理员"
  ],
  "metrics": [
    "探方数",
    "地层数",
    "出土物",
    "未整理记录"
  ],
  "filters": [
    "灰坑",
    "墓葬",
    "房址",
    "沟状遗迹"
  ],
  "fields": [
    "遗址",
    "探方",
    "地层",
    "遗迹单位",
    "深度",
    "土色",
    "坐标点",
    "出土物"
  ],
  "records": [
    [
      "T0203",
      "第3层",
      "灰褐土",
      "陶片12件，坐标E3N4"
    ],
    [
      "T0204",
      "H12灰坑",
      "黑褐土",
      "夹炭屑，见动物骨"
    ],
    [
      "T0301",
      "F2房址",
      "夯土面",
      "柱洞关系需复核"
    ]
  ]
};

const statusColors = ["status-ok", "status-watch", "status-danger"];

const artifactTypes = ["陶片", "石器", "骨器", "青铜器", "瓷器", "铁器", "动植物遗存", "其他"];

const roleNames: Record<UserRole, string> = {
  excavator: "发掘队员",
  leader: "领队",
  archivist: "资料整理员"
};

const statusLabels: Record<ReviewStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已退回",
  archived: "已归档"
};

const statusColorsMap: Record<ReviewStatus, string> = {
  pending: "#f59e0b",
  approved: "#047857",
  rejected: "#e11d48",
  archived: "#475569"
};

const weatherOptions = ["晴", "多云", "阴", "小雨", "中雨", "大雨", "小雪", "中雪", "雾", "霾"];

const initialArtifactRecords: ArtifactRecord[] = [
  {
    id: 1001,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "陶片",
    eCoordinate: "3.25",
    nCoordinate: "4.50",
    depth: "0.85m",
    remarks: "绳纹陶片，可辨器形有鬲口沿",
    createdAt: "2024/6/17 09:20:00",
    quantity: "12",
    status: "archived",
    submittedBy: "发掘队员-李明",
    submittedAt: "2024/6/17 09:20:00",
    reviewReason: "记录完整，坐标准确",
    reviewedBy: "领队-张建国",
    reviewedAt: "2024/6/17 10:00:00",
    archivedBy: "资料整理员-王小芳",
    archivedAt: "2024/6/17 14:30:00"
  },
  {
    id: 1002,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "石器",
    eCoordinate: "1.80",
    nCoordinate: "2.35",
    depth: "0.92m",
    remarks: "石斧残件，磨制精细",
    createdAt: "2024/6/17 09:45:00",
    quantity: "1",
    status: "approved",
    submittedBy: "发掘队员-李明",
    submittedAt: "2024/6/17 09:45:00",
    reviewReason: "重要发现，记录完整",
    reviewedBy: "领队-张建国",
    reviewedAt: "2024/6/17 10:30:00"
  },
  {
    id: 1003,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "骨器",
    eCoordinate: "4.10",
    nCoordinate: "1.20",
    depth: "0.78m",
    remarks: "骨簪一枚，保存较好",
    createdAt: "2024/6/17 10:10:00",
    quantity: "1",
    status: "approved",
    submittedBy: "发掘队员-李明",
    submittedAt: "2024/6/17 10:10:00",
    reviewReason: "器物完整，记录清晰",
    reviewedBy: "领队-张建国",
    reviewedAt: "2024/6/17 11:00:00"
  },
  {
    id: 1004,
    trenchNumber: "T0203",
    stratum: "第2层",
    artifactType: "陶片",
    eCoordinate: "2.55",
    nCoordinate: "3.80",
    depth: "0.45m",
    remarks: "泥质灰陶，素面",
    createdAt: "2024/6/17 10:35:00",
    quantity: "5",
    status: "rejected",
    submittedBy: "发掘队员-赵伟",
    submittedAt: "2024/6/17 10:35:00",
    reviewReason: "地层判断存疑，第2层应为明清堆积，请复核陶片年代",
    reviewedBy: "领队-张建国",
    reviewedAt: "2024/6/17 11:30:00"
  },
  {
    id: 1005,
    trenchNumber: "T0203",
    stratum: "第2层",
    artifactType: "瓷器",
    eCoordinate: "5.00",
    nCoordinate: "5.00",
    depth: "0.32m",
    remarks: "青花瓷片，明清时期",
    createdAt: "2024/6/17 11:00:00",
    quantity: "2",
    status: "pending",
    submittedBy: "发掘队员-赵伟",
    submittedAt: "2024/6/17 11:00:00"
  },
  {
    id: 1006,
    trenchNumber: "T0204",
    stratum: "H12灰坑",
    artifactType: "动植物遗存",
    eCoordinate: "2.10",
    nCoordinate: "3.40",
    depth: "1.25m",
    remarks: "炭化粟粒，需浮选鉴定",
    createdAt: "2024/6/17 14:15:00",
    relicUnit: "H12",
    quantity: "大量",
    status: "pending",
    submittedBy: "发掘队员-王小芳",
    submittedAt: "2024/6/17 14:15:00"
  },
  {
    id: 1007,
    trenchNumber: "T0204",
    stratum: "H12灰坑",
    artifactType: "骨器",
    eCoordinate: "3.75",
    nCoordinate: "2.60",
    depth: "1.38m",
    remarks: "动物骨骼碎片，疑似猪骨",
    createdAt: "2024/6/17 14:40:00",
    relicUnit: "H12",
    quantity: "8",
    status: "pending",
    submittedBy: "发掘队员-王小芳",
    submittedAt: "2024/6/17 14:40:00"
  },
  {
    id: 1008,
    trenchNumber: "T0204",
    stratum: "H12灰坑",
    artifactType: "陶片",
    eCoordinate: "4.50",
    nCoordinate: "4.20",
    depth: "1.15m",
    remarks: "夹砂褐陶，绳纹",
    createdAt: "2024/6/17 15:05:00",
    relicUnit: "H12",
    quantity: "20",
    status: "pending",
    submittedBy: "发掘队员-王小芳",
    submittedAt: "2024/6/17 15:05:00"
  },
  {
    id: 1009,
    trenchNumber: "T0204",
    stratum: "第2层",
    artifactType: "铁器",
    eCoordinate: "1.25",
    nCoordinate: "1.80",
    depth: "0.38m",
    remarks: "铁钉，锈蚀严重",
    createdAt: "2024/6/17 15:30:00",
    quantity: "3",
    status: "pending",
    submittedBy: "发掘队员-李明",
    submittedAt: "2024/6/17 15:30:00"
  },
  {
    id: 1010,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "陶片",
    eCoordinate: "",
    nCoordinate: "3.50",
    depth: "0.60m",
    remarks: "缺少E坐标，坐标待补测",
    createdAt: "2024/6/17 16:00:00",
    relicUnit: "F2",
    quantity: "4",
    status: "rejected",
    submittedBy: "发掘队员-赵伟",
    submittedAt: "2024/6/17 16:00:00",
    reviewReason: "坐标不完整，请补测E坐标后重新提交",
    reviewedBy: "领队-张建国",
    reviewedAt: "2024/6/17 16:40:00"
  },
  {
    id: 1011,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "石器",
    eCoordinate: "2.90",
    nCoordinate: "abc",
    depth: "0.65m",
    remarks: "N坐标格式错误",
    createdAt: "2024/6/17 16:20:00",
    relicUnit: "F2",
    quantity: "1",
    status: "pending",
    submittedBy: "发掘队员-赵伟",
    submittedAt: "2024/6/17 16:20:00"
  },
  {
    id: 1012,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "其他",
    eCoordinate: "",
    nCoordinate: "",
    depth: "0.80m",
    remarks: "未记录坐标点",
    createdAt: "2024/6/17 16:45:00",
    quantity: "1",
    status: "pending",
    submittedBy: "发掘队员-李明",
    submittedAt: "2024/6/17 16:45:00"
  },
  {
    id: 1013,
    trenchNumber: "T0204",
    stratum: "第3层",
    artifactType: "陶片",
    eCoordinate: "E2.80",
    nCoordinate: "N3.15",
    depth: "0.72m",
    remarks: "带E/N前缀的坐标（应正常识别）",
    createdAt: "2024/6/17 17:10:00",
    quantity: "8",
    status: "pending",
    submittedBy: "发掘队员-王小芳",
    submittedAt: "2024/6/17 17:10:00"
  },
  {
    id: 1014,
    trenchNumber: "T0204",
    stratum: "第3层",
    artifactType: "石器",
    eCoordinate: "4.20m",
    nCoordinate: "1.50m",
    depth: "0.95m",
    remarks: "带m单位后缀的坐标（应正常识别）",
    createdAt: "2024/6/17 17:30:00",
    quantity: "2",
    status: "pending",
    submittedBy: "发掘队员-王小芳",
    submittedAt: "2024/6/17 17:30:00"
  },
  {
    id: 1015,
    trenchNumber: "T0204",
    stratum: "第3层",
    artifactType: "骨器",
    eCoordinate: "E0.85m",
    nCoordinate: "N2.40m",
    depth: "0.68m",
    remarks: "同时带E/N前缀和m单位后缀（应正常识别）",
    createdAt: "2024/6/17 17:50:00",
    quantity: "1",
    status: "pending",
    submittedBy: "发掘队员-王小芳",
    submittedAt: "2024/6/17 17:50:00"
  },
  {
    id: 1016,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "陶片",
    eCoordinate: "X3.50",
    nCoordinate: "N2.10",
    depth: "0.55m",
    remarks: "E坐标前缀X不是有效坐标标识（应标记异常）",
    createdAt: "2024/6/17 18:10:00",
    relicUnit: "F2",
    quantity: "3",
    status: "pending",
    submittedBy: "发掘队员-赵伟",
    submittedAt: "2024/6/17 18:10:00"
  },
  {
    id: 1017,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "瓷器",
    eCoordinate: "E1.75",
    nCoordinate: "Y4.20",
    depth: "0.48m",
    remarks: "N坐标前缀Y不是有效坐标标识（应标记异常）",
    createdAt: "2024/6/17 18:30:00",
    relicUnit: "F2",
    quantity: "1",
    status: "pending",
    submittedBy: "发掘队员-赵伟",
    submittedAt: "2024/6/17 18:30:00"
  },
  {
    id: 1018,
    trenchNumber: "T0203",
    stratum: "第2层",
    artifactType: "铁器",
    eCoordinate: "3.00xyz",
    nCoordinate: "N3.50",
    depth: "0.30m",
    remarks: "E坐标后缀xyz不是有效单位（应标记异常）",
    createdAt: "2024/6/17 18:50:00",
    quantity: "2",
    status: "pending",
    submittedBy: "发掘队员-李明",
    submittedAt: "2024/6/17 18:50:00"
  }
];

const initialExcavationLogs: ExcavationLog[] = [
  {
    id: 1,
    date: "2024-06-17",
    weather: "晴",
    participants: "张建国、李明、王小芳",
    excavationArea: "T0203、T0204",
    mainFindings: "T0203 第3层出土陶片12件，其中可辨器形有鬲口沿2件、罐腹片5件；T0204 H12灰坑内发现动物骨骼碎片及炭屑堆积",
    pendingReview: "T0203 第2层与第3层的地层界线需进一步确认；H12灰坑出土的动物骨骼需送鉴定",
    createdAt: "2024/6/17 18:30:00"
  },
  {
    id: 2,
    date: "2024-06-16",
    weather: "多云",
    participants: "张建国、李明、赵伟",
    excavationArea: "T0301",
    mainFindings: "T0301 F2房址清理出柱洞6个，排列规律疑似为长方形建筑基址；房址内出土少量绳纹陶片",
    pendingReview: "F2房址柱洞的年代关系需结合出土物进一步分析；夯土面的土质土色需详细记录",
    createdAt: "2024/6/16 17:45:00"
  },
  {
    id: 3,
    date: "2024-06-15",
    weather: "小雨",
    participants: "李明、王小芳",
    excavationArea: "T0204",
    mainFindings: "因小雨停工半天，下午对 T0204 第4层进行了剖面清理，确认该层为文化层堆积",
    pendingReview: "雨天后探方排水情况需持续关注；T0204 第4层陶片需分类统计",
    createdAt: "2024/6/15 16:20:00"
  }
];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

const parseNumber = (value: string): number | null => {
  if (!value || value.trim() === "") return null;
  const clean = value.trim();
  const match = clean.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
};

const COORD_PREFIXES = new Set(["e", "n", "w", "s", "东", "北", "西", "南"]);
const COORD_SUFFIXES = new Set(["m", "cm", "mm", "米", "厘米", "毫米"]);

const isValidCoordinateFormat = (value: string): { valid: boolean; extracted: number | null; reason?: string } => {
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
  return { valid: true, extracted: num };
};

interface ValidatedArtifactRecord extends ArtifactRecord {
  eValue: number | null;
  nValue: number | null;
  isCoordinateValid: boolean;
  coordinateError?: string;
}

const validateRecordCoordinates = (record: ArtifactRecord): ValidatedArtifactRecord => {
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

const FIELD_LABELS: Partial<Record<keyof ArtifactRecord, string>> = {
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

const REQUIRED_FIELDS: (keyof ArtifactRecord)[] = [
  "trenchNumber",
  "stratum",
  "artifactType",
  "eCoordinate",
  "nCoordinate",
  "depth",
];

const generateMissingFields = (
  records: ArtifactRecord[]
): MissingFieldItem[] => {
  const missingFields: MissingFieldItem[] = [];

  records.forEach((record) => {
    if (record.status === "archived") return;

    REQUIRED_FIELDS.forEach((field) => {
      const value = record[field];
      if (typeof value === "string" && (!value || value.trim() === "")) {
        missingFields.push({
          recordId: record.id,
          trenchNumber: record.trenchNumber,
          stratum: record.stratum,
          fieldName: field,
          fieldLabel: FIELD_LABELS[field] || String(field),
          currentValue: value || "",
          artifactType: record.artifactType,
          submittedAt: record.submittedAt,
        });
      }
    });

    if (!record.quantity || record.quantity.trim() === "") {
      missingFields.push({
        recordId: record.id,
        trenchNumber: record.trenchNumber,
        stratum: record.stratum,
        fieldName: "quantity",
        fieldLabel: "数量",
        currentValue: record.quantity || "",
        artifactType: record.artifactType,
        submittedAt: record.submittedAt,
      });
    }
  });

  return missingFields;
};

const generatePendingRelations = (
  records: ArtifactRecord[],
  relations: StratumRelation[]
): PendingRelationItem[] => {
  const pending: PendingRelationItem[] = [];
  const strataSet = new Set<string>();

  records.forEach((r) => {
    if (r.stratum) strataSet.add(r.stratum);
  });

  const strataList = Array.from(strataSet).sort();

  for (let i = 0; i < strataList.length; i++) {
    for (let j = i + 1; j < strataList.length; j++) {
      const stratumA = strataList[i];
      const stratumB = strataList[j];

      const hasRelation = relations.some(
        (r) =>
          (r.stratumA === stratumA && r.stratumB === stratumB) ||
          (r.stratumA === stratumB && r.stratumB === stratumA)
      );

      if (!hasRelation) {
        const relatedArtifacts = records.filter(
          (r) => r.stratum === stratumA || r.stratum === stratumB
        );

        const trenchNumbers = Array.from(
          new Set(relatedArtifacts.map((r) => r.trenchNumber))
        );

        pending.push({
          trenchNumber: trenchNumbers[0] || "",
          stratumA,
          stratumB,
          issue: `${stratumA} 与 ${stratumB} 之间尚未建立地层关系`,
          suggestion: "请确认两者的年代关系（早于/打破/包含）",
          relatedArtifactCount: relatedArtifacts.length,
        });
      }
    }
  }

  relations.forEach((rel) => {
    const conflict = checkConflictRelationStatic(
      rel.stratumA,
      rel.stratumB,
      rel.relationType,
      relations
    );
    if (conflict.hasConflict) {
      const relatedArtifacts = records.filter(
        (r) => r.stratum === rel.stratumA || r.stratum === rel.stratumB
      );

      pending.push({
        relationId: rel.id,
        trenchNumber:
          relatedArtifacts[0]?.trenchNumber ||
          records.find((r) => r.stratum === rel.stratumA)?.trenchNumber ||
          "",
        stratumA: rel.stratumA,
        stratumB: rel.stratumB,
        issue: conflict.message,
        suggestion: "请重新核对地层关系",
        hasConflictingRelation: true,
        relatedArtifactCount: relatedArtifacts.length,
      });
    }
  });

  return pending;
};

const checkConflictRelationStatic = (
  a: string,
  b: string,
  type: RelationType,
  allRelations: StratumRelation[]
): { hasConflict: boolean; message: string } => {
  const getLabel = (t: RelationType) =>
    relationTypeOptions.find((o) => o.value === t)?.label || t;

  for (const r of allRelations) {
    if (r.relationType === type) {
      if (r.stratumA === b && r.stratumB === a) {
        return {
          hasConflict: true,
          message: `矛盾：已存在 "${b} ${getLabel(type)} ${a}"，不能同时存在 "${a} ${getLabel(type)} ${b}"`,
        };
      }
    }
    if (type === "contains" && r.relationType === "contains") {
      if (r.stratumA === b && r.stratumB === a) {
        return {
          hasConflict: true,
          message: `矛盾：已存在 "${b} 包含 ${a}"，不能同时存在 "${a} 包含 ${b}"`,
        };
      }
    }
    if (type === "breaks" && r.relationType === "earlier") {
      if (r.stratumA === a && r.stratumB === b) {
        return {
          hasConflict: true,
          message: `矛盾：已存在 "${a} 早于 ${b}"，不能同时存在 "${a} 打破 ${b}"（打破意味着年代更晚）`,
        };
      }
    }
    if (type === "earlier" && r.relationType === "breaks") {
      if (r.stratumA === a && r.stratumB === b) {
        return {
          hasConflict: true,
          message: `矛盾：已存在 "${a} 打破 ${b}"，不能同时存在 "${a} 早于 ${b}"（打破意味着年代更晚）`,
        };
      }
    }
    if (type === "breaks" && r.relationType === "breaks") {
      if (r.stratumA === b && r.stratumB === a) {
        return {
          hasConflict: true,
          message: `矛盾：已存在 "${b} 打破 ${a}"，不能同时存在 "${a} 打破 ${b}"`,
        };
      }
    }
    if (type === "earlier" && r.relationType === "earlier") {
      if (r.stratumA === b && r.stratumB === a) {
        return {
          hasConflict: true,
          message: `矛盾：已存在 "${b} 早于 ${a}"，不能同时存在 "${a} 早于 ${b}"`,
        };
      }
    }
  }
  return { hasConflict: false, message: "" };
};

const generatePendingArchives = (
  records: ArtifactRecord[]
): PendingArchiveItem[] => {
  return records
    .filter((r) => r.status === "approved")
    .map((r) => ({
      recordId: r.id,
      trenchNumber: r.trenchNumber,
      stratum: r.stratum,
      artifactType: r.artifactType,
      quantity: r.quantity,
      approvedBy: r.reviewedBy,
      approvedAt: r.reviewedAt,
      reviewReason: r.reviewReason,
    }))
    .sort((a, b) => {
      if (!a.approvedAt || !b.approvedAt) return 0;
      return new Date(a.approvedAt).getTime() - new Date(b.approvedAt).getTime();
    });
};

const generateAnomalies = (
  records: ArtifactRecord[],
  relations: StratumRelation[],
  validatedRecords: ValidatedArtifactRecord[]
): AnomalyRecord[] => {
  const anomalies: AnomalyRecord[] = [];
  const now = new Date().toLocaleString("zh-CN");

  validatedRecords.forEach((vr) => {
    if (vr.status === "archived") return;

    if (!vr.isCoordinateValid) {
      anomalies.push({
        id: `coord-${vr.id}`,
        type: vr.coordinateError?.includes("为空")
          ? "missing_coordinate"
          : "invalid_coordinate",
        trenchNumber: vr.trenchNumber,
        stratum: vr.stratum,
        relicUnit: vr.relicUnit,
        recordId: vr.id,
        severity: vr.coordinateError?.includes("为空") ? "error" : "warning",
        message: `${vr.artifactType} #${vr.id}: ${vr.coordinateError}`,
        affectedRole: ["excavator", "leader"],
        createdAt: now,
      });
    }

    REQUIRED_FIELDS.forEach((field) => {
      const value = vr[field];
      if (typeof value === "string" && (!value || value.trim() === "")) {
        anomalies.push({
          id: `field-${vr.id}-${String(field)}`,
          type: "missing_field",
          trenchNumber: vr.trenchNumber,
          stratum: vr.stratum,
          relicUnit: vr.relicUnit,
          recordId: vr.id,
          severity: "warning",
          message: `${vr.artifactType} #${vr.id}: 缺少${FIELD_LABELS[field] || String(field)}`,
          affectedRole: ["excavator"],
          createdAt: now,
        });
      }
    });
  });

  records.forEach((r) => {
    if (r.status === "pending") {
      anomalies.push({
        id: `review-${r.id}`,
        type: "unreviewed_record",
        trenchNumber: r.trenchNumber,
        stratum: r.stratum,
        relicUnit: r.relicUnit,
        recordId: r.id,
        severity: "warning",
        message: `${r.artifactType} #${r.id}: 待审核`,
        affectedRole: ["leader"],
        createdAt: r.submittedAt || now,
      });
    }
  });

  records.forEach((r) => {
    if (r.status === "approved") {
      anomalies.push({
        id: `archive-${r.id}`,
        type: "unarchived_record",
        trenchNumber: r.trenchNumber,
        stratum: r.stratum,
        relicUnit: r.relicUnit,
        recordId: r.id,
        severity: "warning",
        message: `${r.artifactType} #${r.id}: 待归档`,
        affectedRole: ["archivist"],
        createdAt: r.reviewedAt || now,
      });
    }
  });

  relations.forEach((rel) => {
    const conflict = checkConflictRelationStatic(
      rel.stratumA,
      rel.stratumB,
      rel.relationType,
      relations
    );
    if (conflict.hasConflict) {
      anomalies.push({
        id: `rel-conflict-${rel.id}`,
        type: "stratum_conflict",
        trenchNumber:
          records.find((r) => r.stratum === rel.stratumA)?.trenchNumber ||
          records.find((r) => r.stratum === rel.stratumB)?.trenchNumber ||
          "",
        stratum: rel.stratumA,
        recordId: rel.id,
        severity: "critical",
        message: conflict.message,
        affectedRole: ["leader"],
        createdAt: rel.createdAt,
      });
    }
  });

  return anomalies;
};

const generateStratumSummary = (
  trenchNumber: string,
  stratumName: string,
  records: ArtifactRecord[],
  relations: StratumRelation[],
  validatedRecords: ValidatedArtifactRecord[]
): StratumSummary => {
  const stratumRecords = records.filter(
    (r) => r.trenchNumber === trenchNumber && r.stratum === stratumName
  );

  const validatedStratumRecords = validatedRecords.filter(
    (r) => r.trenchNumber === trenchNumber && r.stratum === stratumName
  );

  const hasRelations = relations.some(
    (r) => r.stratumA === stratumName || r.stratumB === stratumName
  );

  const anomalyCount = validatedStratumRecords.filter(
    (r) => !r.isCoordinateValid
  ).length;

  const lastUpdated = stratumRecords.length > 0
    ? stratumRecords.reduce((latest, r) => {
        const rTime = new Date(r.createdAt).getTime();
        return rTime > new Date(latest).getTime() ? r.createdAt : latest;
      }, stratumRecords[0].createdAt)
    : "";

  return {
    name: stratumName,
    trenchNumber,
    artifactCount: stratumRecords.length,
    pendingReviewCount: stratumRecords.filter((r) => r.status === "pending").length,
    approvedCount: stratumRecords.filter((r) => r.status === "approved").length,
    archivedCount: stratumRecords.filter((r) => r.status === "archived").length,
    rejectedCount: stratumRecords.filter((r) => r.status === "rejected").length,
    hasRelations,
    anomalyCount,
    lastUpdated,
  };
};

const generateRelicUnitSummary = (
  trenchNumber: string,
  relicUnitName: string,
  records: ArtifactRecord[]
): RelicUnitSummary => {
  const relicRecords = records.filter(
    (r) => r.trenchNumber === trenchNumber && r.relicUnit === relicUnitName
  );

  const stratum = relicRecords[0]?.stratum || "";

  return {
    name: relicUnitName,
    trenchNumber,
    stratum,
    artifactCount: relicRecords.length,
    pendingReviewCount: relicRecords.filter((r) => r.status === "pending").length,
    approvedCount: relicRecords.filter((r) => r.status === "approved").length,
    archivedCount: relicRecords.filter((r) => r.status === "archived").length,
    anomalyCount: relicRecords.filter((r) => {
      const eCheck = isValidCoordinateFormat(r.eCoordinate);
      const nCheck = isValidCoordinateFormat(r.nCoordinate);
      return !eCheck.valid || !nCheck.valid;
    }).length,
  };
};

const generateTrenchSummaries = (
  records: ArtifactRecord[],
  relations: StratumRelation[],
  validatedRecords: ValidatedArtifactRecord[]
): TrenchSummary[] => {
  const trenchNumbers = Array.from(
    new Set(records.map((r) => r.trenchNumber))
  ).sort();

  return trenchNumbers.map((trenchNumber) => {
    const trenchRecords = records.filter((r) => r.trenchNumber === trenchNumber);
    const validatedTrenchRecords = validatedRecords.filter(
      (r) => r.trenchNumber === trenchNumber
    );

    const strataNames = Array.from(
      new Set(trenchRecords.map((r) => r.stratum).filter(Boolean))
    ).sort();

    const relicUnitNames = Array.from(
      new Set(trenchRecords.map((r) => r.relicUnit).filter((v): v is string => Boolean(v)))
    ).sort();

    const strata = strataNames.map((s) =>
      generateStratumSummary(trenchNumber, s, records, relations, validatedRecords)
    );

    const relicUnits = relicUnitNames.map((ru) =>
      generateRelicUnitSummary(trenchNumber, ru, records)
    );

    const totalArtifacts = trenchRecords.length;
    const archived = trenchRecords.filter((r) => r.status === "archived").length;
    const progressPercent =
      totalArtifacts > 0 ? Math.round((archived / totalArtifacts) * 100) : 0;

    const coordinateAnomalies = validatedTrenchRecords.filter(
      (r) => !r.isCoordinateValid
    ).length;

    const fieldAnomalies = trenchRecords.filter((r) => {
      return REQUIRED_FIELDS.some((f) => {
        const v = r[f];
        return typeof v === "string" && (!v || v.trim() === "");
      });
    }).length;

    const relationIssues = generatePendingRelations(trenchRecords, relations).length;

    const lastActivity = trenchRecords.length > 0
      ? trenchRecords.reduce((latest, r) => {
          const rTime = new Date(r.createdAt).getTime();
          return rTime > new Date(latest).getTime() ? r.createdAt : latest;
        }, trenchRecords[0].createdAt)
      : "";

    return {
      trenchNumber,
      strata,
      relicUnits,
      totalArtifacts,
      pendingReview: trenchRecords.filter((r) => r.status === "pending").length,
      approved: trenchRecords.filter((r) => r.status === "approved").length,
      archived,
      rejected: trenchRecords.filter((r) => r.status === "rejected").length,
      coordinateAnomalies,
      fieldAnomalies,
      relationIssues,
      progressPercent,
      lastActivity,
    };
  });
};

const generateUnorganizedStats = (
  records: ArtifactRecord[],
  validatedRecords: ValidatedArtifactRecord[]
): UnorganizedStats => {
  const totalRecords = records.length;

  const missingCoordinates = validatedRecords.filter(
    (r) =>
      !r.isCoordinateValid &&
      (r.coordinateError?.includes("为空") ||
        !r.eCoordinate.trim() ||
        !r.nCoordinate.trim())
  ).length;

  const invalidCoordinates = validatedRecords.filter(
    (r) => !r.isCoordinateValid && r.eCoordinate.trim() && r.nCoordinate.trim()
  ).length;

  const missingRequiredFields = records.filter((r) =>
    REQUIRED_FIELDS.some((f) => {
      const v = r[f];
      return typeof v === "string" && (!v || v.trim() === "");
    })
  ).length;

  const withoutRelicUnit = records.filter(
    (r) => !r.relicUnit || r.relicUnit.trim() === ""
  ).length;

  const withoutQuantity = records.filter(
    (r) => !r.quantity || r.quantity.trim() === ""
  ).length;

  return {
    totalRecords,
    missingCoordinates,
    invalidCoordinates,
    missingRequiredFields,
    withoutRelicUnit,
    withoutQuantity,
  };
};

const generateRoleViewData = (
  role: UserRole,
  missingFields: MissingFieldItem[],
  pendingRelations: PendingRelationItem[],
  pendingArchives: PendingArchiveItem[],
  anomalies: AnomalyRecord[]
): RoleBasedViewData => {
  const roleName = roleNames[role];

  let items: RoleBasedViewData["items"] = [];
  let priorityItems = 0;
  let summary: RoleBasedViewData["summary"] = [];

  if (role === "excavator") {
    const invalidCoordAnomalies = anomalies.filter(
      (a) => a.type === "invalid_coordinate"
    );
    items = [
      ...missingFields,
      ...invalidCoordAnomalies,
    ];
    priorityItems = missingFields.length;
    const coordMissingCount = anomalies.filter(
      (a) => a.type === "missing_coordinate"
    ).length;
    const coordInvalidCount = invalidCoordAnomalies.length;
    summary = [
      { label: "待补录字段", value: missingFields.length, trend: missingFields.length > 5 ? "up" : missingFields.length === 0 ? "down" : "stable" },
      { label: "坐标缺失", value: coordMissingCount, trend: coordMissingCount > 3 ? "up" : coordMissingCount === 0 ? "down" : "stable" },
      { label: "坐标格式错误", value: coordInvalidCount, trend: coordInvalidCount > 2 ? "up" : coordInvalidCount === 0 ? "down" : "stable" },
    ];
  } else if (role === "leader") {
    const unreviewedAnomalies = anomalies.filter(
      (a) => a.type === "unreviewed_record"
    );
    items = [
      ...pendingRelations,
      ...unreviewedAnomalies,
    ];
    const criticalCount = pendingRelations.filter((i) => i.hasConflictingRelation).length;
    priorityItems = criticalCount + unreviewedAnomalies.length;
    summary = [
      { label: "待复核关系", value: pendingRelations.length, trend: pendingRelations.length > 3 ? "up" : pendingRelations.length === 0 ? "down" : "stable" },
      { label: "待审核记录", value: unreviewedAnomalies.length, trend: unreviewedAnomalies.length > 5 ? "up" : unreviewedAnomalies.length === 0 ? "down" : "stable" },
      { label: "关系冲突", value: criticalCount, trend: criticalCount > 0 ? "up" : "stable" },
    ];
  } else if (role === "archivist") {
    items = [...pendingArchives];
    priorityItems = pendingArchives.length;
    const archivedCount = anomalies.filter(
      (a) => a.type === "unarchived_record"
    ).length;
    summary = [
      { label: "待归档记录", value: pendingArchives.length, trend: pendingArchives.length > 10 ? "up" : pendingArchives.length === 0 ? "down" : "stable" },
      { label: "已通过待归档", value: archivedCount, trend: archivedCount > 10 ? "up" : archivedCount === 0 ? "down" : "stable" },
    ];
  }

  return {
    role,
    roleName,
    priorityItems,
    items,
    summary,
  };
};

const generateOverviewState = (
  records: ArtifactRecord[],
  relations: StratumRelation[],
  validatedRecords: ValidatedArtifactRecord[]
): OverviewState => {
  const trenches = generateTrenchSummaries(records, relations, validatedRecords);
  const anomalies = generateAnomalies(records, relations, validatedRecords);
  const missingFields = generateMissingFields(records);
  const pendingRelations = generatePendingRelations(records, relations);
  const pendingArchives = generatePendingArchives(records);
  const unorganizedStats = generateUnorganizedStats(records, validatedRecords);

  const roleViews = {
    excavator: generateRoleViewData(
      "excavator",
      missingFields,
      pendingRelations,
      pendingArchives,
      anomalies
    ),
    leader: generateRoleViewData(
      "leader",
      missingFields,
      pendingRelations,
      pendingArchives,
      anomalies
    ),
    archivist: generateRoleViewData(
      "archivist",
      missingFields,
      pendingRelations,
      pendingArchives,
      anomalies
    ),
  };

  const totalRecords = records.length;
  const archivedRecords = records.filter((r) => r.status === "archived").length;
  const overallProgress =
    totalRecords > 0 ? Math.round((archivedRecords / totalRecords) * 100) : 0;

  return {
    trenches,
    anomalies,
    missingFields,
    pendingRelations,
    pendingArchives,
    unorganizedStats,
    roleViews,
    overallProgress,
    lastUpdated: new Date().toLocaleString("zh-CN"),
  };
};

const artifactTypeColors: Record<string, string> = {
  "陶片": "#854d0e",
  "石器": "#475569",
  "骨器": "#92400e",
  "青铜器": "#ca8a04",
  "瓷器": "#0891b2",
  "铁器": "#78716c",
  "动植物遗存": "#16a34a",
  "其他": "#db2777"
};

const getArtifactTypeColor = (type: string): string => {
  return artifactTypeColors[type] || "#6b7280";
};

function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>("excavator");
  const [reviewModalRecord, setReviewModalRecord] = useState<ArtifactRecord | null>(null);
  const [reviewReason, setReviewReason] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
  const [showBatchReviewModal, setShowBatchReviewModal] = useState<boolean>(false);
  const [batchReviewType, setBatchReviewType] = useState<"approve" | "reject">("approve");
  const [batchReviewReason, setBatchReviewReason] = useState<string>("");

  const [artifactRecords, setArtifactRecords] = useState<ArtifactRecord[]>(initialArtifactRecords);
  const [formData, setFormData] = useState<ArtifactFormData>({
    trenchNumber: "",
    stratum: "",
    relicUnit: "",
    artifactType: "",
    eCoordinate: "",
    nCoordinate: "",
    depth: "",
    quantity: "",
    remarks: ""
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    trenchNumber: "",
    stratum: "",
    relicUnit: "",
    artifactKeyword: ""
  });
  const [excavationLogs, setExcavationLogs] = useState<ExcavationLog[]>(initialExcavationLogs);

  const [gridTrenchFilter, setGridTrenchFilter] = useState<string>("");
  const [gridStratumFilter, setGridStratumFilter] = useState<string>("");
  const [gridArtifactTypeFilter, setGridArtifactTypeFilter] = useState<Set<string>>(new Set(artifactTypes));
  const [hoveredPoint, setHoveredPoint] = useState<ValidatedArtifactRecord | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [logFormData, setLogFormData] = useState<ExcavationLogFormData>({
    date: new Date().toISOString().split("T")[0],
    weather: "",
    participants: "",
    excavationArea: "",
    mainFindings: "",
    pendingReview: ""
  });
  const [logFormErrors, setLogFormErrors] = useState<ExcavationLogFormErrors>({});
  const [stratumRelations, setStratumRelations] = useState<StratumRelation[]>(initialStratumRelations);
  const [relationFormData, setRelationFormData] = useState<StratumRelationFormData>({
    stratumA: "",
    stratumB: "",
    relationType: ""
  });
  const [relationFormErrors, setRelationFormErrors] = useState<StratumRelationFormErrors>({});

  const [batchCsvText, setBatchCsvText] = useState<string>("");
  const [batchParseResult, setBatchParseResult] = useState<ParsedImportResult | null>(null);
  const [batchParseError, setBatchParseError] = useState<string>("");
  const [importResultSummary, setImportResultSummary] = useState<ImportResultSummary | null>(null);

  const [indexedDBSupported, setIndexedDBSupported] = useState<boolean>(true);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [showDraftBox, setShowDraftBox] = useState<boolean>(false);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [draftSaveMessage, setDraftSaveMessage] = useState<string>("");
  const [showSaveDraftModal, setShowSaveDraftModal] = useState<boolean>(false);
  const [draftDeleteConfirm, setDraftDeleteConfirm] = useState<number | null>(null);
  const [draftFilterTrench, setDraftFilterTrench] = useState<string>("");
  const [draftFilterStratum, setDraftFilterStratum] = useState<string>("");
  const [draftFilterType, setDraftFilterType] = useState<string>("");
  const [draftFilterKeyword, setDraftFilterKeyword] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");

  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [editingRelationContext, setEditingRelationContext] = useState<{
    stratumA: string;
    stratumB: string;
    relationId?: number;
    action: "fix_duplicate";
  } | null>(null);
  const [recheckToken, setRecheckToken] = useState<number>(0);
  const [autoScrollBackToExport, setAutoScrollBackToExport] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  useEffect(() => {
    if (autoScrollBackToExport) {
      const timer = setTimeout(() => {
        const target = document.querySelector(".export-module-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          target.classList.add("export-module-flash");
          setTimeout(() => target.classList.remove("export-module-flash"), 2000);
        }
        setAutoScrollBackToExport(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoScrollBackToExport]);

  const values = project.metrics.map((metric: string, index: number) => {
    const base = [84, 12, 31, 7][index % 4];
    if (metric === "出土物") {
      return String(base + index * 3 + artifactRecords.length);
    }
    return String(base + index * 3);
  });

  const validatedRecords: ValidatedArtifactRecord[] = artifactRecords.map(validateRecordCoordinates);

  const overviewState: OverviewState = generateOverviewState(
    artifactRecords,
    stratumRelations,
    validatedRecords
  );

  const availableGridTrenches: string[] = Array.from(
    new Set(validatedRecords.map(r => r.trenchNumber).filter(Boolean))
  ).sort();

  const defaultTrench = availableGridTrenches.length > 0 ? availableGridTrenches[0] : "";
  const actualTrenchFilter = gridTrenchFilter || defaultTrench;

  const availableGridStrata: string[] = Array.from(
    new Set(
      validatedRecords
        .filter(r => !actualTrenchFilter || r.trenchNumber === actualTrenchFilter)
        .map(r => r.stratum)
        .filter(Boolean)
    )
  ).sort();

  const effectiveStratumFilter = availableGridStrata.includes(gridStratumFilter)
    ? gridStratumFilter
    : "";
  const defaultStratum = availableGridStrata.length > 0 ? availableGridStrata[0] : "";
  const actualStratumFilter = effectiveStratumFilter || defaultStratum;

  const gridScopedRecords: ValidatedArtifactRecord[] = validatedRecords.filter(r => {
    const matchTrench = !actualTrenchFilter || r.trenchNumber === actualTrenchFilter;
    const matchStratum = !actualStratumFilter || r.stratum === actualStratumFilter;
    return matchTrench && matchStratum;
  });

  const gridFilteredRecords = gridScopedRecords.filter(r => gridArtifactTypeFilter.has(r.artifactType));
  const validGridPoints = gridFilteredRecords.filter(r => r.isCoordinateValid);
  const invalidGridRecords = gridScopedRecords.filter(r => !r.isCoordinateValid);

  const gridMaxE = validGridPoints.length > 0
    ? Math.max(...validGridPoints.map(r => r.eValue!).filter(v => v !== null && !isNaN(v)), 5)
    : 5;
  const gridMaxN = validGridPoints.length > 0
    ? Math.max(...validGridPoints.map(r => r.nValue!).filter(v => v !== null && !isNaN(v)), 5)
    : 5;

  const GRID_CELL_SIZE = 60;
  const GRID_PADDING = 40;
  const gridCols = Math.ceil(gridMaxE) + 1;
  const gridRows = Math.ceil(gridMaxN) + 1;
  const gridWidth = gridCols * GRID_CELL_SIZE + GRID_PADDING * 2;
  const gridHeight = gridRows * GRID_CELL_SIZE + GRID_PADDING * 2;

  const mapPointToGrid = (e: number, n: number): { x: number; y: number } => {
    return {
      x: GRID_PADDING + e * GRID_CELL_SIZE,
      y: GRID_PADDING + (gridRows - 1 - n) * GRID_CELL_SIZE
    };
  };

  const handleGridPointHover = (
    e: React.MouseEvent<HTMLDivElement>,
    record: ValidatedArtifactRecord | null
  ) => {
    if (record) {
      const rect = (e.currentTarget.closest(".grid-container") as HTMLElement).getBoundingClientRect();
      setHoveredPoint(record);
      setHoverPosition({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    } else {
      setHoveredPoint(null);
      setHoverPosition(null);
    }
  };

  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hoveredPoint) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHoverPosition({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    }
  };

  const handleGridTrenchChange = (value: string) => {
    setGridTrenchFilter(value);
    setGridStratumFilter("");
  };

  const toggleArtifactTypeFilter = (type: string) => {
    setGridArtifactTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const selectAllArtifactTypes = () => {
    setGridArtifactTypeFilter(new Set(artifactTypes));
  };

  const clearAllArtifactTypes = () => {
    setGridArtifactTypeFilter(new Set());
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.trenchNumber.trim()) {
      errors.trenchNumber = "请输入探方编号";
    }
    if (!formData.stratum.trim()) {
      errors.stratum = "请输入地层";
    }
    if (!formData.artifactType.trim()) {
      errors.artifactType = "请选择出土物类型";
    }
    if (!formData.eCoordinate.trim()) {
      errors.eCoordinate = "请输入E坐标";
    }
    if (!formData.nCoordinate.trim()) {
      errors.nCoordinate = "请输入N坐标";
    }
    if (!formData.depth.trim()) {
      errors.depth = "请输入深度";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof ArtifactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    const now = new Date().toLocaleString("zh-CN");

    if (editingRecordId !== null) {
      const originalRecord = artifactRecords.find(r => r.id === editingRecordId);
      setArtifactRecords(prev => prev.map(r => {
        if (r.id === editingRecordId) {
          return {
            ...r,
            trenchNumber: formData.trenchNumber,
            stratum: formData.stratum,
            relicUnit: formData.relicUnit.trim() || undefined,
            artifactType: formData.artifactType,
            eCoordinate: formData.eCoordinate,
            nCoordinate: formData.nCoordinate,
            depth: formData.depth,
            quantity: formData.quantity.trim() || undefined,
            remarks: formData.remarks,
            submittedAt: originalRecord?.status === "pending" ? now : r.submittedAt,
            status: originalRecord?.status === "rejected" ? "pending" : r.status,
            reviewReason: originalRecord?.status === "rejected" ? undefined : r.reviewReason,
            reviewedBy: originalRecord?.status === "rejected" ? undefined : r.reviewedBy,
            reviewedAt: originalRecord?.status === "rejected" ? undefined : r.reviewedAt,
          };
        }
        return r;
      }));
      const updatedRecord = artifactRecords.find(r => r.id === editingRecordId);
      showToast(`已保存记录 #${editingRecordId} 的修改${updatedRecord?.status === "rejected" ? "，已重新提交待审核" : ""}`);
      setRecheckToken(prev => prev + 1);
      setAutoScrollBackToExport(true);
      handleClear();
    } else {
      const newRecord: ArtifactRecord = {
        id: Date.now(),
        trenchNumber: formData.trenchNumber,
        stratum: formData.stratum,
        relicUnit: formData.relicUnit.trim() || undefined,
        artifactType: formData.artifactType,
        eCoordinate: formData.eCoordinate,
        nCoordinate: formData.nCoordinate,
        depth: formData.depth,
        quantity: formData.quantity.trim() || undefined,
        remarks: formData.remarks,
        createdAt: now,
        status: "pending",
        submittedBy: `${roleNames[currentRole]}-当前用户`,
        submittedAt: now
      };
      setArtifactRecords(prev => [newRecord, ...prev]);
      handleClear();
    }
  };

  const handleApprove = (id: number) => {
    const now = new Date().toLocaleString("zh-CN");
    setArtifactRecords(prev => prev.map(r => {
      if (r.id === id && r.status === "pending") {
        return {
          ...r,
          status: "approved",
          reviewReason: reviewReason || "记录完整，审核通过",
          reviewedBy: `${roleNames[currentRole]}-当前用户`,
          reviewedAt: now
        };
      }
      return r;
    }));
    setReviewModalRecord(null);
    setReviewReason("");
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const handleReject = (id: number) => {
    if (!reviewReason.trim()) {
      return;
    }
    const now = new Date().toLocaleString("zh-CN");
    setArtifactRecords(prev => prev.map(r => {
      if (r.id === id && r.status === "pending") {
        return {
          ...r,
          status: "rejected",
          reviewReason: reviewReason,
          reviewedBy: `${roleNames[currentRole]}-当前用户`,
          reviewedAt: now
        };
      }
      return r;
    }));
    setReviewModalRecord(null);
    setReviewReason("");
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const handleArchive = (id: number) => {
    const now = new Date().toLocaleString("zh-CN");
    setArtifactRecords(prev => prev.map(r => {
      if (r.id === id && r.status === "approved") {
        return {
          ...r,
          status: "archived",
          archivedBy: `${roleNames[currentRole]}-当前用户`,
          archivedAt: now
        };
      }
      return r;
    }));
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const handleResubmit = (id: number) => {
    const now = new Date().toLocaleString("zh-CN");
    setArtifactRecords(prev => prev.map(r => {
      if (r.id === id && r.status === "rejected") {
        return {
          ...r,
          status: "pending",
          submittedAt: now,
          reviewReason: undefined,
          reviewedBy: undefined,
          reviewedAt: undefined
        };
      }
      return r;
    }));
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const handleToggleSelect = (id: number) => {
    setSelectedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const pendingIds = visiblePendingRecords.map(r => r.id);
    const allSelected = pendingIds.every(id => selectedRecordIds.has(id));
    if (allSelected) {
      setSelectedRecordIds(prev => {
        const next = new Set(prev);
        pendingIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedRecordIds(prev => {
        const next = new Set(prev);
        pendingIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleBatchApprove = () => {
    setBatchReviewType("approve");
    setBatchReviewReason("");
    setShowBatchReviewModal(true);
  };

  const handleBatchReject = () => {
    setBatchReviewType("reject");
    setBatchReviewReason("");
    setShowBatchReviewModal(true);
  };

  const confirmBatchApprove = () => {
    const now = new Date().toLocaleString("zh-CN");
    const validIds = new Set(
      Array.from(selectedRecordIds).filter(id => visiblePendingIds.has(id))
    );
    setArtifactRecords(prev => prev.map(r => {
      if (validIds.has(r.id)) {
        return {
          ...r,
          status: "approved",
          reviewReason: batchReviewReason || "记录完整，审核通过",
          reviewedBy: `${roleNames[currentRole]}-当前用户`,
          reviewedAt: now
        };
      }
      return r;
    }));
    setSelectedRecordIds(new Set());
    setShowBatchReviewModal(false);
    setBatchReviewReason("");
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const confirmBatchReject = () => {
    if (!batchReviewReason.trim()) {
      return;
    }
    const now = new Date().toLocaleString("zh-CN");
    const validIds = new Set(
      Array.from(selectedRecordIds).filter(id => visiblePendingIds.has(id))
    );
    setArtifactRecords(prev => prev.map(r => {
      if (validIds.has(r.id)) {
        return {
          ...r,
          status: "rejected",
          reviewReason: batchReviewReason,
          reviewedBy: `${roleNames[currentRole]}-当前用户`,
          reviewedAt: now
        };
      }
      return r;
    }));
    setSelectedRecordIds(new Set());
    setShowBatchReviewModal(false);
    setBatchReviewReason("");
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const handleClear = () => {
    setFormData({
      trenchNumber: "",
      stratum: "",
      relicUnit: "",
      artifactType: "",
      eCoordinate: "",
      nCoordinate: "",
      depth: "",
      quantity: "",
      remarks: ""
    });
    setFormErrors({});
    setCurrentDraftId(null);
    setDraftName("");
    setEditingRecordId(null);
    setEditingRelationContext(null);
    setAutoScrollBackToExport(false);
  };

  const handleCopyLastRecord = () => {
    if (artifactRecords.length === 0) {
      return;
    }
    const lastRecord = artifactRecords[0];

    const hasExistingContent = Object.values(formData).some(v => v.trim() !== "");
    if (hasExistingContent) {
      const confirmed = window.confirm(
        "当前表单已有内容，确定要覆盖为上一条记录的信息吗？\n\n将带入：探方、地层、遗迹单位、深度、坐标\n将保留为空：出土物类型、数量、备注"
      );
      if (!confirmed) {
        return;
      }
    }

    setFormData({
      trenchNumber: lastRecord.trenchNumber,
      stratum: lastRecord.stratum,
      relicUnit: lastRecord.relicUnit || "",
      artifactType: "",
      eCoordinate: lastRecord.eCoordinate,
      nCoordinate: lastRecord.nCoordinate,
      depth: lastRecord.depth,
      quantity: "",
      remarks: ""
    });
    setFormErrors({});
    setCurrentDraftId(null);
    setDraftName("");
  };

  const loadDrafts = useCallback(async () => {
    if (!indexedDBSupported) return;
    try {
      const allDrafts = await getAllDrafts();
      setDrafts(allDrafts);
    } catch (error) {
      console.error("加载草稿失败:", error);
    }
  }, [indexedDBSupported]);

  useEffect(() => {
    const supported = isIndexedDBSupported();
    setIndexedDBSupported(supported);
    if (supported) {
      loadDrafts();
    }
  }, [loadDrafts]);

  const handleSaveDraft = async () => {
    if (!indexedDBSupported) return;

    const hasContent = Object.values(formData).some(v => v.trim() !== "");
    if (!hasContent) {
      setDraftSaveMessage("请至少填写一个字段后再保存草稿");
      setTimeout(() => setDraftSaveMessage(""), 3000);
      return;
    }

    setShowSaveDraftModal(true);
    const defaultName = formData.trenchNumber
      ? `${formData.trenchNumber}-${new Date().toLocaleDateString("zh-CN")}`
      : `草稿-${new Date().toLocaleDateString("zh-CN")}`;
    setDraftName(currentDraftId ? drafts.find(d => d.id === currentDraftId)?.draftName || defaultName : defaultName);
  };

  const confirmSaveDraft = async () => {
    if (!indexedDBSupported) return;

    try {
      const id = await saveDraftToDB(
        {
          trenchNumber: formData.trenchNumber,
          stratum: formData.stratum,
          relicUnit: formData.relicUnit,
          artifactType: formData.artifactType,
          eCoordinate: formData.eCoordinate,
          nCoordinate: formData.nCoordinate,
          depth: formData.depth,
          quantity: formData.quantity,
          remarks: formData.remarks,
          draftName: draftName.trim() || `${formData.trenchNumber || "未命名"}-${new Date().toLocaleDateString("zh-CN")}`,
        },
        currentDraftId || undefined
      );
      setCurrentDraftId(id);
      setDraftSaveMessage("草稿保存成功！");
      setShowSaveDraftModal(false);
      await loadDrafts();
      setTimeout(() => setDraftSaveMessage(""), 3000);
    } catch (error) {
      setDraftSaveMessage(error instanceof Error ? error.message : "保存草稿失败");
      setTimeout(() => setDraftSaveMessage(""), 3000);
    }
  };

  const handleRestoreDraft = (draft: DraftRecord) => {
    setFormData({
      trenchNumber: draft.trenchNumber,
      stratum: draft.stratum,
      relicUnit: draft.relicUnit || "",
      artifactType: draft.artifactType,
      eCoordinate: draft.eCoordinate,
      nCoordinate: draft.nCoordinate,
      depth: draft.depth,
      quantity: draft.quantity || "",
      remarks: draft.remarks,
    });
    setCurrentDraftId(draft.id);
    setDraftName(draft.draftName);
    setFormErrors({});
    setShowDraftBox(false);
    
    const artifactSection = document.querySelector(".artifact-collection");
    if (artifactSection) {
      artifactSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSaveAsNewDraft = (draft: DraftRecord) => {
    setFormData({
      trenchNumber: draft.trenchNumber,
      stratum: draft.stratum,
      relicUnit: draft.relicUnit || "",
      artifactType: draft.artifactType,
      eCoordinate: draft.eCoordinate,
      nCoordinate: draft.nCoordinate,
      depth: draft.depth,
      quantity: draft.quantity || "",
      remarks: draft.remarks,
    });
    setCurrentDraftId(null);
    setFormErrors({});
    setShowDraftBox(false);

    const defaultName = draft.trenchNumber
      ? `${draft.trenchNumber}-${new Date().toLocaleDateString("zh-CN")}-副本`
      : `草稿-${new Date().toLocaleDateString("zh-CN")}-副本`;
    setDraftName(defaultName);
    setShowSaveDraftModal(true);

    const artifactSection = document.querySelector(".artifact-collection");
    if (artifactSection) {
      artifactSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleDeleteDraft = async (id: number) => {
    if (!indexedDBSupported) return;
    try {
      await deleteDraftFromDB(id);
      if (currentDraftId === id) {
        setCurrentDraftId(null);
        setDraftName("");
      }
      setDraftDeleteConfirm(null);
      await loadDrafts();
    } catch (error) {
      console.error("删除草稿失败:", error);
    }
  };

  const handleClearAllDrafts = async () => {
    if (!indexedDBSupported) return;
    if (!window.confirm("确定要清空所有草稿吗？此操作不可恢复。")) return;
    try {
      await clearAllDraftsFromDB();
      setCurrentDraftId(null);
      setDraftName("");
      await loadDrafts();
    } catch (error) {
      console.error("清空草稿失败:", error);
    }
  };

  const handleNewFromDraft = () => {
    setCurrentDraftId(null);
    setDraftName("");
    handleSaveDraft();
  };

  const hasDraftFilters = draftFilterTrench || draftFilterStratum || draftFilterType || draftFilterKeyword;

  const draftFilterOptions = {
    trenches: Array.from(new Set(drafts.map(d => d.trenchNumber).filter(Boolean))).sort(),
    strata: Array.from(new Set(drafts.map(d => d.stratum).filter(Boolean))).sort(),
    types: Array.from(new Set(drafts.map(d => d.artifactType).filter(Boolean))).sort(),
  };

  const filteredDrafts: DraftRecord[] = drafts.filter(draft => {
    if (draftFilterTrench && draft.trenchNumber !== draftFilterTrench) return false;
    if (draftFilterStratum && draft.stratum !== draftFilterStratum) return false;
    if (draftFilterType && draft.artifactType !== draftFilterType) return false;
    if (draftFilterKeyword) {
      const keyword = draftFilterKeyword.toLowerCase();
      const matchName = draft.draftName.toLowerCase().includes(keyword);
      const matchRemarks = draft.remarks.toLowerCase().includes(keyword);
      if (!matchName && !matchRemarks) return false;
    }
    return true;
  });

  const clearDraftFilters = () => {
    setDraftFilterTrench("");
    setDraftFilterStratum("");
    setDraftFilterType("");
    setDraftFilterKeyword("");
  };

  const groupedDrafts: Record<string, DraftRecord[]> = filteredDrafts.reduce((acc, draft) => {
    const key = draft.trenchNumber || "未指定探方";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(draft);
    return acc;
  }, {} as Record<string, DraftRecord[]>);

  const handleSearchChange = (field: keyof SearchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleClearSearch = () => {
    setSearchFilters({
      trenchNumber: "",
      stratum: "",
      relicUnit: "",
      artifactKeyword: ""
    });
  };

  const validateLogForm = (): boolean => {
    const errors: ExcavationLogFormErrors = {};
    if (!logFormData.date.trim()) {
      errors.date = "请选择日期";
    }
    if (!logFormData.weather.trim()) {
      errors.weather = "请选择天气";
    }
    if (!logFormData.participants.trim()) {
      errors.participants = "请输入参与人员";
    }
    if (!logFormData.excavationArea.trim()) {
      errors.excavationArea = "请输入发掘区域";
    }
    if (!logFormData.mainFindings.trim()) {
      errors.mainFindings = "请输入主要发现";
    }
    setLogFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogInputChange = (field: keyof ExcavationLogFormData, value: string) => {
    setLogFormData(prev => ({ ...prev, [field]: value }));
    if (logFormErrors[field]) {
      setLogFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleLogSubmit = () => {
    if (!validateLogForm()) {
      return;
    }
    const newLog: ExcavationLog = {
      id: Date.now(),
      ...logFormData,
      createdAt: new Date().toLocaleString("zh-CN")
    };
    setExcavationLogs(prev => [newLog, ...prev]);
    handleLogClear();
  };

  const handleLogClear = () => {
    setLogFormData({
      date: new Date().toISOString().split("T")[0],
      weather: "",
      participants: "",
      excavationArea: "",
      mainFindings: "",
      pendingReview: ""
    });
    setLogFormErrors({});
  };

  const getRelationLabel = (type: RelationType): string => {
    return relationTypeOptions.find(o => o.value === type)?.label || type;
  };

  const getRelationInverseLabel = (type: RelationType): string => {
    return relationTypeOptions.find(o => o.value === type)?.inverse || type;
  };

  const availableStrata = (): string[] => {
    const strataSet = new Set<string>();
    stratumRelations.forEach(r => {
      if (r.stratumA) strataSet.add(r.stratumA);
      if (r.stratumB) strataSet.add(r.stratumB);
    });
    artifactRecords.forEach(r => {
      if (r.stratum) strataSet.add(r.stratum);
    });
    project.records.forEach(record => {
      if (record[1]) strataSet.add(record[1]);
    });
    return Array.from(strataSet).sort();
  };

  const strataOptions = availableStrata();

  const checkDuplicateRelation = (a: string, b: string, type: RelationType, excludeId?: number): boolean => {
    return stratumRelations.some(r => {
      if (excludeId && r.id === excludeId) return false;
      const sameDirection = r.stratumA === a && r.stratumB === b && r.relationType === type;
      return sameDirection;
    });
  };

  const checkConflictRelation = (a: string, b: string, type: RelationType): { hasConflict: boolean; message: string } => {
    for (const r of stratumRelations) {
      if (r.relationType === type) {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} ${getRelationLabel(type)} ${a}"，不能同时存在 "${a} ${getRelationLabel(type)} ${b}"`
          };
        }
      }
      if (type === "contains" && r.relationType === "contains") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 包含 ${a}"，不能同时存在 "${a} 包含 ${b}"`
          };
        }
      }
      if (type === "breaks" && r.relationType === "earlier") {
        if (r.stratumA === a && r.stratumB === b) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${a} 早于 ${b}"，不能同时存在 "${a} 打破 ${b}"（打破意味着年代更晚）`
          };
        }
      }
      if (type === "earlier" && r.relationType === "breaks") {
        if (r.stratumA === a && r.stratumB === b) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${a} 打破 ${b}"，不能同时存在 "${a} 早于 ${b}"（打破意味着年代更晚）`
          };
        }
      }
      if (type === "breaks" && r.relationType === "breaks") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 打破 ${a}"，不能同时存在 "${a} 打破 ${b}"`
          };
        }
      }
      if (type === "earlier" && r.relationType === "earlier") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 早于 ${a}"，不能同时存在 "${a} 早于 ${b}"`
          };
        }
      }
    }
    return { hasConflict: false, message: "" };
  };

  const validateRelationForm = (): boolean => {
    const errors: StratumRelationFormErrors = {};
    if (!relationFormData.stratumA.trim()) {
      errors.stratumA = "请输入地层A名称";
    }
    if (!relationFormData.stratumB.trim()) {
      errors.stratumB = "请输入地层B名称";
    }
    if (relationFormData.stratumA.trim() && relationFormData.stratumB.trim() && relationFormData.stratumA.trim() === relationFormData.stratumB.trim()) {
      errors.stratumB = "地层A和地层B不能相同";
    }
    if (!relationFormData.relationType) {
      errors.relationType = "请选择关系类型";
    }
    if (relationFormData.stratumA.trim() && relationFormData.stratumB.trim() && relationFormData.relationType) {
      const isDuplicate = checkDuplicateRelation(
        relationFormData.stratumA.trim(),
        relationFormData.stratumB.trim(),
        relationFormData.relationType as RelationType
      );
      if (isDuplicate) {
        errors.conflict = `重复：关系 "${relationFormData.stratumA.trim()} ${getRelationLabel(relationFormData.relationType as RelationType)} ${relationFormData.stratumB.trim()}" 已存在`;
      } else {
        const conflict = checkConflictRelation(
          relationFormData.stratumA.trim(),
          relationFormData.stratumB.trim(),
          relationFormData.relationType as RelationType
        );
        if (conflict.hasConflict) {
          errors.conflict = conflict.message;
        }
      }
    }
    setRelationFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRelationInputChange = (field: keyof StratumRelationFormData, value: string) => {
    setRelationFormData(prev => ({ ...prev, [field]: value }));
    if (relationFormErrors[field] || relationFormErrors.conflict) {
      setRelationFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        delete newErrors.conflict;
        return newErrors;
      });
    }
  };

  const handleRelationSubmit = () => {
    if (!validateRelationForm()) {
      return;
    }
    const now = new Date().toLocaleString("zh-CN");

    if (editingRelationContext !== null && editingRelationContext.relationId !== undefined) {
      const oldRelationId = editingRelationContext.relationId;
      setStratumRelations(prev => {
        const filtered = prev.filter(r => r.id !== oldRelationId);
        const newRelation: StratumRelation = {
          id: Date.now(),
          stratumA: relationFormData.stratumA.trim(),
          stratumB: relationFormData.stratumB.trim(),
          relationType: relationFormData.relationType as RelationType,
          createdAt: now
        };
        return [newRelation, ...filtered];
      });
      showToast(`已更新地层关系（原关系 #${oldRelationId} 已替换）`);
      setRecheckToken(prev => prev + 1);
      setAutoScrollBackToExport(true);
      handleRelationClear();
    } else {
      const newRelation: StratumRelation = {
        id: Date.now(),
        stratumA: relationFormData.stratumA.trim(),
        stratumB: relationFormData.stratumB.trim(),
        relationType: relationFormData.relationType as RelationType,
        createdAt: now
      };
      setStratumRelations(prev => [newRelation, ...prev]);
      handleRelationClear();
    }
  };

  const handleRelationClear = () => {
    setRelationFormData({
      stratumA: "",
      stratumB: "",
      relationType: ""
    });
    setRelationFormErrors({});
    setEditingRelationContext(null);
    setAutoScrollBackToExport(false);
  };

  const handleDeleteRelation = (id: number) => {
    setStratumRelations(prev => prev.filter(r => r.id !== id));
    setRecheckToken(prev => prev + 1);
    setAutoScrollBackToExport(true);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const normalizeHeader = (header: string): string | null => {
    const trimmed = header.trim().toLowerCase();
    for (const [alias, key] of Object.entries(HEADER_ALIASES)) {
      if (alias.toLowerCase() === trimmed || trimmed === key.toLowerCase()) {
        return key;
      }
    }
    return null;
  };

  const parseCoordinate = (coord: string): { eCoordinate: string; nCoordinate: string } => {
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

  const validateBatchRow = (row: BatchImportRow): string[] => {
    const errors: string[] = [];
    if (!row.trenchNumber.trim()) errors.push("探方不能为空");
    if (!row.stratum.trim()) errors.push("地层不能为空");
    if (!row.coordinatePoint.trim()) {
      errors.push("坐标点不能为空");
    } else {
      const { eCoordinate, nCoordinate } = parseCoordinate(row.coordinatePoint);
      if (!eCoordinate || !nCoordinate) errors.push("坐标点格式无效，需包含E和N坐标（如 E3.25 N4.50）");
    }
    if (!row.depth.trim()) errors.push("深度不能为空");
    if (!row.artifactType.trim()) {
      errors.push("类型不能为空");
    } else if (!artifactTypes.includes(row.artifactType.trim())) {
      errors.push(`类型必须是：${artifactTypes.join("、")} 之一`);
    }
    if (!row.quantity.trim()) {
      errors.push("数量不能为空");
    } else if (!/^\d+$/.test(row.quantity.trim()) || parseInt(row.quantity.trim()) <= 0) {
      errors.push("数量必须是正整数");
    }
    return errors;
  };

  const normalizeValue = (val: string): string => {
    return val.trim().toLowerCase().replace(/\s+/g, "");
  };

  const normalizeDepth = (depth: string): string => {
    const clean = depth.trim().toLowerCase();
    const numMatch = clean.match(/-?\d+(\.\d+)?/);
    if (numMatch) {
      const num = parseFloat(numMatch[0]);
      return num.toFixed(4);
    }
    return normalizeValue(depth);
  };

  const normalizeCoordinate = (coord: string): { eNorm: string; nNorm: string } => {
    const { eCoordinate, nCoordinate } = parseCoordinate(coord);
    const eNorm = eCoordinate ? parseFloat(eCoordinate).toFixed(4) : normalizeValue(coord);
    const nNorm = nCoordinate ? parseFloat(nCoordinate).toFixed(4) : normalizeValue(coord);
    return { eNorm, nNorm };
  };

  const checkDuplicate = (
    row: BatchImportRow,
    existingRecords: ArtifactRecord[],
    batchProcessedRows: ValidatedBatchImportRow[]
  ): DuplicateCheckResult => {
    const reasons: string[] = [];
    let duplicateWithExisting = false;
    let duplicateWithBatch = false;
    let existingRecordId: number | undefined;

    const rowTrench = normalizeValue(row.trenchNumber);
    const rowStratum = normalizeValue(row.stratum);
    const rowDepth = normalizeDepth(row.depth);
    const rowType = normalizeValue(row.artifactType);
    const { eNorm: rowENorm, nNorm: rowNNorm } = normalizeCoordinate(row.coordinatePoint);

    for (const record of existingRecords) {
      const recTrench = normalizeValue(record.trenchNumber);
      const recStratum = normalizeValue(record.stratum);
      const recDepth = normalizeDepth(record.depth);
      const recType = normalizeValue(record.artifactType);
      const recENorm = record.eCoordinate ? parseFloat(record.eCoordinate).toFixed(4) : "";
      const recNNorm = record.nCoordinate ? parseFloat(record.nCoordinate).toFixed(4) : "";

      const matchTrench = rowTrench === recTrench;
      const matchStratum = rowStratum === recStratum;
      const matchCoord = rowENorm === recENorm && rowNNorm === recNNorm;
      const matchDepth = rowDepth === recDepth;
      const matchType = rowType === recType;

      if (matchTrench && matchStratum && matchCoord && matchDepth && matchType) {
        duplicateWithExisting = true;
        existingRecordId = record.id;
        reasons.push(`与系统现有记录 #${record.id} 重复（探方、地层、坐标、深度、类型均相同）`);
        break;
      }
    }

    if (!duplicateWithExisting) {
      for (const processedRow of batchProcessedRows) {
        const procTrench = normalizeValue(processedRow.trenchNumber);
        const procStratum = normalizeValue(processedRow.stratum);
        const procDepth = normalizeDepth(processedRow.depth);
        const procType = normalizeValue(processedRow.artifactType);
        const { eNorm: procENorm, nNorm: procNNorm } = normalizeCoordinate(processedRow.coordinatePoint);

        const matchTrench = rowTrench === procTrench;
        const matchStratum = rowStratum === procStratum;
        const matchCoord = rowENorm === procENorm && rowNNorm === procNNorm;
        const matchDepth = rowDepth === procDepth;
        const matchType = rowType === procType;

        if (matchTrench && matchStratum && matchCoord && matchDepth && matchType) {
          duplicateWithBatch = true;
          reasons.push(`与本次导入第 ${processedRow.rowNumber} 行重复（探方、地层、坐标、深度、类型均相同）`);
          break;
        }
      }
    }

    return {
      isDuplicate: reasons.length > 0,
      duplicateReasons: reasons,
      duplicateWithExisting,
      duplicateWithBatch,
      existingRecordId,
    };
  };

  const handleBatchParse = () => {
    setBatchParseError("");
    setBatchParseResult(null);
    setImportResultSummary(null);
    const text = batchCsvText.trim();
    if (!text) {
      setBatchParseError("请粘贴CSV文本内容");
      return;
    }
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setBatchParseError("CSV内容至少需要表头行和一行数据");
      return;
    }
    const headerLine = lines[0];
    const rawHeaders = parseCsvLine(headerLine);
    const mappedHeaders: (string | null)[] = rawHeaders.map(h => normalizeHeader(h));
    const missingRequired = batchImportHeaders.filter(h => h.required).filter(
      req => !mappedHeaders.includes(req.key)
    );
    if (missingRequired.length > 0) {
      setBatchParseError(`缺少必要列：${missingRequired.map(h => h.label).join("、")}。请检查表头是否正确。`);
      return;
    }
    const headerIndexMap: Record<string, number> = {};
    mappedHeaders.forEach((key, idx) => {
      if (key) headerIndexMap[key] = idx;
    });
    const validRows: ValidatedBatchImportRow[] = [];
    const duplicateRows: ValidatedBatchImportRow[] = [];
    const errorRows: { row: BatchImportRow; errors: string[] }[] = [];
    const processedForDuplicate: ValidatedBatchImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawValues = parseCsvLine(lines[i]);
      const rowNumber = i + 1;
      const row: BatchImportRow = {
        rowNumber,
        trenchNumber: rawValues[headerIndexMap["trenchNumber"]] ?? "",
        stratum: rawValues[headerIndexMap["stratum"]] ?? "",
        relicUnit: rawValues[headerIndexMap["relicUnit"]] ?? "",
        coordinatePoint: rawValues[headerIndexMap["coordinatePoint"]] ?? "",
        depth: rawValues[headerIndexMap["depth"]] ?? "",
        artifactType: rawValues[headerIndexMap["artifactType"]] ?? "",
        quantity: rawValues[headerIndexMap["quantity"]] ?? ""
      };
      const errors = validateBatchRow(row);
      if (errors.length === 0) {
        const duplicateCheck = checkDuplicate(row, artifactRecords, processedForDuplicate);
        const validatedRow: ValidatedBatchImportRow = {
          ...row,
          duplicateCheck,
          skipImport: duplicateCheck.isDuplicate,
        };
        if (duplicateCheck.isDuplicate) {
          duplicateRows.push(validatedRow);
        } else {
          validRows.push(validatedRow);
        }
        processedForDuplicate.push(validatedRow);
      } else {
        errorRows.push({ row, errors });
      }
    }
    setBatchParseResult({ validRows, duplicateRows, errorRows });
  };

  const toggleSkipDuplicate = (rowNumber: number) => {
    if (!batchParseResult) return;
    setBatchParseResult(prev => {
      if (!prev) return prev;
      const updateRow = (rows: ValidatedBatchImportRow[]): ValidatedBatchImportRow[] =>
        rows.map(r => r.rowNumber === rowNumber ? { ...r, skipImport: !r.skipImport } : r);
      return {
        ...prev,
        validRows: updateRow(prev.validRows),
        duplicateRows: updateRow(prev.duplicateRows),
      };
    });
  };

  const setSkipAllDuplicates = (skip: boolean) => {
    if (!batchParseResult) return;
    setBatchParseResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        duplicateRows: prev.duplicateRows.map(r => ({ ...r, skipImport: skip })),
      };
    });
  };

  const handleBatchConfirm = () => {
    if (!batchParseResult) return;
    const { validRows, duplicateRows, errorRows } = batchParseResult;
    const allValidRows = [...validRows, ...duplicateRows];
    const rowsToImport = allValidRows.filter(r => !r.skipImport);
    const skippedCount = allValidRows.filter(r => r.skipImport).length;
    const duplicateCount = duplicateRows.length;

    if (rowsToImport.length === 0) {
      setImportResultSummary({
        addedCount: 0,
        skippedCount,
        errorCount: errorRows.length,
        duplicateCount,
      });
      setBatchParseResult(null);
      setBatchCsvText("");
      setBatchParseError("");
      return;
    }

    const now = new Date().toLocaleString("zh-CN");
    const newRecords: ArtifactRecord[] = rowsToImport.map((row, idx) => {
      const coords = parseCoordinate(row.coordinatePoint);
      return {
        id: Date.now() + idx,
        trenchNumber: row.trenchNumber.trim(),
        stratum: row.stratum.trim(),
        artifactType: row.artifactType.trim(),
        eCoordinate: coords.eCoordinate,
        nCoordinate: coords.nCoordinate,
        depth: row.depth.trim(),
        remarks: "",
        createdAt: now,
        relicUnit: row.relicUnit.trim() || undefined,
        quantity: row.quantity.trim(),
        status: "pending",
        submittedBy: `${roleNames[currentRole]}-当前用户`,
        submittedAt: now
      };
    });
    setArtifactRecords(prev => [...newRecords, ...prev]);
    setImportResultSummary({
      addedCount: newRecords.length,
      skippedCount,
      errorCount: errorRows.length,
      duplicateCount,
    });
    setBatchParseResult(null);
    setBatchCsvText("");
    setBatchParseError("");
  };

  const handleBatchClear = () => {
    setBatchCsvText("");
    setBatchParseResult(null);
    setBatchParseError("");
    setImportResultSummary(null);
  };

  const filterProjectRecords = (records: string[][]): string[][] => {
    return records.filter(record => {
      const [trench, stratumInfo, relicInfo, artifactInfo] = record;
      const matchTrench = !searchFilters.trenchNumber || 
        trench.toLowerCase().includes(searchFilters.trenchNumber.toLowerCase());
      const matchStratum = !searchFilters.stratum || 
        stratumInfo.toLowerCase().includes(searchFilters.stratum.toLowerCase());
      const matchRelic = !searchFilters.relicUnit || 
        relicInfo.toLowerCase().includes(searchFilters.relicUnit.toLowerCase()) ||
        stratumInfo.toLowerCase().includes(searchFilters.relicUnit.toLowerCase());
      const matchArtifact = !searchFilters.artifactKeyword || 
        artifactInfo.toLowerCase().includes(searchFilters.artifactKeyword.toLowerCase());
      return matchTrench && matchStratum && matchRelic && matchArtifact;
    });
  };

  const filterArtifactRecords = (records: ArtifactRecord[]): ArtifactRecord[] => {
    return records.filter(record => {
      const matchTrench = !searchFilters.trenchNumber || 
        record.trenchNumber.toLowerCase().includes(searchFilters.trenchNumber.toLowerCase());
      const matchStratum = !searchFilters.stratum || 
        record.stratum.toLowerCase().includes(searchFilters.stratum.toLowerCase());
      const matchRelic = !searchFilters.relicUnit || 
        record.stratum.toLowerCase().includes(searchFilters.relicUnit.toLowerCase()) ||
        record.remarks.toLowerCase().includes(searchFilters.relicUnit.toLowerCase());
      const matchArtifact = !searchFilters.artifactKeyword || 
        record.artifactType.toLowerCase().includes(searchFilters.artifactKeyword.toLowerCase()) ||
        record.remarks.toLowerCase().includes(searchFilters.artifactKeyword.toLowerCase());
      return matchTrench && matchStratum && matchRelic && matchArtifact;
    });
  };

  const hasActiveFilters = Object.values(searchFilters).some(v => v.trim() !== "");

  const filteredProjectRecords = filterProjectRecords(project.records);
  const filteredArtifactRecords = filterArtifactRecords(artifactRecords);

  const statusFilteredRecords = statusFilter === "all" 
    ? filteredArtifactRecords 
    : filteredArtifactRecords.filter(r => r.status === statusFilter);

  const statusCounts = {
    all: artifactRecords.length,
    pending: artifactRecords.filter(r => r.status === "pending").length,
    approved: artifactRecords.filter(r => r.status === "approved").length,
    rejected: artifactRecords.filter(r => r.status === "rejected").length,
    archived: artifactRecords.filter(r => r.status === "archived").length
  };

  const filteredStatusCounts = {
    all: filteredArtifactRecords.length,
    pending: filteredArtifactRecords.filter(r => r.status === "pending").length,
    approved: filteredArtifactRecords.filter(r => r.status === "approved").length,
    rejected: filteredArtifactRecords.filter(r => r.status === "rejected").length,
    archived: filteredArtifactRecords.filter(r => r.status === "archived").length
  };

  const visiblePendingRecords = statusFilteredRecords.filter(r => r.status === "pending");
  const visiblePendingIds = new Set(visiblePendingRecords.map(r => r.id));

  useEffect(() => {
    const currentFiltered = statusFilter === "all"
      ? filterArtifactRecords(artifactRecords)
      : filterArtifactRecords(artifactRecords).filter(r => r.status === statusFilter);
    const currentVisiblePendingIds = new Set(
      currentFiltered
        .filter(r => r.status === "pending")
        .map(r => r.id)
    );
    setSelectedRecordIds(prev => {
      let changed = false;
      const next = new Set<number>();
      prev.forEach(id => {
        if (currentVisiblePendingIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [statusFilter, artifactRecords, searchFilters]);

  const validSelectedCount = Array.from(selectedRecordIds).filter(id => visiblePendingIds.has(id)).length;

  const handleOverviewExceptionAction = (action: ExceptionAction) => {
    if (action.type === "missing_field") {
      const record = artifactRecords.find(r => r.id === action.recordId);
      if (!record) {
        showToast(`未找到记录 #${action.recordId}，该记录可能已被删除或归档`);
        return;
      }
      setCurrentRole("excavator");
      setFormData({
        trenchNumber: record.trenchNumber,
        stratum: record.stratum,
        relicUnit: record.relicUnit || "",
        artifactType: record.artifactType,
        eCoordinate: record.eCoordinate,
        nCoordinate: record.nCoordinate,
        depth: record.depth,
        quantity: record.quantity || "",
        remarks: record.remarks,
      });
      setFormErrors({});
      if (record.status === "pending" || record.status === "rejected") {
        setStatusFilter(record.status);
      } else {
        setStatusFilter("all");
      }
      setSearchFilters({
        trenchNumber: record.trenchNumber,
        stratum: record.stratum,
        relicUnit: "",
        artifactKeyword: "",
      });
      setCurrentDraftId(null);
      setDraftName("");
      setTimeout(() => {
        const target = document.querySelector(".records-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => {
            const recordEl = document.querySelector(`[data-record-id="${action.recordId}"]`);
            if (recordEl) {
              recordEl.scrollIntoView({ behavior: "smooth", block: "center" });
              recordEl.classList.add("record-highlight-flash");
              setTimeout(() => recordEl.classList.remove("record-highlight-flash"), 2000);
            }
          }, 500);
        }
      }, 100);
      const statusText: Record<ReviewStatus, string> = {
        pending: "待审核",
        approved: "已通过",
        rejected: "已退回",
        archived: "已归档",
      };
      showToast(`已定位到记录 #${action.recordId}（${statusText[record.status]}），请补录「${action.fieldLabel}」字段`);
    } else if (action.type === "pending_relation") {
      setCurrentRole("leader");
      setRelationFormData({
        stratumA: action.stratumA,
        stratumB: action.stratumB,
        relationType: "",
      });
      setRelationFormErrors({});
      setTimeout(() => {
        const target = document.querySelector(".stratum-relation-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      showToast(`已定位到地层关系区域，请复核「${action.stratumA} ↔ ${action.stratumB}」`);
    } else if (action.type === "pending_archive") {
      const record = artifactRecords.find(r => r.id === action.recordId);
      if (!record) {
        showToast(`未找到记录 #${action.recordId}，该记录可能已被删除或归档`);
        return;
      }
      setCurrentRole("archivist");
      setStatusFilter("approved");
      setSearchFilters({
        trenchNumber: action.trenchNumber,
        stratum: action.stratum,
        relicUnit: "",
        artifactKeyword: action.artifactType,
      });
      setTimeout(() => {
        const target = document.querySelector(".records-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => {
            const recordEl = document.querySelector(`[data-record-id="${action.recordId}"]`);
            if (recordEl) {
              recordEl.scrollIntoView({ behavior: "smooth", block: "center" });
              recordEl.classList.add("record-highlight-flash");
              setTimeout(() => recordEl.classList.remove("record-highlight-flash"), 2000);
            }
          }, 500);
        }
      }, 100);
      showToast(`已定位到记录 #${action.recordId}，请进行归档操作`);
    }
  };

  const handleExportJumpToFix = (action: import("./export/types").RepairChecklistAction) => {
    if (action.type === "fix_coordinate") {
      const record = artifactRecords.find(r => r.id === action.recordId);
      if (!record) {
        showToast(`未找到记录 #${action.recordId}，该记录可能已被删除或归档`);
        return;
      }
      setCurrentRole("excavator");
      setEditingRecordId(action.recordId);
      setEditingRelationContext(null);
      setFormData({
        trenchNumber: record.trenchNumber,
        stratum: record.stratum,
        relicUnit: record.relicUnit || "",
        artifactType: record.artifactType,
        eCoordinate: record.eCoordinate,
        nCoordinate: record.nCoordinate,
        depth: record.depth,
        quantity: record.quantity || "",
        remarks: record.remarks,
      });
      setFormErrors({});
      if (record.status === "pending" || record.status === "rejected") {
        setStatusFilter(record.status);
      } else {
        setStatusFilter("all");
      }
      setSearchFilters({
        trenchNumber: action.trenchNumber || record.trenchNumber,
        stratum: record.stratum,
        relicUnit: "",
        artifactKeyword: "",
      });
      setCurrentDraftId(null);
      setDraftName("");
      setTimeout(() => {
        const target = document.querySelector(".records-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => {
            const recordEl = document.querySelector(`[data-record-id="${action.recordId}"]`);
            if (recordEl) {
              recordEl.scrollIntoView({ behavior: "smooth", block: "center" });
              recordEl.classList.add("record-highlight-flash");
              setTimeout(() => recordEl.classList.remove("record-highlight-flash"), 2000);
            }
          }, 500);
        }
      }, 100);
      showToast(`已进入编辑模式，正在修改记录 #${action.recordId} 的坐标信息`);
    } else if (action.type === "fix_trench_number") {
      const record = artifactRecords.find(r => r.id === action.recordId);
      if (!record) {
        showToast(`未找到记录 #${action.recordId}，该记录可能已被删除或归档`);
        return;
      }
      setCurrentRole("excavator");
      setEditingRecordId(action.recordId);
      setEditingRelationContext(null);
      setFormData({
        trenchNumber: record.trenchNumber,
        stratum: record.stratum,
        relicUnit: record.relicUnit || "",
        artifactType: record.artifactType,
        eCoordinate: record.eCoordinate,
        nCoordinate: record.nCoordinate,
        depth: record.depth,
        quantity: record.quantity || "",
        remarks: record.remarks,
      });
      setFormErrors({});
      setStatusFilter("all");
      setSearchFilters({
        trenchNumber: "",
        stratum: "",
        relicUnit: "",
        artifactKeyword: "",
      });
      setCurrentDraftId(null);
      setDraftName("");
      setTimeout(() => {
        const target = document.querySelector(".records-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => {
            const recordEl = document.querySelector(`[data-record-id="${action.recordId}"]`);
            if (recordEl) {
              recordEl.scrollIntoView({ behavior: "smooth", block: "center" });
              recordEl.classList.add("record-highlight-flash");
              setTimeout(() => recordEl.classList.remove("record-highlight-flash"), 2000);
            }
          }, 500);
        }
      }, 100);
      showToast(`已进入编辑模式，正在修改记录 #${action.recordId} 的探方编号`);
    } else if (action.type === "review_record") {
      const record = artifactRecords.find(r => r.id === action.recordId);
      if (!record) {
        showToast(`未找到记录 #${action.recordId}，该记录可能已被删除或归档`);
        return;
      }
      setCurrentRole("leader");
      setEditingRecordId(null);
      setEditingRelationContext(null);
      setStatusFilter("pending");
      setSearchFilters({
        trenchNumber: action.trenchNumber || record.trenchNumber,
        stratum: record.stratum,
        relicUnit: "",
        artifactKeyword: "",
      });
      setTimeout(() => {
        const target = document.querySelector(".records-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => {
            const recordEl = document.querySelector(`[data-record-id="${action.recordId}"]`);
            if (recordEl) {
              recordEl.scrollIntoView({ behavior: "smooth", block: "center" });
              recordEl.classList.add("record-highlight-flash");
              setTimeout(() => recordEl.classList.remove("record-highlight-flash"), 2000);
            }
          }, 500);
        }
      }, 100);
      showToast(`已定位到待审核记录 #${action.recordId}，请进行审核操作`);
    } else if (action.type === "fix_duplicate_relation") {
      setCurrentRole("leader");
      setEditingRecordId(null);
      setEditingRelationContext({
        stratumA: action.stratumA,
        stratumB: action.stratumB,
        relationId: action.relationId,
        action: "fix_duplicate",
      });
      setRelationFormData({
        stratumA: action.stratumA,
        stratumB: action.stratumB,
        relationType: "",
      });
      setRelationFormErrors({});
      setTimeout(() => {
        const target = document.querySelector(".stratum-relation-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      showToast(`已进入关系编辑模式，请处理「${action.stratumA} ↔ ${action.stratumB}」的重复关系`);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard key={metric} label={metric} value={values[index]} index={index} />
        ))}
      </section>

      <ExcavationOverview
        overviewState={overviewState}
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        onExceptionAction={handleOverviewExceptionAction}
      />

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色切换</h2>
          <div className="chips role-chips">
            {(Object.entries(roleNames) as [UserRole, string][]).map(([role, name]) => (
              <button
                key={role}
                className={currentRole === role ? "role-chip-active" : ""}
                onClick={() => setCurrentRole(role)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="current-role-info">
            <p>当前角色：<strong>{roleNames[currentRole]}</strong></p>
            <p className="role-desc">
              {currentRole === "excavator" && "可提交新记录、重新提交被退回的记录"}
              {currentRole === "leader" && "可审核待审核记录，决定通过或退回"}
              {currentRole === "archivist" && "可将已通过的记录进行归档"}
            </p>
          </div>
          <h2>审核状态筛选</h2>
          <div className="chips status-filter-chips">
            <button
              className={statusFilter === "all" ? "status-chip-active" : ""}
              onClick={() => setStatusFilter("all")}
            >
              全部 ({hasActiveFilters ? filteredStatusCounts.all : statusCounts.all})
            </button>
            <button
              className={statusFilter === "pending" ? "status-chip-active status-pending" : "status-pending"}
              onClick={() => setStatusFilter("pending")}
            >
              待审核 ({hasActiveFilters ? filteredStatusCounts.pending : statusCounts.pending})
            </button>
            <button
              className={statusFilter === "approved" ? "status-chip-active status-approved" : "status-approved"}
              onClick={() => setStatusFilter("approved")}
            >
              已通过 ({hasActiveFilters ? filteredStatusCounts.approved : statusCounts.approved})
            </button>
            <button
              className={statusFilter === "rejected" ? "status-chip-active status-rejected" : "status-rejected"}
              onClick={() => setStatusFilter("rejected")}
            >
              已退回 ({hasActiveFilters ? filteredStatusCounts.rejected : statusCounts.rejected})
            </button>
            <button
              className={statusFilter === "archived" ? "status-chip-active status-archived" : "status-archived"}
              onClick={() => setStatusFilter("archived")}
            >
              已归档 ({hasActiveFilters ? filteredStatusCounts.archived : statusCounts.archived})
            </button>
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {project.filters.map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>{project.domain}</p>
              <h2>记录字段</h2>
            </div>
            <button className="primary-action">新增记录</button>
          </div>
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input placeholder={"填写" + field} />
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="panel artifact-collection">
        <div className="section-heading">
          <div>
            <p>坐标采集</p>
            <h2>出土物坐标采集</h2>
          </div>
          <div className="form-actions">
            {indexedDBSupported && (
              <>
                <button 
                  className="draft-action-btn"
                  onClick={() => setShowDraftBox(!showDraftBox)}
                >
                  📝 草稿箱 ({drafts.length})
                </button>
                <button 
                  className="draft-action-btn"
                  onClick={handleSaveDraft}
                >
                  💾 保存草稿
                </button>
                {currentDraftId && (
                  <button onClick={handleNewFromDraft}>
                    ✨ 新建（不覆盖草稿）
                  </button>
                )}
              </>
            )}
            <button onClick={handleCopyLastRecord}
              disabled={artifactRecords.length === 0}
              title={artifactRecords.length === 0 ? "暂无可复制的记录" : "带入上一条记录的探方、地层、遗迹单位、深度和坐标"}
            >
              📋 复制上一条记录
            </button>
            <button onClick={handleClear}>清空表单</button>
            <button className="primary-action" onClick={handleSubmit}>
              {editingRecordId !== null ? "💾 保存修改" : "➕ 新增记录"}
            </button>
          </div>
          {draftSaveMessage && (
            <div className={`draft-message ${draftSaveMessage.includes("成功") ? "draft-message-success" : "draft-message-error"}`}>
              {draftSaveMessage}
            </div>
          )}
          {editingRecordId !== null && (
            <div className="record-editing-indicator">
              ✏️ 正在编辑记录：<strong>#{editingRecordId}</strong> · 保存后将自动返回导出区复查
            </div>
          )}
          {currentDraftId && (
            <div className="draft-editing-indicator">
              正在编辑草稿：<strong>{draftName}</strong> · 保存时将更新此草稿
            </div>
          )}
          {!indexedDBSupported && (
            <div className="draft-message draft-message-warn">
              ⚠️ 当前浏览器不支持 IndexedDB，离线草稿功能不可用。建议使用现代浏览器（Chrome、Firefox、Safari、Edge）以获得完整功能体验。
            </div>
          )}
        </div>
        <div className="field-grid">
          <label>
            <span>探方编号 <span className="required">*</span></span>
            <input
              placeholder="如 T0203"
              value={formData.trenchNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("trenchNumber", e.target.value)}
              className={formErrors.trenchNumber ? "input-error" : ""}
            />
            {formErrors.trenchNumber && <span className="error-text">{formErrors.trenchNumber}</span>}
          </label>
          <label>
            <span>地层 <span className="required">*</span></span>
            <input
              placeholder="如 第3层"
              value={formData.stratum}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("stratum", e.target.value)}
              className={formErrors.stratum ? "input-error" : ""}
            />
            {formErrors.stratum && <span className="error-text">{formErrors.stratum}</span>}
          </label>
          <label>
            <span>遗迹单位</span>
            <input
              placeholder="如 H12、F2"
              value={formData.relicUnit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("relicUnit", e.target.value)}
            />
          </label>
          <label>
            <span>出土物类型 <span className="required">*</span></span>
            <select
              value={formData.artifactType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange("artifactType", e.target.value)}
              className={formErrors.artifactType ? "input-error" : ""}
            >
              <option value="">请选择类型</option>
              {artifactTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {formErrors.artifactType && <span className="error-text">{formErrors.artifactType}</span>}
          </label>
          <label>
            <span>数量</span>
            <input
              placeholder="如 12"
              value={formData.quantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("quantity", e.target.value)}
            />
          </label>
          <label>
            <span>E坐标 <span className="required">*</span></span>
            <input
              placeholder="如 3.25"
              value={formData.eCoordinate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("eCoordinate", e.target.value)}
              className={formErrors.eCoordinate ? "input-error" : ""}
            />
            {formErrors.eCoordinate && <span className="error-text">{formErrors.eCoordinate}</span>}
          </label>
          <label>
            <span>N坐标 <span className="required">*</span></span>
            <input
              placeholder="如 4.50"
              value={formData.nCoordinate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("nCoordinate", e.target.value)}
              className={formErrors.nCoordinate ? "input-error" : ""}
            />
            {formErrors.nCoordinate && <span className="error-text">{formErrors.nCoordinate}</span>}
          </label>
          <label>
            <span>深度 <span className="required">*</span></span>
            <input
              placeholder="如 0.85m"
              value={formData.depth}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("depth", e.target.value)}
              className={formErrors.depth ? "input-error" : ""}
            />
            {formErrors.depth && <span className="error-text">{formErrors.depth}</span>}
          </label>
          <label className="full-width">
            <span>备注</span>
            <input
              placeholder="其他补充说明"
              value={formData.remarks}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("remarks", e.target.value)}
            />
          </label>
        </div>
      </section>

      {showDraftBox && indexedDBSupported && (
        <section className="panel draft-box-section">
          <div className="section-heading">
            <div>
              <p>离线存储</p>
              <h2>草稿箱</h2>
            </div>
            <div className="form-actions">
              {drafts.length > 0 && (
                <button onClick={handleClearAllDrafts} className="danger-btn">
                  🗑️ 清空所有草稿
                </button>
              )}
              <button onClick={() => setShowDraftBox(false)}>
                关闭
              </button>
            </div>
          </div>
          
          <div className="draft-box-info">
            <p>
              💡 <strong>使用提示：</strong>草稿保存在浏览器本地（IndexedDB），刷新页面后仍然存在。
              同一探方可以保存多份草稿，按保存时间排序显示。
            </p>
          </div>

          {drafts.length > 0 && (
            <div className="draft-filter-bar">
              <div className="draft-filter-row">
                <div className="draft-filter-item">
                  <label>探方</label>
                  <select
                    value={draftFilterTrench}
                    onChange={(e) => setDraftFilterTrench(e.target.value)}
                  >
                    <option value="">全部探方</option>
                    {draftFilterOptions.trenches.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="draft-filter-item">
                  <label>地层</label>
                  <select
                    value={draftFilterStratum}
                    onChange={(e) => setDraftFilterStratum(e.target.value)}
                  >
                    <option value="">全部地层</option>
                    {draftFilterOptions.strata.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="draft-filter-item">
                  <label>出土物类型</label>
                  <select
                    value={draftFilterType}
                    onChange={(e) => setDraftFilterType(e.target.value)}
                  >
                    <option value="">全部类型</option>
                    {draftFilterOptions.types.map(tp => (
                      <option key={tp} value={tp}>{tp}</option>
                    ))}
                  </select>
                </div>
                <div className="draft-filter-item draft-filter-keyword">
                  <label>搜索</label>
                  <input
                    type="text"
                    placeholder="草稿名称或备注关键词..."
                    value={draftFilterKeyword}
                    onChange={(e) => setDraftFilterKeyword(e.target.value)}
                  />
                </div>
                {hasDraftFilters && (
                  <button onClick={clearDraftFilters} className="draft-filter-clear-btn">
                    ✕ 清除筛选
                  </button>
                )}
              </div>
              {hasDraftFilters && (
                <div className="draft-filter-summary">
                  筛选结果：<strong>{filteredDrafts.length}</strong> / {drafts.length} 份草稿
                </div>
              )}
            </div>
          )}

          {drafts.length === 0 ? (
            <div className="empty-state-detail">
              <p className="empty-state">暂无草稿</p>
              <p className="empty-state-hint">在上方表单填写内容后点击"保存草稿"按钮即可保存</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="empty-state-detail empty-state-filtered">
              <p className="empty-state">🔍 未找到匹配的草稿</p>
              <p className="empty-state-hint">尝试调整筛选条件或清除筛选后查看全部草稿</p>
              <button onClick={clearDraftFilters} className="draft-filter-clear-btn draft-filter-clear-btn-large">
                清除所有筛选
              </button>
            </div>
          ) : (
            <div className="draft-groups">
              {Object.entries(groupedDrafts).map(([trench, trenchDrafts]) => (
                <div key={trench} className="draft-group">
                  <div className="draft-group-header">
                    <h3 className="draft-group-title">
                      <span className="trench-icon">📐</span>
                      {trench}
                      <span className="draft-count-badge">{trenchDrafts.length} 份草稿</span>
                    </h3>
                  </div>
                  <div className="draft-list">
                    {trenchDrafts.map((draft, index) => (
                      <article 
                        key={draft.id} 
                        className={`draft-card ${currentDraftId === draft.id ? "draft-card-active" : ""}`}
                      >
                        <div className="draft-card-header">
                          <div className="draft-card-title">
                            <span className="draft-index">{String(index + 1).padStart(2, "0")}</span>
                            <strong>{draft.draftName}</strong>
                            {currentDraftId === draft.id && (
                              <span className="draft-editing-badge">编辑中</span>
                            )}
                          </div>
                          <div className="draft-card-time">
                            {draft.savedAt}
                          </div>
                        </div>
                        
                        <div className="draft-card-summary">
                          {draft.stratum && <span className="draft-summary-item">地层: {draft.stratum}</span>}
                          {draft.relicUnit && <span className="draft-summary-item">遗迹: {draft.relicUnit}</span>}
                          {draft.artifactType && <span className="draft-summary-item">类型: {draft.artifactType}</span>}
                          {draft.quantity && <span className="draft-summary-item">数量: {draft.quantity}</span>}
                          {draft.eCoordinate && draft.nCoordinate && (
                            <span className="draft-summary-item">坐标: E{draft.eCoordinate} N{draft.nCoordinate}</span>
                          )}
                          {draft.depth && <span className="draft-summary-item">深度: {draft.depth}</span>}
                        </div>
                        
                        {draft.remarks && (
                          <p className="draft-card-remarks">
                            <span>备注：</span>{draft.remarks}
                          </p>
                        )}
                        
                        <div className="draft-card-actions">
                          <button 
                            className="action-btn action-restore"
                            onClick={() => handleRestoreDraft(draft)}
                          >
                            ✏️ 恢复编辑
                          </button>
                          <button 
                            className="action-btn action-new-from"
                            onClick={() => handleSaveAsNewDraft(draft)}
                          >
                            ✨ 另存为新记录
                          </button>
                          {draftDeleteConfirm === draft.id ? (
                            <span className="delete-confirm-group">
                              <span className="confirm-text">确定删除？</span>
                              <button 
                                className="action-btn action-delete-confirm"
                                onClick={() => handleDeleteDraft(draft.id)}
                              >
                                确定
                              </button>
                              <button 
                                className="action-btn action-cancel"
                                onClick={() => setDraftDeleteConfirm(null)}
                              >
                                取消
                              </button>
                            </span>
                          ) : (
                            <button 
                              className="action-btn action-delete"
                              onClick={() => setDraftDeleteConfirm(draft.id)}
                            >
                              🗑️ 删除
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showSaveDraftModal && indexedDBSupported && (
        <div className="review-modal-overlay" onClick={() => setShowSaveDraftModal(false)}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3>保存草稿</h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setShowSaveDraftModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="review-modal-body">
              <div className="review-record-summary">
                <p><strong>探方：</strong>{formData.trenchNumber || "未填写"}</p>
                <p><strong>地层：</strong>{formData.stratum || "未填写"}</p>
                <p><strong>遗迹单位：</strong>{formData.relicUnit || "未填写"}</p>
                <p><strong>类型：</strong>{formData.artifactType || "未填写"}</p>
                <p><strong>数量：</strong>{formData.quantity || "未填写"}</p>
                <p><strong>坐标：</strong>E{formData.eCoordinate || "—"} N{formData.nCoordinate || "—"}</p>
                <p><strong>深度：</strong>{formData.depth || "未填写"}</p>
              </div>
              <label className="full-width">
                <span>草稿名称 <span className="required">*</span></span>
                <input
                  placeholder="给这份草稿起个名字，方便以后识别"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  autoFocus
                />
              </label>
            </div>
            <div className="review-modal-footer">
              <button 
                className="modal-cancel-btn"
                onClick={() => setShowSaveDraftModal(false)}
              >
                取消
              </button>
              <button 
                className="modal-approve-btn"
                onClick={confirmSaveDraft}
              >
                {currentDraftId ? "更新草稿" : "保存草稿"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="panel batch-import-section">
        <div className="section-heading">
          <div>
            <p>批量录入</p>
            <h2>出土物批量导入预览</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleBatchClear}>清空内容</button>
            <button className="primary-action" onClick={handleBatchParse}>解析预览</button>
          </div>
        </div>
        <div className="batch-import-hint">
          <p>
            <strong>使用说明：</strong>
            请在下方粘贴 CSV 格式文本，首行为表头。必填字段：<span className="required-field">探方、地层、坐标点、深度、类型、数量</span>；可选字段：遗迹单位。
            坐标点格式示例：<code>E3.25 N4.50</code> 或 <code>3.25,4.50</code>。
          </p>
          <p className="csv-example">
            <strong>示例CSV：</strong>
            <code>探方,地层,遗迹单位,坐标点,深度,类型,数量
T0203,第3层,H12,E3.25 N4.50,0.85m,陶片,12
T0204,第2层,,E1.10 N2.30,0.42m,石器,3</code>
          </p>
        </div>
        <label className="full-width">
          <span>CSV 文本粘贴区 <span className="required">*</span></span>
          <textarea
            className="batch-textarea"
            placeholder="在此粘贴CSV文本，第一行为表头..."
            value={batchCsvText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchCsvText(e.target.value)}
            rows={8}
          />
        </label>
        {batchParseError && (
          <div className="batch-alert batch-alert-error">
            <span className="conflict-icon">✕</span>
            <span>{batchParseError}</span>
          </div>
        )}
        {importResultSummary && (
          <div className="batch-result-summary">
            <div className="batch-result-header">
              <h3>📊 导入结果</h3>
            </div>
            <div className="batch-result-stats">
              <div className="result-stat result-added">
                <span className="result-count">{importResultSummary.addedCount}</span>
                <span className="result-label">条新增</span>
              </div>
              {importResultSummary.skippedCount > 0 && (
                <div className="result-stat result-skipped">
                  <span className="result-count">{importResultSummary.skippedCount}</span>
                  <span className="result-label">条跳过</span>
                </div>
              )}
              {importResultSummary.duplicateCount > 0 && (
                <div className="result-stat result-duplicate">
                  <span className="result-count">{importResultSummary.duplicateCount}</span>
                  <span className="result-label">条重复</span>
                </div>
              )}
              {importResultSummary.errorCount > 0 && (
                <div className="result-stat result-error">
                  <span className="result-count">{importResultSummary.errorCount}</span>
                  <span className="result-label">条错误</span>
                </div>
              )}
            </div>
            <div className="batch-result-detail">
              <p>
                成功导入 <strong>{importResultSummary.addedCount}</strong> 条记录。
                {importResultSummary.skippedCount > 0 && ` 跳过 ${importResultSummary.skippedCount} 条重复记录。`}
                {importResultSummary.errorCount > 0 && ` ${importResultSummary.errorCount} 条因格式错误未能导入。`}
              </p>
            </div>
          </div>
        )}
        {batchParseResult && (
          <div className="batch-preview-area">
            <div className="batch-summary">
              <div className="summary-item summary-valid">
                <span className="summary-count">{batchParseResult.validRows.length}</span>
                <span className="summary-label">条有效记录</span>
              </div>
              {batchParseResult.duplicateRows.length > 0 && (
                <div className="summary-item summary-duplicate">
                  <span className="summary-count">{batchParseResult.duplicateRows.length}</span>
                  <span className="summary-label">条疑似重复</span>
                </div>
              )}
              <div className="summary-item summary-error">
                <span className="summary-count">{batchParseResult.errorRows.length}</span>
                <span className="summary-label">条错误记录</span>
              </div>
              <div className="summary-actions">
                {(() => {
                  const allRows = [...batchParseResult.validRows, ...batchParseResult.duplicateRows];
                  const importCount = allRows.filter(r => !r.skipImport).length;
                  const skipCount = allRows.filter(r => r.skipImport).length;
                  const totalRows = allRows.length;
                  let btnLabel: string;
                  if (importCount === 0 && totalRows > 0) {
                    btnLabel = `确认（全部跳过 ${skipCount} 条重复记录）`;
                  } else if (skipCount > 0) {
                    btnLabel = `确认导入 ${importCount} 条（跳过 ${skipCount} 条重复）`;
                  } else {
                    btnLabel = `确认导入 ${importCount} 条有效记录`;
                  }
                  return (
                    <button
                      className="primary-action batch-confirm-btn"
                      onClick={handleBatchConfirm}
                      disabled={totalRows === 0}
                    >
                      {btnLabel}
                    </button>
                  );
                })()}
              </div>
            </div>
            {batchParseResult.validRows.length > 0 && (
              <div className="preview-table-wrapper">
                <div className="preview-table-title">
                  <h3>✓ 有效数据预览（将被导入）</h3>
                </div>
                <div className="table-scroll">
                  <table className="preview-table preview-table-valid">
                    <thead>
                      <tr>
                        <th>行号</th>
                        {batchImportHeaders.map(h => (
                          <th key={h.key}>
                            {h.label}
                            {h.required && <span className="required">*</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchParseResult.validRows.map((row) => (
                        <tr key={`valid-${row.rowNumber}`}>
                          <td className="row-num">{row.rowNumber}</td>
                          <td>{row.trenchNumber}</td>
                          <td>{row.stratum}</td>
                          <td>{row.relicUnit || <span className="cell-muted">—</span>}</td>
                          <td>{row.coordinatePoint}</td>
                          <td>{row.depth}</td>
                          <td>
                            <span className="type-badge">{row.artifactType}</span>
                          </td>
                          <td className="qty-cell">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {batchParseResult.duplicateRows.length > 0 && (
              <div className="preview-table-wrapper">
                <div className="preview-table-title duplicate-table-title">
                  <h3 className="duplicate-title">⚠ 疑似重复记录</h3>
                  <div className="duplicate-bulk-actions">
                    <span className="duplicate-hint">默认将跳过，可选择是否仍然导入：</span>
                    <button
                      className="bulk-action-btn"
                      onClick={() => setSkipAllDuplicates(true)}
                    >
                      全部跳过
                    </button>
                    <button
                      className="bulk-action-btn bulk-action-force"
                      onClick={() => setSkipAllDuplicates(false)}
                    >
                      全部仍然导入
                    </button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="preview-table preview-table-duplicate">
                    <thead>
                      <tr>
                        <th className="col-skip">
                          跳过
                        </th>
                        <th>行号</th>
                        {batchImportHeaders.map(h => (
                          <th key={h.key}>{h.label}</th>
                        ))}
                        <th>重复原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchParseResult.duplicateRows.map((row) => (
                        <tr
                          key={`dup-${row.rowNumber}`}
                          className={row.skipImport ? "row-skipped" : "row-force-import"}
                        >
                          <td className="col-skip">
                            <label className="skip-checkbox-label">
                              <input
                                type="checkbox"
                                checked={row.skipImport}
                                onChange={() => toggleSkipDuplicate(row.rowNumber)}
                              />
                              <span>{row.skipImport ? "跳过" : "导入"}</span>
                            </label>
                          </td>
                          <td className="row-num row-num-duplicate">{row.rowNumber}</td>
                          <td>{row.trenchNumber}</td>
                          <td>{row.stratum}</td>
                          <td>{row.relicUnit || <span className="cell-muted">—</span>}</td>
                          <td>{row.coordinatePoint}</td>
                          <td>{row.depth}</td>
                          <td>
                            <span className="type-badge">{row.artifactType}</span>
                          </td>
                          <td className="qty-cell">{row.quantity}</td>
                          <td className="duplicate-cell">
                            <ul>
                              {row.duplicateCheck.duplicateReasons.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                            {row.skipImport ? (
                              <span className="status-tag status-skip">将跳过</span>
                            ) : (
                              <span className="status-tag status-force">将仍然导入</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {batchParseResult.errorRows.length > 0 && (
              <div className="preview-table-wrapper">
                <div className="preview-table-title">
                  <h3 className="error-title">⚠ 错误数据摘要（将被忽略）</h3>
                </div>
                <div className="table-scroll">
                  <table className="preview-table preview-table-error">
                    <thead>
                      <tr>
                        <th>行号</th>
                        {batchImportHeaders.map(h => (
                          <th key={h.key}>{h.label}</th>
                        ))}
                        <th>错误信息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchParseResult.errorRows.map(({ row, errors }) => (
                        <tr key={`err-${row.rowNumber}`}>
                          <td className="row-num row-num-error">{row.rowNumber}</td>
                          <td>{row.trenchNumber || <span className="cell-muted">—</span>}</td>
                          <td>{row.stratum || <span className="cell-muted">—</span>}</td>
                          <td>{row.relicUnit || <span className="cell-muted">—</span>}</td>
                          <td>{row.coordinatePoint || <span className="cell-muted">—</span>}</td>
                          <td>{row.depth || <span className="cell-muted">—</span>}</td>
                          <td>{row.artifactType || <span className="cell-muted">—</span>}</td>
                          <td>{row.quantity || <span className="cell-muted">—</span>}</td>
                          <td className="error-cell">
                            <ul>
                              {errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel coordinate-view-section">
        <div className="section-heading">
          <div>
            <p>可视化</p>
            <h2>探方平面坐标视图</h2>
          </div>
          <div className="coordinate-view-summary">
            <span className="summary-badge valid">
              有效点位 {validGridPoints.length}
            </span>
            <span className="summary-badge invalid">
              异常记录 {invalidGridRecords.length}
            </span>
          </div>
        </div>

        <div className="coordinate-view-body">
          <div className="coordinate-view-main">
            <div className="grid-filters">
              <label className="grid-filter-item">
                <span>探方编号</span>
                <select
                  value={actualTrenchFilter}
                  onChange={(e) => handleGridTrenchChange(e.target.value)}
                >
                  <option value="">全部探方</option>
                  {availableGridTrenches.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="grid-filter-item">
                <span>地层</span>
                <select
                  value={actualStratumFilter}
                  onChange={(e) => setGridStratumFilter(e.target.value)}
                >
                  <option value="">全部地层</option>
                  {availableGridStrata.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="grid-legend">
                <div className="legend-header">
                  <span className="legend-label">出土物类型筛选：</span>
                  <div className="legend-actions">
                    <button
                      type="button"
                      className="legend-action-btn"
                      onClick={selectAllArtifactTypes}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      className="legend-action-btn"
                      onClick={clearAllArtifactTypes}
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="legend-items">
                  {artifactTypes.map(type => {
                    const isSelected = gridArtifactTypeFilter.has(type);
                    return (
                      <label
                        key={type}
                        className={`legend-item ${isSelected ? 'selected' : 'deselected'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleArtifactTypeFilter(type)}
                        />
                        <i className="legend-dot" style={{ background: getArtifactTypeColor(type) }} />
                        {type}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="grid-container"
              onMouseMove={handleGridMouseMove}
              onMouseLeave={() => { setHoveredPoint(null); setHoverPosition(null); }}
            >
              {actualTrenchFilter ? (
                <div className="grid-wrapper" style={{ width: gridWidth, height: gridHeight }}>
                  {Array.from({ length: gridRows }).map((_, rowIdx) => (
                    Array.from({ length: gridCols }).map((_, colIdx) => {
                      const n = gridRows - 1 - rowIdx;
                      const e = colIdx;
                      return (
                        <div
                          key={`cell-${e}-${n}`}
                          className="grid-cell"
                          style={{
                            left: GRID_PADDING + colIdx * GRID_CELL_SIZE,
                            top: GRID_PADDING + rowIdx * GRID_CELL_SIZE,
                            width: GRID_CELL_SIZE,
                            height: GRID_CELL_SIZE
                          }}
                        />
                      );
                    })
                  ))}

                  {Array.from({ length: gridCols }).map((_, e) => (
                    <span
                      key={`e-label-${e}`}
                      className="grid-axis-label grid-axis-e"
                      style={{
                        left: GRID_PADDING + e * GRID_CELL_SIZE + GRID_CELL_SIZE / 2,
                        bottom: 12
                      }}
                    >
                      E{e}
                    </span>
                  ))}
                  {Array.from({ length: gridRows }).map((_, i) => {
                    const n = gridRows - 1 - i;
                    return (
                      <span
                        key={`n-label-${n}`}
                        className="grid-axis-label grid-axis-n"
                        style={{
                          left: 12,
                          top: GRID_PADDING + i * GRID_CELL_SIZE + GRID_CELL_SIZE / 2
                        }}
                      >
                        N{n}
                      </span>
                    );
                  })}

                  <div className="grid-origin-label" style={{ left: 8, bottom: 8 }}>
                    ← 西南角 (原点)
                  </div>

                  {validGridPoints.map((record) => {
                    const pos = mapPointToGrid(record.eValue!, record.nValue!);
                    return (
                      <div
                        key={`point-${record.id}`}
                        className="grid-point"
                        style={{
                          left: pos.x,
                          top: pos.y,
                          background: getArtifactTypeColor(record.artifactType),
                          boxShadow: `0 0 0 3px ${getArtifactTypeColor(record.artifactType)}40`
                        }}
                        onMouseEnter={(e) => handleGridPointHover(e, record)}
                        onMouseLeave={(e) => handleGridPointHover(e, null)}
                      />
                    );
                  })}

                  {hoveredPoint && hoverPosition && (
                    <div
                      className="grid-tooltip"
                      style={{
                        left: Math.min(hoverPosition.x, gridWidth - 240),
                        top: Math.min(hoverPosition.y, gridHeight - 160)
                      }}
                    >
                      <div className="tooltip-header">
                        <i
                          className="tooltip-color-dot"
                          style={{ background: getArtifactTypeColor(hoveredPoint.artifactType) }}
                        />
                        <strong>{hoveredPoint.artifactType}</strong>
                        {hoveredPoint.quantity && (
                          <span className="tooltip-qty">×{hoveredPoint.quantity}</span>
                        )}
                      </div>
                      <div className="tooltip-row">
                        <span>探方</span>
                        <strong>{hoveredPoint.trenchNumber}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>地层</span>
                        <strong>{hoveredPoint.stratum}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>坐标</span>
                        <strong>E{hoveredPoint.eCoordinate} · N{hoveredPoint.nCoordinate}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>深度</span>
                        <strong>{hoveredPoint.depth}</strong>
                      </div>
                      {hoveredPoint.relicUnit && (
                        <div className="tooltip-row">
                          <span>遗迹</span>
                          <strong>{hoveredPoint.relicUnit}</strong>
                        </div>
                      )}
                      {hoveredPoint.remarks && (
                        <div className="tooltip-remarks">
                          <span>备注</span>
                          <p>{hoveredPoint.remarks}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid-empty">
                  <div className="grid-empty-icon">📐</div>
                  <p>请先选择探方编号以查看平面坐标分布</p>
                  {availableGridTrenches.length > 0 && (
                    <div className="grid-empty-trenches">
                      <span>可选探方：</span>
                      {availableGridTrenches.map(t => (
                        <button
                          key={t}
                          className="trench-quick-btn"
                          onClick={() => handleGridTrenchChange(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="anomaly-list-panel">
            <div className="anomaly-list-header">
              <h3>
                <span className="anomaly-icon">⚠</span>
                异常记录清单
              </h3>
              <span className="anomaly-count">{invalidGridRecords.length} 条</span>
            </div>
            {invalidGridRecords.length === 0 ? (
              <div className="anomaly-empty">
                <p>🎉 当前筛选条件下无异常记录</p>
                <p className="anomaly-empty-hint">所有出土物坐标均有效</p>
              </div>
            ) : (
              <div className="anomaly-list">
                {invalidGridRecords.map((record, idx) => (
                  <article key={`anomaly-${record.id}`} className="anomaly-card">
                    <div className="anomaly-index">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="anomaly-content">
                      <div className="anomaly-title">
                        <span className="type-badge">{record.artifactType}</span>
                        <strong className="anomaly-id">#{record.id}</strong>
                      </div>
                      <p className="anomaly-meta">
                        {record.trenchNumber} · {record.stratum}
                      </p>
                      <div className="anomaly-coords">
                        <span className={record.eValue !== null ? "coord-ok" : "coord-bad"}>
                          E: {record.eCoordinate || "空"}
                        </span>
                        <span className={record.nValue !== null ? "coord-ok" : "coord-bad"}>
                          N: {record.nCoordinate || "空"}
                        </span>
                      </div>
                      <div className="anomaly-error">
                        <span className="error-icon">!</span>
                        {record.coordinateError}
                      </div>
                      {record.remarks && (
                        <p className="anomaly-remarks">备注：{record.remarks}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="panel search-panel">
        <div className="section-heading">
          <div>
            <p>检索</p>
            <h2>探方快速检索</h2>
          </div>
          <button onClick={handleClearSearch} disabled={!hasActiveFilters}>
            清除筛选
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>探方编号</span>
            <input
              placeholder="如 T0203"
              value={searchFilters.trenchNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("trenchNumber", e.target.value)}
            />
          </label>
          <label>
            <span>地层名称</span>
            <input
              placeholder="如 第3层"
              value={searchFilters.stratum}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("stratum", e.target.value)}
            />
          </label>
          <label>
            <span>遗迹单位</span>
            <input
              placeholder="如 H12、F2"
              value={searchFilters.relicUnit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("relicUnit", e.target.value)}
            />
          </label>
          <label>
            <span>出土物关键词</span>
            <input
              placeholder="如 陶片、动物骨"
              value={searchFilters.artifactKeyword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("artifactKeyword", e.target.value)}
            />
          </label>
        </div>
        {hasActiveFilters && (
          <p className="search-result-info">
            筛选结果：示例记录 {filteredProjectRecords.length} 条 · 采集记录 {filteredArtifactRecords.length} 条
          </p>
        )}
      </section>

      <section className="records-section">
        <section className="panel records">
          <div className="section-heading">
            <div>
              <p>示例数据</p>
              <h2>近期记录</h2>
            </div>
            <div>
              {hasActiveFilters && <span className="filter-badge">筛选中</span>}
              <button>导出摘要</button>
            </div>
          </div>
          <div className="record-list">
            {filteredProjectRecords.length === 0 ? (
              <div className="empty-state-detail">
                <p className="empty-state">暂无匹配的示例记录</p>
                {hasActiveFilters && (
                  <p className="empty-state-hint">请尝试调整筛选条件，或点击"清除筛选"查看全部记录</p>
                )}
              </div>
            ) : (
              filteredProjectRecords.map((record: string[], index: number) => (
                <article key={record.join("-")} className="record-card">
                  <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{record[0]}</h3>
                    <p>{record.slice(1).join(" · ")}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel records">
          <div className="section-heading">
            <div>
              <p>采集数据</p>
              <h2>出土物坐标记录</h2>
            </div>
            <div className="section-heading-right">
              {(hasActiveFilters || statusFilter !== "all") && <span className="filter-badge">筛选中</span>}
              <div>共 {statusFilteredRecords.length} 条</div>
            </div>
          </div>

          {currentRole === "leader" && (
            <div className="batch-action-bar">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={visiblePendingRecords.length > 0 && 
                    visiblePendingRecords.every(r => selectedRecordIds.has(r.id))}
                  onChange={handleSelectAll}
                  disabled={visiblePendingRecords.length === 0}
                />
                <span>全选待审核</span>
              </label>
              <div className="batch-action-buttons">
                <span className="selected-count">
                  已选 {validSelectedCount} 条
                </span>
                <button
                  className="batch-action-btn batch-approve-btn"
                  onClick={handleBatchApprove}
                  disabled={validSelectedCount === 0}
                >
                  批量通过
                </button>
                <button
                  className="batch-action-btn batch-reject-btn"
                  onClick={handleBatchReject}
                  disabled={validSelectedCount === 0}
                >
                  批量退回
                </button>
              </div>
            </div>
          )}
          <div className="record-list">
            {(hasActiveFilters || statusFilter !== "all") && statusFilteredRecords.length === 0 ? (
              <div className="empty-state-detail">
                <p className="empty-state">暂无匹配的采集记录</p>
                <p className="empty-state-hint">请尝试调整筛选条件，或清除筛选查看全部记录</p>
              </div>
            ) : artifactRecords.length === 0 ? (
              <p className="empty-state">暂无出土物坐标记录，请在上方表单录入</p>
            ) : (
              statusFilteredRecords.map((record: ArtifactRecord, index: number) => (
                <article key={record.id} className={`record-card record-status-${record.status} ${selectedRecordIds.has(record.id) ? 'record-selected' : ''}`} data-record-id={record.id}>
                  {currentRole === "leader" && record.status === "pending" && (
                    <div className="record-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.has(record.id)}
                        onChange={() => handleToggleSelect(record.id)}
                      />
                    </div>
                  )}
                  <div className="record-index artifact-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="record-content">
                    <div className="record-header">
                      <h3>
                        {record.trenchNumber} · {record.artifactType}
                        {record.quantity && <span className="qty-tag">×{record.quantity}</span>}
                      </h3>
                      <span 
                        className="status-badge"
                        style={{ 
                          background: `${statusColorsMap[record.status]}15`,
                          color: statusColorsMap[record.status],
                          borderColor: `${statusColorsMap[record.status]}40`
                        }}
                      >
                        {statusLabels[record.status]}
                      </span>
                    </div>
                    <p>
                      地层：{record.stratum}
                      {record.relicUnit && ` · 遗迹：${record.relicUnit}`}
                      {" · 坐标：E"}{record.eCoordinate} N{record.nCoordinate} · 深度：{record.depth}
                    </p>
                    {record.remarks && <p className="record-remarks">备注：{record.remarks}</p>}
                    
                    {record.submittedBy && (
                      <p className="record-meta">
                        <span>提交人：{record.submittedBy}</span>
                        <span>提交时间：{record.submittedAt}</span>
                      </p>
                    )}
                    
                    {record.reviewReason && record.status !== "archived" && (
                      <div className={`review-info review-${record.status}`}>
                        <strong>
                          {record.status === "approved" ? "✓ 审核通过" : "✕ 审核退回"}
                          {record.reviewedBy && ` · ${record.reviewedBy}`}
                        </strong>
                        <p>{record.reviewReason}</p>
                        {record.reviewedAt && <span className="review-time">{record.reviewedAt}</span>}
                      </div>
                    )}
                    
                    {record.archivedBy && (
                      <div className="review-info review-archived">
                        <strong>📦 已归档 · {record.archivedBy}</strong>
                        {record.reviewReason && (
                          <p>
                            ✓ 审核通过{record.reviewedBy && ` · ${record.reviewedBy}`}：
                            {record.reviewReason}
                            {record.reviewedAt && <span className="review-time"> · {record.reviewedAt}</span>}
                          </p>
                        )}
                        {record.archivedAt && <span className="review-time">归档时间：{record.archivedAt}</span>}
                      </div>
                    )}
                    
                    <div className="record-actions">
                      {currentRole === "leader" && record.status === "pending" && (
                        <>
                          <button 
                            className="action-btn action-approve"
                            onClick={() => {
                              setReviewModalRecord(record);
                              setReviewReason("");
                            }}
                          >
                            通过
                          </button>
                          <button 
                            className="action-btn action-reject"
                            onClick={() => {
                              setReviewModalRecord(record);
                              setReviewReason("");
                            }}
                          >
                            退回
                          </button>
                        </>
                      )}
                      {currentRole === "archivist" && record.status === "approved" && (
                        <button 
                          className="action-btn action-archive"
                          onClick={() => handleArchive(record.id)}
                        >
                          归档
                        </button>
                      )}
                      {currentRole === "excavator" && record.status === "rejected" && (
                        <button 
                          className="action-btn action-resubmit"
                          onClick={() => handleResubmit(record.id)}
                        >
                          重新提交
                        </button>
                      )}
                      {record.status === "archived" && (
                        <span className="archived-label">已完成归档</span>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="panel excavation-log-section">
        <div className="section-heading">
          <div>
            <p>日志记录</p>
            <h2>发掘日志</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleLogClear}>清空表单</button>
            <button className="primary-action" onClick={handleLogSubmit}>新增日志</button>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>日期 <span className="required">*</span></span>
            <input
              type="date"
              value={logFormData.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogInputChange("date", e.target.value)}
              className={logFormErrors.date ? "input-error" : ""}
            />
            {logFormErrors.date && <span className="error-text">{logFormErrors.date}</span>}
          </label>
          <label>
            <span>天气 <span className="required">*</span></span>
            <select
              value={logFormData.weather}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLogInputChange("weather", e.target.value)}
              className={logFormErrors.weather ? "input-error" : ""}
            >
              <option value="">请选择天气</option>
              {weatherOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            {logFormErrors.weather && <span className="error-text">{logFormErrors.weather}</span>}
          </label>
          <label>
            <span>参与人员 <span className="required">*</span></span>
            <input
              placeholder="如 张三、李四、王五"
              value={logFormData.participants}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogInputChange("participants", e.target.value)}
              className={logFormErrors.participants ? "input-error" : ""}
            />
            {logFormErrors.participants && <span className="error-text">{logFormErrors.participants}</span>}
          </label>
          <label>
            <span>发掘区域 <span className="required">*</span></span>
            <input
              placeholder="如 T0203、T0204"
              value={logFormData.excavationArea}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogInputChange("excavationArea", e.target.value)}
              className={logFormErrors.excavationArea ? "input-error" : ""}
            />
            {logFormErrors.excavationArea && <span className="error-text">{logFormErrors.excavationArea}</span>}
          </label>
          <label className="full-width">
            <span>主要发现 <span className="required">*</span></span>
            <textarea
              placeholder="详细描述当日的主要发掘发现"
              value={logFormData.mainFindings}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLogInputChange("mainFindings", e.target.value)}
              className={logFormErrors.mainFindings ? "input-error" : ""}
              rows={3}
            />
            {logFormErrors.mainFindings && <span className="error-text">{logFormErrors.mainFindings}</span>}
          </label>
          <label className="full-width">
            <span>待复核事项</span>
            <textarea
              placeholder="需要后续跟进或复核的事项（选填）"
              value={logFormData.pendingReview}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLogInputChange("pendingReview", e.target.value)}
              rows={2}
            />
          </label>
        </div>
      </section>

      <section className="panel excavation-timeline-section">
        <div className="section-heading">
          <div>
            <p>时间线</p>
            <h2>日志时间线</h2>
          </div>
          <div>共 {excavationLogs.length} 条</div>
        </div>
        <div className="timeline">
          {excavationLogs.length === 0 ? (
            <p className="empty-state">暂无发掘日志，请在上方表单录入</p>
          ) : (
            excavationLogs.map((log) => (
              <div key={log.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <div className="timeline-date">
                      <strong>{log.date}</strong>
                      <span className="weather-tag">{log.weather}</span>
                    </div>
                    <span className="timeline-area">{log.excavationArea}</span>
                  </div>
                  <div className="timeline-meta">
                    <span className="timeline-participants">👤 {log.participants}</span>
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-findings">
                      <h4>主要发现</h4>
                      <p>{log.mainFindings}</p>
                    </div>
                    {log.pendingReview && (
                      <div className="timeline-pending">
                        <h4>待复核事项</h4>
                        <p>{log.pendingReview}</p>
                      </div>
                    )}
                  </div>
                  <p className="record-time">{log.createdAt}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel stratum-relation-section">
        <div className="section-heading">
          <div>
            <p>地层关系</p>
            <h2>地层关系矩阵</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleRelationClear}>清空表单</button>
            <button className="primary-action" onClick={handleRelationSubmit}>
              {editingRelationContext !== null ? "💾 保存修改" : "➕ 新增关系"}
            </button>
          </div>
        </div>
        {editingRelationContext !== null && (
          <div className="relation-editing-indicator">
            🔗 正在处理重复关系：<strong>{editingRelationContext.stratumA} ↔ {editingRelationContext.stratumB}</strong>
            · 保存后将自动返回导出区复查
          </div>
        )}
        <div className="relation-type-hints">
          {relationTypeOptions.map(opt => (
            <div key={opt.value} className={`relation-hint relation-${opt.value}`}>
              <span className="relation-hint-label">{opt.label}</span>
              <span className="relation-hint-desc">{opt.description}</span>
            </div>
          ))}
        </div>
        <div className="field-grid relation-form-grid">
          <label>
            <span>地层A <span className="required">*</span></span>
            <input
              list="stratum-options-a"
              placeholder="选择或输入地层名称"
              value={relationFormData.stratumA}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRelationInputChange("stratumA", e.target.value)}
              className={relationFormErrors.stratumA ? "input-error" : ""}
            />
            <datalist id="stratum-options-a">
              {strataOptions.map(s => (
                <option key={`a-${s}`} value={s} />
              ))}
            </datalist>
            {relationFormErrors.stratumA && <span className="error-text">{relationFormErrors.stratumA}</span>}
          </label>
          <label>
            <span>关系类型 <span className="required">*</span></span>
            <select
              value={relationFormData.relationType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRelationInputChange("relationType", e.target.value)}
              className={relationFormErrors.relationType ? "input-error" : ""}
            >
              <option value="">请选择关系类型</option>
              {relationTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}（A {opt.label} B）</option>
              ))}
            </select>
            {relationFormErrors.relationType && <span className="error-text">{relationFormErrors.relationType}</span>}
          </label>
          <label>
            <span>地层B <span className="required">*</span></span>
            <input
              list="stratum-options-b"
              placeholder="选择或输入地层名称"
              value={relationFormData.stratumB}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRelationInputChange("stratumB", e.target.value)}
              className={relationFormErrors.stratumB ? "input-error" : ""}
            />
            <datalist id="stratum-options-b">
              {strataOptions.map(s => (
                <option key={`b-${s}`} value={s} />
              ))}
            </datalist>
            {relationFormErrors.stratumB && <span className="error-text">{relationFormErrors.stratumB}</span>}
          </label>
        </div>
        {strataOptions.length > 0 && (
          <div className="stratum-chips">
            <span className="stratum-chips-label">已有地层：</span>
            {strataOptions.map(s => (
              <button
                key={s}
                type="button"
                className="stratum-chip"
                onClick={() => {
                  if (!relationFormData.stratumA) {
                    handleRelationInputChange("stratumA", s);
                  } else if (!relationFormData.stratumB && relationFormData.stratumA !== s) {
                    handleRelationInputChange("stratumB", s);
                  } else if (relationFormData.stratumA && !relationFormData.stratumB && relationFormData.stratumA === s) {
                  } else {
                    handleRelationInputChange("stratumA", s);
                  }
                }}
                title="点击快速选择地层"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {relationFormErrors.conflict && (
          <div className="conflict-alert">
            <span className="conflict-icon">⚠</span>
            <span>{relationFormErrors.conflict}</span>
          </div>
        )}
        <div className="relation-list-header">
          <h3>关系列表</h3>
          <span className="relation-count">共 {stratumRelations.length} 条记录</span>
        </div>
        <div className="relation-list">
          {stratumRelations.length === 0 ? (
            <p className="empty-state">暂无地层关系记录，请在上方表单录入</p>
          ) : (
            stratumRelations.map((relation, index) => (
              <article key={relation.id} className="relation-card">
                <div className={`relation-index relation-index-${relation.relationType}`}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="relation-content">
                  <div className="relation-statement">
                    <span className="stratum-tag">{relation.stratumA}</span>
                    <span className={`relation-arrow relation-${relation.relationType}`}>
                      {getRelationLabel(relation.relationType)}
                    </span>
                    <span className="stratum-tag">{relation.stratumB}</span>
                  </div>
                  <div className="relation-inverse">
                    反向表述：<span className="stratum-tag">{relation.stratumB}</span>
                    <span className="relation-inverse-label">{getRelationInverseLabel(relation.relationType)}</span>
                    <span className="stratum-tag">{relation.stratumA}</span>
                  </div>
                  <p className="record-time">{relation.createdAt}</p>
                </div>
                <button className="relation-delete" onClick={() => handleDeleteRelation(relation.id)} title="删除此关系">
                  删除
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <StratumRelationGraphView
        relations={stratumRelations}
        artifactRecords={artifactRecords}
        onDeleteRelation={handleDeleteRelation}
      />

      {reviewModalRecord && (
        <div className="review-modal-overlay" onClick={() => setReviewModalRecord(null)}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3>审核记录 #{reviewModalRecord.id}</h3>
              <button 
                className="modal-close-btn" 
                onClick={() => {
                  setReviewModalRecord(null);
                  setReviewReason("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="review-modal-body">
              <div className="review-record-summary">
                <p><strong>探方：</strong>{reviewModalRecord.trenchNumber}</p>
                <p><strong>地层：</strong>{reviewModalRecord.stratum}</p>
                {reviewModalRecord.relicUnit && (
                  <p><strong>遗迹单位：</strong>{reviewModalRecord.relicUnit}</p>
                )}
                <p><strong>类型：</strong>{reviewModalRecord.artifactType}</p>
                {reviewModalRecord.quantity && (
                  <p><strong>数量：</strong>{reviewModalRecord.quantity}</p>
                )}
                <p><strong>坐标：</strong>E{reviewModalRecord.eCoordinate} N{reviewModalRecord.nCoordinate}</p>
                <p><strong>深度：</strong>{reviewModalRecord.depth}</p>
                {reviewModalRecord.remarks && (
                  <p><strong>备注：</strong>{reviewModalRecord.remarks}</p>
                )}
                {reviewModalRecord.submittedBy && (
                  <p><strong>提交人：</strong>{reviewModalRecord.submittedBy}</p>
                )}
              </div>
              <label className="full-width">
                <span>审核意见 <span className="required">*</span></span>
                <textarea
                  placeholder="请输入审核意见..."
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  rows={4}
                />
              </label>
            </div>
            <div className="review-modal-footer">
              <button 
                className="modal-cancel-btn"
                onClick={() => {
                  setReviewModalRecord(null);
                  setReviewReason("");
                }}
              >
                取消
              </button>
              <button 
                className="modal-reject-btn"
                onClick={() => handleReject(reviewModalRecord.id)}
                disabled={!reviewReason.trim()}
              >
                退回
              </button>
              <button 
                className="modal-approve-btn"
                onClick={() => handleApprove(reviewModalRecord.id)}
              >
                通过
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchReviewModal && (
        <div className="review-modal-overlay batch-review-modal-overlay" onClick={() => setShowBatchReviewModal(false)}>
          <div className="review-modal batch-review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h3>
                {batchReviewType === "approve" ? "批量通过" : "批量退回"}
                <span className="batch-count">（共 {validSelectedCount} 条记录）</span>
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={() => {
                  setShowBatchReviewModal(false);
                  setBatchReviewReason("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="review-modal-body">
              <div className="batch-review-summary">
                <p><strong>操作类型：</strong>{batchReviewType === "approve" ? "批量通过" : "批量退回"}</p>
                <p><strong>记录数量：</strong>{validSelectedCount} 条待审核记录</p>
                <p className="batch-review-hint">
                  {batchReviewType === "approve" 
                    ? "以下记录将被标记为已通过，并写入审核人和审核时间。" 
                    : "以下记录将被标记为已退回，请填写统一的审核意见。"}
                </p>
              </div>
              <label className="full-width">
                <span>审核意见 {batchReviewType === "reject" && <span className="required">*</span>}</span>
                <textarea
                  placeholder={batchReviewType === "approve" ? "请输入审核意见（可选，默认：记录完整，审核通过）..." : "请输入统一审核意见..."}
                  value={batchReviewReason}
                  onChange={(e) => setBatchReviewReason(e.target.value)}
                  rows={4}
                />
              </label>
            </div>
            <div className="review-modal-footer">
              <button 
                className="modal-cancel-btn"
                onClick={() => {
                  setShowBatchReviewModal(false);
                  setBatchReviewReason("");
                }}
              >
                取消
              </button>
              {batchReviewType === "reject" ? (
                <button 
                  className="modal-reject-btn"
                  onClick={confirmBatchReject}
                  disabled={!batchReviewReason.trim()}
                >
                  确认退回
                </button>
              ) : (
                <button 
                  className="modal-approve-btn"
                  onClick={confirmBatchApprove}
                >
                  确认通过
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="export-module-section">
        <ExportModule
          project={{
            id: project.id,
            title: project.title,
            subtitle: project.subtitle,
            domain: project.domain,
            metrics: project.metrics,
            filters: project.filters,
          }}
          searchFilters={searchFilters}
          hasActiveFilters={hasActiveFilters}
          artifactRecords={artifactRecords}
          stratumRelations={stratumRelations}
          excavationLogs={excavationLogs}
          currentRole={currentRole}
          onJumpToFix={handleExportJumpToFix}
          recheckToken={recheckToken}
        />
      </div>

      {toastMessage && (
        <div className="toast-notification" role="status" aria-live="polite">
          <span className="toast-icon">ℹ️</span>
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}
    </main>
  );
}

export default App;
