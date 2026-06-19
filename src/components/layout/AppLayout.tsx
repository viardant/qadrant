import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import { useResponsiveValue } from '../../hooks/useResponsiveValue';

const TAB_BAR_HEIGHT = 72;
const SPACE_16 = 64;
const SPACE_6 = 24;
const SPACE_4 = 16;
const SPACE_8 = 32;

export function AppLayout() {
  const paddingInline = useResponsiveValue({ mobile: SPACE_4, tablet: SPACE_6, desktop: SPACE_16 });
  const bottomBuffer = useResponsiveValue({ mobile: SPACE_8, tablet: SPACE_8, desktop: SPACE_16 });
  const isMobile = useResponsiveValue({ mobile: true, desktop: false });

  return (
    <div className="page-shell">
      <main
        className="container page"
        style={{
          paddingInline: `${paddingInline}px`,
          paddingBottom: `calc(${TAB_BAR_HEIGHT}px + ${bottomBuffer}px + env(safe-area-inset-bottom, 0px))`,
        }}
        data-mobile={isMobile ? 'true' : undefined}
      >
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
