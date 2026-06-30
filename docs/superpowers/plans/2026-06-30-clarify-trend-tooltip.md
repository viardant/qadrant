# Clarify DAILY_TREND_VECTORS Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename tooltip item labels in the `DAILY_TREND_VECTORS` line chart to `CURRENT` and `BASELINE` to clearly differentiate them.

**Architecture:** Modify the lines in the `<ComposedChart>` within `src/pages/Stats.tsx` by setting explicit `name` properties on each `<Line>` component.

**Tech Stack:** React, TypeScript, Recharts

---

### Task 1: Update Chart Line Names in Stats Page

**Files:**
- Modify: `src/pages/Stats.tsx`

- [ ] **Step 1: Set name properties on chart lines**

Update the line chart components inside `src/pages/Stats.tsx` around line 803-820 to include the `name` prop:
- Change the `hours` line name to `"CURRENT"`
- Change the `rollingAvg` line name to `"BASELINE"`

```tsx
                    <Line
                      type="monotone"
                      dataKey="hours"
                      name="CURRENT"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--accent)' }}
                    />
                    {/* Baseline helper marker */}
                    <Line
                      type="monotone"
                      dataKey={() => stats.rollingAvg}
                      name="BASELINE"
                      stroke="var(--fg-subtle)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      dot={false}
                    />
```

- [ ] **Step 2: Verify project compilation**

Run: `npm run build`
Expected: Compilation passes with no errors.

- [ ] **Step 3: Verify tests pass**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit changes**

Run:
```bash
git add src/pages/Stats.tsx
git commit -m "feat(stats): clarify trend tooltip labels as CURRENT and BASELINE"
```
