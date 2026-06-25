# Rename Spaces and Specializations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a rename feature for spaces and specializations in the Web SPA settings page using PocketBase client batch updates.

**Architecture:** We will group specializations under each space card in the Settings tab. Users can rename spaces or space-specific specializations via modals that fetch matching records and update them in chunked batches of 100 via the PocketBase Batch API, keeping colors and history in sync.

**Tech Stack:** React 19, PocketBase JS SDK, Vitest, Testing Library

---

### Task 1: Add createBatch Mock and Define Types

**Files:**
- Modify: `src/pages/Settings.test.tsx:8-20`
- Modify: `src/pages/Settings.tsx:26-30`

- [ ] **Step 1: Update vitest pb mock to include createBatch mock**
  Modify [Settings.test.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.test.tsx#L8-L20) to define and return `createBatch`:
  ```typescript
  const mockSendBatch = vi.fn().mockResolvedValue([]);
  const mockBatchUpdate = vi.fn();
  const mockBatchCollection = vi.fn().mockReturnValue({
    update: mockBatchUpdate,
  });
  const mockCreateBatch = vi.fn().mockReturnValue({
    collection: mockBatchCollection,
    send: mockSendBatch,
  });

  vi.mock('../lib/pocketbase', () => {
    return {
      pb: {
        collection: vi.fn(),
        createBatch: () => mockCreateBatch(),
        authStore: {
          isValid: true,
          model: { id: 'user_123' },
          token: 'mock_token',
          save: vi.fn(),
        },
      },
    };
  });
  ```

- [ ] **Step 2: Run tests to verify the suite runs**
  Run: `npm run test`
  Expected: Existing tests PASS

- [ ] **Step 3: Define interface for space/spec groups in Settings.tsx**
  Add the following types at the top of [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx):
  ```typescript
  interface SpaceDetail {
    name: string;
    specializations: string[];
  }
  ```
  Add a state hook under `spaces` state:
  ```typescript
  const [spaceDetails, setSpaceDetails] = useState<SpaceDetail[]>([]);
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/Settings.tsx src/pages/Settings.test.tsx
  git commit -m "feat: mock createBatch and define settings rename types"
  ```

---

### Task 2: Group and Display Specializations in the UI

**Files:**
- Modify: `src/pages/Settings.tsx:41-87`
- Modify: `src/pages/Settings.tsx:187-207`
- Modify: `src/pages/Settings.test.tsx`

- [ ] **Step 1: Group specializations by space during mount fetch**
  In the `fetchSettingsData` effect, parse all unique space-spec relationships from the history `entries`:
  ```typescript
  const spaceSpecMap = new Map<string, Set<string>>();
  const uniqueSpaces = new Set<string>();

  for (const entry of entries) {
    if (entry.space) {
      uniqueSpaces.add(entry.space);
      if (!spaceSpecMap.has(entry.space)) {
        spaceSpecMap.set(entry.space, new Set());
      }
      if (entry.specialization) {
        spaceSpecMap.get(entry.space)!.add(entry.specialization);
      }
    }
  }

  const detailsList: SpaceDetail[] = Array.from(uniqueSpaces).map((spaceName) => ({
    name: spaceName,
    specializations: Array.from(spaceSpecMap.get(spaceName) || []),
  }));

  setSpaces(Array.from(uniqueSpaces));
  setSpaceDetails(detailsList);
  ```

- [ ] **Step 2: Update the Space Mapping list UI to render grouped specializations**
  Modify the JSX where spaces are rendered to display specializations and rename triggers:
  ```typescript
  {spaceDetails.map((detail, idx) => (
    <div key={detail.name} className="color-row" style={{ padding: isMobile ? '12px' : undefined, flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="color-row__label">{detail.name}</span>
          <button
            type="button"
            className="btn btn--link"
            style={{ fontSize: '11px', padding: 0, height: 'auto', minHeight: '0', textDecoration: 'underline' }}
            onClick={() => handleOpenRenameSpace(detail.name)}
          >
            [RENAME]
          </button>
        </div>
        <label
          className="color-row__swatch"
          style={{ background: getSpaceColor(detail.name, idx), ...(isMobile ? { width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' } : {}) }}
          aria-label={`Color for ${detail.name}`}
        >
          <input
            type="color"
            value={getSpaceColor(detail.name, idx)}
            onChange={(e) => handleColorChange(detail.name, e.target.value)}
          />
        </label>
      </div>

      {detail.specializations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border-muted)' }}>
          <span className="eyebrow" style={{ fontSize: '10px', color: 'var(--fg-subtle)' }}>SPECIALIZATIONS:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {detail.specializations.map((spec) => (
              <div key={spec} className="badge-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', border: '1px solid var(--border-muted)', padding: '2px 8px', borderRadius: 'var(--radius-xs)' }}>
                <span className="type-tech-mono" style={{ fontSize: '12px' }}>{spec}</span>
                <button
                  type="button"
                  className="btn btn--link"
                  style={{ fontSize: '10px', padding: 0, height: 'auto', minHeight: '0', textDecoration: 'underline', color: 'var(--fg-muted)' }}
                  onClick={() => handleOpenRenameSpec(detail.name, spec)}
                >
                  [RENAME]
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ))}
  ```

- [ ] **Step 3: Run the test suite and verify it passes**
  Run: `npm run test`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/Settings.tsx
  git commit -m "feat: group and render specializations in settings panel"
  ```

---

### Task 3: Implement Rename Modals

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Settings.test.tsx`

- [ ] **Step 1: Add modal state variables**
  Add state hooks to [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx):
  ```typescript
  const [renameTargetSpace, setRenameTargetSpace] = useState<string | null>(null);
  const [renameTargetSpec, setRenameTargetSpec] = useState<{ space: string; spec: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [renameInProgress, setRenameInProgress] = useState(false);
  const [renameProgressText, setRenameProgressText] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  ```

- [ ] **Step 2: Add trigger handlers**
  ```typescript
  const handleOpenRenameSpace = (spaceName: string) => {
    setRenameTargetSpace(spaceName);
    setNewName(spaceName);
    setRenameError(null);
  };

  const handleOpenRenameSpec = (spaceName: string, specName: string) => {
    setRenameTargetSpec({ space: spaceName, spec: specName });
    setNewName(specName);
    setRenameError(null);
  };

  const handleCloseRename = () => {
    if (renameInProgress) return;
    setRenameTargetSpace(null);
    setRenameTargetSpec(null);
    setNewName('');
    setRenameError(null);
  };
  ```

- [ ] **Step 3: Render modals in the settings view**
  Append the modals at the end of the return statement (next to `purgeOpen` modal):
  ```typescript
  <Modal
    open={renameTargetSpace !== null}
    onClose={handleCloseRename}
    title="▸&nbsp;&nbsp;RENAME_SPACE_PROTOCOL"
    footer={
      <>
        <button type="button" className="btn btn--ghost" onClick={handleCloseRename} disabled={renameInProgress}>
          CANCEL
        </button>
        <button
          type="button"
          className="btn btn--filled"
          onClick={executeRenameSpace}
          disabled={renameInProgress || !newName.trim() || newName.trim() === renameTargetSpace}
        >
          {renameInProgress ? 'EXECUTING...' : '>>> EXECUTE_RENAME'}
        </button>
      </>
    }
  >
    <div className="section" style={{ gap: 'var(--space-4)' }}>
      <p className="settings-section__body">
        Renaming space <strong>{renameTargetSpace}</strong> will update all associated historical time entries.
      </p>
      <label className="section" style={{ gap: 'var(--space-2)' }}>
        <span className="eyebrow">NEW SPACE NAME</span>
        <input
          type="text"
          className="input input--inline"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="NEW_NAME..."
          maxLength={48}
          disabled={renameInProgress}
        />
      </label>
      {renameInProgress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <BeatIndicator activeIndex={beatIdx} label="Renaming" />
          <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>{renameProgressText}</span>
        </div>
      )}
      {renameError && <span className="type-tech-mono" style={{ color: 'var(--error)' }}>{renameError}</span>}
    </div>
  </Modal>

  <Modal
    open={renameTargetSpec !== null}
    onClose={handleCloseRename}
    title="▸&nbsp;&nbsp;RENAME_SPECIALIZATION_PROTOCOL"
    footer={
      <>
        <button type="button" className="btn btn--ghost" onClick={handleCloseRename} disabled={renameInProgress}>
          CANCEL
        </button>
        <button
          type="button"
          className="btn btn--filled"
          onClick={executeRenameSpec}
          disabled={renameInProgress || !newName.trim() || newName.trim() === renameTargetSpec?.spec}
        >
          {renameInProgress ? 'EXECUTING...' : '>>> EXECUTE_RENAME'}
        </button>
      </>
    }
  >
    <div className="section" style={{ gap: 'var(--space-4)' }}>
      <p className="settings-section__body">
        Renaming specialization <strong>{renameTargetSpec?.spec}</strong> inside space <strong>{renameTargetSpec?.space}</strong> will update all matching historical entries.
      </p>
      <label className="section" style={{ gap: 'var(--space-2)' }}>
        <span className="eyebrow">NEW SPECIALIZATION NAME</span>
        <input
          type="text"
          className="input input--inline"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="NEW_NAME..."
          maxLength={48}
          disabled={renameInProgress}
        />
      </label>
      {renameInProgress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <BeatIndicator activeIndex={beatIdx} label="Renaming" />
          <span className="type-tech-mono" style={{ color: 'var(--fg-muted)' }}>{renameProgressText}</span>
        </div>
      )}
      {renameError && <span className="type-tech-mono" style={{ color: 'var(--error)' }}>{renameError}</span>}
    </div>
  </Modal>
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add src/pages/Settings.tsx
  git commit -m "feat: implement space/spec rename modals and states"
  ```

---

### Task 4: Implement Rename Execution Logic

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Settings.test.tsx`

- [ ] **Step 1: Write execution logic for renaming space**
  Implement the chunked batch migration for spaces in [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx):
  ```typescript
  const executeRenameSpace = async () => {
    if (!pb.authStore.model?.id || !renameTargetSpace) return;
    const targetNew = newName.trim();
    if (!targetNew || targetNew === renameTargetSpace) return;

    if (spaces.includes(targetNew)) {
      setRenameError('A space with this name already exists.');
      return;
    }

    setRenameInProgress(true);
    setRenameError(null);
    setRenameProgressText('FETCHING_RECORDS…');

    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: `user = "${pb.authStore.model.id}" && space = "${renameTargetSpace}"`,
      });

      const chunkSize = 100;
      const totalChunks = Math.ceil(entries.length / chunkSize);

      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const currentChunkIdx = Math.floor(i / chunkSize) + 1;
        setRenameProgressText(`MIGRATING_RECORDS // CHUNK ${currentChunkIdx} OF ${totalChunks || 1}…`);

        const batch = pb.createBatch();
        for (const entry of chunk) {
          batch.collection('time_entries').update(entry.id, { space: targetNew });
        }
        await batch.send();
      }

      // Update color settings if they exist
      setRenameProgressText('UPDATING_PREFERENCES…');
      const updatedColors = { ...spaceColors };
      if (updatedColors[renameTargetSpace]) {
        updatedColors[targetNew] = updatedColors[renameTargetSpace];
        delete updatedColors[renameTargetSpace];
        const updatedUser = await pb.collection('users').update(pb.authStore.model.id, {
          space_colors: updatedColors,
        });
        pb.authStore.save(pb.authStore.token, updatedUser);
        setSpaceColors(updatedColors);
      }

      // Refresh list
      window.location.reload();
    } catch (err) {
      console.error(err);
      setRenameError('Rename failed. Please retry.');
      setRenameInProgress(false);
    }
  };
  ```

- [ ] **Step 2: Write execution logic for renaming specialization**
  ```typescript
  const executeRenameSpec = async () => {
    if (!pb.authStore.model?.id || !renameTargetSpec) return;
    const targetNew = newName.trim();
    const { space, spec: oldSpec } = renameTargetSpec;
    if (!targetNew || targetNew === oldSpec) return;

    const group = spaceDetails.find(d => d.name === space);
    if (group?.specializations.includes(targetNew)) {
      setRenameError('A specialization with this name already exists in this space.');
      return;
    }

    setRenameInProgress(true);
    setRenameError(null);
    setRenameProgressText('FETCHING_RECORDS…');

    try {
      const entries = await pb.collection('time_entries').getFullList<TimeEntry>({
        filter: `user = "${pb.authStore.model.id}" && space = "${space}" && specialization = "${oldSpec}"`,
      });

      const chunkSize = 100;
      const totalChunks = Math.ceil(entries.length / chunkSize);

      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const currentChunkIdx = Math.floor(i / chunkSize) + 1;
        setRenameProgressText(`MIGRATING_RECORDS // CHUNK ${currentChunkIdx} OF ${totalChunks || 1}…`);

        const batch = pb.createBatch();
        for (const entry of chunk) {
          batch.collection('time_entries').update(entry.id, { specialization: targetNew });
        }
        await batch.send();
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setRenameError('Rename failed. Please retry.');
      setRenameInProgress(false);
    }
  };
  ```

- [ ] **Step 3: Write tests for space and specialization rename**
  Add unit tests in [Settings.test.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.test.tsx):
  ```typescript
  test('opens rename space modal and executes rename successfully', async () => {
    mockGetFullListEntries.mockResolvedValueOnce([
      { id: '1', space: 'WORK', specialization: '', user: 'user_123', start_date: '2026-06-25T00:00:00Z', completion_time: '2026-06-25T01:00:00Z' }
    ]);
    mockGetFullListEntries.mockResolvedValueOnce([
      { id: '1', space: 'WORK', specialization: '', user: 'user_123', start_date: '2026-06-25T00:00:00Z', completion_time: '2026-06-25T01:00:00Z' }
    ]);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('WORK')).toBeInTheDocument();
    });

    const renameBtns = screen.getAllByRole('button', { name: /\[RENAME\]/i });
    fireEvent.click(renameBtns[0]); // Click first rename button (space level)

    expect(screen.getByText('NEW SPACE NAME')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('NEW_NAME...');
    fireEvent.change(input, { target: { value: 'JOB' } });

    fireEvent.click(screen.getByRole('button', { name: />>> EXECUTE_RENAME/i }));

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 4: Run test suite to verify success**
  Run: `npm run test`
  Expected: ALL tests PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/Settings.tsx src/pages/Settings.test.tsx
  git commit -m "feat: implement space/spec rename database actions and tests"
  ```
