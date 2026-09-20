// 状态层：记录、按房间隔离的草稿、冲突列表，以及全部写操作

import { useEffect, useMemo, useState } from "react";
import {
  draftDiffers,
  draftFromRecord,
  parseDraft,
  type Draft,
} from "../domain/draft";
import {
  canClose,
  deriveStatus,
  detectConflicts,
  evaluateAnomalies,
  latestVersion,
  repairRecords,
} from "../domain/rules";
import { seedRecords } from "../domain/seed";
import { clearState, loadState, saveState } from "../domain/store";
import type { Conflict, InspectionRecord, RecordVersion } from "../domain/types";

export interface InspectionStore {
  records: InspectionRecord[];
  conflicts: Conflict[];
  selectedId: string;
  source: "seed" | "storage" | "recovered";
  metrics: { particle: number; pressure: number; pending: number; closed: number };
  draftOf: (id: string) => Draft | undefined;
  effectiveDraft: (record: InspectionRecord) => Draft;
  isDirty: (id: string) => boolean;
  dirtyIds: Set<string>;
  selectRoom: (id: string) => void;
  updateDraft: (id: string, patch: Partial<Draft>) => void;
  saveReadings: (id: string) => string | null;
  closeRecord: (id: string) => void;
  startSupplement: (id: string) => void;
  discardDraft: (id: string) => void;
  repairConflicts: () => void;
  resetAll: () => void;
}

export function useInspectionStore(): InspectionStore {
  const [initial] = useState(loadState);
  const [records, setRecords] = useState(initial.records);
  const [drafts, setDrafts] = useState(initial.drafts);
  const [conflicts, setConflicts] = useState(initial.conflicts);
  const [selectedId, setSelectedId] = useState(initial.records[0]?.id ?? "");

  // 任何记录/草稿变化立即落盘，刷新后记录、复核状态、版本链一致
  useEffect(() => {
    saveState(records, drafts);
  }, [records, drafts]);

  const metrics = useMemo(() => {
    let particle = 0;
    let pressure = 0;
    let pending = 0;
    let closed = 0;
    for (const record of records) {
      const hits = evaluateAnomalies(latestVersion(record).readings);
      if (hits.some((hit) => hit.ruleId === "particle-limit")) particle += 1;
      if (hits.some((hit) => hit.ruleId === "negative-pressure")) pressure += 1;
      if (record.status === "pending") pending += 1;
      if (record.status === "closed") closed += 1;
    }
    return { particle, pressure, pending, closed };
  }, [records]);

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of records) {
      const draft = drafts[record.id];
      if (draft && draftDiffers(record, draft)) ids.add(record.id);
    }
    return ids;
  }, [records, drafts]);

  const draftOf = (id: string) => drafts[id];

  const effectiveDraft = (record: InspectionRecord) =>
    drafts[record.id] ?? draftFromRecord(record);

  const isDirty = (id: string) => dirtyIds.has(id);

  // 切换房间只改选中项；草稿按记录 id 存放，不会串到别的房间
  const selectRoom = (id: string) => setSelectedId(id);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? draftFromRecord(record)), ...patch },
    }));
  };

  /** 保存草稿为新版本；已关闭记录必须走带原因的补录。返回错误信息或 null */
  const saveReadings = (id: string): string | null => {
    const record = records.find((item) => item.id === id);
    const draft = drafts[id];
    if (!record || !draft) return "没有可保存的草稿";
    const parsed = parseDraft(draft);
    if (!parsed.ok) return parsed.error;
    if ((record.status === "closed" || draft.supplement) && draft.reason.trim() === "") {
      return "已关闭记录只能补录：必须填写补录原因";
    }
    const version: RecordVersion = {
      version: record.versions.length + 1,
      readings: parsed.readings,
      reason:
        draft.reason.trim() ||
        (record.versions.length === 0 ? "首次巡检录入" : "读数修正"),
      createdAt: new Date().toISOString(),
    };
    const next: InspectionRecord = {
      ...record,
      versions: [...record.versions, version],
    };
    // 关闭标记只认旧版本号，补录出新版本后自动回到规则推导状态
    next.status = deriveStatus(next);
    setRecords((current) => current.map((item) => (item.id === id ? next : item)));
    setDrafts((current) => {
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
    return null;
  };

  /** 关闭异常：仅当最新提交读数满足关闭条件（备注齐全 + 停机/检修） */
  const closeRecord = (id: string) => {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== id || record.status !== "pending") return record;
        const latest = latestVersion(record);
        if (!canClose(latest.readings)) return record;
        return { ...record, status: "closed", closedVersion: latest.version };
      })
    );
  };

  /** 已关闭记录发起补录：以冻结读数为底稿，生成草稿并解锁表单 */
  const startSupplement = (id: string) => {
    const record = records.find((item) => item.id === id);
    if (!record || record.status !== "closed") return;
    setDrafts((current) => ({
      ...current,
      [id]: { ...draftFromRecord(record), supplement: true },
    }));
  };

  const discardDraft = (id: string) => {
    setDrafts((current) => {
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
  };

  const repairConflicts = () => {
    const repaired = repairRecords(records);
    setRecords(repaired);
    setConflicts(detectConflicts(repaired));
  };

  const resetAll = () => {
    clearState();
    const seeded = seedRecords();
    setRecords(seeded);
    setDrafts({});
    setConflicts([]);
    setSelectedId(seeded[0]?.id ?? "");
  };

  return {
    records,
    conflicts,
    selectedId,
    source: initial.source,
    metrics,
    draftOf,
    effectiveDraft,
    isDirty,
    dirtyIds,
    selectRoom,
    updateDraft,
    saveReadings,
    closeRecord,
    startSupplement,
    discardDraft,
    repairConflicts,
    resetAll,
  };
}
