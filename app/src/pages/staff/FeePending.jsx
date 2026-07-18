import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function FeePending() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState(user.inchargeYear || '');
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!year) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/app/fee-pending/${year}`);
      setPending(r.data.pending || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { if (year) load(); }, [year]);

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">Fee Pending</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        {user.role === 'HOD' && (
          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Year</label>
            <select className="input" value={year} onChange={e => setYear(e.target.value)}>
              <option value="">Select Year</option>
              <option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option>
            </select>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading...</div>}

        {!loading && pending.length === 0 && year && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--success)', padding: 32 }}>
            No pending fees for Year {year}!
          </div>
        )}

        {pending.map(s => (
          <div key={s.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>{s.rollNo}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>₹{(s.balance || 0).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>pending</div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)' }}>
              <span>Total: ₹{(s.totalFee || 0).toLocaleString('en-IN')}</span>
              <span>Paid: ₹{(s.paidAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
