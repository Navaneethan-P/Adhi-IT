import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../App';
import StudentDashboard from './StudentDashboard';
import Marks from './Marks';
import Attendance from './Attendance';
import Fees from './Fees';
import Ranking from './Ranking';
import Timetable from './Timetable';

const NAV = [
  { path: '/',          label: 'Home',       icon: HomeIcon },
  { path: '/marks',     label: 'Marks',      icon: MarksIcon },
  { path: '/attend',    label: 'Attendance', icon: AttendIcon },
  { path: '/fees',      label: 'Fees',       icon: FeesIcon },
  { path: '/ranking',   label: 'Ranking',    icon: RankIcon },
];

export default function StudentApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(BASE);
    socketRef.current = socket;
    socket.emit('join-room', `year:${user.year}`);
    socket.on('notification', () => setUnread(p => p + 1));
    return () => socket.disconnect();
  }, [user.year]);

  const active = (p) => {
    if (p === '/') return location.pathname === '/';
    return location.pathname.startsWith(p);
  };

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<StudentDashboard unread={unread} onBellClick={() => setUnread(0)} />} />
        <Route path="/marks" element={<Marks />} />
        <Route path="/attend" element={<Attendance />} />
        <Route path="/fees" element={<Fees />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/timetable" element={<Timetable />} />
      </Routes>

      {/* Bottom Nav */}
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

function HomeIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function MarksIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }
function AttendIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function FeesIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function RankIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
