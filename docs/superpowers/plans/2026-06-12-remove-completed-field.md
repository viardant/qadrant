# Redundant 'completed' Field Deprecation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant `completed` boolean field from all software layers (web client, CLI, and MCP server) and use `completion_time` (null vs. ISO timestamp) to determine timer session state.

**Architecture:** Refactor queries to use `completion_time = ""` (active) and `completion_time != ""` (completed) filters, remove the property from TypeScript types/payloads, and update all unit test mocks.

**Tech Stack:** React, TypeScript, Vitest, PocketBase SDK.

---

## Files to Modify

* **Types & Shared Logic**:
  * `src/components/logger/TaskLogger.tsx` (Interface definition)
  * `src/lib/transform.ts` (Analytics transformations)
  * `src/lib/transform.test.ts` (Unit tests)
* **Frontend Web SPA**:
  * `src/pages/Logger.tsx` (Timer active checks & start/stop actions)
  * `src/pages/Ledger.tsx` (Table lists & filters)
  * `src/pages/Charts.tsx` (Analytics rendering)
  * `src/components/logger/TaskLogger.test.tsx` (Logger unit tests)
  * `src/pages/Ledger.test.tsx` (Ledger unit tests)
* **CLI (`qadrant-cli`)**:
  * `cli/src/index.ts` (Command queries & mutation payloads)
* **MCP Server (`qadrant-mcp`)**:
  * `mcp-server/src/index.ts` (Tool handler queries & mutation payloads)

---

## Tasks

### Task 1: Refactoring Core Types & lib/transform

**Files:**
- Modify: `src/components/logger/TaskLogger.tsx`
- Modify: `src/lib/transform.ts`
- Modify: `src/lib/transform.test.ts`

- [ ] **Step 1: Write the failing test**
  Update `src/lib/transform.test.ts` to remove the `completed` property from the mock input items. Also adjust `src/lib/transform.ts` to enforce typescript failures if `completed` is still checked.
  Edit the mock array in `src/lib/transform.test.ts` to look like:
  ```typescript
  const mockEntries: TimeEntry[] = [
    {
      id: '1',
      user: 'usr123',
      space: 'Work',
      specialization: 'Client A',
      start_date: '2026-06-08T09:00:00.000Z',
      completion_time: '2026-06-08T11:30:00.000Z', // 2.5 hours
    },
    ...
  ];
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/transform.test.ts`
  Expected: FAIL (Type error: `completed` property missing in mocks, or compile error in `transform.ts` because `entry.completed` is checked).

- [ ] **Step 3: Write minimal implementation**
  * Update `TimeEntry` interface in `src/components/logger/TaskLogger.tsx` to remove `completed: boolean;`.
  * Update `src/lib/transform.ts` to calculate hours only using `completion_time`:
    ```typescript
    export function calculateDurationHours(entry: TimeEntry): number {
      if (!entry.completion_time) return 0;
      const start = new Date(entry.start_date);
      const end = new Date(entry.completion_time);
      return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    }
    ```
    And filter completed entries:
    ```typescript
    const completed = entries.filter(e => e.completion_time);
    ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/transform.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/logger/TaskLogger.tsx src/lib/transform.ts src/lib/transform.test.ts
  git commit -m "refactor: remove completed field from TimeEntry type and analytics transformations"
  ```

---

### Task 2: Refactoring Frontend React Pages (Logger, Ledger, Charts)

**Files:**
- Modify: `src/pages/Logger.tsx`
- Modify: `src/pages/Ledger.tsx`
- Modify: `src/pages/Charts.tsx`
- Modify: `src/components/logger/TaskLogger.test.tsx`
- Modify: `src/pages/Ledger.test.tsx`

- [ ] **Step 1: Write the failing test**
  Modify mock entries in `src/components/logger/TaskLogger.test.tsx` and `src/pages/Ledger.test.tsx` to remove `completed`. Make `Ledger.test.tsx` mock PocketBase `getList` calls to expect filter `completion_time != ""`.
  Expected: FAIL with compilation and query match failures.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/logger/TaskLogger.test.tsx src/pages/Ledger.test.tsx`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  * In `src/pages/Logger.tsx`:
    - Find active running session using: `const running = records.items.find((r) => !r.completion_time);`.
    - Do not send `completed: false` inside `handleStartSession` payload.
    - Do not send `completed: true` inside `handleStopSession` payload.
  * In `src/pages/Ledger.tsx`:
    - Change query filter inside `fetchEntries` to: `filter: \`completion_time != "" && user = "${pb.authStore.model?.id}"\``.
  * In `src/pages/Charts.tsx`:
    - Filter completed entries using `const completedEntries = entries.filter(e => e.completion_time);`.
  * Fix all mock values in tests to omit `completed`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/logger/TaskLogger.test.tsx src/pages/Ledger.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/Logger.tsx src/pages/Ledger.tsx src/pages/Charts.tsx src/components/logger/TaskLogger.test.tsx src/pages/Ledger.test.tsx
  git commit -m "refactor: remove completed field from frontend components, queries, and tests"
  ```

---

### Task 3: Refactoring CLI (`qadrant-cli`)

**Files:**
- Modify: `cli/src/index.ts`
- Modify: `cli/src/index.test.ts`

- [ ] **Step 1: Write the failing test**
  Verify CLI tests check parsing and operations.
  Expected: FAIL or TS compilation check failure if `cli/src/index.ts` compiles with `completed` missing from `TimeEntry` schema.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test` or `npx vitest run cli/src/index.test.ts`
  Expected: FAIL / TypeScript errors.

- [ ] **Step 3: Write minimal implementation**
  In `cli/src/index.ts`:
  * Update `TimeEntry` interface (or import) to match the new definition without `completed`.
  * In `start` command logic:
    - Query active using `completion_time=""`.
    - Do not send `completed: true` on stop PATCH.
    - Do not send `completed: false` on start POST.
  * In `stop` command logic:
    - Query active using `completion_time=""`.
    - Do not send `completed: true` on PATCH.
  * In `status` command logic:
    - Query active using `completion_time=""`.
  * In `list` command logic:
    - Query using `completion_time!=""`.
  * In `stats` command logic:
    - Query using `completion_time!=""`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run cli/src/index.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add cli/src/index.ts
  git commit -m "refactor: remove completed field from cli client and api filters"
  ```

---

### Task 4: Refactoring MCP Server (`qadrant-mcp`)

**Files:**
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/src/index.test.ts`

- [ ] **Step 1: Write the failing test**
  Update `mcp-server/src/index.test.ts` or verify typescript compilation of the MCP server fails when `completed` is removed.
  Expected: FAIL with typescript or compilation issues.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run mcp-server/src/index.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  In `mcp-server/src/index.ts`:
  * Remove `completed: boolean` from `TimeEntryRecord` interface.
  * In `qadrant_start_timer` tool:
    - Check active timer filter: `completion_time=""`.
    - Do not send `completed: true` on PATCH.
    - Do not send `completed: false` on POST.
  * In `qadrant_stop_timer` tool:
    - Check active timer filter: `completion_time=""`.
    - Do not send `completed: true` on PATCH.
  * In `qadrant_get_active_timer` tool:
    - Filter active timer: `completion_time=""`.
  * In `qadrant_list_entries` tool:
    - Filter completed timers: `completion_time!=""`.
  * In `qadrant_get_stats` tool:
    - Filter completed timers: `completion_time!=""`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run mcp-server/src/index.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add mcp-server/src/index.ts
  git commit -m "refactor: remove completed field from mcp-server tools and queries"
  ```
