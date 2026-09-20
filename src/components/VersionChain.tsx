import type { InspectionRecord, Readings } from "../domain/types";

interface FieldSpec {
  key: keyof Readings;
  label: string;
  format: (value: Readings[keyof Readings]) => string;
}

const FIELD_SPECS: FieldSpec[] = [
  { key: "isoClass", label: "洁净等级", format: String },
  {
    key: "particleCount",
    label: "粒子计数",
    format: (value) => `${Number(value).toLocaleString()} 个/m³`,
  },
  { key: "pressureDiff", label: "压差", format: (value) => `${value} Pa` },
  { key: "equipmentStatus", label: "设备状态", format: String },
  { key: "note", label: "处理备注", format: (value) => String(value) || "（空）" },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export function VersionChain({ record }: { record: InspectionRecord }) {
  const versions = [...record.versions].reverse();

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>{record.room}</p>
          <h2>版本链（{record.versions.length} 个版本，旧值全部保留）</h2>
        </div>
      </div>
      <div className="version-list">
        {versions.map((version, index) => {
          const previous = versions[index + 1];
          const changed = previous
            ? FIELD_SPECS.filter(
                (spec) =>
                  version.readings[spec.key] !== previous.readings[spec.key]
              )
            : [];
          const isFrozen =
            record.status === "closed" && record.closedVersion === version.version;
          return (
            <article key={version.version} className="version-item">
              <header>
                <strong>v{version.version}</strong>
                <span>{formatTime(version.createdAt)}</span>
                {isFrozen && <em className="frozen-tag">已冻结</em>}
              </header>
              <p className="version-reason">{version.reason}</p>
              <div className="version-readings">
                {FIELD_SPECS.map((spec) => (
                  <span key={spec.key}>
                    {spec.label}：{spec.format(version.readings[spec.key])}
                  </span>
                ))}
              </div>
              {changed.length > 0 && (
                <ul className="diff-list">
                  {changed.map((spec) => (
                    <li key={spec.key}>
                      {spec.label}：
                      <s>{spec.format(previous!.readings[spec.key])}</s>
                      {" → "}
                      <b>{spec.format(version.readings[spec.key])}</b>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
