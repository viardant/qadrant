interface Props {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__line empty-state__line--accent">{title}</div>
      <div>{message}</div>
      {actionLabel && onAction && (
        <div>
          <button type="button" className="empty-state__action" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
