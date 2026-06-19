import React, { useState, useMemo, useEffect } from "react";
import {
  type StratumRelation,
  type RelationType,
  type ArtifactRecord,
  type GraphNode,
  type GraphEdge,
  type RelationConflict,
  type ConflictKind,
  type GraphPathStep,
  type TraversalResult,
  type GraphViewMode,
} from "./types";

const relationTypeMeta: Record<
  RelationType,
  { label: string; inverse: string; color: string; bgColor: string }
> = {
  earlier: {
    label: "早于",
    inverse: "晚于",
    color: "#854d0e",
    bgColor: "color-mix(in srgb, #854d0e 8%, #ffffff)",
  },
  breaks: {
    label: "打破",
    inverse: "被打破",
    color: "#e11d48",
    bgColor: "color-mix(in srgb, #e11d48 8%, #ffffff)",
  },
  contains: {
    label: "包含",
    inverse: "被包含于",
    color: "#047857",
    bgColor: "color-mix(in srgb, #047857 8%, #ffffff)",
  },
};

const detectConflicts = (
  relations: StratumRelation[]
): Map<number, RelationConflict[]> => {
  const result = new Map<number, RelationConflict[]>();
  const addConflict = (id: number, conflict: RelationConflict) => {
    const existing = result.get(id) || [];
    existing.push(conflict);
    result.set(id, existing);
  };

  for (let i = 0; i < relations.length; i++) {
    const a = relations[i];
    for (let j = i + 1; j < relations.length; j++) {
      const b = relations[j];

      if (
        a.stratumA === b.stratumA &&
        a.stratumB === b.stratumB &&
        a.relationType === b.relationType
      ) {
        const conflict: RelationConflict = {
          kind: "duplicate",
          relationIds: [a.id, b.id],
          message: `重复关系："${a.stratumA} ${
            relationTypeMeta[a.relationType].label
          } ${a.stratumB}" 已存在多条记录`,
        };
        addConflict(a.id, conflict);
        addConflict(b.id, conflict);
      }

      if (
        a.relationType === "breaks" &&
        b.relationType === "breaks" &&
        a.stratumA === b.stratumB &&
        a.stratumB === b.stratumA
      ) {
        const conflict: RelationConflict = {
          kind: "mutual_breaks",
          relationIds: [a.id, b.id],
          message: `互相打破矛盾：已存在"${a.stratumA} 打破 ${a.stratumB}"和"${b.stratumA} 打破 ${b.stratumB}"，打破关系不能互为反向`,
        };
        addConflict(a.id, conflict);
        addConflict(b.id, conflict);
      }

      if (
        a.relationType === "contains" &&
        b.relationType === "contains" &&
        a.stratumA === b.stratumB &&
        a.stratumB === b.stratumA
      ) {
        const conflict: RelationConflict = {
          kind: "mutual_contains",
          relationIds: [a.id, b.id],
          message: `互相包含矛盾：已存在"${a.stratumA} 包含 ${a.stratumB}"和"${b.stratumA} 包含 ${b.stratumB}"，包含关系不能互为反向`,
        };
        addConflict(a.id, conflict);
        addConflict(b.id, conflict);
      }

      if (
        a.relationType === "earlier" &&
        b.relationType === "earlier" &&
        a.stratumA === b.stratumB &&
        a.stratumB === b.stratumA
      ) {
        const conflict: RelationConflict = {
          kind: "mutual_earlier",
          relationIds: [a.id, b.id],
          message: `互相早于矛盾：已存在"${a.stratumA} 早于 ${a.stratumB}"和"${b.stratumA} 早于 ${b.stratumB}"，年代先后不能互为反向`,
        };
        addConflict(a.id, conflict);
        addConflict(b.id, conflict);
      }

      if (
        a.stratumA === b.stratumA &&
        a.stratumB === b.stratumB &&
        ((a.relationType === "breaks" && b.relationType === "earlier") ||
          (a.relationType === "earlier" && b.relationType === "breaks"))
      ) {
        const conflict: RelationConflict = {
          kind: "breaks_vs_earlier",
          relationIds: [a.id, b.id],
          message: `语义矛盾：同一对地层同时存在"${a.stratumA} ${
            relationTypeMeta[a.relationType].label
          } ${a.stratumB}"和"${b.stratumA} ${
            relationTypeMeta[b.relationType].label
          } ${b.stratumB}"，打破意味着年代更晚，不能同时早于`,
        };
        addConflict(a.id, conflict);
        addConflict(b.id, conflict);
      }
    }
  }

  return result;
};

const buildGraph = (
  relations: StratumRelation[],
  records: ArtifactRecord[]
): { nodes: GraphNode[]; edges: GraphEdge[]; conflictMap: Map<number, RelationConflict[]> } => {
  const conflictMap = detectConflicts(relations);
  const nodeMap = new Map<string, GraphNode>();

  relations.forEach((r) => {
    [r.stratumA, r.stratumB].forEach((name) => {
      if (!nodeMap.has(name)) {
        const trenchRecord = records.find((rec) => rec.stratum === name);
        nodeMap.set(name, {
          name,
          artifactCount: records.filter((r) => r.stratum === name).length,
          trenchNumber: trenchRecord?.trenchNumber,
        });
      }
    });
  });

  records.forEach((rec) => {
    if (rec.stratum && !nodeMap.has(rec.stratum)) {
      nodeMap.set(rec.stratum, {
        name: rec.stratum,
        artifactCount: records.filter((r) => r.stratum === rec.stratum).length,
        trenchNumber: rec.trenchNumber,
      });
    }
  });

  const edges: GraphEdge[] = relations.map((r) => ({
    id: `edge-${r.id}`,
    source: r.stratumA,
    target: r.stratumB,
    type: r.relationType,
    relationId: r.id,
    conflicts: conflictMap.get(r.id) || [],
  }));

  return { nodes: Array.from(nodeMap.values()), edges, conflictMap };
};

const traverseRelations = (
  startName: string,
  relations: StratumRelation[]
): TraversalResult => {
  const direct: GraphPathStep[] = [];
  const indirect: GraphPathStep[][] = [];
  const allReachable = new Set<string>();
  allReachable.add(startName);

  const adjacency = new Map<string, GraphPathStep[]>();
  relations.forEach((r) => {
    const forward: GraphPathStep = {
      from: r.stratumA,
      to: r.stratumB,
      type: r.relationType,
      relationId: r.id,
      direction: "forward",
    };
    const inverse: GraphPathStep = {
      from: r.stratumB,
      to: r.stratumA,
      type: r.relationType,
      relationId: r.id,
      direction: "inverse",
    };
    if (!adjacency.has(r.stratumA)) adjacency.set(r.stratumA, []);
    if (!adjacency.has(r.stratumB)) adjacency.set(r.stratumB, []);
    adjacency.get(r.stratumA)!.push(forward);
    adjacency.get(r.stratumB)!.push(inverse);
  });

  const queue: { node: string; path: GraphPathStep[] }[] = [
    { node: startName, path: [] },
  ];
  const visited = new Set<string>([startName]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    const depth = path.length;

    if (depth > 0) {
      allReachable.add(node);
      if (depth === 1) {
        direct.push(path[0]);
      } else {
        indirect.push([...path]);
      }
    }

    if (depth >= 5) continue;

    const neighbors = adjacency.get(node) || [];
    for (const step of neighbors) {
      if (!visited.has(step.to)) {
        visited.add(step.to);
        queue.push({ node: step.to, path: [...path, step] });
      }
    }
  }

  return { direct, indirect, allReachable };
};

interface StratumRelationGraphViewProps {
  relations: StratumRelation[];
  artifactRecords: ArtifactRecord[];
  onDeleteRelation?: (id: number) => void;
}

const StratumRelationGraphView: React.FC<StratumRelationGraphViewProps> = ({
  relations,
  artifactRecords,
  onDeleteRelation,
}) => {
  const [viewMode, setViewMode] = useState<GraphViewMode>("hierarchy");
  const [selectedStratum, setSelectedStratum] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const { nodes, edges, conflictMap } = useMemo(
    () => buildGraph(relations, artifactRecords),
    [relations, artifactRecords]
  );

  const traversal = useMemo(() => {
    if (!selectedStratum) return null;
    return traverseRelations(selectedStratum, relations);
  }, [selectedStratum, relations]);

  const allConflicts: RelationConflict[] = useMemo(() => {
    const seen = new Set<string>();
    const unique: RelationConflict[] = [];
    conflictMap.forEach((conflicts) => {
      conflicts.forEach((c) => {
        const key = c.kind + ":" + c.relationIds.sort().join(",");
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(c);
        }
      });
    });
    return unique;
  }, [conflictMap]);

  const stratumsWithRelations = useMemo(() => {
    const set = new Set<string>();
    relations.forEach((r) => {
      set.add(r.stratumA);
      set.add(r.stratumB);
    });
    return Array.from(set).sort();
  }, [relations]);

  useEffect(() => {
    if (nodes.length === 0) {
      setNodePositions(new Map());
      return;
    }

    const positions = new Map<string, { x: number; y: number }>();
    const centerX = 350;
    const centerY = 220;
    const radius = Math.min(160, 40 + nodes.length * 18);

    const earlierChain = new Map<string, string[]>();
    const containsChain = new Map<string, string[]>();
    nodes.forEach((n) => {
      earlierChain.set(n.name, []);
      containsChain.set(n.name, []);
    });
    edges.forEach((e) => {
      if (e.type === "earlier") {
        earlierChain.get(e.source)?.push(e.target);
      }
      if (e.type === "contains") {
        containsChain.get(e.source)?.push(e.target);
      }
    });

    const visited = new Set<string>();
    let layerIndex = 0;
    const layers: string[][] = [];
    const nodeLayer = new Map<string, number>();

    const roots = nodes.filter(
      (n) =>
        !edges.some(
          (e) =>
            (e.type === "earlier" && e.target === n.name) ||
            (e.type === "contains" && e.target === n.name)
        )
    );

    const layerQueue = roots.length > 0 ? [...roots.map((r) => r.name)] : [...nodes.map((n) => n.name)];
    while (layerQueue.length > 0 && layerIndex < 10) {
      const currentLayer: string[] = [];
      const nextLayer: string[] = [];
      while (layerQueue.length > 0) {
        const name = layerQueue.shift()!;
        if (visited.has(name)) continue;
        visited.add(name);
        currentLayer.push(name);
        nodeLayer.set(name, layerIndex);

        const nextNodes = [
          ...(earlierChain.get(name) || []),
          ...(containsChain.get(name) || []),
        ];
        nextNodes.forEach((nn) => {
          if (!visited.has(nn) && !layerQueue.includes(nn) && !nextLayer.includes(nn)) {
            nextLayer.push(nn);
          }
        });
      }
      if (currentLayer.length > 0) layers.push(currentLayer);
      layerQueue.push(...nextLayer);
      layerIndex++;
    }

    nodes.forEach((n) => {
      if (!visited.has(n.name)) {
        if (!layers[layerIndex]) layers[layerIndex] = [];
        layers[layerIndex].push(n.name);
        nodeLayer.set(n.name, layerIndex);
      }
    });

    const totalLayers = layers.length;
    layers.forEach((layer, layerIdx) => {
      const layerY =
        totalLayers === 1 ? centerY : 60 + (layerIdx * (centerY * 2 - 120)) / Math.max(1, totalLayers - 1);
      layer.forEach((name, idx) => {
        const count = layer.length;
        const layerX =
          count === 1
            ? centerX
            : centerX - radius + (idx * (radius * 2)) / Math.max(1, count - 1);
        const offsetX = (Math.sin(idx * 1.3 + layerIdx * 0.7) * 20);
        positions.set(name, {
          x: Math.max(60, Math.min(centerX * 2 - 60, layerX + offsetX)),
          y: Math.max(50, Math.min(centerY * 2 - 40, layerY)),
        });
      });
    });

    setNodePositions(positions);
  }, [nodes, edges]);

  const renderRelationBadge = (type: RelationType, showInverse = false) => {
    const meta = relationTypeMeta[type];
    const label = showInverse ? meta.inverse : meta.label;
    return (
      <span
        className="rg-relation-badge"
        style={{ color: meta.color, background: meta.bgColor, borderColor: meta.color }}
      >
        {label}
      </span>
    );
  };

  const pathStepToText = (step: GraphPathStep) => {
    const meta = relationTypeMeta[step.type];
    if (step.direction === "forward") {
      return `"${step.from}" ${meta.label} "${step.to}"`;
    }
    return `"${step.from}" ${meta.inverse} "${step.to}"`;
  };

  const isEdgeHighlighted = (edge: GraphEdge) => {
    if (!traversal || !selectedStratum) return false;
    if (
      (edge.source === selectedStratum || edge.target === selectedStratum) &&
      traversal.allReachable.has(edge.source) &&
      traversal.allReachable.has(edge.target)
    ) {
      return true;
    }
    return traversal.allReachable.has(edge.source) && traversal.allReachable.has(edge.target);
  };

  const isNodeHighlighted = (name: string) => {
    if (!traversal) return true;
    return traversal.allReachable.has(name);
  };

  return (
    <section className="panel rg-panel">
      <div className="section-heading rg-heading">
        <div>
          <p>关系网络</p>
          <h2>地层关系网络视图</h2>
        </div>
        <div className="rg-controls">
          <div className="rg-view-toggle">
            <button
              type="button"
              className={viewMode === "hierarchy" ? "rg-toggle-active" : ""}
              onClick={() => setViewMode("hierarchy")}
            >
              📋 层级列表
            </button>
            <button
              type="button"
              className={viewMode === "graph" ? "rg-toggle-active" : ""}
              onClick={() => setViewMode("graph")}
            >
              🕸 关系图
            </button>
          </div>
          <select
            className="rg-stratum-select"
            value={selectedStratum || ""}
            onChange={(e) => setSelectedStratum(e.target.value || null)}
          >
            <option value="">从某地层查看关联…</option>
            {stratumsWithRelations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {selectedStratum && (
            <button type="button" className="rg-clear-btn" onClick={() => setSelectedStratum(null)}>
              清除
            </button>
          )}
        </div>
      </div>

      {allConflicts.length > 0 && (
        <div className="rg-conflict-summary">
          <div className="rg-conflict-title">
            <span className="conflict-icon">⚠</span>
            <span>检测到 {allConflicts.length} 个冲突</span>
          </div>
          <ul className="rg-conflict-list">
            {allConflicts.map((c, i) => (
              <li key={i} className={`rg-conflict-item rg-conflict-${c.kind}`}>
                {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {relations.length === 0 && nodes.length === 0 ? (
        <div className="rg-empty">
          <div className="rg-empty-icon">🕸</div>
          <p>暂无地层关系记录，请先录入关系数据</p>
        </div>
      ) : (
        <>
          {viewMode === "graph" ? (
            <div className="rg-graph-wrapper">
              <svg
                className="rg-svg"
                viewBox={`0 0 700 440`}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <marker
                    id="arrow-earlier"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L10,5 L0,10 Z" fill="#854d0e" />
                  </marker>
                  <marker
                    id="arrow-breaks"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L10,5 L0,10 Z" fill="#e11d48" />
                  </marker>
                  <marker
                    id="arrow-contains"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L10,5 L0,10 Z" fill="#047857" />
                  </marker>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
                  </filter>
                </defs>

                {edges.map((edge) => {
                  const srcPos = nodePositions.get(edge.source);
                  const tgtPos = nodePositions.get(edge.target);
                  if (!srcPos || !tgtPos) return null;

                  const meta = relationTypeMeta[edge.type];
                  const hasConflict = edge.conflicts.length > 0;
                  const highlighted = isEdgeHighlighted(edge);
                  const dimmed = selectedStratum && !highlighted;
                  const isHovered = hoveredEdge === edge.id;

                  const dx = tgtPos.x - srcPos.x;
                  const dy = tgtPos.y - srcPos.y;
                  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                  const nodeRadius = 34;
                  const sx = srcPos.x + (dx / dist) * nodeRadius;
                  const sy = srcPos.y + (dy / dist) * nodeRadius;
                  const tx = tgtPos.x - (dx / dist) * (nodeRadius + 6);
                  const ty = tgtPos.y - (dy / dist) * (nodeRadius + 6);

                  const midX = (sx + tx) / 2;
                  const midY = (sy + ty) / 2;
                  const perpX = -dy / dist;
                  const perpY = dx / dist;
                  const curveOffset = 14;
                  const cx = midX + perpX * curveOffset;
                  const cy = midY + perpY * curveOffset;

                  return (
                    <g
                      key={edge.id}
                      onMouseEnter={() => setHoveredEdge(edge.id)}
                      onMouseLeave={() => setHoveredEdge(null)}
                      className={`rg-edge ${dimmed ? "rg-dimmed" : ""} ${
                        hasConflict ? "rg-edge-conflict" : ""
                      } ${isHovered ? "rg-edge-hover" : ""}`}
                      style={{ opacity: dimmed ? 0.15 : 1 }}
                    >
                      <path
                        d={`M${sx},${sy} Q${cx},${cy} ${tx},${ty}`}
                        fill="none"
                        stroke={hasConflict ? "#e11d48" : meta.color}
                        strokeWidth={isHovered || hasConflict ? 3 : 2}
                        strokeDasharray={hasConflict ? "6,4" : undefined}
                        markerEnd={`url(#arrow-${edge.type})`}
                      />
                      <g transform={`translate(${cx - 34}, ${cy - 12})`}>
                        <rect
                          x="0"
                          y="0"
                          width="68"
                          height="24"
                          rx="12"
                          fill="#ffffff"
                          stroke={hasConflict ? "#e11d48" : meta.color}
                          strokeWidth="1"
                          opacity={isHovered || hasConflict ? 1 : 0.95}
                        />
                        <text
                          x="34"
                          y="16"
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="600"
                          fill={hasConflict ? "#e11d48" : meta.color}
                        >
                          {meta.label}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {nodes.map((node) => {
                  const pos = nodePositions.get(node.name);
                  if (!pos) return null;
                  const isSelected = selectedStratum === node.name;
                  const highlighted = isNodeHighlighted(node.name);
                  const dimmed = selectedStratum && !highlighted;
                  const hasConflict = edges.some(
                    (e) =>
                      (e.source === node.name || e.target === node.name) &&
                      e.conflicts.length > 0
                  );

                  return (
                    <g
                      key={node.name}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className={`rg-node ${isSelected ? "rg-node-selected" : ""} ${
                        hasConflict ? "rg-node-conflict" : ""
                      } ${dimmed ? "rg-dimmed" : ""}`}
                      style={{ opacity: dimmed ? 0.25 : 1, cursor: "pointer" }}
                      onClick={() =>
                        setSelectedStratum(selectedStratum === node.name ? null : node.name)
                      }
                    >
                      <circle
                        r="34"
                        fill="#ffffff"
                        stroke={
                          hasConflict ? "#e11d48" : isSelected ? "#854d0e" : "#dbe3ef"
                        }
                        strokeWidth={isSelected || hasConflict ? 3 : 2}
                        filter="url(#shadow)"
                      />
                      <text
                        y="-2"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="#172033"
                      >
                        {node.name.length > 6 ? node.name.slice(0, 6) : node.name}
                      </text>
                      <text
                        y="14"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#64748b"
                      >
                        {node.name.length > 6 ? node.name.slice(6) : ""}
                      </text>
                      <circle
                        cx="24"
                        cy="-22"
                        r="11"
                        fill={node.artifactCount > 0 ? "#854d0e" : "#cbd5e1"}
                      />
                      <text
                        x="24"
                        y="-18"
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#ffffff"
                      >
                        {node.artifactCount}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="rg-graph-legend">
                <div className="rg-legend-item">
                  <span className="rg-legend-dot rg-dot-earlier"></span>
                  <span>早于（年代顺序）</span>
                </div>
                <div className="rg-legend-item">
                  <span className="rg-legend-dot rg-dot-breaks"></span>
                  <span>打破（打破关系）</span>
                </div>
                <div className="rg-legend-item">
                  <span className="rg-legend-dot rg-dot-contains"></span>
                  <span>包含（包含关系）</span>
                </div>
                <div className="rg-legend-item">
                  <span className="rg-legend-dash"></span>
                  <span>存在冲突</span>
                </div>
                <div className="rg-legend-hint">
                  💡 点击节点可高亮其关联网络
                </div>
              </div>
            </div>
          ) : (
            <div className="rg-hierarchy">
              <div className="rg-hierarchy-nodes">
                {nodes.length === 0 && (
                  <div className="rg-empty-small">暂无地层数据</div>
                )}
                {nodes.map((node) => {
                  const isSelected = selectedStratum === node.name;
                  const nodeRelations = relations.filter(
                    (r) => r.stratumA === node.name || r.stratumB === node.name
                  );
                  const hasConflict = nodeRelations.some(
                    (r) => (conflictMap.get(r.id) || []).length > 0
                  );
                  const highlighted = isNodeHighlighted(node.name);
                  const dimmed = selectedStratum && !highlighted;

                  return (
                    <div
                      key={node.name}
                      className={`rg-hier-node ${isSelected ? "rg-hier-selected" : ""} ${
                        hasConflict ? "rg-hier-conflict" : ""
                      } ${dimmed ? "rg-dimmed" : ""}`}
                      style={{ opacity: dimmed ? 0.4 : 1 }}
                      onClick={() =>
                        setSelectedStratum(selectedStratum === node.name ? null : node.name)
                      }
                    >
                      <div className="rg-hier-node-header">
                        <span className="rg-hier-node-name">{node.name}</span>
                        {node.artifactCount > 0 && (
                          <span className="rg-hier-node-count">
                            {node.artifactCount} 件
                          </span>
                        )}
                        {hasConflict && <span className="rg-hier-conflict-badge">⚠</span>}
                      </div>
                      {node.trenchNumber && (
                        <div className="rg-hier-node-trench">
                          探方：{node.trenchNumber}
                        </div>
                      )}
                      {nodeRelations.length > 0 && (
                        <div className="rg-hier-node-relations">
                          {nodeRelations.map((r) => {
                            const isSource = r.stratumA === node.name;
                            const other = isSource ? r.stratumB : r.stratumA;
                            const type = r.relationType;
                            const conflicts = conflictMap.get(r.id) || [];
                            return (
                              <div
                                key={r.id}
                                className={`rg-hier-edge ${
                                  conflicts.length > 0 ? "rg-hier-edge-conflict" : ""
                                }`}
                              >
                                {renderRelationBadge(type, !isSource)}
                                <span
                                  className={`rg-hier-edge-target ${
                                    selectedStratum === other ? "rg-linked" : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStratum(other);
                                  }}
                                >
                                  {other}
                                </span>
                                {conflicts.length > 0 && (
                                  <span
                                    className="rg-hier-edge-warning"
                                    title={conflicts.map((c) => c.message).join("\n")}
                                  >
                                    ⚠
                                  </span>
                                )}
                                {onDeleteRelation && (
                                  <button
                                    type="button"
                                    className="rg-hier-edge-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteRelation(r.id);
                                    }}
                                    title="删除此关系"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedStratum && traversal && (
            <div className="rg-traversal-panel">
              <div className="rg-traversal-header">
                <h3>
                  从「{selectedStratum}」出发的关联路径
                  <span className="rg-traversal-count">
                    可到达 {traversal.allReachable.size - 1} 个地层
                  </span>
                </h3>
              </div>

              <div className="rg-traversal-section">
                <h4>🔗 直接关联（{traversal.direct.length}）</h4>
                {traversal.direct.length === 0 ? (
                  <p className="rg-empty-small">无直接关联地层</p>
                ) : (
                  <ul className="rg-traversal-list">
                    {traversal.direct.map((step, i) => (
                      <li key={`d-${i}`} className={`rg-traversal-item rg-type-${step.type}`}>
                        <span className="rg-traversal-text">
                          {pathStepToText(step)}
                        </span>
                        {renderRelationBadge(step.type, step.direction === "inverse")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {traversal.indirect.length > 0 && (
                <div className="rg-traversal-section">
                  <h4>🔁 间接关联（{traversal.indirect.length} 条路径）</h4>
                  <ul className="rg-traversal-paths">
                    {traversal.indirect.map((path, i) => (
                      <li key={`i-${i}`} className="rg-traversal-path">
                        <div className="rg-path-steps">
                          <span className="rg-path-node rg-path-start">
                            {path[0].from}
                          </span>
                          {path.map((step, j) => (
                            <React.Fragment key={`p-${i}-${j}`}>
                              <span className="rg-path-arrow">
                                {renderRelationBadge(step.type, step.direction === "inverse")}
                              </span>
                              <span
                                className={`rg-path-node ${
                                  j === path.length - 1 ? "rg-path-end" : ""
                                }`}
                              >
                                {step.to}
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="rg-path-detail">
                          共 {path.length} 步：
                          {path.map((step, j) => (
                            <span key={`pd-${i}-${j}`}>
                              {j > 0 && " → "}
                              {pathStepToText(step)}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default StratumRelationGraphView;
