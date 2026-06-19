import { useEffect, useState } from 'react';
import { formatDuration, type TimeEntry } from '../../lib/time-entry';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  session: TimeEntry;
  onStop: (id: string) => void;
}

export function ActiveTimer({ session, onStop }: Props) {
  const { isMobile } = useBreakpoint();
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

  return (
    <div
      className="active-timer"
      role="status"
      aria-live="polite"
      style={isMobile ? {
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'center',
        padding: '32px 20px',
        gap: '16px',
      } : undefined}
    >
      <span className="active-timer__label">
        <span className="active-timer__accent" aria-hidden />
        ACTIVE_PROTOCOL
      </span>
      <span
        className="active-timer__digits"
        aria-label={`Elapsed ${activeDuration}`}
        style={isMobile ? {
          fontSize: 'clamp(40px, 12vw, 56px)',
          alignSelf: 'center',
        } : undefined}
      >
        {activeDuration}
      </span>
      <span className="active-timer__title">
        {session.space || 'Untitled session'}
        {session.specialization && (
          <span className="active-timer__title--sub">//&nbsp;{session.specialization}</span>
        )}
      </span>
      <button
        type="button"
        className="active-timer__stop"
        onClick={() => onStop(session.id)}
        aria-label="Stop session"
        style={isMobile ? {
          width: '100%',
          padding: '16px',
          fontSize: '13px',
        } : undefined}
      >
        ▢&nbsp;STOP_SESSION
      </button>
    </div>
  );
}
