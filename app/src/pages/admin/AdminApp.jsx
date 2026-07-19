import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../App';

export default function AdminApp() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#f0f7ff',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px 24px',
    }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 440, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#0ea5e9', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Administrator
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Adhi-IT</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {user.name} · IT Department
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'white',
              border: '1.5px solid #dbeafe',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}>
            Logout
          </button>
        </div>
      </div>

      {/* Admin notice card */}
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'white',
        border: '1.5px solid #dbeafe',
        borderRadius: 14,
        padding: '20px',
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(14,165,233,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: '#e0f2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Admin Control Panel</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>PC Dashboard</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
          The full admin controls are on the <strong>PC Admin Dashboard</strong>. Open it on your computer to manage students, staff, fees, marks, timetable, and more.
        </div>
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: '#f0f7ff',
          borderRadius: 8,
          border: '1px solid #dbeafe',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#0369a1',
          wordBreak: 'break-all',
        }}>
          D:\CampusOS_Prototype\backend\public\admin\index.html
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
          Run <strong>Start-Admin-Dashboard.bat</strong> to start the server, then open the file above in your browser.
        </div>
      </div>

      {/* Live stats */}
      {stats && (
        <div style={{ width: '100%', maxWidth: 440, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Live Overview
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Students', val: stats.totalStudents, color: '#0ea5e9', bg: '#e0f2fe' },
              { label: 'Staff & HOD', val: stats.totalStaff, color: '#059669', bg: '#d1fae5' },
              { label: 'Subjects', val: stats.totalSubjects, color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Fee Pending', val: stats.pendingFees, color: '#d97706', bg: '#fef3c7' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'white',
                border: '1.5px solid #dbeafe',
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 20, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Adhi College of Engineering — IT Department
      </div>
    </div>
  );
}
