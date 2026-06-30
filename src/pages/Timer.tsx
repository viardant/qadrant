import { useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { pb } from '../lib/pocketbase';
import { type TimeEntry } from '../lib/time-entry';
import {
  getStreakDays,
  getSessionCount,
  getLastRelative,
  getAggregateStats,
} from '../lib/transform';
import { deriveTopCombos, filterCombos, parseQueryForNewCombo, comboDisplayName, type Combo } from '../lib/combos';
import { TopBar } from '../components/ui/TopBar';
import { StatsStrip } from '../components/ui/StatsStrip';
import { EmptyState } from '../components/ui/EmptyState';
import { ActiveSessionStageDrop } from '../components/timer/ActiveSessionStageDrop';
import { ActiveTimer } from '../components/timer/ActiveTimer';
import { ComboSearch } from '../components/timer/ComboSearch';
import { QuickReplay } from '../components/timer/QuickReplay';
import { RecentActivity } from '../components/timer/RecentActivity';
import { NewComboSheet, type NewComboData } from '../components/timer/NewComboSheet';

function formatHours(hours: number): string {
  if (hours === 0) return '0h 00m';
  if (hours < 1) return `0h ${String(Math.round(hours * 60)).padStart(2, '0')}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${pad(m)}m`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTodayHeader(): string {
  const d = new Date();
  return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}`;
}

const QUICK_REPLAY_LIMIT = 4;

export default function Timer() {
  const { isMobile, isDesktop } = useBreakpoint();
  const [, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<TimeEntry[]>([]);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ id: number; text: string } | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (carouselIndex >= activeSessions.length && activeSessions.length > 0) {
      setCarouselIndex(activeSessions.length - 1);
    }
  }, [activeSessions.length, carouselIndex]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (activeSessions.length === 0) {
      setBeatIndex(-1);
      return;
    }
    const id = setInterval(() => setBeatIndex((i) => (i + 1) % 2), 600);
    return () => clearInterval(id);
  }, [activeSessions.length]);

  const fetchData = async () => {
    if (!pb.authStore.isValid) {
      setLoading(false);
      return;
    }
    try {
      const records = await pb.collection('time_entries').getFullList<TimeEntry>({
        sort: '-start_date',
        filter: `user = "${pb.authStore.model?.id}"`,
        requestKey: null,
      });
      setEntries(records);
      setActiveSessions(records.filter((r) => !r.completion_time));
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

  const allCombosDistinct = useMemo(
    () => deriveTopCombos(entries, Infinity),
    [entries],
  );
  const allCombos = useMemo(
    () => allCombosDistinct.slice(0, QUICK_REPLAY_LIMIT),
    [allCombosDistinct],
  );
  const filteredCombos = useMemo(
    () => filterCombos(allCombosDistinct, query),
    [allCombosDistinct, query],
  );
  const renderedCombos = query.trim() ? filteredCombos : allCombos;
  const totalDistinct = allCombosDistinct.length;
  const parsedQuery = useMemo(() => parseQueryForNewCombo(query), [query]);
  const exactMatchCombo = useMemo(() => {
    if (!parsedQuery) return undefined;
    return filteredCombos.find(
      (c) =>
        c.space.toLowerCase().trim() === parsedQuery.space.toLowerCase().trim() &&
        (c.specialization || '').toLowerCase().trim() === (parsedQuery.specialization || '').toLowerCase().trim(),
    );
  }, [filteredCombos, parsedQuery]);
  const showNewFromQuery =
    query.trim() !== '' && parsedQuery !== null && exactMatchCombo === undefined;
  const renderedWithNewFromQuery = useMemo(() => {
    if (!showNewFromQuery || !parsedQuery) return renderedCombos;
    const queryCombo: Combo = {
      id: '__new_from_query__',
      space: parsedQuery.space,
      specialization: parsedQuery.specialization,
      name: comboDisplayName(parsedQuery.space, parsedQuery.specialization),
      category: 'GENERAL',
      useCount: 0,
      lastUsed: '',
    };
    return [queryCombo, ...renderedCombos];
  }, [showNewFromQuery, parsedQuery, renderedCombos]);
  const stats = useMemo(() => getAggregateStats(entries, new Date()), [entries]);
  const last = useMemo(() => getLastRelative(entries, new Date()), [entries]);

  const topCombo = allCombosDistinct[0];

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
      setQuery('');
      await fetchData();
    } catch (err) {
      console.error('Failed to start combo:', err);
      setError('FAILED_TO_START_COMBINATION');
    }
  };

  const isComboRunning = (space: string, specialization: string): boolean =>
    activeSessions.some(
      (s) =>
        (s.space || '').toLowerCase().trim() === space.toLowerCase().trim() &&
        (s.specialization || '').toLowerCase().trim() === (specialization || '').toLowerCase().trim(),
    );

  const startFromQuery = async () => {
    if (!pb.authStore.isValid || !parsedQuery) return;
    const { space, specialization } = parsedQuery;
    if (isComboRunning(space, specialization)) {
      const label = specialization ? `${space} / ${specialization}` : space;
      setStatus({
        id: Date.now(),
        text: `SAME_PROTOCOLS_SKIP // ${label.toUpperCase()} IS_ALREADY_RUNNING`,
      });
      return;
    }
    try {
      await pb.collection('time_entries').create<TimeEntry>({
        user: pb.authStore.model?.id,
        space,
        specialization,
        start_date: new Date().toISOString(),
      });
      setQuery('');
      await fetchData();
    } catch (err) {
      console.error('Failed to start combo from query:', err);
      setError('FAILED_TO_START_COMBINATION');
    }
  };

  const startLast = async () => {
    if (!topCombo) {
      setStatus({ id: Date.now(), text: 'NO_RECENT_COMBINATION // ARCHIVE_EMPTY' });
      return;
    }
    await startCombo(topCombo);
  };

  const stopFirstSession = async () => {
    const first = activeSessions[0];
    if (!first) return;
    await stopSession(first.id);
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

  const focusSearch = () => {
    const input = searchRef.current;
    if (!input) return;
    input.focus();
    input.select();
    if (typeof input.scrollIntoView === 'function') {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (activeSessions.length > 0) {
          e.preventDefault();
          void stopFirstSession();
        }
        return;
      }

      if (inEditable) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        focusSearch();
        return;
      }

      if (isMod && e.shiftKey && (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp')) {
        e.preventDefault();
        void startLast();
        return;
      }

      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        focusSearch();
        return;
      }

      if (isMod && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setSheetOpen(true);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessions, topCombo]);

  const getSearchFocusableElements = (): HTMLElement[] => {
    const list: HTMLElement[] = [];
    if (searchRef.current) {
      list.push(searchRef.current);
    }
    const comboCards = Array.from(
      document.querySelectorAll('.combo-grid .combo-card')
    ) as HTMLElement[];
    list.push(...comboCards);
    return list;
  };

  useEffect(() => {
    const handleTabNavigation = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (!query.trim()) return;

      const elements = getSearchFocusableElements();
      if (elements.length <= 1) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];

      const isFocusInSearch = elements.includes(activeEl as HTMLElement);
      if (!isFocusInSearch) return;

      if (e.shiftKey) {
        if (activeEl === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (activeEl === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTabNavigation);
    return () => window.removeEventListener('keydown', handleTabNavigation);
  }, [query]);


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

  const archiveId = pb.authStore.model?.id
    ? pb.authStore.model.id.slice(0, 8).toUpperCase()
    : undefined;

  return (
    <>
      <TopBar
        section="TIMER"
        metadata={{ archiveId, version: 'VERIFIED_V2.1' }}
        compact={isMobile}
      />
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

      {activeSessions.length > 0 && (
        <>
          {isMobile ? (
            <div className="active-timer-carousel">
              <ActiveSessionStageDrop
                session={activeSessions[carouselIndex] || activeSessions[0]}
                beatIndex={beatIndex}
                onStop={stopSession}
              />
              {activeSessions.length > 1 && (
                <div className="carousel-controls">
                  <button
                    type="button"
                    className="carousel-btn"
                    onClick={() => setCarouselIndex((i) => (i - 1 + activeSessions.length) % activeSessions.length)}
                    aria-label="Previous active session"
                  >
                    ◀&nbsp;PREV
                  </button>
                  <div className="carousel-dots">
                    {activeSessions.map((s, idx) => (
                      <button
                        type="button"
                        key={s.id}
                        className={`carousel-dot ${idx === carouselIndex ? 'carousel-dot--active' : ''}`}
                        onClick={() => setCarouselIndex(idx)}
                        aria-label={`Go to session ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="carousel-btn"
                    onClick={() => setCarouselIndex((i) => (i + 1) % activeSessions.length)}
                    aria-label="Next active session"
                  >
                    NEXT&nbsp;▶
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <ActiveSessionStageDrop
                session={activeSessions[0]}
                beatIndex={beatIndex}
                onStop={stopSession}
              />
              {activeSessions.length > 1 && (
                <section className="section" aria-label="Additional active sessions">
                  <div className="section__head">
                    <span className="eyebrow">ACTIVE_SESSIONS</span>
                    <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                      {(activeSessions.length - 1).toString().padStart(2, '0')}_MORE
                    </span>
                  </div>
                  <div className="section" style={{ gap: 'var(--space-3)' }}>
                    {activeSessions.slice(1).map((s) => (
                      <ActiveTimer key={s.id} session={s} onStop={stopSession} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <div className="page-stack">
        <ComboSearch
          ref={searchRef}
          value={query}
          onChange={setQuery}
          onEnter={exactMatchCombo ? () => startCombo(exactMatchCombo) : (showNewFromQuery ? startFromQuery : undefined)}
        />
        {activeSessions.length > 0 && query.trim() && filteredCombos.length === 0 && !showNewFromQuery ? (
          <EmptyState
            title="NO_MATCH"
            message={`NO_COMBO_MATCHES_QUERY: ${query.toUpperCase()}`}
          />
        ) : null}
        <QuickReplay
          combos={renderedWithNewFromQuery}
          total={totalDistinct}
          onStart={startCombo}
          onCreate={() => setSheetOpen(true)}
          lastAgo={last}
          highlightedComboId={exactMatchCombo?.id}
          newFromQueryId={showNewFromQuery ? '__new_from_query__' : undefined}
        />
        <button
          type="button"
          className="fab fab--full"
          onClick={() => setSheetOpen(true)}
          aria-label="New combination"
          style={isDesktop ? { padding: '32px 16px', fontSize: '16px' } : undefined}
        >
          +&nbsp;&nbsp;NEW_COMBINATION
        </button>
        <StatsStrip
          eyebrow="TODAY_SNAPSHOT"
          trailing={formatTodayHeader()}
          cells={[
            { label: 'TODAY', value: formatHours(stats.todayHours) },
            { label: 'STREAK', value: `${getStreakDays(entries)}d` },
            { label: 'SESSIONS', value: `${getSessionCount(entries)}` },
          ]}
        />
        <RecentActivity entries={entries} limit={5} />
      </div>

      <NewComboSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={submitNewCombo}
      />
    </>
  );
}
