import type { ArtifactRecord, StratumRelation, ExcavationLog, SearchFilters } from "../App";

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
