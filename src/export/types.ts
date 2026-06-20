// ============================================================
// 导出模块内部类型定义
// ============================================================
// 仅包含导出模块独有的业务类型；
// 全局共享类型（ArtifactRecord、StratumRelation 等）从 ../types 导入。
// ============================================================

import type {
  ArtifactRecord,
  StratumRelation,
  ExcavationLog,
  SearchFilters,
  UserRole,
  ChronologyInferenceReport,
} from "../types";

export type { UserRole };

export interface ProjectMetrics {
  trenchCount: number;
  stratumCount: number;
  artifactCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  archivedCount: number;
  relationCount: number;
  logCount: number;
  metricsLabels: string[];
  filterLabels: string[];
}

export interface TrenchSummary {
  trenchNumber: string;
  artifactCount: number;
  strata: string[];
  artifactTypes: string[];
}

export interface ExportDataPackage {
  schemaVersion: string;
  projectInfo: {
    id: string;
    title: string;
    subtitle: string;
    domain: string;
    exportedAt: string;
    exporter?: string;
  };
  metrics: ProjectMetrics;
  filters: {
    searchFilters: SearchFilters;
    hasActiveFilters: boolean;
  };
  trenchRecords: TrenchSummary[];
  stratumRelations: StratumRelation[];
  artifacts: ArtifactRecord[];
  excavationLogs: ExcavationLog[];
  consistencyReport: ConsistencyReport;
}

export type IssueSeverity = "blocking" | "warning";

export type IssueCategory =
  | "missing_trench_number"
  | "invalid_coordinate"
  | "stratum_relation_conflict"
  | "unreviewed_record"
  | "rejected_record"
  | "empty_trench_number"
  | "duplicate_relation"
  | "orphan_stratum";

export interface ConsistencyIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  recordId?: number;
  trenchNumber?: string;
  stratumName?: string;
  details?: Record<string, unknown>;
}

export interface ConsistencyReport {
  generatedAt: string;
  blockingCount: number;
  warningCount: number;
  issues: ConsistencyIssue[];
  isExportable: boolean;
  chronologyReport?: ChronologyInferenceReport;
}

export interface ExportOptions {
  includePendingRecords: boolean;
  includeRejectedRecords: boolean;
  includeLogs: boolean;
  fileName?: string;
}

export interface DataCollectionInput {
  project: {
    id: string;
    title: string;
    subtitle: string;
    domain: string;
    metrics: string[];
    filters: string[];
  };
  searchFilters: SearchFilters;
  hasActiveFilters: boolean;
  artifactRecords: ArtifactRecord[];
  stratumRelations: StratumRelation[];
  excavationLogs: ExcavationLog[];
  currentRole?: string;
  currentUser?: string;
}

export type RepairChecklistAction =
  | { type: "fix_coordinate"; recordId: number; trenchNumber?: string }
  | { type: "fix_trench_number"; recordId: number }
  | { type: "review_record"; recordId: number; trenchNumber?: string }
  | { type: "fix_duplicate_relation"; stratumA: string; stratumB: string; relationId?: number };

export interface RepairChecklistGroup {
  trenchKey: string;
  issues: ConsistencyIssue[];
}

export interface RepairChecklistCategoryGroup {
  category: IssueCategory;
  categoryLabel: string;
  affectedRoles: UserRole[];
  issues: ConsistencyIssue[];
}

export interface RepairChecklistTrenchGroup {
  trenchKey: string;
  categories: RepairChecklistCategoryGroup[];
  totalIssues: number;
}

// ============================================================
// 入站类型边界：ExportModule 组件 Props
// ============================================================

export interface ExportModuleProps {
  project: {
    id: string;
    title: string;
    subtitle: string;
    domain: string;
    metrics: string[];
    filters: string[];
  };
  searchFilters: SearchFilters;
  hasActiveFilters: boolean;
  artifactRecords: ArtifactRecord[];
  stratumRelations: StratumRelation[];
  excavationLogs: ExcavationLog[];
  currentRole: UserRole;
  currentRoleLabel?: string;
  onJumpToFix?: (action: RepairChecklistAction) => void;
  recheckToken?: number;
}
