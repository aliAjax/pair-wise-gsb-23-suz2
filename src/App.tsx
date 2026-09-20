import { ConflictPanel } from "./components/ConflictPanel";
import { MetricCards } from "./components/MetricCards";
import { RecordDetail } from "./components/RecordDetail";
import { RoomList } from "./components/RoomList";
import { VersionChain } from "./components/VersionChain";
import { useInspectionStore } from "./state/useInspectionStore";
import "./styles.css";

const SOURCE_LABEL = {
  seed: "首次运行，已载入示例数据",
  storage: "已从本地存储恢复",
  recovered: "本地数据损坏，已回退为示例数据",
} as const;

function App() {
  const store = useInspectionStore();
  const selected =
    store.records.find((record) => record.id === store.selectedId) ??
    store.records[0];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-09 · port 5109</p>
          <h1>半导体洁净室巡检</h1>
          <p className="subtitle">
            粒子计数超过所选 ISO 等级上限或压差为负即进入异常待复核；补全处理备注并将设备置为停机/检修后方可关闭。
            关闭后读数冻结，补录只生成带原因的新版本，旧值保留在版本链中。
          </p>
        </div>
        <div className="stack-card">
          <span>复核闭环 · 本地落盘</span>
          <strong>React + Vite + TypeScript</strong>
          <span className="storage-note">{SOURCE_LABEL[store.source]}</span>
          <button className="ghost-action" onClick={store.resetAll}>
            重置为示例数据
          </button>
        </div>
      </section>

      <MetricCards metrics={store.metrics} />

      <ConflictPanel conflicts={store.conflicts} onRepair={store.repairConflicts} />

      <section className="workspace">
        <RoomList
          records={store.records}
          selectedId={selected?.id ?? ""}
          dirtyIds={store.dirtyIds}
          onSelect={store.selectRoom}
        />
        {selected && (
          <RecordDetail
            record={selected}
            draft={store.effectiveDraft(selected)}
            dirty={store.isDirty(selected.id)}
            onUpdate={(patch) => store.updateDraft(selected.id, patch)}
            onSave={() => store.saveReadings(selected.id)}
            onClose={() => store.closeRecord(selected.id)}
            onStartSupplement={() => store.startSupplement(selected.id)}
            onDiscard={() => store.discardDraft(selected.id)}
          />
        )}
      </section>

      {selected && <VersionChain record={selected} />}
    </main>
  );
}

export default App;
