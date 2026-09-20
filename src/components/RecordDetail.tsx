import { useState } from "react";
import { parseDraft, type Draft } from "../domain/draft";
import { ISO_PARTICLE_LIMITS } from "../domain/isoLimits";
import {
  canClose,
  evaluateAnomalies,
  latestVersion,
  missingCloseConditions,
} from "../domain/rules";
import {
  EQUIPMENT_STATUSES,
  ISO_CLASSES,
  type InspectionRecord,
} from "../domain/types";
import { StatusBadge } from "./StatusBadge";

interface RecordDetailProps {
  record: InspectionRecord;
  draft: Draft;
  dirty: boolean;
  onUpdate: (patch: Partial<Draft>) => void;
  onSave: () => string | null;
  onClose: () => void;
  onStartSupplement: () => void;
  onDiscard: () => void;
}

export function RecordDetail({
  record,
  draft,
  dirty,
  onUpdate,
  onSave,
  onClose,
  onStartSupplement,
  onDiscard,
}: RecordDetailProps) {
  const [error, setError] = useState<string | null>(null);

  const latest = latestVersion(record);
  const committedHits = evaluateAnomalies(latest.readings);
  const missing = missingCloseConditions(latest.readings);
  const frozen = record.status === "closed" && !draft.supplement;

  // 草稿实时评估：保存前预告将触发的规则
  const parsed = parseDraft(draft);
  const draftHits = parsed.ok ? evaluateAnomalies(parsed.readings) : [];

  const limit = ISO_PARTICLE_LIMITS[draft.isoClass];
  const noteReady = latest.readings.note.trim().length > 0;
  const equipmentReady = !missing.includes("设备状态须为停机或检修");
  const closeDisabled = !canClose(latest.readings) || dirty;

  const handleSave = () => {
    const result = onSave();
    setError(result);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>{record.id} · 当前版本 v{latest.version}</p>
          <h2>
            {record.room} <StatusBadge status={record.status} />
          </h2>
        </div>
        {dirty && <span className="draft-tag large">有未保存草稿</span>}
      </div>

      {record.status === "pending" && committedHits.length > 0 && (
        <div className="banner banner-danger">
          <strong>异常待复核，命中规则：</strong>
          <ul>
            {committedHits.map((hit) => (
              <li key={hit.ruleId}>{hit.detail}</li>
            ))}
          </ul>
        </div>
      )}

      {frozen && (
        <div className="banner banner-muted">
          异常已关闭，v{record.closedVersion} 读数已冻结。如需修正请发起补录，
          补录只生成带原因的新版本并保留旧值。
        </div>
      )}

      {draft.supplement && (
        <div className="banner banner-info">
          补录模式：保存后生成 v{record.versions.length + 1}，原版本读数保留在版本链中。
        </div>
      )}

      <div className="form-grid">
        <label>
          <span>洁净等级（上限 {limit.toLocaleString()} 个/m³）</span>
          <select
            value={draft.isoClass}
            disabled={frozen}
            onChange={(event) =>
              onUpdate({ isoClass: event.target.value as Draft["isoClass"] })
            }
          >
            {ISO_CLASSES.map((isoClass) => (
              <option key={isoClass} value={isoClass}>
                {isoClass}
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
            disabled={frozen}
            onChange={(event) => onUpdate({ particleCount: event.target.value })}
          />
        </label>
        <label>
          <span>压差（Pa，负值即异常）</span>
          <input
            type="number"
            step="0.1"
            value={draft.pressureDiff}
            disabled={frozen}
            onChange={(event) => onUpdate({ pressureDiff: event.target.value })}
          />
        </label>
        <label>
          <span>设备状态</span>
          <select
            value={draft.equipmentStatus}
            disabled={frozen}
            onChange={(event) =>
              onUpdate({
                equipmentStatus: event.target.value as Draft["equipmentStatus"],
              })
            }
          >
            {EQUIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          <span>处理备注（关闭异常前必填）</span>
          <textarea
            rows={3}
            value={draft.note}
            disabled={frozen}
            placeholder="异常定位、处置措施、复测安排…"
            onChange={(event) => onUpdate({ note: event.target.value })}
          />
        </label>
        {(draft.supplement || record.status !== "closed") && !frozen && (
          <label className="span-2">
            <span>
              {draft.supplement ? "补录原因（必填）" : "修改原因（可选，默认“读数修正”）"}
            </span>
            <input
              value={draft.reason}
              placeholder={draft.supplement ? "例如：复测后粒子计数更新" : "读数修正"}
              onChange={(event) => onUpdate({ reason: event.target.value })}
            />
          </label>
        )}
      </div>

      {dirty && parsed.ok && draftHits.length > 0 && (
        <div className="banner banner-danger soft">
          当前草稿保存后将触发：{draftHits.map((hit) => hit.label).join("、")}
        </div>
      )}
      {dirty && parsed.ok && draftHits.length === 0 && (
        <div className="banner banner-ok soft">当前草稿读数无异常。</div>
      )}
      {!parsed.ok && dirty && <div className="banner banner-danger soft">{parsed.error}</div>}
      {error && <div className="banner banner-danger">{error}</div>}

      {record.status === "pending" && (
        <div className="checklist">
          <span className={noteReady ? "ok" : "missing"}>
            {noteReady ? "✓" : "✗"} 处理备注已填写
          </span>
          <span className={equipmentReady ? "ok" : "missing"}>
            {equipmentReady ? "✓" : "✗"} 设备状态为停机/检修
          </span>
          {dirty && <span className="missing">草稿未保存，请先保存再关闭</span>}
        </div>
      )}

      <div className="action-row">
        {!frozen && (
          <button
            className="primary-action"
            disabled={!dirty}
            onClick={handleSave}
          >
            {draft.supplement ? `保存补录（生成 v${record.versions.length + 1}）` : "保存读数（生成新版本）"}
          </button>
        )}
        {record.status === "pending" && (
          <button
            className="danger-action"
            disabled={closeDisabled}
            title={
              closeDisabled
                ? `关闭条件未满足：${[...missing, ...(dirty ? ["草稿未保存"] : [])].join("、")}`
                : "关闭异常并冻结当前读数"
            }
            onClick={onClose}
          >
            关闭异常
          </button>
        )}
        {record.status === "closed" && !draft.supplement && (
          <button className="primary-action" onClick={onStartSupplement}>
            发起补录
          </button>
        )}
        {dirty && (
          <button className="ghost-action" onClick={onDiscard}>
            放弃草稿
          </button>
        )}
      </div>
    </section>
  );
}
