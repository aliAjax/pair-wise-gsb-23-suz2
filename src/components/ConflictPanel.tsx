import type { Conflict } from "../domain/types";

interface ConflictPanelProps {
  conflicts: Conflict[];
  onRepair: () => void;
}

export function ConflictPanel({ conflicts, onRepair }: ConflictPanelProps) {
  if (conflicts.length === 0) return null;

  return (
    <section className="panel conflict-panel">
      <div className="section-heading">
        <div>
          <p>落盘数据与规则引擎不一致</p>
          <h2>发现 {conflicts.length} 项冲突</h2>
        </div>
        <button className="primary-action" onClick={onRepair}>
          按规则修复
        </button>
      </div>
      <div className="table-wrap">
        <table className="conflict-table">
          <thead>
            <tr>
              <th>房间</th>
              <th>读数</th>
              <th>原值</th>
              <th>新值</th>
              <th>触发规则</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((conflict, index) => (
              <tr key={`${conflict.recordId}-${conflict.field}-${index}`}>
                <td>{conflict.room}</td>
                <td>{conflict.field}</td>
                <td className="cell-old">{conflict.storedValue}</td>
                <td className="cell-new">{conflict.expectedValue}</td>
                <td>{conflict.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
