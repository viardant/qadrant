# Uppercase Space and Specialization Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify all user inputs related to space and specialization to enforce real-time uppercase conversion.

**Architecture:** We will apply `.toUpperCase()` in the React state-setting `onChange` handlers for inputs in `NewComboSheet.tsx`, `Ledger.tsx`, `Settings.tsx`, and `Timer.tsx`. This keeps React state, UI display, and database payloads in sync and uppercase.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Update Controlled Form Inputs in NewComboSheet and Ledger

**Files:**
- Modify: `src/components/timer/NewComboSheet.tsx`
- Modify: `src/pages/Ledger.tsx`

- [ ] **Step 1: Update NewComboSheet space and specialization input handlers**
  In `/Users/viardant/Code/qadrant/src/components/timer/NewComboSheet.tsx`, modify the inputs for `space` (around line 73) and `specialization` (around line 85) to call `.toUpperCase()`.

  Space input change:
  ```typescript
  // Replace:
  onChange={(e) => setSpace(e.target.value)}
  // With:
  onChange={(e) => setSpace(e.target.value.toUpperCase())}
  ```

  Specialization input change:
  ```typescript
  // Replace:
  onChange={(e) => setSpecialization(e.target.value)}
  // With:
  onChange={(e) => setSpecialization(e.target.value.toUpperCase())}
  ```

- [ ] **Step 2: Update Ledger edit space and specialization input handlers**
  In `/Users/viardant/Code/qadrant/src/pages/Ledger.tsx`, modify the inputs for `space` (around line 272) and `specialization` (around line 282) to call `.toUpperCase()`.

  Space input change:
  ```typescript
  // Replace:
  onChange={(e) => setEditSpace(e.target.value)}
  // With:
  onChange={(e) => setEditSpace(e.target.value.toUpperCase())}
  ```

  Specialization input change:
  ```typescript
  // Replace:
  onChange={(e) => setEditSpecialization(e.target.value)}
  // With:
  onChange={(e) => setEditSpecialization(e.target.value.toUpperCase())}
  ```

- [ ] **Step 3: Run project build**
  Run: `npm run build`
  Expected: Success.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/timer/NewComboSheet.tsx src/pages/Ledger.tsx
  git commit -m "feat: enforce uppercase on NewComboSheet and Ledger space/specialization inputs"
  ```

---

### Task 2: Update Settings Rename Inputs

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Update Space and Specialization rename modal input handlers**
  In `/Users/viardant/Code/qadrant/src/pages/Settings.tsx`, modify the text input field in both the Space Rename Modal (around line 696) and Specialization Rename Modal (around line 752) to call `.toUpperCase()`.

  Space rename input:
  ```typescript
  // Replace:
  onChange={(e) => setNewName(e.target.value)}
  // With:
  onChange={(e) => setNewName(e.target.value.toUpperCase())}
  ```

  Specialization rename input:
  ```typescript
  // Replace:
  onChange={(e) => setNewName(e.target.value)}
  // With:
  onChange={(e) => setNewName(e.target.value.toUpperCase())}
  ```

- [ ] **Step 2: Verify project compilation**
  Run: `npm run build`

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/Settings.tsx
  git commit -m "feat: enforce uppercase on Settings rename inputs"
  ```

---

### Task 3: Update Timer Query Search Input

**Files:**
- Modify: `src/pages/Timer.tsx`

- [ ] **Step 1: Enforce uppercase on ComboSearch input in Timer**
  In `/Users/viardant/Code/qadrant/src/pages/Timer.tsx` (around line 459), update the `ComboSearch` component call to change `onChange={setQuery}` to call `.toUpperCase()`.

  Code change:
  ```typescript
  // Replace:
  onChange={setQuery}
  // With:
  onChange={(val) => setQuery(val.toUpperCase())}
  ```

- [ ] **Step 2: Verify project compilation**
  Run: `npm run build`

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/Timer.tsx
  git commit -m "feat: enforce uppercase on Timer query search input"
  ```

---

### Task 4: Update and Verify Test Suites

**Files:**
- Modify: `src/pages/Timer.test.tsx`
- Modify: `src/pages/Settings.test.tsx`
- Modify: `src/pages/Ledger.test.tsx`

- [ ] **Step 1: Check and update Timer test queries to use uppercase**
  Open `/Users/viardant/Code/qadrant/src/pages/Timer.test.tsx`. If there are tests that simulate typing lowercase characters (e.g. `fireEvent.change(input, { target: { value: 'dev/react' } })`) and assert that the text is strictly lowercase or mock calls check for lowercase, update them to check/assert uppercase values since the input now forces uppercase immediately.

- [ ] **Step 2: Check and update Settings test rename inputs to use uppercase**
  Open `/Users/viardant/Code/qadrant/src/pages/Settings.test.tsx` and ensure any inputs simulated in rename tests align with the new uppercase input state.

- [ ] **Step 3: Run Vitest test runner on all three suites**
  Run: `npx vitest run src/pages/Timer.test.tsx src/pages/Settings.test.tsx src/pages/Ledger.test.tsx`
  Expected: All tests pass.

- [ ] **Step 4: Commit test updates**
  ```bash
  git add src/pages/Timer.test.tsx src/pages/Settings.test.tsx src/pages/Ledger.test.tsx
  git commit -m "test: update tests for uppercase inputs"
  ```
