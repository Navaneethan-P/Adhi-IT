import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function AnnounceStaff() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) return alert('Title and message required');
    setLoading(true);
    try {
      await api.post('/api/notifications', {
        title: title.trim(),
        body: body.trim(),
        targetRole: 'STUDENT',
        targetYear: user.inchargeYear || null
      });
      setSent(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to send');
    } finally { setLoading(false); }
  };

  if (sent) return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">Announcement</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Home</button>
      </div>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>Announcement Sent!</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24, textAlign: 'center' }}>
          "{title}" has been sent to {user.inchargeYear ? `Year ${user.inchargeYear} students` : 'all students'}.
        </div>
        <button className="btn btn-primary" onClick={() => { setSent(false); setTitle(''); setBody(''); }}>Send Another</button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="top-header">
        <div>
          <div className="header-title">Send Announcement</div>
          <div className="header-subtitle">
            To: {user.inchargeYear ? `Year ${user.inchargeYear} Students` : 'All Students'}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="input-group" style={{ marginBottom: 14 }}>
            <label className="input-label">Title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lab cancelled tomorrow" />
          </div>
          <div className="input-group" style={{ marginBottom: 20 }}>
            <label className="input-label">Message</label>
            <textarea className="input" value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Write your announcement here..." style={{ resize: 'vertical' }} />
          </div>
          <div className="card" style={{ background: 'var(--bg-input)', marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
            This announcement will be stored permanently and visible to students in their Announcements history.
          </div>
          <button className="btn btn-primary btn-full" onClick={send} disabled={loading}>
            {loading ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}
