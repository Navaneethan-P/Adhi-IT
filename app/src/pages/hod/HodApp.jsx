import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../App';
import HodDashboard from './HodDashboard';
import HodStudents from './HodStudents';
import HodExams from './HodExams';
import HodStaff from './HodStaff';

const NAV = [
  { path: '/', label: 'Overview', icon: HomeIcon },
  { path: '/students', label: 'Students', icon: UsersIcon },
  { path: '/staff', label: 'Staff', icon: BriefcaseIcon },
  { path: '/exams', label: 'Exams', icon: CheckSquareIcon },
];

export default function HodApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const active = (p) => {
    if (p === '/') return location.pathname === '/';
    return location.pathname.startsWith(p);
  };

  return (
    <div className="app-shell">
      {/* Top Header */}
      <div className="top-header">
        <div>
          <div className="header-title"> HOD Panel</div>
          <div className="header-subtitle">IT Department</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout} style={{ fontSize: 11 }}>Logout</button>
      </div>

      <Routes>
        <Route path="/" element={<HodDashboard />} />
        <Route path="/students" element={<HodStudents />} />
        <Route path="/staff" element={<HodStaff />} />
        <Route path="/exams" element={<HodExams />} />
      </Routes>

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.path} className={`nav-item ${active(n.path) ? 'active' : ''}`} onClick={() => navigate(n.path)}>
            <n.icon />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function BriefcaseIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>; }
function CheckSquareIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>; }
