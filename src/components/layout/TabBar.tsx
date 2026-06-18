import { NavLink } from 'react-router-dom';
import { Timer, BarChart3, List, Settings as Cog } from 'lucide-react';
import type { ReactNode } from 'react';

interface TabDef {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const TABS: TabDef[] = [
  { to: '/', label: 'TIMER', icon: <Timer className="tab-bar__icon" strokeWidth={1.5} />, end: true },
  { to: '/charts', label: 'STATS', icon: <BarChart3 className="tab-bar__icon" strokeWidth={1.5} /> },
  { to: '/ledger', label: 'LEDGER', icon: <List className="tab-bar__icon" strokeWidth={1.5} /> },
  { to: '/settings', label: 'SETTINGS', icon: <Cog className="tab-bar__icon" strokeWidth={1.5} /> },
];

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Primary">
      <div className="tab-bar__inner">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `tab-bar__item ${isActive ? 'tab-bar__item--active' : ''}`.trim()
            }
          >
            {({ isActive }) => (
              <>
                <span className="tab-bar__indicator" aria-hidden />
                {tab.icon}
                <span className="tab-bar__label">{tab.label}</span>
                {isActive && <span className="sr-only">, active</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
