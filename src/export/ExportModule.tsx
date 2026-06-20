import { useState, useMemo, useCallback, useEffect } from "react";

import { runConsistencyChecks, filterArtifactsForExport } from "./consistencyChecker";
import { collectExportData } from "./dataCollector";
import { downloadJsonFile, formatFileSize } from "./jsonExporter";
import { backendApi } from "./apiBoundary";
import { pdfGenerator } from "./pdfBoundary";
import {
  buildTaskSnapshot,
  buildCheckResult,
  saveExportTask,
} from "./exportTaskStore";
import ExportTaskHistory from "./ExportTaskHistory.tsx";
import type {
  ConsistencyReport,
  ConsistencyIssue,
  DataCollectionInput,
  ExportDataPackage,
  ExportOptions,
  ExportModuleProps,
  UserRole,
  RepairChecklistAction,
  RepairChecklistTrenchGroup,
  IssueCategory,
} from "./types";
import type {
  ExportTaskRecord,
  ExportTaskSnapshot,
} from "../types";

const categoryLabels: Record<string, string> = {
  missing_trench_number: "缺失探方编号",
  empty_trench_number: "探方编号为空",
  invalid_coordinate: "坐标格式异常",
  stratum_relation_conflict: "地层关系冲突",
  duplicate_relation: "重复地层关系",
  unreviewed_record: "待审核记录",
  rejected_record: "已退回记录",
  orphan_stratum: "孤立地层（无关系）",
};

const categoryAffectedRoles: Record<IssueCategory, UserRole[]> = {
  missing_trench_number: ["excavator"],
  empty_trench_number: ["excavator"],
  invalid_coordinate: ["excavator"],
  stratum_relation_conflict: ["leader"],
  duplicate_relation: ["leader"],
  unreviewed_record: ["leader"],
  rejected_record: ["excavator"],
  orphan_stratum: ["leader", "archivist"],
};

const jumpableCategories: Set<IssueCategory> = new Set([
  "invalid_coordinate",
  "missing_trench_number",
  "unreviewed_record",
  "duplicate_relation",
]);



type CheckStatus = "idle" | "checking" | "checked";
type ExportStatus = "idle" | "exporting" | "success" | "error";

const roleNamesLocal: Record<UserRole, string> = {
  excavator: "发掘队员",
  leader: "领队",
  archivist: "资料整理员",
};

export default function ExportModule(props: ExportModuleProps) {
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportResultInfo, setExportResultInfo] = useState<{
    fileName?: string;
    fileSize?: string;
    error?: string;
  }>({});
  const [showDetails, setShowDetails] = useState(false);
  const [showApiTest, setShowApiTest] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string>("");
  const [showTaskHistory, setShowTaskHistory] = useState(false);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includePendingRecords: true,
    includeRejectedRecords: true,
    includeLogs: true,
  });

  const buildCollectionInput = useCallback(
    (opts: ExportOptions): DataCollectionInput => {
      const filteredArtifacts = filterArtifactsForExport(props.artifactRecords, {
        includePending: opts.includePendingRecords,
        includeRejected: opts.includeRejectedRecords,
      });
      return {
        project: props.project,
        searchFilters: props.searchFilters,
        hasActiveFilters: props.hasActiveFilters,
        artifactRecords: filteredArtifacts,
        stratumRelations: props.stratumRelations,
        excavationLogs: opts.includeLogs ? props.excavationLogs : [],
        currentRole: roleNamesLocal[props.currentRole],
      };
    },
    [props]
  );

  const handleRunChecks = useCallback(() => {
    setCheckStatus("checking");
    setExportResultInfo({});
    setExportStatus("idle");
    setShowDetails(true);

    setTimeout(() => {
      const input = buildCollectionInput(exportOptions);
      const consistencyReport = runConsistencyChecks(input);
      setReport(consistencyReport);
      setCheckStatus("checked");

      try {
        const snapshot = buildTaskSnapshot(
          props.project,
          exportOptions,
          props.searchFilters,
          props.hasActiveFilters
        );
        const checkResult = buildCheckResult(consistencyReport);
        saveExportTask(
          {
            taskType: "consistency_check",
            snapshot,
            checkResult,
          },
          "success"
        );
      } catch (err) {
        console.warn("保存一致性检查任务历史失败:", err);
      }
    }, 300);
  }, [buildCollectionInput, exportOptions, props]);

  useEffect(() => {
    if (props.recheckToken !== undefined && props.recheckToken > 0) {
      handleRunChecks();
    }
  }, [props.recheckToken, handleRunChecks]);

  const blockingIssues = useMemo<ConsistencyIssue[]>(
    () => report?.issues.filter((i) => i.severity === "blocking") || [],
    [report]
  );

  const warningIssues = useMemo<ConsistencyIssue[]>(
    () => report?.issues.filter((i) => i.severity === "warning") || [],
    [report]
  );

  const repairChecklistData = useMemo<RepairChecklistTrenchGroup[]>(() => {
    if (!report || report.issues.length === 0) return [];
    const allIssues = report.issues.filter(
      (i) => i.severity === "blocking" || i.severity === "warning"
    );
    const trenchMap = new Map<string, ConsistencyIssue[]>();
    allIssues.forEach((issue) => {
      const key = issue.trenchNumber?.trim() || issue.stratumName || "（未关联探方）";
      if (!trenchMap.has(key)) trenchMap.set(key, []);
      trenchMap.get(key)!.push(issue);
    });
    const groups: RepairChecklistTrenchGroup[] = [];
    trenchMap.forEach((issues, trenchKey) => {
      const catMap = new Map<IssueCategory, ConsistencyIssue[]>();
      issues.forEach((issue) => {
        if (!catMap.has(issue.category)) catMap.set(issue.category, []);
        catMap.get(issue.category)!.push(issue);
      });
      const categories = Array.from(catMap.entries()).map(([cat, catIssues]) => ({
        category: cat,
        categoryLabel: categoryLabels[cat] || cat,
        affectedRoles: categoryAffectedRoles[cat] || [],
        issues: catIssues,
      }));
      categories.sort((a, b) => {
        const aBlocking = a.issues.some((i) => i.severity === "blocking") ? 0 : 1;
        const bBlocking = b.issues.some((i) => i.severity === "blocking") ? 0 : 1;
        if (aBlocking !== bBlocking) return aBlocking - bBlocking;
        return a.category.localeCompare(b.category);
      });
      groups.push({
        trenchKey,
        categories,
        totalIssues: issues.length,
      });
    });
    groups.sort((a, b) => {
      const aBlocking = a.categories.some((c) =>
        c.issues.some((i) => i.severity === "blocking")
      )
        ? 0
        : 1;
      const bBlocking = b.categories.some((c) =>
        c.issues.some((i) => i.severity === "blocking")
      )
        ? 0
        : 1;
      if (aBlocking !== bBlocking) return aBlocking - bBlocking;
      return a.trenchKey.localeCompare(b.trenchKey, "zh-CN");
    });
    return groups;
  }, [report]);

  const handleJumpToFix = useCallback(
    (issue: ConsistencyIssue) => {
      if (!props.onJumpToFix) return;
      let action: RepairChecklistAction | null = null;
      switch (issue.category) {
        case "invalid_coordinate":
          if (issue.recordId !== undefined) {
            action = {
              type: "fix_coordinate",
              recordId: issue.recordId,
              trenchNumber: issue.trenchNumber,
            };
          }
          break;
        case "missing_trench_number":
          if (issue.recordId !== undefined) {
            action = {
              type: "fix_trench_number",
              recordId: issue.recordId,
            };
          }
          break;
        case "unreviewed_record":
          if (issue.recordId !== undefined) {
            action = {
              type: "review_record",
              recordId: issue.recordId,
              trenchNumber: issue.trenchNumber,
            };
          }
          break;
        case "duplicate_relation": {
          const details = issue.details as
            | { relation1?: { id?: number }; relation2?: { id?: number } }
            | undefined;
          action = {
            type: "fix_duplicate_relation",
            stratumA: issue.stratumName || "",
            stratumB:
              (details?.relation2 as Record<string, string> | undefined)?.stratumB ||
              (details?.relation1 as Record<string, string> | undefined)?.stratumB ||
              "",
            relationId: details?.relation1?.id,
          };
          break;
        }
      }
      if (action) props.onJumpToFix(action);
    },
    [props]
  );

  const buildDataPackage = useCallback((): ExportDataPackage | null => {
    const input = buildCollectionInput(exportOptions);
    const consistencyReport = runConsistencyChecks(input);
    return collectExportData(input, consistencyReport, {
      includeLogs: exportOptions.includeLogs,
    });
  }, [buildCollectionInput, exportOptions]);

  const handleExportJson = useCallback(() => {
    if (report && report.blockingCount > 0) {
      setExportStatus("error");
      setExportResultInfo({
        error: `存在 ${report.blockingCount} 项阻断问题，禁止导出资料包。请先修复所有阻断项后再试。`,
      });

      try {
        const snapshot = buildTaskSnapshot(
          props.project,
          exportOptions,
          props.searchFilters,
          props.hasActiveFilters
        );
        const checkResult = report ? buildCheckResult(report) : undefined;
        saveExportTask(
          {
            taskType: "json_export",
            snapshot,
            checkResult,
            error: `存在 ${report.blockingCount} 项阻断问题，禁止导出资料包。请先修复所有阻断项后再试。`,
          },
          "error"
        );
      } catch (err) {
        console.warn("保存JSON导出任务历史失败:", err);
      }
      return;
    }

    setExportStatus("exporting");
    setExportResultInfo({});

    setTimeout(() => {
      try {
        const dataPackage = buildDataPackage();
        if (!dataPackage) {
          setExportStatus("error");
          setExportResultInfo({ error: "资料包构建失败" });

          try {
            const snapshot = buildTaskSnapshot(
              props.project,
              exportOptions,
              props.searchFilters,
              props.hasActiveFilters
            );
            const checkResult = report ? buildCheckResult(report) : undefined;
            saveExportTask(
              {
                taskType: "json_export",
                snapshot,
                checkResult,
                error: "资料包构建失败",
              },
              "error"
            );
          } catch (err) {
            console.warn("保存JSON导出任务历史失败:", err);
          }
          return;
        }

        if (dataPackage.consistencyReport.blockingCount > 0) {
          setExportStatus("error");
          setExportResultInfo({
            error: `资料包包含 ${dataPackage.consistencyReport.blockingCount} 项阻断问题，已阻止下载。`,
          });

          try {
            const snapshot = buildTaskSnapshot(
              props.project,
              exportOptions,
              props.searchFilters,
              props.hasActiveFilters
            );
            const checkResult = buildCheckResult(dataPackage.consistencyReport);
            saveExportTask(
              {
                taskType: "json_export",
                snapshot,
                checkResult,
                dataPackageSchemaVersion: dataPackage.schemaVersion,
                error: `资料包包含 ${dataPackage.consistencyReport.blockingCount} 项阻断问题，已阻止下载。`,
              },
              "error"
            );
          } catch (err) {
            console.warn("保存JSON导出任务历史失败:", err);
          }
          return;
        }

        const result = downloadJsonFile(dataPackage, { ...exportOptions, requireConsistencyPass: true });
        if (result.success) {
          setExportStatus("success");
          setExportResultInfo({
            fileName: result.fileName,
            fileSize: formatFileSize(result.sizeBytes),
          });

          try {
            const snapshot = buildTaskSnapshot(
              props.project,
              exportOptions,
              props.searchFilters,
              props.hasActiveFilters
            );
            const checkResult = buildCheckResult(dataPackage.consistencyReport);
            saveExportTask(
              {
                taskType: "json_export",
                snapshot,
                checkResult,
                fileName: result.fileName,
                fileSizeBytes: result.sizeBytes,
                dataPackageSchemaVersion: dataPackage.schemaVersion,
              },
              "success"
            );
          } catch (err) {
            console.warn("保存JSON导出任务历史失败:", err);
          }
        } else {
          setExportStatus("error");
          setExportResultInfo({ error: result.error || "下载失败" });

          try {
            const snapshot = buildTaskSnapshot(
              props.project,
              exportOptions,
              props.searchFilters,
              props.hasActiveFilters
            );
            const checkResult = buildCheckResult(dataPackage.consistencyReport);
            saveExportTask(
              {
                taskType: "json_export",
                snapshot,
                checkResult,
                dataPackageSchemaVersion: dataPackage.schemaVersion,
                error: result.error || "下载失败",
              },
              "error"
            );
          } catch (err) {
            console.warn("保存JSON导出任务历史失败:", err);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "导出过程发生未知错误";
        setExportStatus("error");
        setExportResultInfo({ error: errorMessage });

        try {
          const snapshot = buildTaskSnapshot(
            props.project,
            exportOptions,
            props.searchFilters,
            props.hasActiveFilters
          );
          const checkResult = report ? buildCheckResult(report) : undefined;
          saveExportTask(
            {
              taskType: "json_export",
              snapshot,
              checkResult,
              error: errorMessage,
            },
            "error"
          );
        } catch (saveErr) {
          console.warn("保存JSON导出任务历史失败:", saveErr);
        }
      }
    }, 300);
  }, [buildDataPackage, exportOptions, props, report]);

  const handleTestBackendUpload = useCallback(async () => {
    setApiTestResult("正在调用后端上传接口（模拟）...");
    const dataPackage = buildDataPackage();
    if (!dataPackage) {
      setApiTestResult("构建资料包失败");

      try {
        const snapshot = buildTaskSnapshot(
          props.project,
          exportOptions,
          props.searchFilters,
          props.hasActiveFilters
        );
        const checkResult = report ? buildCheckResult(report) : undefined;
        saveExportTask(
          {
            taskType: "backend_upload",
            snapshot,
            checkResult,
            error: "构建资料包失败",
          },
          "error"
        );
      } catch (err) {
        console.warn("保存后端上传任务历史失败:", err);
      }
      return;
    }
    const result = await backendApi.uploadDataPackage(dataPackage);
    setApiTestResult(
      `任务ID: ${result.taskId || "—"}\n结果: ${result.success ? "✅ 成功" : "❌ 失败"}\n消息: ${result.message || result.error || "无"}`
    );

    try {
      const snapshot = buildTaskSnapshot(
        props.project,
        exportOptions,
        props.searchFilters,
        props.hasActiveFilters
      );
      const checkResult = buildCheckResult(dataPackage.consistencyReport);
      saveExportTask(
        {
          taskType: "backend_upload",
          snapshot,
          checkResult,
          dataPackageSchemaVersion: dataPackage.schemaVersion,
          taskId: result.taskId,
          message: result.message,
          error: result.error,
        },
        result.success ? "success" : "error"
      );
    } catch (err) {
      console.warn("保存后端上传任务历史失败:", err);
    }
  }, [buildDataPackage, exportOptions, props, report]);

  const handleTestPdf = useCallback(async () => {
    setApiTestResult("正在调用PDF报告生成接口（模拟）...");
    const dataPackage = buildDataPackage();
    if (!dataPackage) {
      setApiTestResult("构建资料包失败");

      try {
        const snapshot = buildTaskSnapshot(
          props.project,
          exportOptions,
          props.searchFilters,
          props.hasActiveFilters
        );
        const checkResult = report ? buildCheckResult(report) : undefined;
        saveExportTask(
          {
            taskType: "pdf_generation",
            snapshot,
            checkResult,
            error: "构建资料包失败",
          },
          "error"
        );
      } catch (err) {
        console.warn("保存PDF生成任务历史失败:", err);
      }
      return;
    }
    const result = await pdfGenerator.generatePdfFrontend(dataPackage, {
      includeConsistencyReport: true,
      includeCharts: true,
    });
    setApiTestResult(
      `任务ID: （纯前端边界）\n结果: ${result.success ? "✅ 成功" : "❌ 预留占位"}\n${result.hint || result.error || ""}`
    );

    try {
      const snapshot = buildTaskSnapshot(
        props.project,
        exportOptions,
        props.searchFilters,
        props.hasActiveFilters
      );
      const checkResult = buildCheckResult(dataPackage.consistencyReport);
      saveExportTask(
        {
          taskType: "pdf_generation",
          snapshot,
          checkResult,
          dataPackageSchemaVersion: dataPackage.schemaVersion,
          message: result.hint,
          error: result.error,
        },
        result.success ? "success" : "error"
      );
    } catch (err) {
      console.warn("保存PDF生成任务历史失败:", err);
    }
  }, [buildDataPackage, exportOptions, props, report]);

  const handleReapplyOptions = useCallback((snapshot: ExportTaskSnapshot) => {
    setExportOptions({
      includePendingRecords: snapshot.exportOptions.includePendingRecords,
      includeRejectedRecords: snapshot.exportOptions.includeRejectedRecords,
      includeLogs: snapshot.exportOptions.includeLogs,
    });
    setShowTaskHistory(false);
    setTimeout(() => {
      handleRunChecks();
    }, 100);
  }, [handleRunChecks]);

  const handleRedownloadJson = useCallback((task: ExportTaskRecord) => {
    if (task.taskType !== "json_export" || task.status !== "success" || !task.fileName) {
      return;
    }

    const snapshot = task.snapshot;
    const restoredOptions: ExportOptions = {
      includePendingRecords: snapshot.exportOptions.includePendingRecords,
      includeRejectedRecords: snapshot.exportOptions.includeRejectedRecords,
      includeLogs: snapshot.exportOptions.includeLogs,
    };

    const filteredArtifacts = filterArtifactsForExport(props.artifactRecords, {
      includePending: restoredOptions.includePendingRecords,
      includeRejected: restoredOptions.includeRejectedRecords,
    });

    const input: DataCollectionInput = {
      project: props.project,
      searchFilters: snapshot.searchFilters,
      hasActiveFilters: snapshot.hasActiveFilters,
      artifactRecords: filteredArtifacts,
      stratumRelations: props.stratumRelations,
      excavationLogs: restoredOptions.includeLogs ? props.excavationLogs : [],
      currentRole: roleNamesLocal[props.currentRole],
    };

    const consistencyReport = runConsistencyChecks(input);
    const dataPackage = collectExportData(input, consistencyReport, {
      includeLogs: restoredOptions.includeLogs,
    });

    if (dataPackage.consistencyReport.blockingCount > 0) {
      setExportStatus("error");
      setExportResultInfo({
        error: `重新下载失败：资料包包含 ${dataPackage.consistencyReport.blockingCount} 项阻断问题。`,
      });
      return;
    }

    const result = downloadJsonFile(dataPackage, {
      ...restoredOptions,
      requireConsistencyPass: true,
    });

    if (result.success) {
      setExportStatus("success");
      setExportResultInfo({
        fileName: result.fileName,
        fileSize: formatFileSize(result.sizeBytes),
      });

      try {
        const newSnapshot = buildTaskSnapshot(
          props.project,
          restoredOptions,
          snapshot.searchFilters,
          snapshot.hasActiveFilters
        );
        const checkResult = buildCheckResult(dataPackage.consistencyReport);
        saveExportTask(
          {
            taskType: "json_export",
            snapshot: newSnapshot,
            checkResult,
            fileName: result.fileName,
            fileSizeBytes: result.sizeBytes,
            dataPackageSchemaVersion: dataPackage.schemaVersion,
            message: `从历史任务 #${task.id} 重新下载`,
          },
          "success"
        );
      } catch (err) {
        console.warn("保存重新下载任务历史失败:", err);
      }
    } else {
      setExportStatus("error");
      setExportResultInfo({ error: result.error || "重新下载失败" });
    }
  }, [props]);

  const canExport = checkStatus === "checked" && report?.isExportable === true;
  const hasBlocking = checkStatus === "checked" && report && report.blockingCount > 0;
  const exportableWithWarnings =
    checkStatus === "checked" && report && report.blockingCount === 0 && report.warningCount > 0;

  return (
    <section className="panel export-module-section">
      <div className="section-heading">
        <div>
          <p>资料归档</p>
          <h2>考古资料包导出</h2>
        </div>
        <div className="export-status-indicator">
          {checkStatus === "idle" && (
            <span className="export-idle-chip">⬜ 未检查</span>
          )}
          {checkStatus === "checking" && (
            <span className="export-checking-chip">⏳ 检查中...</span>
          )}
          {checkStatus === "checked" && report && report.isExportable && (
            <span className="export-ready-chip">
              ✅ {report.warningCount > 0 ? "有警告 · 可导出" : "一致性通过 · 可导出"}
            </span>
          )}
          {checkStatus === "checked" && report && !report.isExportable && (
            <span className="export-blocked-chip">
              🚫 {report.blockingCount} 项阻断问题
            </span>
          )}
        </div>
      </div>

      <div className="export-options-grid">
        <label className="export-option">
          <input
            type="checkbox"
            checked={exportOptions.includePendingRecords}
            onChange={(e) =>
              setExportOptions((prev) => ({
                ...prev,
                includePendingRecords: e.target.checked,
              }))
            }
          />
          <div>
            <strong>包含待审核记录</strong>
            <span>将 status=pending 的出土物记录一并导出</span>
          </div>
        </label>

        <label className="export-option">
          <input
            type="checkbox"
            checked={exportOptions.includeRejectedRecords}
            onChange={(e) =>
              setExportOptions((prev) => ({
                ...prev,
                includeRejectedRecords: e.target.checked,
              }))
            }
          />
          <div>
            <strong>包含已退回记录</strong>
            <span>将 status=rejected 的出土物记录一并导出</span>
          </div>
        </label>

        <label className="export-option">
          <input
            type="checkbox"
            checked={exportOptions.includeLogs}
            onChange={(e) =>
              setExportOptions((prev) => ({
                ...prev,
                includeLogs: e.target.checked,
              }))
            }
          />
          <div>
            <strong>包含发掘日志</strong>
            <span>将发掘日志记录（ExcavationLog）写入资料包</span>
          </div>
        </label>

        <div className="export-option export-option-info">
          <div>
            <strong>导出内容总览</strong>
            <span>
              探方{" "}
              {new Set(props.artifactRecords.map((r) => r.trenchNumber).filter(Boolean)).size} 个 ·
              地层关系 {props.stratumRelations.length} 条 · 出土物共{" "}
              {props.artifactRecords.length} 条 · 日志 {props.excavationLogs.length} 条
            </span>
          </div>
        </div>
      </div>

      <div className="export-actions-bar">
        <button
          className="export-check-btn"
          onClick={handleRunChecks}
          disabled={checkStatus === "checking" || exportStatus === "exporting"}
        >
          🔍 {checkStatus === "idle" ? "运行一致性检查" : "重新检查"}
        </button>

        <div className="export-actions-right">
          <button
            className="export-api-toggle-btn"
            onClick={() => setShowTaskHistory((v) => !v)}
          >
            📜 {showTaskHistory ? "隐藏" : "查看"}导出历史
          </button>

          <button
            className="primary-action export-main-btn"
            onClick={handleExportJson}
            disabled={
              checkStatus !== "checked" ||
              exportStatus === "exporting" ||
              hasBlocking === true
            }
          >
            📦 下载 JSON 资料包
          </button>

          <button
            className="export-api-toggle-btn"
            onClick={() => setShowApiTest((v) => !v)}
          >
            {showApiTest ? "隐藏" : "显示"}后端/PDF 测试入口
          </button>
        </div>
      </div>

      {showTaskHistory && (
        <ExportTaskHistory
          projectId={props.project.id}
          onReapplyOptions={handleReapplyOptions}
          onRedownloadJson={handleRedownloadJson}
        />
      )}

      {exportStatus !== "idle" && (
        <div
          className={`export-result-banner ${
            exportStatus === "success"
              ? "export-result-success"
              : exportStatus === "error"
              ? "export-result-error"
              : "export-result-loading"
          }`}
        >
          {exportStatus === "exporting" && (
            <>
              <span className="export-result-icon">⏳</span>
              <span>正在生成并下载资料包...</span>
            </>
          )}
          {exportStatus === "success" && (
            <>
              <span className="export-result-icon">✅</span>
              <span>
                资料包导出成功：<code>{exportResultInfo.fileName}</code>
                {" · "}
                {exportResultInfo.fileSize}
              </span>
            </>
          )}
          {exportStatus === "error" && (
            <>
              <span className="export-result-icon">❌</span>
              <span>导出失败：{exportResultInfo.error || "未知错误"}</span>
            </>
          )}
        </div>
      )}

      {showApiTest && (
        <div className="api-test-box">
          <div className="api-test-header">
            <h3>🔌 后端 API / PDF 生成（边界预留）</h3>
            <span className="api-test-hint">
              这些接口目前返回前端模拟结果，接入后端时修改 apiBoundary.ts / pdfBoundary.ts
            </span>
          </div>
          <div className="api-test-buttons">
            <button
              className="api-test-btn"
              onClick={handleTestBackendUpload}
              disabled={exportStatus === "exporting"}
            >
              模拟上传资料包到后端
            </button>
            <button
              className="api-test-btn"
              onClick={handleTestPdf}
              disabled={exportStatus === "exporting"}
            >
              模拟生成 PDF 报告
            </button>
          </div>
          {apiTestResult && (
            <pre className="api-test-result">{apiTestResult}</pre>
          )}
        </div>
      )}

      {showDetails && checkStatus === "checked" && report && (
        <div className="consistency-report-area">
          <div className="report-summary-row">
            <div
              className={`report-summary-card report-card-${
                report.blockingCount > 0 ? "blocking" : "ok"
              }`}
            >
              <span className="summary-card-label">阻断问题</span>
              <span className="summary-card-value">{report.blockingCount}</span>
              <span className="summary-card-desc">
                {report.blockingCount > 0
                  ? "需修复后才能正式导出"
                  : "无阻断项，可正常导出"}
              </span>
            </div>
            <div
              className={`report-summary-card report-card-${
                report.warningCount > 0 ? "warning" : "ok"
              }`}
            >
              <span className="summary-card-label">警告问题</span>
              <span className="summary-card-value">{report.warningCount}</span>
              <span className="summary-card-desc">
                {report.warningCount > 0
                  ? "不阻断导出，但建议关注"
                  : "无警告项"}
              </span>
            </div>
            <div className="report-summary-card report-card-info">
              <span className="summary-card-label">检查时间</span>
              <span className="summary-card-value-meta">
                {new Date(report.generatedAt).toLocaleString("zh-CN")}
              </span>
              <span className="summary-card-desc">
                共 {report.issues.length} 条问题明细
              </span>
            </div>
            <div className="report-summary-card report-card-info">
              <span className="summary-card-label">资料包状态</span>
              {canExport ? (
                <>
                  <span className="summary-card-value-meta summary-card-value-ok">
                    ✅ 可导出
                  </span>
                  <span className="summary-card-desc">
                    {exportableWithWarnings
                      ? "存在警告项，已确认仍可下载"
                      : "一致性检查完全通过"}
                  </span>
                </>
              ) : (
                <>
                  <span className="summary-card-value-meta summary-card-value-bad">
                    🚫 暂不可导出
                  </span>
                  <span className="summary-card-desc">
                    存在阻断问题，需先修复
                  </span>
                </>
              )}
            </div>
          </div>

          {(report.blockingCount > 0 || report.warningCount > 0) && repairChecklistData.length > 0 && (
            <div className="repair-checklist-section">
              <div className="repair-checklist-header">
                <h3>📋 导出前修复清单</h3>
                <span className="repair-checklist-hint">
                  按探方、问题类型、影响角色分组，点击「去处理」可跳转到对应区域修复
                </span>
              </div>
              <div className="repair-checklist-groups">
                {repairChecklistData.map((trenchGroup) => (
                  <div key={trenchGroup.trenchKey} className="repair-trench-group">
                    <div className="repair-trench-header">
                      <span className="repair-trench-label">
                        🏗️ 探方：{trenchGroup.trenchKey}
                      </span>
                      <span className="repair-trench-count">
                        {trenchGroup.totalIssues} 项问题
                      </span>
                    </div>
                    {trenchGroup.categories.map((catGroup) => (
                      <div key={catGroup.category} className="repair-category-block">
                        <div className="repair-category-header">
                          <span
                            className={`repair-category-tag ${
                              catGroup.issues.some((i) => i.severity === "blocking")
                                ? "repair-tag-blocking"
                                : "repair-tag-warning"
                            }`}
                          >
                            {catGroup.categoryLabel}
                          </span>
                          <span className="repair-category-count">
                            {catGroup.issues.length} 条
                          </span>
                          <div className="repair-affected-roles">
                            {catGroup.affectedRoles.map((role) => (
                              <span key={role} className={`repair-role-chip repair-role-${role}`}>
                                {roleNamesLocal[role]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ul className="repair-issue-list">
                          {catGroup.issues.map((issue) => (
                            <li key={issue.id} className="repair-issue-item">
                              <div className="repair-issue-content">
                                <span
                                  className={`repair-severity-dot ${
                                    issue.severity === "blocking"
                                      ? "repair-dot-blocking"
                                      : "repair-dot-warning"
                                  }`}
                                />
                                <span className="repair-issue-msg">{issue.message}</span>
                              </div>
                              {jumpableCategories.has(issue.category) && props.onJumpToFix && (
                                <button
                                  className="repair-jump-btn"
                                  onClick={() => handleJumpToFix(issue)}
                                >
                                  去处理 →
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="issue-lists-wrap">
            {blockingIssues.length > 0 && (
              <div className="issue-list-block">
                <div className="issue-list-header issue-header-blocking">
                  <h3>🚫 阻断问题（{blockingIssues.length}）</h3>
                  <span className="issue-header-tag">必须修复</span>
                </div>
                <ul className="issue-list">
                  {blockingIssues.map((issue) => (
                    <li key={issue.id} className="issue-item issue-blocking">
                      <div className="issue-item-head">
                        <span className="issue-category-tag issue-tag-blocking">
                          {categoryLabels[issue.category] || issue.category}
                        </span>
                        {issue.recordId !== undefined && (
                          <span className="issue-record-ref">
                            关联记录 #{issue.recordId}
                          </span>
                        )}
                        {issue.trenchNumber && (
                          <span className="issue-trench-ref">
                            探方 {issue.trenchNumber}
                          </span>
                        )}
                      </div>
                      <p className="issue-item-message">{issue.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warningIssues.length > 0 && (
              <div className="issue-list-block">
                <div className="issue-list-header issue-header-warning">
                  <h3>⚠ 警告问题（{warningIssues.length}）</h3>
                  <span className="issue-header-tag warning-tag">建议关注</span>
                </div>
                <ul className="issue-list">
                  {warningIssues.map((issue) => (
                    <li key={issue.id} className="issue-item issue-warning">
                      <div className="issue-item-head">
                        <span className="issue-category-tag issue-tag-warning">
                          {categoryLabels[issue.category] || issue.category}
                        </span>
                        {issue.recordId !== undefined && (
                          <span className="issue-record-ref">
                            关联记录 #{issue.recordId}
                          </span>
                        )}
                        {issue.trenchNumber && (
                          <span className="issue-trench-ref">
                            探方 {issue.trenchNumber}
                          </span>
                        )}
                        {issue.stratumName && !issue.trenchNumber && (
                          <span className="issue-trench-ref">
                            地层：{issue.stratumName}
                          </span>
                        )}
                      </div>
                      <p className="issue-item-message">{issue.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {blockingIssues.length === 0 && warningIssues.length === 0 && (
              <div className="no-issues-panel">
                <div className="no-issues-icon">🎉</div>
                <h3>一致性检查完全通过</h3>
                <p>未发现任何阻断问题或警告问题，资料包可放心导出。</p>
              </div>
            )}
          </div>

          <div className="report-schema-note">
            <details>
              <summary>📖 资料包 JSON 结构说明（schema v1.0.0）</summary>
              <div className="schema-details">
                <p>
                  <code>schemaVersion</code>：资料包结构版本号，便于未来向后兼容。
                </p>
                <p>
                  <code>projectInfo</code>：项目元信息（ID、标题、副标题、领域、导出时间、导出人）。
                </p>
                <p>
                  <code>metrics</code>：项目指标汇总（探方数、地层数、各审核状态记录数等）。
                </p>
                <p>
                  <code>filters</code>：导出时的搜索筛选条件快照（含是否启用筛选）。
                </p>
                <p>
                  <code>trenchRecords</code>：按探方聚合的摘要（出土物数、涉及地层、类型分布）。
                </p>
                <p>
                  <code>stratumRelations</code>：全部地层关系记录（A 关系 B）。
                </p>
                <p>
                  <code>artifacts</code>：全部出土物坐标记录原始数据。
                </p>
                <p>
                  <code>excavationLogs</code>：发掘日志（可选）。
                </p>
                <p>
                  <code>consistencyReport</code>：导出时的一致性报告快照，用于归档追溯。
                </p>
              </div>
            </details>
          </div>
        </div>
      )}
    </section>
  );
}
