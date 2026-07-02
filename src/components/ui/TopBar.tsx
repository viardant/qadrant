import type { CSSProperties, ReactNode } from 'react';

interface Metadata {
  archiveId?: string;
  version?: string;
}

interface Props {
  section: string;
  timestamp?: string | null;
  metadata?: Metadata;
  rightSlot?: ReactNode;
  compact?: boolean;
}

export function TopBar({ section, timestamp, metadata, rightSlot, compact = false }: Props) {
  const right = rightSlot ?? (
    metadata?.archiveId ? (
      <span className="top-bar__meta">
        <span>ARCHIVE_ID:&nbsp;{metadata.archiveId}</span>
      </span>
    ) : (
      (timestamp ?? 'NO_RECENT_ACTIVITY')
    )
  );

  const rowStyle: CSSProperties = compact
    ? { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }
    : {};

  return (
    <header className="top-bar">
      <div className="top-bar__row" style={rowStyle}>
        <div className="top-bar__wordmark top-bar__wordmark--accent">
          QADRANT&nbsp;//&nbsp;{section}
        </div>
        {!compact && <div className="top-bar__timestamp">{right}</div>}
      </div>
      <div className="top-bar__rule" />
    </header>
  );
}
