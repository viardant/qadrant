import { ReactNode } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { pb } from './lib/pocketbase';
import Login from './pages/Login';
import Logger from './pages/Logger';
import Charts from './pages/Charts';
import Ledger from './pages/Ledger';
import Settings from './pages/Settings';

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = pb.authStore.isValid;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="logo">Apok</div>
        <ul className="nav-links">
          <li><Link to="/">Logger</Link></li>
          <li><Link to="/charts">Charts</Link></li>
          <li><Link to="/ledger">Ledger</Link></li>
          <li><Link to="/settings">Settings</Link></li>
        </ul>
        <button 
          className="logout-button"
          onClick={() => {
            pb.authStore.clear();
            document.cookie = 'pb_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
            window.location.reload();
          }}
        >
          Logout
        </button>
      </nav>
      <main className="content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Logger />
          </ProtectedRoute>
        }
      />
      <Route
        path="/charts"
        element={
          <ProtectedRoute>
            <Charts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ledger"
        element={
          <ProtectedRoute>
            <Ledger />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
