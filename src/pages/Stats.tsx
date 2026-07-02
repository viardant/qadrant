import { useEffect, useState, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import type { TimeEntry } from '../lib/time-entry';
import {
  getEntryDurationHours,
  getLastRelative,
  getVelocityStats,
  getModalStream,
  getStreakDays,
  filterEntriesByScope,
  getScopeBounds,
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
  hoursToIntensity,
  StatsScope,
} from '../lib/transform';
import { TopBar } from '../components/ui/TopBar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useResponsiveValue } from '../hooks/useResponsiveValue';
import { StageDrop } from '../components/ui/StageDrop';
import { InsightCard } from '../components/ui/InsightCard';
import { BeatIndicator } from '../components/ui/BeatIndicator';
import { Heatmap } from '../components/ui/Heatmap';
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

function formatHours(h: number): string {
  if (h === 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

const DONUT_COLORS = [
  'var(--accent)',
  'var(--accent-soft)',
  'var(--accent-mute)',
  'var(--warn)',
  'var(--fg-muted)',
  'var(--fg-subtle)',
];

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const { isMobile } = useBreakpoint();
  
  // Filter States
  const [scope, setScope] = useState<StatsScope>('ALL_TIME');
  const [spaceFilter, setSpaceFilter] = useState<string>('ALL');
  const [showAllSpaces, setShowAllSpaces] = useState<boolean>(false);

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
    const velocity = getVelocityStats(entries, scope, spaceFilter, now);
    const modal = getModalStream(currentFiltered);

    // Dynamic stats aggregation
    const totalSecs = currentFiltered.reduce((sum, e) => sum + getEntryDurationHours(e), 0);
    const priorTotalSecs = priorFiltered.reduce((sum, e) => sum + getEntryDurationHours(e), 0);

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
    const heatmapCells = getDaytimeHeatmap(currentFiltered, scope);

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
    let numDays = 30;
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDate = now.getDate();

    if (scope === 'LAST_7D') {
      numDays = 7;
    } else if (scope === 'LAST_30D') {
      numDays = 30;
    } else if (scope === 'LAST_90D') {
      numDays = 90;
    } else if (scope === 'THIS_WEEK') {
      const day = now.getDay();
      numDays = day === 0 ? 7 : day;
    } else if (scope === 'THIS_MONTH') {
      numDays = nowDate;
    } else if (scope === 'THIS_QUARTER') {
      const qStartMonth = Math.floor(nowMonth / 3) * 3;
      const qStart = new Date(nowYear, qStartMonth, 1);
      const diffTime = now.getTime() - qStart.getTime();
      numDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (scope === 'THIS_YEAR') {
      const yearStart = new Date(nowYear, 0, 1);
      const diffTime = now.getTime() - yearStart.getTime();
      numDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (scope === 'ALL_TIME') {
      if (currentFiltered.length > 0) {
        const oldestEntry = currentFiltered.reduce((oldest, e) => {
          const d = new Date(e.start_date);
          return d < oldest ? d : oldest;
        }, now);
        const diffTime = now.getTime() - oldestEntry.getTime();
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        numDays = Math.min(90, diffDays);
      } else {
        numDays = 30;
      }
    }

    const trend = getDailyTotals(currentFiltered, numDays, now).map((d) => ({
      date: d.dateStr.slice(5), // MM-DD
      hours: d.hours,
    }));

    const rollingAvg = getRolling30DAverage(trend);

    // XAxis ticks offset computation
    const xAxisTicks: string[] = [];
    if (trend.length > 0) {
      const step = isMobile ? Math.max(2, Math.floor(trend.length / 4)) : Math.max(1, Math.floor(trend.length / 6));
      const offset = isMobile ? Math.min(2, Math.floor(step / 2) || 1) : 0;
      for (let i = offset; i < trend.length; i += step) {
        xAxisTicks.push(trend[i].date);
      }
    }

    // Global records (Always all-time)
    const records = getRecordLog(entries, now);
    const milestoneBadges = getMilestones(entries);

    // 365-day session consistency
    const daily365 = getDailyTotals(currentFiltered, 365, now);
    const yearHeatmapCells = daily365.map((d) => ({
      key: d.dateStr,
      intensity: hoursToIntensity(d.hours),
      date: d.date,
      hours: d.hours,
    }));

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
      trend,
      rollingAvg,
      records,
      milestoneBadges,
      yearHeatmapCells,
      numDays,
      xAxisTicks,
    };
  }, [entries, scope, spaceFilter, isMobile]);

  // Heatmap helper styles
  const getIntensityClass = (mins: number, maxMins: number) => {
    if (mins <= 0) return 'heatmap-cell--empty';
    const ratio = mins / (maxMins || 1);
    if (ratio < 0.3) return 'heatmap-cell--low';
    if (ratio < 0.7) return 'heatmap-cell--medium';
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
  const maxHeatmapMinutes = Math.max(...stats.heatmapCells.map((c) => c.minutes), 1);

  return (
    <>
      <TopBar section="STATS" timestamp={loading ? null : stats.last} compact={isMobile} />
      
      {/* Scope and Filter capsule */}
      <div className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 'var(--space-3)',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between'
        }}>
          
          {isMobile ? (
            <select
              className="input input--inline"
              style={{ width: '100%', height: '36px', padding: '0 var(--space-3)', textTransform: 'uppercase' }}
              value={scope}
              onChange={(e) => setScope(e.target.value as StatsScope)}
            >
              {(['ALL_TIME', 'THIS_YEAR', 'THIS_QUARTER', 'THIS_MONTH', 'THIS_WEEK', 'LAST_90D', 'LAST_30D', 'LAST_7D'] as StatsScope[]).map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          ) : (
            /* Capsule scope selectors */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
              {(['ALL_TIME', 'THIS_YEAR', 'THIS_QUARTER', 'THIS_MONTH', 'THIS_WEEK', 'LAST_90D', 'LAST_30D', 'LAST_7D'] as StatsScope[]).map((s) => (
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
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
            {/* Space Dropdown */}
            <select
              className="input input--inline"
              style={{ width: '100%', minWidth: isMobile ? 'none' : '160px', height: '36px', padding: '0 var(--space-3)' }}
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
            eyebrow={(() => {
              if (scope === 'ALL_TIME') {
                return spaceFilter !== 'ALL'
                  ? `▸ DOMINANT_STREAM // ${spaceFilter.toUpperCase()}`
                  : '▸ DOMINANT_STREAM // ARCHIVE_AGGREGATE';
              }
              return spaceFilter !== 'ALL'
                ? `▸ PRACTICE_VELOCITY // ${spaceFilter.toUpperCase()} / ${scope.replace('_', ' ')}`
                : `▸ PRACTICE_VELOCITY // ${scope.replace('_', ' ')}`;
            })()}
            caption={(() => {
              if (scope === 'ALL_TIME') {
                if (!stats.modal) return 'NO_DATA_LOGGED';
                return `${stats.modal.space.toUpperCase()} // ${stats.modal.specialization.toUpperCase()} :: ${stats.modal.sharePct}% OF PERIOD`;
              }
              const v = stats.velocity;
              if (v.deltaPct === null) {
                return `// FIRST_OCCURRENCE · ${formatHours(v.currentHours)} NOW`;
              }
              if (v.currentHours === 0 && v.priorHours === 0) {
                return '// NO_ACTIVITY_IN_PERIOD';
              }
              return `// ${formatHours(v.currentHours)} NOW · ${formatHours(v.priorHours)} PRIOR`;
            })()}
          >
            {(() => {
              if (scope === 'ALL_TIME') {
                return stats.modal ? formatHours(stats.modal.hours) : '—';
              }
              const v = stats.velocity;
              if (v.deltaPct === null) return 'NEW';
              if (v.currentHours === 0 && v.priorHours === 0) return '0%';
              const sign = v.deltaPct > 0 ? '+' : v.deltaPct < 0 ? '−' : '';
              return `${sign}${v.deltaPct.toFixed(1)}%`;
            })()}
          </StageDrop>

          <section className="section" aria-label="Session consistency heatmap">
            <div className="section__head">
              <span className="eyebrow">SESSION_CONSISTENCY</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                365_DAYS
              </span>
            </div>
            <Heatmap cells={stats.yearHeatmapCells} />
          </section>

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
                  scope !== 'ALL_TIME'
                    ? `(Δ ${stats.todayDelta >= 0 ? '+' : '-'}${formatHours(Math.abs(stats.todayDelta))})`
                    : ''
                }`}
                compact={isMobile}
              />
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
                    <BarChart
                      data={stats.weekdayData}
                      margin={isMobile ? { top: 8, right: 4, bottom: 0, left: -16 } : { top: 8, right: 8, bottom: 0, left: 0 }}
                    >
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
                        width={isMobile ? 18 : 24}
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
                          className={`heatmap-cell ${getIntensityClass(minutes, maxHeatmapMinutes)}`}
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
                  {(() => {
                    const rawData = spaceFilter === 'ALL' ? stats.spaceList : stats.specList;
                    if (rawData.length === 0) {
                      return (
                        <div className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>
                          NO_DISTRIBUTION_DATA
                        </div>
                      );
                    }
                    const pieData = rawData.length <= 6 
                      ? rawData 
                      : [
                          ...rawData.slice(0, 5),
                          { name: 'OTHER', value: Number(rawData.slice(5).reduce((sum, item) => sum + item.value, 0).toFixed(2)) }
                        ];
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {pieData.map((_, index) => (
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
                            formatter={(val: number, name: string) => {
                              const formattedName =
                                spaceFilter === 'ALL'
                                  ? name.toUpperCase()
                                  : `${spaceFilter.toUpperCase()} // ${name.toUpperCase()}`;
                              return [`${val.toFixed(1)}h`, formattedName];
                            }}
                          />
                          <Legend
                            layout={isMobile ? "horizontal" : "vertical"}
                            align={isMobile ? "center" : "right"}
                            verticalAlign={isMobile ? "bottom" : "middle"}
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: isMobile ? '9px' : '11px',
                              textTransform: 'uppercase',
                              paddingTop: isMobile ? '8px' : '0px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>

            </div>
          </section>

          {/* Daily Trend with Rolling Average & Week-over-Week Practice Volume */}
          <section className="section" aria-label="Daily trend line chart">
            <div className="section__head">
              <span className="eyebrow" style={{ whiteSpace: 'nowrap' }}>
                {isMobile
                  ? spaceFilter === 'ALL'
                    ? 'DAILY_TREND'
                    : `DAILY_TREND // ${spaceFilter.toUpperCase()}`
                  : spaceFilter === 'ALL'
                  ? 'DAILY_TREND_VECTORS'
                  : `DAILY_TREND_VECTORS // ${spaceFilter.toUpperCase()}`}
              </span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                {isMobile 
                  ? `${stats.numDays}D // AVG: ${stats.rollingAvg.toFixed(2)}h` 
                  : `${stats.numDays}_DAYS // ROLLING_AVG_BASELINE: ${stats.rollingAvg.toFixed(2)}h`}
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
                  <ComposedChart
                    data={stats.trend}
                    margin={isMobile ? { top: 8, right: 4, bottom: 0, left: -16 } : { top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid stroke="var(--border-muted)" strokeDasharray="2 2" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--fg-muted)"
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-muted)' }}
                      ticks={stats.xAxisTicks}
                    />
                    <YAxis
                      stroke="var(--fg-muted)"
                      tick={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border-muted)' }}
                      width={isMobile ? 18 : 36}
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
                  <div>BEST_DAY: {stats.records.bestDay.date} // {formatHours(stats.records.bestDay.hours)} ({stats.records.bestDay.daysAgo >= 0 ? `${stats.records.bestDay.daysAgo}d_AGO` : 'N/A'})</div>
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
