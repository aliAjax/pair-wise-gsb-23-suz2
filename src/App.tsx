import { MetricCards } from "./components/MetricCards";
import { RoomList } from "./components/RoomList";
import { RecordDetail } from "./components/RecordDetail";
import { ConflictPanel } from "./components/ConflictPanel";
import { useInspectionStore } from "./state/useInspectionStore";
import "./styles.css";

function App() {
  const store = useInspectionStore();
  const record = store.selectedRecord;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-09 · port 5109 · 本地落盘 {store.savedAt}</p>
          <h1>半导体洁净室巡检</h1>
          <p className="subtitle">
            粒子超限或压差为负即进入异常待复核；补全处理备注且设备停机/检修方可关闭；
            关闭后读数冻结，补录生成带原因的新版本并保留旧值。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <div className="hero-actions">
            <button onClick={store.exportData}>导出快照</button>
            <button
              onClick={() => {
                if (window.confirm("确定重置为初始演示数据？当前记录、冲突与草稿都会被清除。")) {
                  store.resetAll();
                }
              }}
            >
              重置数据
            </button>
          </div>
        </div>
      </section>

      <MetricCards records={store.records} conflicts={store.conflicts} />

      <section className="workspace">
        <RoomList
          records={store.records}
          selectedId={record?.id ?? ""}
          isDraftDirty={store.isDraftDirty}
          onSelect={store.selectRoom}
        />
        {record && (
          <RecordDetail
            key={record.id} // 切换房间时重置本地状态，草稿按房间隔离
            record={record}
            draft={store.draftOf(record.id)}
            onDraft={(patch) => store.updateDraft(record.id, patch)}
            onSave={() => store.saveReading(record.id)}
            onClose={() => store.requestClose(record.id)}
          />
        )}
      </section>

      <ConflictPanel conflicts={store.conflicts} onClear={store.clearConflicts} />
    </main>
  );
}

export default App;
