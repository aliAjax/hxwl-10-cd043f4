import type {
  DataCollectionInput,
  ProjectMetrics,
  TrenchSummary,
  ExportDataPackage,
  ConsistencyReport,
} from "./types";

const countStrata = (
  artifacts: DataCollectionInput["artifactRecords"],
  relations: DataCollectionInput["stratumRelations"]
): number => {
  const strataSet = new Set<string>();
  artifacts.forEach((r) => {
    if (r.stratum) strataSet.add(r.stratum);
  });
  relations.forEach((r) => {
    if (r.stratumA) strataSet.add(r.stratumA);
    if (r.stratumB) strataSet.add(r.stratumB);
  });
  return strataSet.size;
};

export const computeMetrics = (
  input: DataCollectionInput
): ProjectMetrics => {
  const { artifactRecords, stratumRelations, excavationLogs, project } = input;

  const trenchSet = new Set<string>();
  artifactRecords.forEach((r) => {
    if (r.trenchNumber?.trim()) trenchSet.add(r.trenchNumber.trim());
  });

  return {
    trenchCount: trenchSet.size,
    stratumCount: countStrata(artifactRecords, stratumRelations),
    artifactCount: artifactRecords.length,
    pendingReviewCount: artifactRecords.filter((r) => r.status === "pending").length,
    approvedCount: artifactRecords.filter((r) => r.status === "approved").length,
    rejectedCount: artifactRecords.filter((r) => r.status === "rejected").length,
    archivedCount: artifactRecords.filter((r) => r.status === "archived").length,
    relationCount: stratumRelations.length,
    logCount: excavationLogs.length,
    metricsLabels: project.metrics,
    filterLabels: project.filters,
  };
};

export const summarizeTrenches = (
  records: DataCollectionInput["artifactRecords"]
): TrenchSummary[] => {
  const trenchMap = new Map<string, TrenchSummary>();

  records.forEach((record) => {
    const key = record.trenchNumber?.trim() || "(未填写探方)";
    if (!trenchMap.has(key)) {
      trenchMap.set(key, {
        trenchNumber: key,
        artifactCount: 0,
        strata: [],
        artifactTypes: [],
      });
    }
    const summary = trenchMap.get(key)!;
    summary.artifactCount++;
    if (record.stratum && !summary.strata.includes(record.stratum)) {
      summary.strata.push(record.stratum);
    }
    if (record.artifactType && !summary.artifactTypes.includes(record.artifactType)) {
      summary.artifactTypes.push(record.artifactType);
    }
  });

  return Array.from(trenchMap.values()).sort((a, b) =>
    a.trenchNumber.localeCompare(b.trenchNumber, "zh-CN")
  );
};

export const collectExportData = (
  input: DataCollectionInput,
  consistencyReport: ConsistencyReport,
  options: { includeLogs?: boolean } = {}
): ExportDataPackage => {
  const now = new Date().toISOString();

  return {
    schemaVersion: "1.0.0",
    projectInfo: {
      id: input.project.id,
      title: input.project.title,
      subtitle: input.project.subtitle,
      domain: input.project.domain,
      exportedAt: now,
      exporter: input.currentUser || input.currentRole,
    },
    metrics: computeMetrics(input),
    filters: {
      searchFilters: input.searchFilters,
      hasActiveFilters: input.hasActiveFilters,
    },
    trenchRecords: summarizeTrenches(input.artifactRecords),
    stratumRelations: input.stratumRelations,
    artifacts: input.artifactRecords,
    excavationLogs: options.includeLogs !== false ? input.excavationLogs : [],
    consistencyReport: consistencyReport,
  };
};
