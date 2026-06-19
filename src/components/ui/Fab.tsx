import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  children: string;
  onClick: () => void;
  ariaLabel?: string;
  fullWidth?: boolean;
}

export function Fab({ children, onClick, ariaLabel, fullWidth }: Props) {
  const { isDesktop } = useBreakpoint();
  const desktopFullStyle = isDesktop && fullWidth ? { padding: '32px 16px', fontSize: '16px' } as const : undefined;
  return (
    <button
      type="button"
      className="fab btn-ripple"
      onClick={onClick}
      aria-label={ariaLabel ?? children}
      style={desktopFullStyle}
    >
      {children}
    </button>
  );
}
