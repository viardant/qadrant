import type { CSSProperties } from 'react';
import type { Combo } from '../../lib/combos';

interface Props {
  combo: Combo;
  onStart: (combo: Combo) => void;
  compact?: boolean;
  highlighted?: boolean;
  newFromQuery?: boolean;
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
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  padding: '12px 16px',
  gap: '8px',
};

export function ComboCard({ combo, onStart, compact = false, highlighted = false, newFromQuery = false }: Props) {
  const label = comboLabel(combo.space, combo.specialization);
  const classes = ['combo-card', highlighted && 'combo-card--highlighted', newFromQuery && 'combo-card--new'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={classes}
      onClick={() => onStart(combo)}
      aria-label={`Start ${label}`}
      style={compact ? COMPACT_STYLE : undefined}
    >
      {!compact && <span className="combo-card__caret" aria-hidden>▸</span>}
      <div className="combo-card__main">
        <span
          className="combo-card__name"
          style={compact ? { fontSize: '15px' } : undefined}
        >
          {combo.space}
          {combo.specialization && (
            <>
              <span className="combo-card__sep" aria-hidden> // </span>
              <span
                className="combo-card__spec-inline"
                style={compact ? { fontSize: '12px' } : undefined}
              >
                {combo.specialization}
              </span>
            </>
          )}
        </span>
        <span className="sr-only">{label}</span>
      </div>
      {newFromQuery ? (
        <span
          className="combo-card__meta"
          aria-hidden
          style={{ color: 'var(--accent)' }}
        >
          &gt;&gt;&gt;&nbsp;START_NEW_COMBO
        </span>
      ) : (
        <span
          className="combo-card__meta"
          aria-hidden
          style={compact ? { fontSize: '10px', gap: '4px' } : undefined}
        >
          {!compact && <span className="combo-card__meta-square" />}
          {pad(combo.useCount)}&nbsp;USES
        </span>
      )}
    </button>
  );
}
