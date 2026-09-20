import { latestVersion } from "../domain/rules";
import type { InspectionRecord } from "../domain/types";
import { StatusBadge } from "./StatusBadge";

interface RoomListProps {
  records: InspectionRecord[];
  selectedId: string;
  dirtyIds: Set<string>;
  onSelect: (id: string) => void;
}

export function RoomList({ records, selectedId, dirtyIds, onSelect }: RoomListProps) {
  return (
    <aside className="panel narrow">
      <h2>巡检房间</h2>
      <div className="room-list">
        {records.map((record) => {
          const readings = latestVersion(record).readings;
          const active = record.id === selectedId;
          return (
            <button
              key={record.id}
              className={`room-item${active ? " active" : ""}`}
              onClick={() => onSelect(record.id)}
            >
              <span className="room-item-head">
                <strong>{record.room}</strong>
                <StatusBadge status={record.status} />
              </span>
              <span className="room-item-meta">
                {readings.isoClass} · 粒子 {readings.particleCount.toLocaleString()} ·
                压差 {readings.pressureDiff} Pa
              </span>
              {dirtyIds.has(record.id) && (
                <span className="draft-tag">未保存草稿</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="panel-note">草稿按房间隔离保存，切换房间不会串台。</p>
    </aside>
  );
}
