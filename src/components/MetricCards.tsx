import type { Conflict, InspectionRecord, ReviewStatus } from "../domain/types";

const CARDS: { status: ReviewStatus; label: string; tone: string }[] = [
  { status: "待复核", label: "异常待复核", tone: "tone-warn" },
  { status: "正常", label: "正常房间", tone: "tone-ok" },
  { status: "已关闭", label: "已关闭冻结", tone: "tone-closed" },
];

export function MetricCards({
  records,
  conflicts,
}: {
  records: InspectionRecord[];
  conflicts: Conflict[];
}) {
  return (
    <section className="metrics-grid">
      {CARDS.map((card) => (
        <article key={card.status} className="metric-card">
          <span>{card.label}</span>
          <strong>{records.filter((r) => r.status === card.status).length}</strong>
          <i className={card.tone} />
        </article>
      ))}
      <article className="metric-card">
        <span>规则冲突</span>
        <strong>{conflicts.length}</strong>
        <i className="tone-conflict" />
      </article>
    </section>
  );
}
