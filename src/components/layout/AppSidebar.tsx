import { NavLink } from 'react-router-dom';
import { Timer, BarChart3, List, Settings } from 'lucide-react';

export function AppSidebar() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-container">
        <NavLink
          to="/"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <Timer className="nav-icon" />
          <span className="nav-label">TIMER</span>
        </NavLink>
        
        <NavLink
          to="/charts"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <BarChart3 className="nav-icon" />
          <span className="nav-label">STATS</span>
        </NavLink>
        
        <NavLink
          to="/ledger"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <List className="nav-icon" />
          <span className="nav-label">LEDGER</span>
        </NavLink>
        
        <NavLink
          to="/settings"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings className="nav-icon" />
          <span className="nav-label">SETTINGS</span>
        </NavLink>
      </div>
    </nav>
  );
}
