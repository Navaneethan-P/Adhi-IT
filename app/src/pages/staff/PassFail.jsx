import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function PassFail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState(user.inchargeYear || '');
  const [examType, setExamType] = useState('ALL');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!year) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/app/pass-fail/${year}/${examType}`);
      setResults(r.data.result || []);
    } catch { } finally { setLoading(false); }
  };

  const colorFor = (status) => status === 'Pass' ? 'var(--success)' : status === 'Average' ? 'var(--warning)' : status === 'Fail' ? 'var(--danger)' : 'var(--text-3)';

  const grouped = { Pass: [], Average: [], Fail: [], 'No Marks': [] };
  results.forEach(r => (grouped[r.status] = grouped[r.status] || []).push(r));

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">Pass / Fail Analysis</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="input-group">
              <label className="input-label">Year</label>
              <select className="input" value={year} onChange={e => setYear(e.target.value)}>
                <option value="">Select Year</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Exam Type</label>
              <select className="input" value={examType} onChange={e => setExamType(e.target.value)}>
                <option value="ALL">Overall</option>
                <option value="IA1">IA1</option>
                <option value="IA2">IA2</option>
                <option value="SEMESTER">Semester</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={load} disabled={loading || !year}>
            {loading ? 'Loading...' : 'Load Results'}
          </button>
        </div>

        {results.length > 0 && (
          <>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              {Object.entries(grouped).map(([status, students]) => students.length > 0 && (
                <div key={status} className="stat-card">
                  <div className="stat-icon" style={{ background: colorFor(status) + '22', color: colorFor(status) }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div className="stat-info">
                    <div className="value" style={{ color: colorFor(status) }}>{students.length}</div>
                    <div className="label">{status}</div>
                  </div>
                </div>
              ))}
            </div>

            {['Pass', 'Average', 'Fail', 'No Marks'].map(status => (
              grouped[status]?.length > 0 && (
                <div key={status} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: colorFor(status), marginBottom: 6, padding: '4px 0' }}>
                    {status} ({grouped[status].length})
                  </div>
                  {grouped[status].map(s => (
                    <div key={s.id} className="list-item" style={{ marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{s.rollNo}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: colorFor(s.status) }}>
                        {s.percentage !== null ? `${s.percentage}%` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ))}
          </>
        )}
      </div>
    </div>
  );
}
