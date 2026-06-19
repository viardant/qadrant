import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBreakpoint, setBreakpoint } from './useBreakpoint';

describe('useBreakpoint', () => {
  beforeEach(() => {
    setBreakpoint('desktop');
  });

  it('returns desktop by default', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
  });

  it('returns mobile when viewport is <=640px', () => {
    setBreakpoint('mobile');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('returns tablet when viewport is 641-1023px', () => {
    setBreakpoint('tablet');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isTablet).toBe(true);
  });

  it('returns desktop when viewport is >=1024px', () => {
    setBreakpoint('desktop');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isDesktop).toBe(true);
  });
});
