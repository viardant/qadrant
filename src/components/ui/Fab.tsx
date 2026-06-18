interface Props {
  children: string;
  onClick: () => void;
  ariaLabel?: string;
}

export function Fab({ children, onClick, ariaLabel }: Props) {
  return (
    <button
      type="button"
      className="fab btn-ripple"
      onClick={onClick}
      aria-label={ariaLabel ?? children}
    >
      {children}
    </button>
  );
}
