import { render, screen, act } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { TypewriterText } from './TypewriterText';

test('types out text character by character', async () => {
  vi.useFakeTimers();
  render(<TypewriterText text="HELLO" delay={0} speed={50} />);
  
  // At the beginning, nothing should be typed out yet
  expect(screen.queryByText("HELLO")).toBeNull();
  
  // Advance by some time, e.g. 100ms (should have typed "HE" or similar, but not "HELLO")
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(screen.queryByText("HELLO")).toBeNull();

  // Advance by another 150ms (total 250ms), should show the full text "HELLO"
  act(() => {
    vi.advanceTimersByTime(150);
  });
  expect(screen.getByText("HELLO")).toBeInTheDocument();
  
  vi.useRealTimers();
});

test('respects the custom delay parameter', () => {
  vi.useFakeTimers();
  render(<TypewriterText text="HI" delay={500} speed={50} />);
  
  // Even after 100ms, typing hasn't started because of the delay
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(screen.queryByText("H")).toBeNull();
  
  // Advance past the 500ms delay, and some speed time
  act(() => {
    vi.advanceTimersByTime(400); // Total 500ms: delay finishes, starting typing
  });
  // After delay is done, at 500ms, first character or start of typing triggers
  act(() => {
    vi.advanceTimersByTime(150); // Advance enough to type out "HI"
  });
  expect(screen.getByText("HI")).toBeInTheDocument();
  
  vi.useRealTimers();
});
