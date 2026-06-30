# Space and Specialization Uppercase Inputs Design Specification

## Overview
To improve consistency and database hygiene in Qadrant, all user inputs related to space and specialization fields should be automatically converted to uppercase in real-time. This aligns with Qadrant's terminal-editorial visual theme and prevents fragmented/duplicate categories in different cases (e.g., `dev/react` vs. `DEV/REACT`).

## Objectives
1. **Real-time Uppercase Conversion:** Intercept inputs at the React state level so that typing in a space or specialization text field instantly capitalizes the input.
2. **Timer Query Integration:** Capitalize the query string in `Timer.tsx` to ensure any new combos started from query are saved as uppercase.
3. **Consistency:** Cover all files that accept space or specialization inputs: `NewComboSheet.tsx`, `Ledger.tsx`, `Settings.tsx`, and `Timer.tsx`.

## Technical Details

### 1. File and Component Updates

#### `src/components/timer/NewComboSheet.tsx`
Modify `space` and `specialization` inputs to call `.toUpperCase()` on input change:
```typescript
<input
  type="text"
  className="input input--inline"
  value={space}
  onChange={(e) => setSpace(e.target.value.toUpperCase())}
  ...
/>
```
and:
```typescript
<input
  type="text"
  className="input input--inline"
  value={specialization}
  onChange={(e) => setSpecialization(e.target.value.toUpperCase())}
  ...
/>
```

#### `src/pages/Ledger.tsx`
Modify edit form fields for space and specialization:
```typescript
<input
  type="text"
  className="input input--inline"
  value={editSpace}
  onChange={(e) => setEditSpace(e.target.value.toUpperCase())}
  ...
/>
```
and:
```typescript
<input
  type="text"
  className="input input--inline"
  value={editSpecialization}
  onChange={(e) => setEditSpecialization(e.target.value.toUpperCase())}
  ...
/>
```

#### `src/pages/Settings.tsx`
Modify `newName` inputs in Space and Specialization Rename Modals:
```typescript
<input
  autoFocus
  type="text"
  className="input input--inline"
  value={newName}
  onChange={(e) => setNewName(e.target.value.toUpperCase())}
  ...
/>
```

#### `src/pages/Timer.tsx`
Uppercase the query string as the user types:
```typescript
<ComboSearch
  ref={searchInputRef}
  value={query}
  onChange={(val) => setQuery(val.toUpperCase())}
  ...
/>
```

## Verification Plan
1. **Build Verification:** Run `npm run build` to verify there are no compilation errors.
2. **Unit Test Updates:** Run Vitest on modified files. If test cases pass lowercase input parameters or verify lowercase responses, update them to pass/expect uppercase strings.
3. **Manual Verification:** Open the UI, type lowercase letters into the Space, Specialization, and Combo Search inputs, and verify that they are immediately transformed to uppercase.
