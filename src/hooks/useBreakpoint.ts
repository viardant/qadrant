import { useSyncExternalStore } from 'react';

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

const MOBILE_INFO: BreakpointInfo = {
  breakpoint: 'mobile',
  isMobile: true,
  isTablet: false,
  isDesktop: false,
};

const TABLET_INFO: BreakpointInfo = {
  breakpoint: 'tablet',
  isMobile: false,
  isTablet: true,
  isDesktop: false,
};

const DESKTOP_INFO: BreakpointInfo = {
  breakpoint: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};

function getBreakpointInfo(bp: Breakpoint): BreakpointInfo {
  if (bp === 'mobile') return MOBILE_INFO;
  if (bp === 'tablet') return TABLET_INFO;
  return DESKTOP_INFO;
}

function detectBreakpoint(): BreakpointInfo {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_INFO;
  }
  if (window.matchMedia(MOBILE_QUERY).matches) return MOBILE_INFO;
  if (window.matchMedia(TABLET_QUERY).matches) return TABLET_INFO;
  return DESKTOP_INFO;
}

let mockedBreakpoint: Breakpoint | null = null;
const subscribers = new Set<() => void>();

export function setBreakpoint(bp: Breakpoint): void {
  const isTest =
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');
  if (!isTest) return;

  mockedBreakpoint = bp;
  subscribers.forEach((fn) => fn());
}

function getSnapshot(): BreakpointInfo {
  if (mockedBreakpoint) {
    return getBreakpointInfo(mockedBreakpoint);
  }
  return detectBreakpoint();
}

function getServerSnapshot(): BreakpointInfo {
  return DESKTOP_INFO;
}

function subscribe(callback: () => void) {
  subscribers.add(callback);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {
      subscribers.delete(callback);
    };
  }

  const mqlMobile = window.matchMedia(MOBILE_QUERY);
  const mqlTablet = window.matchMedia(TABLET_QUERY);
  const mqlDesktop = window.matchMedia(DESKTOP_QUERY);

  const onChange = () => {
    callback();
  };

  if (mqlMobile.addEventListener) {
    mqlMobile.addEventListener('change', onChange);
    mqlTablet.addEventListener('change', onChange);
    mqlDesktop.addEventListener('change', onChange);
  } else {
    mqlMobile.addListener(onChange);
    mqlTablet.addListener(onChange);
    mqlDesktop.addListener(onChange);
  }

  return () => {
    subscribers.delete(callback);
    if (mqlMobile.removeEventListener) {
      mqlMobile.removeEventListener('change', onChange);
      mqlTablet.removeEventListener('change', onChange);
      mqlDesktop.removeEventListener('change', onChange);
    } else {
      mqlMobile.removeListener(onChange);
      mqlTablet.removeListener(onChange);
      mqlDesktop.removeListener(onChange);
    }
  };
}

export function useBreakpoint(): BreakpointInfo {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
