# Timer & Logger Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the time tracking interface with unified inputs, autocomplete dropdowns, inline creation, and Quick Start cards, integrated with the PocketBase backend.

**Architecture:** 
- A UI component `TaskLogger.tsx` managing input state, filtering autocomplete suggestions from history, and displaying a ticking duration timer when a session is active.
- A UI component `QuickStartCards.tsx` rendering recent unique `(space, specialization)` combinations.
- A controller page `Logger.tsx` fetching history, managing active session query/mutations with PocketBase, and synchronizing with the timer.

**Tech Stack:** React 19, Vitest, PocketBase SDK.

---

### Task 1: Test Suite for TaskLogger

**Files:**
- Create: `src/components/logger/TaskLogger.test.tsx`

- [ ] **Step 1: Write the failing test**
  Create `src/components/logger/TaskLogger.test.tsx` to verify:
  - Render inputs when idle.
  - Call `onStart` with input values when start is clicked.
  - Tick and display elapsed time `hh:mm:ss` when `activeSession` is active.
  - Call `onStop` when stop is clicked.
  - Autocomplete suggestion filtering and selection.
  - Mock PocketBase requests.

  ```typescript
  import { render, screen, fireEvent, act } from '@testing-library/react';
  import { vi, describe, test, expect, beforeEach } from 'vitest';
  import { TaskLogger } from './TaskLogger';

  // Mock PocketBase client
  vi.mock('../../lib/pocketbase', () => {
    return {
      pb: {
        collection: vi.fn().mockReturnValue({
          create: vi.fn(),
          update: vi.fn(),
        }),
        authStore: {
          record: { id: 'test_user_id' }
        }
      },
    };
  });

  describe('TaskLogger', () => {
    const mockOnStart = vi.fn();
    const mockOnStop = vi.fn();
    const spaces = ['Design', 'Development', 'DevOps'];
    const specializations = ['apok', 'infra', 'ui'];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    test('renders inputs in idle state', () => {
      render(
        <TaskLogger
          onStart={mockOnStart}
          onStop={mockOnStop}
          activeSession={null}
          spaces={spaces}
          specializations={specializations}
        />
      );

      expect(screen.getByPlaceholderText('Task name...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Space...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Specialization...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'START' })).toBeInTheDocument();
    });

    test('clicking start calls onStart with task, space, and specialization', () => {
      render(
        <TaskLogger
          onStart={mockOnStart}
          onStop={mockOnStop}
          activeSession={null}
          spaces={spaces}
          specializations={specializations}
        />
      );

      fireEvent.change(screen.getByPlaceholderText('Task name...'), { target: { value: 'Code Logger' } });
      fireEvent.change(screen.getByPlaceholderText('Space...'), { target: { value: 'Development' } });
      fireEvent.change(screen.getByPlaceholderText('Specialization...'), { target: { value: 'apok' } });

      fireEvent.click(screen.getByRole('button', { name: 'START' }));

      expect(mockOnStart).toHaveBeenCalledWith('Code Logger', 'Development', 'apok');
    });

    test('renders ticking timer in active session state', () => {
      vi.useFakeTimers();
      const mockStartDate = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
      const activeSession = {
        id: 'session_123',
        task: 'Ticking Task',
        space: 'Design',
        specialization: 'ui',
        start_date: mockStartDate,
        completed: false,
        completion_time: null,
        user: 'test_user_id'
      };

      render(
        <TaskLogger
          onStart={mockOnStart}
          onStop={mockOnStop}
          activeSession={activeSession}
          spaces={spaces}
          specializations={specializations}
        />
      );

      // Verify task and tag labels are present
      expect(screen.getByText('Ticking Task')).toBeInTheDocument();
      expect(screen.getByText('[Design] ui')).toBeInTheDocument();

      // Check initial ticking duration
      expect(screen.getByText('00:00:05')).toBeInTheDocument();

      // Advance time by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('00:00:07')).toBeInTheDocument();

      vi.useRealTimers();
    });

    test('clicking stop calls onStop', () => {
      const activeSession = {
        id: 'session_123',
        task: 'Ticking Task',
        space: 'Design',
        specialization: 'ui',
        start_date: new Date().toISOString(),
        completed: false,
        completion_time: null,
        user: 'test_user_id'
      };

      render(
        <TaskLogger
          onStart={mockOnStart}
          onStop={mockOnStop}
          activeSession={activeSession}
          spaces={spaces}
          specializations={specializations}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'STOP_SESSION' }));
      expect(mockOnStop).toHaveBeenCalledTimes(1);
    });

    test('shows autocomplete suggestions when inputs are focused and filters them', () => {
      render(
        <TaskLogger
          onStart={mockOnStart}
          onStop={mockOnStop}
          activeSession={null}
          spaces={spaces}
          specializations={specializations}
        />
      );

      const spaceInput = screen.getByPlaceholderText('Space...');
      fireEvent.focus(spaceInput);

      // Expect default space suggestions
      expect(screen.getByText('Design')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('DevOps')).toBeInTheDocument();

      // Filter by typing
      fireEvent.change(spaceInput, { target: { value: 'Dev' } });
      expect(screen.queryByText('Design')).not.toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('DevOps')).toBeInTheDocument();

      // Selecting option sets input value
      fireEvent.click(screen.getByText('Development'));
      expect(spaceInput).toHaveValue('Development');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/logger/TaskLogger.test.tsx`
  Expected: FAIL (No components exist yet).

---

### Task 2: Component Implementation: TaskLogger

**Files:**
- Create: `src/components/logger/TaskLogger.tsx`

- [ ] **Step 3: Write minimal implementation**
  Implement the `TaskLogger` component with:
  - Input state management.
  - Dropdown menus for autocomplete suggestions.
  - Auto-scrolling, selection handling via mouse click or Enter key. Hitting Enter or Tab registers the current input.
  - Ticking timer hooks (`setInterval` calculating time difference from `activeSession.start_date` to `Date.now()`).
  - Strict UI styling following the editorial-technical layout (monospace typography, blocky buttons, thin borders).

  ```typescript
  import React, { useState, useEffect, useRef } from 'react';

  export interface TimeEntry {
    id: string;
    task: string;
    space: string;
    specialization: string;
    start_date: string;
    completed: boolean;
    completion_time: string | null;
    user: string;
  }

  interface TaskLoggerProps {
    onStart: (task: string, space: string, specialization: string) => void;
    onStop: () => void;
    activeSession: TimeEntry | null;
    spaces: string[];
    specializations: string[];
  }

  function formatDuration(ms: number): string {
    if (ms < 0) ms = 0;
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }

  export function TaskLogger({ onStart, onStop, activeSession, spaces, specializations }: TaskLoggerProps) {
    const [task, setTask] = useState('');
    const [space, setSpace] = useState('');
    const [specialization, setSpecialization] = useState('');

    const [activeDuration, setActiveDuration] = useState('00:00:00');

    // Autocomplete focus / visibility states
    const [showSpaceSuggestions, setShowSpaceSuggestions] = useState(false);
    const [showSpecSuggestions, setShowSpecSuggestions] = useState(false);

    const spaceRef = useRef<HTMLDivElement>(null);
    const specRef = useRef<HTMLDivElement>(null);

    // Active session timer effect
    useEffect(() => {
      if (!activeSession) return;

      const updateTimer = () => {
        const start = new Date(activeSession.start_date).getTime();
        const diff = Date.now() - start;
        setActiveDuration(formatDuration(diff));
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }, [activeSession]);

    // Close dropdowns on click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (spaceRef.current && !spaceRef.current.contains(e.target as Node)) {
          setShowSpaceSuggestions(false);
        }
        if (specRef.current && !specRef.current.contains(e.target as Node)) {
          setShowSpecSuggestions(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStart = (e: React.FormEvent) => {
      e.preventDefault();
      if (!task.trim()) return;
      onStart(task.trim(), space.trim(), specialization.trim());
      setTask('');
      setSpace('');
      setSpecialization('');
    };

    // Filter autocomplete list based on input value
    const filteredSpaces = spaces.filter((s) =>
      s.toLowerCase().includes(space.toLowerCase())
    );

    const filteredSpecs = specializations.filter((s) =>
      s.toLowerCase().includes(specialization.toLowerCase())
    );

    if (activeSession) {
      return (
        <div className="active-timer-card border border-primary p-6 rounded bg-surface shadow-[4px_4px_0px_var(--primary)] flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className="text-sm font-mono text-primary font-bold uppercase tracking-wider">
              ACTIVE_SESSION_PROTOCOL
            </div>
            <h2 className="text-2xl font-mono font-bold">{activeSession.task}</h2>
            {(activeSession.space || activeSession.specialization) && (
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-outline-light font-mono text-xs rounded border border-outline">
                  {`[${activeSession.space || 'No Space'}] ${activeSession.specialization || ''}`.trim()}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto justify-end">
            <div className="text-4xl font-mono font-bold tracking-widest text-primary tabular-nums">
              {activeDuration}
            </div>
            <button
              onClick={onStop}
              className="w-full md:w-auto px-6 py-3 bg-error text-white font-mono uppercase font-bold border border-error shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
            >
              STOP_SESSION
            </button>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={handleStart} className="task-logger-form border border-outline p-6 rounded bg-surface shadow-[2px_2px_0px_var(--text-on-surface)] flex flex-col gap-4">
        <div className="text-sm font-mono text-on-surface font-bold uppercase tracking-wider">
          NEW_SESSION_PROTOCOL
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Task Name */}
          <div className="flex flex-col gap-1 md:col-span-1">
            <label className="text-xs font-mono font-bold uppercase text-on-surface/60">Task</label>
            <input
              type="text"
              placeholder="Task name..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full font-mono"
              required
            />
          </div>

          {/* Space Autocomplete */}
          <div ref={spaceRef} className="flex flex-col gap-1 relative">
            <label className="text-xs font-mono font-bold uppercase text-on-surface/60">Space</label>
            <input
              type="text"
              placeholder="Space..."
              value={space}
              onChange={(e) => {
                setSpace(e.target.value);
                setShowSpaceSuggestions(true);
              }}
              onFocus={() => setShowSpaceSuggestions(true)}
              className="w-full font-mono"
            />
            {showSpaceSuggestions && filteredSpaces.length > 0 && (
              <ul className="absolute top-full left-0 right-0 bg-surface border border-outline rounded mt-1 max-h-40 overflow-y-auto z-10 shadow-lg">
                {filteredSpaces.map((s) => (
                  <li
                    key={s}
                    onClick={() => {
                      setSpace(s);
                      setShowSpaceSuggestions(false);
                    }}
                    className="px-3 py-2 font-mono text-sm cursor-pointer hover:bg-outline-light hover:text-primary transition-colors"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Specialization Autocomplete */}
          <div ref={specRef} className="flex flex-col gap-1 relative">
            <label className="text-xs font-mono font-bold uppercase text-on-surface/60">Specialization</label>
            <input
              type="text"
              placeholder="Specialization..."
              value={specialization}
              onChange={(e) => {
                setSpecialization(e.target.value);
                setShowSpecSuggestions(true);
              }}
              onFocus={() => setShowSpecSuggestions(true)}
              className="w-full font-mono"
            />
            {showSpecSuggestions && filteredSpecs.length > 0 && (
              <ul className="absolute top-full left-0 right-0 bg-surface border border-outline rounded mt-1 max-h-40 overflow-y-auto z-10 shadow-lg">
                {filteredSpecs.map((s) => (
                  <li
                    key={s}
                    onClick={() => {
                      setSpecialization(s);
                      setShowSpecSuggestions(false);
                    }}
                    className="px-3 py-2 font-mono text-sm cursor-pointer hover:bg-outline-light hover:text-primary transition-colors"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 w-full py-3 bg-primary text-white font-mono uppercase font-bold border border-primary shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
        >
          START
        </button>
      </form>
    );
  }
  ```

---

### Task 3: Component Implementation: QuickStartCards

**Files:**
- Create: `src/components/logger/QuickStartCards.tsx`

- [ ] **Step 3: Write implementation**
  Create `src/components/logger/QuickStartCards.tsx` which maps the most recent unique (space, specialization) combinations (up to 4-6 cards) and starts a new session with those tags on click.

  ```typescript
  import { Play } from 'lucide-react';

  interface QuickStartCardsProps {
    recentCombos: Array<{ space: string; specialization: string }>;
    onStart: (task: string, space: string, specialization: string) => void;
  }

  export function QuickStartCards({ recentCombos, onStart }: QuickStartCardsProps) {
    if (recentCombos.length === 0) return null;

    return (
      <div className="quick-start-section flex flex-col gap-3">
        <h3 className="text-sm font-mono font-bold uppercase text-on-surface/60 tracking-wider">
          QUICK_START_SHORTCUTS
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {recentCombos.map((combo, idx) => (
            <button
              key={`${combo.space}-${combo.specialization}-${idx}`}
              onClick={() => onStart('Quick Start', combo.space, combo.specialization)}
              className="quick-start-card border border-outline hover:border-primary p-4 rounded text-left bg-surface hover:bg-outline-light transition-all flex justify-between items-center group shadow-[1px_1px_0px_var(--outline)] hover:shadow-[3px_3px_0px_var(--primary)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[1px_1px_0px_var(--primary)]"
            >
              <div className="flex flex-col gap-1 overflow-hidden">
                <span className="font-mono font-bold text-sm truncate text-on-surface">
                  {combo.space || 'No Space'}
                </span>
                <span className="font-mono text-xs text-on-surface/60 truncate">
                  {combo.specialization || 'general'}
                </span>
              </div>
              <Play size={16} className="text-primary opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
    );
  }
  ```

---

### Task 4: Integrate Logger Page

**Files:**
- Modify: `src/pages/Logger.tsx`

- [ ] **Step 3: Write implementation**
  Implement active session detection, starts/stops mutation, and history fetching.
  Let's replace the stub `Logger.tsx` with:
  ```typescript
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
      if (!pb.authStore.isValid) return;
      try {
        // Fetch last 50 entries to build autocomplete arrays and shortcuts
        const records = await pb.collection('time_entries').getList<TimeEntry>(1, 50, {
          sort: '-start_date',
          filter: `user = "${pb.authStore.record?.id}"`,
        });

        // Unique spaces and specializations
        const uniqueSpaces = Array.from(new Set(records.items.map(r => r.space).filter(Boolean)));
        const uniqueSpecs = Array.from(new Set(records.items.map(r => r.specialization).filter(Boolean)));

        setSpaces(uniqueSpaces);
        setSpecializations(uniqueSpecs);

        // Quick start cards: 4-6 most recent unique combinations of (space, specialization)
        const combos: Array<{ space: string; specialization: string }> = [];
        const seen = new Set<string>();

        for (const item of records.items) {
          const key = `${item.space || ''}|||${item.specialization || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            combos.push({ space: item.space, specialization: item.specialization });
            if (combos.length >= 6) break;
          }
        }
        setRecentCombos(combos);

        // Find running timer (completed = false)
        const running = records.items.find(r => !r.completed);
        if (running) {
          setActiveSession(running);
        } else {
          setActiveSession(null);
        }
      } catch (err) {
        console.error('Failed to load tracking data:', err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchHistoryAndActive();
    }, []);

    const handleStartSession = async (task: string, space: string, specialization: string) => {
      if (!pb.authStore.isValid) return;
      try {
        const record = await pb.collection('time_entries').create<TimeEntry>({
          user: pb.authStore.record?.id,
          task,
          space,
          specialization,
          start_date: new Date().toISOString(),
          completed: false,
          completion_time: null,
        });
        setActiveSession(record);
      } catch (err) {
        console.error('Failed to start session:', err);
        alert('Could not start tracking session.');
      }
    };

    const handleStopSession = async () => {
      if (!activeSession) return;
      try {
        await pb.collection('time_entries').update(activeSession.id, {
          completed: true,
          completion_time: new Date().toISOString(),
        });
        setActiveSession(null);
        // Refresh autocomplete options and quick start list
        await fetchHistoryAndActive();
      } catch (err) {
        console.error('Failed to stop session:', err);
        alert('Could not stop tracking session.');
      }
    };

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="font-mono text-sm text-on-surface/60">SYNCHRONIZING_TRACKER_STATE...</span>
        </div>
      );
    }

    return (
      <div className="logger-page-container flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-mono">TRACKER_PROTOCOL</h1>
          <p className="font-mono text-sm text-on-surface/60">Log and manage real-time active tracking streams.</p>
        </div>

        <TaskLogger
          onStart={handleStartSession}
          onStop={handleStopSession}
          activeSession={activeSession}
          spaces={spaces}
          specializations={specializations}
        />

        {!activeSession && (
          <QuickStartCards
            recentCombos={recentCombos}
            onStart={handleStartSession}
          />
        )}
      </div>
    );
  }
  ```

---

### Task 5: Verify & Commit

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/logger/TaskLogger.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/components/logger/ src/pages/Logger.tsx
  git commit -m "feat: implement task logger with inline autocomplete and quick start cards"
  ```
