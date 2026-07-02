# Design Specification: Edit Timer Start Time and Unified Carousel

This specification details the design for allowing users to edit the start time of an active session by clicking the "STARTED" attribute, triggering the native OS time picker. It also outlines the unification of the desktop and mobile timer layouts to use a carousel when multiple active sessions are running.

## 1. Overview & Scope

- **Goal**: Allow manual adjustment of the active timer's start time via native OS time picker and streamline the multiple active session display on desktop.
- **Scope**: React Frontend SPA (specifically [Timer.tsx](file:///Users/viardant/Code/qadrant/src/pages/Timer.tsx), [ActiveSessionStageDrop.tsx](file:///Users/viardant/Code/qadrant/src/components/timer/ActiveSessionStageDrop.tsx), and their CSS and tests).

---

## 2. User Interface Design

### 2.1. "STARTED" Attribute Interaction
* Under the active session details, the value of the `STARTED` attribute (e.g., `14:30`) becomes interactive:
  * Styled with a pointer cursor (`cursor: pointer`), dashed bottom border (`border-bottom: 1px dashed`), and transitions to the CSS accent color on hover.
  * Accessibility: Elements are wrapped with appropriate button/aria roles to ensure screen readers can navigate and click it.
* When clicked or activated via keyboard (Enter/Space), it programmatically invokes `showPicker()` on an off-screen, hidden `<input type="time">`.
* This triggers the native OS/browser time picker.

### 2.2. Unified Carousel Layout for Desktop & Mobile
* Previously, when multiple active sessions were running:
  * Mobile showed a carousel with `◀ PREV`, dots, and `NEXT ▶` buttons.
  * Desktop stacked the primary session details card and rendered a list of secondary active sessions in a compact view (`ActiveTimer`) below it.
* With this update:
  * Both desktop and mobile will render a unified carousel layout if more than one active session is running.
  * This eliminates the stacked compact `ActiveTimer` cards, making the active timer area cleaner and consistent across device sizes.

---

## 3. Implementation Details

### 3.1. Database Update Function
In `Timer.tsx`:
```typescript
const updateSessionStartDate = async (id: string, newStartDate: string) => {
  try {
    await pb.collection('time_entries').update(id, {
      start_date: newStartDate,
    });
    await fetchData();
  } catch (err) {
    console.error('Failed to update start date:', err);
    setError('FAILED_TO_UPDATE_START_DATE');
  }
};
```

### 3.2. Programmatic Input Trigger
In `ActiveSessionStageDrop.tsx`:
* Retrieve local time representation from the ISO string:
```typescript
const localDate = new Date(session.start_date);
const hh = String(localDate.getHours()).padStart(2, '0');
const mm = String(localDate.getMinutes()).padStart(2, '0');
const editValue = `${hh}:${mm}`;
```
* Hidden element:
```tsx
<input
  ref={inputRef}
  type="time"
  value={editValue}
  onChange={handleTimeChange}
  style={{
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
    pointerEvents: 'none',
  }}
  aria-label="Edit start time"
/>
```
* Update callback:
```typescript
const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const timeVal = e.target.value;
  if (!timeVal) return;
  const [hours, minutes] = timeVal.split(':').map(Number);
  const newDate = new Date(session.start_date);
  newDate.setHours(hours, minutes, 0, 0);
  if (onUpdateStartDate) {
    onUpdateStartDate(session.id, newDate.toISOString());
  }
};
```

---

## 4. Verification & Testing

1. Add tests in `Timer.test.tsx` and `ActiveSessionStageDrop` assertions to verify that clicking "STARTED" or its container triggers the picker and updates the start time in Pocketbase.
2. Confirm the desktop view displays the carousel when multiple active sessions are present, instead of the compact stacked list.
