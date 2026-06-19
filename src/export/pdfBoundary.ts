import type { ExportDataPackage } from "./types";

export interface PdfTemplateOptions {
  title?: string;
  includeCharts?: boolean;
  includeCoordinates?: boolean;
  includeConsistencyReport?: boolean;
  locale?: "zh-CN" | "en-US";
  paperSize?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
}

export const pdfGenerator: {
  isAvailable: () => boolean;
  generatePdfFrontend: (
    dataPackage: ExportDataPackage,
    options?: PdfTemplateOptions
  ) => Promise<{
    success: boolean;
    error?: string;
    hint?: string;
  }>;
} = {
  isAvailable() {
    return false;
  },

  async generatePdfFrontend(dataPackage, options) {
    console.info(
      "[PDF - 预留边界] generatePdfFrontend 被调用，项目:",
      dataPackage.projectInfo.title,
      "选项:",
      JSON.stringify(options, null, 2)
    );

    return {
      success: false,
      error: "PDF报告功能边界预留：纯前端PDF生成引擎尚未接入。",
      hint:
        "推荐接入方案二选一：\n" +
        "  1) 后端方案：调用 apiBoundary.generatePdfReport()，由后端通过 wkhtmltopdf / puppeteer 生成 PDF\n" +
        "  2) 纯前端方案：集成 jsPDF + html2canvas / pdfmake，自行拼装报告版式\n" +
        "  本模块已将 ExportDataPackage 标准化为 JSON，两种方案均可以此为输入源。",
    };
  },
};
