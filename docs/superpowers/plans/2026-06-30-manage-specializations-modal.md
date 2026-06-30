# Manage Specializations Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline badges list of specializations in space cards with a clean summary row and a search-enabled management modal to resolve grid layout scaling issues on the Settings page.

**Architecture:** We will add state hooks in `Settings.tsx` to handle opening the manage modal for a specific space and filtering its specializations. Clicking `[RENAME]` on any specialization item inside the manage modal will close the manage modal and transition directly to the pre-existing rename modal/logic.

**Tech Stack:** React (TypeScript), PocketBase, React Testing Library, Vitest.

---

### Task 1: Update State and Handlers in Settings Component

**Files:**
- Modify: `src/pages/Settings.tsx`
- Test: `src/pages/Settings.test.tsx`

- [ ] **Step 1: Write the test check for state transition functions**

We will mock state handlers or rely on the render behavior. Let's create a test suite block that asserts the space card rendering. Add this to `src/pages/Settings.test.tsx`:

```typescript
  describe('Manage Specializations Modal - Layout', () => {
    test('displays specialization count and opens management modal on click', async () => {
      const mockEntries = [
        { id: '1', space: 'Piano', specialization: 'Chopin', user: 'user_123' },
        { id: '2', space: 'Piano', specialization: 'Bach', user: 'user_123' },
      ];
      mockGetFullListEntries.mockResolvedValue(mockEntries);

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2 SPECIALIZATIONS')).toBeInTheDocument();
      });

      const manageBtn = screen.getByRole('button', { name: />>> MANAGE/i });
      expect(manageBtn).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: FAIL because `"2 SPECIALIZATIONS"` and `">>> MANAGE"` buttons are not rendered.

- [ ] **Step 3: Implement state hooks and helper handlers in Settings component**

Modify `src/pages/Settings.tsx` to define the state variables and handlers:

```typescript
  // Around line 47, add the state hooks:
  const [manageSpecsTarget, setManageSpecsTarget] = useState<SpaceDetail | null>(null);
  const [specSearchQuery, setSpecSearchQuery] = useState('');

  const handleOpenManageSpecs = (spaceDetail: SpaceDetail) => {
    setManageSpecsTarget(spaceDetail);
    setSpecSearchQuery('');
  };

  const handleCloseManageSpecs = () => {
    setManageSpecsTarget(null);
    setSpecSearchQuery('');
  };
```

- [ ] **Step 4: Update the space card render logic in Settings**

Replace the existing specializations listing inside `src/pages/Settings.tsx` (around lines 385-404) with the summary row structure:

```tsx
                    {detail.specializations.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="type-tech-mono" style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
                            {detail.specializations.length} {detail.specializations.length === 1 ? 'SPECIALIZATION' : 'SPECIALIZATIONS'}
                          </span>
                          <button
                            type="button"
                            className="btn btn--link"
                            style={{ fontSize: '11px', textTransform: 'uppercase' }}
                            onClick={() => handleOpenManageSpecs(detail)}
                          >
                            >>> MANAGE
                          </button>
                        </div>
                      </div>
                    )}
```

- [ ] **Step 5: Run tests and verify the layout test passes**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit state and card changes**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "feat: add manage state hooks and update settings card layout to count specializations"
```

---

### Task 2: Implement the Manage Specializations Modal

**Files:**
- Modify: `src/pages/Settings.tsx`
- Test: `src/pages/Settings.test.tsx`

- [ ] **Step 1: Add a test asserting modal operations (opening, searching/filtering, and trigger rename)**

In `src/pages/Settings.test.tsx`, update the `Manage Specializations Modal` test suite:

```typescript
    test('filters specializations list by query', async () => {
      const mockEntries = [
        { id: '1', space: 'Piano', specialization: 'Chopin', user: 'user_123' },
        { id: '2', space: 'Piano', specialization: 'Bach', user: 'user_123' },
      ];
      mockGetFullListEntries.mockResolvedValue(mockEntries);

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: />>> MANAGE/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: />>> MANAGE/i }));

      const searchInput = screen.getByPlaceholderText('SEARCH_SPECIALIZATIONS…');
      fireEvent.change(searchInput, { target: { value: 'Chop' } });

      expect(screen.getByText('Chopin')).toBeInTheDocument();
      expect(screen.queryByText('Bach')).not.toBeInTheDocument();
    });

    test('clicking [RENAME] closes manage modal and opens rename spec modal', async () => {
      const mockEntries = [
        { id: '1', space: 'Piano', specialization: 'Chopin', user: 'user_123' },
      ];
      mockGetFullListEntries.mockResolvedValue(mockEntries);

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: />>> MANAGE/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: />>> MANAGE/i }));

      const renameBtn = screen.getByRole('button', { name: /\[RENAME\]/i });
      fireEvent.click(renameBtn);

      // Manage modal should close
      expect(screen.queryByText('▸  MANAGE_SPECIALIZATIONS_PROTOCOL // Piano')).not.toBeInTheDocument();

      // Rename modal should open
      expect(screen.getByText('NEW SPECIALIZATION NAME')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('NEW_NAME...')).toHaveValue('Chopin');
    });
```

- [ ] **Step 2: Run test to verify they fail**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: FAIL because the manage modal is not yet rendered.

- [ ] **Step 3: Implement the Manage Specializations Modal UI**

In `src/pages/Settings.tsx`, append the new modal component right after the other modals (e.g. before the `<Modal open={renameTargetSpace !== null} ...>` declaration):

```tsx
      <Modal
        open={manageSpecsTarget !== null}
        onClose={handleCloseManageSpecs}
        title={`▸  MANAGE_SPECIALIZATIONS_PROTOCOL // ${manageSpecsTarget?.name || ''}`}
        footer={
          <button type="button" className="btn btn--ghost" onClick={handleCloseManageSpecs}>
            CLOSE
          </button>
        }
      >
        <div className="section" style={{ gap: 'var(--space-4)' }}>
          {manageSpecsTarget && (
            <div className="section" style={{ gap: 'var(--space-3)' }}>
              <input
                type="text"
                className="input input--inline"
                value={specSearchQuery}
                onChange={(e) => setSpecSearchQuery(e.target.value)}
                placeholder="SEARCH_SPECIALIZATIONS…"
                aria-label="Search specializations"
              />
              <div
                className="section"
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  gap: 'var(--space-2)',
                  border: '1px solid var(--border-muted)',
                  padding: 'var(--space-2)',
                  backgroundColor: 'var(--bg)',
                }}
              >
                {manageSpecsTarget.specializations
                  .filter((spec) =>
                    spec.toLowerCase().includes(specSearchQuery.toLowerCase())
                  )
                  .map((spec) => (
                    <div
                      key={spec}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-2) var(--space-3)',
                        borderBottom: '1px solid var(--border-muted)',
                      }}
                    >
                      <span className="type-tech-mono" style={{ fontSize: '13px' }}>
                        {spec}
                      </span>
                      <button
                        type="button"
                        className="btn btn--link"
                        style={{ fontSize: '11px' }}
                        onClick={() => {
                          const spaceName = manageSpecsTarget.name;
                          handleCloseManageSpecs();
                          handleOpenRenameSpec(spaceName, spec);
                        }}
                      >
                        [RENAME]
                      </button>
                    </div>
                  ))}
                {manageSpecsTarget.specializations.filter((spec) =>
                  spec.toLowerCase().includes(specSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--fg-muted)' }}>
                    NO_MATCHING_SPECIALIZATIONS
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
```

- [ ] **Step 4: Run test to verify all tests pass**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit complete modal implementation**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "feat: implement Manage Specializations Modal and update tests"
```
