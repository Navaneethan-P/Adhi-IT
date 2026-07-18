import { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../App';
import NotifyForm from '../../components/NotifyForm';

export default function InchargeDashboard() {
  const { user } = useAuth();
  const year = user.inchargeYear;
  const [tab, setTab] = useState('TIMETABLE'); // TIMETABLE, FEES, CODING
  const [loading, setLoading] = useState(false);

  // Timetable state
  const [tt, setTt] = useState({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] });
  // Fees state
  const [feeFile, setFeeFile] = useState(null);
  // Coding state
  const [codeFile, setCodeFile] = useState(null);

  useEffect(() => {
    if (tab === 'TIMETABLE') {
      setLoading(true);
      api.get(`/api/timetable/${year}`)
        .then(r => { if (r.data.timetable?.weeklySlots) setTt(r.data.timetable.weeklySlots); })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [tab, year]);

  const handleTtChange = (day, period, val) => {
    setTt(p => {
      const next = { ...p };
      if (!next[day]) next[day] = [];
      while (next[day].length <= period) next[day].push('');
      next[day][period] = val;
      return next;
    });
  };

  const saveTimetable = async () => {
    try {
      setLoading(true);
      await api.post(`/api/timetable/${year}`, { weeklySlots: tt });
      alert('Timetable published successfully!');
    } catch (e) {
      alert('Failed to publish timetable');
    } finally {
      setLoading(false);
    }
  };

  const generateTimetable = async () => {
    try {
      setLoading(true);
      const placements = {};
      Object.entries(tt).forEach(([day, periods]) => {
        const placementIndexes = [];
        periods.forEach((val, idx) => {
          if (val && val.toUpperCase() === 'PLACEMENT') placementIndexes.push(idx);
        });
        if (placementIndexes.length > 0) placements[day] = placementIndexes;
      });

      const r = await api.post(`/api/timetable/generate/${year}`, { placements });
      if (r.data.weeklySlots) setTt(r.data.weeklySlots);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to auto-generate timetable');
    } finally {
      setLoading(false);
    }
  };

  const uploadCSV = async (type, file) => {
    if (!file) return;
    try {
      setLoading(true);
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim());
      
      const records = lines.slice(1).map(l => {
        const vals = l.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i]?.trim(); });
        return obj;
      });

      if (type === 'FEES') {
        const payload = records.map(r => ({ rollNo: r.rollNo, totalFee: parseInt(r.totalFee)||0, paidAmount: parseInt(r.paidAmount)||0, notes: r.notes||'' }));
        await api.post('/api/fees/bulk-update', { records: payload });
        alert('Fees updated successfully!');
      } else {
        const payload = records.map(r => ({ rollNo: r.rollNo, leetcode: parseInt(r.leetcode)||0, hackerrank: parseInt(r.hackerrank)||0, contestRating: parseInt(r.contestRating)||0 }));
        await api.post('/api/coding/bulk-update', { records: payload });
        alert('Coding scores updated successfully!');
      }
    } catch (e) {
      alert('Error parsing or uploading CSV');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!year) return <div className="app-shell"><div className="empty-state">Not an incharge</div></div>;

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title"> Incharge Panel</div>
        <div className="header-subtitle">Year {year} IT</div>
      </div>
      
      <div className="page-content">
        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'TIMETABLE' ? 'active' : ''}`} onClick={() => setTab('TIMETABLE')}>Timetable</button>
          <button className={`tab-btn ${tab === 'FEES' ? 'active' : ''}`} onClick={() => setTab('FEES')}>Fees (CSV)</button>
          <button className={`tab-btn ${tab === 'CODING' ? 'active' : ''}`} onClick={() => setTab('CODING')}>Coding (CSV)</button>
        </div>

        {tab === 'TIMETABLE' && (
          <div className="stack">
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
              Type <strong>PLACEMENT</strong> in any slot and click ✨ AI Auto-Fill to automatically schedule subjects around it.
            </div>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="card">
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>{day}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[0,1,2,3].map(p => (
                    <input
                      key={p}
                      className="input"
                      style={{ padding: '6px 4px', fontSize: 12, textAlign: 'center' }}
                      placeholder={`P${p+1}`}
                      value={tt[day]?.[p] || ''}
                      onChange={e => handleTtChange(day, p, e.target.value.toUpperCase())}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn btn-secondary btn-full" onClick={generateTimetable} disabled={loading}>
                {loading ? 'Working...' : '✨ AI Auto-Fill'}
              </button>
              <button className="btn btn-primary btn-full" onClick={saveTimetable} disabled={loading}>
                {loading ? 'Saving...' : 'Publish Timetable'}
              </button>
            </div>
          </div>
        )}

        {tab === 'FEES' && (
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Bulk Update Fees</h3>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
              Upload a CSV file with columns: <strong>rollNo, totalFee, paidAmount, notes</strong>
            </p>
            <input type="file" accept=".csv" onChange={e => setFeeFile(e.target.files[0])} className="input" style={{ marginBottom: 16, padding: '8px' }} />
            <button className="btn btn-primary btn-full" onClick={() => uploadCSV('FEES', feeFile)} disabled={!feeFile || loading}>
              {loading ? 'Uploading...' : 'Upload & Update Fees'}
            </button>
          </div>
        )}

        {tab === 'CODING' && (
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Bulk Update Coding Scores</h3>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
              Upload a CSV file with columns: <strong>rollNo, leetcode, hackerrank, contestRating</strong>
            </p>
            <input type="file" accept=".csv" onChange={e => setCodeFile(e.target.files[0])} className="input" style={{ marginBottom: 16, padding: '8px' }} />
            <button className="btn btn-primary btn-full" onClick={() => uploadCSV('CODING', codeFile)} disabled={!codeFile || loading}>
              {loading ? 'Uploading...' : 'Upload & Update Scores'}
            </button>
          </div>
        )}

        <div className="section-header" style={{ marginTop: 24 }}>
          <span className="section-title"> Broadcast Message</span>
        </div>
        <NotifyForm defaultRole="STUDENT" allowedRoles={['STUDENT']} allowedYears={[year]} />
      </div>
    </div>
  );
}
