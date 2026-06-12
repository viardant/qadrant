import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { TimeEntry } from '../components/logger/TaskLogger';
import { Loader2, Edit3, Trash2, X, Save } from 'lucide-react';

const PAGE_SIZE = 20;

export default function Ledger() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editTask, setEditTask] = useState('');
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
        filter: `completed = true && user = "${pb.authStore.model?.id}"`,
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log entry?')) {
      return;
    }
    try {
      await pb.collection('time_entries').delete(id);
      // If we deleted the last item on the current page, go back a page if possible
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

  const handleOpenEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditTask(entry.task || '');
    setEditSpace(entry.space || '');
    setEditSpecialization(entry.specialization || '');
    setEditStartDate(toDatetimeLocal(entry.start_date));
    setEditCompletionTime(toDatetimeLocal(entry.completion_time));
  };

  const handleCloseEdit = () => {
    setEditingEntry(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const trimmedTask = editTask.trim();
    if (!trimmedTask) {
      alert('Task name cannot be empty.');
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

      await pb.collection('time_entries').update(editingEntry.id, {
        task: trimmedTask,
        space: editSpace,
        specialization: editSpecialization,
        start_date: startIso,
        completion_time: completionIso,
      });

      handleCloseEdit();
      await fetchEntries();
    } catch (err) {
      console.error('Failed to update entry:', err);
      alert('Failed to save log entry edits.');
    }
  };


  const toDatetimeLocal = (isoString: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const fromDatetimeLocal = (localString: string) => {
    if (!localString) return null;
    const d = new Date(localString);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const computeDuration = (start: string, end: string | null) => {
    if (!start || !end) return '0.00';
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    if (diffMs <= 0 || isNaN(diffMs)) return '0.00';
    const hours = diffMs / (1000 * 60 * 60);
    return hours.toFixed(2);
  };

  return (
    <div className="ledger-page-container flex flex-col gap-6">
      <div className="ledger-header">
        <div>
          <h1 className="text-3xl font-bold font-mono" style={{ marginBottom: '0.25rem' }}>LEDGER_PROTOCOL</h1>
          <p className="font-mono text-sm text-on-surface/60" style={{ marginBottom: 0 }}>Review, refine, and manage historical work records.</p>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="loader-container">
          <Loader2 className="spinner" size={32} />
          <span className="font-mono text-sm text-on-surface/60">SYNCHRONIZING_LEDGER_DATA...</span>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Space</th>
                  <th>Specialization</th>
                  <th>Start Date</th>
                  <th>Stop Date</th>
                  <th>Duration</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(28, 27, 28, 0.4)' }}>
                      NO_COMPLETED_TIME_ENTRIES_FOUND
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 600 }}>{entry.task || 'UNNAMED_TASK'}</td>
                      <td>
                        <span className="font-mono text-xs px-2 py-0.5 border border-outline rounded bg-outline-light">
                          {entry.space || '-'}
                        </span>
                      </td>
                      <td>{entry.specialization || '-'}</td>
                      <td>{formatDate(entry.start_date)}</td>
                      <td>{formatDate(entry.completion_time)}</td>
                      <td style={{ fontWeight: 'bold' }}>{computeDuration(entry.start_date, entry.completion_time)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn-small btn-edit flex items-center gap-1"
                            onClick={() => handleOpenEdit(entry)}
                            aria-label="Edit"
                          >
                            <Edit3 size={12} />
                            <span>EDIT</span>
                          </button>
                          <button
                            className="btn-small btn-delete flex items-center gap-1"
                            onClick={() => handleDelete(entry.id)}
                            aria-label="Delete"
                          >
                            <Trash2 size={12} />
                            <span>DELETE</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="ledger-pagination">
              <span className="pagination-info">
                SHOWING {entries.length} OF {totalItems} RECORDS (PAGE {page}/{totalPages})
              </span>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  aria-label="Prev"
                >
                  PREV
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  aria-label="Next"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Modal Dialog */}
      {editingEntry && (
        <div className="terminal-modal-overlay" onClick={handleCloseEdit}>
          <div className="terminal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-outline pb-2">
              <h2 className="terminal-modal-title">EDIT_RECORD_PROTOCOL</h2>
              <button
                onClick={handleCloseEdit}
                style={{ background: 'transparent', color: 'var(--text-on-surface)', border: 'none', padding: 0 }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="terminal-modal-body">
              <div className="input-group">
                <label htmlFor="modal-task">Task</label>
                <input
                  id="modal-task"
                  type="text"
                  value={editTask}
                  onChange={(e) => setEditTask(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="modal-space">Space</label>
                <input
                  id="modal-space"
                  type="text"
                  value={editSpace}
                  onChange={(e) => setEditSpace(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label htmlFor="modal-spec">Specialization</label>
                <input
                  id="modal-spec"
                  type="text"
                  value={editSpecialization}
                  onChange={(e) => setEditSpecialization(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label htmlFor="modal-start">Start Date & Time</label>
                <input
                  id="modal-start"
                  type="datetime-local"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="modal-stop">Stop Date & Time</label>
                <input
                  id="modal-stop"
                  type="datetime-local"
                  value={editCompletionTime}
                  onChange={(e) => setEditCompletionTime(e.target.value)}
                  required
                />
              </div>

              <div className="terminal-modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseEdit}>
                  CANCEL
                </button>
                <button type="submit" className="flex items-center gap-1" aria-label="Save">
                  <Save size={14} />
                  <span>SAVE_CHANGES</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
