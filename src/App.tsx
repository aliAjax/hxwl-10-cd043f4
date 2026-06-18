import { useState } from "react";
import "./styles.css";

interface ArtifactRecord {
  id: number;
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  remarks: string;
  createdAt: string;
}

interface ArtifactFormData {
  trenchNumber: string;
  stratum: string;
  artifactType: string;
  eCoordinate: string;
  nCoordinate: string;
  depth: string;
  remarks: string;
}

interface SearchFilters {
  trenchNumber: string;
  stratum: string;
  relicUnit: string;
  artifactKeyword: string;
}

type FormErrors = Partial<Record<keyof ArtifactFormData, string>>;

const project = {
  "id": "hxwl-10",
  "port": 5110,
  "title": "考古探方记录",
  "subtitle": "遗址探方、地层关系与出土物坐标档案",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#854d0e",
    "#047857",
    "#475569"
  ],
  "domain": "考古发掘",
  "users": [
    "发掘队员",
    "领队",
    "资料整理员"
  ],
  "metrics": [
    "探方数",
    "地层数",
    "出土物",
    "未整理记录"
  ],
  "filters": [
    "灰坑",
    "墓葬",
    "房址",
    "沟状遗迹"
  ],
  "fields": [
    "遗址",
    "探方",
    "地层",
    "遗迹单位",
    "深度",
    "土色",
    "坐标点",
    "出土物"
  ],
  "records": [
    [
      "T0203",
      "第3层",
      "灰褐土",
      "陶片12件，坐标E3N4"
    ],
    [
      "T0204",
      "H12灰坑",
      "黑褐土",
      "夹炭屑，见动物骨"
    ],
    [
      "T0301",
      "F2房址",
      "夯土面",
      "柱洞关系需复核"
    ]
  ]
};

const statusColors = ["status-ok", "status-watch", "status-danger"];

const artifactTypes = ["陶片", "石器", "骨器", "青铜器", "瓷器", "铁器", "动植物遗存", "其他"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function App() {
  const [artifactRecords, setArtifactRecords] = useState<ArtifactRecord[]>([]);
  const [formData, setFormData] = useState<ArtifactFormData>({
    trenchNumber: "",
    stratum: "",
    artifactType: "",
    eCoordinate: "",
    nCoordinate: "",
    depth: "",
    remarks: ""
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    trenchNumber: "",
    stratum: "",
    relicUnit: "",
    artifactKeyword: ""
  });

  const values = project.metrics.map((metric: string, index: number) => {
    const base = [84, 12, 31, 7][index % 4];
    if (metric === "出土物") {
      return String(base + index * 3 + artifactRecords.length);
    }
    return String(base + index * 3);
  });

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.trenchNumber.trim()) {
      errors.trenchNumber = "请输入探方编号";
    }
    if (!formData.stratum.trim()) {
      errors.stratum = "请输入地层";
    }
    if (!formData.artifactType.trim()) {
      errors.artifactType = "请选择出土物类型";
    }
    if (!formData.eCoordinate.trim()) {
      errors.eCoordinate = "请输入E坐标";
    }
    if (!formData.nCoordinate.trim()) {
      errors.nCoordinate = "请输入N坐标";
    }
    if (!formData.depth.trim()) {
      errors.depth = "请输入深度";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof ArtifactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    const newRecord: ArtifactRecord = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toLocaleString("zh-CN")
    };
    setArtifactRecords(prev => [newRecord, ...prev]);
    handleClear();
  };

  const handleClear = () => {
    setFormData({
      trenchNumber: "",
      stratum: "",
      artifactType: "",
      eCoordinate: "",
      nCoordinate: "",
      depth: "",
      remarks: ""
    });
    setFormErrors({});
  };

  const handleSearchChange = (field: keyof SearchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleClearSearch = () => {
    setSearchFilters({
      trenchNumber: "",
      stratum: "",
      relicUnit: "",
      artifactKeyword: ""
    });
  };

  const filterProjectRecords = (records: string[][]): string[][] => {
    return records.filter(record => {
      const [trench, stratumInfo, relicInfo, artifactInfo] = record;
      const matchTrench = !searchFilters.trenchNumber || 
        trench.toLowerCase().includes(searchFilters.trenchNumber.toLowerCase());
      const matchStratum = !searchFilters.stratum || 
        stratumInfo.toLowerCase().includes(searchFilters.stratum.toLowerCase());
      const matchRelic = !searchFilters.relicUnit || 
        relicInfo.toLowerCase().includes(searchFilters.relicUnit.toLowerCase()) ||
        stratumInfo.toLowerCase().includes(searchFilters.relicUnit.toLowerCase());
      const matchArtifact = !searchFilters.artifactKeyword || 
        artifactInfo.toLowerCase().includes(searchFilters.artifactKeyword.toLowerCase());
      return matchTrench && matchStratum && matchRelic && matchArtifact;
    });
  };

  const filterArtifactRecords = (records: ArtifactRecord[]): ArtifactRecord[] => {
    return records.filter(record => {
      const matchTrench = !searchFilters.trenchNumber || 
        record.trenchNumber.toLowerCase().includes(searchFilters.trenchNumber.toLowerCase());
      const matchStratum = !searchFilters.stratum || 
        record.stratum.toLowerCase().includes(searchFilters.stratum.toLowerCase());
      const matchRelic = !searchFilters.relicUnit || 
        record.stratum.toLowerCase().includes(searchFilters.relicUnit.toLowerCase()) ||
        record.remarks.toLowerCase().includes(searchFilters.relicUnit.toLowerCase());
      const matchArtifact = !searchFilters.artifactKeyword || 
        record.artifactType.toLowerCase().includes(searchFilters.artifactKeyword.toLowerCase()) ||
        record.remarks.toLowerCase().includes(searchFilters.artifactKeyword.toLowerCase());
      return matchTrench && matchStratum && matchRelic && matchArtifact;
    });
  };

  const hasActiveFilters = Object.values(searchFilters).some(v => v.trim() !== "");

  const filteredProjectRecords = filterProjectRecords(project.records);
  const filteredArtifactRecords = filterArtifactRecords(artifactRecords);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard key={metric} label={metric} value={values[index]} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user: string) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {project.filters.map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>{project.domain}</p>
              <h2>记录字段</h2>
            </div>
            <button className="primary-action">新增记录</button>
          </div>
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input placeholder={"填写" + field} />
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="panel artifact-collection">
        <div className="section-heading">
          <div>
            <p>坐标采集</p>
            <h2>出土物坐标采集</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleClear}>清空表单</button>
            <button className="primary-action" onClick={handleSubmit}>新增记录</button>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>探方编号 <span className="required">*</span></span>
            <input
              placeholder="如 T0203"
              value={formData.trenchNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("trenchNumber", e.target.value)}
              className={formErrors.trenchNumber ? "input-error" : ""}
            />
            {formErrors.trenchNumber && <span className="error-text">{formErrors.trenchNumber}</span>}
          </label>
          <label>
            <span>地层 <span className="required">*</span></span>
            <input
              placeholder="如 第3层"
              value={formData.stratum}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("stratum", e.target.value)}
              className={formErrors.stratum ? "input-error" : ""}
            />
            {formErrors.stratum && <span className="error-text">{formErrors.stratum}</span>}
          </label>
          <label>
            <span>出土物类型 <span className="required">*</span></span>
            <select
              value={formData.artifactType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange("artifactType", e.target.value)}
              className={formErrors.artifactType ? "input-error" : ""}
            >
              <option value="">请选择类型</option>
              {artifactTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {formErrors.artifactType && <span className="error-text">{formErrors.artifactType}</span>}
          </label>
          <label>
            <span>E坐标 <span className="required">*</span></span>
            <input
              placeholder="如 3.25"
              value={formData.eCoordinate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("eCoordinate", e.target.value)}
              className={formErrors.eCoordinate ? "input-error" : ""}
            />
            {formErrors.eCoordinate && <span className="error-text">{formErrors.eCoordinate}</span>}
          </label>
          <label>
            <span>N坐标 <span className="required">*</span></span>
            <input
              placeholder="如 4.50"
              value={formData.nCoordinate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("nCoordinate", e.target.value)}
              className={formErrors.nCoordinate ? "input-error" : ""}
            />
            {formErrors.nCoordinate && <span className="error-text">{formErrors.nCoordinate}</span>}
          </label>
          <label>
            <span>深度 <span className="required">*</span></span>
            <input
              placeholder="如 0.85m"
              value={formData.depth}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("depth", e.target.value)}
              className={formErrors.depth ? "input-error" : ""}
            />
            {formErrors.depth && <span className="error-text">{formErrors.depth}</span>}
          </label>
          <label className="full-width">
            <span>备注</span>
            <input
              placeholder="其他补充说明"
              value={formData.remarks}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange("remarks", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="panel search-panel">
        <div className="section-heading">
          <div>
            <p>检索</p>
            <h2>探方快速检索</h2>
          </div>
          <button onClick={handleClearSearch} disabled={!hasActiveFilters}>
            清除筛选
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>探方编号</span>
            <input
              placeholder="如 T0203"
              value={searchFilters.trenchNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("trenchNumber", e.target.value)}
            />
          </label>
          <label>
            <span>地层名称</span>
            <input
              placeholder="如 第3层"
              value={searchFilters.stratum}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("stratum", e.target.value)}
            />
          </label>
          <label>
            <span>遗迹单位</span>
            <input
              placeholder="如 H12、F2"
              value={searchFilters.relicUnit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("relicUnit", e.target.value)}
            />
          </label>
          <label>
            <span>出土物关键词</span>
            <input
              placeholder="如 陶片、动物骨"
              value={searchFilters.artifactKeyword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange("artifactKeyword", e.target.value)}
            />
          </label>
        </div>
        {hasActiveFilters && (
          <p className="search-result-info">
            筛选结果：示例记录 {filteredProjectRecords.length} 条 · 采集记录 {filteredArtifactRecords.length} 条
          </p>
        )}
      </section>

      <section className="records-section">
        <section className="panel records">
          <div className="section-heading">
            <div>
              <p>示例数据</p>
              <h2>近期记录</h2>
            </div>
            <div>
              {hasActiveFilters && <span className="filter-badge">筛选中</span>}
              <button>导出摘要</button>
            </div>
          </div>
          <div className="record-list">
            {filteredProjectRecords.length === 0 ? (
              <div className="empty-state-detail">
                <p className="empty-state">暂无匹配的示例记录</p>
                {hasActiveFilters && (
                  <p className="empty-state-hint">请尝试调整筛选条件，或点击"清除筛选"查看全部记录</p>
                )}
              </div>
            ) : (
              filteredProjectRecords.map((record: string[], index: number) => (
                <article key={record.join("-")} className="record-card">
                  <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{record[0]}</h3>
                    <p>{record.slice(1).join(" · ")}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel records">
          <div className="section-heading">
            <div>
              <p>采集数据</p>
              <h2>出土物坐标记录</h2>
            </div>
            <div>
              {hasActiveFilters && <span className="filter-badge">筛选中</span>}
              <div>共 {hasActiveFilters ? filteredArtifactRecords.length : artifactRecords.length} 条</div>
            </div>
          </div>
          <div className="record-list">
            {hasActiveFilters && filteredArtifactRecords.length === 0 ? (
              <div className="empty-state-detail">
                <p className="empty-state">暂无匹配的采集记录</p>
                <p className="empty-state-hint">请尝试调整筛选条件，或点击"清除筛选"查看全部记录</p>
              </div>
            ) : artifactRecords.length === 0 ? (
              <p className="empty-state">暂无出土物坐标记录，请在上方表单录入</p>
            ) : (
              filteredArtifactRecords.map((record: ArtifactRecord, index: number) => (
                <article key={record.id} className="record-card">
                  <div className="record-index artifact-index">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{record.trenchNumber} · {record.artifactType}</h3>
                    <p>地层：{record.stratum} · 坐标：E{record.eCoordinate} N{record.nCoordinate} · 深度：{record.depth}</p>
                    {record.remarks && <p className="record-remarks">备注：{record.remarks}</p>}
                    <p className="record-time">{record.createdAt}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
