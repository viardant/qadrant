import { render, screen, act } from '@testing-library/react';
import { expect, test, vi, afterEach } from 'vitest';
import { TypewriterText } from './TypewriterText';

afterEach(() => {
  vi.useRealTimers();
});

test('types out text character by character and controls cursor visibility', () => {
  vi.useFakeTimers();
  render(<TypewriterText text="HELLO" delay={0} speed={50} />);
  
  const typewriter = screen.getByTestId("typewriter-text");
  
  // At the beginning, nothing should be typed out yet, cursor should be visible
  expect(typewriter.textContent).toBe("");
  expect(screen.getByTestId("terminal-cursor")).toBeInTheDocument();
  
  // Advance by some time, e.g. 100ms (should have typed "HE" with speed = 50ms)
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(typewriter.textContent).toBe("HE");
  expect(screen.getByTestId("terminal-cursor")).toBeInTheDocument();

  // Advance by another 150ms (total 250ms), should show the full text "HELLO" and cursor should disappear
  act(() => {
    vi.advanceTimersByTime(150);
  });
  expect(typewriter.textContent).toBe("HELLO");
  expect(screen.queryByTestId("terminal-cursor")).toBeNull();
});

test('respects the custom delay parameter', () => {
  vi.useFakeTimers();
  render(<TypewriterText text="HI" delay={500} speed={50} />);
  
  const typewriter = screen.getByTestId("typewriter-text");

  // Even after 100ms, typing hasn't started because of the delay
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(typewriter.textContent).toBe("");
  
  // Advance past the 500ms delay (400ms more)
  act(() => {
    vi.advanceTimersByTime(400);
  });
  
  // Advance enough to type out "HI" (100ms more)
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(typewriter.textContent).toBe("HI");
  expect(screen.queryByTestId("terminal-cursor")).toBeNull();
});
