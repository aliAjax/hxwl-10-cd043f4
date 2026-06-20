import { useState, useEffect, useCallback } from "react";
import type {
  ExportTaskRecord,
  ExportTaskType,
  ExportTaskSnapshot,
} from "../types";
import {
  getAllExportTasks,
  deleteExportTask,
  clearAllExportTasks,
} from "./exportTaskStore";
import { formatFileSize } from "./jsonExporter";

const taskTypeLabels: Record<ExportTaskType, string> = {
  consistency_check: "一致性检查",
  json_export: "JSON 导出",
  backend_upload: "后端上传",
  pdf_generation: "PDF 生成",
};

const taskTypeIcons: Record<ExportTaskType, string> = {
  consistency_check: "🔍",
  json_export: "📦",
  backend_upload: "☁️",
  pdf_generation: "📄",
};

const statusLabels: Record<string, string> = {
  success: "成功",
  error: "失败",
  pending: "处理中",
};

const statusColors: Record<string, string> = {
  success: "task-status-success",
  error: "task-status-error",
  pending: "task-status-pending",
};

export interface ExportTaskHistoryProps {
  projectId: string;
  onReapplyOptions: (snapshot: ExportTaskSnapshot) => void;
  onRedownloadJson: (task: ExportTaskRecord) => void;
}

export default function ExportTaskHistory(props: ExportTaskHistoryProps) {
  const [tasks, setTasks] = useState<ExportTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ExportTaskType | "all">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const allTasks = await getAllExportTasks({ projectId: props.projectId });
      setTasks(allTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务历史失败");
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm("确定要删除这条任务记录吗？")) return;
      try {
        await deleteExportTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "删除失败");
      }
    },
    []
  );

  const handleClearAll = useCallback(async () => {
    if (!window.confirm("确定要清空所有导出任务历史吗？此操作不可恢复。")) return;
    try {
      await clearAllExportTasks();
      setTasks([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空失败");
    }
  }, []);

  const handleReapply = useCallback(
    (task: ExportTaskRecord) => {
      props.onReapplyOptions(task.snapshot);
    },
    [props]
  );

  const handleRedownload = useCallback(
    (task: ExportTaskRecord) => {
      props.onRedownloadJson(task);
    },
    [props]
  );

  const filteredTasks =
    filterType === "all"
      ? tasks
      : tasks.filter((t) => t.taskType === filterType);

  const canRedownload = (task: ExportTaskRecord): boolean => {
    return (
      task.taskType === "json_export" &&
      task.status === "success" &&
      !!task.fileName
    );
  };

  const safeGet = <T,>(obj: unknown, path: string, defaultValue: T): T => {
    try {
      const keys = path.split(".");
      let result: unknown = obj;
      for (const key of keys) {
        if (result && typeof result === "object" && key in result) {
          result = (result as Record<string, unknown>)[key];
        } else {
          return defaultValue;
        }
      }
      return result as T;
    } catch {
      return defaultValue;
    }
  };

  const renderSnapshot = (snapshot: ExportTaskSnapshot) => {
    try {
      const options = snapshot.exportOptions || {
        includePendingRecords: true,
        includeRejectedRecords: true,
        includeLogs: true,
      };
      const filters = snapshot.searchFilters || {
        trenchNumber: "",
        stratum: "",
        relicUnit: "",
        artifactKeyword: "",
      };

      return (
        <div className="task-snapshot">
          <div className="snapshot-section">
            <h5>导出选项</h5>
            <div className="snapshot-options">
              <span
                className={`option-chip ${
                  options.includePendingRecords ? "option-on" : "option-off"
                }`}
              >
                待审核: {options.includePendingRecords ? "✓" : "✗"}
              </span>
              <span
                className={`option-chip ${
                  options.includeRejectedRecords ? "option-on" : "option-off"
                }`}
              >
                已退回: {options.includeRejectedRecords ? "✓" : "✗"}
              </span>
              <span
                className={`option-chip ${
                  options.includeLogs ? "option-on" : "option-off"
                }`}
              >
                日志: {options.includeLogs ? "✓" : "✗"}
              </span>
            </div>
          </div>

          {snapshot.hasActiveFilters && (
            <div className="snapshot-section">
              <h5>筛选条件</h5>
              <div className="snapshot-filters">
                {filters.trenchNumber && (
                  <span className="filter-chip">探方: {filters.trenchNumber}</span>
                )}
                {filters.stratum && (
                  <span className="filter-chip">地层: {filters.stratum}</span>
                )}
                {filters.relicUnit && (
                  <span className="filter-chip">遗迹: {filters.relicUnit}</span>
                )}
                {filters.artifactKeyword && (
                  <span className="filter-chip">关键词: {filters.artifactKeyword}</span>
                )}
              </div>
            </div>
          )}
        </div>
      );
    } catch {
      return (
        <div className="task-snapshot-error">
          ⚠️ 快照数据格式异常，可能为旧版本记录
        </div>
      );
    }
  };

  const renderCheckResult = (task: ExportTaskRecord) => {
    const result = task.checkResult;
    if (!result) return null;

    try {
      return (
        <div className="task-check-result">
          <div
            className={`check-result-item ${
              result.blockingCount > 0 ? "result-bad" : "result-ok"
            }`}
          >
            阻断: {result.blockingCount}
          </div>
          <div
            className={`check-result-item ${
              result.warningCount > 0 ? "result-warning" : "result-ok"
            }`}
          >
            警告: {result.warningCount}
          </div>
          <div
            className={`check-result-item ${
              result.isExportable ? "result-ok" : "result-bad"
            }`}
          >
            {result.isExportable ? "✓ 可导出" : "✗ 不可导出"}
          </div>
        </div>
      );
    } catch {
      return null;
    }
  };

  const formatDateTime = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString || "未知时间";
    }
  };

  const renderTaskCard = (task: ExportTaskRecord) => {
    try {
      const isExpanded = expandedId === task.id;
      const canRetry = task.taskType === "consistency_check" || task.taskType === "json_export";
      const redownloadable = canRedownload(task);

      return (
        <div key={task.id} className={`task-card ${isExpanded ? "task-expanded" : ""}`}>
          <div className="task-card-header" onClick={() => setExpandedId(isExpanded ? null : task.id)}>
            <div className="task-type-info">
              <span className="task-icon">{taskTypeIcons[task.taskType]}</span>
              <span className="task-type-label">{taskTypeLabels[task.taskType]}</span>
              <span className={`task-status-chip ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            </div>
            <div className="task-time-info">
              <span className="task-time">{formatDateTime(task.createdAt)}</span>
              <span className="task-expand-icon">{isExpanded ? "▲" : "▼"}</span>
            </div>
          </div>

          {isExpanded && (
            <div className="task-card-body">
              <div className="task-meta">
                {task.fileName && (
                  <div className="task-meta-row">
                    <span className="meta-label">文件名:</span>
                    <code className="meta-value">{task.fileName}</code>
                  </div>
                )}
                {typeof task.fileSizeBytes === "number" && (
                  <div className="task-meta-row">
                    <span className="meta-label">文件大小:</span>
                    <span className="meta-value">{formatFileSize(task.fileSizeBytes)}</span>
                  </div>
                )}
                {task.taskId && (
                  <div className="task-meta-row">
                    <span className="meta-label">任务ID:</span>
                    <span className="meta-value">{task.taskId}</span>
                  </div>
                )}
                {task.dataPackageSchemaVersion && (
                  <div className="task-meta-row">
                    <span className="meta-label">资料包版本:</span>
                    <span className="meta-value">{task.dataPackageSchemaVersion}</span>
                  </div>
                )}
                <div className="task-meta-row">
                  <span className="meta-label">历史版本:</span>
                  <span className="meta-value">schema v{task.schemaVersion}</span>
                </div>
                {task.completedAt && (
                  <div className="task-meta-row">
                    <span className="meta-label">完成时间:</span>
                    <span className="meta-value">{formatDateTime(task.completedAt)}</span>
                  </div>
                )}
              </div>

              {task.checkResult && renderCheckResult(task)}

              {task.message && (
                <div className="task-message">
                  <strong>消息:</strong> {task.message}
                </div>
              )}

              {task.error && (
                <div className="task-error">
                  <strong>失败原因:</strong> {task.error}
                </div>
              )}

              {renderSnapshot(task.snapshot)}

              <div className="task-actions">
                {canRetry && (
                  <button
                    className="task-action-btn task-action-retry"
                    onClick={() => handleReapply(task)}
                  >
                    🔄 基于此选项重新检查
                  </button>
                )}
                {redownloadable && (
                  <button
                    className="task-action-btn task-action-download"
                    onClick={() => handleRedownload(task)}
                  >
                    📥 重新下载资料包
                  </button>
                )}
                <button
                  className="task-action-btn task-action-delete"
                  onClick={() => handleDelete(task.id)}
                >
                  🗑️ 删除记录
                </button>
              </div>
            </div>
          )}
        </div>
      );
    } catch (err) {
      console.warn("渲染任务卡片失败，跳过该记录:", err);
      return (
        <div key={safeGet(task, "id", Date.now())} className="task-card task-card-error">
          <div className="task-card-header">
            <span className="task-icon">⚠️</span>
            <span className="task-type-label">记录格式异常</span>
            <span className="task-status-chip task-status-error">损坏</span>
          </div>
          <div className="task-card-body">
            <p className="task-error">
              此任务记录可能来自旧版本，数据格式不兼容。
            </p>
            <button
              className="task-action-btn task-action-delete"
              onClick={() => handleDelete(safeGet(task, "id", 0))}
            >
              🗑️ 删除此损坏记录
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="task-history-panel">
      <div className="task-history-header">
        <div>
          <h3>📜 导出任务历史</h3>
          <span className="task-history-subtitle">
            共 {tasks.length} 条记录
          </span>
        </div>
        <div className="task-history-controls">
          <select
            className="task-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ExportTaskType | "all")}
          >
            <option value="all">全部类型</option>
            <option value="consistency_check">一致性检查</option>
            <option value="json_export">JSON 导出</option>
            <option value="backend_upload">后端上传</option>
            <option value="pdf_generation">PDF 生成</option>
          </select>
          <button className="task-refresh-btn" onClick={loadTasks} disabled={loading}>
            🔄 刷新
          </button>
          {tasks.length > 0 && (
            <button className="task-clear-btn" onClick={handleClearAll}>
              🗑️ 清空
            </button>
          )}
        </div>
      </div>

      {error && <div className="task-history-error">{error}</div>}

      {loading ? (
        <div className="task-history-loading">⏳ 加载中...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="task-history-empty">
          <div className="empty-icon">📭</div>
          <p>暂无导出任务记录</p>
          <p className="empty-hint">
            {filterType !== "all"
              ? "当前筛选条件下没有记录，试试切换筛选类型"
              : "运行一致性检查或导出资料包后，记录会显示在这里"}
          </p>
        </div>
      ) : (
        <div className="task-list">
          {filteredTasks.map((task) => renderTaskCard(task))}
        </div>
      )}

      <div className="task-history-footer">
        <details>
          <summary>ℹ️ 关于任务历史</summary>
          <div className="history-info">
            <p>
              <strong>存储位置:</strong> 本地浏览器 IndexedDB（仅保存在当前设备）
            </p>
            <p>
              <strong>历史版本:</strong> schema v{safeGet(tasks[0], "schemaVersion", "1.0.0")}
              ，支持向后兼容旧版本记录
            </p>
            <p>
              <strong>可恢复操作:</strong> 基于历史选项重新运行检查、重新下载可复现的
              JSON 资料包
            </p>
            <p>
              <strong>注意:</strong> 重新生成的资料包使用当前最新数据，可能与历史结果不同
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
