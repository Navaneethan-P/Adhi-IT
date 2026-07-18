import { useState } from 'react';
import api from '../api';

export default function NotifyForm({ defaultRole = 'STUDENT', allowedRoles = ['STUDENT', 'STAFF'], allowedYears = [null, 2, 3, 4] }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState(defaultRole);
  const [targetYear, setTargetYear] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title || !body) return alert('Title and body required');
    try {
      setLoading(true);
      await api.post('/api/notifications', { 
        title, 
        body, 
        targetRole: targetRole || null,
        targetYear: targetYear ? parseInt(targetYear) : null
      });
      alert('Notification sent successfully!');
      setTitle('');
      setBody('');
    } catch (e) {
      alert('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSend}>
      <h3 style={{ fontSize: 15, marginBottom: 12, fontWeight: 700 }}>Send Notification</h3>
      
      <div className="input-group" style={{ marginBottom: 12 }}>
        <label className="input-label">Title</label>
        <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Urgent Meeting" required />
      </div>

      <div className="input-group" style={{ marginBottom: 12 }}>
        <label className="input-label">Message</label>
        <textarea className="input" value={body} onChange={e=>setBody(e.target.value)} placeholder="Enter message body..." rows={3} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="input-group">
          <label className="input-label">Target Role</label>
          <select className="input" value={targetRole} onChange={e=>setTargetRole(e.target.value)}>
            {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Target Year (Optional)</label>
          <select className="input" value={targetYear} onChange={e=>setTargetYear(e.target.value)}>
            <option value="">All Years</option>
            {allowedYears.filter(y => y !== null).map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>

      <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Broadcast Notification'}
      </button>
    </form>
  );
}
