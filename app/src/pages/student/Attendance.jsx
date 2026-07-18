import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const uid = user.userId || user.id;

  useEffect(() => {
    api.get(`/api/attendance/student/${uid}`)
      .then(r => setSummary(r.data.summary || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid]);

  const overall = summary.length > 0
    ? Math.round(summary.filter(s => s.totalClasses > 0).reduce((acc, s) => acc + (s.percentage || 0), 0) / (summary.filter(s => s.totalClasses > 0).length || 1))
    : null;

  const colorFor = pct => pct >= 75 ? 'var(--success)' : pct >= 65 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">My Attendance</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        {overall !== null && (
          <div className="hero-card" style={{ background: `linear-gradient(135deg, ${overall >= 75 ? '#059669, #065f46' : overall >= 65 ? '#d97706, #92400e' : '#dc2626, #991b1b'})`, marginBottom: 16 }}>
            <p className="hero-greeting">Overall Attendance</p>
            <p className="hero-name" style={{ fontSize: 40 }}>{overall}%</p>
            <p className="hero-sub">{overall >= 75 ? 'You are safe!' : overall >= 65 ? 'Below recommended. Improve attendance.' : 'Critical — below 65%'}</p>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading...</div>}

        {!loading && summary.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>No attendance recorded yet.</div>
        )}

        {summary.map(s => {
          const color = s.percentage !== null ? colorFor(s.percentage) : 'var(--text-3)';
          return (
            <div key={s.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color }}>{s.percentage !== null ? `${s.percentage}%` : '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.present}/{s.totalClasses} classes</div>
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: 'var(--bg-input)' }}>
                <div style={{ height: '100%', borderRadius: 4, background: color, width: `${s.percentage || 0}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
