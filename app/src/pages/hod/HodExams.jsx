import { useState, useEffect } from 'react';
import api from '../../api';

export default function HodExams() {
  const [tab, setTab] = useState('SUBJECTS'); // SUBJECTS, EXAMS
  const [year, setYear] = useState(2);
  const [subjects, setSubjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [subForm, setSubForm] = useState({ name: '', code: '', staffId: '' });
  const [examForm, setExamForm] = useState({ subjectId: '', type: 'IA1', maxMarks: '50', examDate: '' });

  useEffect(() => {
    api.get('/api/hod/staff').then(r => setStaff(r.data.staff || []));
  }, []);

  const loadData = () => {
    setLoading(true);
    api.get('/api/academics/subjects')
      .then(r => setSubjects(r.data.subjects || []))
      .then(() => api.get('/api/hod/exams'))
      .then(r => setExams(r.data.exams || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const addSubject = async (e) => {
    e.preventDefault();
    if (!subForm.name || !subForm.code || !subForm.staffId) return;
    setLoading(true);
    try {
      await api.post('/api/hod/subjects', { ...subForm, year });
      alert('Subject added!');
      setSubForm({ name: '', code: '', staffId: '' });
      loadData();
    } catch (err) { alert('Failed to add subject'); }
  };

  const addExam = async (e) => {
    e.preventDefault();
    if (!examForm.subjectId) return;
    setLoading(true);
    try {
      await api.post('/api/hod/exams', {
        subjectId: examForm.subjectId,
        type: examForm.type,
        maxMarks: parseInt(examForm.maxMarks),
        examDate: examForm.examDate
      });
      alert('Exam created and published!');
      setExamForm({ ...examForm, subjectId: '' });
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Failed to create exam'); }
  };

  const yearSubjects = subjects.filter(s => s.year === year);
  const yearExams = exams.filter(e => e.year === year);

  return (
    <div className="page-content">
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'SUBJECTS' ? 'active' : ''}`} onClick={() => setTab('SUBJECTS')}>Subjects</button>
        <button className={`tab-btn ${tab === 'EXAMS' ? 'active' : ''}`} onClick={() => setTab('EXAMS')}>Exams</button>
      </div>
      
      <div className="tab-bar" style={{ background: 'transparent', border: 'none', marginBottom: 16 }}>
        {[2,3,4].map(y => (
          <button key={y} className={`tab-btn ${year === y ? 'active' : ''}`} style={{ background: year===y ? 'var(--bg-input)' : 'transparent', color: year===y?'var(--text-1)':'var(--text-3)', border: year===y?'1px solid var(--border)':'none', boxShadow: 'none' }} onClick={() => setYear(y)}>Year {y}</button>
        ))}
      </div>

      {tab === 'SUBJECTS' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add Subject</h3>
            <form onSubmit={addSubject} className="stack-sm">
              <input className="input" placeholder="Subject Name (e.g. Data Structures)" value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} required />
              <input className="input" placeholder="Subject Code (e.g. CS8391)" value={subForm.code} onChange={e => setSubForm({...subForm, code: e.target.value})} required />
              <select className="input" value={subForm.staffId} onChange={e => setSubForm({...subForm, staffId: e.target.value})} required>
                <option value="">-- Assign Staff --</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn btn-primary mt-8" type="submit" disabled={loading}>Add Subject</button>
            </form>
          </div>

          <div className="stack-sm" style={{ marginBottom: 80 }}>
            {yearSubjects.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: 16 }}>No subjects for Year {year}</div>
            ) : yearSubjects.map(s => (
              <div key={s.id} className="list-item">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.code} · Staff: {staff.find(x => x.id === s.staffId)?.name || 'Unknown'}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'EXAMS' && (
        <>
          <div className="card" style={{ marginBottom: 16, borderTop: '4px solid var(--accent)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Schedule Exam</h3>
            <form onSubmit={addExam} className="stack-sm">
              <select className="input" value={examForm.subjectId} onChange={e => setExamForm({...examForm, subjectId: e.target.value})} required>
                <option value="">-- Select Subject --</option>
                {yearSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input" value={examForm.type} onChange={e => setExamForm({...examForm, type: e.target.value})} required>
                <option value="IA1">Internal Assessment 1 (IA1)</option>
                <option value="IA2">Internal Assessment 2 (IA2)</option>
                <option value="SEMESTER">Model / Semester</option>
              </select>
              <div className="grid-2">
                <div>
                  <label className="input-label" style={{marginBottom:4, display:'block'}}>Max Marks</label>
                  <input className="input" type="number" value={examForm.maxMarks} onChange={e => setExamForm({...examForm, maxMarks: e.target.value})} required />
                </div>
                <div>
                  <label className="input-label" style={{marginBottom:4, display:'block'}}>Date (Opt)</label>
                  <input className="input" type="date" value={examForm.examDate} onChange={e => setExamForm({...examForm, examDate: e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary mt-8" type="submit" disabled={loading}>Publish Exam</button>
            </form>
          </div>

          <div className="stack-sm" style={{ marginBottom: 80 }}>
            {yearExams.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: 16 }}>No exams created for Year {year}</div>
            ) : yearExams.map(e => (
              <div key={e.id} className="list-item">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.subjectName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.type} · Max: {e.maxMarks}</div>
                  {e.examDate && <div style={{ fontSize: 11, color: 'var(--text-3)' }}> {e.examDate}</div>}
                </div>
                <span className={`badge ${e.filledCount >= e.totalStudents ? 'badge-success' : 'badge-warning'}`}>
                  {e.filledCount} / {e.totalStudents} Marks
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
