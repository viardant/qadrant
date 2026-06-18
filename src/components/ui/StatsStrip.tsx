interface Cell {
  label: string;
  value: string;
}

interface Props {
  cells: Cell[];
}

export function StatsStrip({ cells }: Props) {
  return (
    <div className="stats-strip">
      {cells.map((c) => (
        <div key={c.label} className="stats-strip__cell">
          <div className="stats-strip__label">{c.label}</div>
          <div className="stats-strip__value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
