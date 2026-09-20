interface Metric {
  label: string;
  value: number;
  tone: "ok" | "watch" | "danger" | "muted";
}

const TONE_CLASS: Record<Metric["tone"], string> = {
  ok: "status-ok",
  watch: "status-watch",
  danger: "status-danger",
  muted: "status-muted",
};

export function MetricCards({
  metrics,
}: {
  metrics: { particle: number; pressure: number; pending: number; closed: number };
}) {
  const cards: Metric[] = [
    { label: "粒子异常", value: metrics.particle, tone: "danger" },
    { label: "压差异常", value: metrics.pressure, tone: "watch" },
    { label: "待复核", value: metrics.pending, tone: "danger" },
    { label: "已关闭", value: metrics.closed, tone: "ok" },
  ];
  return (
    <section className="metrics-grid">
      {cards.map((card) => (
        <article key={card.label} className="metric-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <i className={TONE_CLASS[card.tone]} />
        </article>
      ))}
    </section>
  );
}
