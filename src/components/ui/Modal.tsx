import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: Props) {
  const { isMobile } = useBreakpoint();
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
      style={isMobile ? { alignItems: 'flex-start', padding: '24px 16px', overflowY: 'auto' as const } : undefined}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={isMobile ? { margin: 'auto 0', width: '100%', maxWidth: 'none', padding: '20px' } : undefined}
      >
        <div className="modal__title">{title}</div>
        {children}
        {footer && (
          <div className="modal__actions" style={isMobile ? { flexDirection: 'column-reverse', alignItems: 'stretch' } : undefined}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
