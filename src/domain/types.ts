// 领域模型：半导体洁净室巡检记录、版本链与复核状态

export const ISO_CLASSES = ["ISO 5", "ISO 6", "ISO 7", "ISO 8"] as const;
export type IsoClass = (typeof ISO_CLASSES)[number];

export const EQUIPMENT_STATUSES = ["运行", "停机", "检修"] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

/** 复核状态：正常 / 异常待复核 / 异常已关闭 */
export type ReviewStatus = "normal" | "pending" | "closed";

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  normal: "正常",
  pending: "异常待复核",
  closed: "异常已关闭",
};

/** 一次落盘的巡检读数（随版本链冻结） */
export interface Readings {
  isoClass: IsoClass;
  /** ≥0.5µm 粒子计数，个/m³ */
  particleCount: number;
  /** 相对相邻区域压差，Pa（可为负） */
  pressureDiff: number;
  equipmentStatus: EquipmentStatus;
  /** 处理备注 */
  note: string;
}

/** 版本链中的一个版本：读数 + 录入/补录原因 */
export interface RecordVersion {
  version: number;
  readings: Readings;
  reason: string;
  createdAt: string;
}

/** 巡检记录：房间维度，读数全部走版本链 */
export interface InspectionRecord {
  id: string;
  room: string;
  status: ReviewStatus;
  /** 关闭时冻结的版本号；补录产生新版本后自动失效 */
  closedVersion: number | null;
  versions: RecordVersion[];
}

/** 规则命中结果 */
export type RuleId = "particle-limit" | "negative-pressure";

export interface RuleHit {
  ruleId: RuleId;
  label: string;
  detail: string;
}

/** 落盘数据与规则冲突项 */
export interface Conflict {
  recordId: string;
  /** 房间 */
  room: string;
  /** 读数/字段 */
  field: string;
  /** 原值（落盘值） */
  storedValue: string;
  /** 新值（按规则推导） */
  expectedValue: string;
  /** 触发规则 */
  rule: string;
}
