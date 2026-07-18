import { useState, useEffect } from 'react';
import api from '../../api';

export default function HodStudents() {
  const [year, setYear] = useState(2);
  const [students, setStudents] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStudents = () => {
    setLoading(true);
    api.get(`/api/hod/students?year=${year}`)
      .then(r => setStudents(r.data.students || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStudents(); }, [year]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const records = lines.slice(1).map(l => {
        const [name, rollNo, phone] = l.split(',');
        return { name: name?.trim(), rollNo: rollNo?.trim(), phone: phone?.trim(), year };
      });
      
      await api.post('/api/hod/students/bulk', { students: records });
      alert('Students imported successfully!');
      loadStudents();
      setFile(null);
    } catch (e) {
      alert('Upload failed. Ensure CSV has Name,RollNo,Phone columns');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="tab-bar">
        {[2, 3, 4].map(y => (
          <button key={y} className={`tab-btn ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>Year {y}</button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Bulk Upload Students (Year {year})</h3>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>CSV format: <strong>Name, RollNo, Phone</strong> (without header row or just ignore first row)</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} className="input" style={{ flex: 1, padding: 8 }} />
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading}>Upload</button>
        </div>
      </div>

      <div className="section-header">
        <span className="section-title">Students ({students.length})</span>
      </div>

      <div className="stack-sm" style={{ marginBottom: 80 }}>
        {loading && <div className="loading-center"><div className="spinner" /></div>}
        {!loading && students.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 13 }}>No students added for Year {year}</div>
        )}
        {!loading && students.map(s => (
          <div key={s.id} className="list-item">
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.rollNo} ·  {s.phone}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
