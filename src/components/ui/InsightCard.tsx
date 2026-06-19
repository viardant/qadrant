import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  value: ReactNode;
  caption?: string;
  bordered?: boolean;
  compact?: boolean;
}

export function InsightCard({ eyebrow, value, caption, bordered = false, compact = false }: Props) {
  return (
    <div
      className={`insight-card ${bordered ? 'insight-card--bordered' : ''}`.trim()}
      style={compact ? { padding: '16px' } : undefined}
    >
      <div className="insight-card__eyebrow">{eyebrow}</div>
      <div className="insight-card__stat" style={compact ? { fontSize: 'clamp(20px, 2.5vw, 22px)' } : undefined}>{value}</div>
      {caption && <div className="insight-card__caption">{caption}</div>}
    </div>
  );
}
