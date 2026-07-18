import { useState, useEffect } from 'react';
import api from '../../api';

export default function HodStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', inchargeYear: '' });
  const [isAdding, setIsAdding] = useState(false);

  const loadStaff = () => {
    setLoading(true);
    api.get('/api/hod/staff')
      .then(r => setStaff(r.data.staff || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStaff(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setLoading(true);
    try {
      await api.post('/api/hod/staff', { 
        name: form.name, 
        phone: form.phone, 
        inchargeYear: form.inchargeYear ? parseInt(form.inchargeYear) : null 
      });
      alert('Staff added successfully!');
      setForm({ name: '', phone: '', inchargeYear: '' });
      setIsAdding(false);
      loadStaff();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="section-header">
        <span className="section-title">Teaching Staff</span>
        <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {isAdding && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleAdd} className="stack-sm">
            <div className="input-group">
              <label className="input-label">Name</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Vinoth" required />
            </div>
            <div className="input-group">
              <label className="input-label">Phone Number (Login ID)</label>
              <input className="input" type="tel" maxLength={10} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10-digit number" required />
            </div>
            <div className="input-group">
              <label className="input-label">Incharge Year (Optional)</label>
              <select className="input" value={form.inchargeYear} onChange={e => setForm({...form, inchargeYear: e.target.value})}>
                <option value="">-- None --</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary mt-8" disabled={loading}>
              {loading ? 'Adding...' : 'Save Staff'}
            </button>
          </form>
        </div>
      )}

      <div className="stack-sm" style={{ marginBottom: 80 }}>
        {loading && !isAdding && <div className="loading-center"><div className="spinner"/></div>}
        {staff.map(s => (
          <div key={s.id} className="list-item">
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}> {s.phone}</div>
            </div>
            {s.inchargeYear && (
              <span className="badge badge-primary">Year {s.inchargeYear} Incharge</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
