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
  const hasMetadata = !!(metadata && (metadata.archiveId || metadata.version));
  const right = rightSlot ?? (
    hasMetadata ? (
      <span className="top-bar__meta">
        {metadata?.archiveId && (
          <>
            <span>ARCHIVE_ID:&nbsp;{metadata.archiveId}</span>
            <span className="top-bar__meta-sep">//</span>
          </>
        )}
        {metadata?.version && <span>{metadata.version}</span>}
        {(metadata?.archiveId || metadata?.version) && (
          <>
            <span className="top-bar__meta-sep">//</span>
            <span>⌘K&nbsp;–&nbsp;INDEX</span>
          </>
        )}
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
