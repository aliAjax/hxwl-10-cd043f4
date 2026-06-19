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
  relicUnit: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  quantity: string;
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

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateReasons: string[];
  duplicateWithExisting?: boolean;
  duplicateWithBatch?: boolean;
  existingRecordId?: number;
}

export interface ValidatedBatchImportRow extends BatchImportRow {
  duplicateCheck: DuplicateCheckResult;
  skipImport: boolean;
}

export interface ParsedImportResult {
  validRows: ValidatedBatchImportRow[];
  duplicateRows: ValidatedBatchImportRow[];
  errorRows: { row: BatchImportRow; errors: string[] }[];
}

export interface ImportResultSummary {
  addedCount: number;
  skippedCount: number;
  errorCount: number;
  duplicateCount: number;
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
  relicUnit: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  quantity: string;
  remarks: string;
  savedAt: string;
  draftName: string;
}

export type DraftFormData = Omit<DraftRecord, "id" | "savedAt">;

// ============================================================
// 多探方发掘进度总览 - 数据模型
// ============================================================

// 异常类型
export type AnomalyType =
  | "missing_coordinate"
  | "invalid_coordinate"
  | "missing_field"
  | "stratum_conflict"
  | "unreviewed_record"
  | "unarchived_record"
  | "incomplete_relation";

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  trenchNumber: string;
  stratum?: string;
  relicUnit?: string;
  recordId?: number;
  severity: "warning" | "error" | "critical";
  message: string;
  affectedRole: UserRole[];
  createdAt: string;
}

// 待补录字段 - 发掘队员关注
export interface MissingFieldItem {
  recordId: number;
  trenchNumber: string;
  stratum: string;
  fieldName: keyof ArtifactRecord;
  fieldLabel: string;
  currentValue: string;
  artifactType: string;
  submittedAt?: string;
}

// 待复核关系 - 领队关注
export interface PendingRelationItem {
  relationId?: number;
  trenchNumber: string;
  stratumA: string;
  stratumB: string;
  issue: string;
  suggestion?: string;
  hasConflictingRelation?: boolean;
  relatedArtifactCount: number;
}

// 待归档记录 - 资料整理员关注
export interface PendingArchiveItem {
  recordId: number;
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  quantity?: string;
  approvedBy?: string;
  approvedAt?: string;
  reviewReason?: string;
}

// 地层汇总
export interface StratumSummary {
  name: string;
  trenchNumber: string;
  artifactCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  archivedCount: number;
  rejectedCount: number;
  hasRelations: boolean;
  anomalyCount: number;
  lastUpdated: string;
}

// 遗迹单位汇总
export interface RelicUnitSummary {
  name: string;
  trenchNumber: string;
  stratum: string;
  artifactCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  archivedCount: number;
  anomalyCount: number;
}

// 探方汇总
export interface TrenchSummary {
  trenchNumber: string;
  strata: StratumSummary[];
  relicUnits: RelicUnitSummary[];
  totalArtifacts: number;
  pendingReview: number;
  approved: number;
  archived: number;
  rejected: number;
  coordinateAnomalies: number;
  fieldAnomalies: number;
  relationIssues: number;
  progressPercent: number;
  lastActivity: string;
}

// 未整理记录统计
export interface UnorganizedStats {
  totalRecords: number;
  missingCoordinates: number;
  invalidCoordinates: number;
  missingRequiredFields: number;
  withoutRelicUnit: number;
  withoutQuantity: number;
}

// 角色视角数据
export interface RoleBasedViewData {
  role: UserRole;
  roleName: string;
  priorityItems: number;
  items: (MissingFieldItem | PendingRelationItem | PendingArchiveItem | AnomalyRecord)[];
  summary: {
    label: string;
    value: number;
    trend: "up" | "down" | "stable";
  }[];
}

// 总览状态
export interface OverviewState {
  trenches: TrenchSummary[];
  anomalies: AnomalyRecord[];
  missingFields: MissingFieldItem[];
  pendingRelations: PendingRelationItem[];
  pendingArchives: PendingArchiveItem[];
  unorganizedStats: UnorganizedStats;
  roleViews: Record<UserRole, RoleBasedViewData>;
  overallProgress: number;
  lastUpdated: string;
}

// 总览筛选条件
export interface OverviewFilters {
  trenchNumber: string;
  anomalyType: AnomalyType | "all";
  severity: AnomalyRecord["severity"] | "all";
  status: ReviewStatus | "all";
}

// ============ 关系网络视图类型 ============

export type ConflictKind =
  | "duplicate"
  | "mutual_breaks"
  | "mutual_contains"
  | "mutual_earlier"
  | "breaks_vs_earlier";

export interface RelationConflict {
  kind: ConflictKind;
  relationIds: number[];
  message: string;
}

export interface GraphNode {
  name: string;
  artifactCount: number;
  trenchNumber?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  relationId: number;
  conflicts: RelationConflict[];
}

export interface GraphPathStep {
  from: string;
  to: string;
  type: RelationType;
  relationId: number;
  direction: "forward" | "inverse";
}

export interface TraversalResult {
  direct: GraphPathStep[];
  indirect: GraphPathStep[][];
  allReachable: Set<string>;
}

export type ExceptionAction =
  | { type: "missing_field"; recordId: number; trenchNumber: string; stratum: string; fieldName: string; fieldLabel: string; artifactType: string }
  | { type: "pending_relation"; stratumA: string; stratumB: string; trenchNumber: string; relationId?: number }
  | { type: "pending_archive"; recordId: number; trenchNumber: string; stratum: string; artifactType: string };

export type GraphViewMode = "graph" | "hierarchy";
