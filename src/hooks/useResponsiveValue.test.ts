import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { setBreakpoint } from './useBreakpoint';
import { useResponsiveValue } from './useResponsiveValue';

describe('useResponsiveValue', () => {
  beforeEach(() => {
    setBreakpoint('desktop');
  });

  it('returns desktop value by default', () => {
    const { result } = renderHook(() => useResponsiveValue({ mobile: 4, desktop: 64 }));
    expect(result.current).toBe(64);
  });

  it('returns mobile value when on mobile', () => {
    setBreakpoint('mobile');
    const { result } = renderHook(() => useResponsiveValue({ mobile: 4, desktop: 64 }));
    expect(result.current).toBe(4);
  });

  it('falls back to desktop when mobile key missing', () => {
    setBreakpoint('mobile');
    const { result } = renderHook(() => useResponsiveValue({ desktop: 64 }));
    expect(result.current).toBe(64);
  });
});
