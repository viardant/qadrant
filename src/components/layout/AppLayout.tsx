import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';

export function AppLayout() {
  return (
    <div className="page-shell">
      <main className="container page">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
