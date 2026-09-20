import type { InspectionRecord } from "../domain/types";
import { RULE_TEXT, latestVersion } from "../domain/rules";

export function VersionChain({ record }: { record: InspectionRecord }) {
  const currentNo = latestVersion(record).version;
  const items = [...record.versions].reverse();
  return (
    <div className="version-chain">
      <h3>版本链（{record.versions.length} 个版本，旧值全部保留）</h3>
      <ol>
        {items.map((v) => {
          const closure = record.closures.find((c) => c.version === v.version);
          const isCurrent = v.version === currentNo;
          return (
            <li key={v.version} className={isCurrent ? "current" : ""}>
              <header>
                <strong>v{v.version}</strong>
                <span>{v.createdAt}</span>
                {isCurrent ? (
                  <em className="tag tag-current">当前</em>
                ) : (
                  <em className="tag tag-frozen">冻结</em>
                )}
                {closure && <em className="tag tag-closed">关闭于 {closure.at}</em>}
              </header>
              <div className="version-body">
                <span>{v.reading.isoClass}</span>
                <span>粒子 {v.reading.particleCount.toLocaleString("zh-CN")} 个/m³</span>
                <span>压差 {v.reading.pressureDiff} Pa</span>
                <span>设备 {v.reading.equipmentStatus}</span>
              </div>
              <p>原因：{v.reason}</p>
              {v.reading.handlingNote && <p>备注：{v.reading.handlingNote}</p>}
              {v.triggeredRules.length > 0 && (
                <div className="rule-tags">
                  {v.triggeredRules.map((r) => (
                    <span key={r}>{RULE_TEXT[r]}</span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
