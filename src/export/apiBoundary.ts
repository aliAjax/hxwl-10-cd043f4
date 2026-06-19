import type { ExportDataPackage } from "./types";

export interface UploadResult {
  success: boolean;
  taskId?: string;
  error?: string;
  message?: string;
}

export interface PdfGenerationResult {
  success: boolean;
  url?: string;
  error?: string;
  taskId?: string;
}

export interface BackendApiConfig {
  baseUrl?: string;
  authToken?: string;
  timeoutMs?: number;
}

export const backendApi: {
  uploadDataPackage: (
    dataPackage: ExportDataPackage,
    config?: BackendApiConfig
  ) => Promise<UploadResult>;
  generatePdfReport: (
    dataPackage: ExportDataPackage,
    options?: {
      includeCharts?: boolean;
      includeConsistencyReport?: boolean;
      templateId?: string;
      config?: BackendApiConfig;
    }
  ) => Promise<PdfGenerationResult>;
} = {
  async uploadDataPackage(dataPackage, _config) {
    console.info(
      "[BackendAPI - 预留接口] uploadDataPackage 被调用，项目ID:",
      dataPackage.projectInfo.id,
      "资料包schema版本:",
      dataPackage.schemaVersion,
      "出土物记录数:",
      dataPackage.artifacts.length
    );

    return {
      success: true,
      taskId: `local-sim-${Date.now()}`,
      message:
        "后端API接口预留：上传成功（当前为前端模拟返回，实际部署时请替换为真实的 fetch/axios 调用）。" +
        "可在此处调用 POST /api/archaeology/packages 接口。",
    };
  },

  async generatePdfReport(dataPackage, options) {
    console.info(
      "[BackendAPI - 预留接口] generatePdfReport 被调用，项目ID:",
      dataPackage.projectInfo.id,
      "选项:",
      JSON.stringify(options, null, 2)
    );

    return {
      success: false,
      taskId: `pdf-sim-${Date.now()}`,
      error:
        "PDF报告生成接口预留：后端PDF服务尚未接入（前端模拟返回）。" +
        "可在此处调用 POST /api/archaeology/packages/:id/pdf 接口，" +
        "或集成 jsPDF / pdfmake 进行纯前端生成。",
    };
  },
};
