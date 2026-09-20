// 校验规则：异常判定、关闭条件、状态推导、落盘冲突检测与修复

import { ISO_PARTICLE_LIMITS } from "./isoLimits";
import {
  REVIEW_STATUS_LABEL,
  type Conflict,
  type EquipmentStatus,
  type InspectionRecord,
  type Readings,
  type RecordVersion,
  type ReviewStatus,
  type RuleHit,
} from "./types";

export function latestVersion(record: InspectionRecord): RecordVersion {
  return record.versions[record.versions.length - 1];
}

/** 异常判定：粒子计数超过所选 ISO 等级上限，或压差为负 */
export function evaluateAnomalies(readings: Readings): RuleHit[] {
  const hits: RuleHit[] = [];
  const limit = ISO_PARTICLE_LIMITS[readings.isoClass];
  if (readings.particleCount > limit) {
    hits.push({
      ruleId: "particle-limit",
      label: "粒子计数超限",
      detail: `粒子计数 ${readings.particleCount.toLocaleString()} 个/m³ 超过 ${readings.isoClass} 上限 ${limit.toLocaleString()} 个/m³`,
    });
  }
  if (readings.pressureDiff < 0) {
    hits.push({
      ruleId: "negative-pressure",
      label: "压差为负",
      detail: `压差 ${readings.pressureDiff} Pa < 0 Pa`,
    });
  }
  return hits;
}

/** 允许关闭异常的设备状态 */
export const CLOSABLE_EQUIPMENT: EquipmentStatus[] = ["停机", "检修"];

/** 关闭异常的前置条件缺口（为空数组即可关闭） */
export function missingCloseConditions(readings: Readings): string[] {
  const missing: string[] = [];
  if (readings.note.trim().length === 0) missing.push("处理备注未填写");
  if (!CLOSABLE_EQUIPMENT.includes(readings.equipmentStatus)) {
    missing.push("设备状态须为停机或检修");
  }
  return missing;
}

export function canClose(readings: Readings): boolean {
  return missingCloseConditions(readings).length === 0;
}

/**
 * 由版本链推导复核状态：
 * - 最新读数无异常 → 正常
 * - 最新读数有异常，且关闭标记落在最新版本、关闭条件仍满足 → 已关闭
 * - 其余 → 异常待复核
 */
export function deriveStatus(record: InspectionRecord): ReviewStatus {
  const latest = latestVersion(record);
  if (evaluateAnomalies(latest.readings).length === 0) return "normal";
  if (record.closedVersion === latest.version && canClose(latest.readings)) {
    return "closed";
  }
  return "pending";
}

function readingValueOf(record: InspectionRecord, ruleId: RuleHit["ruleId"]): string {
  const readings = latestVersion(record).readings;
  return ruleId === "particle-limit"
    ? `${readings.particleCount.toLocaleString()} 个/m³`
    : `${readings.pressureDiff} Pa`;
}

/** 落盘数据与规则引擎比对，列出全部冲突（房间 / 读数 / 原值 / 新值 / 触发规则） */
export function detectConflicts(records: InspectionRecord[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const record of records) {
    // 版本链完整性：版本号连续递增；补录版本必须带原因
    record.versions.forEach((version, index) => {
      if (version.version !== index + 1) {
        conflicts.push({
          recordId: record.id,
          room: record.room,
          field: "版本链",
          storedValue: `第 ${index + 1} 条为 v${version.version}`,
          expectedValue: `应为 v${index + 1}`,
          rule: "版本号必须连续递增",
        });
      }
      if (version.version > 1 && version.reason.trim() === "") {
        conflicts.push({
          recordId: record.id,
          room: record.room,
          field: `v${version.version} 补录原因`,
          storedValue: "（空）",
          expectedValue: "必须填写补录原因",
          rule: "补录只能生成带原因的新版本",
        });
      }
    });

    // 复核状态一致性
    const latest = latestVersion(record);
    const derived = deriveStatus(record);
    if (derived === record.status) continue;

    const hits = evaluateAnomalies(latest.readings);
    if (record.status === "closed") {
      const missing = missingCloseConditions(latest.readings);
      conflicts.push({
        recordId: record.id,
        room: record.room,
        field: "关闭条件",
        storedValue:
          missing.length > 0
            ? missing.join("、")
            : `关闭标记指向 v${record.closedVersion}，最新为 v${latest.version}`,
        expectedValue: "处理备注齐全 + 设备停机/检修，且关闭标记落在最新版本",
        rule: "异常关闭必须补全处理备注且设备状态为停机或检修",
      });
    } else if (hits.length > 0) {
      for (const hit of hits) {
        conflicts.push({
          recordId: record.id,
          room: record.room,
          field: hit.ruleId === "particle-limit" ? "粒子计数" : "压差",
          storedValue: `${readingValueOf(record, hit.ruleId)}（标记为${REVIEW_STATUS_LABEL[record.status]}）`,
          expectedValue: `应标记为${REVIEW_STATUS_LABEL[derived]}`,
          rule: hit.detail,
        });
      }
    } else {
      conflicts.push({
        recordId: record.id,
        room: record.room,
        field: "复核状态",
        storedValue: REVIEW_STATUS_LABEL[record.status],
        expectedValue: `应为${REVIEW_STATUS_LABEL[derived]}`,
        rule: "读数无异常，状态应为正常",
      });
    }
  }

  return conflicts;
}

/** 按规则修复落盘数据：重排版本号、补记缺失原因、重算复核状态 */
export function repairRecords(records: InspectionRecord[]): InspectionRecord[] {
  return records.map((record) => {
    const versions = record.versions.map((version, index) => ({
      ...version,
      version: index + 1,
      reason:
        version.version > 1 && version.reason.trim() === ""
          ? "（修复补记）补录原因缺失"
          : version.reason,
    }));
    const closedVersion =
      record.closedVersion !== null && record.closedVersion > versions.length
        ? versions.length
        : record.closedVersion;
    const repaired: InspectionRecord = { ...record, versions, closedVersion };
    return { ...repaired, status: deriveStatus(repaired) };
  });
}
