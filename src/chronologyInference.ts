import type {
  ArtifactRecord,
  StratumRelation,
  RelationType,
  ChronologyNode,
  ChronologyEdge,
  ChronologyCycle,
  ChronologyNamingConflict,
  ChronologyRisk,
  ChronologyOrderItem,
  ChronologyInferenceReport,
  ChronologyNodeKind,
  ChronologyRiskType,
} from "./types";

const RELATION_LABEL: Record<RelationType, string> = {
  earlier: "早于",
  breaks: "打破",
  contains: "包含",
};

const genId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeNodeKey = (name: string): string => {
  return name.trim();
};

const detectNodeKind = (name: string): ChronologyNodeKind => {
  const n = name.trim();
  if (/^(H|灰坑|M|墓葬|F|房址|G|沟|J|井|Y|窑|K|坑)/.test(n)) {
    return "relic_unit";
  }
  return "stratum";
};

interface BuildGraphResult {
  nodes: Map<string, ChronologyNode>;
  adjacency: Map<string, { targetKey: string; edge: ChronologyEdge }[]>;
  directEdges: ChronologyEdge[];
}

const buildNodes = (
  records: ArtifactRecord[],
  relations: StratumRelation[]
): Map<string, ChronologyNode> => {
  const nodeMap = new Map<string, ChronologyNode>();

  const ensureNode = (name: string, trenchNumber?: string): ChronologyNode => {
    const key = normalizeNodeKey(name);
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        key,
        name: name.trim(),
        kind: detectNodeKind(name),
        trenchNumber,
        artifactCount: 0,
        approvedArtifactCount: 0,
        pendingArtifactCount: 0,
        rejectedArtifactCount: 0,
        hasUnreviewed: false,
        relatedRelationIds: [],
      });
    }
    const node = nodeMap.get(key)!;
    if (!node.trenchNumber && trenchNumber) {
      node.trenchNumber = trenchNumber;
    }
    return node;
  };

  records.forEach((r) => {
    if (r.stratum) {
      const node = ensureNode(r.stratum, r.trenchNumber);
      node.artifactCount++;
      if (r.status === "approved") node.approvedArtifactCount++;
      if (r.status === "pending") {
        node.pendingArtifactCount++;
        node.hasUnreviewed = true;
      }
      if (r.status === "rejected") node.rejectedArtifactCount++;
    }
    if (r.relicUnit) {
      const node = ensureNode(r.relicUnit, r.trenchNumber);
      node.artifactCount++;
      if (r.status === "approved") node.approvedArtifactCount++;
      if (r.status === "pending") {
        node.pendingArtifactCount++;
        node.hasUnreviewed = true;
      }
      if (r.status === "rejected") node.rejectedArtifactCount++;
    }
  });

  relations.forEach((r) => {
    const nodeA = ensureNode(r.stratumA);
    const nodeB = ensureNode(r.stratumB);
    if (!nodeA.relatedRelationIds.includes(r.id)) {
      nodeA.relatedRelationIds.push(r.id);
    }
    if (!nodeB.relatedRelationIds.includes(r.id)) {
      nodeB.relatedRelationIds.push(r.id);
    }
  });

  return nodeMap;
};

const relationToEarlierEdge = (
  relation: StratumRelation
): { earlierKey: string; laterKey: string; explanation: string } | null => {
  const a = normalizeNodeKey(relation.stratumA);
  const b = normalizeNodeKey(relation.stratumB);

  switch (relation.relationType) {
    case "earlier":
      return {
        earlierKey: a,
        laterKey: b,
        explanation: `"${relation.stratumA}" 早于 "${relation.stratumB}"（关系 #${relation.id}）`,
      };
    case "breaks":
      return {
        earlierKey: b,
        laterKey: a,
        explanation: `"${relation.stratumA}" 打破 "${relation.stratumB}"，说明 "${relation.stratumB}" 年代更早（关系 #${relation.id}）`,
      };
    case "contains":
      return {
        earlierKey: b,
        laterKey: a,
        explanation: `"${relation.stratumA}" 包含 "${relation.stratumB}"，说明被包含者年代更早或同期（关系 #${relation.id}）`,
      };
    default:
      return null;
  }
};

const buildGraph = (
  nodeMap: Map<string, ChronologyNode>,
  relations: StratumRelation[]
): BuildGraphResult => {
  const adjacency = new Map<string, { targetKey: string; edge: ChronologyEdge }[]>();
  const directEdges: ChronologyEdge[] = [];

  const ensureAdjacency = (key: string) => {
    if (!adjacency.has(key)) adjacency.set(key, []);
  };

  nodeMap.forEach((_, key) => {
    ensureAdjacency(key);
  });

  relations.forEach((r) => {
    const mapped = relationToEarlierEdge(r);
    if (!mapped) return;
    if (!nodeMap.has(mapped.earlierKey) || !nodeMap.has(mapped.laterKey)) return;
    if (mapped.earlierKey === mapped.laterKey) return;

    const earlierNode = nodeMap.get(mapped.earlierKey)!;
    const laterNode = nodeMap.get(mapped.laterKey)!;

    const edge: ChronologyEdge = {
      id: `edge-direct-${r.id}`,
      sourceKey: mapped.earlierKey,
      targetKey: mapped.laterKey,
      sourceName: earlierNode.name,
      targetName: laterNode.name,
      relationType: "earlier",
      isDirect: true,
      isInferred: false,
      supportingRelationIds: [r.id],
      explanation: mapped.explanation,
    };

    ensureAdjacency(mapped.earlierKey);
    adjacency.get(mapped.earlierKey)!.push({ targetKey: mapped.laterKey, edge });
    directEdges.push(edge);
  });

  return { nodes: nodeMap, adjacency, directEdges };
};

const detectCycles = (
  nodeMap: Map<string, ChronologyNode>,
  adjacency: Map<string, { targetKey: string; edge: ChronologyEdge }[]>
): ChronologyCycle[] => {
  const cycles: ChronologyCycle[] = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const pathStack: { key: string; edge?: ChronologyEdge }[] = [];
  const visitedCycles = new Set<string>();

  nodeMap.forEach((_, key) => color.set(key, WHITE));

  const dfs = (currentKey: string, incomingEdge?: ChronologyEdge) => {
    color.set(currentKey, GRAY);
    if (incomingEdge) {
      pathStack.push({ key: currentKey, edge: incomingEdge });
    } else {
      pathStack.push({ key: currentKey });
    }

    const neighbors = adjacency.get(currentKey) || [];
    for (const { targetKey, edge } of neighbors) {
      const targetColor = color.get(targetKey);
      if (targetColor === GRAY) {
        const cycleStartIdx = pathStack.findIndex((p) => p.key === targetKey);
        if (cycleStartIdx !== -1) {
          const cycleNodes = pathStack.slice(cycleStartIdx).map((p) => p.key);
          cycleNodes.push(targetKey);
          const cycleKey = [...new Set(cycleNodes)].sort().join("|");
          if (!visitedCycles.has(cycleKey)) {
            visitedCycles.add(cycleKey);
            const pathEdges = pathStack.slice(cycleStartIdx).filter((p) => p.edge).map((p) => ({
              from: nodeMap.get(p.key)?.name || p.key,
              to: p.edge!.targetName,
              type: p.edge!.relationType,
              relationId: p.edge!.supportingRelationIds[0],
            }));
            const involvedIds: number[] = [];
            pathStack.slice(cycleStartIdx).forEach((p) => {
              if (p.edge) {
                p.edge.supportingRelationIds.forEach((id) => {
                  if (!involvedIds.includes(id)) involvedIds.push(id);
                });
              }
            });
            cycles.push({
              id: genId("cycle"),
              nodeKeys: [...new Set(cycleNodes)],
              nodeNames: [...new Set(cycleNodes)].map((k) => nodeMap.get(k)?.name || k),
              involvedRelationIds: involvedIds,
              pathEdges,
            });
          }
        }
      } else if (targetColor === WHITE) {
        dfs(targetKey, edge);
      }
    }

    pathStack.pop();
    color.set(currentKey, BLACK);
  };

  nodeMap.forEach((_, key) => {
    if (color.get(key) === WHITE) {
      dfs(key);
    }
  });

  return cycles;
};

const topologicalSort = (
  nodeMap: Map<string, ChronologyNode>,
  adjacency: Map<string, { targetKey: string; edge: ChronologyEdge }[]>,
  cycles: ChronologyCycle[]
): { order: ChronologyOrderItem[]; inferredEdges: ChronologyEdge[]; totalLayers: number } => {
  const cycleNodeKeys = new Set<string>();
  cycles.forEach((c) => c.nodeKeys.forEach((k) => cycleNodeKeys.add(k)));

  const inDegree = new Map<string, number>();
  nodeMap.forEach((_, key) => inDegree.set(key, 0));

  adjacency.forEach((edges, sourceKey) => {
    if (cycleNodeKeys.has(sourceKey)) return;
    edges.forEach(({ targetKey }) => {
      if (cycleNodeKeys.has(targetKey)) return;
      inDegree.set(targetKey, (inDegree.get(targetKey) || 0) + 1);
    });
  });

  const queue: string[] = [];
  inDegree.forEach((deg, key) => {
    if (deg === 0 && !cycleNodeKeys.has(key)) queue.push(key);
  });

  const rankMap = new Map<string, number>();
  const layerMap = new Map<string, number>();
  const longestPath = new Map<string, number>();
  nodeMap.forEach((_, key) => {
    longestPath.set(key, 0);
    rankMap.set(key, -1);
    layerMap.set(key, -1);
  });

  const inferredEdges: ChronologyEdge[] = [];
  const reachableFrom = new Map<string, Set<string>>();
  nodeMap.forEach((_, key) => {
    reachableFrom.set(key, new Set([key]));
  });

  let processedCount = 0;
  while (queue.length > 0) {
    const key = queue.shift()!;
    rankMap.set(key, processedCount++);
    const currentLayer = longestPath.get(key) || 0;
    layerMap.set(key, currentLayer);

    const neighbors = adjacency.get(key) || [];
    for (const { targetKey, edge } of neighbors) {
      if (cycleNodeKeys.has(targetKey)) continue;

      const reachable = reachableFrom.get(key)!;
      const targetReachable = reachableFrom.get(targetKey)!;
      reachable.forEach((k) => {
        if (k !== targetKey && !targetReachable.has(k)) {
          targetReachable.add(k);
          if (k !== key) {
            const srcNode = nodeMap.get(k);
            const tgtNode = nodeMap.get(targetKey);
            if (srcNode && tgtNode) {
              const inferredEdge: ChronologyEdge = {
                id: `edge-inferred-${k}-${targetKey}`,
                sourceKey: k,
                targetKey,
                sourceName: srcNode.name,
                targetName: tgtNode.name,
                relationType: "earlier",
                isDirect: false,
                isInferred: true,
                supportingRelationIds: [...edge.supportingRelationIds],
                explanation: `由传递性推断："${srcNode.name}" 早于 "${tgtNode}"（通过中间关系链）`,
              };
              inferredEdges.push(inferredEdge);
            }
          }
        }
      });

      const newDeg = (inDegree.get(targetKey) || 0) - 1;
      inDegree.set(targetKey, newDeg);
      if (newDeg === 0) queue.push(targetKey);
      const newPath = currentLayer + 1;
      if (newPath > (longestPath.get(targetKey) || 0)) {
        longestPath.set(targetKey, newPath);
      }
    }
  }

  let maxLayer = 0;
  layerMap.forEach((l) => {
    if (l > maxLayer) maxLayer = l;
  });

  const orderItems: ChronologyOrderItem[] = [];

  cycleNodeKeys.forEach((key) => {
    const node = nodeMap.get(key)!;
    orderItems.push({
      rank: -1,
      layerGroup: -1,
      nodeKey: key,
      nodeName: node.name,
      trenchNumber: node.trenchNumber,
      kind: node.kind,
      artifactCount: node.artifactCount,
      evidenceEdges: [],
      isUncertain: true,
      explanation: `该节点参与循环依赖，年代顺序无法确定`,
    });
  });

  const sortedKeys = Array.from(nodeMap.keys())
    .filter((k) => !cycleNodeKeys.has(k))
    .sort((a, b) => {
      const la = layerMap.get(a) ?? -1;
      const lb = layerMap.get(b) ?? -1;
      if (la !== lb) return la - lb;
      return (nodeMap.get(a)?.name || "").localeCompare(nodeMap.get(b)?.name || "", "zh-CN");
    });

  sortedKeys.forEach((key, idx) => {
    const node = nodeMap.get(key)!;
    const layer = layerMap.get(key) ?? 0;
    const evidence: ChronologyEdge[] = [];
    adjacency.forEach((edges, srcKey) => {
      edges.forEach(({ targetKey, edge }) => {
        if (targetKey === key && srcKey !== key) {
          evidence.push(edge);
        }
      });
    });

    let explanation = "";
    if (evidence.length === 0) {
      explanation = "无直接年代关系，暂列为最早期或独立层位";
    } else {
      const evStr = evidence.map((e) => e.explanation).join("；");
      explanation = `基于 ${evidence.length} 条关系确定层位：${evStr}`;
    }

    orderItems.push({
      rank: idx,
      layerGroup: layer,
      nodeKey: key,
      nodeName: node.name,
      trenchNumber: node.trenchNumber,
      kind: node.kind,
      artifactCount: node.artifactCount,
      evidenceEdges: evidence,
      isUncertain: node.hasUnreviewed || evidence.length === 0,
      explanation,
    });
  });

  orderItems.sort((a, b) => {
    if (a.layerGroup !== b.layerGroup) return a.layerGroup - b.layerGroup;
    return a.nodeName.localeCompare(b.nodeName, "zh-CN");
  });

  let currentRank = 0;
  let prevLayer = -2;
  orderItems.forEach((item) => {
    if (item.layerGroup === -1) {
      item.rank = -1;
    } else {
      if (item.layerGroup !== prevLayer) {
        currentRank++;
        prevLayer = item.layerGroup;
      }
      item.rank = currentRank;
    }
  });

  return { order: orderItems, inferredEdges, totalLayers: maxLayer + 1 };
};

const detectNamingConflicts = (
  records: ArtifactRecord[]
): ChronologyNamingConflict[] => {
  const stratumByTrench = new Map<string, Map<string, { count: number; sampleId?: number }>>();
  const relicByTrench = new Map<string, Map<string, { count: number; sampleId?: number }>>();

  records.forEach((r) => {
    if (r.stratum) {
      const trench = r.trenchNumber?.trim() || "(未指定探方)";
      if (!stratumByTrench.has(trench)) stratumByTrench.set(trench, new Map());
      const trenchMap = stratumByTrench.get(trench)!;
      const key = r.stratum.trim();
      const existing = trenchMap.get(key) || { count: 0 };
      existing.count++;
      if (!existing.sampleId) existing.sampleId = r.id;
      trenchMap.set(key, existing);
    }
    if (r.relicUnit) {
      const trench = r.trenchNumber?.trim() || "(未指定探方)";
      if (!relicByTrench.has(trench)) relicByTrench.set(trench, new Map());
      const trenchMap = relicByTrench.get(trench)!;
      const key = r.relicUnit.trim();
      const existing = trenchMap.get(key) || { count: 0 };
      existing.count++;
      if (!existing.sampleId) existing.sampleId = r.id;
      trenchMap.set(key, existing);
    }
  });

  const conflicts: ChronologyNamingConflict[] = [];

  const checkCrossTrench = (
    data: Map<string, Map<string, { count: number; sampleId?: number }>>,
    label: string
  ) => {
    const globalNames = new Map<string, { trench: string; count: number; sampleId?: number }[]>();
    data.forEach((trenchMap, trench) => {
      trenchMap.forEach((info, name) => {
        if (!globalNames.has(name)) globalNames.set(name, []);
        globalNames.get(name)!.push({
          trench,
          count: info.count,
          sampleId: info.sampleId,
        });
      });
    });

    globalNames.forEach((occurrences, name) => {
      if (occurrences.length >= 2) {
        const distinctTrenches = new Set(occurrences.map((o) => o.trench));
        if (distinctTrenches.size >= 2) {
          conflicts.push({
            id: genId("nc"),
            name: `${label}名"${name}"`,
            occurrences: occurrences.map((o) => ({
              trenchNumber: o.trench,
              artifactCount: o.count,
              sampleRecordId: o.sampleId,
            })),
          });
        }
      }
    });
  };

  checkCrossTrench(stratumByTrench, "地层");
  checkCrossTrench(relicByTrench, "遗迹单位");

  return conflicts;
};

const buildRisks = (
  nodes: Map<string, ChronologyNode>,
  cycles: ChronologyCycle[],
  namingConflicts: ChronologyNamingConflict[],
  inferredEdges: ChronologyEdge[],
  order: ChronologyOrderItem[],
  relations: StratumRelation[],
  records: ArtifactRecord[]
): ChronologyRisk[] => {
  const risks: ChronologyRisk[] = [];

  cycles.forEach((cycle) => {
    risks.push({
      id: genId("risk"),
      type: "circular_dependency",
      level: "critical",
      title: "循环依赖",
      message: `地层关系存在循环：${cycle.nodeNames.join(" → ")} → ${cycle.nodeNames[0]}，年代排序无法确定`,
      nodeName: cycle.nodeNames[0],
      relationIds: cycle.involvedRelationIds,
      details: { pathEdges: cycle.pathEdges },
    });
  });

  namingConflicts.forEach((nc) => {
    const trenchList = nc.occurrences.map((o) => `${o.trenchNumber || "未知"}(${o.artifactCount}件)`).join("、");
    risks.push({
      id: genId("risk"),
      type: "naming_conflict",
      level: "warning",
      title: "跨探方命名冲突",
      message: `同一${nc.name}出现在不同探方：${trenchList}，请确认是否为同一层位/遗迹`,
      recordIds: nc.occurrences.map((o) => o.sampleRecordId).filter((id): id is number => id !== undefined),
      details: { occurrences: nc.occurrences },
    });
  });

  const nodesWithUnreviewed: ChronologyNode[] = [];
  nodes.forEach((node) => {
    if (node.hasUnreviewed) nodesWithUnreviewed.push(node);
  });

  nodesWithUnreviewed.forEach((node) => {
    risks.push({
      id: genId("risk"),
      type: "unreviewed_in_chain",
      level: "warning",
      title: "含未审核记录的地层/遗迹",
      message: `"${node.name}"（${node.trenchNumber || "探方未知"}）存在 ${node.pendingArtifactCount} 件待审核出土物记录，基于此的年代推断可能不准确`,
      trenchNumber: node.trenchNumber,
      nodeKey: node.key,
      nodeName: node.name,
      details: {
        pendingCount: node.pendingArtifactCount,
        approvedCount: node.approvedArtifactCount,
        totalCount: node.artifactCount,
      },
    });
  });

  const relationNodeKeys = new Set<string>();
  relations.forEach((r) => {
    relationNodeKeys.add(normalizeNodeKey(r.stratumA));
    relationNodeKeys.add(normalizeNodeKey(r.stratumB));
  });

  const orphanNodes: ChronologyNode[] = [];
  nodes.forEach((node) => {
    if (!relationNodeKeys.has(node.key) && node.artifactCount > 0) {
      orphanNodes.push(node);
    }
  });

  orphanNodes.forEach((node) => {
    risks.push({
      id: genId("risk"),
      type: "orphan_node",
      level: "info",
      title: "孤立地层/遗迹（无关系）",
      message: `"${node.name}"（${node.trenchNumber || "探方未知"}）有 ${node.artifactCount} 件出土物，但未建立任何地层关系，无法参与年代排序`,
      trenchNumber: node.trenchNumber,
      nodeKey: node.key,
      nodeName: node.name,
      details: { artifactCount: node.artifactCount },
    });
  });

  if (inferredEdges.length > 0) {
    risks.push({
      id: genId("risk"),
      type: "inferred_relation",
      level: "info",
      title: "存在推断关系",
      message: `基于传递性共推断出 ${inferredEdges.length} 条间接年代关系，请核实推断结果是否符合实际发掘情况`,
      details: { inferredCount: inferredEdges.length },
    });
  }

  return risks;
};

export const runChronologyInference = (
  records: ArtifactRecord[],
  relations: StratumRelation[]
): ChronologyInferenceReport => {
  const nodeMap = buildNodes(records, relations);
  const { adjacency, directEdges } = buildGraph(nodeMap, relations);
  const cycles = detectCycles(nodeMap, adjacency);
  const { order, inferredEdges, totalLayers } = topologicalSort(nodeMap, adjacency, cycles);
  const namingConflicts = detectNamingConflicts(records);
  const risks = buildRisks(nodeMap, cycles, namingConflicts, inferredEdges, order, relations, records);

  const nodesArray = Array.from(nodeMap.values());
  const unreviewedCount = nodesArray.filter((n) => n.hasUnreviewed).length;
  const relationNodeSet = new Set<string>();
  relations.forEach((r) => {
    relationNodeSet.add(normalizeNodeKey(r.stratumA));
    relationNodeSet.add(normalizeNodeKey(r.stratumB));
  });
  const orphanCount = nodesArray.filter((n) => !relationNodeSet.has(n.key) && n.artifactCount > 0).length;

  const criticalRiskCount = risks.filter((r) => r.level === "critical").length;
  const warningRiskCount = risks.filter((r) => r.level === "warning").length;
  const infoRiskCount = risks.filter((r) => r.level === "info").length;

  const hasInconsistency = cycles.length > 0 || criticalRiskCount > 0;

  const nodesWithUncertainty = order.filter((o) => o.isUncertain).map((o) => o.nodeName);

  return {
    generatedAt: new Date().toISOString(),
    nodes: nodesArray,
    directEdges,
    inferredEdges,
    orderedSequence: order,
    cycles,
    namingConflicts,
    risks,
    hasInconsistency,
    totalLayers,
    nodesWithUncertainty,
    summary: {
      totalNodes: nodesArray.length,
      totalDirectRelations: directEdges.length,
      totalInferredRelations: inferredEdges.length,
      cycleCount: cycles.length,
      namingConflictCount: namingConflicts.length,
      riskCount: risks.length,
      criticalRiskCount,
      warningRiskCount,
      infoRiskCount,
      unreviewedNodeCount: unreviewedCount,
      orphanNodeCount: orphanCount,
    },
  };
};
