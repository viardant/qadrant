# Multiple Simultaneous Active Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support running multiple active timers simultaneously. Stick the creation form to the top of the page, and display running timers stacked underneath it, sorted by creation date descending (most recent first). Modify the CLI and MCP server to no longer auto-stop existing timers when starting a new one.

**Architecture:**
1. Split the active timer card into a modular `ActiveTimerCard` component that manages its own 1-second ticker interval.
2. Update `TaskLogger` to render the creation form at the top, and render the list of active timers below it.
3. Update `Logger` page to manage `activeSessions` as an array and pass specific IDs to `onStop`.
4. Update the CLI and MCP server starting actions to bypass auto-stopping, and adjust status/logging outputs to support multiple active entries.

**Tech Stack:** React, TypeScript, Vitest, PocketBase SDK.

---

## Files to Modify

* **Vite SPA Frontend**:
  * `src/components/logger/TaskLogger.tsx` (Form layout, list rendering, separate `ActiveTimerCard` component)
  * `src/components/logger/TaskLogger.test.tsx` (Unit tests for multiple active sessions)
  * `src/pages/Logger.tsx` (Page state with array of active sessions, session start/stop handlers)
* **CLI (`qadrant-cli`)**:
  * `cli/src/index.ts` (Start/stop/status command updates)
* **MCP Server (`qadrant-mcp`)**:
  * `mcp-server/src/index.ts` (Start/stop/get_active tool updates)

---

## Tasks

### Task 1: Refactoring SPA Components (TaskLogger & ActiveTimerCard)

**Files:**
- Modify: `src/components/logger/TaskLogger.tsx`
- Modify: `src/components/logger/TaskLogger.test.tsx`

- [ ] **Step 1: Write the failing test**
  Update `src/components/logger/TaskLogger.test.tsx` to assert that multiple active sessions are rendered below the form in descending order of their start date.
  Add the test:
  ```typescript
  test('renders multiple active sessions sorted descending by start date below the form', () => {
    const activeSessions = [
      {
        id: 'session_older',
        space: 'Piano',
        specialization: 'scales',
        start_date: '2026-06-13T08:00:00.000Z',
        completion_time: null,
        user: 'test_user_id'
      },
      {
        id: 'session_newer',
        space: 'Coding',
        specialization: 'mcp',
        start_date: '2026-06-13T08:30:00.000Z',
        completion_time: null,
        user: 'test_user_id'
      }
    ];

    render(
      <TaskLogger
        onStart={mockOnStart}
        onStop={mockOnStop}
        activeSessions={activeSessions}
        spaces={spaces}
        specializations={specializations}
      />
    );

    // Form inputs should be visible at the top
    expect(screen.getByPlaceholderText('Space name...')).toBeInTheDocument();

    // Both sessions should be visible
    expect(screen.getByText('Piano')).toBeInTheDocument();
    expect(screen.getByText('Coding')).toBeInTheDocument();

    // Verify visual stacking: newer is rendered first
    const cards = screen.getAllByRole('heading', { level: 2 });
    expect(cards[0]).toHaveTextContent('Coding');
    expect(cards[1]).toHaveTextContent('Piano');
  });
  ```
  Run: `npx vitest run src/components/logger/TaskLogger.test.tsx` and verify it fails with typescript compile errors because the component expects `activeSession` instead of `activeSessions`.

- [ ] **Step 2: Write minimal implementation**
  * Update `TaskLoggerProps` inside `src/components/logger/TaskLogger.tsx`:
    ```typescript
    interface TaskLoggerProps {
      onStart: (space: string, specialization: string) => void;
      onStop: (id: string) => void;
      activeSessions: TimeEntry[];
      spaces: string[];
      specializations: string[];
    }
    ```
  * Extract the active timer card to a separate `ActiveTimerCard` component:
    ```typescript
    interface ActiveTimerCardProps {
      entry: TimeEntry;
      onStop: (id: string) => void;
    }

    function ActiveTimerCard({ entry, onStop }: ActiveTimerCardProps) {
      const [duration, setDuration] = useState('00:00:00');

      useEffect(() => {
        const update = () => {
          const diff = Date.now() - new Date(entry.start_date).getTime();
          setDuration(formatDuration(diff));
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
      }, [entry.start_date]);

      const specDisplay = entry.specialization ? ` // ${entry.specialization}` : '';

      return (
        <div className="active-timer-card">
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className="text-sm font-mono text-primary font-bold uppercase tracking-wider">
              ACTIVE_SESSION_PROTOCOL
            </div>
            <h2 className="text-2xl font-mono font-bold" style={{ marginBottom: 0 }}>
              {entry.space}
              {entry.specialization && (
                <span className="text-lg font-normal text-on-surface/60" style={{ marginLeft: '0.5rem' }}>
                  {specDisplay}
                </span>
              )}
            </h2>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto justify-end">
            <div className="text-4xl font-mono font-bold tracking-widest text-primary tabular-nums" style={{ fontSize: '2.5rem' }}>
              {duration}
            </div>
            <button
              onClick={() => onStop(entry.id)}
              type="button"
              className="w-full md:w-auto px-6 py-3 bg-error text-white font-mono uppercase font-bold border border-error shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
            >
              STOP_SESSION
            </button>
          </div>
        </div>
      );
    }
    ```
  * Update `TaskLogger` to render:
    - The creation `<form>` first.
    - Below the form, the sorted list of active timer cards:
      ```typescript
      const sortedSessions = [...activeSessions].sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
      ```
  * Fix and update existing tests in `src/components/logger/TaskLogger.test.tsx` to pass `activeSessions={activeSessions}` (instead of `activeSession`) and mock `onStop` to accept a string parameter.

- [ ] **Step 3: Run test to verify it passes**
  Run: `npx vitest run src/components/logger/TaskLogger.test.tsx`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/logger/TaskLogger.tsx src/components/logger/TaskLogger.test.tsx
  git commit -m "refactor: extract ActiveTimerCard and support multiple simultaneous active timer rendering"
  ```

---

### Task 2: Refactoring Logger Page (`Logger.tsx`)

**Files:**
- Modify: `src/pages/Logger.tsx`

- [ ] **Step 1: Write the failing test**
  No separate test file exists for `Logger.tsx` page logic itself, but updating type compatibility will cause compile failures.
  Run: `npm run build` or `npx tsc`
  Expected: Compile error in `src/pages/Logger.tsx` because of `activeSession` parameter mismatch on `<TaskLogger>`.

- [ ] **Step 2: Write minimal implementation**
  In `src/pages/Logger.tsx`:
  * Change page state to track `activeSessions` as an array:
    ```typescript
    const [activeSessions, setActiveSessions] = useState<TimeEntry[]>([]);
    ```
  * Update `fetchHistoryAndActive` to filter all running timers:
    ```typescript
    const running = records.items.filter((r) => !r.completion_time);
    setActiveSessions(running);
    ```
  * Update `handleStartSession` to only perform the creation POST request, without stopping other active sessions first.
  * Update `handleStopSession` to take an `id` string parameter and patch only that entry:
    ```typescript
    const handleStopSession = async (id: string) => {
      try {
        await pb.collection('time_entries').update(id, {
          completion_time: new Date().toISOString(),
        });
        await fetchHistoryAndActive();
      } catch (err) {
        console.error('Failed to stop tracker session:', err);
        alert('Failed to stop tracker session.');
      }
    };
    ```
  * Always render `<QuickStartCards>` (remove any conditional checking).
  * Update `<TaskLogger>` invocation to pass `activeSessions={activeSessions}` and `onStop={handleStopSession}`.

- [ ] **Step 3: Run tests and build to verify it compiles and passes**
  Run: `npm test` and `npm run build`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/Logger.tsx
  git commit -m "feat: support multiple active sessions page state and stop operations"
  ```

---

### Task 3: Refactoring CLI (`qadrant-cli`)

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Write failing test / compilation checks**
  Verify typescript compilation.
  Expected: Compile success or failure.

- [ ] **Step 2: Write minimal implementation**
  In `cli/src/index.ts`:
  * In `start` command logic:
    - Remove the check/loop that stops active timers. Start the new timer directly.
  * In `stop` command logic:
    - Stop all currently running timers.
  * In `status` command logic:
    - If multiple active timers exist, loop and print each of them on a new line:
      ```typescript
      for (const entry of activeEntries) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
        const specDisplay = entry.specialization ? ` // ${entry.specialization}` : '';
        console.log(`${formatDuration(elapsedSeconds)} - ${entry.space}${specDisplay}`);
      }
      ```
      (Implement `formatDuration` helper for formatting standard durations).

- [ ] **Step 3: Run tests to verify it passes**
  Run: `npx vitest run cli/src/index.test.ts`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add cli/src/index.ts
  git commit -m "feat: allow starting concurrent timers in CLI and update status/stop to support multiple entries"
  ```

---

### Task 4: Refactoring MCP Server (`qadrant-mcp`)

**Files:**
- Modify: `mcp-server/src/index.ts`

- [ ] **Step 1: Write failing test / compile checks**
  Verify compilation.

- [ ] **Step 2: Write minimal implementation**
  In `mcp-server/src/index.ts`:
  * In `qadrant_start_timer` tool handler:
    - Remove the active session lookup/stopping loop. Directly POST and start the new timer.
  * In `qadrant_get_active_timer` tool handler:
    - Return a formatted text message showing all currently active timers (e.g., stacked details), or return `NO_ACTIVE_SESSION`.
    ```typescript
    if (activeEntries.length === 0) {
      return { content: [{ type: 'text', text: 'NO_ACTIVE_SESSION' }] };
    }
    const lines = activeEntries.map(entry => {
      const elapsedSeconds = Math.floor((Date.now() - new Date(entry.start_date).getTime()) / 1000);
      const specDisplay = entry.specialization ? ` // Sub: ${entry.specialization}` : '';
      return `- Active: Space: ${entry.space}${specDisplay} running for ${elapsedSeconds} seconds.`;
    }).join('\n');
    return { content: [{ type: 'text', text: `ACTIVE_TIMERS:\n${lines}` }] };
    ```
  * In `qadrant_stop_timer` tool handler:
    - Stop all active timers (current loop handles stopping all).

- [ ] **Step 3: Run tests to verify it passes**
  Run: `npx vitest run mcp-server/src/index.test.ts`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add mcp-server/src/index.ts
  git commit -m "feat: support simultaneous timers in MCP server start and get_active tools"
  ```
