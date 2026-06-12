import { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { TimeEntry } from '../components/logger/TaskLogger';
import { TypewriterText } from '../components/shared/TypewriterText';
import { Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  transformToWeeklyData,
  transformToMonthlyData,
  transformToSpaceDistribution,
  transformToDailyTrend,
  getAggregateStats,
  getLocalDateString,
  getLocalMonthString,
  getLocalWeekMondayString
} from '../lib/transform';

const DEFAULT_PALETTE = [
  '#35675d', // forest green (primary)
  '#56877d', // lighter forest green
  '#7ba89e', // tertiary teal
  '#1c1b1c', // charcoal (primary ink)
  '#ba1a1a', // crimson red
  '#994e4e', // light crimson
  '#bfa37a', // warm gold/sand
  '#8f7a5c', // dark gold/sand
  '#4a5568', // steel blue
  '#718096', // light steel blue
];

export default function Charts() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [spaceColors, setSpaceColors] = useState<Record<string, string>>({});
  const [timeframe, setTimeframe] = useState<string>('last-7-days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      if (!pb.authStore.isValid) {
        setLoading(false);
        return;
      }
      try {
        // Fetch completed and active time entries for the user
        const records = await pb.collection('time_entries').getFullList<TimeEntry>({
          filter: `user = "${pb.authStore.model?.id}"`,
          sort: '-start_date',
        });
        setEntries(records);

        // Fetch user record to get space colors
        const user = await pb.collection('users').getOne(pb.authStore.model?.id || '');
        if (user.space_colors) {
          setSpaceColors(user.space_colors);
        }
      } catch (err) {
        console.error('Failed to load charts protocol logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loader-container">
        <Loader2 className="spinner" size={32} />
        <span className="font-mono text-sm text-on-surface/60">SYNCHRONIZING_CHARTS_STATE...</span>
      </div>
    );
  }

  // Get completed entries
  const completedEntries = entries.filter(e => e.completion_time);

  // Filter completed entries by preset selection
  const getFilteredEntries = () => {
    const now = new Date();
    
    if (timeframe === 'last-7-days') {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return completedEntries.filter(e => new Date(e.start_date) >= cutoff);
    }
    if (timeframe === 'last-30-days') {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return completedEntries.filter(e => new Date(e.start_date) >= cutoff);
    }
    if (timeframe === 'last-90-days') {
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return completedEntries.filter(e => new Date(e.start_date) >= cutoff);
    }
    if (timeframe === 'this-week') {
      const mondayStr = getLocalWeekMondayString(now);
      const monday = new Date(mondayStr + 'T00:00:00');
      return completedEntries.filter(e => new Date(e.start_date) >= monday);
    }
    if (timeframe === 'this-month') {
      const monthStr = getLocalMonthString(now); // "YYYY-MM"
      const firstOfMonth = new Date(monthStr + '-01T00:00:00');
      return completedEntries.filter(e => new Date(e.start_date) >= firstOfMonth);
    }
    if (timeframe === 'custom') {
      let filtered = completedEntries;
      if (customStart) {
        const start = new Date(customStart + 'T00:00:00');
        filtered = filtered.filter(e => new Date(e.start_date) >= start);
      }
      if (customEnd) {
        const end = new Date(customEnd + 'T23:59:59');
        filtered = filtered.filter(e => new Date(e.start_date) <= end);
      }
      return filtered;
    }
    
    return completedEntries; // default: all
  };

  const filtered = getFilteredEntries();

  // Helper for colors
  const getSpaceColor = (spaceName: string, index: number) => {
    return spaceColors[spaceName] || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
  };

  // Get unique spaces in filtered data for stacked bars
  const uniqueSpaces = Array.from(new Set(filtered.map(e => e.space || 'No Space')));

  // Transformations
  const weeklyData = transformToWeeklyData(filtered);
  const monthlyData = transformToMonthlyData(filtered);
  const spaceDistribution = transformToSpaceDistribution(filtered);
  const dailyTrend = transformToDailyTrend(filtered);
  
  // Aggregate stats (always relative to today's date)
  const currentStats = getAggregateStats(entries, new Date());

  // Donut chart total hours helper
  const totalHours = spaceDistribution.reduce((sum, item) => sum + item.value, 0);

  // Calendar Heatmap calculations (trailing 365 days)
  const getHeatmap = () => {
    const dailyHours: Record<string, number> = {};
    for (const entry of completedEntries) {
      const start = new Date(entry.start_date);
      const dayStr = getLocalDateString(start);
      // Sum hours
      const startMs = new Date(entry.start_date).getTime();
      const endMs = new Date(entry.completion_time!).getTime();
      const hrs = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
      dailyHours[dayStr] = (dailyHours[dayStr] || 0) + hrs;
    }

    const daysList: { date: Date; dateStr: string; hours: number }[] = [];
    const today = new Date();
    
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      daysList.push({
        date: d,
        dateStr,
        hours: Number((dailyHours[dateStr] || 0).toFixed(2)),
      });
    }

    const firstDayOfWeek = daysList[0].date.getDay(); // 0 = Sunday, 1 = Monday, ...
    return { daysList, firstDayOfWeek };
  };

  const { daysList, firstDayOfWeek } = getHeatmap();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold font-mono" style={{ marginBottom: '0.25rem' }}>ANALYTICS_PROTOCOL</h1>
        <p className="font-mono text-sm text-on-surface/60" style={{ marginBottom: 0 }}>Visualize productivity flows and distribution vectors.</p>
      </div>

      {/* Preset timeframe selector */}
      <div className="flex flex-wrap items-center gap-4 justify-between border-b border-outline pb-4" style={{ borderBottom: '1px solid var(--outline)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { id: 'last-7-days', label: 'LAST_7_DAYS' },
            { id: 'last-30-days', label: 'LAST_30_DAYS' },
            { id: 'last-90-days', label: 'LAST_90_DAYS' },
            { id: 'this-week', label: 'THIS_WEEK' },
            { id: 'this-month', label: 'THIS_MONTH' },
            { id: 'all', label: 'ALL_TIME' },
            { id: 'custom', label: 'CUSTOM' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setTimeframe(preset.id)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderRadius: '4px',
                border: '1px solid var(--outline)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: timeframe === preset.id ? 'var(--primary)' : 'var(--bg-surface)',
                color: timeframe === preset.id ? 'var(--bg-surface)' : 'var(--text-on-surface)',
                boxShadow: timeframe === preset.id ? '2px 2px 0px var(--text-on-surface)' : 'none',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {timeframe === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ opacity: 0.6 }}>FROM:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ opacity: 0.6 }}>TO:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mastery Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        border: '1px solid var(--outline)',
        padding: '1.5rem',
        borderRadius: '4px',
        backgroundColor: 'var(--bg-surface)',
        boxShadow: '2px 2px 0px var(--text-on-surface)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>TODAY_PLAYTIME</span>
          <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
            <TypewriterText text={`${currentStats.todayHours.toFixed(2)}h`} speed={60} showCursor={true} />
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>WEEKLY_AGGREGATE</span>
          <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
            <TypewriterText text={`${currentStats.weekHours.toFixed(2)}h`} speed={60} showCursor={true} />
          </h2>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div style={{
        border: '1px solid var(--outline)',
        padding: '1.5rem',
        borderRadius: '4px',
        backgroundColor: 'var(--bg-surface)',
        boxShadow: '2px 2px 0px var(--text-on-surface)',
      }}>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', opacity: 0.8 }}>CONSISTENCY_HEATMAP</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start', fontFamily: 'var(--font-mono)', fontSize: '9px', opacity: 0.6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '102px', paddingRight: '4px', paddingTop: '2px' }}>
            <span>Sun</span>
            <span>Tue</span>
            <span>Thu</span>
            <span>Sat</span>
          </div>
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateRows: 'repeat(7, 12px)',
              gridAutoFlow: 'column',
              gap: '3px',
              paddingBottom: '0.5rem'
            }}>
              {/* Padding */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`pad-${i}`} style={{ width: '12px', height: '12px' }} />
              ))}
              
              {/* Day cells */}
              {daysList.map((d) => {
                let opacity = 0;
                let cellBg = 'rgba(28, 27, 28, 0.02)';
                let border = '1px solid var(--outline-light)';
                let tooltip = `${d.dateStr}: 0.00h tracked`;
                
                if (d.hours > 0) {
                  tooltip = `${d.dateStr}: ${d.hours.toFixed(2)}h tracked`;
                  cellBg = 'var(--primary)';
                  border = '1px solid var(--primary)';
                  if (d.hours < 1) {
                    opacity = 0.2;
                  } else if (d.hours < 3) {
                    opacity = 0.5;
                  } else {
                    opacity = 1.0;
                  }
                }
                
                return (
                  <div
                    key={d.dateStr}
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: cellBg,
                      opacity: d.hours > 0 ? opacity : 1,
                      border: border,
                      borderRadius: '2px',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                    }}
                    title={tooltip}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', fontSize: '9px', fontFamily: 'var(--font-mono)', opacity: 0.5, marginTop: '0.5rem' }}>
          <span>Less</span>
          <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(28, 27, 28, 0.02)', border: '1px solid var(--outline-light)', borderRadius: '2px' }} />
          <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary)', opacity: 0.2, border: '1px solid var(--primary)', borderRadius: '2px' }} />
          <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary)', opacity: 0.5, border: '1px solid var(--primary)', borderRadius: '2px' }} />
          <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary)', opacity: 1.0, border: '1px solid var(--primary)', borderRadius: '2px' }} />
          <span>More</span>
        </div>
      </div>

      {/* Charts Layout Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Weekly Stacked Bar Chart */}
        <div style={{
          border: '1px solid var(--outline)',
          padding: '1.5rem',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '2px 2px 0px var(--text-on-surface)',
        }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem', opacity: 0.8 }}>WEEKLY_PROTOCOL_FLOW</h3>
          <div style={{ width: '100%', height: 260 }}>
            {weeklyData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', opacity: 0.5 }}>
                NO_WEEKLY_FLOW_DATA_RECORDED
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--outline-light)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-on-surface)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    tickLine={{ stroke: 'var(--outline)' }}
                    axisLine={{ stroke: 'var(--outline)' }}
                  />
                  <YAxis
                    stroke="var(--text-on-surface)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    tickLine={{ stroke: 'var(--outline)' }}
                    axisLine={{ stroke: 'var(--outline)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--outline)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      borderRadius: '4px',
                      boxShadow: 'none',
                    }}
                    labelStyle={{ fontWeight: 'bold', color: 'var(--primary)' }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      paddingTop: '10px',
                    }}
                  />
                  {uniqueSpaces.map((space, idx) => (
                    <Bar
                      key={space}
                      dataKey={space}
                      stackId="a"
                      fill={getSpaceColor(space, idx)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Stacked Bar Chart */}
        <div style={{
          border: '1px solid var(--outline)',
          padding: '1.5rem',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '2px 2px 0px var(--text-on-surface)',
        }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem', opacity: 0.8 }}>MONTHLY_PROTOCOL_FLOW</h3>
          <div style={{ width: '100%', height: 260 }}>
            {monthlyData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', opacity: 0.5 }}>
                NO_MONTHLY_FLOW_DATA_RECORDED
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--outline-light)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-on-surface)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    tickLine={{ stroke: 'var(--outline)' }}
                    axisLine={{ stroke: 'var(--outline)' }}
                  />
                  <YAxis
                    stroke="var(--text-on-surface)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    tickLine={{ stroke: 'var(--outline)' }}
                    axisLine={{ stroke: 'var(--outline)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--outline)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      borderRadius: '4px',
                      boxShadow: 'none',
                    }}
                    labelStyle={{ fontWeight: 'bold', color: 'var(--primary)' }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      paddingTop: '10px',
                    }}
                  />
                  {uniqueSpaces.map((space, idx) => (
                    <Bar
                      key={space}
                      dataKey={space}
                      stackId="a"
                      fill={getSpaceColor(space, idx)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Space Distribution Donut Chart */}
        <div style={{
          border: '1px solid var(--outline)',
          padding: '1.5rem',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '2px 2px 0px var(--text-on-surface)',
        }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem', opacity: 0.8 }}>SPACE_DISTRIBUTION</h3>
          <div style={{ position: 'relative', width: '100%', height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {spaceDistribution.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', opacity: 0.5 }}>
                NO_DISTRIBUTION_DATA_RECORDED
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spaceDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {spaceDistribution.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={getSpaceColor(entry.name, idx)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--outline)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        borderRadius: '4px',
                        boxShadow: 'none',
                      }}
                      formatter={(val: number) => `${val.toFixed(2)}h`}
                    />
                    <Legend
                      wrapperStyle={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        paddingTop: '10px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  textAlign: 'center',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  marginTop: '-12px',
                }}>
                  <span className="font-mono text-xl font-bold tracking-tight" style={{ color: 'var(--text-on-surface)', margin: 0 }}>
                    {totalHours.toFixed(1)}h
                  </span>
                  <span className="font-mono text-[9px] uppercase opacity-60" style={{ letterSpacing: '0.05em' }}>
                    TOTAL
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Daily Trend Line Chart */}
        <div style={{
          border: '1px solid var(--outline)',
          padding: '1.5rem',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '2px 2px 0px var(--text-on-surface)',
        }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem', opacity: 0.8 }}>DAILY_TREND_VECTORS</h3>
          <div style={{ width: '100%', height: 260 }}>
            {dailyTrend.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', opacity: 0.5 }}>
                NO_TREND_DATA_RECORDED
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--outline-light)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-on-surface)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    tickLine={{ stroke: 'var(--outline)' }}
                    axisLine={{ stroke: 'var(--outline)' }}
                  />
                  <YAxis
                    stroke="var(--text-on-surface)"
                    tick={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                    tickLine={{ stroke: 'var(--outline)' }}
                    axisLine={{ stroke: 'var(--outline)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--outline)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      borderRadius: '4px',
                      boxShadow: 'none',
                    }}
                    labelStyle={{ fontWeight: 'bold', color: 'var(--primary)' }}
                    formatter={(val: number) => `${val.toFixed(2)}h`}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ stroke: 'var(--primary)', strokeWidth: 1, r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
