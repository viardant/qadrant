import type { CSSProperties } from 'react';
import type { Combo } from '../../lib/combos';

interface Props {
  combo: Combo;
  onStart: (combo: Combo) => void;
  compact?: boolean;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function comboLabel(space: string, specialization: string): string {
  if (!specialization) return space || 'Untitled';
  if (!space) return specialization;
  return `${space} / ${specialization}`;
}

const COMPACT_STYLE: CSSProperties = {
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  padding: '12px 16px',
  gap: '8px',
};

export function ComboCard({ combo, onStart, compact = false }: Props) {
  const label = comboLabel(combo.space, combo.specialization);
  return (
    <button
      type="button"
      className="combo-card"
      onClick={() => onStart(combo)}
      aria-label={`Start ${label}`}
      style={compact ? COMPACT_STYLE : undefined}
    >
      {!compact && <span className="combo-card__caret" aria-hidden>▸</span>}
      <div className="combo-card__main">
        {!compact && <span className="combo-card__category">{combo.category}</span>}
        <span
          className="combo-card__name"
          style={compact ? { fontSize: '15px' } : undefined}
        >
          {combo.space}
        </span>
        {combo.specialization && (
          <span
            className="combo-card__specialization"
            style={compact ? { fontSize: '12px' } : undefined}
          >
            {combo.specialization}
          </span>
        )}
        <span className="sr-only">{label}</span>
      </div>
      <span
        className="combo-card__meta"
        aria-hidden
        style={compact ? { fontSize: '10px', gap: '4px' } : undefined}
      >
        {!compact && <span className="combo-card__meta-square" />}
        {pad(combo.useCount)}&nbsp;USES
      </span>
    </button>
  );
}
