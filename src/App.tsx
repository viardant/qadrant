import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { pb } from './lib/pocketbase';
import { BeatIndicator } from './components/ui/BeatIndicator';
import Login from './pages/Login';
import Timer from './pages/Timer';
import { AppLayout } from './components/layout/AppLayout';

const Stats = lazy(() => import('./pages/Stats'));
const Ledger = lazy(() => import('./pages/Ledger'));
const Settings = lazy(() => import('./pages/Settings'));

function RouteFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <BeatIndicator />
    </div>
  );
}

function ProtectedRoute() {
  const isAuthenticated = pb.authStore.isValid;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Timer />} />
        <Route path="/charts" element={<Suspense fallback={<RouteFallback />}><Stats /></Suspense>} />
        <Route path="/ledger" element={<Suspense fallback={<RouteFallback />}><Ledger /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
