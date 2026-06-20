import { useState, useMemo } from "react";
import {
  type UserRole,
  type OverviewState,
  type TrenchSummary,
  type AnomalyRecord,
  type MissingFieldItem,
  type PendingRelationItem,
  type PendingArchiveItem,
  type OverviewFilters,
  type ExceptionAction,
  type ChronologyInferenceReport,
  type ChronologyRisk,
} from "./types";

const roleNames: Record<UserRole, string> = {
  excavator: "发掘队员",
  leader: "领队",
  archivist: "资料整理员",
};

const severityColors: Record<AnomalyRecord["severity"], string> = {
  warning: "#f59e0b",
  error: "#e11d48",
  critical: "#7c2d12",
};

const severityLabels: Record<AnomalyRecord["severity"], string> = {
  warning: "警告",
  error: "错误",
  critical: "严重",
};

const anomalyTypeLabels: Record<string, string> = {
  missing_coordinate: "坐标缺失",
  invalid_coordinate: "坐标无效",
  missing_field: "字段缺失",
  stratum_conflict: "地层冲突",
  unreviewed_record: "待审核",
  unarchived_record: "待归档",
  incomplete_relation: "关系不完整",
};

interface ExcavationOverviewProps {
  overviewState: OverviewState;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onRecordClick?: (recordId: number) => void;
  onTrenchSelect?: (trenchNumber: string) => void;
  onExceptionAction?: (action: ExceptionAction) => void;
}

function ProgressBar({ percent, size = "md" }: { percent: number; size?: "sm" | "md" | "lg" }) {
  const heights = { sm: "h-2", md: "h-3", lg: "h-4" };
  const color = percent >= 80 ? "#047857" : percent >= 50 ? "#f59e0b" : "#e11d48";

  return (
    <div className={`overview-progress-bar ${heights[size]}`}>
      <div
        className="overview-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
      />
    </div>
  );
}

function TrenchCard({
  trench,
  isSelected,
  onClick,
}: {
  trench: TrenchSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  const totalAnomalies = trench.coordinateAnomalies + trench.fieldAnomalies + trench.relationIssues;

  return (
    <article
      className={`trench-card ${isSelected ? "trench-card-selected" : ""}`}
      onClick={onClick}
    >
      <div className="trench-card-header">
        <h3 className="trench-card-title">{trench.trenchNumber}</h3>
        <span className="trench-card-progress">{trench.progressPercent}%</span>
      </div>
      <ProgressBar percent={trench.progressPercent} size="sm" />
      <div className="trench-card-stats">
        <div className="trench-stat">
          <span className="trench-stat-label">出土物</span>
          <span className="trench-stat-value">{trench.totalArtifacts}</span>
        </div>
        <div className="trench-stat">
          <span className="trench-stat-label">已归档</span>
          <span className="trench-stat-value status-archived">{trench.archived}</span>
        </div>
        <div className="trench-stat">
          <span className="trench-stat-label">待审核</span>
          <span className="trench-stat-value status-pending">{trench.pendingReview}</span>
        </div>
      </div>
      {totalAnomalies > 0 && (
        <div className="trench-card-anomalies">
          <span className="anomaly-badge">⚠ {totalAnomalies} 项异常</span>
        </div>
      )}
      <div className="trench-card-footer">
        <span className="trench-card-time">{trench.lastActivity}</span>
      </div>
    </article>
  );
}

function RoleSummaryCard({
  role,
  viewData,
  isActive,
  onClick,
}: {
  role: UserRole;
  viewData: OverviewState["roleViews"][UserRole];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`role-summary-card ${isActive ? "role-summary-active" : ""}`}
      onClick={onClick}
    >
      <div className="role-summary-header">
        <h4>{viewData.roleName}</h4>
        {viewData.priorityItems > 0 && (
          <span className="role-priority-badge">{viewData.priorityItems}</span>
        )}
      </div>
      <div className="role-summary-stats">
        {viewData.summary.map((item, idx) => (
          <div key={idx} className="role-stat-item">
            <span className="role-stat-label">{item.label}</span>
            <span className="role-stat-value">{item.value}</span>
            <span className={`role-stat-trend trend-${item.trend}`}>
              {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingFieldItemView({
  item,
  onClick,
}: {
  item: MissingFieldItem;
  onClick?: () => void;
}) {
  return (
    <article className="overview-item missing-field-item clickable-action" onClick={onClick} title="点击跳转到记录补录区域">
      <div className="overview-item-icon missing-icon">📝</div>
      <div className="overview-item-content">
        <div className="overview-item-header">
          <span className="item-type-badge type-missing">待补录</span>
          <strong>#{item.recordId} · {item.artifactType}</strong>
        </div>
        <p className="overview-item-meta">
          {item.trenchNumber} · {item.stratum}
        </p>
        <p className="overview-item-message">
          缺少字段：<strong>{item.fieldLabel}</strong>
          {item.currentValue && ` (当前值: "${item.currentValue}")`}
        </p>
        {item.submittedAt && (
          <span className="overview-item-time">提交时间：{item.submittedAt}</span>
        )}
      </div>
      <span className="action-hint">→ 去补录</span>
    </article>
  );
}

function PendingRelationItemView({
  item,
  onClick,
}: {
  item: PendingRelationItem;
  onClick?: () => void;
}) {
  return (
    <article
      className={`overview-item relation-item clickable-action ${item.hasConflictingRelation ? "relation-conflict" : ""}`}
      onClick={onClick}
      title="点击跳转到地层关系复核区域"
    >
      <div className={`overview-item-icon ${item.hasConflictingRelation ? "conflict-icon" : "relation-icon"}`}>
        {item.hasConflictingRelation ? "⚠️" : "🔗"}
      </div>
      <div className="overview-item-content">
        <div className="overview-item-header">
          <span className={`item-type-badge ${item.hasConflictingRelation ? "type-conflict" : "type-relation"}`}>
            {item.hasConflictingRelation ? "关系冲突" : "待复核"}
          </span>
          <strong>{item.stratumA} ↔ {item.stratumB}</strong>
        </div>
        <p className="overview-item-meta">{item.trenchNumber}</p>
        <p className="overview-item-message">{item.issue}</p>
        {item.suggestion && (
          <p className="overview-item-suggestion">💡 {item.suggestion}</p>
        )}
        <div className="overview-item-footer">
          <span className="related-count">关联出土物：{item.relatedArtifactCount} 件</span>
        </div>
      </div>
      <span className="action-hint">→ 去复核</span>
    </article>
  );
}

function PendingArchiveItemView({
  item,
  onClick,
}: {
  item: PendingArchiveItem;
  onClick?: () => void;
}) {
  return (
    <article className="overview-item archive-item clickable-action" onClick={onClick} title="点击跳转到归档操作区域">
      <div className="overview-item-icon archive-icon">📦</div>
      <div className="overview-item-content">
        <div className="overview-item-header">
          <span className="item-type-badge type-archive">待归档</span>
          <strong>#{item.recordId} · {item.artifactType}</strong>
          {item.quantity && <span className="item-qty">×{item.quantity}</span>}
        </div>
        <p className="overview-item-meta">
          {item.trenchNumber} · {item.stratum}
        </p>
        {item.reviewReason && (
          <p className="overview-item-message">审核意见：{item.reviewReason}</p>
        )}
        <div className="overview-item-footer">
          {item.approvedBy && <span>审核：{item.approvedBy}</span>}
          {item.approvedAt && <span className="overview-item-time">{item.approvedAt}</span>}
        </div>
      </div>
      <span className="action-hint">→ 去归档</span>
    </article>
  );
}

function AnomalyItemView({
  item,
  onClick,
}: {
  item: AnomalyRecord;
  onClick?: () => void;
}) {
  return (
    <article className="overview-item anomaly-item" onClick={onClick}>
      <div
        className="overview-item-icon"
        style={{ background: `${severityColors[item.severity]}20`, color: severityColors[item.severity] }}
      >
        {item.severity === "critical" ? "🚨" : item.severity === "error" ? "❌" : "⚠️"}
      </div>
      <div className="overview-item-content">
        <div className="overview-item-header">
          <span
            className="item-type-badge"
            style={{
              background: `${severityColors[item.severity]}15`,
              color: severityColors[item.severity],
              borderColor: `${severityColors[item.severity]}40`,
            }}
          >
            {severityLabels[item.severity]} · {anomalyTypeLabels[item.type] || item.type}
          </span>
          {item.recordId && <strong>#{item.recordId}</strong>}
        </div>
        <p className="overview-item-meta">
          {item.trenchNumber}
          {item.stratum && ` · ${item.stratum}`}
          {item.relicUnit && ` · 遗迹: ${item.relicUnit}`}
        </p>
        <p className="overview-item-message">{item.message}</p>
        <div className="overview-item-footer">
          <span className="overview-item-time">{item.createdAt}</span>
        </div>
      </div>
    </article>
  );
}

function UnorganizedStatsPanel({ stats }: { stats: OverviewState["unorganizedStats"] }) {
  const items = [
    { label: "总记录数", value: stats.totalRecords, color: "#475569" },
    { label: "坐标缺失", value: stats.missingCoordinates, color: "#e11d48" },
    { label: "坐标无效", value: stats.invalidCoordinates, color: "#f59e0b" },
    { label: "必填字段缺失", value: stats.missingRequiredFields, color: "#dc2626" },
    { label: "未关联遗迹单位", value: stats.withoutRelicUnit, color: "#854d0e" },
    { label: "未填写数量", value: stats.withoutQuantity, color: "#047857" },
  ];

  return (
    <div className="unorganized-stats-panel">
      <h4 className="panel-subtitle">未整理记录统计</h4>
      <div className="unorganized-stats-grid">
        {items.map((item, idx) => (
          <div key={idx} className="unorganized-stat-item">
            <span className="unorganized-stat-value" style={{ color: item.color }}>
              {item.value}
            </span>
            <span className="unorganized-stat-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChronologyOverviewPanel({
  chronology,
}: {
  chronology: ChronologyInferenceReport | undefined;
}) {
  if (!chronology) return null;

  const s = chronology.summary;
  const criticalRisks = chronology.risks.filter((r) => r.level === "critical");
  const warningRisks = chronology.risks.filter(
    (r) => r.level === "warning" && r.type !== "unreviewed_in_chain"
  );

  return (
    <div className="chronology-overview-panel">
      <h4 className="panel-subtitle">
        📊 地层年代推断
        {chronology.hasInconsistency && (
          <span className="chrono-overview-badge chrono-overview-bad">⚠ 不一致</span>
        )}
        {!chronology.hasInconsistency && (
          <span className="chrono-overview-badge chrono-overview-badge-ok">✅ 正常</span>
        )}
      </h4>

      <div className="chrono-overview-grid">
        <div className="chrono-overview-item">
          <span className="chrono-overview-value">{s.totalNodes}</span>
          <span className="chrono-overview-label">涉及层位/遗迹</span>
        </div>
        <div className="chrono-overview-item">
          <span className="chrono-overview-value">{chronology.totalLayers || 0}</span>
          <span className="chrono-overview-label">推断年代分层</span>
        </div>
        <div className="chrono-overview-item">
          <span className="chrono-overview-value">{s.totalDirectRelations}</span>
          <span className="chrono-overview-label">直接关系</span>
        </div>
        <div className="chrono-overview-item">
          <span className="chrono-overview-value">{s.totalInferredRelations}</span>
          <span className="chrono-overview-label">推断/传递</span>
        </div>
        {s.totalWeakRelations && s.totalWeakRelations > 0 && (
          <div className="chrono-overview-item chrono-overview-item-full">
            <span className="chrono-overview-value chrono-overview-value-weaker">
              +{s.totalWeakRelations}
            </span>
            <span className="chrono-overview-label">共出弱关联</span>
          </div>
        )}
      </div>

      {(criticalRisks.length > 0 || warningRisks.length > 0) && (
        <div className="chrono-overview-risks">
          <div className="chrono-overview-risks-title">⚠ 风险提示</div>
          <ul className="chrono-overview-risks-list">
            {[...criticalRisks, ...warningRisks].slice(0, 5).map((risk) => (
              <li key={risk.id} className={`chrono-overview-risk chrono-overview-risk-${risk.level}`}>
                <span className="chrono-overview-risk-text">
                  {risk.message.length > 50
                    ? risk.message.slice(0, 50) + "..."
                    : risk.message}
                </span>
              </li>
            ))}
            {chronology.risks.length > 5 && (
              <li className="chrono-overview-risk-more">
                ...另有 {chronology.risks.length - 5} 项风险，详见导出报告
              </li>
            )}
          </ul>
        </div>
      )}

      {chronology.orderedSequence.length > 0 && (
        <div className="chrono-overview-sequence">
          <div className="chrono-overview-risks-title">📜 相对年代序列（从早到晚）</div>
          <div className="chrono-overview-sequence-list">
            {chronology.orderedSequence
              .filter((o) => o.layerGroup >= 0)
              .slice(0, 6)
              .map((item) => (
                <div
                  key={item.nodeKey}
                  className={`chrono-overview-seq-item ${
                    item.isUncertain ? "chrono-seq-uncertain" : ""
                  }`}
                >
                  <span className="chrono-seq-layer">L{item.rank}</span>
                  <span className="chrono-seq-name">{item.nodeName}</span>
                  {item.trenchNumber && (
                    <span className="chrono-seq-trench">{item.trenchNumber}</span>
                  )}
                  {item.isUncertain && <span className="chrono-seq-warn">⚠</span>}
                </div>
              ))}
            {chronology.orderedSequence.filter((o) => o.layerGroup >= 0).length > 6 && (
              <div className="chrono-overview-seq-more">
                ... 共 {chronology.totalLayers} 层，详见完整报告
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StratumDetailsPanel({
  trench,
  onRecordClick,
}: {
  trench: TrenchSummary | null;
  onRecordClick?: (recordId: number) => void;
}) {
  if (!trench) {
    return (
      <div className="details-empty">
        <div className="details-empty-icon">📐</div>
        <p>请选择一个探方查看详细信息</p>
      </div>
    );
  }

  return (
    <div className="stratum-details-panel">
      <div className="details-header">
        <h4 className="panel-subtitle">{trench.trenchNumber} 详细信息</h4>
        <div className="details-progress">
          <span>整体进度：{trench.progressPercent}%</span>
          <ProgressBar percent={trench.progressPercent} size="sm" />
        </div>
      </div>

      <div className="details-section">
        <h5 className="details-section-title">地层列表 ({trench.strata.length})</h5>
        <div className="stratum-list">
          {trench.strata.map((stratum) => (
            <div key={stratum.name} className="stratum-item">
              <div className="stratum-item-header">
                <strong>{stratum.name}</strong>
                <span className="stratum-count">{stratum.artifactCount} 件</span>
              </div>
              <div className="stratum-item-stats">
                <span className="stat-tag stat-pending">待审 {stratum.pendingReviewCount}</span>
                <span className="stat-tag stat-approved">通过 {stratum.approvedCount}</span>
                <span className="stat-tag stat-archived">归档 {stratum.archivedCount}</span>
                {stratum.anomalyCount > 0 && (
                  <span className="stat-tag stat-anomaly">⚠ {stratum.anomalyCount}</span>
                )}
                {!stratum.hasRelations && (
                  <span className="stat-tag stat-warning">无关系</span>
                )}
              </div>
              {stratum.lastUpdated && (
                <span className="stratum-item-time">最后更新：{stratum.lastUpdated}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {trench.relicUnits.length > 0 && (
        <div className="details-section">
          <h5 className="details-section-title">遗迹单位 ({trench.relicUnits.length})</h5>
          <div className="relic-unit-list">
            {trench.relicUnits.map((relic) => (
              <div key={relic.name} className="relic-unit-item">
                <div className="relic-unit-header">
                  <strong>{relic.name}</strong>
                  <span className="relic-stratum">{relic.stratum}</span>
                </div>
                <div className="relic-unit-stats">
                  <span>出土物：{relic.artifactCount} 件</span>
                  <span>待审：{relic.pendingReviewCount}</span>
                  <span>已归档：{relic.archivedCount}</span>
                  {relic.anomalyCount > 0 && (
                    <span className="relic-anomaly">⚠ {relic.anomalyCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="details-section">
        <h5 className="details-section-title">问题汇总</h5>
        <div className="issues-summary">
          <div className="issue-item">
            <span className="issue-icon">📍</span>
            <span>坐标异常：{trench.coordinateAnomalies} 项</span>
          </div>
          <div className="issue-item">
            <span className="issue-icon">📝</span>
            <span>字段缺失：{trench.fieldAnomalies} 项</span>
          </div>
          <div className="issue-item">
            <span className="issue-icon">🔗</span>
            <span>关系问题：{trench.relationIssues} 项</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExcavationOverview({
  overviewState,
  currentRole,
  onRoleChange,
  onRecordClick,
  onTrenchSelect,
  onExceptionAction,
}: ExcavationOverviewProps) {
  const [selectedTrench, setSelectedTrench] = useState<string>("");
  const [filters, setFilters] = useState<OverviewFilters>({
    trenchNumber: "",
    anomalyType: "all",
    severity: "all",
    status: "all",
  });

  const currentRoleView = overviewState.roleViews[currentRole];
  const selectedTrenchData = overviewState.trenches.find(
    (t) => t.trenchNumber === selectedTrench
  ) || null;

  const filteredItems = useMemo(() => {
    let items = [...currentRoleView.items];

    if (filters.trenchNumber) {
      items = items.filter((item) => {
        if ("trenchNumber" in item) {
          return item.trenchNumber === filters.trenchNumber;
        }
        return true;
      });
    }

    if (filters.severity !== "all") {
      items = items.filter((item) => {
        if ("severity" in item) {
          return item.severity === filters.severity;
        }
        return true;
      });
    }

    return items;
  }, [currentRoleView.items, filters.trenchNumber, filters.severity]);

  const handleTrenchClick = (trenchNumber: string) => {
    setSelectedTrench(trenchNumber === selectedTrench ? "" : trenchNumber);
    if (onTrenchSelect) {
      onTrenchSelect(trenchNumber);
    }
  };

  const handleItemClick = (item: typeof filteredItems[0]) => {
    if (onExceptionAction) {
      if ("fieldName" in item) {
        onExceptionAction({
          type: "missing_field",
          recordId: item.recordId,
          trenchNumber: item.trenchNumber,
          stratum: item.stratum,
          fieldName: item.fieldName,
          fieldLabel: item.fieldLabel,
          artifactType: item.artifactType,
        });
        return;
      }
      if ("stratumA" in item && "stratumB" in item) {
        onExceptionAction({
          type: "pending_relation",
          stratumA: item.stratumA,
          stratumB: item.stratumB,
          trenchNumber: item.trenchNumber,
          relationId: item.relationId,
        });
        return;
      }
      if ("approvedAt" in item) {
        onExceptionAction({
          type: "pending_archive",
          recordId: item.recordId,
          trenchNumber: item.trenchNumber,
          stratum: item.stratum,
          artifactType: item.artifactType,
        });
        return;
      }
    }
    if (onRecordClick && "recordId" in item && item.recordId) {
      onRecordClick(item.recordId);
    }
  };

  const handleFilterChange = (
    field: keyof OverviewFilters,
    value: OverviewFilters[typeof field]
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const renderItem = (item: typeof filteredItems[0], index: number) => {
    if ("fieldName" in item) {
      return (
        <MissingFieldItemView
          key={`missing-field-${item.recordId}-${String(item.fieldName)}`}
          item={item}
          onClick={() => handleItemClick(item)}
        />
      );
    }
    if ("stratumA" in item && "stratumB" in item) {
      return (
        <PendingRelationItemView
          key={`pending-relation-${item.stratumA}-${item.stratumB}-${item.relationId || "new"}`}
          item={item}
          onClick={() => handleItemClick(item)}
        />
      );
    }
    if ("approvedAt" in item) {
      return (
        <PendingArchiveItemView
          key={`pending-archive-${item.recordId}`}
          item={item}
          onClick={() => handleItemClick(item)}
        />
      );
    }
    if ("type" in item && "severity" in item) {
      return (
        <AnomalyItemView
          key={`anomaly-${item.id}`}
          item={item}
          onClick={() => handleItemClick(item)}
        />
      );
    }
    return null;
  };

  return (
    <section className="panel overview-panel">
      <div className="section-heading">
        <div>
          <p>进度总览</p>
          <h2>多探方发掘进度总览</h2>
        </div>
        <div className="overview-header-actions">
          <div className="overall-progress">
            <span>整体进度：{overviewState.overallProgress}%</span>
            <ProgressBar percent={overviewState.overallProgress} size="md" />
          </div>
          <span className="overview-update-time">
            更新时间：{overviewState.lastUpdated}
          </span>
        </div>
      </div>

      <div className="overview-layout">
        <div className="overview-main">
          <div className="role-switch-section">
            <h4 className="panel-subtitle">角色视角切换</h4>
            <div className="role-cards-grid">
              {(Object.keys(overviewState.roleViews) as UserRole[]).map((role) => (
                <RoleSummaryCard
                  key={role}
                  role={role}
                  viewData={overviewState.roleViews[role]}
                  isActive={currentRole === role}
                  onClick={() => onRoleChange(role)}
                />
              ))}
            </div>
          </div>

          <div className="trenches-section">
            <div className="section-row-header">
              <h4 className="panel-subtitle">探方进度 ({overviewState.trenches.length})</h4>
              <select
                className="overview-filter-select"
                value={filters.trenchNumber}
                onChange={(e) => handleFilterChange("trenchNumber", e.target.value)}
              >
                <option value="">全部探方</option>
                {overviewState.trenches.map((t) => (
                  <option key={t.trenchNumber} value={t.trenchNumber}>
                    {t.trenchNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="trenches-grid">
              {overviewState.trenches.map((trench) => (
                <TrenchCard
                  key={trench.trenchNumber}
                  trench={trench}
                  isSelected={selectedTrench === trench.trenchNumber}
                  onClick={() => handleTrenchClick(trench.trenchNumber)}
                />
              ))}
            </div>
          </div>

          <div className="items-section">
            <div className="section-row-header">
              <h4 className="panel-subtitle">
                {currentRoleView.roleName}待处理事项 ({filteredItems.length})
              </h4>
              <div className="overview-filters">
                {currentRole === "leader" && (
                  <select
                    className="overview-filter-select"
                    value={filters.severity}
                    onChange={(e) =>
                      handleFilterChange(
                        "severity",
                        e.target.value as OverviewFilters["severity"]
                      )
                    }
                  >
                    <option value="all">全部级别</option>
                    <option value="warning">警告</option>
                    <option value="error">错误</option>
                    <option value="critical">严重</option>
                  </select>
                )}
              </div>
            </div>
            {filteredItems.length === 0 ? (
              <div className="items-empty">
                <div className="items-empty-icon">🎉</div>
                <p>当前视角下没有待处理事项</p>
                <p className="items-empty-hint">所有工作已完成，继续保持！</p>
              </div>
            ) : (
              <div className="overview-items-list">{filteredItems.map(renderItem)}</div>
            )}
          </div>
        </div>

        <aside className="overview-sidebar">
          <ChronologyOverviewPanel chronology={overviewState.chronologyReport} />
          <UnorganizedStatsPanel stats={overviewState.unorganizedStats} />
          <StratumDetailsPanel
            trench={selectedTrenchData}
            onRecordClick={onRecordClick}
          />
        </aside>
      </div>
    </section>
  );
}
