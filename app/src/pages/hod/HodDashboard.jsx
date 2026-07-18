import { useState, useEffect } from 'react';
import api from '../../api';
import NotifyForm from '../../components/NotifyForm';

export default function HodDashboard() {
  const [stats, setStats] = useState({ totalStudents: 0, totalStaff: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/api/hod/students?year=2'),
      api.get('/api/hod/students?year=3'),
      api.get('/api/hod/students?year=4')
    ]).then(responses => {
      const count = responses.reduce((acc, r) => acc + (r.data.students || []).length, 0);
      setStats(p => ({ ...p, totalStudents: count }));
    }).catch(console.error);

    api.get('/api/hod/staff').then(r => {
      setStats(p => ({ ...p, totalStaff: (r.data.staff || []).length }));
    }).catch(console.error);
  }, []);

  return (
    <div className="page-content">
      <div className="hero-card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
        <p className="hero-greeting">Administration</p>
        <p className="hero-name">IT Department Overview</p>
        <p className="hero-sub">Welcome back, Head of Department.</p>
      </div>

      <div className="grid-2">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-dim)', color: 'var(--accent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="stat-info">
            <div className="value">{stats.totalStudents}</div>
            <div className="label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div className="stat-info">
            <div className="value">{stats.totalStaff}</div>
            <div className="label">Total Staff</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Quick Guide</h3>
        <ul style={{ fontSize: 13, color: 'var(--text-2)', paddingLeft: 16, lineHeight: 1.6 }}>
          <li><strong>Students Tab:</strong> Upload student data via CSV to populate the database.</li>
          <li><strong>Staff Tab:</strong> Manage staff and assign Year Incharges.</li>
          <li><strong>Exams Tab:</strong> Create IA1, IA2, and Semester exams and allocate them to staff.</li>
          <li><strong>Note:</strong> Staff incharges will manage timetable and fees for their respective years.</li>
        </ul>
      </div>

      <div className="section-header">
        <span className="section-title"> Broadcast Message</span>
      </div>
      <NotifyForm defaultRole="STUDENT" allowedRoles={['STUDENT', 'STAFF']} allowedYears={[null, 2, 3, 4]} />
    </div>
  );
}
