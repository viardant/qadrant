import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import { useResponsiveValue } from '../../hooks/useResponsiveValue';

const TAB_BAR_HEIGHT = 72;
const SPACE_8 = 32;
const SPACE_16 = 64;
const SPACE_2 = 8;
const SPACE_1 = 4;

export function AppLayout() {
  const paddingInline = useResponsiveValue({ mobile: SPACE_1, tablet: SPACE_2, desktop: SPACE_16 });
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
