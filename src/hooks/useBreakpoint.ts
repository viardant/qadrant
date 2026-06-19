import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const MOBILE_QUERY = '(max-width: 640px)';
const TABLET_QUERY = '(min-width: 641px) and (max-width: 1023px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

const DESKTOP_DEFAULT: BreakpointInfo = {
  breakpoint: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};

function detectBreakpoint(): BreakpointInfo {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_DEFAULT;
  }
  if (window.matchMedia(MOBILE_QUERY).matches) {
    return { breakpoint: 'mobile', isMobile: true, isTablet: false, isDesktop: false };
  }
  if (window.matchMedia(TABLET_QUERY).matches) {
    return { breakpoint: 'tablet', isMobile: false, isTablet: true, isDesktop: false };
  }
  return DESKTOP_DEFAULT;
}

const listeners = new Set<(info: BreakpointInfo) => void>();
let currentBreakpoint: BreakpointInfo = DESKTOP_DEFAULT;

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  currentBreakpoint = detectBreakpoint();

  const update = () => {
    currentBreakpoint = detectBreakpoint();
    listeners.forEach((fn) => fn(currentBreakpoint));
  };

  window.matchMedia(MOBILE_QUERY).addEventListener('change', update);
  window.matchMedia(TABLET_QUERY).addEventListener('change', update);
  window.matchMedia(DESKTOP_QUERY).addEventListener('change', update);
}

export function setBreakpoint(bp: Breakpoint): void {
  const info: BreakpointInfo =
    bp === 'mobile'
      ? { breakpoint: 'mobile', isMobile: true, isTablet: false, isDesktop: false }
      : bp === 'tablet'
        ? { breakpoint: 'tablet', isMobile: false, isTablet: true, isDesktop: false }
        : DESKTOP_DEFAULT;
  currentBreakpoint = info;
  listeners.forEach((fn) => fn(info));
}

export function useBreakpoint(): BreakpointInfo {
  const [, setForce] = useState(0);

  useEffect(() => {
    const fn = () => setForce((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return currentBreakpoint;
}
