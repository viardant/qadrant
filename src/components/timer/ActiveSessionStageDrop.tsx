import { useEffect, useState } from 'react';
import { BeatIndicator } from '../ui/BeatIndicator';
import { formatDuration, type TimeEntry } from '../../lib/time-entry';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  session: TimeEntry;
  beatIndex?: number;
  onStop: (id: string) => void;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function ActiveSessionStageDrop({ session, beatIndex = -1, onStop }: Props) {
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
            <span className="stage-drop__meta-value">{started}</span>
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
