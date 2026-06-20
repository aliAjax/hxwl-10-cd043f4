// ============================================================
// 考古资料包导出模块 —— 公共 API 边界
// ============================================================
// 外部代码（如 App.tsx）只应从此文件导入，
// 不应直接 import 模块内部的子文件。
// ============================================================

// —— 默认导出：主组件 ——
export { default, default as ExportModule } from "./ExportModule";

// —— 组件 Props（入站类型边界）——
export type { ExportModuleProps } from "./types";

// —— 资料包类型（出站类型边界）——
export type {
  ExportDataPackage,
  ConsistencyReport,
  ConsistencyIssue,
  IssueSeverity,
  IssueCategory,
  ExportOptions,
  ProjectMetrics,
  TrenchSummary,
  DataCollectionInput,
  RepairChecklistAction,
  RepairChecklistGroup,
  RepairChecklistCategoryGroup,
  RepairChecklistTrenchGroup,
} from "./types";

// —— 一致性检查引擎 ——
export { runConsistencyChecks, filterArtifactsForExport } from "./consistencyChecker";

// —— 数据收集层 ——
export { collectExportData, computeMetrics, summarizeTrenches } from "./dataCollector";

// —— JSON 导出下载 ——
export { downloadJsonFile, downloadJsonFromSnapshot, serializeDataPackage, formatFileSize } from "./jsonExporter";

// —— 后端 API 边界 ——
export { backendApi } from "./apiBoundary";
export type {
  UploadResult,
  PdfGenerationResult,
  BackendApiConfig,
} from "./apiBoundary";

// —— PDF 生成边界 ——
export { pdfGenerator } from "./pdfBoundary";
export type { PdfTemplateOptions } from "./pdfBoundary";

// —— 导出任务历史 ——
export { default as ExportTaskHistory } from "./ExportTaskHistory.tsx";
export type { ExportTaskHistoryProps } from "./ExportTaskHistory.tsx";
export {
  saveExportTask,
  updateExportTask,
  getExportTask,
  getAllExportTasks,
  deleteExportTask,
  clearAllExportTasks,
  getTaskCount,
  buildTaskSnapshot,
  buildCheckResult,
} from "./exportTaskStore";
export type { CreateTaskParams } from "./exportTaskStore";
export type {
  ExportTaskRecord,
  ExportTaskType,
  ExportTaskStatus,
  ExportTaskSnapshot,
  ExportTaskCheckResult,
} from "../types";
