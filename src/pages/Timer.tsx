import { useEffect, useMemo, useRef, useState } from 'react';
import { pb } from '../lib/pocketbase';
import { type TimeEntry } from '../lib/time-entry';
import {
  getStreakDays,
  getSessionCount,
  getLastRelative,
  getAggregateStats,
} from '../lib/transform';
import { deriveTopCombos, filterCombos, type Combo } from '../lib/combos';
import { TopBar } from '../components/ui/TopBar';
import { StatsStrip } from '../components/ui/StatsStrip';
import { EmptyState } from '../components/ui/EmptyState';
import { ActiveTimer } from '../components/timer/ActiveTimer';
import { ComboSearch } from '../components/timer/ComboSearch';
import { QuickReplay } from '../components/timer/QuickReplay';
import { NewComboSheet, type NewComboData } from '../components/timer/NewComboSheet';

function formatHours(hours: number): string {
  if (hours === 0) return '0m';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function Timer() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<TimeEntry[]>([]);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ id: number; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3500);
    return () => clearTimeout(t);
  }, [status]);

  const fetchData = async () => {
    if (!pb.authStore.isValid) {
      setLoading(false);
      return;
    }
    try {
      const records = await pb.collection('time_entries').getList<TimeEntry>(1, 200, {
        sort: '-start_date',
        filter: `user = "${pb.authStore.model?.id}"`,
        requestKey: null,
      });
      setEntries(records.items);
      setActiveSessions(records.items.filter((r) => !r.completion_time));
    } catch (err) {
      console.error('Failed to load timer data:', err);
      setError('FAILED_TO_LOAD_ARCHIVE');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const input = searchRef.current;
        if (input) {
          input.focus();
          input.select();
          if (typeof input.scrollIntoView === 'function') {
            input.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allCombos = useMemo(() => deriveTopCombos(entries, 6), [entries]);
  const filteredCombos = useMemo(() => filterCombos(allCombos, query), [allCombos, query]);
  const stats = useMemo(() => getAggregateStats(entries, new Date()), [entries]);
  const last = useMemo(() => getLastRelative(entries, new Date()), [entries]);

  const startCombo = async (combo: Combo) => {
    if (!pb.authStore.isValid) return;
    const isSameCombo = activeSessions.some(
      (s) =>
        (s.space || '').toLowerCase().trim() === combo.space.toLowerCase().trim() &&
        (s.specialization || '').toLowerCase().trim() === (combo.specialization || '').toLowerCase().trim(),
    );
    if (isSameCombo) {
      const label = combo.specialization ? `${combo.space} / ${combo.specialization}` : combo.space;
      setStatus({
        id: Date.now(),
        text: `SAME_PROTOCOLS_SKIP // ${label.toUpperCase()} IS_ALREADY_RUNNING`,
      });
      return;
    }
    try {
      await pb.collection('time_entries').create<TimeEntry>({
        user: pb.authStore.model?.id,
        space: combo.space,
        specialization: combo.specialization,
        start_date: new Date().toISOString(),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to start combo:', err);
      setError('FAILED_TO_START_COMBINATION');
    }
  };

  const stopSession = async (id: string) => {
    try {
      await pb.collection('time_entries').update(id, {
        completion_time: new Date().toISOString(),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to stop session:', err);
      setError('FAILED_TO_STOP_SESSION');
    }
  };

  const submitNewCombo = async (data: NewComboData) => {
    if (!pb.authStore.isValid) return;
    const now = new Date().toISOString();
    try {
      await pb.collection('time_entries').create<TimeEntry>({
        user: pb.authStore.model?.id,
        space: data.space,
        specialization: data.specialization,
        start_date: now,
        completion_time: data.start ? null : now,
      });
      setSheetOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to save combination:', err);
      setError('FAILED_TO_SAVE_COMBINATION');
    }
  };

  return (
    <>
      <TopBar section="TIMER" timestamp={loading ? 'SYNCHRONIZING…' : last} />
      {error && (
        <div className="empty-state" role="alert" style={{ padding: 'var(--space-3) 0' }}>
          <div className="empty-state__line empty-state__line--accent">WARN</div>
          <div>{error}</div>
        </div>
      )}
      {status && (
        <div className="status-pill status-pill--warn" role="status" aria-live="polite">
          <span className="status-pill__label">WARN</span>
          <span className="status-pill__text">{status.text}</span>
          <button
            type="button"
            className="status-pill__close"
            onClick={() => setStatus(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <StatsStrip
        cells={[
          { label: 'TODAY', value: formatHours(stats.todayHours) },
          { label: 'STREAK', value: `${getStreakDays(entries)}d` },
          { label: 'SESSIONS', value: `${getSessionCount(entries)}` },
        ]}
      />
      <ComboSearch ref={searchRef} value={query} onChange={setQuery} />
      {activeSessions.length === 0 ? (
        query.trim() && filteredCombos.length === 0 ? (
          <EmptyState
            title="NO_MATCH"
            message={`NO_COMBO_MATCHES_QUERY: ${query.toUpperCase()}`}
          />
        ) : null
      ) : (
        <section className="section" aria-label="Active sessions">
          <div className="section__head">
            <span className="eyebrow">ACTIVE_SESSIONS</span>
            <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
              {activeSessions.length.toString().padStart(2, '0')}_RUNNING
            </span>
          </div>
          <div className="section" style={{ gap: 'var(--space-3)' }}>
            {activeSessions.map((s) => (
              <ActiveTimer key={s.id} session={s} onStop={stopSession} />
            ))}
          </div>
        </section>
      )}
      <QuickReplay
        combos={filteredCombos}
        total={allCombos.length}
        onStart={startCombo}
        onCreate={() => setSheetOpen(true)}
      />
      <NewComboSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={submitNewCombo}
      />
    </>
  );
}
