import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function StaffDashboard({ unread, onBellClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [schedule, setSchedule] = useState({ subjects: [], timetables: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/notifications'),
      api.get(`/api/app/staff-schedule/${user.userId || user.id}`)
    ]).then(([nR, sR]) => {
      setNotifs(nR.data.notifications.slice(0, 10));
      setSchedule(sR.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    await api.put(`/api/notifications/${id}/read`).catch(() => {});
    setNotifs(p => p.map(n => n.id === id ? { ...n, isRead: 1 } : n));
    if (onBellClick) onBellClick();
  };

  const markAllRead = async () => {
    await api.put('/api/notifications/read-all/all').catch(() => {});
    setNotifs(p => p.map(n => ({ ...n, isRead: 1 })));
    if (onBellClick) onBellClick();
  };

  return (
    <div className="app-shell">
      <div className="top-header">
        <div>
          <div className="header-title">Staff Portal</div>
          <div className="header-subtitle">
            {user.name} · IT Department
            {user.inchargeYear ? ` · Year ${user.inchargeYear} Incharge` : ''}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout} style={{ fontSize: 11 }}>Logout</button>
      </div>

      <div className="page-content">
        {/* Quick Actions */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="stat-card" onClick={() => navigate('/attend')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon" style={{ background: 'var(--primary-dim)', color: 'var(--accent)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div className="stat-info">
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Take</div>
              <div className="label">Attendance</div>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/passfail')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div className="stat-info">
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>View</div>
              <div className="label">Pass / Fail</div>
            </div>
          </div>

          {user.inchargeYear && (
            <div className="stat-card" onClick={() => navigate('/feepending')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div className="stat-info">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Fees</div>
                <div className="label">Pending List</div>
              </div>
            </div>
          )}

          <div className="stat-card" onClick={() => navigate('/announce-staff')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon" style={{ background: 'var(--primary-dim)', color: 'var(--accent)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
            </div>
            <div className="stat-info">
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Send</div>
              <div className="label">Announcement</div>
            </div>
          </div>
        </div>

        {/* My Subjects */}
        <div className="section-header">
          <span className="section-title">My Subjects</span>
        </div>
        <div className="stack-sm" style={{ marginBottom: 16 }}>
          {schedule.subjects.length === 0 && !loading && (
            <div className="card" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', padding: 20 }}>
              No subjects assigned yet. Contact Admin.
            </div>
          )}
          {schedule.subjects.map(s => (
            <div key={s.id} className="list-item">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.code} · Year {s.year} · {s.hoursPerWeek} hrs/week</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Y{s.year}</div>
            </div>
          ))}
        </div>

        {/* Announcements */}
        <div className="section-header">
          <span className="section-title">Announcements</span>
          {unread > 0 && <span className="badge badge-primary" onClick={markAllRead} style={{ cursor: 'pointer' }}>{unread} new</span>}
        </div>
        <div className="stack-sm">
          {notifs.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24, fontSize: 13 }}>No announcements yet</div>}
          {notifs.map(n => (
            <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''}`} onClick={() => markRead(n.id)} style={{ cursor: 'pointer' }}>
              {!n.isRead && <div className="notif-dot" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {n.senderName ? ` · ${n.senderName}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
