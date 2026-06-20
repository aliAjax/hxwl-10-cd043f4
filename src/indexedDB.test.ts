import { describe, it, expect, beforeEach } from "vitest";
import {
  saveDraft,
  getDraft,
  getAllDrafts,
  deleteDraft,
  clearAllDrafts,
  getDraftsByTrench,
  isIndexedDBSupported,
} from "./indexedDB";
import type { DraftFormData } from "./types";

const baseDraftData = (overrides: Partial<DraftFormData> = {}): DraftFormData => ({
  trenchNumber: "T0101",
  stratum: "第1层",
  relicUnit: "H1",
  artifactType: "陶片",
  eCoordinate: "E123.45m",
  nCoordinate: "N67.89m",
  depth: "0.5m",
  quantity: "1",
  remarks: "测试备注",
  draftName: "",
  ...overrides,
});

describe("indexedDB - Draft Operations", () => {
  beforeEach(async () => {
    try {
      await clearAllDrafts();
    } catch (e) {
    }
  });

  describe("isIndexedDBSupported", () => {
    it("should return true in jsdom environment with fake-indexeddb", () => {
      const result = isIndexedDBSupported();
      expect(result).toBe(true);
    });
  });

  describe("saveDraft", () => {
    it("should save a new draft and return id", async () => {
      const draftData = baseDraftData();
      const id = await saveDraft(draftData);

      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);

      const saved = await getDraft(id);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(id);
      expect(saved?.trenchNumber).toBe("T0101");
      expect(saved?.artifactType).toBe("陶片");
    });

    it("should auto-generate draftName when not provided", async () => {
      const draftData = baseDraftData({ draftName: "", trenchNumber: "T0202" });
      const id = await saveDraft(draftData);

      const saved = await getDraft(id);
      expect(saved?.draftName).toBeDefined();
      expect(saved?.draftName.length).toBeGreaterThan(0);
      expect(saved?.draftName).toContain("T0202");
    });

    it("should use provided draftName when specified", async () => {
      const customName = "我的自定义草稿";
      const draftData = baseDraftData({ draftName: customName });
      const id = await saveDraft(draftData);

      const saved = await getDraft(id);
      expect(saved?.draftName).toBe(customName);
    });

    it("should update existing draft when existingId is provided", async () => {
      const id = await saveDraft(baseDraftData({ artifactType: "陶片" }));

      const updatedId = await saveDraft(
        baseDraftData({ artifactType: "石器", draftName: "更新后的草稿" }),
        id
      );

      expect(updatedId).toBe(id);

      const updated = await getDraft(id);
      expect(updated?.artifactType).toBe("石器");
      expect(updated?.draftName).toBe("更新后的草稿");
    });

    it("should set savedAt timestamp", async () => {
      const before = new Date();
      const id = await saveDraft(baseDraftData());
      const after = new Date();

      const saved = await getDraft(id);
      expect(saved?.savedAt).toBeDefined();
      expect(typeof saved?.savedAt).toBe("string");
      expect(saved?.savedAt!.length).toBeGreaterThan(0);
      expect(saved?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

      const savedDate = new Date(saved?.savedAt || "");
      expect(isNaN(savedDate.getTime())).toBe(false);
      expect(savedDate >= before).toBe(true);
      expect(savedDate <= after).toBe(true);
    });
  });

  describe("getDraft", () => {
    it("should return undefined for non-existent id", async () => {
      const draft = await getDraft(99999);
      expect(draft).toBeUndefined();
    });

    it("should return correct draft for existing id", async () => {
      const data = baseDraftData({
        trenchNumber: "T0303",
        stratum: "第3层",
        artifactType: "青铜器",
        remarks: "重要发现",
      });
      const id = await saveDraft(data);

      const draft = await getDraft(id);
      expect(draft).toBeDefined();
      expect(draft?.trenchNumber).toBe("T0303");
      expect(draft?.stratum).toBe("第3层");
      expect(draft?.artifactType).toBe("青铜器");
      expect(draft?.remarks).toBe("重要发现");
    });
  });

  describe("getAllDrafts", () => {
    it("should return empty array when no drafts exist", async () => {
      const drafts = await getAllDrafts();
      expect(drafts).toEqual([]);
    });

    it("should return all drafts sorted by savedAt descending", async () => {
      const id1 = await saveDraft(baseDraftData({ trenchNumber: "T01" }));
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await saveDraft(baseDraftData({ trenchNumber: "T02" }));
      await new Promise(resolve => setTimeout(resolve, 10));
      const id3 = await saveDraft(baseDraftData({ trenchNumber: "T03" }));

      const drafts = await getAllDrafts();
      expect(drafts.length).toBe(3);
      expect(drafts[0].id).toBe(id3);
      expect(drafts[1].id).toBe(id2);
      expect(drafts[2].id).toBe(id1);
    });
  });

  describe("getDraftsByTrench", () => {
    it("should return empty array when no drafts for trench", async () => {
      await saveDraft(baseDraftData({ trenchNumber: "T01" }));
      const drafts = await getDraftsByTrench("T99");
      expect(drafts).toEqual([]);
    });

    it("should return only drafts for specified trench", async () => {
      await saveDraft(baseDraftData({ trenchNumber: "T01" }));
      await saveDraft(baseDraftData({ trenchNumber: "T01", artifactType: "石器" }));
      await saveDraft(baseDraftData({ trenchNumber: "T02" }));

      const drafts = await getDraftsByTrench("T01");
      expect(drafts.length).toBe(2);
      expect(drafts.every(d => d.trenchNumber === "T01")).toBe(true);
    });

    it("should sort results by savedAt descending", async () => {
      const id1 = await saveDraft(baseDraftData({ trenchNumber: "T01", artifactType: "陶片" }));
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await saveDraft(baseDraftData({ trenchNumber: "T01", artifactType: "石器" }));

      const drafts = await getDraftsByTrench("T01");
      expect(drafts[0].id).toBe(id2);
      expect(drafts[1].id).toBe(id1);
    });
  });

  describe("deleteDraft", () => {
    it("should delete existing draft", async () => {
      const id = await saveDraft(baseDraftData());

      expect(await getDraft(id)).toBeDefined();

      await deleteDraft(id);

      expect(await getDraft(id)).toBeUndefined();
    });

    it("should not throw when deleting non-existent draft", async () => {
      await expect(deleteDraft(99999)).resolves.not.toThrow();
    });
  });

  describe("clearAllDrafts", () => {
    it("should clear all drafts", async () => {
      await saveDraft(baseDraftData({ trenchNumber: "T01" }));
      await saveDraft(baseDraftData({ trenchNumber: "T02" }));
      await saveDraft(baseDraftData({ trenchNumber: "T03" }));

      expect((await getAllDrafts()).length).toBe(3);

      await clearAllDrafts();

      expect((await getAllDrafts()).length).toBe(0);
    });
  });

  describe("Data Integrity", () => {
    it("should preserve all fields correctly", async () => {
      const original: DraftFormData = {
        trenchNumber: "T1234",
        stratum: "第12层",
        relicUnit: "G2",
        artifactType: "玉器",
        eCoordinate: "E999.99m",
        nCoordinate: "N888.88m",
        depth: "12.5m",
        quantity: "5",
        remarks: "测试完整字段",
        draftName: "完整测试草稿",
      };

      const id = await saveDraft(original);
      const saved = await getDraft(id);

      expect(saved?.trenchNumber).toBe(original.trenchNumber);
      expect(saved?.stratum).toBe(original.stratum);
      expect(saved?.relicUnit).toBe(original.relicUnit);
      expect(saved?.artifactType).toBe(original.artifactType);
      expect(saved?.eCoordinate).toBe(original.eCoordinate);
      expect(saved?.nCoordinate).toBe(original.nCoordinate);
      expect(saved?.depth).toBe(original.depth);
      expect(saved?.quantity).toBe(original.quantity);
      expect(saved?.remarks).toBe(original.remarks);
      expect(saved?.draftName).toBe(original.draftName);
    });

    it("should handle empty strings correctly", async () => {
      const data = baseDraftData({
        relicUnit: "",
        quantity: "",
        remarks: "",
      });
      const id = await saveDraft(data);
      const saved = await getDraft(id);

      expect(saved?.relicUnit).toBe("");
      expect(saved?.quantity).toBe("");
      expect(saved?.remarks).toBe("");
    });
  });
});
