# Deprecate Delta Annotation & Fix Monday Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deprecate the `DELTA_ANNOTATION` checkbox, enable comparison deltas unconditionally for all scopes except `ALL_TIME`, fix the `todayDelta` calculation order in `Stats.tsx`, and format the comparison values properly.

**Architecture:** Modify `src/pages/Stats.tsx` to calculate and expose `todayDelta` correctly, and update `InsightCard` elements to display comparison values unconditionally when the scope is not `ALL_TIME`.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Expose and Fix `todayDelta` Calculation

**Files:**
- Modify: `src/pages/Stats.tsx`

- [ ] **Step 1: Reorder variables and expose `todayDelta` in stats `useMemo`**

Move the declaration of `todayHours` above `todayDelta` and return `todayDelta` from the `useMemo` hook.

```typescript
    const todayHours = currentFiltered
      .filter((e) => new Date(e.start_date).toDateString() === now.toDateString())
      .reduce((sum, e) => sum + getEntryDurationHours(e), 0);

    const bounds = getScopeBounds(scope, now);
    let numDaysElapsed = 1;
    if (bounds.start) {
      const diffTime = now.getTime() - bounds.start.getTime();
      numDaysElapsed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
    const todayDelta = todayHours - (priorTotalSecs / numDaysElapsed);
```

Ensure `todayDelta` is returned from `useMemo`:
```typescript
    return {
      last,
      velocity,
      modal,
      totalHours: totalSecs,
      todayHours,
      todayDelta,
      weekHours,
      streak,
      deepWork,
      priorHours: priorTotalSecs,
      priorStreak,
      priorDeepWork,
      weekdayData,
      heatmapCells,
      startTimeData,
      sessionBuckets,
      spaceList,
      specList,
      leaderboard,
      wowTrend,
      trend: trend30,
      rollingAvg,
      records,
      milestoneBadges,
      yearHeatmapCells,
    };
```

---

### Task 2: Update InsightCard Captions

**Files:**
- Modify: `src/pages/Stats.tsx`

- [ ] **Step 1: Update card captions in `src/pages/Stats.tsx`**

Replace the existing `InsightCard` components for `TODAY_PLAYTIME`, `STREAK`, and `DEEP_WORK_RATIO` to display deltas unconditionally when the scope is not `ALL_TIME`.

For `TODAY_PLAYTIME`:
```tsx
              <InsightCard
                eyebrow="TODAY_PLAYTIME"
                value={formatHours(stats.todayHours)}
                caption={`// TIME_LOGGED_TODAY ${
                  scope !== 'ALL_TIME'
                    ? `(Δ ${stats.todayDelta >= 0 ? '+' : '-'}${formatHours(Math.abs(stats.todayDelta))})`
                    : ''
                }`}
                compact={isMobile}
              />
```

For `STREAK`:
```tsx
              <InsightCard
                eyebrow="STREAK"
                value={`${stats.streak}d`}
                caption={`// CONSECUTIVE ${
                  scope !== 'ALL_TIME'
                    ? `(Δ ${stats.streak - stats.priorStreak >= 0 ? '+' : ''}${stats.streak - stats.priorStreak}d)`
                    : ''
                }`}
                compact={isMobile}
              />
```

For `DEEP_WORK_RATIO`:
```tsx
              <InsightCard
                eyebrow="DEEP_WORK_RATIO"
                value={`${stats.deepWork}%`}
                caption={`// SESSIONS >= 90m ${
                  scope !== 'ALL_TIME'
                    ? `(Δ ${stats.deepWork - stats.priorDeepWork >= 0 ? '+' : ''}${(stats.deepWork - stats.priorDeepWork).toFixed(1)}%)`
                    : ''
                }`}
                compact={isMobile}
              />
```

---

### Task 3: Build Verification

**Files:**
- Run verification command

- [ ] **Step 1: Run TypeScript compiler and project build**

Run: `npm run build`
Expected: Successfully compiles and bundles with no errors.

- [ ] **Step 2: Run test suite**

Run: `npm run test`
Expected: All tests pass.

---

### Task 4: Git Handoff

**Files:**
- Git repository

- [ ] **Step 1: Commit changes to `dev` branch**

Run:
```bash
git add src/pages/Stats.tsx
git commit -m "feat(stats): deprecate showDelta and make delta comparison always-on"
```

- [ ] **Step 2: Merge `dev` to `master` and switch back to `dev`**

Run:
```bash
git checkout master
git merge dev
git checkout dev
```
