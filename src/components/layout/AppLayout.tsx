import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface flex flex-col text-on-surface">
      <main className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-8 pb-24">
        <Outlet />
      </main>
      <AppSidebar />
    </div>
  );
}
