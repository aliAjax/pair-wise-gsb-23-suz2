// 落盘层：localStorage 读写、加载时的完整性校验与修复（修复痕迹进入冲突列表）
import type { Conflict, InspectionRecord, PersistedState } from "./types";
import { SCHEMA_VERSION } from "./types";
import { RULE_TEXT, closureBlockers, deriveStatus, evaluateReading, makeConflict } from "./rules";
import { seedState } from "./seed";
import { nowStamp } from "./time";

export const STORAGE_KEY = "hxwl09.cleanroom.audit";

/** 单条记录校验与修复：版本链、触发规则、关闭点、复核状态 */
function reconcileRecord(
  raw: InspectionRecord,
  at: string
): { record: InspectionRecord; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];

  // 1. 版本链：按编号排序并重排为 1..n
  const originalSeq = raw.versions.map((v) => v.version);
  let versions = raw.versions
    .slice()
    .sort((a, b) => a.version - b.version)
    .map((v, i) => ({ ...v, version: i + 1 }));
  const repairedSeq = versions.map((v) => v.version);
  if (originalSeq.join(",") !== repairedSeq.join(",")) {
    conflicts.push(
      makeConflict(
        raw.room,
        "版本链",
        `[${originalSeq.join(", ")}]`,
        `[${repairedSeq.join(", ")}]`,
        "CHAIN_BROKEN",
        at
      )
    );
  }

  // 2. 触发规则按读数与所选 ISO 等级重算
  versions = versions.map((v) => {
    const recomputed = evaluateReading(v.reading);
    if (recomputed.join("|") !== v.triggeredRules.join("|")) {
      conflicts.push(
        makeConflict(
          raw.room,
          `v${v.version} 触发规则`,
          v.triggeredRules.map((r) => RULE_TEXT[r]).join("；") || "（无）",
          recomputed.map((r) => RULE_TEXT[r]).join("；") || "（无）",
          "STATUS_INCONSISTENT",
          at
        )
      );
    }
    return { ...v, triggeredRules: recomputed };
  });

  // 3. 关闭点：越界的移除
  const rawClosures = Array.isArray(raw.closures) ? raw.closures : [];
  let closures = rawClosures.filter((c) => {
    const ok = Number.isInteger(c.version) && c.version >= 1 && c.version <= versions.length;
    if (!ok) {
      conflicts.push(
        makeConflict(raw.room, "关闭记录", `关闭于 v${c.version}`, "移除越界关闭点", "STATUS_INCONSISTENT", at)
      );
    }
    return ok;
  });

  // 4. 冻结版本必须满足关闭条件，否则撤销关闭、回到待复核
  const last = closures[closures.length - 1];
  if (last && last.version === versions.length) {
    const closing = versions[last.version - 1];
    const blockers = closureBlockers(closing.reading);
    if (blockers.length > 0) {
      for (const blocker of blockers) {
        conflicts.push(
          makeConflict(
            raw.room,
            blocker === "CLOSE_REQUIRES_NOTE" ? "处理备注" : "设备状态",
            blocker === "CLOSE_REQUIRES_NOTE"
              ? closing.reading.handlingNote || "（空）"
              : closing.reading.equipmentStatus,
            "关闭点撤销，记录回到待复核",
            blocker,
            at
          )
        );
      }
      closures = closures.slice(0, -1);
    }
  }

  // 5. 复核状态与版本链推导结果对齐
  const repaired: InspectionRecord = { ...raw, versions, closures, status: raw.status };
  const derived = deriveStatus(repaired);
  if (derived !== raw.status) {
    conflicts.push(makeConflict(raw.room, "复核状态", String(raw.status ?? "（缺失）"), derived, "STATUS_INCONSISTENT", at));
    repaired.status = derived;
  }
  return { record: repaired, conflicts };
}

/** 全量校验：刷新后保证记录、复核状态与版本链一致，不一致处修复并留痕 */
export function reconcile(state: PersistedState): PersistedState {
  const at = nowStamp();
  const conflicts: Conflict[] = [...(Array.isArray(state.conflicts) ? state.conflicts : [])];
  const records: InspectionRecord[] = [];
  const rawRecords = Array.isArray(state.records) ? state.records : [];
  for (const raw of rawRecords) {
    if (!raw || !Array.isArray(raw.versions) || raw.versions.length === 0) {
      conflicts.push(
        makeConflict(raw?.room ?? "（未知房间）", "版本链", "0 个版本", "记录移除", "CHAIN_BROKEN", at)
      );
      continue;
    }
    const result = reconcileRecord(raw, at);
    records.push(result.record);
    conflicts.push(...result.conflicts);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    records,
    conflicts,
    drafts: state.drafts ?? {},
    savedAt: at,
  };
}

export function loadState(): PersistedState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState> | null;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.records)) {
      const fresh = seedState();
      fresh.conflicts = [
        makeConflict(
          "（全部房间）",
          "本地数据",
          `schema v${String(parsed?.schemaVersion ?? "未知")}`,
          `schema v${SCHEMA_VERSION}，已重置`,
          "SCHEMA_MISMATCH",
          nowStamp()
        ),
      ];
      return fresh;
    }
    const repaired = reconcile(parsed as PersistedState);
    saveState(repaired);
    return repaired;
  } catch {
    const fresh = seedState();
    fresh.conflicts = [
      makeConflict("（全部房间）", "本地数据", "无法解析", "已重置为初始数据", "SCHEMA_MISMATCH", nowStamp()),
    ];
    return fresh;
  }
}

export function saveState(state: PersistedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级，界面状态仍可用
  }
}

/** 导出当前落盘快照为 JSON 文件 */
export function exportSnapshot(state: PersistedState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = state.savedAt.replace(/[-: ]/g, "").replace(/(\d{8})(\d{6})/, "$1-$2");
  a.href = url;
  a.download = `cleanroom-audit-${stamp || Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
