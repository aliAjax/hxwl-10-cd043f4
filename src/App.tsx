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
  relicUnit?: string;
  quantity?: string;
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

interface BatchImportRow {
  rowNumber: number;
  trenchNumber: string;
  stratum: string;
  relicUnit: string;
  coordinatePoint: string;
  depth: string;
  artifactType: string;
  quantity: string;
}

interface ParsedImportResult {
  validRows: BatchImportRow[];
  errorRows: { row: BatchImportRow; errors: string[] }[];
}

const batchImportHeaders = [
  { key: "trenchNumber", label: "探方", required: true },
  { key: "stratum", label: "地层", required: true },
  { key: "relicUnit", label: "遗迹单位", required: false },
  { key: "coordinatePoint", label: "坐标点", required: true },
  { key: "depth", label: "深度", required: true },
  { key: "artifactType", label: "类型", required: true },
  { key: "quantity", label: "数量", required: true }
];

const HEADER_ALIASES: Record<string, string> = {
  "探方": "trenchNumber", "探方编号": "trenchNumber", "trench": "trenchNumber", "trenchnumber": "trenchNumber",
  "地层": "stratum", "层位": "stratum", "stratum": "stratum",
  "遗迹单位": "relicUnit", "遗迹": "relicUnit", "relic": "relicUnit", "relicunit": "relicUnit",
  "坐标点": "coordinatePoint", "坐标": "coordinatePoint", "coordinate": "coordinatePoint", "coordinates": "coordinatePoint",
  "深度": "depth", "depth": "depth",
  "类型": "artifactType", "出土物类型": "artifactType", "type": "artifactType", "artifacttype": "artifactType",
  "数量": "quantity", "件数": "quantity", "qty": "quantity", "quantity": "quantity"
};

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

const initialArtifactRecords: ArtifactRecord[] = [
  {
    id: 1001,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "陶片",
    eCoordinate: "3.25",
    nCoordinate: "4.50",
    depth: "0.85m",
    remarks: "绳纹陶片，可辨器形有鬲口沿",
    createdAt: "2024/6/17 09:20:00",
    quantity: "12"
  },
  {
    id: 1002,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "石器",
    eCoordinate: "1.80",
    nCoordinate: "2.35",
    depth: "0.92m",
    remarks: "石斧残件，磨制精细",
    createdAt: "2024/6/17 09:45:00",
    quantity: "1"
  },
  {
    id: 1003,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "骨器",
    eCoordinate: "4.10",
    nCoordinate: "1.20",
    depth: "0.78m",
    remarks: "骨簪一枚，保存较好",
    createdAt: "2024/6/17 10:10:00",
    quantity: "1"
  },
  {
    id: 1004,
    trenchNumber: "T0203",
    stratum: "第2层",
    artifactType: "陶片",
    eCoordinate: "2.55",
    nCoordinate: "3.80",
    depth: "0.45m",
    remarks: "泥质灰陶，素面",
    createdAt: "2024/6/17 10:35:00",
    quantity: "5"
  },
  {
    id: 1005,
    trenchNumber: "T0203",
    stratum: "第2层",
    artifactType: "瓷器",
    eCoordinate: "5.00",
    nCoordinate: "5.00",
    depth: "0.32m",
    remarks: "青花瓷片，明清时期",
    createdAt: "2024/6/17 11:00:00",
    quantity: "2"
  },
  {
    id: 1006,
    trenchNumber: "T0204",
    stratum: "H12灰坑",
    artifactType: "动植物遗存",
    eCoordinate: "2.10",
    nCoordinate: "3.40",
    depth: "1.25m",
    remarks: "炭化粟粒，需浮选鉴定",
    createdAt: "2024/6/17 14:15:00",
    relicUnit: "H12",
    quantity: "大量"
  },
  {
    id: 1007,
    trenchNumber: "T0204",
    stratum: "H12灰坑",
    artifactType: "骨器",
    eCoordinate: "3.75",
    nCoordinate: "2.60",
    depth: "1.38m",
    remarks: "动物骨骼碎片，疑似猪骨",
    createdAt: "2024/6/17 14:40:00",
    relicUnit: "H12",
    quantity: "8"
  },
  {
    id: 1008,
    trenchNumber: "T0204",
    stratum: "H12灰坑",
    artifactType: "陶片",
    eCoordinate: "4.50",
    nCoordinate: "4.20",
    depth: "1.15m",
    remarks: "夹砂褐陶，绳纹",
    createdAt: "2024/6/17 15:05:00",
    relicUnit: "H12",
    quantity: "20"
  },
  {
    id: 1009,
    trenchNumber: "T0204",
    stratum: "第2层",
    artifactType: "铁器",
    eCoordinate: "1.25",
    nCoordinate: "1.80",
    depth: "0.38m",
    remarks: "铁钉，锈蚀严重",
    createdAt: "2024/6/17 15:30:00",
    quantity: "3"
  },
  {
    id: 1010,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "陶片",
    eCoordinate: "",
    nCoordinate: "3.50",
    depth: "0.60m",
    remarks: "缺少E坐标，坐标待补测",
    createdAt: "2024/6/17 16:00:00",
    relicUnit: "F2",
    quantity: "4"
  },
  {
    id: 1011,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "石器",
    eCoordinate: "2.90",
    nCoordinate: "abc",
    depth: "0.65m",
    remarks: "N坐标格式错误",
    createdAt: "2024/6/17 16:20:00",
    relicUnit: "F2",
    quantity: "1"
  },
  {
    id: 1012,
    trenchNumber: "T0203",
    stratum: "第3层",
    artifactType: "其他",
    eCoordinate: "",
    nCoordinate: "",
    depth: "0.80m",
    remarks: "未记录坐标点",
    createdAt: "2024/6/17 16:45:00",
    quantity: "1"
  },
  {
    id: 1013,
    trenchNumber: "T0204",
    stratum: "第3层",
    artifactType: "陶片",
    eCoordinate: "E2.80",
    nCoordinate: "N3.15",
    depth: "0.72m",
    remarks: "带E/N前缀的坐标（应正常识别）",
    createdAt: "2024/6/17 17:10:00",
    quantity: "8"
  },
  {
    id: 1014,
    trenchNumber: "T0204",
    stratum: "第3层",
    artifactType: "石器",
    eCoordinate: "4.20m",
    nCoordinate: "1.50m",
    depth: "0.95m",
    remarks: "带m单位后缀的坐标（应正常识别）",
    createdAt: "2024/6/17 17:30:00",
    quantity: "2"
  },
  {
    id: 1015,
    trenchNumber: "T0204",
    stratum: "第3层",
    artifactType: "骨器",
    eCoordinate: "E0.85m",
    nCoordinate: "N2.40m",
    depth: "0.68m",
    remarks: "同时带E/N前缀和m单位后缀（应正常识别）",
    createdAt: "2024/6/17 17:50:00",
    quantity: "1"
  },
  {
    id: 1016,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "陶片",
    eCoordinate: "X3.50",
    nCoordinate: "N2.10",
    depth: "0.55m",
    remarks: "E坐标前缀X不是有效坐标标识（应标记异常）",
    createdAt: "2024/6/17 18:10:00",
    relicUnit: "F2",
    quantity: "3"
  },
  {
    id: 1017,
    trenchNumber: "T0301",
    stratum: "F2房址",
    artifactType: "瓷器",
    eCoordinate: "E1.75",
    nCoordinate: "Y4.20",
    depth: "0.48m",
    remarks: "N坐标前缀Y不是有效坐标标识（应标记异常）",
    createdAt: "2024/6/17 18:30:00",
    relicUnit: "F2",
    quantity: "1"
  },
  {
    id: 1018,
    trenchNumber: "T0203",
    stratum: "第2层",
    artifactType: "铁器",
    eCoordinate: "3.00xyz",
    nCoordinate: "N3.50",
    depth: "0.30m",
    remarks: "E坐标后缀xyz不是有效单位（应标记异常）",
    createdAt: "2024/6/17 18:50:00",
    quantity: "2"
  }
];

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

const parseNumber = (value: string): number | null => {
  if (!value || value.trim() === "") return null;
  const clean = value.trim();
  const match = clean.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return isNaN(num) ? null : num;
};

const COORD_PREFIXES = new Set(["e", "n", "w", "s", "东", "北", "西", "南"]);
const COORD_SUFFIXES = new Set(["m", "cm", "mm", "米", "厘米", "毫米"]);

const isValidCoordinateFormat = (value: string): { valid: boolean; extracted: number | null; reason?: string } => {
  if (!value || value.trim() === "") {
    return { valid: false, extracted: null, reason: "坐标为空" };
  }
  const clean = value.trim();
  const numMatch = clean.match(/-?\d+(\.\d+)?/);
  if (!numMatch) {
    return { valid: false, extracted: null, reason: "未找到有效数字" };
  }
  const numStr = numMatch[0];
  const num = parseFloat(numStr);
  const numStart = numMatch.index || 0;
  const numEnd = numStart + numStr.length;
  const prefix = clean.slice(0, numStart).trim().toLowerCase();
  const suffix = clean.slice(numEnd).trim().toLowerCase();

  if (prefix && !COORD_PREFIXES.has(prefix)) {
    return { valid: false, extracted: num, reason: `前缀"${prefix}"不是有效的坐标标识` };
  }
  if (suffix && !COORD_SUFFIXES.has(suffix)) {
    return { valid: false, extracted: num, reason: `后缀"${suffix}"不是有效的单位标识` };
  }
  return { valid: true, extracted: num };
};

interface ValidatedArtifactRecord extends ArtifactRecord {
  eValue: number | null;
  nValue: number | null;
  isCoordinateValid: boolean;
  coordinateError?: string;
}

const validateRecordCoordinates = (record: ArtifactRecord): ValidatedArtifactRecord => {
  const eCheck = isValidCoordinateFormat(record.eCoordinate);
  const nCheck = isValidCoordinateFormat(record.nCoordinate);
  const eValue = eCheck.extracted;
  const nValue = nCheck.extracted;
  let isCoordinateValid = true;
  let coordinateError: string | undefined;

  const eEmpty = !record.eCoordinate || record.eCoordinate.trim() === "";
  const nEmpty = !record.nCoordinate || record.nCoordinate.trim() === "";

  if (eEmpty && nEmpty) {
    isCoordinateValid = false;
    coordinateError = "E和N坐标均为空";
  } else if (eEmpty) {
    isCoordinateValid = false;
    coordinateError = "E坐标为空";
  } else if (nEmpty) {
    isCoordinateValid = false;
    coordinateError = "N坐标为空";
  } else if (!eCheck.valid && !nCheck.valid) {
    isCoordinateValid = false;
    coordinateError = `E坐标${eCheck.reason}，N坐标${nCheck.reason}`;
  } else if (!eCheck.valid) {
    isCoordinateValid = false;
    coordinateError = `E坐标${eCheck.reason}`;
  } else if (!nCheck.valid) {
    isCoordinateValid = false;
    coordinateError = `N坐标${nCheck.reason}`;
  } else if (eValue !== null && nValue !== null && (eValue < 0 || nValue < 0)) {
    isCoordinateValid = false;
    coordinateError = "坐标不能为负数";
  }

  return { ...record, eValue, nValue, isCoordinateValid, coordinateError };
};

const artifactTypeColors: Record<string, string> = {
  "陶片": "#854d0e",
  "石器": "#475569",
  "骨器": "#92400e",
  "青铜器": "#ca8a04",
  "瓷器": "#0891b2",
  "铁器": "#78716c",
  "动植物遗存": "#16a34a",
  "其他": "#db2777"
};

const getArtifactTypeColor = (type: string): string => {
  return artifactTypeColors[type] || "#6b7280";
};

function App() {
  const [artifactRecords, setArtifactRecords] = useState<ArtifactRecord[]>(initialArtifactRecords);
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

  const [gridTrenchFilter, setGridTrenchFilter] = useState<string>("");
  const [gridStratumFilter, setGridStratumFilter] = useState<string>("");
  const [hoveredPoint, setHoveredPoint] = useState<ValidatedArtifactRecord | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
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

  const [batchCsvText, setBatchCsvText] = useState<string>("");
  const [batchParseResult, setBatchParseResult] = useState<ParsedImportResult | null>(null);
  const [batchParseError, setBatchParseError] = useState<string>("");

  const values = project.metrics.map((metric: string, index: number) => {
    const base = [84, 12, 31, 7][index % 4];
    if (metric === "出土物") {
      return String(base + index * 3 + artifactRecords.length);
    }
    return String(base + index * 3);
  });

  const validatedRecords: ValidatedArtifactRecord[] = artifactRecords.map(validateRecordCoordinates);

  const availableGridTrenches: string[] = Array.from(
    new Set(validatedRecords.map(r => r.trenchNumber).filter(Boolean))
  ).sort();

  const defaultTrench = availableGridTrenches.length > 0 ? availableGridTrenches[0] : "";
  const actualTrenchFilter = gridTrenchFilter || defaultTrench;

  const availableGridStrata: string[] = Array.from(
    new Set(
      validatedRecords
        .filter(r => !actualTrenchFilter || r.trenchNumber === actualTrenchFilter)
        .map(r => r.stratum)
        .filter(Boolean)
    )
  ).sort();

  const effectiveStratumFilter = availableGridStrata.includes(gridStratumFilter)
    ? gridStratumFilter
    : "";
  const defaultStratum = availableGridStrata.length > 0 ? availableGridStrata[0] : "";
  const actualStratumFilter = effectiveStratumFilter || defaultStratum;

  const gridFilteredRecords: ValidatedArtifactRecord[] = validatedRecords.filter(r => {
    const matchTrench = !actualTrenchFilter || r.trenchNumber === actualTrenchFilter;
    const matchStratum = !actualStratumFilter || r.stratum === actualStratumFilter;
    return matchTrench && matchStratum;
  });

  const validGridPoints = gridFilteredRecords.filter(r => r.isCoordinateValid);
  const invalidGridRecords = gridFilteredRecords.filter(r => !r.isCoordinateValid);

  const gridMaxE = validGridPoints.length > 0
    ? Math.max(...validGridPoints.map(r => r.eValue!).filter(v => v !== null && !isNaN(v)), 5)
    : 5;
  const gridMaxN = validGridPoints.length > 0
    ? Math.max(...validGridPoints.map(r => r.nValue!).filter(v => v !== null && !isNaN(v)), 5)
    : 5;

  const GRID_CELL_SIZE = 60;
  const GRID_PADDING = 40;
  const gridCols = Math.ceil(gridMaxE) + 1;
  const gridRows = Math.ceil(gridMaxN) + 1;
  const gridWidth = gridCols * GRID_CELL_SIZE + GRID_PADDING * 2;
  const gridHeight = gridRows * GRID_CELL_SIZE + GRID_PADDING * 2;

  const mapPointToGrid = (e: number, n: number): { x: number; y: number } => {
    return {
      x: GRID_PADDING + e * GRID_CELL_SIZE,
      y: GRID_PADDING + (gridRows - 1 - n) * GRID_CELL_SIZE
    };
  };

  const handleGridPointHover = (
    e: React.MouseEvent<HTMLDivElement>,
    record: ValidatedArtifactRecord | null
  ) => {
    if (record) {
      const rect = (e.currentTarget.closest(".grid-container") as HTMLElement).getBoundingClientRect();
      setHoveredPoint(record);
      setHoverPosition({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    } else {
      setHoveredPoint(null);
      setHoverPosition(null);
    }
  };

  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hoveredPoint) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHoverPosition({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    }
  };

  const handleGridTrenchChange = (value: string) => {
    setGridTrenchFilter(value);
    setGridStratumFilter("");
  };

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

  const availableStrata = (): string[] => {
    const strataSet = new Set<string>();
    stratumRelations.forEach(r => {
      if (r.stratumA) strataSet.add(r.stratumA);
      if (r.stratumB) strataSet.add(r.stratumB);
    });
    artifactRecords.forEach(r => {
      if (r.stratum) strataSet.add(r.stratum);
    });
    project.records.forEach(record => {
      if (record[1]) strataSet.add(record[1]);
    });
    return Array.from(strataSet).sort();
  };

  const strataOptions = availableStrata();

  const checkDuplicateRelation = (a: string, b: string, type: RelationType, excludeId?: number): boolean => {
    return stratumRelations.some(r => {
      if (excludeId && r.id === excludeId) return false;
      const sameDirection = r.stratumA === a && r.stratumB === b && r.relationType === type;
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
      if (type === "contains" && r.relationType === "contains") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 包含 ${a}"，不能同时存在 "${a} 包含 ${b}"`
          };
        }
      }
      if (type === "breaks" && r.relationType === "earlier") {
        if (r.stratumA === a && r.stratumB === b) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${a} 早于 ${b}"，不能同时存在 "${a} 打破 ${b}"（打破意味着年代更晚）`
          };
        }
      }
      if (type === "earlier" && r.relationType === "breaks") {
        if (r.stratumA === a && r.stratumB === b) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${a} 打破 ${b}"，不能同时存在 "${a} 早于 ${b}"（打破意味着年代更晚）`
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
      if (type === "earlier" && r.relationType === "earlier") {
        if (r.stratumA === b && r.stratumB === a) {
          return {
            hasConflict: true,
            message: `矛盾：已存在 "${b} 早于 ${a}"，不能同时存在 "${a} 早于 ${b}"`
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

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const normalizeHeader = (header: string): string | null => {
    const trimmed = header.trim().toLowerCase();
    for (const [alias, key] of Object.entries(HEADER_ALIASES)) {
      if (alias.toLowerCase() === trimmed || trimmed === key.toLowerCase()) {
        return key;
      }
    }
    return null;
  };

  const parseCoordinate = (coord: string): { eCoordinate: string; nCoordinate: string } => {
    const clean = coord.trim().toUpperCase();
    const eMatch = clean.match(/E\s*([\d.]+)/);
    const nMatch = clean.match(/N\s*([\d.]+)/);
    if (eMatch && nMatch) {
      return { eCoordinate: eMatch[1], nCoordinate: nMatch[1] };
    }
    const parts = clean.split(/[\s,，、]+/).filter(Boolean);
    if (parts.length >= 2) {
      return { eCoordinate: parts[0], nCoordinate: parts[1] };
    }
    return { eCoordinate: "", nCoordinate: "" };
  };

  const validateBatchRow = (row: BatchImportRow): string[] => {
    const errors: string[] = [];
    if (!row.trenchNumber.trim()) errors.push("探方不能为空");
    if (!row.stratum.trim()) errors.push("地层不能为空");
    if (!row.coordinatePoint.trim()) {
      errors.push("坐标点不能为空");
    } else {
      const { eCoordinate, nCoordinate } = parseCoordinate(row.coordinatePoint);
      if (!eCoordinate || !nCoordinate) errors.push("坐标点格式无效，需包含E和N坐标（如 E3.25 N4.50）");
    }
    if (!row.depth.trim()) errors.push("深度不能为空");
    if (!row.artifactType.trim()) {
      errors.push("类型不能为空");
    } else if (!artifactTypes.includes(row.artifactType.trim())) {
      errors.push(`类型必须是：${artifactTypes.join("、")} 之一`);
    }
    if (!row.quantity.trim()) {
      errors.push("数量不能为空");
    } else if (!/^\d+$/.test(row.quantity.trim()) || parseInt(row.quantity.trim()) <= 0) {
      errors.push("数量必须是正整数");
    }
    return errors;
  };

  const handleBatchParse = () => {
    setBatchParseError("");
    setBatchParseResult(null);
    const text = batchCsvText.trim();
    if (!text) {
      setBatchParseError("请粘贴CSV文本内容");
      return;
    }
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setBatchParseError("CSV内容至少需要表头行和一行数据");
      return;
    }
    const headerLine = lines[0];
    const rawHeaders = parseCsvLine(headerLine);
    const mappedHeaders: (string | null)[] = rawHeaders.map(h => normalizeHeader(h));
    const missingRequired = batchImportHeaders.filter(h => h.required).filter(
      req => !mappedHeaders.includes(req.key)
    );
    if (missingRequired.length > 0) {
      setBatchParseError(`缺少必要列：${missingRequired.map(h => h.label).join("、")}。请检查表头是否正确。`);
      return;
    }
    const headerIndexMap: Record<string, number> = {};
    mappedHeaders.forEach((key, idx) => {
      if (key) headerIndexMap[key] = idx;
    });
    const validRows: BatchImportRow[] = [];
    const errorRows: { row: BatchImportRow; errors: string[] }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rawValues = parseCsvLine(lines[i]);
      const rowNumber = i + 1;
      const row: BatchImportRow = {
        rowNumber,
        trenchNumber: rawValues[headerIndexMap["trenchNumber"]] ?? "",
        stratum: rawValues[headerIndexMap["stratum"]] ?? "",
        relicUnit: rawValues[headerIndexMap["relicUnit"]] ?? "",
        coordinatePoint: rawValues[headerIndexMap["coordinatePoint"]] ?? "",
        depth: rawValues[headerIndexMap["depth"]] ?? "",
        artifactType: rawValues[headerIndexMap["artifactType"]] ?? "",
        quantity: rawValues[headerIndexMap["quantity"]] ?? ""
      };
      const errors = validateBatchRow(row);
      if (errors.length === 0) {
        validRows.push(row);
      } else {
        errorRows.push({ row, errors });
      }
    }
    setBatchParseResult({ validRows, errorRows });
  };

  const handleBatchConfirm = () => {
    if (!batchParseResult || batchParseResult.validRows.length === 0) return;
    const now = new Date().toLocaleString("zh-CN");
    const newRecords: ArtifactRecord[] = batchParseResult.validRows.map((row, idx) => {
      const coords = parseCoordinate(row.coordinatePoint);
      return {
        id: Date.now() + idx,
        trenchNumber: row.trenchNumber.trim(),
        stratum: row.stratum.trim(),
        artifactType: row.artifactType.trim(),
        eCoordinate: coords.eCoordinate,
        nCoordinate: coords.nCoordinate,
        depth: row.depth.trim(),
        remarks: "",
        createdAt: now,
        relicUnit: row.relicUnit.trim() || undefined,
        quantity: row.quantity.trim()
      };
    });
    setArtifactRecords(prev => [...newRecords, ...prev]);
    handleBatchClear();
  };

  const handleBatchClear = () => {
    setBatchCsvText("");
    setBatchParseResult(null);
    setBatchParseError("");
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

      <section className="panel batch-import-section">
        <div className="section-heading">
          <div>
            <p>批量录入</p>
            <h2>出土物批量导入预览</h2>
          </div>
          <div className="form-actions">
            <button onClick={handleBatchClear}>清空内容</button>
            <button className="primary-action" onClick={handleBatchParse}>解析预览</button>
          </div>
        </div>
        <div className="batch-import-hint">
          <p>
            <strong>使用说明：</strong>
            请在下方粘贴 CSV 格式文本，首行为表头。必填字段：<span className="required-field">探方、地层、坐标点、深度、类型、数量</span>；可选字段：遗迹单位。
            坐标点格式示例：<code>E3.25 N4.50</code> 或 <code>3.25,4.50</code>。
          </p>
          <p className="csv-example">
            <strong>示例CSV：</strong>
            <code>探方,地层,遗迹单位,坐标点,深度,类型,数量
T0203,第3层,H12,E3.25 N4.50,0.85m,陶片,12
T0204,第2层,,E1.10 N2.30,0.42m,石器,3</code>
          </p>
        </div>
        <label className="full-width">
          <span>CSV 文本粘贴区 <span className="required">*</span></span>
          <textarea
            className="batch-textarea"
            placeholder="在此粘贴CSV文本，第一行为表头..."
            value={batchCsvText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchCsvText(e.target.value)}
            rows={8}
          />
        </label>
        {batchParseError && (
          <div className="batch-alert batch-alert-error">
            <span className="conflict-icon">✕</span>
            <span>{batchParseError}</span>
          </div>
        )}
        {batchParseResult && (
          <div className="batch-preview-area">
            <div className="batch-summary">
              <div className="summary-item summary-valid">
                <span className="summary-count">{batchParseResult.validRows.length}</span>
                <span className="summary-label">条有效记录</span>
              </div>
              <div className="summary-item summary-error">
                <span className="summary-count">{batchParseResult.errorRows.length}</span>
                <span className="summary-label">条错误记录</span>
              </div>
              <div className="summary-actions">
                <button
                  className="primary-action batch-confirm-btn"
                  onClick={handleBatchConfirm}
                  disabled={batchParseResult.validRows.length === 0}
                >
                  确认导入 {batchParseResult.validRows.length} 条有效记录
                </button>
              </div>
            </div>
            {batchParseResult.validRows.length > 0 && (
              <div className="preview-table-wrapper">
                <div className="preview-table-title">
                  <h3>✓ 有效数据预览（将被导入）</h3>
                </div>
                <div className="table-scroll">
                  <table className="preview-table preview-table-valid">
                    <thead>
                      <tr>
                        <th>行号</th>
                        {batchImportHeaders.map(h => (
                          <th key={h.key}>
                            {h.label}
                            {h.required && <span className="required">*</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchParseResult.validRows.map((row) => (
                        <tr key={`valid-${row.rowNumber}`}>
                          <td className="row-num">{row.rowNumber}</td>
                          <td>{row.trenchNumber}</td>
                          <td>{row.stratum}</td>
                          <td>{row.relicUnit || <span className="cell-muted">—</span>}</td>
                          <td>{row.coordinatePoint}</td>
                          <td>{row.depth}</td>
                          <td>
                            <span className="type-badge">{row.artifactType}</span>
                          </td>
                          <td className="qty-cell">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {batchParseResult.errorRows.length > 0 && (
              <div className="preview-table-wrapper">
                <div className="preview-table-title">
                  <h3 className="error-title">⚠ 错误数据摘要（将被忽略）</h3>
                </div>
                <div className="table-scroll">
                  <table className="preview-table preview-table-error">
                    <thead>
                      <tr>
                        <th>行号</th>
                        {batchImportHeaders.map(h => (
                          <th key={h.key}>{h.label}</th>
                        ))}
                        <th>错误信息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchParseResult.errorRows.map(({ row, errors }) => (
                        <tr key={`err-${row.rowNumber}`}>
                          <td className="row-num row-num-error">{row.rowNumber}</td>
                          <td>{row.trenchNumber || <span className="cell-muted">—</span>}</td>
                          <td>{row.stratum || <span className="cell-muted">—</span>}</td>
                          <td>{row.relicUnit || <span className="cell-muted">—</span>}</td>
                          <td>{row.coordinatePoint || <span className="cell-muted">—</span>}</td>
                          <td>{row.depth || <span className="cell-muted">—</span>}</td>
                          <td>{row.artifactType || <span className="cell-muted">—</span>}</td>
                          <td>{row.quantity || <span className="cell-muted">—</span>}</td>
                          <td className="error-cell">
                            <ul>
                              {errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel coordinate-view-section">
        <div className="section-heading">
          <div>
            <p>可视化</p>
            <h2>探方平面坐标视图</h2>
          </div>
          <div className="coordinate-view-summary">
            <span className="summary-badge valid">
              有效点位 {validGridPoints.length}
            </span>
            <span className="summary-badge invalid">
              异常记录 {invalidGridRecords.length}
            </span>
          </div>
        </div>

        <div className="coordinate-view-body">
          <div className="coordinate-view-main">
            <div className="grid-filters">
              <label className="grid-filter-item">
                <span>探方编号</span>
                <select
                  value={actualTrenchFilter}
                  onChange={(e) => handleGridTrenchChange(e.target.value)}
                >
                  <option value="">全部探方</option>
                  {availableGridTrenches.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="grid-filter-item">
                <span>地层</span>
                <select
                  value={actualStratumFilter}
                  onChange={(e) => setGridStratumFilter(e.target.value)}
                >
                  <option value="">全部地层</option>
                  {availableGridStrata.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="grid-legend">
                <span className="legend-label">图例：</span>
                {artifactTypes.map(type => (
                  <span key={type} className="legend-item">
                    <i className="legend-dot" style={{ background: getArtifactTypeColor(type) }} />
                    {type}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="grid-container"
              onMouseMove={handleGridMouseMove}
              onMouseLeave={() => { setHoveredPoint(null); setHoverPosition(null); }}
            >
              {actualTrenchFilter ? (
                <div className="grid-wrapper" style={{ width: gridWidth, height: gridHeight }}>
                  {Array.from({ length: gridRows }).map((_, rowIdx) => (
                    Array.from({ length: gridCols }).map((_, colIdx) => {
                      const n = gridRows - 1 - rowIdx;
                      const e = colIdx;
                      return (
                        <div
                          key={`cell-${e}-${n}`}
                          className="grid-cell"
                          style={{
                            left: GRID_PADDING + colIdx * GRID_CELL_SIZE,
                            top: GRID_PADDING + rowIdx * GRID_CELL_SIZE,
                            width: GRID_CELL_SIZE,
                            height: GRID_CELL_SIZE
                          }}
                        />
                      );
                    })
                  ))}

                  {Array.from({ length: gridCols }).map((_, e) => (
                    <span
                      key={`e-label-${e}`}
                      className="grid-axis-label grid-axis-e"
                      style={{
                        left: GRID_PADDING + e * GRID_CELL_SIZE + GRID_CELL_SIZE / 2,
                        bottom: 12
                      }}
                    >
                      E{e}
                    </span>
                  ))}
                  {Array.from({ length: gridRows }).map((_, i) => {
                    const n = gridRows - 1 - i;
                    return (
                      <span
                        key={`n-label-${n}`}
                        className="grid-axis-label grid-axis-n"
                        style={{
                          left: 12,
                          top: GRID_PADDING + i * GRID_CELL_SIZE + GRID_CELL_SIZE / 2
                        }}
                      >
                        N{n}
                      </span>
                    );
                  })}

                  <div className="grid-origin-label" style={{ left: 8, bottom: 8 }}>
                    ← 西南角 (原点)
                  </div>

                  {validGridPoints.map((record) => {
                    const pos = mapPointToGrid(record.eValue!, record.nValue!);
                    return (
                      <div
                        key={`point-${record.id}`}
                        className="grid-point"
                        style={{
                          left: pos.x,
                          top: pos.y,
                          background: getArtifactTypeColor(record.artifactType),
                          boxShadow: `0 0 0 3px ${getArtifactTypeColor(record.artifactType)}40`
                        }}
                        onMouseEnter={(e) => handleGridPointHover(e, record)}
                        onMouseLeave={(e) => handleGridPointHover(e, null)}
                      />
                    );
                  })}

                  {hoveredPoint && hoverPosition && (
                    <div
                      className="grid-tooltip"
                      style={{
                        left: Math.min(hoverPosition.x, gridWidth - 240),
                        top: Math.min(hoverPosition.y, gridHeight - 160)
                      }}
                    >
                      <div className="tooltip-header">
                        <i
                          className="tooltip-color-dot"
                          style={{ background: getArtifactTypeColor(hoveredPoint.artifactType) }}
                        />
                        <strong>{hoveredPoint.artifactType}</strong>
                        {hoveredPoint.quantity && (
                          <span className="tooltip-qty">×{hoveredPoint.quantity}</span>
                        )}
                      </div>
                      <div className="tooltip-row">
                        <span>探方</span>
                        <strong>{hoveredPoint.trenchNumber}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>地层</span>
                        <strong>{hoveredPoint.stratum}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>坐标</span>
                        <strong>E{hoveredPoint.eCoordinate} · N{hoveredPoint.nCoordinate}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>深度</span>
                        <strong>{hoveredPoint.depth}</strong>
                      </div>
                      {hoveredPoint.relicUnit && (
                        <div className="tooltip-row">
                          <span>遗迹</span>
                          <strong>{hoveredPoint.relicUnit}</strong>
                        </div>
                      )}
                      {hoveredPoint.remarks && (
                        <div className="tooltip-remarks">
                          <span>备注</span>
                          <p>{hoveredPoint.remarks}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid-empty">
                  <div className="grid-empty-icon">📐</div>
                  <p>请先选择探方编号以查看平面坐标分布</p>
                  {availableGridTrenches.length > 0 && (
                    <div className="grid-empty-trenches">
                      <span>可选探方：</span>
                      {availableGridTrenches.map(t => (
                        <button
                          key={t}
                          className="trench-quick-btn"
                          onClick={() => handleGridTrenchChange(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="anomaly-list-panel">
            <div className="anomaly-list-header">
              <h3>
                <span className="anomaly-icon">⚠</span>
                异常记录清单
              </h3>
              <span className="anomaly-count">{invalidGridRecords.length} 条</span>
            </div>
            {invalidGridRecords.length === 0 ? (
              <div className="anomaly-empty">
                <p>🎉 当前筛选条件下无异常记录</p>
                <p className="anomaly-empty-hint">所有出土物坐标均有效</p>
              </div>
            ) : (
              <div className="anomaly-list">
                {invalidGridRecords.map((record, idx) => (
                  <article key={`anomaly-${record.id}`} className="anomaly-card">
                    <div className="anomaly-index">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="anomaly-content">
                      <div className="anomaly-title">
                        <span className="type-badge">{record.artifactType}</span>
                        <strong className="anomaly-id">#{record.id}</strong>
                      </div>
                      <p className="anomaly-meta">
                        {record.trenchNumber} · {record.stratum}
                      </p>
                      <div className="anomaly-coords">
                        <span className={record.eValue !== null ? "coord-ok" : "coord-bad"}>
                          E: {record.eCoordinate || "空"}
                        </span>
                        <span className={record.nValue !== null ? "coord-ok" : "coord-bad"}>
                          N: {record.nCoordinate || "空"}
                        </span>
                      </div>
                      <div className="anomaly-error">
                        <span className="error-icon">!</span>
                        {record.coordinateError}
                      </div>
                      {record.remarks && (
                        <p className="anomaly-remarks">备注：{record.remarks}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
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
                    <h3>
                      {record.trenchNumber} · {record.artifactType}
                      {record.quantity && <span className="qty-tag">×{record.quantity}</span>}
                    </h3>
                    <p>
                      地层：{record.stratum}
                      {record.relicUnit && ` · 遗迹：${record.relicUnit}`}
                      {" · 坐标：E"}{record.eCoordinate} N{record.nCoordinate} · 深度：{record.depth}
                    </p>
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
              list="stratum-options-a"
              placeholder="选择或输入地层名称"
              value={relationFormData.stratumA}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRelationInputChange("stratumA", e.target.value)}
              className={relationFormErrors.stratumA ? "input-error" : ""}
            />
            <datalist id="stratum-options-a">
              {strataOptions.map(s => (
                <option key={`a-${s}`} value={s} />
              ))}
            </datalist>
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
              list="stratum-options-b"
              placeholder="选择或输入地层名称"
              value={relationFormData.stratumB}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRelationInputChange("stratumB", e.target.value)}
              className={relationFormErrors.stratumB ? "input-error" : ""}
            />
            <datalist id="stratum-options-b">
              {strataOptions.map(s => (
                <option key={`b-${s}`} value={s} />
              ))}
            </datalist>
            {relationFormErrors.stratumB && <span className="error-text">{relationFormErrors.stratumB}</span>}
          </label>
        </div>
        {strataOptions.length > 0 && (
          <div className="stratum-chips">
            <span className="stratum-chips-label">已有地层：</span>
            {strataOptions.map(s => (
              <button
                key={s}
                type="button"
                className="stratum-chip"
                onClick={() => {
                  if (!relationFormData.stratumA) {
                    handleRelationInputChange("stratumA", s);
                  } else if (!relationFormData.stratumB && relationFormData.stratumA !== s) {
                    handleRelationInputChange("stratumB", s);
                  } else if (relationFormData.stratumA && !relationFormData.stratumB && relationFormData.stratumA === s) {
                  } else {
                    handleRelationInputChange("stratumA", s);
                  }
                }}
                title="点击快速选择地层"
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
