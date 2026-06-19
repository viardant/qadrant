import type { CSSProperties } from 'react';
import type { TimeEntry } from '../../lib/time-entry';
import { getEntryDurationHours } from '../../lib/transform';
import { EmptyState } from '../ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  entries: TimeEntry[];
  limit?: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatCompactStart(iso: string, now: Date): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEntry = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfEntry.getTime()) / (24 * 60 * 60_000));
  if (diffDays === 0) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `Y_${diffDays}D`;
}

function formatDurationUpper(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  if (hours === 0) return `0H ${pad(minutes)}M`;
  return `${hours}H ${pad(minutes)}M`;
}

const COMPACT_ROW_STYLE: CSSProperties = {
  gridTemplateColumns: '64px minmax(0, 1fr) auto',
  columnGap: '8px',
};

export function RecentActivity({ entries, limit = 5 }: Props) {
  const { isMobile } = useBreakpoint();
  const completed = entries
    .filter((e) => e.completion_time)
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    )
    .slice(0, limit);

  const now = new Date();

  return (
    <section className="section" aria-label="Recent activity">
      <div className="section__head">
        <span className="eyebrow">RECENT_ACTIVITY</span>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
          LAST_{pad(limit)}
        </span>
      </div>
      {completed.length === 0 ? (
        <EmptyState
          title="NO_RECENT_ACTIVITY"
          message="NO_COMPLETED_SESSIONS"
        />
      ) : (
        <div className="recent-list">
          {completed.map((e) => {
            const ms = getEntryDurationHours(e) * 60 * 60_000;
            const label = e.specialization
              ? `${e.space || 'Untitled'} / ${e.specialization}`
              : e.space || 'Untitled';
            return (
              <div
                key={e.id}
                className="recent-row"
                style={isMobile ? COMPACT_ROW_STYLE : undefined}
              >
                <span
                  className="recent-row__time"
                  style={isMobile ? { fontSize: '12px' } : undefined}
                >
                  {formatCompactStart(e.start_date, now)}
                </span>
                <span
                  className="recent-row__label"
                  style={isMobile ? { fontSize: '13px' } : undefined}
                >
                  {label}
                </span>
                <span
                  className="recent-row__duration"
                  style={isMobile ? { fontSize: '12px' } : undefined}
                >
                  {formatDurationUpper(ms)}
                  {!isMobile && <span className="recent-row__caret" aria-hidden> ▸</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
