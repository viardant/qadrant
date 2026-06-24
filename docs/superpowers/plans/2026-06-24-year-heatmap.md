# Year Heatmap Re-implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement a GitHub-like year consistency heatmap with month labels on top, Mon/Wed/Fri subset labels on the left, refined cells using `--accent` colors and hover tooltips, and integrate it back into the stats page.

**Architecture:** Functional padding and formatting in `Heatmap.tsx`. State integration in `Stats.tsx` feeding the 365-day cells.

**Tech Stack:** React 19, TypeScript, CSS.

---

## File Structure

- Modify: `src/components/ui/Heatmap.tsx` (Complete redesign of the heatmap component to render labels and grid)
- Modify: `src/pages/Stats.tsx` (Add back the 365-day heatmap data aggregation and render `<Heatmap>` under stage drop)
- Modify: `src/lib/transform.ts` (Export `hoursToIntensity` helper function)

---

### Task 1: Helper Export & Calculation Setup

Ensure `hoursToIntensity` is available for stats mapping.

**Files:**
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Export hoursToIntensity helper in src/lib/transform.ts**

Add or export the helper:
```typescript
export function hoursToIntensity(h: number): 0 | 1 | 2 | 3 {
  if (h <= 0) return 0;
  if (h < 1) return 1;
  if (h < 3) return 2;
  return 3;
}
```

- [ ] **Step 2: Verify Vitest**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/transform.ts
git commit -m "feat: export hoursToIntensity helper"
```

---

### Task 2: Redesign Heatmap Component

Rewrite `Heatmap.tsx` to handle grid padding, top month labels, and left day subset labels.

**Files:**
- Modify: `src/components/ui/Heatmap.tsx`

- [ ] **Step 1: Implement the component layout and logic in Heatmap.tsx**

Replace `src/components/ui/Heatmap.tsx` with:

```tsx
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

  return (
    <div className="heatmap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      
      {/* Scrollable grid area */}
      <div className="heatmap__scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 'max-content', gap: '4px' }}>
          
          {/* Month labels header */}
          <div style={{ position: 'relative', height: '16px', marginLeft: '32px', marginBottom: '2px' }}>
            {monthLabels.map((lbl, idx) => (
              <span
                key={idx}
                className="type-tech-mono-sm"
                style={{
                  position: 'absolute',
                  left: `${lbl.col * (cellSize + gapSize)}px`,
                  fontSize: '9px',
                  color: 'var(--fg-subtle)',
                  whiteSpace: 'nowrap',
                }}
              >
                {lbl.text}
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
              <span className="type-tech-mono-sm" style={{ fontSize: '9px', lineHeight: 1, color: 'var(--fg-muted)' }}>MON</span>
              <span className="type-tech-mono-sm" style={{ fontSize: '9px', lineHeight: 1, color: 'var(--fg-muted)' }}>WED</span>
              <span className="type-tech-mono-sm" style={{ fontSize: '9px', lineHeight: 1, color: 'var(--fg-muted)' }}>FRI</span>
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
              {paddedCells.map((c, idx) => {
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

        </div>
      </div>

      {/* Legend */}
      <div className="heatmap__legend" style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)', fontSize: '10px' }}>LESS</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <div className="heatmap-cell heatmap-cell--empty" style={{ width: cellSize, height: cellSize, border: '1px solid var(--border-muted)', borderRadius: '1px' }} />
          <div className="heatmap-cell heatmap-cell--low" style={{ width: cellSize, height: cellSize, borderRadius: '1px' }} />
          <div className="heatmap-cell heatmap-cell--medium" style={{ width: cellSize, height: cellSize, borderRadius: '1px' }} />
          <div className="heatmap-cell heatmap-cell--high" style={{ width: cellSize, height: cellSize, borderRadius: '1px' }} />
        </div>
        <span className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)', fontSize: '10px' }}>MORE</span>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Heatmap.tsx
git commit -m "feat: redesign Heatmap component with github-like calendar styling"
```

---

### Task 3: Integrate and Display in Stats page

Update `Stats.tsx` to compute 365-day cells and mount the new `<Heatmap>` component under the Stage Drop.

**Files:**
- Modify: `src/pages/Stats.tsx`

- [ ] **Step 1: Import Heatmap and aggregate 365-day cells**

In `src/pages/Stats.tsx`:
1. Import `Heatmap` from `../components/ui/Heatmap`
2. In the `useMemo` of `stats`, calculate the 365-day cells:
```typescript
    // 365-day session consistency
    const daily365 = getDailyTotals(currentFiltered, 365, now);
    const yearHeatmapCells = daily365.map((d) => ({
      key: d.dateStr,
      intensity: hoursToIntensity(d.hours),
      date: d.date,
      hours: d.hours,
    }));
```
3. Return `yearHeatmapCells` from the `useMemo` block.
4. Render the `<Heatmap>` component in a new section between `StageDrop` and the metrics grid, styled with:
```tsx
          <section className="section" aria-label="Session consistency heatmap">
            <div className="section__head">
              <span className="eyebrow">SESSION_CONSISTENCY</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                365_DAYS
              </span>
            </div>
            <Heatmap cells={stats.yearHeatmapCells} />
          </section>
```

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Stats.tsx
git commit -m "feat: integrate 365-day session consistency heatmap into stats page"
```
