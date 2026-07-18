import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function Marks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [marks, setMarks] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  const uid = user.userId || user.id;

  useEffect(() => {
    Promise.all([
      api.get(`/api/app/marks/${uid}`),
      api.get(`/api/app/exams/${user.year}`)
    ]).then(([mR, eR]) => {
      setMarks(mR.data.marks || []);
      setExams(eR.data.exams || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [uid, user.year]);

  const types = ['ALL', 'IA1', 'IA2', 'SEMESTER'];
  const filtered = activeTab === 'ALL' ? marks : marks.filter(m => m.type === activeTab);

  const totalPct = marks.length ? Math.round(marks.reduce((s, m) => s + (m.marks / m.maxMarks * 100), 0) / marks.length) : null;

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">My Marks</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        {totalPct !== null && (
          <div className="hero-card" style={{ marginBottom: 16 }}>
            <p className="hero-greeting">Overall Performance</p>
            <p className="hero-name" style={{ fontSize: 36, fontWeight: 900 }}>{totalPct}%</p>
            <p className="hero-sub">{marks.length} exam entries · Year {user.year} IT</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {types.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: activeTab === t ? 'var(--accent)' : 'var(--bg-card)',
                color: activeTab === t ? 'white' : 'var(--text-2)' }}>
              {t}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading...</div>}

        {!loading && filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
            No marks recorded yet for {activeTab === 'ALL' ? 'any exam' : activeTab}.
          </div>
        )}

        {filtered.map((m, i) => {
          const pct = Math.round((m.marks / m.maxMarks) * 100);
          const color = pct >= 60 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
          return (
            <div key={i} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{m.subjectName} · {m.type}</div>
                  {m.examDate && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{m.examDate}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color }}>{m.marks}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>/ {m.maxMarks}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>{pct}%</div>
                </div>
              </div>
              <div style={{ marginTop: 10, height: 4, borderRadius: 4, background: 'var(--bg-input)' }}>
                <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
          );
        })}

        {!loading && exams.length > 0 && (
          <>
            <div className="section-header" style={{ marginTop: 24 }}>
              <span className="section-title">Upcoming Exams</span>
            </div>
            {exams.map(e => (
              <div key={e.id} className="list-item">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.subjectName} · {e.type} · Max {e.maxMarks}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{e.examDate || 'TBD'}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
