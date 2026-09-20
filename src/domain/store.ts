// 落盘：localStorage 持久化，加载时做结构校验与规则冲突检测

import { type Draft } from "./draft";
import { detectConflicts } from "./rules";
import { seedRecords } from "./seed";
import {
  EQUIPMENT_STATUSES,
  ISO_CLASSES,
  type Conflict,
  type EquipmentStatus,
  type InspectionRecord,
  type IsoClass,
  type Readings,
  type RecordVersion,
  type ReviewStatus,
} from "./types";

const STORAGE_KEY = "hxwl-09.cleanroom.v1";

export interface LoadedState {
  records: InspectionRecord[];
  drafts: Record<string, Draft>;
  conflicts: Conflict[];
  /** seed=首次运行 / storage=正常恢复 / recovered=数据损坏已回退示例 */
  source: "seed" | "storage" | "recovered";
}

function isIsoClass(value: unknown): value is IsoClass {
  return typeof value === "string" && (ISO_CLASSES as readonly string[]).includes(value);
}

function isEquipmentStatus(value: unknown): value is EquipmentStatus {
  return (
    typeof value === "string" && (EQUIPMENT_STATUSES as readonly string[]).includes(value)
  );
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === "normal" || value === "pending" || value === "closed";
}

function sanitizeReadings(value: unknown): Readings {
  if (typeof value !== "object" || value === null) throw new Error("读数缺失");
  const raw = value as Record<string, unknown>;
  const particleCount = Number(raw.particleCount);
  const pressureDiff = Number(raw.pressureDiff);
  if (!Number.isFinite(particleCount) || particleCount < 0) throw new Error("粒子计数非法");
  if (!Number.isFinite(pressureDiff)) throw new Error("压差非法");
  if (!isIsoClass(raw.isoClass)) throw new Error("洁净等级非法");
  if (!isEquipmentStatus(raw.equipmentStatus)) throw new Error("设备状态非法");
  return {
    isoClass: raw.isoClass,
    particleCount,
    pressureDiff,
    equipmentStatus: raw.equipmentStatus,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

function sanitizeVersion(value: unknown): RecordVersion {
  if (typeof value !== "object" || value === null) throw new Error("版本缺失");
  const raw = value as Record<string, unknown>;
  const version = Number(raw.version);
  if (!Number.isInteger(version) || version < 1) throw new Error("版本号非法");
  return {
    version,
    readings: sanitizeReadings(raw.readings),
    reason: typeof raw.reason === "string" ? raw.reason : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

function sanitizeRecord(value: unknown): InspectionRecord {
  if (typeof value !== "object" || value === null) throw new Error("记录缺失");
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id === "") throw new Error("记录编号非法");
  if (typeof raw.room !== "string" || raw.room === "") throw new Error("房间非法");
  if (!isReviewStatus(raw.status)) throw new Error("复核状态非法");
  if (!Array.isArray(raw.versions) || raw.versions.length === 0) {
    throw new Error("版本链为空");
  }
  const closedVersion =
    raw.closedVersion === null || raw.closedVersion === undefined
      ? null
      : Number(raw.closedVersion);
  if (closedVersion !== null && !Number.isInteger(closedVersion)) {
    throw new Error("关闭版本号非法");
  }
  return {
    id: raw.id,
    room: raw.room,
    status: raw.status,
    closedVersion,
    versions: raw.versions.map(sanitizeVersion),
  };
}

function sanitizeDrafts(
  value: unknown,
  records: InspectionRecord[]
): Record<string, Draft> {
  if (typeof value !== "object" || value === null) return {};
  const ids = new Set(records.map((record) => record.id));
  const drafts: Record<string, Draft> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!ids.has(key) || typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    drafts[key] = {
      isoClass: isIsoClass(raw.isoClass) ? raw.isoClass : "ISO 5",
      particleCount: typeof raw.particleCount === "string" ? raw.particleCount : "",
      pressureDiff: typeof raw.pressureDiff === "string" ? raw.pressureDiff : "",
      equipmentStatus: isEquipmentStatus(raw.equipmentStatus)
        ? raw.equipmentStatus
        : "运行",
      note: typeof raw.note === "string" ? raw.note : "",
      reason: typeof raw.reason === "string" ? raw.reason : "",
      supplement: raw.supplement === true,
    };
  }
  return drafts;
}

export function loadState(): LoadedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { records: seedRecords(), drafts: {}, conflicts: [], source: "seed" };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(parsed.records)) throw new Error("记录列表缺失");
    const records = parsed.records.map(sanitizeRecord);
    const drafts = sanitizeDrafts(parsed.drafts, records);
    return { records, drafts, conflicts: detectConflicts(records), source: "storage" };
  } catch {
    return { records: seedRecords(), drafts: {}, conflicts: [], source: "recovered" };
  }
}

export function saveState(records: InspectionRecord[], drafts: Record<string, Draft>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, drafts }));
  } catch {
    // 存储不可用（隐私模式/超限）时静默失败，界面仍可操作
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}
