import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  value: ReactNode;
  caption?: string;
  bordered?: boolean;
}

export function InsightCard({ eyebrow, value, caption, bordered = false }: Props) {
  return (
    <div className={`insight-card ${bordered ? 'insight-card--bordered' : ''}`.trim()}>
      <div className="insight-card__eyebrow">{eyebrow}</div>
      <div className="insight-card__stat">{value}</div>
      {caption && <div className="insight-card__caption">{caption}</div>}
    </div>
  );
}
