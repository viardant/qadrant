import { Routes, Route, Navigate } from 'react-router-dom';
import { pb } from './lib/pocketbase';
import Login from './pages/Login';
import Timer from './pages/Timer';
import Stats from './pages/Stats';
import Ledger from './pages/Ledger';
import Settings from './pages/Settings';
import { AppLayout } from './components/layout/AppLayout';

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
        <Route path="/charts" element={<Stats />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
