import { EmptyState } from '../ui/EmptyState';
import { Fab } from '../ui/Fab';
import type { Combo } from '../../lib/combos';

interface Props {
  combos: Combo[];
  total: number;
  onStart: (combo: Combo) => void;
  onCreate: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function QuickReplay({ combos, total, onStart, onCreate }: Props) {
  return (
    <section className="section" aria-label="Quick replay">
      <div className="section__head">
        <span className="eyebrow">QUICK_REPLAY&nbsp;//&nbsp;MOST_USED</span>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
          {pad(combos.length)}_OF_{pad(total)}
        </span>
      </div>
      {combos.length === 0 ? (
        <EmptyState
          title="ARCHIVE_EMPTY"
          message="NO_COMBOS_LOGGED"
          actionLabel=">>> NEW_COMBINATION"
          onAction={onCreate}
        />
      ) : (
        <div className="combo-list" role="list">
          {combos.map((c) => (
            <button
              type="button"
              key={c.id}
              className="combo-list__row"
              onClick={() => onStart(c)}
              role="listitem"
              aria-label={`Start ${c.name}`}
            >
              <span className="combo-list__caret" aria-hidden>▸</span>
              <div className="combo-list__main">
                <span className="combo-list__category">{c.category}</span>
                <span className="combo-list__name">{c.name}</span>
              </div>
              <span className="combo-list__meta">
                <span className="combo-list__meta-square" aria-hidden />
                {pad(c.useCount)}&nbsp;USES
              </span>
            </button>
          ))}
        </div>
      )}
      <Fab onClick={onCreate} ariaLabel="New combination">
        +&nbsp;&nbsp;NEW_COMBINATION
      </Fab>
    </section>
  );
}
