interface Cell {
  label: string;
  value: string;
}

interface Props {
  cells: Cell[];
  eyebrow?: string;
  trailing?: string;
}

export function StatsStrip({ cells, eyebrow, trailing }: Props) {
  return (
    <section className="section" aria-label={eyebrow ?? 'Today snapshot'}>
      {(eyebrow || trailing) && (
        <div className="section__head">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {trailing && (
            <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
              {trailing}
            </span>
          )}
        </div>
      )}
      <div className="stats-strip">
        {cells.map((c) => (
          <div key={c.label} className="stats-strip__cell">
            <div className="stats-strip__label">{c.label}</div>
            <div className="stats-strip__value">{c.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
