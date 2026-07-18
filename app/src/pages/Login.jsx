import { useState } from 'react';
import api from '../api';
import { useAuth } from '../App';

export default function Login() {
  const { login } = useAuth();
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!rollNo.trim()) return setError('Enter your roll number');
    if (!password) return setError('Enter your password');
    setError(''); setLoading(true);
    try {
      const r = await api.post('/api/auth/login', { rollNo: rollNo.trim(), password });
      login(r.data.token, r.data.user);
    } catch (e) {
      setError(e.response?.data?.error || 'Login failed. Check your roll number and password.');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-logo">
        <img src="/logo.png" alt="Adhi-IT" onError={e => e.target.style.display='none'} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)' }}>Adhi-IT</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          Adhi College of Engineering — IT Department
        </p>
      </div>

      <div className="login-card">
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Sign In</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
          Use your roll number and password to access the portal
        </p>

        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">Roll Number</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. 410123205040"
            value={rollNo}
            onChange={e => { setRollNo(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
            autoComplete="username"
          />
        </div>

        <div className="input-group" style={{ marginBottom: 20 }}>
          <label className="input-label">Password</label>
          <input
            className="input"
            type="password"
            placeholder="Default: last 4 digits of roll number"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

        <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loading}>
          {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In'}
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 16 }}>
          Forgot password? Contact your Admin or HOD.
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        IT Department · Adhi College of Engineering & Technology
      </p>
    </div>
  );
}
