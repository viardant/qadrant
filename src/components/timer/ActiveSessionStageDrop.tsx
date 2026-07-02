import { useEffect, useState } from 'react';
import { BeatIndicator } from '../ui/BeatIndicator';
import { formatDuration, type TimeEntry } from '../../lib/time-entry';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  session: TimeEntry;
  beatIndex?: number;
  onStop: (id: string) => void;
  onUpdateStartDate?: (id: string, newStartDate: string) => Promise<void>;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function ActiveSessionStageDrop({ session, beatIndex = -1, onStop, onUpdateStartDate }: Props) {
  const { isDesktop } = useBreakpoint();
  const [activeDuration, setActiveDuration] = useState('00:00:00');

  useEffect(() => {
    const update = () => {
      const start = new Date(session.start_date).getTime();
      const diff = Date.now() - start;
      setActiveDuration(formatDuration(diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session.start_date]);

  const space = session.space || '--';
  const spec = session.specialization || '--';
  const started = formatClock(session.start_date);

  const getLocalTimeValue = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeVal = e.target.value;
    if (!timeVal) return;
    const [hours, minutes] = timeVal.split(':').map(Number);
    const newDate = new Date(session.start_date);
    newDate.setHours(hours, minutes, 0, 0);
    if (onUpdateStartDate) {
      onUpdateStartDate(session.id, newDate.toISOString());
    }
  };

  return (
    <section
      className="stage-drop stage-drop--wide"
      role="status"
      aria-live="polite"
      aria-label={`Active session ${space} ${spec}`}
    >
      <div
        className="stage-drop__grid"
        style={{
          gridTemplateColumns: isDesktop ? 'minmax(0, 1.5fr) minmax(0, 1fr)' : '1fr',
          gap: isDesktop ? '48px' : '0',
        }}
      >
        <div className="stage-drop__primary">
          <div className="stage-drop__eyebrow stage-drop__eyebrow--left">
            <span>▸&nbsp;&nbsp;SESSION_TIMER&nbsp;//&nbsp;ACTIVE_PROTOCOL</span>
          </div>
          <div
            className="stage-drop__number stage-drop__number--left"
            aria-label={`Elapsed ${activeDuration}`}
          >
            {activeDuration}
          </div>
        </div>
        <div className="stage-drop__meta">
          <div className="stage-drop__meta-status">
            <BeatIndicator beats={2} activeIndex={beatIndex} label="Session running" />
            <span className="stage-drop__meta-status-label">RUNNING</span>
          </div>
          <div className="stage-drop__meta-row">
            <span className="stage-drop__meta-label">SPACE</span>
            <span className="stage-drop__meta-value">{space}</span>
          </div>
          <div className="stage-drop__meta-row">
            <span className="stage-drop__meta-label">SPEC</span>
            <span className="stage-drop__meta-value">{spec}</span>
          </div>
          <div className="stage-drop__meta-row">
            <span className="stage-drop__meta-label">STARTED</span>
            <div
              className="stage-drop__time-container"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <input
                type="time"
                value={getLocalTimeValue(session.start_date)}
                onChange={handleTimeChange}
                className="stage-drop__time-overlay-input"
                aria-label="Edit start time"
                title="Click to edit start time"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  zIndex: 2,
                  margin: 0,
                  padding: 0,
                  border: 'none',
                }}
              />
              <span
                className="stage-drop__meta-value stage-drop__meta-value--editable"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              >
                {started}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="stage-drop__stop"
            onClick={() => onStop(session.id)}
            aria-label="Stop session"
          >
            ▢&nbsp;STOP_SESSION
          </button>
        </div>
      </div>
    </section>
  );
}
