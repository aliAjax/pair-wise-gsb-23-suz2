import type { Conflict } from "../domain/types";

export function ConflictPanel({
  conflicts,
  onClear,
}: {
  conflicts: Conflict[];
  onClear: () => void;
}) {
  return (
    <section className="panel conflicts">
      <div className="section-heading">
        <div>
          <p>规则引擎</p>
          <h2>冲突列表（{conflicts.length}）</h2>
        </div>
        {conflicts.length > 0 && <button onClick={onClear}>清空冲突</button>}
      </div>
      {conflicts.length === 0 ? (
        <p className="empty">
          暂无冲突。落盘数据修复、违规关闭、缺原因补录等都会在此列出房间、读数项、原值、新值与触发规则。
        </p>
      ) : (
        <div className="conflict-table">
          <div className="conflict-row conflict-head">
            <span>时间</span>
            <span>房间</span>
            <span>读数项</span>
            <span>原值</span>
            <span>新值</span>
            <span>触发规则</span>
          </div>
          {conflicts
            .slice()
            .reverse()
            .map((c) => (
              <div key={c.id} className="conflict-row">
                <span>{c.at}</span>
                <span>{c.room}</span>
                <span>{c.field}</span>
                <span>{c.originalValue}</span>
                <span>{c.newValue}</span>
                <span>{c.rule}</span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
