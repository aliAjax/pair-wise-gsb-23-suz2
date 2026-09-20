// 状态层：连接领域规则与界面，所有变更先落盘再更新
import { useState } from "react";
import type { DraftState, InspectionRecord, IsoClass, PersistedState, Reading } from "../domain/types";
import { appendVersion, closeRecord, latestVersion } from "../domain/rules";
import { exportSnapshot, loadState, saveState } from "../domain/store";
import { seedState } from "../domain/seed";
import { nowStamp } from "../domain/time";

export interface SaveResult {
  ok: boolean;
  errors: Record<string, string>;
}

export function defaultDraft(isoClass: IsoClass): DraftState {
  return {
    isoClass,
    particleCount: "",
    pressureDiff: "",
    equipmentStatus: "运行",
    handlingNote: "",
    reason: "",
  };
}

export function useInspectionStore() {
  const [state, setState] = useState<PersistedState>(loadState);
  const [selectedId, setSelectedId] = useState<string>("");

  const commit = (next: PersistedState) => {
    saveState(next);
    setState(next);
  };

  const selectedRecord: InspectionRecord | undefined =
    state.records.find((r) => r.id === selectedId) ?? state.records[0];

  /** 草稿按房间 id 隔离存取，切换房间不会串台 */
  const draftOf = (roomId: string): DraftState => {
    const record = state.records.find((r) => r.id === roomId);
    const base = defaultDraft(record ? latestVersion(record).reading.isoClass : "ISO 5");
    return { ...base, ...state.drafts[roomId] };
  };

  /** 草稿是否与该房间默认值不同：用于房间列表的“草稿”标记 */
  const isDraftDirty = (roomId: string): boolean => {
    const stored = state.drafts[roomId];
    if (!stored) return false;
    const record = state.records.find((r) => r.id === roomId);
    const base = defaultDraft(record ? latestVersion(record).reading.isoClass : "ISO 5");
    return (Object.keys(base) as (keyof DraftState)[]).some((key) => stored[key] !== base[key]);
  };

  const selectRoom = (roomId: string) => setSelectedId(roomId);

  const updateDraft = (roomId: string, patch: Partial<DraftState>) => {
    commit({
      ...state,
      drafts: { ...state.drafts, [roomId]: { ...draftOf(roomId), ...patch } },
      savedAt: nowStamp(),
    });
  };

  /** 保存读数 / 补录：格式错误返回内联错误，规则拒绝写入冲突列表 */
  const saveReading = (roomId: string): SaveResult => {
    const record = state.records.find((r) => r.id === roomId);
    if (!record) return { ok: false, errors: {} };
    const draft = draftOf(roomId);
    const errors: Record<string, string> = {};

    const particle = Number(draft.particleCount);
    if (draft.particleCount.trim() === "" || !Number.isFinite(particle) || particle < 0) {
      errors.particleCount = "请输入不小于 0 的整数";
    }
    const pressure = Number(draft.pressureDiff);
    if (draft.pressureDiff.trim() === "" || !Number.isFinite(pressure)) {
      errors.pressureDiff = "请输入数值，负压用负数表示";
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const at = nowStamp();
    const reading: Reading = {
      isoClass: draft.isoClass,
      particleCount: Math.round(particle),
      pressureDiff: Math.round(pressure * 10) / 10,
      equipmentStatus: draft.equipmentStatus,
      handlingNote: draft.handlingNote.trim(),
    };
    const { record: nextRecord, conflicts } = appendVersion(record, reading, draft.reason, at);
    if (conflicts.length > 0) {
      commit({ ...state, conflicts: [...state.conflicts, ...conflicts], savedAt: at });
      return { ok: false, errors: { reason: "记录已关闭冻结，补录必须填写原因" } };
    }
    const drafts = { ...state.drafts };
    delete drafts[roomId]; // 保存成功后清空该房间草稿
    commit({
      ...state,
      records: state.records.map((r) => (r.id === roomId ? nextRecord : r)),
      drafts,
      savedAt: at,
    });
    return { ok: true, errors: {} };
  };

  /** 关闭异常：被规则拦截时生成冲突并返回 false */
  const requestClose = (roomId: string): boolean => {
    const record = state.records.find((r) => r.id === roomId);
    if (!record) return false;
    const at = nowStamp();
    const { record: nextRecord, conflicts } = closeRecord(record, at);
    commit({
      ...state,
      records: state.records.map((r) => (r.id === roomId ? nextRecord : r)),
      conflicts: [...state.conflicts, ...conflicts],
      savedAt: at,
    });
    return conflicts.length === 0;
  };

  const clearConflicts = () => commit({ ...state, conflicts: [], savedAt: nowStamp() });

  const resetAll = () => commit(seedState());

  const exportData = () => exportSnapshot(state);

  return {
    records: state.records,
    conflicts: state.conflicts,
    savedAt: state.savedAt,
    selectedRecord,
    selectRoom,
    draftOf,
    isDraftDirty,
    updateDraft,
    saveReading,
    requestClose,
    clearConflicts,
    resetAll,
    exportData,
  };
}
