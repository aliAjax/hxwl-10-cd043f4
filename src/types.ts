// ============================================================
// 全局共享类型定义
// ============================================================
// 所有模块（App、导出模块、IndexedDB 等）共享的业务类型。
// 任何跨模块使用的类型都应定义在此文件，避免循环依赖。
// ============================================================

// —— 审核状态 ——
export type ReviewStatus = "pending" | "approved" | "rejected" | "archived";

// —— 用户角色 ——
export type UserRole = "excavator" | "leader" | "archivist";

// —— 地层关系类型 ——
export type RelationType = "earlier" | "breaks" | "contains";

// —— 出土物坐标记录 ——
export interface ArtifactRecord {
  id: number;
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  remarks: string;
  createdAt: string;
  relicUnit?: string;
  quantity?: string;
  status: ReviewStatus;
  submittedBy?: string;
  submittedAt?: string;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

// —— 出土物录入表单数据 ——
export interface ArtifactFormData {
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  remarks: string;
}

// —— 发掘日志 ——
export interface ExcavationLog {
  id: number;
  date: string;
  weather: string;
  participants: string;
  excavationArea: string;
  mainFindings: string;
  pendingReview: string;
  createdAt: string;
}

// —— 发掘日志录入表单数据 ——
export interface ExcavationLogFormData {
  date: string;
  weather: string;
  participants: string;
  excavationArea: string;
  mainFindings: string;
  pendingReview: string;
}

// —— 搜索筛选条件 ——
export interface SearchFilters {
  trenchNumber: string;
  stratum: string;
  relicUnit: string;
  artifactKeyword: string;
}

// —— 表单错误类型 ——
export type FormErrors = Partial<Record<keyof ArtifactFormData, string>>;
export type ExcavationLogFormErrors = Partial<
  Record<keyof ExcavationLogFormData, string>
>;

// —— 地层关系记录 ——
export interface StratumRelation {
  id: number;
  stratumA: string;
  stratumB: string;
  relationType: RelationType;
  createdAt: string;
}

// —— 地层关系录入表单数据 ——
export interface StratumRelationFormData {
  stratumA: string;
  stratumB: string;
  relationType: RelationType | "";
}

export type StratumRelationFormErrors = Partial<
  Record<keyof StratumRelationFormData | "conflict", string>
>;

// —— CSV 批量导入 ——
export interface BatchImportRow {
  rowNumber: number;
  trenchNumber: string;
  stratum: string;
  relicUnit: string;
  coordinatePoint: string;
  depth: string;
  artifactType: string;
  quantity: string;
}

export interface ParsedImportResult {
  validRows: BatchImportRow[];
  errorRows: { row: BatchImportRow; errors: string[] }[];
}

// —— CSV 批量导入表头配置 ——
export interface BatchImportHeader {
  key: string;
  label: string;
  required: boolean;
}

export const batchImportHeaders: BatchImportHeader[] = [
  { key: "trenchNumber", label: "探方", required: true },
  { key: "stratum", label: "地层", required: true },
  { key: "relicUnit", label: "遗迹单位", required: false },
  { key: "coordinatePoint", label: "坐标点", required: true },
  { key: "depth", label: "深度", required: true },
  { key: "artifactType", label: "类型", required: true },
  { key: "quantity", label: "数量", required: true },
];

// —— IndexedDB 草稿记录 ——
export interface DraftRecord {
  id: number;
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  remarks: string;
  savedAt: string;
  draftName: string;
}

export type DraftFormData = Omit<DraftRecord, "id" | "savedAt">;
