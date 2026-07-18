import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function Timetable() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = user.year || user.inchargeYear;

  useEffect(() => {
    Promise.all([
      api.get(`/api/app/timetable/${year}`),
      api.get('/api/admin/settings')
    ]).then(([ttR, sR]) => {
      setTimetable(ttR.data.timetable?.config || null);
      setConfig(sR.timetable_config || { periods: 8, breakAfter: [] });
    }).catch(console.error).finally(() => setLoading(false));
  }, [year]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const breakAfter = config?.breakAfter || [];

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">Timetable</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading...</div>}
        {!loading && !timetable && (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
            Timetable not published yet. Check back later.
          </div>
        )}
        {!loading && timetable && days.map(day => {
          const periods = timetable[day] || [];
          const isToday = day === today;
          return (
            <div key={day} className="card" style={{ marginBottom: 10, border: isToday ? '1px solid var(--accent)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: isToday ? 'var(--accent)' : 'var(--text-1)' }}>{day}</div>
                {isToday && <span style={{ fontSize: 11, background: 'var(--accent)', color: 'white', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Today</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {periods.map((code, i) => {
                  const pNum = i + 1;
                  const isBreak = code === 'BREAK' || code === 'LUNCH' || !code;
                  const showBreak = breakAfter.includes(pNum);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: isBreak ? 'var(--bg-input)' : 'var(--primary-dim)',
                        color: isBreak ? 'var(--text-3)' : 'var(--accent)',
                        border: `1px solid ${isBreak ? 'var(--border)' : 'var(--accent)33'}`,
                        minWidth: 44, textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>P{pNum}</div>
                        {code || '—'}
                      </div>
                      {showBreak && (
                        <div style={{ fontSize: 10, color: 'var(--warning)', padding: '2px 6px', background: 'var(--warning)22', borderRadius: 6, whiteSpace: 'nowrap' }}>
                          {pNum === Math.max(...breakAfter.filter(b => b < 6)) ? 'Break' : 'Lunch'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
