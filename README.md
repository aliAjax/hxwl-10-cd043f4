# hxwl-10 考古探方记录

遗址探方、地层关系与出土物坐标档案

## 技术栈

React + Vite + TypeScript + CSS + Vitest

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5110

## 核心功能

- 领域指标看板
- 角色和分类筛选
- 专业字段录入区
- 示例记录列表
- **IndexedDB 草稿存储**：草稿自动保存，支持离线编辑
- **导出任务历史**：所有导出操作自动存档，可追溯
- **资料包下载**：JSON 格式完整资料包导出
- **模拟后端上传**：预留后端 API 接口边界
- **PDF 边界**：预留 PDF 报告生成接口
- **年代推断**：基于地层关系的自动年代排序算法

## 质量检查流程

面向日常开发的完整质量检查流程，确保代码类型安全、构建成功、核心逻辑正确。

### 1. 类型检查

检查 TypeScript 类型错误：

```bash
npm run typecheck
```

或别名：

```bash
npm run lint
```

### 2. 构建检查

确保项目可以正常构建：

```bash
npm run build
```

### 3. 核心逻辑测试

运行所有单元测试：

```bash
npm run test
```

监听模式（开发时使用）：

```bash
npm run test:watch
```

测试覆盖率报告：

```bash
npm run test:coverage
```

### 4. 一键质量检查

日常开发快速检查（类型检查 + 单元测试）：

```bash
npm run quality
```

CI 流程完整检查（类型检查 + 构建 + 单元测试）：

```bash
npm run quality:ci
```

完整质量检查（类型检查 + 构建 + 测试覆盖率）：

```bash
npm run quality:full
```

### 5. 专项功能验证

按功能模块快速验证：

**本地存储相关（IndexedDB 草稿 + 任务历史）**：

```bash
npm run verify:storage
```

**导出功能相关（JSON 导出 + 资料包生成）**：

```bash
npm run verify:export
```

**年代推断算法**：

```bash
npm run verify:chronology
```

**领域校验规则**：

```bash
npm run verify:validators
```

## 新同事快速验证指南

新同事拉取代码后，按以下步骤验证导出和本地存储功能：

### 第一步：安装依赖

```bash
npm install
```

### 第二步：验证本地存储功能

```bash
npm run verify:storage
```

预期结果：所有测试通过，包括：
- 草稿 CRUD 操作（保存、读取、更新、删除、查询）
- 导出任务历史 CRUD 操作
- 按探方筛选草稿
- 任务历史按项目/类型筛选

### 第三步：验证导出功能

```bash
npm run verify:export
```

预期结果：所有测试通过，包括：
- 数据序列化
- 文件下载触发
- 一致性检查阻断逻辑
- 资料包数据收集
- 按状态筛选导出记录

### 第四步：运行完整质量检查

```bash
npm run quality
```

### 第五步：启动开发服务验证浏览器行为

```bash
npm run dev
```

打开 http://localhost:5110 进行浏览器回归测试。

## 浏览器回归测试说明

### 必测场景

1. **IndexedDB 草稿功能**
   - 录入表单填写部分数据，点击"保存草稿"
   - 刷新页面，点击"草稿列表"，验证草稿存在
   - 选择草稿恢复，验证数据正确回填
   - 删除草稿，验证列表更新

2. **导出功能**
   - 录入若干条完整的出土物记录（状态：已通过）
   - 点击"导出资料包"，选择 JSON 格式
   - 验证文件下载成功，文件名包含项目 ID 和时间戳
   - 打开 JSON 文件，验证数据结构完整

3. **一致性检查**
   - 录入一条缺失探方编号的记录
   - 点击"一致性检查"，验证 blocking 级别问题出现
   - 尝试导出，验证被阻断
   - 修复问题后重新检查，验证可导出

4. **导出任务历史**
   - 执行多次导出操作（成功/失败场景）
   - 打开"任务历史"面板，验证记录按时间倒序排列
   - 点击"重新导出"，验证历史快照可复用
   - 删除历史记录，验证列表更新

5. **年代推断**
   - 录入多条地层关系（A 早于 B，B 早于 C）
   - 打开"年代视图"，验证排序正确
   - 创建循环关系（A 早于 B，B 早于 A），验证循环检测和风险提示

### 浏览器兼容性

- Chrome/Edge 90+（推荐）
- Firefox 88+
- Safari 14+

### 关键技术点验证

- IndexedDB 数据库版本升级（v1 → v2 → v3）
- Blob URL 创建与释放（内存泄漏检查）
- 大文件导出性能（>1000 条记录）
- 离线模式下草稿保存（断网测试）

## 测试覆盖范围

### 已覆盖的核心模块

| 模块 | 文件 | 测试覆盖率目标 |
|------|------|--------------|
| 坐标校验 | [domainValidators.ts](src/domainValidators.ts) | 100% |
| 字段校验 | [domainValidators.ts](src/domainValidators.ts) | 100% |
| 地层关系冲突检测 | [domainValidators.ts](src/domainValidators.ts) | 100% |
| 草稿存储 | [indexedDB.ts](src/indexedDB.ts) | 95%+ |
| 任务历史存储 | [exportTaskStore.ts](src/export/exportTaskStore.ts) | 95%+ |
| JSON 导出 | [jsonExporter.ts](src/export/jsonExporter.ts) | 95%+ |
| 数据收集 | [dataCollector.ts](src/export/dataCollector.ts) | 100% |
| 一致性检查 | [consistencyChecker.ts](src/export/consistencyChecker.ts) | 100% |
| 年代推断 | [chronologyInference.ts](src/chronologyInference.ts) | 90%+ |

### 测试文件列表

- [indexedDB.test.ts](src/indexedDB.test.ts) - 草稿存储测试
- [exportTaskStore.test.ts](src/export/exportTaskStore.test.ts) - 任务历史存储测试
- [jsonExporter.test.ts](src/export/jsonExporter.test.ts) - JSON 导出测试
- [dataCollector.test.ts](src/export/dataCollector.test.ts) - 数据收集测试
- [consistencyChecker.test.ts](src/export/consistencyChecker.test.ts) - 一致性检查测试
- [domainValidators.test.ts](src/domainValidators.test.ts) - 领域校验测试
- [chronologyInference.test.ts](src/chronologyInference.test.ts) - 年代推断测试

## 项目结构

```
src/
├── export/                    # 导出模块
│   ├── ExportModule.tsx       # 导出组件
│   ├── ExportTaskHistory.tsx  # 任务历史组件
│   ├── apiBoundary.ts         # 后端 API 边界
│   ├── consistencyChecker.ts  # 一致性检查逻辑
│   ├── dataCollector.ts       # 数据收集逻辑
│   ├── exportTaskStore.ts     # 任务历史存储
│   ├── jsonExporter.ts        # JSON 导出逻辑
│   ├── pdfBoundary.ts         # PDF 生成边界
│   ├── types.ts               # 导出模块类型
│   └── *.test.ts              # 导出模块测试
├── indexedDB.ts               # 草稿存储
├── indexedDB.test.ts          # 草稿存储测试
├── chronologyInference.ts     # 年代推断算法
├── chronologyInference.test.ts # 年代推断测试
├── domainValidators.ts        # 领域校验规则
├── domainValidators.test.ts   # 领域校验测试
├── types.ts                   # 全局类型定义
├── App.tsx                    # 主应用组件
├── main.tsx                   # 入口文件
└── test/                      # 测试配置
    └── setup.ts               # Vitest 测试环境配置
```

## 依赖说明

### 生产依赖

- `react` - UI 框架
- `react-dom` - React DOM 渲染
- `vite` - 构建工具
- `typescript` - 类型系统

### 开发依赖

- `vitest` - 单元测试框架
- `@vitest/coverage-v8` - 测试覆盖率
- `fake-indexeddb` - IndexedDB 测试模拟
- `jsdom-worker` - Web Worker 模拟
- `@types/react` - React 类型定义
- `@types/react-dom` - React DOM 类型定义

## 开发工作流建议

1. 编写代码前先拉取最新代码
2. 完成功能开发后运行 `npm run quality`
3. 提交前确保 `npm run quality:ci` 全部通过
4. 合并前需通过代码审查和自动化 CI 检查

## 常见问题

### Q: 测试时 IndexedDB 报错怎么办？

A: 测试环境使用 `fake-indexeddb` 模拟 IndexedDB，无需真实浏览器环境。如果遇到数据库版本问题，可尝试清除 Node 缓存：`npm run test -- --run`

### Q: 类型检查提示找不到模块？

A: 确保已安装所有依赖：`npm install`，然后检查 `tsconfig.json` 中的 `include` 配置。

### Q: 如何查看测试覆盖率报告？

A: 运行 `npm run test:coverage` 后，打开 `coverage/index.html` 查看详细的覆盖率报告。

### Q: 大文件导出测试如何模拟？

A: 在测试中可以构造大量模拟数据，验证序列化和下载逻辑的性能。当前测试已包含基础场景，如需压力测试可扩展测试用例。
