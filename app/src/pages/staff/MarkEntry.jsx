import { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../App';

export default function MarkEntry() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [selExam, setSelExam] = useState('');
  const [students, setStudents] = useState([]);
  const [marksData, setMarksData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Only fetch exams that need marks or are recently published for this staff
    api.get('/api/academics/pending-exams')
      .then(r => setExams(r.data.exams || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selExam) { setStudents([]); return; }
    setLoading(true);
    api.get(`/api/academics/exams/${selExam}/marks`)
      .then(r => {
        setStudents(r.data.students || []);
        const initMarks = {};
        (r.data.students || []).forEach(s => {
          initMarks[s.id] = s.marks !== null ? s.marks : '';
        });
        setMarksData(initMarks);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selExam]);

  const handleMarkChange = (id, val) => {
    const exam = exams.find(e => e.id === selExam);
    const num = parseInt(val);
    if (val !== '' && (isNaN(num) || num < 0 || num > (exam?.maxMarks || 100))) return;
    setMarksData(p => ({ ...p, [id]: val }));
  };

  const submitMarks = async () => {
    if (!selExam) return;
    setSaving(true);
    const marksArr = Object.entries(marksData)
      .filter(([_, m]) => m !== '')
      .map(([studentId, marks]) => ({ studentId, marks: parseInt(marks) }));

    try {
      await api.post(`/api/academics/exams/${selExam}/marks`, { marks: marksArr });
      alert('Marks saved successfully!');
      setSelExam('');
      setStudents([]);
      // refresh exams
      const r = await api.get('/api/academics/pending-exams');
      setExams(r.data.exams || []);
    } catch (e) {
      alert('Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const activeExam = exams.find(e => e.id === selExam);

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title"> Enter Marks</div>
      </div>
      
      <div className="page-content">
        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Select Exam</label>
          <select className="input" value={selExam} onChange={e => setSelExam(e.target.value)}>
            <option value="">-- Choose Exam --</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.subjectName} ({e.type}) - Year {e.year}</option>)}
          </select>
        </div>

        {loading && <div className="loading-center"><div className="spinner"/></div>}

        {!loading && selExam && students.length > 0 && activeExam && (
          <>
            <div className="card" style={{ marginBottom: 16, background: 'var(--primary-dim)', borderColor: 'var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Subject</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{activeExam.subjectName} ({activeExam.type})</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Max Marks</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{activeExam.maxMarks}</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginTop: 12 }}>
                <div className="progress-fill" style={{ width: `${(Object.values(marksData).filter(m => m !== '').length / students.length) * 100}%`, background: 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'right', marginTop: 4 }}>
                {Object.values(marksData).filter(m => m !== '').length} / {students.length} filled
              </div>
            </div>

            <div className="stack-sm" style={{ marginBottom: 80 }}>
              {students.map((s, idx) => (
                <div key={s.id} className="list-item" style={{ padding: '8px 12px' }}>
                  <div className="list-item-left">
                    <div style={{ fontSize: 12, color: 'var(--text-3)', width: 20 }}>{idx + 1}.</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.rollNo}</div>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 70, textAlign: 'center', padding: '8px', fontSize: 16, fontWeight: 700 }}
                    placeholder="—"
                    value={marksData[s.id]}
                    onChange={e => handleMarkChange(s.id, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, padding: 16, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-primary btn-full" onClick={submitMarks} disabled={saving}>
                {saving ? 'Saving...' : 'Save & Publish Marks'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
