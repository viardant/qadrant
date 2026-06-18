import type { ReactNode } from 'react';

interface Props {
  section: string;
  timestamp?: string | null;
  rightSlot?: ReactNode;
}

export function TopBar({ section, timestamp, rightSlot }: Props) {
  return (
    <header className="top-bar">
      <div className="top-bar__row">
        <div className="top-bar__wordmark top-bar__wordmark--accent">
          QADRANT&nbsp;//&nbsp;{section}
        </div>
        <div className="top-bar__timestamp">
          {rightSlot ?? (timestamp ?? 'NO_RECENT_ACTIVITY')}
        </div>
      </div>
      <div className="top-bar__rule" />
    </header>
  );
}
