import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import api from './api';
import Login from './pages/Login';
import StudentApp from './pages/student/StudentApp';
import StaffApp from './pages/staff/StaffApp';
import HodApp from './pages/hod/HodApp';
import AdminApp from './pages/admin/AdminApp';
import './index.css';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then(r => { setUser(r.data.user); localStorage.setItem('user', JSON.stringify(r.data.user)); })
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070714' }}>
      <div className="spinner" />
    </div>
  );

  const renderApp = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case 'ADMIN':   return <AdminApp />;
      case 'HOD':     return <HodApp />;
      case 'STAFF':   return <StaffApp />;
      case 'STUDENT': return <StudentApp />;
      default:        return <Navigate to="/login" />;
    }
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/*" element={renderApp()} />
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}

export default App;
