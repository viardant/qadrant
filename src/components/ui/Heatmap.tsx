import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  cells: Array<{ key: string; intensity: 0 | 1 | 2 | 3 }>;
  rowCount?: number;
}

export function Heatmap({ cells, rowCount = 7 }: Props) {
  const { isMobile } = useBreakpoint();
  const cellSize = isMobile ? 12 : 14;
  return (
    <div className="heatmap">
      <div className="heatmap__scroll">
        <div
          className="heatmap__grid"
          style={{ gridTemplateRows: `repeat(${rowCount}, ${cellSize}px)` }}
        >
          {cells.map((c) => {
            const cls =
              c.intensity === 0
                ? ''
                : c.intensity === 1
                ? 'heatmap__cell--low'
                : c.intensity === 2
                ? 'heatmap__cell--mid'
                : 'heatmap__cell--high';
            return (
              <div
                key={c.key}
                className={`heatmap__cell ${cls}`.trim()}
                title={c.key}
                style={{ width: cellSize, height: cellSize }}
              />
            );
          })}
        </div>
      </div>
      <div className="heatmap__legend">
        <span>LESS</span>
        <span className="heatmap__legend-cells">
          <span className="heatmap__cell" />
          <span className="heatmap__cell heatmap__cell--low" />
          <span className="heatmap__cell heatmap__cell--mid" />
          <span className="heatmap__cell heatmap__cell--high" />
        </span>
        <span>MORE</span>
      </div>
    </div>
  );
}
