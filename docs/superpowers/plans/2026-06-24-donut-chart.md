# Donut Chart & Dynamic Drilldown Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the redundant `RANKED_SPECIALIZATIONS` leaderboard list with a dynamic Donut Chart showing Space distribution by default, and transitioning to Specialization distribution when a Space is clicked (drilled down). Address long lists of spaces by capping the default display to the top 5 with an expand toggle.

**Architecture:** Interactive state transitions and Recharts Donut integration in `src/pages/Stats.tsx`.

**Tech Stack:** React 19, Recharts.

---

## File Structure

- Modify: `src/pages/Stats.tsx` (Remove ranked specialization leaderboard, add donut chart, implement space capping, space click triggers, and responsive layout)

---

### Task 1: UI Implementation of Donut & Scoped List

Refactor the Spaces layout grid inside `Stats.tsx`.

**Files:**
- Modify: `src/pages/Stats.tsx`

- [ ] **Step 1: Implement capped spaces list and Pie/Donut Chart**

Open `src/pages/Stats.tsx`. Update the Recharts import list to include `PieChart`, `Pie`, `Cell`, and `Legend`:

```typescript
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
```

Add the `DONUT_COLORS` constant above the component or inside the file:
```typescript
const DONUT_COLORS = [
  'var(--accent)',
  'var(--accent-soft)',
  'var(--accent-mute)',
  'var(--warn)',
  'var(--fg-muted)',
  'var(--fg-subtle)',
];
```

Inside the `Stats` component, add a new state `showAllSpaces`:
```typescript
  const [showAllSpaces, setShowAllSpaces] = useState<boolean>(false);
```

Update the Space Breakdowns section in the JSX layout (replace the grid containing Space progress bars and Ranked Specializations) with the following structure:

```tsx
          {/* Space Breakdowns & Donut Chart */}
          <section className="section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-8)' }}>
              
              {/* Left Column: Progress Bars */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">
                    {spaceFilter === 'ALL' ? 'SPACE_TIME_ALLOCATION' : `SPECIALIZATION_ALLOCATION // ${spaceFilter.toUpperCase()}`}
                  </span>
                </div>

                {spaceFilter === 'ALL' ? (
                  // All Spaces view
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {stats.spaceList.length === 0 ? (
                      <div className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
                        NO_SPACES_LOGGED
                      </div>
                    ) : (
                      <>
                        {(showAllSpaces ? stats.spaceList : stats.spaceList.slice(0, 5)).map((space) => (
                          <div
                            key={space.name}
                            onClick={() => setSpaceFilter(space.name)}
                            style={{ cursor: 'pointer' }}
                            title="Click to drill down into specializations"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span className="type-tech-mono">{space.name}</span>
                              <span className="type-tech-mono" style={{ fontWeight: 'bold' }}>{formatHours(space.value)}</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--surface-high)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  background: 'var(--accent-soft)',
                                  width: `${space.percentage}%`,
                                  transition: 'width 280ms var(--ease-out-soft)',
                                }}
                              />
                            </div>
                          </div>
                        ))}

                        {stats.spaceList.length > 5 && (
                          <button
                            className="btn btn--ghost"
                            style={{ alignSelf: 'flex-start', padding: 0, fontSize: '11px', height: 'auto', textDecoration: 'underline' }}
                            onClick={() => setShowAllSpaces(!showAllSpaces)}
                          >
                            {showAllSpaces ? '// COLLAPSE' : `// VIEW_ALL_SPACES (${stats.spaceList.length})`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  // Drilldown view for Specializations in selected Space
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-1)' }}>
                      <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                        DRILLDOWN ACTIVE
                      </span>
                      <button
                        className="btn btn--ghost"
                        style={{ padding: 0, fontSize: '11px', height: 'auto', textDecoration: 'underline' }}
                        onClick={() => setSpaceFilter('ALL')}
                      >
                        CLEAR_DRILLDOWN
                      </button>
                    </div>

                    {stats.specList.length === 0 ? (
                      <div className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
                        NO_SPECIALIZATIONS_LOGGED
                      </div>
                    ) : (
                      stats.specList.map((spec) => {
                        const totalSpaceHours = stats.spaceList.find((s) => s.name === spaceFilter)?.value || 1;
                        const percentage = Math.round((spec.value / totalSpaceHours) * 100);
                        return (
                          <div key={spec.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span className="type-tech-mono">{spec.name}</span>
                              <span className="type-tech-mono" style={{ fontWeight: 'bold' }}>{formatHours(spec.value)}</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--surface-high)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  background: 'var(--accent)',
                                  width: `${percentage}%`,
                                  transition: 'width 280ms var(--ease-out-soft)',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Donut Chart */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">
                    {spaceFilter === 'ALL' ? 'DISTRIBUTION_FLOW // SPACES' : `DISTRIBUTION_FLOW // ${spaceFilter.toUpperCase()}_SPECIALIZATIONS`}
                  </span>
                </div>
                
                <div style={{ height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {((spaceFilter === 'ALL' ? stats.spaceList.length : stats.specList.length) === 0) ? (
                    <div className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
                      NO_DISTRIBUTION_DATA
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={spaceFilter === 'ALL' ? stats.spaceList : stats.specList}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {(spaceFilter === 'ALL' ? stats.spaceList : stats.specList).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                          }}
                          formatter={(val: number) => [`${val.toFixed(1)}h`, 'Time']}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>
          </section>
```

- [ ] **Step 2: Build validation**

Run: `npm run build`
Expected: Compile success without any lint or TypeScript errors.

- [ ] **Step 3: Run Vitest**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Stats.tsx
git commit -m "feat(stats): replace ranked leaderboards with dynamic specializations donut chart and list capping"
```
