# Enriched Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the stats page with time-shape insights (weekday distribution, hour-of-week daytime heatmap, start time heatmap, session duration buckets, deep work ratio), space/specialization drill-downs, period-over-period comparison deltas, rolling average baseline, and archive milestone logs.

**Architecture:** Functional data processing in `src/lib/transform.ts` with 100% test coverage in `src/lib/transform.test.ts`. State management for timeframe scope, space filter, and comparisons resides in `src/pages/Stats.tsx` with dynamic rendering of charts, grid heatmaps, and text histograms.

**Tech Stack:** React 19, TypeScript, Recharts (v2), Vitest.

---

## File Structure

- Modify: `src/lib/transform.ts` (Implement all helper calculations and aggregation functions)
- Modify: `src/lib/transform.test.ts` (Add unit tests verifying calculations, timezone boundaries, and edge cases)
- Modify: `src/pages/Stats.tsx` (Enrich UI layout, filters, heatmaps, charts, lists, and milestones)

---

### Task 1: Scopes, Filtering & Comparison Deltas

Implement the core filter engine and period comparison logic.

**Files:**
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Define StatsScope and bounds helper**

Add types and logic to calculate start and end dates for the current and prior comparison period in `src/lib/transform.ts`:

```typescript
export type StatsScope = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_QUARTER' | 'THIS_MONTH' | 'THIS_WEEK';

export interface ScopeBounds {
  start: Date | null;
  end: Date;
  priorStart: Date | null;
  priorEnd: Date | null;
}

export function getScopeBounds(scope: StatsScope, relativeTo: Date = new Date()): ScopeBounds {
  const end = new Date(relativeTo);
  const nowYear = relativeTo.getFullYear();
  const nowMonth = relativeTo.getMonth();
  const nowDate = relativeTo.getDate();

  let start: Date | null = null;
  let priorStart: Date | null = null;
  let priorEnd: Date | null = null;

  switch (scope) {
    case 'THIS_WEEK': {
      const day = relativeTo.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start = new Date(nowYear, nowMonth, nowDate + diffToMonday);
      start.setHours(0, 0, 0, 0);
      priorStart = new Date(start);
      priorStart.setDate(start.getDate() - 7);
      priorEnd = new Date(start);
      break;
    }
    case 'THIS_MONTH': {
      start = new Date(nowYear, nowMonth, 1);
      priorStart = new Date(nowYear, nowMonth - 1, 1);
      priorEnd = new Date(nowYear, nowMonth, 1);
      break;
    }
    case 'THIS_QUARTER': {
      const qStartMonth = Math.floor(nowMonth / 3) * 3;
      start = new Date(nowYear, qStartMonth, 1);
      priorStart = new Date(nowYear, qStartMonth - 3, 1);
      priorEnd = new Date(nowYear, qStartMonth, 1);
      break;
    }
    case 'THIS_YEAR': {
      start = new Date(nowYear, 0, 1);
      priorStart = new Date(nowYear - 1, 0, 1);
      priorEnd = new Date(nowYear, 0, 1);
      break;
    }
    case 'ALL_TIME':
    default:
      start = null;
      break;
  }

  return { start, end, priorStart, priorEnd };
}

export function filterEntriesByScope(
  entries: TimeEntry[],
  scope: StatsScope,
  spaceFilter: string,
  relativeTo: Date = new Date(),
  usePriorPeriod = false
): TimeEntry[] {
  const completed = entries.filter((e) => e.completion_time);
  const bounds = getScopeBounds(scope, relativeTo);

  const startBound = usePriorPeriod ? bounds.priorStart : bounds.start;
  const endBound = usePriorPeriod ? bounds.priorEnd : bounds.end;

  return completed.filter((e) => {
    const entryDate = new Date(e.start_date);
    if (isNaN(entryDate.getTime())) return false;
    
    // Space filter
    if (spaceFilter !== 'ALL' && e.space !== spaceFilter) {
      return false;
    }

    // Timeframe filter
    if (startBound && entryDate < startBound) return false;
    if (endBound && entryDate > endBound) return false;

    return true;
  });
}
```

- [ ] **Step 2: Add failing tests for filtering and bounds**

In `src/lib/transform.test.ts`, add the tests:

```typescript
describe('getScopeBounds and filterEntriesByScope', () => {
  const refDate = new Date('2026-06-24T12:00:00.000Z'); // Wednesday
  const mockData: TimeEntry[] = [
    { id: '1', space: 'Work', specialization: '', start_date: '2026-06-23T09:00:00.000Z', completion_time: '2026-06-23T10:00:00.000Z', user: 'u' }, // This Week
    { id: '2', space: 'Piano', specialization: '', start_date: '2026-06-15T09:00:00.000Z', completion_time: '2026-06-15T10:00:00.000Z', user: 'u' }, // Last Week
    { id: '3', space: 'Work', specialization: '', start_date: '2026-05-15T09:00:00.000Z', completion_time: '2026-05-15T10:00:00.000Z', user: 'u' }, // Last Month
  ];

  it('filters correctly for THIS_WEEK', () => {
    const current = filterEntriesByScope(mockData, 'THIS_WEEK', 'ALL', refDate, false);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe('1');

    const prior = filterEntriesByScope(mockData, 'THIS_WEEK', 'ALL', refDate, true);
    expect(prior).toHaveLength(1);
    expect(prior[0].id).toBe('2');
  });

  it('filters correctly by space', () => {
    const current = filterEntriesByScope(mockData, 'THIS_WEEK', 'Piano', refDate, false);
    expect(current).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run Vitest and check failure/success**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/transform.ts src/lib/transform.test.ts
git commit -m "feat: add scope filtering and time bounds engine"
```

---

### Task 2: Time-Shape Data Transforms

Implement day of week, hour grids, session buckets, and deep work transformations.

**Files:**
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Write weekday distribution, heatmaps, buckets, and deep work ratio**

In `src/lib/transform.ts`, append:

```typescript
export interface WeekdayPoint {
  day: string;
  hours: number;
}

export function getWeekdayDistribution(entries: TimeEntry[]): WeekdayPoint[] {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const totals = days.map((d) => ({ day: d, hours: 0 }));

  for (const e of entries) {
    const start = new Date(e.start_date);
    if (isNaN(start.getTime())) continue;
    // Map JS Sunday (0) to index 6, Monday (1) to index 0, etc.
    const dayIndex = start.getDay() === 0 ? 6 : start.getDay() - 1;
    totals[dayIndex].hours += getEntryDurationHours(e);
  }

  return totals.map((d) => ({ ...d, hours: Number(d.hours.toFixed(2)) }));
}

export interface HeatmapCell {
  day: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: number; // 0..23
  minutes: number;
}

export function getDaytimeHeatmap(entries: TimeEntry[]): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells.push({ day: d, hour: h, minutes: 0 });
    }
  }

  for (const e of entries) {
    if (!e.completion_time) continue;
    const start = new Date(e.start_date);
    const end = new Date(e.completion_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    let current = new Date(start);
    while (current < end) {
      const nextHour = new Date(current);
      nextHour.setHours(current.getHours() + 1, 0, 0, 0);
      const limit = nextHour < end ? nextHour : end;
      const ms = limit.getTime() - current.getTime();
      const minutes = ms / (1000 * 60);

      const day = current.getDay();
      const hour = current.getHours();

      const cell = cells.find((c) => c.day === day && c.hour === hour);
      if (cell) {
        cell.minutes += minutes;
      }
      current = limit;
    }
  }

  return cells.map((c) => ({ ...c, minutes: Math.round(c.minutes) }));
}

export function getStartTimeHeatmap(entries: TimeEntry[]): number[] {
  const hours = Array(24).fill(0);
  for (const e of entries) {
    const start = new Date(e.start_date);
    if (isNaN(start.getTime())) continue;
    hours[start.getHours()] += 1;
  }
  return hours;
}

export interface SessionBucket {
  label: string;
  count: number;
  percentage: number;
}

export function getSessionLengthBuckets(entries: TimeEntry[]): SessionBucket[] {
  const buckets = [
    { label: '0-15m', min: 0, max: 15 },
    { label: '15-30m', min: 15, max: 30 },
    { label: '30-60m', min: 30, max: 60 },
    { label: '1-2h', min: 60, max: 120 },
    { label: '2h+', min: 120, max: Infinity },
  ];

  const counts = buckets.map((b) => ({ label: b.label, count: 0, percentage: 0 }));
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return counts;

  for (const e of completed) {
    const durationMins = getEntryDurationHours(e) * 60;
    for (let i = 0; i < buckets.length; i++) {
      if (durationMins >= buckets[i].min && durationMins < buckets[i].max) {
        counts[i].count += 1;
        break;
      }
    }
  }

  return counts.map((c) => ({
    ...c,
    percentage: Math.round((c.count / completed.length) * 100),
  }));
}

export function getDeepWorkRatio(entries: TimeEntry[]): number {
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return 0;
  const deepWorkSessions = completed.filter((e) => getEntryDurationHours(e) >= 1.5);
  return Number(((deepWorkSessions.length / completed.length) * 100).toFixed(1));
}
```

- [ ] **Step 2: Add tests for time shape transforms**

In `src/lib/transform.test.ts`, add the tests:

```typescript
describe('Time-shape data transforms', () => {
  const mockData: TimeEntry[] = [
    // Monday 09:00 -> 11:00 (2h)
    { id: '1', space: 'Work', specialization: '', start_date: '2026-06-22T09:00:00.000Z', completion_time: '2026-06-22T11:00:00.000Z', user: 'u' },
    // Wednesday 23:45 -> Thursday 00:15 (30m)
    { id: '2', space: 'Work', specialization: '', start_date: '2026-06-24T23:45:00.000Z', completion_time: '2026-06-25T00:15:00.000Z', user: 'u' },
  ];

  it('calculates weekday distribution correctly', () => {
    const dist = getWeekdayDistribution(mockData);
    expect(dist.find((d) => d.day === 'MON')?.hours).toBe(2.0);
    expect(dist.find((d) => d.day === 'WED')?.hours).toBe(0.25);
  });

  it('allocates daytime heatmap crossing midnight correctly', () => {
    const cells = getDaytimeHeatmap(mockData);
    // 2026-06-24 is Wednesday (Date.getDay() === 3)
    const wedCell = cells.find((c) => c.day === 3 && c.hour === 23);
    // 2026-06-25 is Thursday (Date.getDay() === 4)
    const thuCell = cells.find((c) => c.day === 4 && c.hour === 0);
    
    expect(wedCell?.minutes).toBe(15);
    expect(thuCell?.minutes).toBe(15);
  });

  it('calculates session length buckets and deep work ratio', () => {
    const buckets = getSessionLengthBuckets(mockData);
    expect(buckets.find((b) => b.label === '2h+')?.count).toBe(1);
    expect(buckets.find((b) => b.label === '15-30m')?.count).toBe(1);
    expect(getDeepWorkRatio(mockData)).toBe(50.0); // 1 out of 2 >= 90 mins
  });
});
```

- [ ] **Step 3: Run Vitest**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/transform.ts src/lib/transform.test.ts
git commit -m "feat: implement time-shape calculations and unit tests"
```

---

### Task 3: Specialization Distributions & Leaderboards

Implement space details and ranking leaderboard calculations.

**Files:**
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Write logic for specialization distribution and leaderboard**

In `src/lib/transform.ts`, append:

```typescript
export interface SpecializationRow {
  specialization: string;
  space: string;
  hours: number;
  lastActive: string;
}

export function getRankedLeaderboard(entries: TimeEntry[], relativeTo: Date = new Date()): SpecializationRow[] {
  const completed = entries.filter((e) => e.completion_time);
  const groups: Record<string, { space: string; hours: number; lastDate: Date }> = {};

  for (const e of completed) {
    const spec = e.specialization || 'No Specialization';
    const hours = getEntryDurationHours(e);
    const date = new Date(e.start_date);

    const key = `${e.space}::${spec}`;
    if (!groups[key]) {
      groups[key] = { space: e.space || 'No Space', hours: 0, lastDate: date };
    }
    groups[key].hours += hours;
    if (date > groups[key].lastDate) {
      groups[key].lastDate = date;
    }
  }

  return Object.entries(groups)
    .map(([key, data]) => {
      const specialization = key.split('::')[1];
      
      const diffMs = relativeTo.getTime() - data.lastDate.getTime();
      const daysAgo = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const lastActive = daysAgo <= 0 ? 'TODAY' : `${daysAgo}d_AGO`;

      return {
        specialization,
        space: data.space,
        hours: Number(data.hours.toFixed(2)),
        lastActive,
      };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);
}

export interface SpaceDistribution {
  name: string;
  value: number;
  percentage: number;
  cumulativePercentage: number;
}

export function getSpaceLeaderboard(entries: TimeEntry[]): SpaceDistribution[] {
  const list = transformToSpaceDistribution(entries).sort((a, b) => b.value - a.value);
  const total = list.reduce((sum, item) => sum + item.value, 0);
  
  let accumulated = 0;
  return list.map((item) => {
    accumulated += item.value;
    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const cumulativePercentage = total > 0 ? Math.round((accumulated / total) * 100) : 0;
    return {
      name: item.name,
      value: item.value,
      percentage,
      cumulativePercentage,
    };
  });
}

export function getSpecializationDistribution(entries: TimeEntry[], space: string): Array<{ name: string; value: number }> {
  const completed = entries.filter((e) => e.completion_time && e.space === space);
  const map: Record<string, number> = {};
  for (const e of completed) {
    const spec = e.specialization || 'No Specialization';
    map[spec] = (map[spec] || 0) + getEntryDurationHours(e);
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}
```

- [ ] **Step 2: Add leaderboard and distribution tests**

In `src/lib/transform.test.ts`, add the tests:

```typescript
describe('Leaderboards and specialization distributions', () => {
  const refDate = new Date('2026-06-24T12:00:00.000Z');
  const mockData: TimeEntry[] = [
    { id: '1', space: 'Work', specialization: 'qadrant', start_date: '2026-06-23T09:00:00.000Z', completion_time: '2026-06-23T11:00:00.000Z', user: 'u' }, // 2h
    { id: '2', space: 'Work', specialization: 'clients', start_date: '2026-06-22T09:00:00.000Z', completion_time: '2026-06-22T10:00:00.000Z', user: 'u' }, // 1h
    { id: '3', space: 'Piano', specialization: 'scales', start_date: '2026-06-24T09:00:00.000Z', completion_time: '2026-06-24T10:00:00.000Z', user: 'u' }, // 1h
  ];

  it('builds ranked leaderboard correctly', () => {
    const leaderboard = getRankedLeaderboard(mockData, refDate);
    expect(leaderboard[0].specialization).toBe('qadrant');
    expect(leaderboard[0].hours).toBe(2);
    expect(leaderboard[0].lastActive).toBe('1d_AGO');
  });

  it('builds space leaderboard with cumulative percentage', () => {
    const spaces = getSpaceLeaderboard(mockData);
    expect(spaces[0].name).toBe('Work');
    expect(spaces[0].value).toBe(3);
    expect(spaces[0].cumulativePercentage).toBe(75); // 3 / 4 total
  });

  it('builds specialization distribution inside a space', () => {
    const specs = getSpecializationDistribution(mockData, 'Work');
    expect(specs).toContainEqual({ name: 'qadrant', value: 2 });
    expect(specs).toContainEqual({ name: 'clients', value: 1 });
  });
});
```

- [ ] **Step 3: Run Vitest**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/transform.ts src/lib/transform.test.ts
git commit -m "feat: implement ranked specialization leaderboard calculations"
```

---

### Task 4: Week-Over-Week & Rolling Baselines

Implement rolling 30-day baseline and 8-week comparative totals.

**Files:**
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Write rolling average and week over week trend calculations**

In `src/lib/transform.ts`, append:

```typescript
export function getWeekOverWeekBars(entries: TimeEntry[], relativeTo: Date = new Date()): Array<{ weekStr: string; hours: number }> {
  const completed = entries.filter((e) => e.completion_time);
  const result: Array<{ weekStr: string; hours: number }> = [];

  // Generate 8 weeks ending with current week
  for (let i = 7; i >= 0; i--) {
    const targetDate = new Date(relativeTo);
    targetDate.setDate(relativeTo.getDate() - i * 7);
    const mondayStr = getLocalWeekMondayString(targetDate);
    
    // Sum hours in this week boundary
    const nextMonday = new Date(mondayStr);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const monTime = new Date(mondayStr).getTime();
    const nextMonTime = nextMonday.getTime();

    let hours = 0;
    for (const e of completed) {
      const entryTime = new Date(e.start_date).getTime();
      if (entryTime >= monTime && entryTime < nextMonTime) {
        hours += getEntryDurationHours(e);
      }
    }

    result.push({
      weekStr: mondayStr.slice(5), // MM-DD
      hours: Number(hours.toFixed(2)),
    });
  }

  return result;
}

export function getRolling30DAverage(trendPoints: DailyTrendPoint[]): number {
  if (trendPoints.length === 0) return 0;
  const sum = trendPoints.reduce((s, p) => s + p.hours, 0);
  return Number((sum / trendPoints.length).toFixed(2));
}
```

- [ ] **Step 2: Add tests for baseline functions**

In `src/lib/transform.test.ts`, add the tests:

```typescript
describe('Rolling and Week-over-week trends', () => {
  it('calculates week over week trends for last 8 weeks', () => {
    const ref = new Date('2026-06-24T12:00:00.000Z');
    const mockData: TimeEntry[] = [
      { id: '1', space: 'W', specialization: '', start_date: '2026-06-22T09:00:00.000Z', completion_time: '2026-06-22T10:00:00.000Z', user: 'u' }, // This Week
      { id: '2', space: 'W', specialization: '', start_date: '2026-06-15T09:00:00.000Z', completion_time: '2026-06-15T12:00:00.000Z', user: 'u' }, // Last Week
    ];
    const wow = getWeekOverWeekBars(mockData, ref);
    expect(wow).toHaveLength(8);
    expect(wow[7].hours).toBe(1); // Current week
    expect(wow[6].hours).toBe(3); // Prior week
  });
});
```

- [ ] **Step 3: Run Vitest**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/transform.ts src/lib/transform.test.ts
git commit -m "feat: implement rolling average and WoW practice volume transforms"
```

---

### Task 5: Archival Records & Milestones

Implement all-time best records tracker and milestone triggers.

**Files:**
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Write streak calculations, best records, and milestones list**

In `src/lib/transform.ts`, append:

```typescript
export function getLongestStreak(entries: TimeEntry[]): number {
  const completed = entries.filter((e) => e.completion_time);
  if (completed.length === 0) return 0;

  const daysSet = new Set<string>();
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (!isNaN(d.getTime())) {
      daysSet.add(getLocalDateString(d));
    }
  }

  const sortedDays = Array.from(daysSet).sort();
  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const dayStr of sortedDays) {
    const currentDate = new Date(dayStr);
    if (!prevDate) {
      currentStreak = 1;
    } else {
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak += 1;
      } else {
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
        currentStreak = 1;
      }
    }
    prevDate = currentDate;
  }

  return Math.max(maxStreak, currentStreak);
}

export interface RecordLog {
  bestDay: { date: string; hours: number; daysAgo: number };
  longestStreak: { days: number };
  topSpace: { name: string; hours: number };
}

export function getRecordLog(entries: TimeEntry[], relativeTo: Date = new Date()): RecordLog {
  const completed = entries.filter((e) => e.completion_time);
  
  // Best day calculation
  const byDay: Record<string, number> = {};
  for (const e of completed) {
    const d = new Date(e.start_date);
    if (isNaN(d.getTime())) continue;
    const key = getLocalDateString(d);
    byDay[key] = (byDay[key] || 0) + getEntryDurationHours(e);
  }

  let bestDate = 'NONE';
  let bestHours = 0;
  for (const [dateStr, val] of Object.entries(byDay)) {
    if (val > bestHours) {
      bestHours = val;
      bestDate = dateStr;
    }
  }

  let daysAgo = -1;
  if (bestDate !== 'NONE') {
    const diff = relativeTo.getTime() - new Date(bestDate).getTime();
    daysAgo = Math.floor(diff / (24 * 60 * 60 * 1000));
  }

  // Top space calculation
  const spaces = transformToSpaceDistribution(entries);
  let topSpaceName = 'NONE';
  let topSpaceHours = 0;
  for (const s of spaces) {
    if (s.value > topSpaceHours) {
      topSpaceHours = s.value;
      topSpaceName = s.name;
    }
  }

  const streak = getLongestStreak(entries);

  return {
    bestDay: { date: bestDate, hours: Number(bestHours.toFixed(2)), daysAgo },
    longestStreak: { days: streak },
    topSpace: { name: topSpaceName, hours: Number(topSpaceHours.toFixed(2)) },
  };
}

export function getMilestones(entries: TimeEntry[]): string[] {
  const milestones: string[] = [];
  const completed = entries.filter((e) => e.completion_time);
  const totalSessions = completed.length;

  if (totalSessions >= 1) milestones.push('FIRST_SESSION');
  if (totalSessions >= 50) milestones.push('50_SESSIONS');
  if (totalSessions >= 100) milestones.push('100_SESSIONS');

  const spaces = transformToSpaceDistribution(entries);
  for (const s of spaces) {
    if (s.value >= 10) {
      milestones.push(`10H_IN_${s.name.toUpperCase().replace(/\s+/g, '_')}`);
    }
    if (s.value >= 100) {
      milestones.push(`100H_IN_${s.name.toUpperCase().replace(/\s+/g, '_')}`);
    }
  }

  const longestStreak = getLongestStreak(entries);
  if (longestStreak >= 7) milestones.push('7D_STREAK');
  if (longestStreak >= 30) milestones.push('30D_STREAK');

  return milestones;
}
```

- [ ] **Step 2: Add records and milestones tests**

In `src/lib/transform.test.ts`, add the tests:

```typescript
describe('Records and Milestones metrics', () => {
  it('calculates streaks and records properly', () => {
    const ref = new Date('2026-06-25T12:00:00.000Z');
    const mockData: TimeEntry[] = [
      { id: '1', space: 'Work', specialization: '', start_date: '2026-06-20T09:00:00.000Z', completion_time: '2026-06-20T10:00:00.000Z', user: 'u' }, // 1h
      { id: '2', space: 'Work', specialization: '', start_date: '2026-06-21T09:00:00.000Z', completion_time: '2026-06-21T13:00:00.000Z', user: 'u' }, // 4h
      { id: '3', space: 'Work', specialization: '', start_date: '2026-06-22T09:00:00.000Z', completion_time: '2026-06-22T10:00:00.000Z', user: 'u' }, // 1h
    ];
    const log = getRecordLog(mockData, ref);
    expect(log.bestDay.hours).toBe(4);
    expect(log.bestDay.date).toBe('2026-06-21');
    expect(log.longestStreak.days).toBe(3);
    expect(log.topSpace.name).toBe('Work');
  });

  it('triggers milestone badges', () => {
    const mockData: TimeEntry[] = [
      { id: '1', space: 'Piano Practice', specialization: '', start_date: '2026-06-20T09:00:00.000Z', completion_time: '2026-06-20T21:00:00.000Z', user: 'u' }, // 12h
    ];
    const ms = getMilestones(mockData);
    expect(ms).toContain('FIRST_SESSION');
    expect(ms).toContain('10H_IN_PIANO_PRACTICE');
  });
});
```

- [ ] **Step 3: Run Vitest**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/transform.ts src/lib/transform.test.ts
git commit -m "feat: implement longest streak, records watch, and milestones"
```

---

### Task 6: UI Enhancements & Filter Scope Panel

Enrich the UI template inside `Stats.tsx` with all filters, cards, heatmaps, lists, and visual charts.

**Files:**
- Modify: `src/pages/Stats.tsx`

- [ ] **Step 1: Rewrite component code in Stats.tsx**

Update imports and rewrite the component body of `src/pages/Stats.tsx` to mount the filters, charts, progress lists, heatmap grids, records log, and milestones:

```tsx
import { useEffect, useState, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import type { TimeEntry } from '../lib/time-entry';
import {
  getEntryDurationHours,
  getLastRelative,
  getMasteryIndex,
  getStreakDays,
  filterEntriesByScope,
  getWeekdayDistribution,
  getDaytimeHeatmap,
  getStartTimeHeatmap,
  getSessionLengthBuckets,
  getDeepWorkRatio,
  getSpaceLeaderboard,
  getSpecializationDistribution,
  getRankedLeaderboard,
  getWeekOverWeekBars,
  getRolling30DAverage,
  getRecordLog,
  getMilestones,
  getDailyTotals,
  StatsScope,
} from '../lib/transform';
import { TopBar } from '../components/ui/TopBar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useResponsiveValue } from '../hooks/useResponsiveValue';
import { StageDrop } from '../components/ui/StageDrop';
import { InsightCard } from '../components/ui/InsightCard';
import { BeatIndicator } from '../components/ui/BeatIndicator';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ComposedChart,
} from 'recharts';

function formatHours(h: number): string {
  if (h === 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const { isMobile } = useBreakpoint();
  
  // Filter States
  const [scope, setScope] = useState<StatsScope>('ALL_TIME');
  const [spaceFilter, setSpaceFilter] = useState<string>('ALL');
  const [showDelta, setShowDelta] = useState<boolean>(false);

  const chartHeight = useResponsiveValue({ mobile: '160px', tablet: '220px', desktop: '220px' });

  useEffect(() => {
    async function fetchData() {
      if (!pb.authStore.isValid) {
        setLoading(false);
        return;
      }
      try {
        const records = await pb.collection('time_entries').getFullList<TimeEntry>({
          filter: `user = "${pb.authStore.model?.id}"`,
          sort: '-start_date',
        });
        setEntries(records);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setBeatIdx((i) => (i + 1) % 4), 200);
    return () => clearInterval(interval);
  }, [loading]);

  // Derived Spaces Options
  const uniqueSpaces = useMemo(() => {
    const spaces = new Set<string>();
    entries.forEach((e) => {
      if (e.space) spaces.add(e.space);
    });
    return Array.from(spaces).sort();
  }, [entries]);

  // All stats mappings
  const stats = useMemo(() => {
    const now = new Date();
    
    // Filtered entries for main metrics
    const currentFiltered = filterEntriesByScope(entries, scope, spaceFilter, now, false);
    const priorFiltered = filterEntriesByScope(entries, scope, spaceFilter, now, true);

    const last = getLastRelative(entries, now);
    const mastery = getMasteryIndex(currentFiltered);

    // Dynamic stats aggregation
    let totalSecs = currentFiltered.reduce((sum, e) => sum + getEntryDurationHours(e), 0);
    let priorTotalSecs = priorFiltered.reduce((sum, e) => sum + getEntryDurationHours(e), 0);

    const todayHours = currentFiltered
      .filter((e) => new Date(e.start_date).toDateString() === now.toDateString())
      .reduce((sum, e) => sum + getEntryDurationHours(e), 0);

    const weekHours = currentFiltered
      .filter((e) => {
        const d = new Date(e.start_date);
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
        monday.setHours(0,0,0,0);
        return d >= monday;
      })
      .reduce((sum, e) => sum + getEntryDurationHours(e), 0);

    const streak = getStreakDays(currentFiltered, now);
    const priorStreak = getStreakDays(priorFiltered, now);

    const deepWork = getDeepWorkRatio(currentFiltered);
    const priorDeepWork = getDeepWorkRatio(priorFiltered);

    // Weekday distribution
    const weekdayData = getWeekdayDistribution(currentFiltered);

    // Daytime Grid Heatmap
    const heatmapCells = getDaytimeHeatmap(currentFiltered);

    // Start Hours
    const startTimeData = getStartTimeHeatmap(currentFiltered);

    // Session length buckets
    const sessionBuckets = getSessionLengthBuckets(currentFiltered);

    // Space Distributions
    const spaceList = getSpaceLeaderboard(currentFiltered);
    const specList = spaceFilter !== 'ALL' ? getSpecializationDistribution(entries, spaceFilter) : [];

    // Ranked leaderboards
    const leaderboard = getRankedLeaderboard(currentFiltered, now);

    // WoW practicing
    const wowTrend = getWeekOverWeekBars(currentFiltered, now);

    // Trend vector
    const trend30 = getDailyTotals(currentFiltered, 30, now).map((d) => ({
      date: d.dateStr.slice(5), // MM-DD
      hours: d.hours,
    }));

    const rollingAvg = getRolling30DAverage(trend30);

    // Global records (Always all-time)
    const records = getRecordLog(entries, now);
    const milestoneBadges = getMilestones(entries);

    return {
      last,
      mastery,
      totalHours: totalSecs,
      todayHours,
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
    };
  }, [entries, scope, spaceFilter]);

  // Heatmap helper styles
  const getIntensityClass = (mins: number) => {
    if (mins <= 0) return 'heatmap-cell--empty';
    if (mins < 15) return 'heatmap-cell--low';
    if (mins < 45) return 'heatmap-cell--medium';
    return 'heatmap-cell--high';
  };

  const getStartIntensityClass = (count: number, maxCount: number) => {
    if (count <= 0) return 'start-cell--empty';
    const ratio = count / (maxCount || 1);
    if (ratio < 0.3) return 'start-cell--low';
    if (ratio < 0.7) return 'start-cell--medium';
    return 'start-cell--high';
  };

  const maxStartTimeCount = Math.max(...stats.startTimeData, 1);

  return (
    <>
      <TopBar section="STATS" timestamp={loading ? null : stats.last} compact={isMobile} />
      
      {/* Scope and Filter capsule */}
      <div className="section" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Capsule scope selectors */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {(['ALL_TIME', 'THIS_YEAR', 'THIS_QUARTER', 'THIS_MONTH', 'THIS_WEEK'] as StatsScope[]).map((s) => (
              <button
                key={s}
                className={`btn btn--ghost ${scope === s ? 'btn--filled' : ''}`}
                style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
                onClick={() => setScope(s)}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            {/* Space Dropdown */}
            <select
              className="input input--inline"
              style={{ width: 'auto', minWidth: '160px', height: '36px', padding: '0 var(--space-3)' }}
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
            >
              <option value="ALL">ALL SPACES</option>
              {uniqueSpaces.map((sp) => (
                <option key={sp} value={sp}>
                  {sp.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Comparison toggle */}
            <label className="type-tech-mono-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={showDelta}
                onChange={(e) => setShowDelta(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              // DELTA_ANNOTATIONS
            </label>
          </div>

        </div>
      </div>

      {loading ? (
        <div
          className="section"
          style={{ alignItems: 'center', padding: 'var(--space-12) 0', gap: 'var(--space-4)' }}
        >
          <BeatIndicator activeIndex={beatIdx} label="Synchronizing" />
          <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
            SYNCHRONIZING_STATS…
          </span>
        </div>
      ) : (
        <>
          <StageDrop
            eyebrow={
              spaceFilter !== 'ALL' || scope !== 'ALL_TIME'
                ? `▸ SCOPED_MASTERY_INDEX // ${spaceFilter.toUpperCase()} / ${scope.replace('_', ' ')}`
                : '▸ TOTAL_MASTERY_INDEX // ARCHIVE_AGGREGATE'
            }
            caption="VERIFIED_V0.1"
          >
            {stats.mastery.toFixed(1)}%
          </StageDrop>

          <section className="section" aria-label="Insight cards">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <InsightCard
                eyebrow="TODAY_PLAYTIME"
                value={formatHours(stats.todayHours)}
                caption={`// TIME_LOGGED_TODAY ${
                  showDelta && scope !== 'ALL_TIME'
                    ? `(Δ ${formatHours(stats.todayHours - stats.priorHours / 30)})`
                    : ''
                }`}
                compact={isMobile}
              />
              <InsightCard
                eyebrow="STREAK"
                value={`${stats.streak}d`}
                caption={`// CONSECUTIVE ${
                  showDelta && scope !== 'ALL_TIME'
                    ? `(Δ ${stats.streak - stats.priorStreak}d)`
                    : ''
                }`}
                compact={isMobile}
              />
              <InsightCard
                eyebrow="DEEP_WORK_RATIO"
                value={`${stats.deepWork}%`}
                caption={`// SESSIONS >= 90m ${
                  showDelta && scope !== 'ALL_TIME'
                    ? `(Δ ${(stats.deepWork - stats.priorDeepWork).toFixed(1)}%)`
                    : ''
                }`}
                compact={isMobile}
              />
              <InsightCard
                eyebrow="BEST_DAY"
                value={formatHours(stats.records.bestDay.hours)}
                caption={
                  stats.records.bestDay.daysAgo >= 0
                    ? `// SET: ${stats.records.bestDay.daysAgo}d_AGO`
                    : '// NO_RECORD_SET'
                }
                compact={isMobile}
              />
            </div>
          </section>

          {/* Time shape insights */}
          <section className="section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-8)' }}>
              
              {/* Weekday distribution */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">WEEKDAY_DISTRIBUTION</span>
                </div>
                <div style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weekdayData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="var(--border-muted)" strokeDasharray="2 2" vertical={false} />
                      <XAxis
                        dataKey="day"
                        stroke="var(--fg-muted)"
                        tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border-muted)' }}
                      />
                      <YAxis
                        stroke="var(--fg-muted)"
                        tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border-muted)' }}
                        width={24}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                        }}
                        formatter={(val: number) => [`${val.toFixed(1)}h`, 'Playtime']}
                      />
                      <Bar dataKey="hours" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Session length buckets */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">SESSION_SHAPE_BUCKETS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {stats.sessionBuckets.map((bucket) => {
                    const blockCount = Math.round(bucket.percentage / 10);
                    const blocks = '█'.repeat(blockCount) + '░'.repeat(10 - blockCount);
                    return (
                      <div key={bucket.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-muted)', paddingBottom: '4px' }}>
                        <span className="type-tech-mono" style={{ width: '80px' }}>{bucket.label}</span>
                        <span className="type-tech-mono" style={{ color: 'var(--accent)', letterSpacing: '1px' }}>{blocks}</span>
                        <span className="type-tech-mono-sm" style={{ width: '120px', textAlign: 'right', color: 'var(--fg-muted)' }}>
                          {bucket.percentage}% ({bucket.count}_SESS)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </section>

          {/* Daytime Heatmap Grid */}
          <section className="section">
            <div className="section__head">
              <span className="eyebrow">DAYTIME_FLOW_MAP</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                7_DAYS × 24_HOURS (MINUTES)
              </span>
            </div>
            
            {/* Custom Grid */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: '640px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <div style={{ width: '48px' }} />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="type-tech-mono-sm" style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'var(--fg-subtle)' }}>
                      {h.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>

                {/* Day rows */}
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName, dIndex) => (
                  <div key={dayName} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div className="type-tech-mono-sm" style={{ width: '48px', fontSize: '10px', color: 'var(--fg-muted)' }}>
                      {dayName}
                    </div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const cell = stats.heatmapCells.find((c) => c.day === dIndex && c.hour === h);
                      const minutes = cell ? cell.minutes : 0;
                      return (
                        <div
                          key={h}
                          title={`${dayName} ${h}:00 - ${minutes} minutes`}
                          className={`heatmap-cell ${getIntensityClass(minutes)}`}
                          style={{
                            flex: 1,
                            aspectRatio: '1',
                            border: '1px solid var(--border-muted)',
                            borderRadius: '1px',
                            transition: 'background-color 150ms var(--ease-out-soft)',
                            backgroundColor: minutes > 0 ? undefined : 'transparent',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Grid Legend */}
            <style>{`
              .heatmap-cell--empty { background-color: transparent; }
              .heatmap-cell--low { background-color: var(--accent-mute); }
              .heatmap-cell--medium { background-color: var(--accent-soft); }
              .heatmap-cell--high { background-color: var(--accent); }
              
              .start-cell--empty { background-color: transparent; border: 1px dashed var(--border-muted); }
              .start-cell--low { background-color: var(--accent-mute); }
              .start-cell--medium { background-color: var(--accent-soft); }
              .start-cell--high { background-color: var(--accent); }
            `}</style>
          </section>

          {/* Start Time Heatmap */}
          <section className="section">
            <div className="section__head">
              <span className="eyebrow">START_TIME_DENSITY</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                MEDIAN_TIMINGS_OVER_24H
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '640px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <div style={{ width: '48px', visibility: 'hidden' }} />
                  {stats.startTimeData.map((count, h) => (
                    <div
                      key={h}
                      title={`Hour ${h}: ${count} sessions started`}
                      className={`start-cell ${getStartIntensityClass(count, maxStartTimeCount)}`}
                      style={{
                        flex: 1,
                        height: '24px',
                        borderRadius: '2px',
                        border: '1px solid var(--border-muted)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <div style={{ width: '48px' }} />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="type-tech-mono-sm" style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'var(--fg-subtle)' }}>
                      {h}h
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Space Breakdowns & Leaderboard */}
          <section className="section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-8)' }}>
              
              {/* Space Distribution Progress Bars */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">SPACE_TIME_ALLOCATION</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {stats.spaceList.length === 0 ? (
                    <div className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
                      NO_SPACES_LOGGED
                    </div>
                  ) : (
                    stats.spaceList.map((space) => (
                      <div
                        key={space.name}
                        onClick={() => setSpaceFilter(space.name)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="type-tech-mono">{space.name}</span>
                          <span className="type-tech-mono" style={{ fontWeight: 'bold' }}>{formatHours(space.value)}</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--surface-high)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              background: spaceFilter === space.name ? 'var(--accent)' : 'var(--accent-soft)',
                              width: `${space.percentage}%`,
                              transition: 'width 280ms var(--ease-out-soft)',
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Drilldown inside active space */}
                {spaceFilter !== 'ALL' && (
                  <div style={{ marginTop: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
                      <span className="eyebrow-soft">DRILLDOWN: {spaceFilter.toUpperCase()}</span>
                      <button
                        className="btn btn--ghost"
                        style={{ padding: 0, fontSize: '11px', height: 'auto', textDecoration: 'underline' }}
                        onClick={() => setSpaceFilter('ALL')}
                      >
                        CLEAR_DRILLDOWN
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {stats.specList.map((spec) => (
                        <div key={spec.name} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-muted)', paddingBottom: '2px' }}>
                          <span className="type-tech-mono-sm" style={{ color: 'var(--fg)' }}>{spec.name}</span>
                          <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>{formatHours(spec.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ranked Specializations Leaderboard */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">RANKED_SPECIALIZATIONS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {stats.leaderboard.length === 0 ? (
                    <div className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
                      NO_SPECIALIZATIONS_LOGGED
                    </div>
                  ) : (
                    <>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
                        <span className="type-tech-mono-sm" style={{ fontWeight: 'bold' }}>SPECIALIZATION // SPACE</span>
                        <span className="type-tech-mono-sm" style={{ fontWeight: 'bold' }}>TOTAL // LAST</span>
                      </div>
                      {/* Rows */}
                      {stats.leaderboard.map((row, index) => (
                        <div
                          key={`${row.space}-${row.specialization}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border-muted)',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="type-tech-mono" style={{ fontSize: '13px' }}>
                              {(index + 1).toString().padStart(2, '0')}. {row.specialization}
                            </span>
                            <span className="type-tech-mono-sm" style={{ color: 'var(--fg-subtle)', fontSize: '10px' }}>
                              {row.space}
                            </span>
                          </div>
                          <span className="type-tech-mono" style={{ fontSize: '12px', textAlign: 'right' }}>
                            {formatHours(row.hours)} // <span style={{ color: 'var(--fg-muted)' }}>{row.lastActive}</span>
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* Daily Trend with Rolling Average & Week-over-Week Practice Volume */}
          <section className="section" aria-label="Daily trend line chart">
            <div className="section__head">
              <span className="eyebrow">DAILY_TREND_VECTORS</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                30_DAYS // ROLLING_AVG_BASELINE: {stats.rollingAvg.toFixed(2)}h
              </span>
            </div>
            <div className="stats-chart" style={{ height: chartHeight }}>
              {stats.trend.length === 0 ? (
                <div
                  className="type-tech-mono"
                  style={{
                    color: 'var(--fg-muted)',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  NO_TREND_DATA_RECORDED
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border-muted)" strokeDasharray="2 2" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--fg-muted)"
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-muted)' }}
                      interval={Math.max(1, Math.floor(stats.trend.length / 6))}
                    />
                    <YAxis
                      stroke="var(--fg-muted)"
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-muted)' }}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                      }}
                      labelStyle={{ color: 'var(--fg)' }}
                      itemStyle={{ color: 'var(--fg)' }}
                      formatter={(val: number) => `${val.toFixed(2)}h`}
                    />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--accent)' }}
                    />
                    {/* Baseline helper marker */}
                    <Line
                      type="monotone"
                      dataKey={() => stats.rollingAvg}
                      stroke="var(--fg-subtle)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Archive / Milestones Section */}
          <section className="section" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
              
              {/* Record logs console */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">ARCHIVE_RECORD_WATCH</span>
                </div>
                <div
                  className="type-tech-mono"
                  style={{
                    background: 'var(--surface-high)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                    color: 'var(--fg)',
                  }}
                >
                  <div>BEST_DAY: {stats.records.bestDay.date} // {formatHours(stats.records.bestDay.hours)} ({stats.records.bestDay.daysAgo}d_AGO)</div>
                  <div>LONGEST_STREAK: {stats.records.longestStreak.days}d // ALL_TIME_PEAK</div>
                  <div>TOP_SPACE: {stats.records.topSpace.name} // {formatHours(stats.records.topSpace.hours)}</div>
                </div>
              </div>

              {/* Milestones stamps row */}
              <div>
                <div className="section__head" style={{ paddingLeft: 0 }}>
                  <span className="eyebrow">MASTERY_MILESTONES</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {stats.milestoneBadges.length === 0 ? (
                    <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>[NO_MILESTONES_UNLOCKED]</span>
                  ) : (
                    stats.milestoneBadges.map((badge) => (
                      <span
                        key={badge}
                        className="type-tech-mono-sm"
                        style={{
                          border: '1px solid var(--accent)',
                          color: 'var(--accent)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: 'var(--accent-mute)',
                          opacity: 0.85,
                        }}
                      >
                        [{badge}]
                      </span>
                    ))
                  )}
                </div>
              </div>

            </div>
          </section>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify compiling and formatting**

Run: `npm run build`
Expected: Compile success with no TypeScript errors.
