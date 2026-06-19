import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const MOBILE_MAX_WIDTH = 640;
export const TABLET_MIN_WIDTH = 641;
export const TABLET_MAX_WIDTH = 1023;
export const DESKTOP_MIN_WIDTH = 1024;

const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;
const TABLET_QUERY = `(min-width: ${TABLET_MIN_WIDTH}px) and (max-width: ${TABLET_MAX_WIDTH}px)`;
const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;

const DESKTOP_DEFAULT: BreakpointInfo = {
  breakpoint: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};

function createInfo(bp: Breakpoint): BreakpointInfo {
  if (bp === 'mobile') return { breakpoint: 'mobile', isMobile: true, isTablet: false, isDesktop: false };
  if (bp === 'tablet') return { breakpoint: 'tablet', isMobile: false, isTablet: true, isDesktop: false };
  return DESKTOP_DEFAULT;
}

function detectBreakpoint(): BreakpointInfo {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_DEFAULT;
  }
  if (window.matchMedia(MOBILE_QUERY).matches) return createInfo('mobile');
  if (window.matchMedia(TABLET_QUERY).matches) return createInfo('tablet');
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
  if (process.env.NODE_ENV !== 'test') return;
  const info = createInfo(bp);
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
