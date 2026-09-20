import { useState } from "react";
import type { DraftState, InspectionRecord, IsoClass } from "../domain/types";
import { EQUIPMENT_STATUSES } from "../domain/types";
import { ISO_CLASSES, ISO_PARTICLE_LIMITS } from "../domain/iso";
import {
  CLOSABLE_EQUIPMENT,
  RULE_TEXT,
  evaluateReading,
  isFrozen,
  latestVersion,
} from "../domain/rules";
import type { SaveResult } from "../state/useInspectionStore";
import { StatusBadge } from "./StatusBadge";
import { VersionChain } from "./VersionChain";

interface Props {
  record: InspectionRecord;
  draft: DraftState;
  onDraft: (patch: Partial<DraftState>) => void;
  onSave: () => SaveResult;
  onClose: () => boolean;
}

export function RecordDetail({ record, draft, onDraft, onSave, onClose }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "ok" | "blocked"; text: string } | null>(null);

  const latest = latestVersion(record);
  const frozen = isFrozen(record);
  const limit = ISO_PARTICLE_LIMITS[draft.isoClass];
  const closure = record.closures[record.closures.length - 1];

  // 草稿实时预判：保存前提示将触发的规则
  const particle = Number(draft.particleCount);
  const pressure = Number(draft.pressureDiff);
  const draftReady =
    draft.particleCount.trim() !== "" &&
    Number.isFinite(particle) &&
    particle >= 0 &&
    draft.pressureDiff.trim() !== "" &&
    Number.isFinite(pressure);
  const preview = draftReady
    ? evaluateReading({
        isoClass: draft.isoClass,
        particleCount: particle,
        pressureDiff: pressure,
        equipmentStatus: draft.equipmentStatus,
        handlingNote: draft.handlingNote,
      })
    : null;

  // 关闭条件清单基于已保存的最新读数（而非未保存草稿）
  const noteReady = latest.reading.handlingNote.trim() !== "";
  const equipmentReady = CLOSABLE_EQUIPMENT.includes(latest.reading.equipmentStatus);

  const handleSave = () => {
    const result = onSave();
    setErrors(result.errors);
    setNotice(
      result.ok
        ? {
            kind: "ok",
            text: frozen ? "补录已保存为新版本，旧值保留在版本链中。" : "读数已保存，生成新版本。",
          }
        : null
    );
  };

  const handleClose = () => {
    setNotice(
      onClose()
        ? { kind: "ok", text: "异常已关闭，当前读数冻结。" }
        : {
            kind: "blocked",
            text: "关闭被规则拦截：需补全处理备注且设备状态为停机或检修，详情见冲突列表。",
          }
    );
  };

  return (
    <section className="panel detail">
      <div className="section-heading">
        <div>
          <p>{record.area}</p>
          <h2>
            {record.room} <StatusBadge status={record.status} />
          </h2>
        </div>
        <span className="limit-chip">
          {draft.isoClass} 上限 {limit.toLocaleString("zh-CN")} 个/m³
        </span>
      </div>

      {record.status === "待复核" && (
        <div className="alert alert-warn">
          <strong>异常待复核：</strong>
          {latest.triggeredRules.map((r) => RULE_TEXT[r]).join("；")}
          （基于 v{latest.version} 已保存读数）
        </div>
      )}

      {frozen && closure && (
        <div className="alert alert-closed">
          记录已于 {closure.at} 关闭，v{latest.version} 读数冻结。再次录入将作为补录生成新版本，
          必须填写补录原因，旧值全部保留。
        </div>
      )}

      <div className="field-grid">
        <label>
          <span>洁净等级</span>
          <select
            value={draft.isoClass}
            onChange={(e) => onDraft({ isoClass: e.target.value as IsoClass })}
          >
            {ISO_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}（上限 {ISO_PARTICLE_LIMITS[c].toLocaleString("zh-CN")}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>粒子计数（≥0.5µm，个/m³）</span>
          <input
            type="number"
            min={0}
            value={draft.particleCount}
            placeholder={`上限 ${limit.toLocaleString("zh-CN")}`}
            onChange={(e) => onDraft({ particleCount: e.target.value })}
          />
          {errors.particleCount && <em className="field-error">{errors.particleCount}</em>}
        </label>
        <label>
          <span>压差（Pa，负压为异常）</span>
          <input
            type="number"
            step="0.1"
            value={draft.pressureDiff}
            placeholder="如 8.5，负压填负数"
            onChange={(e) => onDraft({ pressureDiff: e.target.value })}
          />
          {errors.pressureDiff && <em className="field-error">{errors.pressureDiff}</em>}
        </label>
        <label>
          <span>设备状态</span>
          <select
            value={draft.equipmentStatus}
            onChange={(e) => onDraft({ equipmentStatus: e.target.value as DraftState["equipmentStatus"] })}
          >
            {EQUIPMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          <span>处理备注{record.status === "待复核" ? "（关闭前必填）" : ""}</span>
          <textarea
            rows={2}
            value={draft.handlingNote}
            placeholder="异常处理措施、通知对象、复测结论…"
            onChange={(e) => onDraft({ handlingNote: e.target.value })}
          />
        </label>
        <label className="span-2">
          <span>补录原因{frozen ? "（必填）" : "（选填，默认为日常巡检）"}</span>
          <input
            value={draft.reason}
            placeholder={frozen ? "说明为何在关闭后补录" : "例行巡检 / 复测 / 补录原因"}
            onChange={(e) => onDraft({ reason: e.target.value })}
          />
          {errors.reason && <em className="field-error">{errors.reason}</em>}
        </label>
      </div>

      {preview && (
        <p className={"preview " + (preview.length > 0 ? "preview-bad" : "preview-ok")}>
          {preview.length > 0
            ? `保存后将触发：${preview.map((r) => RULE_TEXT[r]).join("；")}`
            : "当前草稿读数在限值内"}
        </p>
      )}

      {notice && <p className={`notice notice-${notice.kind}`}>{notice.text}</p>}

      <div className="action-row">
        <button className="primary-action" onClick={handleSave}>
          {frozen ? "提交补录（生成新版本）" : "保存读数（生成新版本）"}
        </button>
        {record.status === "待复核" && (
          <button className="danger-action" onClick={handleClose}>
            关闭异常
          </button>
        )}
      </div>

      {record.status === "待复核" && (
        <ul className="close-checklist">
          <li className={noteReady ? "pass" : "fail"}>处理备注已补全（基于已保存读数）</li>
          <li className={equipmentReady ? "pass" : "fail"}>设备状态为停机或检修（基于已保存读数）</li>
        </ul>
      )}

      <VersionChain record={record} />
    </section>
  );
}
