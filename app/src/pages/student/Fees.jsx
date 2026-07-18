import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function Fees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  const uid = user.userId || user.id;

  useEffect(() => {
    api.get(`/api/app/fees/${uid}`)
      .then(r => setFees(r.data.fees || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid]);

  const totalFee = fees.reduce((s, f) => s + f.totalFee, 0);
  const totalPaid = fees.reduce((s, f) => s + f.paidAmount, 0);
  const balance = totalFee - totalPaid;

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">My Fees</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        {!loading && fees.length > 0 && (
          <div className="hero-card" style={{ marginBottom: 16, background: balance > 0 ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'linear-gradient(135deg, #059669, #065f46)' }}>
            <p className="hero-greeting">{balance > 0 ? 'Outstanding Balance' : 'Fees Clear'}</p>
            <p className="hero-name" style={{ fontSize: 32 }}>₹{Math.abs(balance).toLocaleString('en-IN')}</p>
            <p className="hero-sub">Total: ₹{totalFee.toLocaleString('en-IN')} · Paid: ₹{totalPaid.toLocaleString('en-IN')}</p>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading...</div>}

        {!loading && fees.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
            No fee records found. Contact Admin.
          </div>
        )}

        {fees.map(f => {
          const bal = f.totalFee - f.paidAmount;
          return (
            <div key={f.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>Semester {f.semester}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: bal > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {bal > 0 ? `₹${bal.toLocaleString('en-IN')} due` : 'Paid'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)' }}>
                <span>Total: ₹{f.totalFee.toLocaleString('en-IN')}</span>
                <span>Paid: ₹{f.paidAmount.toLocaleString('en-IN')}</span>
                {f.dueDate && <span>Due: {f.dueDate}</span>}
              </div>
              {f.notes && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{f.notes}</div>}
              <div style={{ marginTop: 10, height: 4, borderRadius: 4, background: 'var(--bg-input)' }}>
                <div style={{ height: '100%', borderRadius: 4, background: bal > 0 ? 'var(--success)' : 'var(--accent)', width: `${f.totalFee > 0 ? Math.round((f.paidAmount / f.totalFee) * 100) : 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
