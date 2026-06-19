import { useEffect, useState, useMemo } from 'react';
import { pb } from '../lib/pocketbase';
import type { TimeEntry } from '../lib/time-entry';
import {
  getAggregateStats,
  getBestDayHours,
  getDailyTotals,
  getLastRelative,
  getMasteryIndex,
  getStreakDays,
  getEntryDurationHours,
} from '../lib/transform';
import { TopBar } from '../components/ui/TopBar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useResponsiveValue } from '../hooks/useResponsiveValue';
import { StageDrop } from '../components/ui/StageDrop';
import { InsightCard } from '../components/ui/InsightCard';
import { Heatmap } from '../components/ui/Heatmap';
import { BeatIndicator } from '../components/ui/BeatIndicator';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function formatHours(h: number): string {
  if (h === 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

function hoursToIntensity(h: number): 0 | 1 | 2 | 3 {
  if (h <= 0) return 0;
  if (h < 1) return 1;
  if (h < 3) return 2;
  return 3;
}

export default function Stats() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [beatIdx, setBeatIdx] = useState(0);
  const { isMobile } = useBreakpoint();
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

  const stats = useMemo(() => {
    if (loading) {
      return {
        last: 'SYNCHRONIZING…',
        mastery: 0,
        todayHours: 0,
        weekHours: 0,
        bestDay: 0,
        streak: 0,
        heatmapCells: [] as Array<{ key: string; intensity: 0 | 1 | 2 | 3 }>,
        trend: [] as Array<{ date: string; hours: number }>,
      };
    }
    const last = getLastRelative(entries, new Date());
    const mastery = getMasteryIndex(entries);
    const agg = getAggregateStats(entries, new Date());
    const bestDay = getBestDayHours(entries);
    const streak = getStreakDays(entries, new Date());

    // 12-month heatmap (≈ 365 days)
    const daily = getDailyTotals(entries, 365, new Date());
    const heatmapCells = daily.map((d) => ({
      key: d.dateStr,
      intensity: hoursToIntensity(d.hours),
    }));

    // 30-day trend
    const trend30 = getDailyTotals(entries, 30, new Date()).map((d) => ({
      date: d.dateStr.slice(5), // MM-DD
      hours: d.hours,
    }));

    return {
      last,
      mastery,
      todayHours: agg.todayHours,
      weekHours: agg.weekHours,
      bestDay,
      streak,
      heatmapCells,
      trend: trend30,
    };
  }, [entries, loading]);

  const totalHours = useMemo(
    () =>
      Number(
        entries
          .filter((e) => e.completion_time)
          .reduce((sum, e) => sum + getEntryDurationHours(e), 0)
          .toFixed(1),
      ),
    [entries],
  );

  return (
    <>
      <TopBar section="STATS" timestamp={loading ? null : stats.last} compact={isMobile} />
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
            eyebrow={'▸\u00a0 TOTAL_MASTERY_INDEX // ARCHIVE_AGGREGATE'}
            caption="VERIFIED_V0.1"
          >
            {stats.mastery.toFixed(1)}%
          </StageDrop>

          <section className="section" aria-label="Insight cards">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <InsightCard
                eyebrow="TODAY_PLAYTIME"
                value={formatHours(stats.todayHours)}
                caption={`// WEEK_TOTAL: ${formatHours(stats.weekHours)}`}
                compact={isMobile}
              />
              <InsightCard
                eyebrow="STREAK"
                value={`${stats.streak}d`}
                caption="// CONSECUTIVE_DAYS_LOGGED"
                compact={isMobile}
              />
              <InsightCard
                eyebrow="BEST_DAY"
                value={formatHours(stats.bestDay)}
                caption={`// ALL_TIME_TOTAL: ${totalHours.toFixed(1)}h`}
                compact={isMobile}
              />
            </div>
          </section>

          <section className="section" aria-label="Session consistency heatmap">
            <div className="section__head">
              <span className="eyebrow">SESSION_CONSISTENCY</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                365_DAYS
              </span>
            </div>
            <Heatmap cells={stats.heatmapCells} />
          </section>

          <section className="section" aria-label="Daily trend line chart">
            <div className="section__head">
              <span className="eyebrow">DAILY_TREND_VECTORS</span>
              <span className="type-tech-mono-sm" style={{ color: 'var(--fg-muted)' }}>
                30_DAYS
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
                  <LineChart data={stats.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
