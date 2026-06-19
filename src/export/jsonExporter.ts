import type { ExportDataPackage, ExportOptions } from "./types";

const generateDefaultFileName = (projectId: string): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${projectId || "archaeology"}_data_package_${dateStr}_${timeStr}.json`;
};

export const serializeDataPackage = (data: ExportDataPackage): string => {
  return JSON.stringify(data, null, 2);
};

export const downloadJsonFile = (
  dataPackage: ExportDataPackage,
  options?: ExportOptions & { requireConsistencyPass?: boolean }
): { success: boolean; fileName: string; sizeBytes: number; error?: string } => {
  try {
    if (options?.requireConsistencyPass && dataPackage.consistencyReport.blockingCount > 0) {
      return {
        success: false,
        fileName: options?.fileName || "archaeology_data_package.json",
        sizeBytes: 0,
        error: `资料包包含 ${dataPackage.consistencyReport.blockingCount} 项阻断问题，一致性检查未通过，禁止导出。`,
      };
    }

    const fileName = options?.fileName || generateDefaultFileName(dataPackage.projectInfo.id);
    const jsonStr = serializeDataPackage(dataPackage);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });

    if (typeof window === "undefined") {
      return {
        success: false,
        fileName,
        sizeBytes: jsonStr.length,
        error: "当前环境不支持浏览器下载API",
      };
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    return {
      success: true,
      fileName,
      sizeBytes: blob.size,
    };
  } catch (error) {
    return {
      success: false,
      fileName: options?.fileName || "archaeology_data_package.json",
      sizeBytes: 0,
      error: error instanceof Error ? error.message : "未知下载错误",
    };
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
