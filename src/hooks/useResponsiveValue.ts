import { useBreakpoint } from './useBreakpoint';

export function useResponsiveValue<T>(values: { mobile?: T; tablet?: T; desktop: T }): T {
  const { breakpoint } = useBreakpoint();
  if (breakpoint === 'mobile' && values.mobile !== undefined) return values.mobile;
  if (breakpoint === 'tablet' && values.tablet !== undefined) return values.tablet;
  return values.desktop;
}
