import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';
import NotifyForm from '../../components/NotifyForm';

export default function HodDashboard({ unread, onBellClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [schedule, setSchedule] = useState({ subjects: [], timetables: {} });
  const [staffList, setStaffList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [rankings, setRankings] = useState({ 2: [], 3: [], 4: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/notifications'),
      api.get(`/api/app/staff-schedule/${user.userId || user.id}`),
      api.get('/api/hod/staff'),
      api.get('/api/academics/subjects'),
      api.get('/api/academics/ranking/2/IA1').catch(() => ({ data: { ranking: [] } })),
      api.get('/api/academics/ranking/3/IA1').catch(() => ({ data: { ranking: [] } })),
      api.get('/api/academics/ranking/4/IA1').catch(() => ({ data: { ranking: [] } }))
    ]).then(([nR, sR, staffR, subR, r2, r3, r4]) => {
      setNotifs(nR.data.notifications.slice(0, 10));
      setSchedule(sR.data);
      setStaffList(staffR.data.staff || []);
      setSubjectsList(subR.data.subjects || []);
      setRankings({
        2: r2.data.ranking.slice(0, 3) || [],
        3: r3.data.ranking.slice(0, 3) || [],
        4: r4.data.ranking.slice(0, 3) || []
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, [user.id, user.userId]);

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
          <div className="header-title">HOD Portal</div>
          <div className="header-subtitle">{user.name} · IT Department</div>
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
        </div>

        {/* Broadcast */}
        <div className="section-header">
          <span className="section-title">Broadcast Message</span>
        </div>
        <NotifyForm defaultRole="STUDENT" allowedRoles={['STUDENT', 'STAFF']} allowedYears={[null, 2, 3, 4]} />

        {/* My Subjects */}
        <div className="section-header" style={{ marginTop: 24 }}>
          <span className="section-title">My Subjects</span>
        </div>
        <div className="stack-sm" style={{ marginBottom: 16 }}>
          {schedule.subjects.length === 0 && !loading && (
            <div className="card" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', padding: 20 }}>
              No subjects assigned to you.
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

        {/* Academic Rankings Overview */}
        <div className="section-header" style={{ marginTop: 24 }}>
          <span className="section-title">Academic Top Performers (IA1)</span>
        </div>
        <div className="stack-sm">
          {[2, 3, 4].map(y => (
            <div key={y} className="card">
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>Year {y}</h4>
              {rankings[y].length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No data available</div>
              ) : (
                rankings[y].map((s, idx) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < rankings[y].length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent)', marginRight: 8 }}>#{s.rank}</span>
                      <span style={{ color: 'var(--text-1)' }}>{s.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.totalMarks} / {s.maxMarks}</div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        {/* Staff Overview */}
        <div className="section-header" style={{ marginTop: 24 }}>
          <span className="section-title">Staff Overview</span>
        </div>
        <div className="stack-sm">
          {staffList.map(st => {
            const stSubjects = subjectsList.filter(sub => sub.staffId === st.id);
            const totalHours = stSubjects.reduce((acc, sub) => acc + sub.hoursPerWeek, 0);
            return (
              <div key={st.id} className="card">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{st.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                  {st.inchargeYear ? <span className="badge badge-primary" style={{ marginRight: 6 }}>Year {st.inchargeYear} Incharge</span> : null}
                  Assigned Subjects: {stSubjects.length}
                </div>
                {stSubjects.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                    {stSubjects.map(sub => <div key={sub.id}>{sub.code} - {sub.name} (Yr {sub.year})</div>)}
                    <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--accent)' }}>Total Hours: {totalHours} hrs/week</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Announcements */}
        <div className="section-header" style={{ marginTop: 24 }}>
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
        
        {/* Spacer for bottom nav */}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}
