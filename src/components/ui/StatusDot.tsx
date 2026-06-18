interface Props {
  variant?: 'muted' | 'subtle' | 'default';
  label?: string;
}

export function StatusDot({ variant = 'default', label }: Props) {
  const cls =
    variant === 'muted' ? 'status-dot--muted' : variant === 'subtle' ? 'status-dot--subtle' : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span className={`status-dot ${cls}`.trim()} aria-hidden />
      {label && <span className="type-tech-mono">{label}</span>}
    </span>
  );
}
