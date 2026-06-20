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

const RELATION_INV_LABEL: Record<RelationType, string> = {
  earlier: "晚于",
  breaks: "被打破于",
  contains: "被包含于",
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

interface WeakRelicStratumEdge {
  stratumKey: string;
  relicKey: string;
  sharedCount: number;
  sampleRecordIds: number[];
  trenchNumber?: string;
}

const detectWeakRelicStratumRelations = (
  records: ArtifactRecord[],
  nodeMap: Map<string, ChronologyNode>
): WeakRelicStratumEdge[] => {
  const key = (s: string, r: string) =>
    `${normalizeNodeKey(s)}||${normalizeNodeKey(r)}`;
  const edgeMap = new Map<string, WeakRelicStratumEdge>();

  records.forEach((rec) => {
    if (!rec.stratum?.trim() || !rec.relicUnit?.trim()) return;
    const sKey = normalizeNodeKey(rec.stratum);
    const rKey = normalizeNodeKey(rec.relicUnit);
    if (sKey === rKey) return;
    if (!nodeMap.has(sKey) || !nodeMap.has(rKey)) return;

    const k = key(rec.stratum, rec.relicUnit);
    if (!edgeMap.has(k)) {
      edgeMap.set(k, {
        stratumKey: sKey,
        relicKey: rKey,
        sharedCount: 0,
        sampleRecordIds: [],
        trenchNumber: rec.trenchNumber,
      });
    }
    const e = edgeMap.get(k)!;
    e.sharedCount++;
    if (e.sampleRecordIds.length < 3) e.sampleRecordIds.push(rec.id);
  });

  return Array.from(edgeMap.values()).filter((e) => e.sharedCount >= 1);
};

const appendWeakRelicEdges = (
  result: BuildGraphResult,
  weakEdges: WeakRelicStratumEdge[]
): BuildGraphResult => {
  const { nodes, adjacency, directEdges } = result;

  weakEdges.forEach((we) => {
    const stratumNode = nodes.get(we.stratumKey);
    const relicNode = nodes.get(we.relicKey);
    if (!stratumNode || !relicNode) return;

    const existing = adjacency.get(we.stratumKey) || [];
    const hasDirect = existing.some((e) => e.targetKey === we.relicKey);
    if (hasDirect) return;

    const edgeId = `edge-weak-${we.stratumKey}-${we.relicKey}`;
    const sharedIdStr = we.sampleRecordIds.map((id) => `#${id}`).join("、");
    const countNote =
      we.sampleRecordIds.length < we.sharedCount
        ? `等共${we.sharedCount}件`
        : "";

    const explanation = `共出弱关联：出土物记录（${sharedIdStr}${countNote}）同时标注地层"${stratumNode.name}"与遗迹单位"${relicNode.name}"，推断遗迹单位开口于该层或同期（${we.trenchNumber || "探方未知"}）`;

    const edge: ChronologyEdge = {
      id: edgeId,
      sourceKey: we.relicKey,
      targetKey: we.stratumKey,
      sourceName: relicNode.name,
      targetName: stratumNode.name,
      relationType: "earlier",
      isDirect: false,
      isInferred: false,
      supportingRelationIds: [],
      explanation,
    };

    if (!adjacency.has(we.relicKey)) adjacency.set(we.relicKey, []);
    adjacency.get(we.relicKey)!.push({ targetKey: we.stratumKey, edge });
    directEdges.push(edge);
  });

  return result;
};

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
        explanation: `地层学证据："${relation.stratumA}" 直接标注为早于 "${relation.stratumB}"（关系#${relation.id}）`,
      };
    case "breaks": {
      const aIsRelic = detectNodeKind(relation.stratumA) === "relic_unit";
      const bIsRelic = detectNodeKind(relation.stratumB) === "relic_unit";
      let detail = "";
      if (aIsRelic && !bIsRelic) {
        detail = `（遗迹单位 ${relation.stratumA} 打破地层 ${relation.stratumB}，故 ${relation.stratumB} 形成年代更早）`;
      } else if (!aIsRelic && bIsRelic) {
        detail = `（地层 ${relation.stratumA} 打破遗迹单位 ${relation.stratumB}，故 ${relation.stratumB} 年代更早）`;
      } else {
        detail = `（按打破法则：被打破者形成年代更早）`;
      }
      return {
        earlierKey: b,
        laterKey: a,
        explanation: `打破关系："${relation.stratumA}" 打破 "${relation.stratumB}"${detail}（关系#${relation.id}）`,
      };
    }
    case "contains": {
      const aIsRelic = detectNodeKind(relation.stratumA) === "relic_unit";
      const bIsRelic = detectNodeKind(relation.stratumB) === "relic_unit";
      let detail = "";
      if (!aIsRelic && bIsRelic) {
        detail = `（地层 ${relation.stratumA} 包含遗迹单位 ${relation.stratumB}，该遗迹单位形成于地层堆积之前或同期）`;
      } else if (aIsRelic && bIsRelic) {
        detail = `（遗迹单位 ${relation.stratumA} 内含遗迹单位 ${relation.stratumB}，按层位关系推断 ${relation.stratumB} 更早）`;
      } else {
        detail = `（被包含者通常形成于或早于包含者堆积时期）`;
      }
      return {
        earlierKey: b,
        laterKey: a,
        explanation: `包含关系："${relation.stratumA}" 包含 "${relation.stratumB}"${detail}（关系#${relation.id}）`,
      };
    }
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
  const reachableFrom = new Map<string, Map<string, string[]>>();
  nodeMap.forEach((_, key) => {
    const m = new Map<string, string[]>();
    m.set(key, [key]);
    reachableFrom.set(key, m);
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

      const srcPaths = reachableFrom.get(key)!;
      const tgtPaths = reachableFrom.get(targetKey)!;
      srcPaths.forEach((path, k) => {
        if (k !== targetKey && !tgtPaths.has(k)) {
          const newPath = [...path, targetKey];
          tgtPaths.set(k, newPath);
          if (k !== key) {
            const srcNode = nodeMap.get(k);
            const tgtNode = nodeMap.get(targetKey);
            if (srcNode && tgtNode) {
              const pathNames = newPath
                .map((pk) => nodeMap.get(pk)?.name || pk)
                .join(" → ");
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
                explanation: `传递性推断："${srcNode.name}" → → "${tgtNode.name}"，经中间链 ${pathNames}（基于地层学基本法则：若 A 早于 B，B 早于 C，则 A 早于 C）`,
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
      explanation: `年代冲突：该节点参与地层关系循环，无法进行正常排序。请检查涉及的打破/包含/早于关系是否存在自相矛盾（如 A 打破 B，B 又打破 A）。`,
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
      const kindLabel = node.kind === "relic_unit" ? "遗迹单位" : "地层";
      explanation = `无年代关系证据：此${kindLabel}"${node.name}"尚未与任何其他层位建立打破/叠压/早于关系，依据拓扑排序法则暂置于最早期层组，实际年代需结合田野记录核实。`;
    } else {
      const directCount = evidence.filter((e) => e.isDirect).length;
      const inferredCount = evidence.length - directCount;
      const evidenceSummary: string[] = [];
      evidence.slice(0, 3).forEach((e) => {
        const tag = e.isInferred
          ? "【推】"
          : e.isDirect
          ? ""
          : "【弱】";
        evidenceSummary.push(`${tag}${e.explanation}`);
      });
      if (evidence.length > 3) {
        evidenceSummary.push(`...另有 ${evidence.length - 3} 条依据`);
      }
      const head = directCount > 0
        ? `排序依据：基于 ${directCount} 条地层关系${inferredCount > 0 ? `与 ${inferredCount} 条推断关系` : ""}`
        : `排序依据：基于 ${inferredCount} 条推断关系`;
      explanation = `${head}确认层位——${evidenceSummary.join(" ｜ ")}`;
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
  records: ArtifactRecord[],
  weakEdgeCount: number
): ChronologyRisk[] => {
  const risks: ChronologyRisk[] = [];

  cycles.forEach((cycle) => {
    const cycleDesc = cycle.pathEdges && cycle.pathEdges.length > 0
      ? cycle.pathEdges.map((p: any) => `${p.from} → ${p.to}`).join("  ")
      : cycle.nodeNames.join(" → ") + " → " + cycle.nodeNames[0];
    risks.push({
      id: genId("risk"),
      type: "circular_dependency",
      level: "critical",
      title: "循环依赖（年代关系矛盾）",
      message: `地层关系存在循环矛盾：${cycleDesc}。涉及关系编号：${cycle.involvedRelationIds.map(id => `#${id}`).join("、")}。打破/叠压/包含关系形成闭环，严重违反地层学法则，请逐一审定并修正。`,
      nodeName: cycle.nodeNames[0],
      relationIds: cycle.involvedRelationIds,
      details: { pathEdges: cycle.pathEdges },
    });
  });

  namingConflicts.forEach((nc) => {
    const trenchList = nc.occurrences.map((o) => `${o.trenchNumber || "未知"}(出土${o.artifactCount}件)`).join("、");
    risks.push({
      id: genId("risk"),
      type: "naming_conflict",
      level: "warning",
      title: "跨探方命名冲突",
      message: `同一${nc.name}在多个探方均有记录：${trenchList}。若属同一层位/遗迹，请在关系录入中显式建立跨探方叠压/对应关系；若仅编号偶合，请分别命名以避免混淆。`,
      recordIds: nc.occurrences.map((o) => o.sampleRecordId).filter((id): id is number => id !== undefined),
      details: { occurrences: nc.occurrences },
    });
  });

  const nodesWithUnreviewed: ChronologyNode[] = [];
  nodes.forEach((node) => {
    if (node.hasUnreviewed) nodesWithUnreviewed.push(node);
  });

  nodesWithUnreviewed.forEach((node) => {
    const kindLabel = node.kind === "relic_unit" ? "遗迹单位" : "地层";
    const rate = node.artifactCount > 0
      ? `${Math.round((node.pendingArtifactCount / node.artifactCount) * 100)}%`
      : "—";
    risks.push({
      id: genId("risk"),
      type: "unreviewed_in_chain",
      level: "warning",
      title: "含未审核记录的地层/遗迹",
      message: `${kindLabel}"${node.name}"（探方：${node.trenchNumber || "未指定"}）共 ${node.artifactCount} 件记录，其中 ${node.pendingArtifactCount} 件待审核（占比${rate}），已通过审核 ${node.approvedArtifactCount} 件，驳回 ${node.rejectedArtifactCount} 件。基于此的统计与年代推断结果可能存在偏差，请优先完成审核。`,
      trenchNumber: node.trenchNumber,
      nodeKey: node.key,
      nodeName: node.name,
      details: {
        pendingCount: node.pendingArtifactCount,
        approvedCount: node.approvedArtifactCount,
        rejectedCount: node.rejectedArtifactCount,
        totalCount: node.artifactCount,
        pendingRate: rate,
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
    const kindLabel = node.kind === "relic_unit" ? "遗迹单位" : "地层";
    risks.push({
      id: genId("risk"),
      type: "orphan_node",
      level: "info",
      title: "孤立地层/遗迹（未录入年代关系）",
      message: `${kindLabel}"${node.name}"（${node.trenchNumber || "探方未知"}）有 ${node.artifactCount} 件出土物，但尚未与任何其他层位建立打破/叠压/早于关系。年代推断暂将其归为最早期独立层组，建议补录关系以获得准确排年。`,
      trenchNumber: node.trenchNumber,
      nodeKey: node.key,
      nodeName: node.name,
      details: { artifactCount: node.artifactCount },
    });
  });

  if (weakEdgeCount > 0) {
    risks.push({
      id: genId("risk"),
      type: "inferred_relation",
      level: "info",
      title: "自动补充弱关联",
      message: `基于出土物中地层与遗迹单位的共出记录，系统自动补充了 ${weakEdgeCount} 条共出弱关联。此类关联仅作辅助参考（如灰坑开口于某层），请领队结合实际田野记录核查。`,
      details: { weakEdgeCount },
    });
  }

  if (inferredEdges.length > 0) {
    risks.push({
      id: genId("risk"),
      type: "inferred_relation",
      level: "info",
      title: "存在传递性推断关系",
      message: `基于地层学传递法则（A 早于 B，B 早于 C ⇒ A 早于 C），系统由 ${relations.length} 条直接关系推断出 ${inferredEdges.length} 条间接年代关系。请核查推断结果（尤其跨探方部分）是否与实际层位叠压相符。`,
      details: { inferredCount: inferredEdges.length, directCount: relations.length },
    });
  }

  return risks;
};

export const runChronologyInference = (
  records: ArtifactRecord[],
  relations: StratumRelation[]
): ChronologyInferenceReport => {
  const nodeMap = buildNodes(records, relations);
  let buildResult = buildGraph(nodeMap, relations);
  const weakEdges = detectWeakRelicStratumRelations(records, nodeMap);
  buildResult = appendWeakRelicEdges(buildResult, weakEdges);
  const { adjacency, directEdges } = buildResult;

  const cycles = detectCycles(nodeMap, adjacency);
  const { order, inferredEdges, totalLayers } = topologicalSort(nodeMap, adjacency, cycles);
  const namingConflicts = detectNamingConflicts(records);
  const risks = buildRisks(nodeMap, cycles, namingConflicts, inferredEdges, order, relations, records, weakEdges.length);

  const nodesArray = Array.from(nodeMap.values());
  const unreviewedCount = nodesArray.filter((n) => n.hasUnreviewed).length;
  const relationNodeSet = new Set<string>();
  relations.forEach((r) => {
    relationNodeSet.add(normalizeNodeKey(r.stratumA));
    relationNodeSet.add(normalizeNodeKey(r.stratumB));
  });
  const orphanCount = nodesArray.filter((n) => !relationNodeSet.has(n.key) && n.artifactCount > 0).length;

  const userDirectEdgeCount = directEdges.filter((e) => !e.id.startsWith("edge-weak-")).length;
  const weakEdgeCountNow = directEdges.filter((e) => e.id.startsWith("edge-weak-")).length;

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
      totalDirectRelations: userDirectEdgeCount,
      totalWeakRelations: weakEdgeCountNow,
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
