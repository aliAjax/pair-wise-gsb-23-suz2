import type { InspectionRecord } from "../domain/types";
import { latestVersion } from "../domain/rules";
import { StatusBadge } from "./StatusBadge";

interface Props {
  records: InspectionRecord[];
  selectedId: string;
  isDraftDirty: (roomId: string) => boolean;
  onSelect: (roomId: string) => void;
}

export function RoomList({ records, selectedId, isDraftDirty, onSelect }: Props) {
  return (
    <aside className="panel narrow">
      <h2>房间</h2>
      <div className="room-list">
        {records.map((rec) => {
          const latest = latestVersion(rec);
          return (
            <button
              key={rec.id}
              className={"room-item" + (rec.id === selectedId ? " active" : "")}
              onClick={() => onSelect(rec.id)}
            >
              <span className="room-main">
                <strong>{rec.room}</strong>
                <small>
                  {rec.area} · {latest.reading.isoClass}
                </small>
              </span>
              <span className="room-side">
                {isDraftDirty(rec.id) && <em className="draft-dot">草稿</em>}
                <StatusBadge status={rec.status} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="hint">未保存草稿按房间各自保留，切换房间不会串台。</p>
    </aside>
  );
}
