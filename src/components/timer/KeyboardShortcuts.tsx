import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Shortcut {
  keys: string;
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: '⌘K', label: 'SEARCH_COMBO' },
  { keys: '⌘N', label: 'NEW_COMBINATION' },
  { keys: '⌘⇧', label: 'START_LAST' },
  { keys: 'SPACE', label: 'PAUSE / RESUME' },
  { keys: 'ESC', label: 'STOP_SESSION' },
];

export function KeyboardShortcuts() {
  const { isDesktop } = useBreakpoint();
  if (!isDesktop) return null;
  return (
    <section className="section shortcuts" aria-label="Keyboard shortcuts">
      <div className="section__head">
        <span className="eyebrow">KEYBOARD</span>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
          SHORTCUTS
        </span>
      </div>
      <ul className="shortcuts__list">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="shortcuts__row">
            <span className="shortcuts__kbd" aria-hidden>{s.keys}</span>
            <span className="shortcuts__label">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
