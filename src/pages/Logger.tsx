import { useEffect, useState } from 'react';
import { pb } from '../lib/pocketbase';
import { TaskLogger, TimeEntry } from '../components/logger/TaskLogger';
import { QuickStartCards } from '../components/logger/QuickStartCards';
import { Loader2 } from 'lucide-react';

export default function Logger() {
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<TimeEntry | null>(null);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [recentCombos, setRecentCombos] = useState<Array<{ space: string; specialization: string }>>([]);

  const fetchHistoryAndActive = async () => {
    if (!pb.authStore.isValid) {
      setLoading(false);
      return;
    }

    try {
      // Fetch recent entries to build autocomplete lists and quick start combos
      const records = await pb.collection('time_entries').getList<TimeEntry>(1, 100, {
        sort: '-start_date',
        filter: `user = "${pb.authStore.model?.id}"`,
        requestKey: null,
      });

      // Filter unique non-empty spaces and specializations from history
      const uniqueSpaces = Array.from(new Set(records.items.map((r) => r.space).filter(Boolean)));
      const uniqueSpecs = Array.from(new Set(records.items.map((r) => r.specialization).filter(Boolean)));

      setSpaces(uniqueSpaces);
      setSpecializations(uniqueSpecs);

      // Build 4-6 unique recent space-specialization combinations
      const combos: Array<{ space: string; specialization: string }> = [];
      const seen = new Set<string>();

      for (const item of records.items) {
        const spaceVal = item.space || '';
        const specVal = item.specialization || '';
        const key = `${spaceVal}|||${specVal}`;
        if (!seen.has(key)) {
          seen.add(key);
          combos.push({ space: spaceVal, specialization: specVal });
          if (combos.length >= 6) break;
        }
      }
      setRecentCombos(combos);

      // Check if there is an active running timer (completion_time is null/empty)
      const running = records.items.find((r) => !r.completion_time);
      if (running) {
        setActiveSession(running);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Failed to load tracking protocol history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndActive();
  }, []);

  const handleStartSession = async (space: string, specialization: string) => {
    if (!pb.authStore.isValid) return;
    try {
      if (activeSession) {
        await pb.collection('time_entries').update(activeSession.id, {
          completion_time: new Date().toISOString(),
        });
      }

      const record = await pb.collection('time_entries').create<TimeEntry>({
        user: pb.authStore.model?.id,
        space,
        specialization,
        start_date: new Date().toISOString(),
      });
      setActiveSession(record);
      await fetchHistoryAndActive();
    } catch (err) {
      console.error('Failed to initiate tracker session:', err);
      alert('Failed to initiate tracker session.');
    }
  };

  const handleStopSession = async (id?: string) => {
    const targetId = id || activeSession?.id;
    if (!targetId) return;
    try {
      await pb.collection('time_entries').update(targetId, {
        completion_time: new Date().toISOString(),
      });
      setActiveSession(null);
      await fetchHistoryAndActive();
    } catch (err) {
      console.error('Failed to stop tracker session:', err);
      alert('Failed to stop tracker session.');
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Loader2 className="spinner" size={32} />
        <span className="font-mono text-sm text-on-surface/60">SYNCHRONIZING_TRACKER_STATE...</span>
      </div>
    );
  }

  return (
    <div className="logger-page-container">
      <div>
        <h1 className="text-3xl font-bold font-mono" style={{ marginBottom: '0.25rem' }}>TRACKER_PROTOCOL</h1>
        <p className="font-mono text-sm text-on-surface/60" style={{ marginBottom: 0 }}>Log and manage real-time active tracking streams.</p>
      </div>

      <TaskLogger
        onStart={handleStartSession}
        onStop={handleStopSession}
        activeSessions={activeSession ? [activeSession] : []}
        spaces={spaces}
        specializations={specializations}
      />

      <QuickStartCards
        recentCombos={recentCombos}
        onStart={handleStartSession}
      />
    </div>
  );
}
