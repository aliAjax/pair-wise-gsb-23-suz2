// 草稿模型：每个房间独立的未保存编辑状态，绝不跨房间串台

import { latestVersion } from "./rules";
import type { EquipmentStatus, InspectionRecord, IsoClass, Readings } from "./types";

/** 表单草稿：数值以字符串暂存，保存时才解析校验 */
export interface Draft {
  isoClass: IsoClass;
  particleCount: string;
  pressureDiff: string;
  equipmentStatus: EquipmentStatus;
  note: string;
  /** 补录原因（已关闭记录必填） */
  reason: string;
  /** 是否为针对已关闭记录的补录 */
  supplement: boolean;
}

/** 以最新提交版本为底稿生成草稿 */
export function draftFromRecord(record: InspectionRecord): Draft {
  const readings = latestVersion(record).readings;
  return {
    isoClass: readings.isoClass,
    particleCount: String(readings.particleCount),
    pressureDiff: String(readings.pressureDiff),
    equipmentStatus: readings.equipmentStatus,
    note: readings.note,
    reason: "",
    supplement: false,
  };
}

/** 草稿相对最新提交版本是否有改动 */
export function draftDiffers(record: InspectionRecord, draft: Draft): boolean {
  const readings = latestVersion(record).readings;
  return (
    draft.isoClass !== readings.isoClass ||
    Number(draft.particleCount) !== readings.particleCount ||
    Number(draft.pressureDiff) !== readings.pressureDiff ||
    draft.equipmentStatus !== readings.equipmentStatus ||
    draft.note.trim() !== readings.note.trim() ||
    draft.reason.trim() !== ""
  );
}

export type ParseResult =
  | { ok: true; readings: Readings }
  | { ok: false; error: string };

/** 保存前解析并校验草稿 */
export function parseDraft(draft: Draft): ParseResult {
  const particleCount = Number(draft.particleCount);
  const pressureDiff = Number(draft.pressureDiff);
  if (draft.particleCount.trim() === "" || !Number.isFinite(particleCount) || particleCount < 0) {
    return { ok: false, error: "粒子计数须为不小于 0 的数字" };
  }
  if (draft.pressureDiff.trim() === "" || !Number.isFinite(pressureDiff)) {
    return { ok: false, error: "压差须为数字（负压差请填负值）" };
  }
  return {
    ok: true,
    readings: {
      isoClass: draft.isoClass,
      particleCount,
      pressureDiff,
      equipmentStatus: draft.equipmentStatus,
      note: draft.note.trim(),
    },
  };
}
