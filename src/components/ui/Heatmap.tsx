import { useMemo } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface CellData {
  key: string; // dateStr
  intensity: 0 | 1 | 2 | 3;
  date?: Date;
  hours?: number;
}

interface Props {
  cells: CellData[];
}

export function Heatmap({ cells }: Props) {
  const { isMobile } = useBreakpoint();
  const cellSize = isMobile ? 10 : 12;
  const gapSize = 2;

  // 1. Pad cells to align columns with Sundays
  const { paddedCells, monthLabels } = useMemo(() => {
    if (cells.length === 0) {
      return { paddedCells: [], monthLabels: [] as Array<{ text: string; col: number }> };
    }

    // Sort cells chronologically
    const sorted = [...cells].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(a.key);
      const dateB = b.date ? new Date(b.date) : new Date(b.key);
      return dateA.getTime() - dateB.getTime();
    });

    const firstRealDate = sorted[0].date ? new Date(sorted[0].date) : new Date(sorted[0].key);
    const firstDayOfWeek = isNaN(firstRealDate.getTime()) ? 0 : firstRealDate.getDay(); // 0 = Sun, 1 = Mon...

    const padded: Array<CellData & { isPad?: boolean }> = [];
    // Prepend padding cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      padded.push({
        key: `pad-${i}`,
        intensity: 0,
        isPad: true,
      });
    }

    // Append real cells
    padded.push(...sorted);

    // Calculate month labels by looking at the start of each week column
    const labels: Array<{ text: string; col: number }> = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;

    const numCols = Math.ceil(padded.length / 7);
    for (let col = 0; col < numCols; col++) {
      // Look at the first real day in this column (row 0 to 6)
      let firstRealInCol: CellData | null = null;
      for (let r = 0; r < 7; r++) {
        const idx = col * 7 + r;
        if (idx < padded.length && !padded[idx].isPad) {
          firstRealInCol = padded[idx];
          break;
        }
      }

      if (firstRealInCol) {
        const date = firstRealInCol.date ? new Date(firstRealInCol.date) : new Date(firstRealInCol.key);
        if (!isNaN(date.getTime())) {
          const m = date.getMonth();
          if (m !== lastMonth) {
            labels.push({ text: months[m], col });
            lastMonth = m;
          }
        }
      }
    }

    return { paddedCells: padded, monthLabels: labels };
  }, [cells]);

  const colCount = Math.ceil(paddedCells.length / 7);

  const getIntensityClass = (intensity: number) => {
    if (intensity === 0) return 'heatmap-cell--empty';
    if (intensity === 1) return 'heatmap-cell--low';
    if (intensity === 2) return 'heatmap-cell--medium';
    return 'heatmap-cell--high';
  };

  const monthLabelsRow = useMemo(() => {
    const row = Array(colCount).fill('');
    monthLabels.forEach((lbl) => {
      if (lbl.col < colCount) {
        row[lbl.col] = lbl.text;
      }
    });
    return row;
  }, [monthLabels, colCount]);

  return (
    <div
      className="insight-card"
      style={{
        background: 'var(--surface-lowest)',
        border: '1px solid var(--border-muted)',
        padding: 'var(--space-5)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {/* Scrollable grid area */}
      <div
        className="heatmap__scroll"
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          background: `
            linear-gradient(to right, var(--surface-lowest) 30%, transparent),
            linear-gradient(to left, var(--surface-lowest) 30%, transparent) right top,
            radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0)),
            radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0)) right center
          `,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '40px 100%, 40px 100%, 14px 100%, 14px 100%',
          backgroundAttachment: 'local, local, scroll, scroll',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 'max-content',
            gap: '4px',
            margin: isMobile ? '0' : '0 auto',
          }}
        >
          {/* Month labels grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${colCount}, ${cellSize}px)`,
              gap: `${gapSize}px`,
              marginLeft: '32px',
              height: '16px',
              marginBottom: '2px',
            }}
          >
            {monthLabelsRow.map((text, colIdx) => (
              <span
                key={colIdx}
                className="type-tech-mono-sm"
                style={{
                  fontSize: '9px',
                  color: 'var(--fg-subtle)',
                  whiteSpace: 'nowrap',
                  gridColumnStart: colIdx + 1,
                }}
              >
                {text}
              </span>
            ))}
          </div>

          {/* Grid with left labels */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            {/* Weekday labels (subset MON, WED, FRI) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: `${7 * cellSize + 6 * gapSize}px`,
                width: '24px',
                paddingTop: `${cellSize + gapSize}px`, // align MON
                paddingBottom: `${cellSize + gapSize}px`, // align FRI
              }}
            >
              <span className="type-tech-mono-sm" style={{ fontSize: '9px', lineHeight: 1, color: 'var(--fg-muted)' }}>
                MON
              </span>
              <span className="type-tech-mono-sm" style={{ fontSize: '9px', lineHeight: 1, color: 'var(--fg-muted)' }}>
                WED
              </span>
              <span className="type-tech-mono-sm" style={{ fontSize: '9px', lineHeight: 1, color: 'var(--fg-muted)' }}>
                FRI
              </span>
            </div>

            {/* GitHub-style cells grid */}
            <div
              className="heatmap__grid"
              style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateRows: `repeat(7, ${cellSize}px)`,
                gridTemplateColumns: `repeat(${colCount}, ${cellSize}px)`,
                gap: `${gapSize}px`,
              }}
            >
              {paddedCells.map((c) => {
                if (c.isPad) {
                  return (
                    <div
                      key={c.key}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: 'transparent',
                      }}
                    />
                  );
                }

                const hrs = c.hours || 0;
                return (
                  <div
                    key={c.key}
                    title={`${c.key} // ${hrs.toFixed(2)}h playtime`}
                    className={`heatmap-cell ${getIntensityClass(c.intensity)}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      border: c.intensity === 0 ? '1px solid var(--border-muted)' : 'none',
                      borderRadius: '1px',
                      transition: 'background-color 150ms var(--ease-out-soft)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Legend aligned to the right of the grid inside the centered block */}
          <div
            className="heatmap__legend"
            style={{
              alignSelf: 'flex-end',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-2)',
            }}
          >
            <span className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)', fontSize: '10px' }}>
              LESS
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <div
                className="heatmap-cell heatmap-cell--empty"
                style={{
                  width: cellSize,
                  height: cellSize,
                  border: '1px solid var(--border-muted)',
                  borderRadius: '1px',
                }}
              />
              <div
                className="heatmap-cell heatmap-cell--low"
                style={{ width: cellSize, height: cellSize, borderRadius: '1px' }}
              />
              <div
                className="heatmap-cell heatmap-cell--medium"
                style={{ width: cellSize, height: cellSize, borderRadius: '1px' }}
              />
              <div
                className="heatmap-cell heatmap-cell--high"
                style={{ width: cellSize, height: cellSize, borderRadius: '1px' }}
              />
            </div>
            <span className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)', fontSize: '10px' }}>
              MORE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
