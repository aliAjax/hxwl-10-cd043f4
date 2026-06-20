import { describe, it, expect, beforeEach } from "vitest";
import type { ArtifactRecord, StratumRelation, RelationType, ReviewStatus } from "../types";
import type { DataCollectionInput, ConsistencyIssue, IssueCategory } from "./types";
import {
  runConsistencyChecks,
  isValidCoordinateFormat,
  filterArtifactsForExport,
} from "./consistencyChecker";

const baseRecord = (overrides: Partial<ArtifactRecord> = {}): ArtifactRecord => ({
  id: 1,
  trenchNumber: "T0101",
  stratum: "第1层",
  artifactType: "陶片",
  eCoordinate: "E123.45m",
  nCoordinate: "N67.89m",
  depth: "0.5m",
  remarks: "",
  createdAt: new Date().toISOString(),
  status: "approved",
  ...overrides,
});

const baseRelation = (overrides: Partial<StratumRelation> = {}): StratumRelation => ({
  id: 1,
  stratumA: "第1层",
  stratumB: "第2层",
  relationType: "earlier",
  createdAt: new Date().toISOString(),
  ...overrides,
});

const baseInput = (
  records: ArtifactRecord[] = [],
  relations: StratumRelation[] = []
): DataCollectionInput => ({
  project: {
    id: "proj-1",
    title: "测试项目",
    subtitle: "",
    domain: "考古",
    metrics: [],
    filters: [],
  },
  searchFilters: { trenchNumber: "", stratum: "", relicUnit: "", artifactKeyword: "" },
  hasActiveFilters: false,
  artifactRecords: records,
  stratumRelations: relations,
  excavationLogs: [],
});

const findIssuesByCategory = (
  issues: ConsistencyIssue[],
  category: IssueCategory
): ConsistencyIssue[] => issues.filter((i) => i.category === category);

const findIssuesBySeverity = (
  issues: ConsistencyIssue[],
  severity: "blocking" | "warning"
): ConsistencyIssue[] => issues.filter((i) => i.severity === severity);

describe("consistencyChecker - isValidCoordinateFormat", () => {
  describe("坐标为空判断", () => {
    it("空字符串返回无效 + 坐标为空", () => {
      const r = isValidCoordinateFormat("");
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("坐标为空");
    });

    it("纯空白字符串返回无效 + 坐标为空", () => {
      const r = isValidCoordinateFormat("   \t  ");
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("坐标为空");
    });
  });

  describe("坐标格式异常 - 数字相关", () => {
    it("无有效数字的字符串返回无效", () => {
      const r = isValidCoordinateFormat("abc");
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("未找到有效数字");
    });

    it("负数坐标返回无效", () => {
      const r = isValidCoordinateFormat("-10.5");
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("坐标不能为负数");
    });
  });

  describe("坐标格式异常 - 前缀/后缀", () => {
    it("非法前缀（非东南西北/ENWS）返回无效", () => {
      const r = isValidCoordinateFormat("X123.45");
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("前缀");
    });

    it("非法单位后缀返回无效", () => {
      const r = isValidCoordinateFormat("123.45公里");
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("后缀");
    });
  });

  describe("合法坐标格式", () => {
    it("纯数字有效", () => {
      expect(isValidCoordinateFormat("123.45").valid).toBe(true);
    });

    it("E前缀 + 数字 + m 单位有效", () => {
      expect(isValidCoordinateFormat("E123.45m").valid).toBe(true);
    });

    it("中文前缀 东 + 数字 + 中文单位 米 有效", () => {
      expect(isValidCoordinateFormat("东123.45米").valid).toBe(true);
    });

    it("N 前缀单独有效", () => {
      expect(isValidCoordinateFormat("N99").valid).toBe(true);
    });

    it("cm 单位有效", () => {
      expect(isValidCoordinateFormat("150cm").valid).toBe(true);
    });

    it("毫米 / mm 单位有效", () => {
      expect(isValidCoordinateFormat("1500毫米").valid).toBe(true);
      expect(isValidCoordinateFormat("1500mm").valid).toBe(true);
    });
  });
});

describe("consistencyChecker - 缺失探方检查 (missing_trench_number)", () => {
  it("探方为 empty string → 产生 blocking 级别的 missing_trench_number", () => {
    const records = [baseRecord({ id: 1, trenchNumber: "" })];
    const report = runConsistencyChecks(baseInput(records, []));
    const issues = findIssuesByCategory(report.issues, "missing_trench_number");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("blocking");
    expect(issues[0].recordId).toBe(1);
    expect(issues[0].message).toContain("缺失探方编号");
  });

  it("探方为纯空白 → 产生 blocking 级别的 missing_trench_number", () => {
    const records = [baseRecord({ id: 2, trenchNumber: "   \t  " })];
    const report = runConsistencyChecks(baseInput(records, []));
    const issues = findIssuesByCategory(report.issues, "missing_trench_number");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("blocking");
  });

  it("多记录混合：缺失和正常的都正确识别", () => {
    const records = [
      baseRecord({ id: 1, trenchNumber: "" }),
      baseRecord({ id: 2, trenchNumber: "T0202" }),
      baseRecord({ id: 3, trenchNumber: "   " }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    const issues = findIssuesByCategory(report.issues, "missing_trench_number");
    expect(issues.length).toBe(2);
    const ids = issues.map((i) => i.recordId).sort();
    expect(ids).toEqual([1, 3]);
  });

  it("所有记录探方正常 → 0 missing_trench_number", () => {
    const records = [
      baseRecord({ id: 1, trenchNumber: "T0101" }),
      baseRecord({ id: 2, trenchNumber: "T0102" }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    const issues = findIssuesByCategory(report.issues, "missing_trench_number");
    expect(issues.length).toBe(0);
  });
});

describe("consistencyChecker - 坐标为空 / 格式异常 (invalid_coordinate)", () => {
  const runWithCoords = (e: string, n: string, id = 1) =>
    runConsistencyChecks(
      baseInput([baseRecord({ id, eCoordinate: e, nCoordinate: n })], [])
    );

  it("E和N坐标都为空 → blocking invalid_coordinate", () => {
    const report = runWithCoords("", "");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("blocking");
    expect(issues[0].message).toContain("E和N坐标均为空");
  });

  it("仅E坐标为空 → blocking invalid_coordinate", () => {
    const report = runWithCoords("", "N100m");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("E坐标为空");
  });

  it("仅N坐标为空 → blocking invalid_coordinate", () => {
    const report = runWithCoords("E100m", "");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("N坐标为空");
  });

  it("E和N格式都异常 → 合并在一条消息里", () => {
    const report = runWithCoords("Xabc", "Yxyz");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("坐标格式异常");
    expect(issues[0].message).toContain("E坐标");
    expect(issues[0].message).toContain("N坐标");
  });

  it("仅E格式异常（非法前缀）", () => {
    const report = runWithCoords("X100", "N100m");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("E坐标");
  });

  it("仅N格式异常（非法单位后缀）", () => {
    const report = runWithCoords("E100m", "100公里");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("N坐标");
  });

  it("负数坐标 → 格式异常", () => {
    const report = runWithCoords("-10", "100");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("blocking");
  });

  it("坐标完全合法 → 0 invalid_coordinate", () => {
    const report = runWithCoords("E123.45m", "N678.9米");
    const issues = findIssuesByCategory(report.issues, "invalid_coordinate");
    expect(issues.length).toBe(0);
  });
});

describe("consistencyChecker - 重复地层关系 (duplicate_relation)", () => {
  it("两条完全相同的关系（A/B/类型一致）→ 产生 duplicate_relation", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "第2层", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "第1层", stratumB: "第2层", relationType: "earlier" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const dups = findIssuesByCategory(report.issues, "duplicate_relation");
    expect(dups.length).toBeGreaterThanOrEqual(1);
    expect(dups[0].severity).toBe("blocking");
    expect(dups[0].message).toContain("重复关系");
    expect(dups[0].details?.relation1).toBeDefined();
    expect(dups[0].details?.relation2).toBeDefined();
  });

  it("关系相同但方向相反（A/B vs B/A）不算 duplicate（属于 conflict 另外检测）", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "第2层", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "第2层", stratumB: "第1层", relationType: "earlier" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const dups = findIssuesByCategory(report.issues, "duplicate_relation");
    expect(dups.length).toBe(0);
  });

  it("多条重复关系：3 条相同 → 产生 2+ 个 duplicate 问题（两两）", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "breaks" }),
      baseRelation({ id: 2, stratumA: "A", stratumB: "B", relationType: "breaks" }),
      baseRelation({ id: 3, stratumA: "A", stratumB: "B", relationType: "breaks" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const dups = findIssuesByCategory(report.issues, "duplicate_relation");
    expect(dups.length).toBe(3);
  });

  it("所有关系不重复 → 0 duplicate_relation", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "C", relationType: "earlier" }),
      baseRelation({ id: 3, stratumA: "A", stratumB: "C", relationType: "contains" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const dups = findIssuesByCategory(report.issues, "duplicate_relation");
    expect(dups.length).toBe(0);
  });
});

describe("consistencyChecker - 地层关系冲突 (stratum_relation_conflict)：互相打破/包含/早于/矛盾", () => {
  it("自环关系（A 打破 A）→ conflict 检测", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "第1层", stratumB: "第1层", relationType: "breaks" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    const selfRefs = conflicts.filter((c) => c.message.includes("地层A与地层B相同"));
    expect(selfRefs.length).toBe(1);
    expect(selfRefs[0].severity).toBe("blocking");
  });

  it("互相打破（A 打破 B，B 打破 A）→ conflict + 互相打破消息", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "breaks" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "A", relationType: "breaks" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    const mutual = conflicts.filter((c) => c.message.includes("互相打破"));
    expect(mutual.length).toBe(1);
    expect(mutual[0].severity).toBe("blocking");
    expect(mutual[0].details?.relation1).toBeDefined();
    expect(mutual[0].details?.relation2).toBeDefined();
  });

  it("互相包含（A 包含 B，B 包含 A）→ conflict + 互相包含消息", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "contains" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "A", relationType: "contains" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    const mutual = conflicts.filter((c) => c.message.includes("互相包含"));
    expect(mutual.length).toBe(1);
    expect(mutual[0].severity).toBe("blocking");
  });

  it("同类型双向早于（A 早于 B，B 早于 A）→ conflict + 互斥消息", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "B", stratumB: "A", relationType: "earlier" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    const mutual = conflicts.filter((c) => c.message.includes("互斥"));
    expect(mutual.length).toBe(1);
    expect(mutual[0].severity).toBe("blocking");
  });

  it("breaks 与 earlier 同向矛盾（A 打破 B 同时 A 早于 B）→ conflict + 逻辑冲突消息", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "breaks" }),
      baseRelation({ id: 2, stratumA: "A", stratumB: "B", relationType: "earlier" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    const contradiction = conflicts.filter((c) => c.message.includes("逻辑冲突"));
    expect(contradiction.length).toBe(1);
    expect(contradiction[0].severity).toBe("blocking");
  });

  it("breaks 与 earlier 反向（先 earlier 再 breaks，同 A/B）→ conflict + 逻辑冲突消息", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "A", stratumB: "B", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "A", stratumB: "B", relationType: "breaks" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    const contradiction = conflicts.filter((c) => c.message.includes("逻辑冲突"));
    expect(contradiction.length).toBe(1);
  });

  it("合法的线性关系链 → 0 conflict", () => {
    const relations: StratumRelation[] = [
      baseRelation({ id: 1, stratumA: "第3层", stratumB: "第2层", relationType: "earlier" }),
      baseRelation({ id: 2, stratumA: "第2层", stratumB: "第1层", relationType: "earlier" }),
      baseRelation({ id: 3, stratumA: "H1", stratumB: "第2层", relationType: "breaks" }),
      baseRelation({ id: 4, stratumA: "第1层", stratumB: "H1", relationType: "contains" }),
    ];
    const report = runConsistencyChecks(baseInput([], relations));
    const conflicts = findIssuesByCategory(report.issues, "stratum_relation_conflict");
    expect(conflicts.length).toBe(0);
  });
});

describe("consistencyChecker - 待审核/退回记录归类 (unreviewed_record / rejected_record)", () => {
  const runWithStatus = (status: ReviewStatus, id = 1) =>
    runConsistencyChecks(
      baseInput([baseRecord({ id, status, trenchNumber: "T0101" })], [])
    );

  it("pending 状态 → unreviewed_record，且 severity=warning（不能阻断）", () => {
    const report = runWithStatus("pending", 100);
    const issues = findIssuesByCategory(report.issues, "unreviewed_record");
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
    const byReviewCheck = issues.filter((i) => i.recordId === 100 && i.message.includes("待审核状态"));
    expect(byReviewCheck.length).toBe(1);
    expect(byReviewCheck[0].recordId).toBe(100);
  });

  it("rejected 状态 → rejected_record，且 severity=warning", () => {
    const report = runWithStatus("rejected", 200);
    const issues = findIssuesByCategory(report.issues, "rejected_record");
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].recordId).toBe(200);
    expect(issues[0].message).toContain("已被审核退回");
  });

  it("approved 状态 → 不产生任何审核相关 issue", () => {
    const report = runWithStatus("approved");
    expect(findIssuesByCategory(report.issues, "unreviewed_record").length).toBe(0);
    expect(findIssuesByCategory(report.issues, "rejected_record").length).toBe(0);
  });

  it("archived 状态 → 不产生审核相关 issue", () => {
    const report = runWithStatus("archived");
    expect(findIssuesByCategory(report.issues, "unreviewed_record").length).toBe(0);
    expect(findIssuesByCategory(report.issues, "rejected_record").length).toBe(0);
  });

  it("pending 只是警告，不阻断导出（isExportable=true 当无 blocking 时）", () => {
    const records = [
      baseRecord({
        id: 1,
        trenchNumber: "T0101",
        status: "pending",
      }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    expect(report.blockingCount).toBe(0);
    expect(report.warningCount).toBeGreaterThanOrEqual(1);
    expect(report.isExportable).toBe(true);
  });

  it("pending + 缺失探方（blocking）→ isExportable=false，pending 仍归类为 warning", () => {
    const records = [
      baseRecord({ id: 1, trenchNumber: "", status: "pending" }),
      baseRecord({ id: 2, trenchNumber: "T0202", status: "rejected" }),
      baseRecord({ id: 3, trenchNumber: "T0303", status: "approved" }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));

    const unreviewed = findIssuesByCategory(report.issues, "unreviewed_record");
    const rejected = findIssuesByCategory(report.issues, "rejected_record");
    const missing = findIssuesByCategory(report.issues, "missing_trench_number");

    const unreviewedFromStatus = unreviewed.filter(
      (i) => i.message.includes("待审核状态")
    );
    expect(unreviewedFromStatus.length).toBe(1);
    expect(unreviewedFromStatus[0].severity).toBe("warning");
    expect(unreviewedFromStatus[0].recordId).toBe(1);

    expect(rejected.length).toBe(1);
    expect(rejected[0].severity).toBe("warning");
    expect(rejected[0].recordId).toBe(2);

    expect(missing.length).toBe(1);
    expect(missing[0].severity).toBe("blocking");

    expect(report.blockingCount).toBe(1);
    expect(report.warningCount).toBeGreaterThanOrEqual(2);
    expect(report.isExportable).toBe(false);
  });

  it("details 字段包含审核信息：pending 含 artifactType/stratum/submittedBy", () => {
    const rec = baseRecord({
      id: 999,
      status: "pending",
      artifactType: "青铜器",
      stratum: "第3层",
      submittedBy: "张三",
    });
    const report = runConsistencyChecks(baseInput([rec], []));
    const unreviewed = findIssuesByCategory(report.issues, "unreviewed_record");
    const fromStatusCheck = unreviewed.find(
      (i) => i.message.includes("待审核状态")
    );
    expect(fromStatusCheck).toBeDefined();
    expect(fromStatusCheck!.details?.artifactType).toBe("青铜器");
    expect(fromStatusCheck!.details?.stratum).toBe("第3层");
    expect(fromStatusCheck!.details?.submittedBy).toBe("张三");
  });

  it("details 字段：rejected 含 reviewReason/reviewedBy", () => {
    const rec = baseRecord({
      id: 888,
      status: "rejected",
      reviewReason: "坐标疑似录入错误",
      reviewedBy: "李领队",
    });
    const report = runConsistencyChecks(baseInput([rec], []));
    const rejected = findIssuesByCategory(report.issues, "rejected_record");
    expect(rejected[0].details?.reviewReason).toBe("坐标疑似录入错误");
    expect(rejected[0].details?.reviewedBy).toBe("李领队");
  });
});

describe("consistencyChecker - filterArtifactsForExport", () => {
  const records: ArtifactRecord[] = [
    baseRecord({ id: 1, status: "approved" }),
    baseRecord({ id: 2, status: "pending" }),
    baseRecord({ id: 3, status: "rejected" }),
    baseRecord({ id: 4, status: "archived" }),
  ];

  it("默认不包含 pending 和 rejected → 只剩 approved + archived", () => {
    const r = filterArtifactsForExport(records, {
      includePending: false,
      includeRejected: false,
    });
    expect(r.map((x) => x.id).sort()).toEqual([1, 4]);
  });

  it("包含 pending 但不含 rejected", () => {
    const r = filterArtifactsForExport(records, {
      includePending: true,
      includeRejected: false,
    });
    expect(r.map((x) => x.id).sort()).toEqual([1, 2, 4]);
  });

  it("包含 rejected 但不含 pending", () => {
    const r = filterArtifactsForExport(records, {
      includePending: false,
      includeRejected: true,
    });
    expect(r.map((x) => x.id).sort()).toEqual([1, 3, 4]);
  });

  it("两个都包含 → 全部返回", () => {
    const r = filterArtifactsForExport(records, {
      includePending: true,
      includeRejected: true,
    });
    expect(r.map((x) => x.id).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("consistencyChecker - 报告总体行为 (isExportable / 统计 / 排序)", () => {
  it("空输入 → 0 阻塞 0 警告，isExportable=true", () => {
    const report = runConsistencyChecks(baseInput([], []));
    expect(report.blockingCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.isExportable).toBe(true);
    expect(report.issues.length).toBe(0);
  });

  it("仅有 warning 级别问题 → isExportable=true", () => {
    const records = [
      baseRecord({ id: 1, status: "pending" }),
      baseRecord({ id: 2, status: "rejected" }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    expect(report.blockingCount).toBe(0);
    expect(report.warningCount).toBeGreaterThanOrEqual(2);
    expect(report.isExportable).toBe(true);
  });

  it("存在 1 个 blocking + n 个 warning → isExportable=false，blockingCount=1", () => {
    const records = [
      baseRecord({ id: 1, trenchNumber: "", status: "pending" }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    expect(report.blockingCount).toBeGreaterThanOrEqual(1);
    expect(report.warningCount).toBeGreaterThanOrEqual(1);
    expect(report.isExportable).toBe(false);
  });

  it("issues 排序：blocking 全部排在 warning 之前", () => {
    const records = [
      baseRecord({ id: 1, status: "pending" }),
      baseRecord({ id: 2, trenchNumber: "" }),
      baseRecord({ id: 3, eCoordinate: "", nCoordinate: "", status: "rejected" }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    const blockingEndIdx = report.issues.findIndex((i) => i.severity !== "blocking");
    if (blockingEndIdx !== -1) {
      const tail = report.issues.slice(blockingEndIdx);
      expect(tail.every((i) => i.severity === "warning")).toBe(true);
    }
  });
});

describe("consistencyChecker - 孤立地层 (orphan_stratum)", () => {
  it("有出土物但未建立地层关系（且其他关系已存在）→ orphan_stratum warning", () => {
    const records = [
      baseRecord({ id: 1, stratum: "第1层", artifactType: "陶片" }),
      baseRecord({ id: 2, stratum: "第2层", artifactType: "石器" }),
    ];
    const relations: StratumRelation[] = [
      baseRelation({
        id: 1,
        stratumA: "第3层",
        stratumB: "第4层",
        relationType: "earlier",
      }),
    ];
    const report = runConsistencyChecks(baseInput(records, relations));
    const orphans = findIssuesByCategory(report.issues, "orphan_stratum");
    expect(orphans.length).toBe(2);
    expect(orphans.every((o) => o.severity === "warning")).toBe(true);
    const names = orphans.map((o) => o.stratumName).sort();
    expect(names).toEqual(["第1层", "第2层"]);
  });

  it("地层既出现在关系里也有出土物 → 不产生 orphan", () => {
    const records = [baseRecord({ id: 1, stratum: "第1层" })];
    const relations = [baseRelation({ id: 1, stratumA: "第1层", stratumB: "第2层" })];
    const report = runConsistencyChecks(baseInput(records, relations));
    const orphans = findIssuesByCategory(report.issues, "orphan_stratum");
    expect(orphans.length).toBe(0);
  });

  it("完全没有关系数据（relations=[]）→ 不产生 orphan（避免误报）", () => {
    const records = [
      baseRecord({ id: 1, stratum: "第1层" }),
      baseRecord({ id: 2, stratum: "第2层" }),
    ];
    const report = runConsistencyChecks(baseInput(records, []));
    const orphans = findIssuesByCategory(report.issues, "orphan_stratum");
    expect(orphans.length).toBe(0);
  });
});
