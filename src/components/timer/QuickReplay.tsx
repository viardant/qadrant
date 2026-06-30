import { EmptyState } from '../ui/EmptyState';
import { ComboCard } from './ComboCard';
import type { Combo } from '../../lib/combos';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  combos: Combo[];
  total: number;
  onStart: (combo: Combo) => void;
  onCreate: () => void;
  lastAgo?: string;
  highlightedComboId?: string;
  newFromQueryId?: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function QuickReplay({ combos, total, onStart, onCreate, lastAgo, highlightedComboId, newFromQueryId }: Props) {
  const { isDesktop } = useBreakpoint();
  return (
    <section className="section" aria-label="Quick replay">
      <div className="section__head">
        <span className="eyebrow">QUICK_REPLAY&nbsp;//&nbsp;{lastAgo && lastAgo !== 'NO_RECENT_ACTIVITY' ? lastAgo : 'MOST_USED'}</span>
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
        <div className="combo-grid" role="list">
          {combos.map((c) => (
            <div key={c.id} role="listitem" className="combo-grid__cell">
              <ComboCard
                combo={c}
                onStart={onStart}
                compact={!isDesktop}
                highlighted={c.id === highlightedComboId}
                newFromQuery={c.id === newFromQueryId}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
