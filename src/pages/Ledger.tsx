import { useState, useEffect, useCallback } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { pb } from '../lib/pocketbase';
import type { TimeEntry } from '../lib/time-entry';
import { TopBar } from '../components/ui/TopBar';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { BeatIndicator } from '../components/ui/BeatIndicator';
import { getEntryDurationHours } from '../lib/transform';

const PAGE_SIZE = 20;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export default function Ledger() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [beatIdx, setBeatIdx] = useState(0);
  const { isMobile } = useBreakpoint();

  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [editSpace, setEditSpace] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editCompletionTime, setEditCompletionTime] = useState('');

  const fetchEntries = useCallback(async () => {
    if (!pb.authStore.isValid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await pb.collection('time_entries').getList<TimeEntry>(page, PAGE_SIZE, {
        sort: '-start_date',
        filter: `completion_time != "" && user = "${pb.authStore.model?.id}"`,
        requestKey: null,
      });
      setEntries(result.items);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
    } catch (err) {
      console.error('Failed to fetch ledger logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setBeatIdx((i) => (i + 1) % 4), 200);
    return () => clearInterval(interval);
  }, [loading]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log entry?')) return;
    try {
      await pb.collection('time_entries').delete(id);
      if (entries.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await fetchEntries();
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete time entry record.');
    }
  };

  const openEdit = (entry: TimeEntry) => {
    setEditing(entry);
    setEditSpace(entry.space || '');
    setEditSpecialization(entry.specialization || '');
    setEditStartDate(toDatetimeLocal(entry.start_date));
    setEditCompletionTime(toDatetimeLocal(entry.completion_time));
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const trimmedSpace = editSpace.trim();
    if (!trimmedSpace) {
      alert('Space name cannot be empty.');
      return;
    }
    try {
      const startIso = fromDatetimeLocal(editStartDate);
      const completionIso = fromDatetimeLocal(editCompletionTime);
      if (!startIso) {
        alert('Start date and time is required.');
        return;
      }
      if (startIso && completionIso) {
        const start = new Date(startIso);
        const end = new Date(completionIso);
        if (end <= start) {
          alert('Stop date and time must be chronologically after the start date and time.');
          return;
        }
      }
      await pb.collection('time_entries').update(editing.id, {
        space: trimmedSpace,
        specialization: editSpecialization,
        start_date: startIso,
        completion_time: completionIso,
      });
      closeEdit();
      await fetchEntries();
    } catch (err) {
      console.error('Failed to update entry:', err);
      alert('Failed to save log entry edits.');
    }
  };

  const toDatetimeLocal = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  const fromDatetimeLocal = (local: string) => {
    if (!local) return null;
    const d = new Date(local);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <>
      <TopBar section="LEDGER" timestamp={`PAGE_${pad(page)}_OF_${pad(Math.max(totalPages, 1))}`} />

      {loading ? (
        <div
          className="section"
          style={{ alignItems: 'center', padding: 'var(--space-12) 0', gap: 'var(--space-4)' }}
        >
          <BeatIndicator activeIndex={beatIdx} label="Synchronizing" />
          <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
            SYNCHRONIZING_LEDGER…
          </span>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="LEDGER_EMPTY"
          message="NO_COMPLETED_TIME_ENTRIES_FOUND"
          actionLabel=">>> NEW_SESSION"
          onAction={() => (window.location.href = '/')}
        />
      ) : (
        <section className="section">
          <div className="section__head">
            <span className="eyebrow">ARCHIVE_PROTOCOL</span>
            <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
              {pad(entries.length)}_OF_{pad(totalItems)}_RECORDS
            </span>
          </div>
          <div className="ledger-list">
            {entries.map((e) => {
              const hours = getEntryDurationHours(e);
              return (
                <div key={e.id} className="ledger-row" style={isMobile ? { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px', padding: '16px 0' } : undefined}>
                  <div className="ledger-row__main" style={isMobile ? { gap: '8px' } : undefined}>
                    <button
                      type="button"
                      className="ledger-row__title ledger-row__title--tunable"
                      onClick={() => openEdit(e)}
                      aria-label={`Edit ${e.space}`}
                      style={{
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        ...(isMobile ? { whiteSpace: 'normal', overflowWrap: 'break-word', fontSize: '15px', lineHeight: '1.35' } : {}),
                      }}
                    >
                      {e.space || 'Untitled'}
                      {e.specialization && (
                        <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}>
                          &nbsp;//&nbsp;{e.specialization}
                        </span>
                      )}
                    </button>
                    <div className="ledger-row__meta" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } : undefined}>
                      <span>START: {formatDate(e.start_date)}</span>
                      <span>STOP: {formatDate(e.completion_time)}</span>
                    </div>
                  </div>
                  <div className="ledger-row__actions" style={isMobile ? { justifyContent: 'space-between', width: '100%', paddingTop: '8px', borderTop: '1px solid var(--border-muted)' } : undefined}>
                    <span className="ledger-stat">
                      {hours.toFixed(2)}<span className="ledger-stat__unit">h</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => handleDelete(e.id)}
                      aria-label="Delete entry"
                      style={isMobile ? { minWidth: '44px', minHeight: '44px' } : undefined}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="ledger-pagination" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: '12px' } : undefined}>
              <span className="ledger-pagination__info" style={isMobile ? { textAlign: 'center' } : undefined}>
                SHOWING {pad(entries.length)}_OF_{pad(totalItems)}_RECORDS&nbsp;//&nbsp;PAGE_{pad(page)}_OF_{pad(totalPages)}
              </span>
              <div className="ledger-pagination__buttons">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  aria-label="Prev"
                  style={isMobile ? { flex: 1, minHeight: '44px' } : undefined}
                >
                  &lt;&nbsp;PREV
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  aria-label="Next"
                  style={isMobile ? { flex: 1, minHeight: '44px' } : undefined}
                >
                  NEXT&nbsp;&gt;
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <Modal
        open={!!editing}
        onClose={closeEdit}
        title="▸&nbsp;&nbsp;EDIT_RECORD_PROTOCOL"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeEdit}>
              CANCEL
            </button>
            <button type="submit" form="edit-form" className="btn btn--filled">
              {'>>> SAVE'}
            </button>
          </>
        }
      >
        <form id="edit-form" onSubmit={saveEdit} className="section" style={{ gap: 'var(--space-4)' }}>
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">SPACE</span>
            <input
              type="text"
              className="input input--inline"
              value={editSpace}
              onChange={(e) => setEditSpace(e.target.value)}
              required
            />
          </label>
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">SPECIALIZATION</span>
            <input
              type="text"
              className="input input--inline"
              value={editSpecialization}
              onChange={(e) => setEditSpecialization(e.target.value)}
            />
          </label>
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">START_DATETIME</span>
            <input
              type="datetime-local"
              className="input"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              required
            />
          </label>
          <label className="section" style={{ gap: 'var(--space-2)' }}>
            <span className="eyebrow">STOP_DATETIME</span>
            <input
              type="datetime-local"
              className="input"
              value={editCompletionTime}
              onChange={(e) => setEditCompletionTime(e.target.value)}
              required
            />
          </label>
        </form>
      </Modal>
    </>
  );
}
