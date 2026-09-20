// 领域模型：洁净室巡检记录、版本链、复核状态与规则冲突

export type IsoClass = "ISO 5" | "ISO 6" | "ISO 7" | "ISO 8";

export type EquipmentStatus = "运行" | "待机" | "停机" | "检修";

export type ReviewStatus = "正常" | "待复核" | "已关闭";

export const EQUIPMENT_STATUSES: EquipmentStatus[] = ["运行", "待机", "停机", "检修"];

/** 本地落盘数据结构版本，结构变更时递增以触发冲突修复 */
export const SCHEMA_VERSION = 1;

/** 一次读数：巡检记录的最小数据单元 */
export interface Reading {
  isoClass: IsoClass; // 洁净等级（本次所选 ISO 等级）
  particleCount: number; // ≥0.5µm 粒子计数，个/m³
  pressureDiff: number; // 压差 Pa，负值为异常
  equipmentStatus: EquipmentStatus;
  handlingNote: string; // 处理备注
}

/** 版本链节点：每次保存/补录生成一个新版本，旧版本冻结保留 */
export interface RecordVersion {
  version: number;
  reading: Reading;
  reason: string; // 录入 / 补录原因
  createdAt: string;
  triggeredRules: RuleId[]; // 保存时触发的规则快照
}

/** 关闭点：记录在某个版本被关闭，该版本读数自此冻结 */
export interface Closure {
  version: number;
  at: string;
}

export interface InspectionRecord {
  id: string; // 房间编号
  room: string;
  area: string; // 功能区，如光刻间
  status: ReviewStatus;
  versions: RecordVersion[];
  closures: Closure[];
}

export type RuleId =
  | "PARTICLE_OVER_LIMIT" // 粒子计数超过所选 ISO 等级上限
  | "NEGATIVE_PRESSURE" // 压差为负
  | "CLOSE_REQUIRES_NOTE" // 关闭前必须补全处理备注
  | "CLOSE_REQUIRES_EQUIPMENT" // 关闭前设备状态须为停机或检修
  | "SUPPLEMENT_REQUIRES_REASON" // 已关闭记录的补录必须注明原因
  | "FROZEN_AFTER_CLOSE" // 关闭后原读数冻结，仅可补录新版本
  | "CHAIN_BROKEN" // 版本链断裂或缺失
  | "STATUS_INCONSISTENT" // 复核状态与读数不一致
  | "SCHEMA_MISMATCH"; // 本地数据版本不匹配

/** 规则冲突：违规操作或落盘数据修复时生成，可审计 */
export interface Conflict {
  id: string;
  room: string; // 房间
  field: string; // 读数项
  originalValue: string; // 原值
  newValue: string; // 新值
  rule: string; // 触发规则
  at: string;
}

/** 未保存草稿：按房间隔离存放，切换房间不串台 */
export interface DraftState {
  isoClass: IsoClass;
  particleCount: string;
  pressureDiff: string;
  equipmentStatus: EquipmentStatus;
  handlingNote: string;
  reason: string;
}

export interface PersistedState {
  schemaVersion: number;
  records: InspectionRecord[];
  conflicts: Conflict[];
  drafts: Record<string, DraftState>;
  savedAt: string;
}
