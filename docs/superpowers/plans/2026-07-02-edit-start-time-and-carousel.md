# Timer Start Time Edit & Unified Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement editing of active session start time by clicking the "STARTED" attribute, and unify the desktop active session view to use the carousel layout.

**Architecture:** We will add an off-screen `<input type="time">` within the active session details card (`ActiveSessionStageDrop`) that programmatically opens the native OS time picker using `showPicker()`. We will also remove the split layout in `Timer.tsx` to always render the carousel component if there are multiple active sessions.

**Tech Stack:** React 19, TypeScript, Vitest, PocketBase client, CSS Variables.

---

### Task 1: Update active session state and unified carousel in Timer.tsx

**Files:**
- Modify: `src/pages/Timer.tsx:16`
- Modify: `src/pages/Timer.tsx:387-453`

- [ ] **Step 1: Write minimal code to add the updateSessionStartDate function and remove ActiveTimer import**
Modify `src/pages/Timer.tsx` to implement the `updateSessionStartDate` callback and replace the mobile/desktop branching logic with a unified carousel layout.

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

And update the render block to:
```tsx
      {activeSessions.length > 0 && (
        <div className="active-timer-carousel">
          <ActiveSessionStageDrop
            session={activeSessions[carouselIndex] || activeSessions[0]}
            beatIndex={beatIndex}
            onStop={stopSession}
            onUpdateStartDate={updateSessionStartDate}
          />
          {activeSessions.length > 1 && (
            <div className="carousel-controls">
              <button
                type="button"
                className="carousel-btn"
                onClick={() => setCarouselIndex((i) => (i - 1 + activeSessions.length) % activeSessions.length)}
                aria-label="Previous active session"
              >
                ◀&nbsp;PREV
              </button>
              <div className="carousel-dots">
                {activeSessions.map((s, idx) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`carousel-dot ${idx === carouselIndex ? 'carousel-dot--active' : ''}`}
                    onClick={() => setCarouselIndex(idx)}
                    aria-label={`Go to session ${idx + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="carousel-btn"
                onClick={() => setCarouselIndex((i) => (i + 1) % activeSessions.length)}
                aria-label="Next active session"
              >
                NEXT&nbsp;▶
              </button>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 2: Run tests to verify the desktop layout compiles**
Run: `npm test`
Expected: PASS (existing tests should still pass, though carousel-on-mobile test will run under desktop and still pass).

- [ ] **Step 3: Commit changes**
```bash
git add src/pages/Timer.tsx
git commit -m "feat: add updateSessionStartDate handler and unify active sessions carousel"
```

---

### Task 2: Implement Start Time Edit UI in ActiveSessionStageDrop.tsx

**Files:**
- Modify: `src/components/timer/ActiveSessionStageDrop.tsx:1-94`

- [ ] **Step 1: Write the updated implementation with hidden time input and ref**
Modify the file to accept `onUpdateStartDate`, hold a ref to the hidden input, trigger the native OS picker on click, and handle the time updates.

```tsx
import { useEffect, useRef, useState } from 'react';
import { BeatIndicator } from '../ui/BeatIndicator';
import { formatDuration, type TimeEntry } from '../../lib/time-entry';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  session: TimeEntry;
  beatIndex?: number;
  onStop: (id: string) => void;
  onUpdateStartDate?: (id: string, newStartDate: string) => Promise<void>;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function ActiveSessionStageDrop({ session, beatIndex = -1, onStop, onUpdateStartDate }: Props) {
  const { isDesktop } = useBreakpoint();
  const [activeDuration, setActiveDuration] = useState('00:00:00');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => {
      const start = new Date(session.start_date).getTime();
      const diff = Date.now() - start;
      setActiveDuration(formatDuration(diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session.start_date]);

  const space = session.space || '--';
  const spec = session.specialization || '--';
  const started = formatClock(session.start_date);

  const getLocalTimeValue = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

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

  const handleTriggerPicker = () => {
    if (inputRef.current) {
      try {
        inputRef.current.showPicker();
      } catch (e) {
        inputRef.current.focus();
        inputRef.current.click();
      }
    }
  };

  return (
    <section
      className="stage-drop stage-drop--wide"
      role="status"
      aria-live="polite"
      aria-label={`Active session ${space} ${spec}`}
    >
      <div
        className="stage-drop__grid"
        style={{
          gridTemplateColumns: isDesktop ? 'minmax(0, 1.5fr) minmax(0, 1fr)' : '1fr',
          gap: isDesktop ? '48px' : '0',
        }}
      >
        <div className="stage-drop__primary">
          <div className="stage-drop__eyebrow stage-drop__eyebrow--left">
            <span>▸&nbsp;&nbsp;SESSION_TIMER&nbsp;//&nbsp;ACTIVE_PROTOCOL</span>
          </div>
          <div
            className="stage-drop__number stage-drop__number--left"
            aria-label={`Elapsed ${activeDuration}`}
          >
            {activeDuration}
          </div>
        </div>
        <div className="stage-drop__meta">
          <div className="stage-drop__meta-status">
            <BeatIndicator beats={2} activeIndex={beatIndex} label="Session running" />
            <span className="stage-drop__meta-status-label">RUNNING</span>
          </div>
          <div className="stage-drop__meta-row">
            <span className="stage-drop__meta-label">SPACE</span>
            <span className="stage-drop__meta-value">{space}</span>
          </div>
          <div className="stage-drop__meta-row">
            <span className="stage-drop__meta-label">SPEC</span>
            <span className="stage-drop__meta-value">{spec}</span>
          </div>
          <div className="stage-drop__meta-row">
            <span className="stage-drop__meta-label">STARTED</span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="time"
                value={getLocalTimeValue(session.start_date)}
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
              <button
                type="button"
                onClick={handleTriggerPicker}
                className="stage-drop__meta-value stage-drop__meta-value--editable"
                title="Click to edit start time"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {started}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="stage-drop__stop"
            onClick={() => onStop(session.id)}
            aria-label="Stop session"
          >
            ▢&nbsp;STOP_SESSION
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run tests to verify compilation**
Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit changes**
```bash
git add src/components/timer/ActiveSessionStageDrop.tsx
git commit -m "feat: implement native OS time picker trigger for started time editing"
```

---

### Task 3: Style the editable start time link in index.css

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add CSS overrides**
Append/insert styles for `.stage-drop__meta-value--editable` in `src/index.css` (e.g. near line 583):

```css
.stage-drop__meta-value--editable {
  border-bottom: 1px dashed rgba(253, 248, 248, 0.4);
  transition: color 120ms var(--ease-out-soft), border-bottom-color 120ms var(--ease-out-soft);
}

.stage-drop__meta-value--editable:hover,
.stage-drop__meta-value--editable:focus {
  color: var(--accent) !important;
  border-bottom-color: var(--accent) !important;
  outline: none;
}
```

- [ ] **Step 2: Commit styling changes**
```bash
git add src/index.css
git commit -m "style: add styles for editable started time field"
```

---

### Task 4: Write and update unit tests in Timer.test.tsx

**Files:**
- Modify: `src/pages/Timer.test.tsx`

- [ ] **Step 1: Add new test cases for desktop carousel and start time editing**
Add the new test cases in `src/pages/Timer.test.tsx` near the mobile carousel test:

```typescript
  test('renders active sessions in a carousel on desktop when multiple timers are active', async () => {
    setBreakpoint('desktop');
    const start = new Date(Date.now() - 5_000).toISOString();
    const entries = [
      baseEntry({
        id: 'active-1',
        space: 'Dev',
        specialization: 'frontend',
        start_date: start,
        completion_time: null,
      }),
      baseEntry({
        id: 'active-2',
        space: 'Design',
        specialization: 'spec',
        start_date: start,
        completion_time: null,
      }),
    ];
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: entries }),
      getFullList: vi.fn().mockResolvedValue(entries),
    }));

    const { unmount } = renderTimer();
    await screen.findByText('00:00:05');
    const stageDrop = document.querySelector('.stage-drop') as HTMLElement;
    expect(stageDrop).toBeInTheDocument();
    expect(within(stageDrop).getByText('Dev')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /Previous active session/i });
    const nextBtn = screen.getByRole('button', { name: /Next active session/i });
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(nextBtn);
    });
    expect(within(stageDrop).getByText('Design')).toBeInTheDocument();
    unmount();
  });

  test('allows editing active session start time by clicking STARTED attribute', async () => {
    const start = new Date('2026-07-02T14:00:00.000Z').toISOString();
    const entry = baseEntry({
      id: 'active-edit',
      space: 'Dev',
      specialization: 'frontend',
      start_date: start,
      completion_time: null,
    });
    const updateMock = vi.fn().mockResolvedValue({});
    (pb.collection as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getList: vi.fn().mockResolvedValue({ items: [entry] }),
      getFullList: vi.fn().mockResolvedValue([entry]),
      update: updateMock,
    }));

    const { unmount } = renderTimer();
    await screen.findByText('Dev');
    
    const editBtn = screen.getByTitle('Click to edit start time');
    expect(editBtn).toBeInTheDocument();
    
    const timeInput = screen.getByLabelText('Edit start time') as HTMLInputElement;
    expect(timeInput).toBeInTheDocument();
    
    const showPickerMock = vi.fn();
    timeInput.showPicker = showPickerMock;
    
    fireEvent.click(editBtn);
    expect(showPickerMock).toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(timeInput, { target: { value: '15:30' } });
    });

    expect(updateMock).toHaveBeenCalledWith('active-edit', expect.objectContaining({
      start_date: expect.any(String),
    }));

    const updatedIso = updateMock.mock.calls[0][1].start_date;
    const updatedDate = new Date(updatedIso);
    expect(updatedDate.getHours()).toBe(15);
    expect(updatedDate.getMinutes()).toBe(30);

    unmount();
  });
```

- [ ] **Step 2: Run all tests to make sure everything passes**
Run: `npm test`
Expected: PASS (all 299 tests should pass).

- [ ] **Step 3: Commit test changes**
```bash
git add src/pages/Timer.test.tsx
git commit -m "test: add tests for desktop carousel and start time editing"
```
