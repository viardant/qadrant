interface Props {
  beats?: number;
  activeIndex?: number;
  label?: string;
}

export function BeatIndicator({ beats = 4, activeIndex = -1, label }: Props) {
  return (
    <span className="beat" role="status" aria-label={label ?? 'Loading'}>
      {Array.from({ length: beats }).map((_, i) => (
        <span
          key={i}
          className={`beat__dot ${i === activeIndex ? 'beat__dot--active' : ''}`.trim()}
        />
      ))}
    </span>
  );
}
