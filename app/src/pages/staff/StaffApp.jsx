import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../App';
import StaffDashboard from './StaffDashboard';
import AttendanceEntry from './AttendanceEntry';
import PassFail from './PassFail';
import FeePending from './FeePending';
import AnnounceStaff from './AnnounceStaff';

export default function StaffApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(BASE);
    socketRef.current = socket;
    socket.emit('join-room', 'staff');
    if (user.inchargeYear) socket.emit('join-room', `year:${user.inchargeYear}`);
    socket.on('notification', () => setUnread(p => p + 1));
    return () => socket.disconnect();
  }, []);

  const NAV = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/attend', label: 'Attendance', icon: AttendIcon },
    { path: '/passfail', label: 'Pass/Fail', icon: AnalyticIcon },
    ...(user.inchargeYear ? [{ path: '/feepending', label: 'Fees', icon: FeesIcon }] : []),
    { path: '/announce-staff', label: 'Announce', icon: MegaphoneIcon },
  ];

  const active = (p) => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p);

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<StaffDashboard unread={unread} onBellClick={() => setUnread(0)} />} />
        <Route path="/attend" element={<AttendanceEntry />} />
        <Route path="/passfail" element={<PassFail />} />
        <Route path="/feepending" element={<FeePending />} />
        <Route path="/announce-staff" element={<AnnounceStaff />} />
      </Routes>

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.path} className={`nav-item ${active(n.path) ? 'active' : ''}`} onClick={() => navigate(n.path)}>
            <n.icon />
            {n.path === '/' && unread > 0 && <span className="nav-badge">{unread}</span>}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function AttendIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function AnalyticIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function FeesIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function MegaphoneIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>; }
