import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function AttendanceEntry() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('setup'); // setup | mark
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedYear, setSelectedYear] = useState(user.inchargeYear || user.year || '');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState(1);

  const [present, setPresent] = useState(new Set());
  const [absent, setAbsent] = useState(new Set());
  const [existingSession, setExistingSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!selectedYear) return;
    api.get(`/api/attendance/subjects/${selectedYear}`)
      .then(r => setSubjects(r.data.subjects || []))
      .catch(console.error);
  }, [selectedYear]);

  const loadStudents = async () => {
    if (!selectedSubject || !selectedYear) return;
    setLoading(true);
    try {
      const [stuRes, sessionRes] = await Promise.all([
        api.get(`/api/attendance/students/${selectedYear}`),
        api.get(`/api/attendance/session?subjectId=${selectedSubject}&date=${selectedDate}&period=${selectedPeriod}`)
      ]);

      const studs = stuRes.data.students || [];
      setStudents(studs);

      const session = sessionRes.data.session;
      setExistingSession(session);

      if (session) {
        setPresent(new Set(session.presentIds));
        setAbsent(new Set(session.absentIds));
      } else {
        // Default: all present
        setPresent(new Set(studs.map(s => s.id)));
        setAbsent(new Set());
      }

      setStep('mark');
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); }
  };

  const toggle = (studentId) => {
    setPresent(p => {
      const next = new Set(p);
      if (next.has(studentId)) {
        next.delete(studentId);
        setAbsent(a => new Set([...a, studentId]));
      } else {
        next.add(studentId);
        setAbsent(a => { const na = new Set(a); na.delete(studentId); return na; });
      }
      return next;
    });
  };

  const markAll = (type) => {
    if (type === 'present') {
      setPresent(new Set(students.map(s => s.id)));
      setAbsent(new Set());
    } else {
      setAbsent(new Set(students.map(s => s.id)));
      setPresent(new Set());
    }
  };

  const submit = async () => {
    if (present.size + absent.size === 0) return alert('Mark at least one student');
    setLoading(true);
    try {
      await api.post('/api/attendance', {
        subjectId: selectedSubject,
        year: parseInt(selectedYear),
        date: selectedDate,
        period: selectedPeriod,
        presentIds: [...present],
        absentIds: [...absent]
      });
      setSubmitted(true);
      setStep('setup');
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to submit');
    } finally { setLoading(false); }
  };

  const sub = subjects.find(s => s.id === selectedSubject);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (submitted) return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">Attendance</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>Back</button>
      </div>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>Attendance Saved!</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24, textAlign: 'center' }}>
          {sub?.name} · Period {selectedPeriod} · {selectedDate}<br />
          {present.size} Present, {absent.size} Absent
        </div>
        <button className="btn btn-primary" onClick={() => { setSubmitted(false); setStep('setup'); }}>Take Another</button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="top-header">
        <div>
          <div className="header-title">Take Attendance</div>
          <div className="header-subtitle">{step === 'mark' ? `${sub?.name} · P${selectedPeriod}` : 'Setup'}</div>
        </div>
        {step === 'mark' && <button className="btn btn-secondary btn-sm" onClick={() => setStep('setup')}>← Change</button>}
        {step === 'setup' && <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>}
      </div>

      <div className="page-content">
        {step === 'setup' && (
          <div className="stack">
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Setup Session</div>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Year</label>
                <select className="input" value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedSubject(''); }}>
                  <option value="">Select Year</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Subject</label>
                <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
                {selectedYear && subjects.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>No subjects assigned to you for Year {selectedYear}. Contact Admin.</p>
                )}
              </div>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Date</label>
                <input className="input" type="date" value={selectedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setSelectedDate(e.target.value)} />
                {!isToday && (
                  <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>Past date selected — editing allowed only on same day unless you are an Admin.</p>
                )}
              </div>

              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Period</label>
                <select className="input" value={selectedPeriod} onChange={e => setSelectedPeriod(parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}
                </select>
              </div>

              <button className="btn btn-primary btn-full" onClick={loadStudents} disabled={loading || !selectedSubject || !selectedYear}>
                {loading ? 'Loading...' : 'Load Students →'}
              </button>
            </div>
          </div>
        )}

        {step === 'mark' && (
          <div className="stack">
            {existingSession && (
              <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--warning)' }}>
                Attendance already recorded for this period. {isToday ? 'You can modify it since it is today.' : 'Only Admin can modify past attendance.'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => markAll('present')}>All Present ({students.length})</button>
              <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => markAll('absent')}>All Absent</button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Tap to toggle. Green = Present, Red = Absent.
              <br /><strong>{present.size} Present · {absent.size} Absent</strong>
            </div>

            {students.map(s => {
              const isPresent = present.has(s.id);
              const isAbsent = absent.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 'var(--radius)',
                    background: isPresent ? 'var(--success-dim)' : isAbsent ? 'var(--danger-dim)' : 'var(--bg-card)',
                    border: `1px solid ${isPresent ? 'var(--success)' : isAbsent ? 'var(--danger)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all .15s'
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isPresent ? 'var(--success)' : isAbsent ? 'var(--danger)' : 'var(--bg-input)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: 'white', flexShrink: 0
                  }}>
                    {isPresent ? '✓' : isAbsent ? '✗' : '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{s.rollNo}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: isPresent ? 'var(--success)' : isAbsent ? 'var(--danger)' : 'var(--text-3)' }}>
                    {isPresent ? 'Present' : isAbsent ? 'Absent' : '—'}
                  </div>
                </div>
              );
            })}

            <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
              {loading ? 'Saving...' : `Submit Attendance (${present.size}P / ${absent.size}A)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
