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
      yearHeatmapCells,
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
