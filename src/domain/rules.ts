// 校验规则：异常判定、关闭条件、冻结补录、状态推导与冲突生成（纯函数，不依赖界面）
import type {
  Closure,
  Conflict,
  EquipmentStatus,
  InspectionRecord,
  Reading,
  RecordVersion,
  ReviewStatus,
  RuleId,
} from "./types";
import { ISO_PARTICLE_LIMITS } from "./iso";

export const RULE_TEXT: Record<RuleId, string> = {
  PARTICLE_OVER_LIMIT: "粒子计数超过所选 ISO 等级上限",
  NEGATIVE_PRESSURE: "压差为负",
  CLOSE_REQUIRES_NOTE: "关闭异常前必须补全处理备注",
  CLOSE_REQUIRES_EQUIPMENT: "关闭异常前设备状态须为停机或检修",
  SUPPLEMENT_REQUIRES_REASON: "已关闭记录的补录必须注明原因",
  FROZEN_AFTER_CLOSE: "关闭后原读数冻结，仅可补录新版本",
  CHAIN_BROKEN: "版本链断裂或缺失",
  STATUS_INCONSISTENT: "复核状态与读数不一致",
  SCHEMA_MISMATCH: "本地数据版本不匹配",
};

/** 允许关闭异常的设备状态 */
export const CLOSABLE_EQUIPMENT: EquipmentStatus[] = ["停机", "检修"];

/** 异常判定：粒子超限或压差为负 → 触发规则列表 */
export function evaluateReading(reading: Reading): RuleId[] {
  const rules: RuleId[] = [];
  if (reading.particleCount > ISO_PARTICLE_LIMITS[reading.isoClass]) {
    rules.push("PARTICLE_OVER_LIMIT");
  }
  if (reading.pressureDiff < 0) {
    rules.push("NEGATIVE_PRESSURE");
  }
  return rules;
}

/** 关闭条件：处理备注非空 且 设备状态为停机/检修，返回未满足的阻塞规则 */
export function closureBlockers(reading: Reading): RuleId[] {
  const blockers: RuleId[] = [];
  if (!reading.handlingNote.trim()) blockers.push("CLOSE_REQUIRES_NOTE");
  if (!CLOSABLE_EQUIPMENT.includes(reading.equipmentStatus)) {
    blockers.push("CLOSE_REQUIRES_EQUIPMENT");
  }
  return blockers;
}

export function latestVersion(record: InspectionRecord): RecordVersion {
  return record.versions[record.versions.length - 1];
}

export function lastClosure(record: InspectionRecord): Closure | undefined {
  return record.closures[record.closures.length - 1];
}

/** 最新版本已被关闭 → 读数冻结 */
export function isFrozen(record: InspectionRecord): boolean {
  const closure = lastClosure(record);
  return !!closure && closure.version === latestVersion(record).version;
}

/** 由版本链推导复核状态（落盘校验与保存后都以此为准） */
export function deriveStatus(record: InspectionRecord): ReviewStatus {
  if (isFrozen(record)) return "已关闭";
  return latestVersion(record).triggeredRules.length > 0 ? "待复核" : "正常";
}

let conflictSeq = 0;

export function makeConflict(
  room: string,
  field: string,
  originalValue: string,
  newValue: string,
  ruleId: RuleId,
  at: string
): Conflict {
  conflictSeq += 1;
  return {
    id: `cf-${Date.now().toString(36)}-${conflictSeq}`,
    room,
    field,
    originalValue,
    newValue,
    rule: RULE_TEXT[ruleId],
    at,
  };
}

export interface RecordUpdate {
  record: InspectionRecord;
  conflicts: Conflict[];
}

/**
 * 保存读数 / 补录：追加新版本并重算状态。
 * 已关闭（冻结）的记录必须填写补录原因，否则拒绝并生成冲突。
 */
export function appendVersion(
  record: InspectionRecord,
  reading: Reading,
  reason: string,
  at: string
): RecordUpdate {
  if (isFrozen(record) && !reason.trim()) {
    return {
      record,
      conflicts: [
        makeConflict(
          record.room,
          "补录原因",
          `v${latestVersion(record).version} 已冻结`,
          "（未填写原因，补录被拒绝）",
          "SUPPLEMENT_REQUIRES_REASON",
          at
        ),
      ],
    };
  }
  const version: RecordVersion = {
    version: latestVersion(record).version + 1,
    reading,
    reason: reason.trim() || "日常巡检",
    createdAt: at,
    triggeredRules: evaluateReading(reading),
  };
  const next: InspectionRecord = { ...record, versions: [...record.versions, version] };
  next.status = deriveStatus(next);
  return { record: next, conflicts: [] };
}

/**
 * 关闭异常：仅待复核记录可关闭；处理备注与设备状态不满足条件时
 * 拒绝关闭并逐条生成冲突（房间、读数项、原值、新值、触发规则）。
 */
export function closeRecord(record: InspectionRecord, at: string): RecordUpdate {
  if (isFrozen(record)) {
    return {
      record,
      conflicts: [
        makeConflict(record.room, "复核状态", "已关闭", "重复关闭被拒绝", "FROZEN_AFTER_CLOSE", at),
      ],
    };
  }
  const latest = latestVersion(record);
  if (latest.triggeredRules.length === 0) {
    return { record, conflicts: [] }; // 正常记录无需关闭
  }
  const blockers = closureBlockers(latest.reading);
  if (blockers.length > 0) {
    const conflicts = blockers.map((blocker) =>
      blocker === "CLOSE_REQUIRES_NOTE"
        ? makeConflict(
            record.room,
            "处理备注",
            latest.reading.handlingNote || "（空）",
            "必填：异常处理说明",
            blocker,
            at
          )
        : makeConflict(
            record.room,
            "设备状态",
            latest.reading.equipmentStatus,
            "停机 或 检修",
            blocker,
            at
          )
    );
    return { record, conflicts };
  }
  const next: InspectionRecord = {
    ...record,
    closures: [...record.closures, { version: latest.version, at }],
  };
  next.status = deriveStatus(next);
  return { record: next, conflicts: [] };
}
