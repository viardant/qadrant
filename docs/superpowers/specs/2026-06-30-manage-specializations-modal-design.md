# Design Specification: Manage Specializations Modal

This specification outlines the changes required to solve the grid scaling issues on the Settings page when a space has a large number of specializations. Instead of rendering all specializations inline as badges, we introduce a summary counter and a dedicated management modal with search/filtering capability.

## 1. Overview & Scope

- **Goal**: Prevent the `SPACE_THEME_MAPPINGS` grid cards from stretching vertically and cluttering the page when a single space has many specializations.
- **Scope**: React Frontend SPA (specifically [Settings.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.tsx) and its styling/tests).
- **Target Audience**: Users managing a detailed/verbose set of categorized tasks.

---

## 2. User Interface Design

### 2.1. Updated Space Card Card Layout
We replace the wrap-around badges list under `SPECIALIZATIONS:` with a single summary row:

```
+--------------------------------------------------+
| WORK                               [Color Swatch]|
| [RENAME]                                         |
| ------------------------------------------------ |
| 14 SPECIALIZATIONS               >>> MANAGE      |
+--------------------------------------------------+
```

* **Label**: `{count} SPECIALIZATION(S)` in `type-tech-mono` font, muted grey.
* **Affordance**: `>>> MANAGE` button (styled as `btn btn--link` or a clean mono action).

### 2.2. Manage Modal (`MANAGE_SPECIALIZATIONS_PROTOCOL`)
Clicking `>>> MANAGE` opens a modal dialog containing:

- **Title**: `▸  MANAGE_SPECIALIZATIONS_PROTOCOL // <SPACE_NAME>`
- **Search input**: A text input styled with `className="input input--inline"` for real-time filtering of the specialization list:
  - Placeholder: `SEARCH_SPECIALIZATIONS…`
- **Scrollable List Area**:
  - Max height: `350px` (standard scrollbar).
  - List items: A vertical list of rows. Each row has:
    - Specialization name (left-aligned, `type-tech-mono`).
    - A `[RENAME]` text link/button (right-aligned).
- **Footer**:
  - `CLOSE` button (closes the modal).

```
+--------------------------------------------------+
| ▸  MANAGE_SPECIALIZATIONS_PROTOCOL // PIANO      |
|                                                  |
| [ SEARCH_SPECIALIZATIONS...                    ] |
|                                                  |
| +----------------------------------------------+ |
| | CHOPIN - OP. 28 N. 14               [RENAME] | |
| | CHOPIN - OP. 28 N. 15               [RENAME] | |
| | CHOPIN - OP. 28 N. 4                [RENAME] | |
| +----------------------------------------------+ |
|                                                  |
|                                         [ CLOSE ]|
+--------------------------------------------------+
```

### 2.3. Workflow Transitions
When the user clicks `[RENAME]` on a specialization item inside the list:
1. `manageSpecsTarget` is set to `null` (closes the manage modal).
2. `renameTargetSpec` is set to `{ space: activeSpaceName, spec: selectedSpecName }`.
3. `newName` is set to `selectedSpecName` (pre-filled).
4. The existing `RENAME_SPECIALIZATION_PROTOCOL` modal opens automatically.

This ensures seamless integration with the existing backend migration logic and post-rename reload flow.

---

## 3. Data & State Additions

In `Settings.tsx`, we will add the following React state hooks:

```typescript
const [manageSpecsTarget, setManageSpecsTarget] = useState<SpaceDetail | null>(null);
const [specSearchQuery, setSpecSearchQuery] = useState('');
```

### Filtering Logic:
```typescript
const filteredSpecs = manageSpecsTarget
  ? manageSpecsTarget.specializations.filter((spec) =>
      spec.toLowerCase().includes(specSearchQuery.toLowerCase())
    )
  : [];
```

---

## 4. Verification & Testing

Update the Settings unit tests ([Settings.test.tsx](file:///Users/viardant/Code/qadrant/src/pages/Settings.test.tsx)) to:
1. Assert that cards list a summary text (e.g., `"14 SPECIALIZATIONS"`) and the `">>> MANAGE"` button.
2. Assert that clicking `">>> MANAGE"` opens the management modal.
3. Assert that typing in the search box filters the visible specialization list.
4. Assert that clicking `"[RENAME]"` in the list opens the correct rename modal with the correct pre-filled values.
