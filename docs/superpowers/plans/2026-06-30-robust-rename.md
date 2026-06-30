# Robust Rename and Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve space and specialization renaming to be highly resilient against Cloudflare rate limits by utilizing PocketBase's transactional batch API with retries, and support merging (for recovery or intentional merging) with a UI warning and confirmation.

**Architecture:** We will increase the batch size to 100, use PocketBase `pb.createBatch()` to run updates atomically per batch, implement an exponential backoff retry helper, and replace the hard validation error with a confirmation warning that alters the submit button to ">>> CONFIRM_MERGE".

**Tech Stack:** React, PocketBase JS SDK v0.21.x, Vitest, Testing Library

---

### Task 1: Add Retry Helper and Update Batch Size

**Files:**
- Modify: `src/pages/Settings.tsx:1-40`

- [ ] **Step 1: Increase batch size and implement the exponential backoff retry utility**
  Modify `/Users/viardant/Code/qadrant/src/pages/Settings.tsx` to set `RENAME_BATCH_SIZE` to `100` and add the `runWithRetry` helper.

  Code changes to apply:
  ```typescript
  // Around line 13:
  const RENAME_BATCH_SIZE = 100;
  ```

  And add the helper:
  ```typescript
  async function runWithRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (retries <= 0) throw err;
      console.warn(`Request failed. Retrying in ${delayMs}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return runWithRetry(fn, retries - 1, delayMs * 2);
    }
  }
  ```

- [ ] **Step 2: Verify code compiles**
  Run `npm run build` to ensure there are no TypeScript compile errors.
  Expected output: Clean build.

- [ ] **Step 3: Commit**
  ```bash
  git add src/pages/Settings.tsx
  git commit -m "refactor: increase batch size and add runWithRetry helper"
  ```

---

### Task 2: Implement Transactional Batching & Merge Logic

**Files:**
- Modify: `src/pages/Settings.tsx:80-210`

- [ ] **Step 1: Update executeRenameSpace to use pb.createBatch(), runWithRetry, and merge colors**
  Modify `/Users/viardant/Code/qadrant/src/pages/Settings.tsx`'s `executeRenameSpace` to remove the hard error block, use transactional batches of 100 with retries, and properly merge space colors.

  Implementation code:
  ```typescript
  const executeRenameSpace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pb.authStore.model?.id || !renameTargetSpace) return;
    const targetNew = newName.trim();
    if (!targetNew || targetNew === renameTargetSpace) return;

    setRenameInProgress(true);
    setRenameError(null);
    setRenameProgressText('FETCHING_RECORDS…');

    let updatedSome = false;
    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: pb.filter('user = {:userId} && space = {:space}', {
          userId: pb.authStore.model.id,
          space: renameTargetSpace,
        }),
      });

      const totalSteps = Math.ceil(entries.length / RENAME_BATCH_SIZE);

      for (let i = 0; i < entries.length; i += RENAME_BATCH_SIZE) {
        const batchItems = entries.slice(i, i + RENAME_BATCH_SIZE);
        const currentStep = Math.floor(i / RENAME_BATCH_SIZE) + 1;
        setRenameProgressText(`MIGRATING_RECORDS // STEP ${currentStep} OF ${totalSteps || 1}…`);

        const batch = pb.createBatch();
        for (const entry of batchItems) {
          batch.collection('time_entries').update(entry.id, { space: targetNew });
        }

        await runWithRetry(() => batch.send());
        updatedSome = true;
      }

      // Update color settings if they exist
      setRenameProgressText('UPDATING_PREFERENCES…');
      const updatedColors = { ...spaceColors };
      if (updatedColors[renameTargetSpace]) {
        // If target space doesn't have a color, migrate the old one
        if (!updatedColors[targetNew]) {
          updatedColors[targetNew] = updatedColors[renameTargetSpace];
        }
        delete updatedColors[renameTargetSpace];
        const updatedUser = await pb.collection('users').update(pb.authStore.model.id, {
          space_colors: updatedColors,
        });
        pb.authStore.save(pb.authStore.token, updatedUser);
        setSpaceColors(updatedColors);
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setRenameError('Rename failed. Please retry.');
      setRenameInProgress(false);
      if (updatedSome) {
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };
  ```

- [ ] **Step 2: Update executeRenameSpec to use pb.createBatch() and runWithRetry**
  Modify `/Users/viardant/Code/qadrant/src/pages/Settings.tsx`'s `executeRenameSpec` to remove the hard error block and implement transactional batching.

  Implementation code:
  ```typescript
  const executeRenameSpec = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pb.authStore.model?.id || !renameTargetSpec) return;
    const targetNew = newName.trim();
    const { space, spec: oldSpec } = renameTargetSpec;
    if (!targetNew || targetNew === oldSpec) return;

    setRenameInProgress(true);
    setRenameError(null);
    setRenameProgressText('FETCHING_RECORDS…');

    let updatedSome = false;
    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: pb.filter('user = {:userId} && space = {:space} && specialization = {:spec}', {
          userId: pb.authStore.model.id,
          space: space,
          spec: oldSpec,
        }),
      });

      const totalSteps = Math.ceil(entries.length / RENAME_BATCH_SIZE);

      for (let i = 0; i < entries.length; i += RENAME_BATCH_SIZE) {
        const batchItems = entries.slice(i, i + RENAME_BATCH_SIZE);
        const currentStep = Math.floor(i / RENAME_BATCH_SIZE) + 1;
        setRenameProgressText(`MIGRATING_RECORDS // STEP ${currentStep} OF ${totalSteps || 1}…`);

        const batch = pb.createBatch();
        for (const entry of batchItems) {
          batch.collection('time_entries').update(entry.id, { specialization: targetNew });
        }

        await runWithRetry(() => batch.send());
        updatedSome = true;
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setRenameError('Rename failed. Please retry.');
      setRenameInProgress(false);
      if (updatedSome) {
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };
  ```

- [ ] **Step 3: Verify build compiles cleanly**
  Run `npm run build`.

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/Settings.tsx
  git commit -m "feat: implement transactional batching and retry logic in space and specialization renames"
  ```

---

### Task 3: Implement UI Merge Warnings and Confirm Button

**Files:**
- Modify: `src/pages/Settings.tsx:630-730`

- [ ] **Step 1: Add merge warning UI and dynamic submit button to Space Rename Modal**
  Add warnings when the target space name already exists.

  In the `Modal` for `renameTargetSpace !== null` (around lines 641-678), implement the warning detection:
  ```typescript
  const trimmedNewName = newName.trim();
  const spaceExists = trimmedNewName && spaceDetails.some(
    (d) => d.name.toLowerCase() === trimmedNewName.toLowerCase() && d.name.toLowerCase() !== renameTargetSpace.toLowerCase()
  );
  ```

  Update the submit button's label:
  ```typescript
  disabled={renameInProgress || !newName.trim() || newName.trim() === renameTargetSpace}
  >
    {renameInProgress ? 'EXECUTING...' : spaceExists ? '>>> CONFIRM_MERGE' : '>>> EXECUTE_RENAME'}
  ```

  And add the warning message inside the form (before `{renameInProgress && ...}`):
  ```typescript
  {spaceExists && (
    <div style={{ padding: 'var(--space-3)', borderLeft: '3px solid var(--warning, #eab308)', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning, #eab308)', fontSize: '0.875rem' }} role="alert">
      ⚠️ A space with this name already exists. Executing this rename will merge all entries into it.
    </div>
  )}
  ```

- [ ] **Step 2: Add merge warning UI and dynamic submit button to Specialization Rename Modal**
  In the `Modal` for `renameTargetSpec !== null` (around lines 683-730), implement warning detection:
  ```typescript
  const trimmedNewSpec = newName.trim();
  const specGroup = renameTargetSpec ? spaceDetails.find((d) => d.name === renameTargetSpec.space) : null;
  const specExists = trimmedNewSpec && specGroup?.specializations.some(
    (s) => s.toLowerCase() === trimmedNewSpec.toLowerCase() && s.toLowerCase() !== renameTargetSpec?.spec.toLowerCase()
  );
  ```

  Update the submit button's label:
  ```typescript
  disabled={renameInProgress || !newName.trim() || newName.trim() === renameTargetSpec?.spec}
  >
    {renameInProgress ? 'EXECUTING...' : specExists ? '>>> CONFIRM_MERGE' : '>>> EXECUTE_RENAME'}
  ```

  And add the warning message inside the form (before `{renameInProgress && ...}`):
  ```typescript
  {specExists && (
    <div style={{ padding: 'var(--space-3)', borderLeft: '3px solid var(--warning, #eab308)', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning, #eab308)', fontSize: '0.875rem' }} role="alert">
      ⚠️ A specialization with this name already exists in this space. Executing this rename will merge all entries into it.
    </div>
  )}
  ```

- [ ] **Step 3: Run project build**
  Run `npm run build` to verify compilation.

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/Settings.tsx
  git commit -m "feat: show UI warning and dynamic CONFIRM_MERGE button when merging spaces or specializations"
  ```

---

### Task 4: Update and Expand the Test Suite

**Files:**
- Modify: `src/pages/Settings.test.tsx`

- [ ] **Step 1: Update mock PocketBase client setup in Settings.test.tsx to support createBatch()**
  Modify `/Users/viardant/Code/qadrant/src/pages/Settings.test.tsx` to mock `pb.createBatch` and batch services correctly.
  
  At the top of the file, define batch mock functions:
  ```typescript
  const mockBatchSend = vi.fn();
  const mockBatchCollection = vi.fn();
  const mockCreateBatch = vi.fn();
  ```

  And add them to the global `vi.mock` return for `pb` (lines 8-27):
  ```typescript
  createBatch: mockCreateBatch,
  ```

  Inside `beforeEach` (around lines 40-70), configure mock implementations:
  ```typescript
  mockCreateBatch.mockReturnValue({
    collection: mockBatchCollection,
    send: mockBatchSend,
  });

  mockBatchCollection.mockImplementation((name: string) => {
    return {
      update: mockUpdateEntry,
      create: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    } as any;
  });

  mockBatchSend.mockResolvedValue([]);
  ```

- [ ] **Step 2: Update existing rename tests to verify batch.send() is called**
  Update `Success path for Space rename` and `Success path for Specialization rename` in `src/pages/Settings.test.tsx` to expect `mockBatchSend` to be called, and check that `mockUpdateEntry` is called on the batch collections.
  
  For Space rename test:
  ```typescript
  // Replace:
  // await waitFor(() => {
  //   expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { space: 'Creatives' });
  //   expect(mockUpdateEntry).toHaveBeenCalledWith('entry_2', { space: 'Creatives' });
  // });
  
  // With:
  await waitFor(() => {
    expect(mockBatchCollection).toHaveBeenCalledWith('time_entries');
    expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { space: 'Creatives' });
    expect(mockUpdateEntry).toHaveBeenCalledWith('entry_2', { space: 'Creatives' });
    expect(mockBatchSend).toHaveBeenCalled();
  });
  ```

  For Specialization rename test:
  ```typescript
  // Replace:
  // await waitFor(() => {
  //   expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { specialization: 'UI/UX' });
  // });
  
  // With:
  await waitFor(() => {
    expect(mockBatchCollection).toHaveBeenCalledWith('time_entries');
    expect(mockUpdateEntry).toHaveBeenCalledWith('entry_1', { specialization: 'UI/UX' });
    expect(mockBatchSend).toHaveBeenCalled();
  });
  ```

- [ ] **Step 3: Write new tests for Merge confirmation warning and merging flow**
  Add test blocks to `Settings.test.tsx` testing both Space Merge and Specialization Merge.

  For Space Merge:
  ```typescript
  test('Space rename displays warning and allows merge when target space already exists', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
      { id: 'entry_2', space: 'Engineering', specialization: 'React', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    const designContainer = screen.getByText('Design').parentElement!;
    const renameBtn = within(designContainer).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtn);

    const input = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Engineering' } });

    // Warning is visible
    expect(screen.getByText(/A space with this name already exists. Executing this rename will merge all entries/i)).toBeInTheDocument();

    // Button updates to CONFIRM_MERGE
    const submitBtn = screen.getByRole('button', { name: />>> CONFIRM_MERGE/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBatchSend).toHaveBeenCalled();
    });
  });
  ```

  For Specialization Merge:
  ```typescript
  test('Specialization rename displays warning and allows merge when target spec already exists', async () => {
    const mockEntries = [
      { id: 'entry_1', space: 'Design', specialization: 'Figma', user: 'user_123' },
      { id: 'entry_2', space: 'Design', specialization: 'Illustrator', user: 'user_123' },
    ];
    mockGetFullListEntries.mockResolvedValue(mockEntries);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    const designContainer = screen.getByText('Design').closest('.color-row') as HTMLElement;
    const manageBtn = within(designContainer).getByRole('button', { name: />>> MANAGE/i });
    fireEvent.click(manageBtn);

    await waitFor(() => {
      expect(screen.getByText('Figma')).toBeInTheDocument();
    });

    const modal = screen.getByRole('dialog', { name: /MANAGE_SPECIALIZATIONS_PROTOCOL/i });
    const renameBtn = within(modal).getByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtn);

    const input = screen.getByPlaceholderText('NEW_NAME...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Illustrator' } });

    // Warning is visible
    expect(screen.getByText(/A specialization with this name already exists in this space. Executing this rename will merge all entries/i)).toBeInTheDocument();

    // Button updates to CONFIRM_MERGE
    const submitBtn = screen.getByRole('button', { name: />>> CONFIRM_MERGE/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBatchSend).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 4: Run tests to verify all tests pass**
  Run: `npm run test`
  Expected: All tests pass.

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/Settings.test.tsx
  git commit -m "test: update and expand Settings tests for batching and merging"
  ```
