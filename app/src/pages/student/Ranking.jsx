import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../App';

export default function Ranking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('OVERALL');

  const year = user.year;
  const uid = user.userId || user.id;

  useEffect(() => {
    api.get(`/api/app/ranking/${year}`)
      .then(r => setRankings(r.data.rankings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  const tabs = ['OVERALL', 'IA1', 'IA2', 'SEMESTER', 'CODING'];

  const sorted = [...rankings].sort((a, b) => {
    if (activeTab === 'OVERALL') return (b.percentage || 0) - (a.percentage || 0);
    if (activeTab === 'CODING') {
      const aScore = (a.coding?.leetcode || 0) + (a.coding?.hackerrank || 0);
      const bScore = (b.coding?.leetcode || 0) + (b.coding?.hackerrank || 0);
      return bScore - aScore;
    }
    return (b[activeTab] || 0) - (a[activeTab] || 0);
  }).map((r, i) => ({ ...r, displayRank: i + 1 }));

  const myEntry = sorted.find(r => r.id === uid);

  const getScore = (r) => {
    if (activeTab === 'CODING') return r.coding ? `${(r.coding.leetcode || 0) + (r.coding.hackerrank || 0)} problems` : '—';
    const pct = activeTab === 'OVERALL' ? r.percentage : r[activeTab];
    return pct !== null ? `${pct}%` : '—';
  };

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="header-title">Ranking</div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="page-content">
        {myEntry && (
          <div className="hero-card" style={{ marginBottom: 16 }}>
            <p className="hero-greeting">Your Rank in Year {year}</p>
            <p className="hero-name" style={{ fontSize: 40 }}>#{myEntry.displayRank}</p>
            <p className="hero-sub">out of {rankings.length} students · {getScore(myEntry)}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: '7px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: activeTab === t ? 'var(--accent)' : 'var(--bg-card)',
                color: activeTab === t ? 'white' : 'var(--text-2)' }}>
              {t}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading...</div>}

        {sorted.map((r, i) => {
          const isMe = r.id === uid;
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <div key={r.id} className="list-item" style={{
              marginBottom: 6,
              background: isMe ? 'var(--primary-dim)' : undefined,
              border: isMe ? '1px solid var(--accent)' : undefined,
              borderRadius: 'var(--radius)'
            }}>
              <div style={{ width: 28, textAlign: 'center', fontSize: 16, fontWeight: 800,
                color: i < 3 ? ['#fbbf24', '#94a3b8', '#cd7c35'][i] : 'var(--text-3)' }}>
                {i < 3 ? medals[i] : `${r.displayRank}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 600, color: isMe ? 'var(--accent)' : 'var(--text-1)' }}>
                  {r.name} {isMe ? '(You)' : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{r.rollNo}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isMe ? 'var(--accent)' : 'var(--text-2)' }}>
                {getScore(r)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
