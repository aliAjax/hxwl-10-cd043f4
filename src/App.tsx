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

interface ExcavationLog {
  id: number;
  date: string;
  weather: string;
  participants: string;
  excavationArea: string;
  mainFindings: string;
  pendingReview: string;
  createdAt: string;
}

interface ExcavationLogFormData {
  date: string;
  weather: string;
  participants: string;
  excavationArea: string;
  mainFindings: string;
  pendingReview: string;
}

interface SearchFilters {
  trenchNumber: string;
  stratum: string;
  relicUnit: string;
  artifactKeyword: string;
}

type FormErrors = Partial<Record<keyof ArtifactFormData, string>>;
type ExcavationLogFormErrors = Partial<Record<keyof ExcavationLogFormData, string>>;

type RelationType = "earlier" | "breaks" | "contains";

interface StratumRelation {
  id: number;
  stratumA: string;
  stratumB: string;
  relationType: RelationType;
  createdAt: string;
}

interface StratumRelationFormData {
  stratumA: string;
  stratumB: string;
  relationType: RelationType | "";
}

type StratumRelationFormErrors = Partial<Record<keyof StratumRelationFormData | "conflict", string>>;

const relationTypeOptions: { value: RelationType; label: string; description: string; inverse: string }[] = [
  { value: "earlier", label: "早于", description: "A 的年代早于 B", inverse: "晚于" },
  { value: "breaks", label: "打破", description: "A 地层打破了 B 地层", inverse: "被打破" },
  { value: "contains", label: "包含", description: "A 地层包含 B 遗迹/地层", inverse: "被包含于" }
];

const initialStratumRelations: StratumRelation[] = [
  {
    id: 1,
    stratumA: "第2层",
    stratumB: "第3层",
    relationType: "earlier",
    createdAt: "2024/6/17 10:15:00"
  },
  {
    id: 2,
    stratumA: "H12灰坑",
    stratumB: "第3层",
    relationType: "breaks",
    createdAt: "2024/6/17 11:30:00"
  }
];

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

const weatherOptions = ["晴", "多云", "阴", "小雨", "中雨", "大雨", "小雪", "中雪", "雾", "霾"];

const initialExcavationLogs: ExcavationLog[] = [
  {
    id: 1,
    date: "2024-06-17",
    weather: "晴",
    participants: "张建国、李明、王小芳",
    excavationArea: "T0203、T0204",
    mainFindings: "T0203 第3层出土陶片12件，其中可辨器形有鬲口沿2件、罐腹片5件；T0204 H12灰坑内发现动物骨骼碎片及炭屑堆积",
    pendingReview: "T0203 第2层与第3层的地层界线需进一步确认；H12灰坑出土的动物骨骼需送鉴定",
    createdAt: "2024/6/17 18:30:00"
  },
  {
    id: 2,
    date: "2024-06-16",
    weather: "多云",
    participants: "张建国、李明、赵伟",
    excavationArea: "T0301",
    mainFindings: "T0301 F2房址清理出柱洞6个，排列规律疑似为长方形建筑基址；房址内出土少量绳纹陶片",
    pendingReview: "F2房址柱洞的年代关系需结合出土物进一步分析；夯土面的土质土色需详细记录",
    createdAt: "2024/6/16 17:45:00"
  },
  {
    id: 3,
    date: "2024-06-15",
    weather: "小雨",
    participants: "李明、王小芳",
    excavationArea: "T0204",
    mainFindings: "因小雨停工半天，下午对 T0204 第4层进行了剖面清理，确认该层为文化层堆积",
    pendingReview: "雨天后探方排水情况需持续关注；T0204 第4层陶片需分类统计",
    createdAt: "2024/6/15 16:20:00"
  }
];

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
  const [excavationLogs, setExcavationLogs] = useState<ExcavationLog[]>(initialExcavationLogs);
  const [logFormData, setLogFormData] = useState<ExcavationLogFormData>({
    date: new Date().toISOString().split("T")[0],
    weather: "",
    participants: "",
    excavationArea: "",
    mainFindings: "",
    pendingReview: ""
  });
  const [logFormErrors, setLogFormErrors] = useState<ExcavationLogFormErrors>({});
  const [stratumRelations, setStratumRelations] = useState<StratumRelation[]>(initialStratumRelations);
  const [relationFormData, setRelationFormData] = useState<StratumRelationFormData>({
    stratumA: "",
    stratumB: "",
    relationType: ""
  });
  const [relationFormErrors, setRelationFormErrors] = useState<StratumRelationFormErrors>({});

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

  const validateLogForm = (): boolean => {
    const errors: ExcavationLogFormErrors = {};
    if (!logFormData.date.trim()) {
      errors.date = "请选择日期";
    }
    if (!logFormData.weather.trim()) {
      errors.weather = "请选择天气";
    }
    if (!logFormData.participants.trim()) {
      errors.participants = "请输入参与人员";
    }
    if (!logFormData.excavationArea.trim()) {
      errors.excavationArea = "请输入发掘区域";
    }
    if (!logFormData.mainFindings.trim()) {
      errors.mainFindings = "请输入主要发现";
    }
    setLogFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogInputChange = (field: keyof ExcavationLogFormData, value: string) => {
    setLogFormData(prev => ({ ...prev, [field]: value }));
    if (logFormErrors[field]) {
      setLogFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleLogSubmit = () => {
    if (!validateLogForm()) {
      return;
    }
    const newLog: ExcavationLog = {
      id: Date.now(),
      ...logFormData,
      createdAt: new Date().toLocaleString("zh-CN")
    };
    setExcavationLogs(prev => [newLog, ...prev]);
    handleLogClear();
  };

  const handleLogClear = () => {
    setLogFormData({
      date: new Date().toISOString().split("T")[0],
      weather: "",
      participants: "",
      excavationArea: "",
      mainFindings: "",
      pendingReview: ""
    });
    setLogFormErrors({});
  };

  const getRelationLabel = (type: RelationType): string => {
    return relationTypeOptions.find(o => o.value === type)?.label || type;
  };

  const getRelationInverseLabel = (type: RelationType): string => {
    return relationTypeOptions.find(o => o.value === type)?.inverse || type;
  };

  const checkDuplicateRelation = (a: string, b: string, type: RelationType, excludeId?: number): boolean => {
    return stratumRelations.some(r => {
      if (excludeId && r.id === excludeId) return false;
      const sameDirection = r.stratumA === a && r.stratumB === b && r.relationType === type;
      const oppositeDirection = r.stratumA === b && r.stratumB === a && r.relationType === type;
      return sameDirection;
    });
  };

  const checkConflictRelation = (a: string, b: string, type: RelationType): { hasConflict: boolean; message: string } => {
    for (const r of stratumRelations) {
      if (r.relationType === type) {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} ${getRelationLabel(type)} ${a}"，不能同时存在 "${a} ${getRelationLabel(type)} ${b}"`
          };
        }
      }
      if (type === "earlier" && r.relationType === "earlier") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 早于 ${a}"，不能同时存在 "${a} 早于 ${b}"`
          };
        }
      }
      if (type === "breaks" && r.relationType === "breaks") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 打破 ${a}"，不能同时存在 "${a} 打破 ${b}"`
          };
        }
      }
      if (type === "contains" && r.relationType === "contains") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 包含 ${a}"，不能同时存在 "${a} 包含 ${b}"`
          };
        }
      }
    }
    return { hasConflict: false, message: "" };
  };

  const validateRelationForm = (): boolean => {
    const errors: StratumRelationFormErrors = {};
    if (!relationFormData.stratumA.trim()) {
      errors.stratumA = "请输入地层A名称";
    }
    if (!relationFormData.stratumB.trim()) {
      errors.stratumB = "请输入地层B名称";
    }
    if (relationFormData.stratumA.trim() && relationFormData.stratumB.trim() && relationFormData.stratumA.trim() === relationFormData.stratumB.trim()) {
      errors.stratumB = "地层A和地层B不能相同";
    }
    if (!relationFormData.relationType) {
      errors.relationType = "请选择关系类型";
    }
    if (relationFormData.stratumA.trim() && relationFormData.stratumB.trim() && relationFormData.relationType) {
      const isDuplicate = checkDuplicateRelation(
        relationFormData.stratumA.trim(),
        relationFormData.stratumB.trim(),
        relationFormData.relationType as RelationType
      );
      if (isDuplicate) {
        errors.conflict = `重复：关系 "${relationFormData.stratumA.trim()} ${getRelationLabel(relationFormData.relationType as RelationType)} ${relationFormData.stratumB.trim()}" 已存在`;
      } else {
        const conflict = checkConflictRelation(
          relationFormData.stratumA.trim(),
          relationFormData.stratumB.trim(),
          relationFormData.relationType as RelationType
        );
        if (conflict.hasConflict) {
          errors.conflict = conflict.message;
        }
      }
    }
    setRelationFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRelationInputChange = (field: keyof StratumRelationFormData, value: string) => {
    setRelationFormData(prev => ({ ...prev, [field]: value }));
    if (relationFormErrors[field] || relationFormErrors.conflict) {
      setRelationFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        delete newErrors.conflict;
        return newErrors;
      });
    }
  };

  const handleRelationSubmit = () => {
    if (!validateRelationForm()) {
      return;
    }
    const newRelation: StratumRelation = {
      id: Date.now(),
      stratumA: relationFormData.stratumA.trim(),
      stratumB: relationFormData.stratumB.trim(),
      relationType: relationFormData.relationType as RelationType,
      createdAt: new Date().toLocaleString("zh-CN")
    };
    setStratumRelations(prev => [newRelation, ...prev]);
    handleRelationClear();
  };

  const handleRelationClear = () => {
    setRelationFormData({
      stratumA: "",
      stratumB: "",
      relationType: ""
    });
    setRelationFormErrors({});
  };

  const handleDeleteRelation = (id: number) => {
    setStratumRelations(prev => prev.filter(r => r.id !== id));
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

      <section className="panel excavation-log-section">
        <div className="section-heading">
          <div>
            <p>日志记录</p>
            <h2>发掘日志</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleLogClear}>清空表单</button>
            <button className="primary-action" onClick={handleLogSubmit}>新增日志</button>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>日期 <span className="required">*</span></span>
            <input
              type="date"
              value={logFormData.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogInputChange("date", e.target.value)}
              className={logFormErrors.date ? "input-error" : ""}
            />
            {logFormErrors.date && <span className="error-text">{logFormErrors.date}</span>}
          </label>
          <label>
            <span>天气 <span className="required">*</span></span>
            <select
              value={logFormData.weather}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleLogInputChange("weather", e.target.value)}
              className={logFormErrors.weather ? "input-error" : ""}
            >
              <option value="">请选择天气</option>
              {weatherOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            {logFormErrors.weather && <span className="error-text">{logFormErrors.weather}</span>}
          </label>
          <label>
            <span>参与人员 <span className="required">*</span></span>
            <input
              placeholder="如 张三、李四、王五"
              value={logFormData.participants}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogInputChange("participants", e.target.value)}
              className={logFormErrors.participants ? "input-error" : ""}
            />
            {logFormErrors.participants && <span className="error-text">{logFormErrors.participants}</span>}
          </label>
          <label>
            <span>发掘区域 <span className="required">*</span></span>
            <input
              placeholder="如 T0203、T0204"
              value={logFormData.excavationArea}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogInputChange("excavationArea", e.target.value)}
              className={logFormErrors.excavationArea ? "input-error" : ""}
            />
            {logFormErrors.excavationArea && <span className="error-text">{logFormErrors.excavationArea}</span>}
          </label>
          <label className="full-width">
            <span>主要发现 <span className="required">*</span></span>
            <textarea
              placeholder="详细描述当日的主要发掘发现"
              value={logFormData.mainFindings}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLogInputChange("mainFindings", e.target.value)}
              className={logFormErrors.mainFindings ? "input-error" : ""}
              rows={3}
            />
            {logFormErrors.mainFindings && <span className="error-text">{logFormErrors.mainFindings}</span>}
          </label>
          <label className="full-width">
            <span>待复核事项</span>
            <textarea
              placeholder="需要后续跟进或复核的事项（选填）"
              value={logFormData.pendingReview}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLogInputChange("pendingReview", e.target.value)}
              rows={2}
            />
          </label>
        </div>
      </section>

      <section className="panel excavation-timeline-section">
        <div className="section-heading">
          <div>
            <p>时间线</p>
            <h2>日志时间线</h2>
          </div>
          <div>共 {excavationLogs.length} 条</div>
        </div>
        <div className="timeline">
          {excavationLogs.length === 0 ? (
            <p className="empty-state">暂无发掘日志，请在上方表单录入</p>
          ) : (
            excavationLogs.map((log) => (
              <div key={log.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <div className="timeline-date">
                      <strong>{log.date}</strong>
                      <span className="weather-tag">{log.weather}</span>
                    </div>
                    <span className="timeline-area">{log.excavationArea}</span>
                  </div>
                  <div className="timeline-meta">
                    <span className="timeline-participants">👤 {log.participants}</span>
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-findings">
                      <h4>主要发现</h4>
                      <p>{log.mainFindings}</p>
                    </div>
                    {log.pendingReview && (
                      <div className="timeline-pending">
                        <h4>待复核事项</h4>
                        <p>{log.pendingReview}</p>
                      </div>
                    )}
                  </div>
                  <p className="record-time">{log.createdAt}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel stratum-relation-section">
        <div className="section-heading">
          <div>
            <p>地层关系</p>
            <h2>地层关系矩阵</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleRelationClear}>清空表单</button>
            <button className="primary-action" onClick={handleRelationSubmit}>新增关系</button>
          </div>
        </div>
        <div className="relation-type-hints">
          {relationTypeOptions.map(opt => (
            <div key={opt.value} className={`relation-hint relation-${opt.value}`}>
              <span className="relation-hint-label">{opt.label}</span>
              <span className="relation-hint-desc">{opt.description}</span>
            </div>
          ))}
        </div>
        <div className="field-grid relation-form-grid">
          <label>
            <span>地层A <span className="required">*</span></span>
            <input
              placeholder="如 第2层"
              value={relationFormData.stratumA}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRelationInputChange("stratumA", e.target.value)}
              className={relationFormErrors.stratumA ? "input-error" : ""}
            />
            {relationFormErrors.stratumA && <span className="error-text">{relationFormErrors.stratumA}</span>}
          </label>
          <label>
            <span>关系类型 <span className="required">*</span></span>
            <select
              value={relationFormData.relationType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRelationInputChange("relationType", e.target.value)}
              className={relationFormErrors.relationType ? "input-error" : ""}
            >
              <option value="">请选择关系类型</option>
              {relationTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}（A {opt.label} B）</option>
              ))}
            </select>
            {relationFormErrors.relationType && <span className="error-text">{relationFormErrors.relationType}</span>}
          </label>
          <label>
            <span>地层B <span className="required">*</span></span>
            <input
              placeholder="如 第3层"
              value={relationFormData.stratumB}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRelationInputChange("stratumB", e.target.value)}
              className={relationFormErrors.stratumB ? "input-error" : ""}
            />
            {relationFormErrors.stratumB && <span className="error-text">{relationFormErrors.stratumB}</span>}
          </label>
        </div>
        {relationFormErrors.conflict && (
          <div className="conflict-alert">
            <span className="conflict-icon">⚠</span>
            <span>{relationFormErrors.conflict}</span>
          </div>
        )}
        <div className="relation-list-header">
          <h3>关系列表</h3>
          <span className="relation-count">共 {stratumRelations.length} 条记录</span>
        </div>
        <div className="relation-list">
          {stratumRelations.length === 0 ? (
            <p className="empty-state">暂无地层关系记录，请在上方表单录入</p>
          ) : (
            stratumRelations.map((relation, index) => (
              <article key={relation.id} className="relation-card">
                <div className={`relation-index relation-index-${relation.relationType}`}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="relation-content">
                  <div className="relation-statement">
                    <span className="stratum-tag">{relation.stratumA}</span>
                    <span className={`relation-arrow relation-${relation.relationType}`}>
                      {getRelationLabel(relation.relationType)}
                    </span>
                    <span className="stratum-tag">{relation.stratumB}</span>
                  </div>
                  <div className="relation-inverse">
                    反向表述：<span className="stratum-tag">{relation.stratumB}</span>
                    <span className="relation-inverse-label">{getRelationInverseLabel(relation.relationType)}</span>
                    <span className="stratum-tag">{relation.stratumA}</span>
                  </div>
                  <p className="record-time">{relation.createdAt}</p>
                </div>
                <button className="relation-delete" onClick={() => handleDeleteRelation(relation.id)} title="删除此关系">
                  删除
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
