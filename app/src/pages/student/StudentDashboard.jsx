import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function StudentDashboard({ unread, onBellClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [stats, setStats] = useState({ attAvg: null, feeBalance: null });
  const [loading, setLoading] = useState(true);

  const uid = user.userId || user.id;

  useEffect(() => {
    Promise.all([
      api.get('/api/notifications'),
      api.get(`/api/app/fees/${uid}`),
      api.get(`/api/attendance/student/${uid}`)
    ]).then(([nR, fR, aR]) => {
      setNotifs(nR.data.notifications.slice(0, 10));

      const fees = fR.data.fees || [];
      const totalFee = fees.reduce((s, f) => s + f.totalFee, 0);
      const totalPaid = fees.reduce((s, f) => s + f.paidAmount, 0);

      const summary = aR.data.summary || [];
      const valid = summary.filter(s => s.totalClasses > 0);
      const avgAtt = valid.length ? Math.round(valid.reduce((s, x) => s + (x.percentage || 0), 0) / valid.length) : null;

      setStats({ attAvg: avgAtt, feeBalance: totalFee - totalPaid });
    }).catch(console.error).finally(() => setLoading(false));
  }, [uid]);

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

  const attColor = stats.attAvg >= 75 ? 'var(--success)' : stats.attAvg >= 65 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="app-shell">
      <div className="top-header">
        <div>
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            Adhi-IT
          </div>
          <div className="header-subtitle">Year {user.year} · {user.rollNo || user.userId}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout} style={{ fontSize: 11 }}>Logout</button>
      </div>

      <div className="page-content">
        {/* Hero */}
        <div className="hero-card">
          <p className="hero-greeting">
            {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'},
          </p>
          <p className="hero-name">{user.name}</p>
          <p className="hero-sub">Roll: {user.rollNo} · Year {user.year} IT</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 12 }} onClick={() => navigate('/timetable')}>Timetable</button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 12 }} onClick={() => navigate('/marks')}>My Marks</button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 12 }} onClick={() => navigate('/ranking')}>Ranking</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="stat-card" onClick={() => navigate('/attend')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon" style={{ background: stats.attAvg !== null ? attColor + '22' : 'var(--bg-input)', color: stats.attAvg !== null ? attColor : 'var(--text-3)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div className="stat-info">
              <div className="value" style={{ color: stats.attAvg !== null ? attColor : 'var(--text-3)' }}>
                {stats.attAvg !== null ? `${stats.attAvg}%` : '—'}
              </div>
              <div className="label">Attendance</div>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/fees')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon" style={{ background: stats.feeBalance > 0 ? 'var(--danger-dim)' : 'var(--success-dim)', color: stats.feeBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="stat-info">
              <div className="value" style={{ color: stats.feeBalance > 0 ? 'var(--danger)' : 'var(--success)', fontSize: 16 }}>
                {stats.feeBalance !== null ? (stats.feeBalance > 0 ? `₹${Math.round(stats.feeBalance / 1000)}K due` : 'Clear') : '—'}
              </div>
              <div className="label">Fees</div>
            </div>
          </div>
        </div>

        {/* Announcements */}
        <div className="section-header">
          <span className="section-title">Announcements</span>
          {unread > 0 && (
            <span className="badge badge-primary" style={{ cursor: 'pointer' }} onClick={markAllRead}>{unread} new</span>
          )}
        </div>
        <div className="stack-sm">
          {notifs.length === 0 && !loading && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24, fontSize: 13 }}>No announcements yet</div>
          )}
          {notifs.map(n => (
            <div key={n.id} className={`notif-item ${!n.isRead ? 'unread' : ''}`} onClick={() => markRead(n.id)} style={{ cursor: 'pointer' }}>
              {!n.isRead && <div className="notif-dot" />}
              <div style={{ flex: 1, minWidth: 0 }}>
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
