import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// ---------- CLIENT-SIDE SENTIMENT ANALYSIS ----------
const lexicon = {
  good: 2, great: 3, amazing: 4, awesome: 4, love: 3, nice: 2, best: 4,
  excellent: 4, wonderful: 4, beautiful: 3, fantastic: 4, happy: 3, glad: 2,
  perfect: 4, cool: 2, super: 3, brilliant: 4, epic: 3, impressive: 3,
  incredible: 4, legendary: 4, masterpiece: 4, powerful: 3, stunning: 3,
  top: 2, ultimate: 3, victory: 4, win: 3, winning: 3,
  bad: -2, terrible: -4, awful: -4, hate: -3, worst: -4, garbage: -3,
  trash: -3, sucks: -3, disappointing: -3, sad: -2, angry: -3, annoying: -2,
  broken: -2, crap: -2, damn: -2, disaster: -4, failure: -3, frustrating: -3,
  horrible: -4, lame: -2, mediocre: -2, nasty: -3, pathetic: -3, poor: -2,
  stupid: -2, toxic: -3, ugly: -2, useless: -3, worthless: -3,
};
const negations = ['not', 'no', "don't", "doesn't", "isn't", "wasn't", "won't", "never"];

function analyzeSentiment(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  let total = 0, i = 0;
  while (i < words.length) {
    let neg = false;
    if (negations.includes(words[i])) { neg = true; i++; if (i >= words.length) break; }
    let score = lexicon[words[i]] || 0;
    if (neg) score = -score;
    total += score;
    i++;
  }
  let sentiment = 'neutral';
  if (total > 2) sentiment = 'positive';
  else if (total < -2) sentiment = 'negative';
  return { sentiment, score: total };
}

function App() {
  const [subreddit, setSubreddit] = useState('programming');
  const [inputValue, setInputValue] = useState('programming');
  const [rawPosts, setRawPosts] = useState([]);
  const [analyzed, setAnalyzed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const fetchSubreddit = useCallback(async (name) => {
    const clean = name.trim().toLowerCase();
    if (!clean) return setError('Please enter a subreddit name.');
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/subreddit/${clean}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      
      setRawPosts(json.posts);
      const analyzedData = json.posts.map((post) => ({
        ...post,
        ...analyzeSentiment(post.title),
      }));
      setAnalyzed(analyzedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubreddit('programming');
  }, [fetchSubreddit]);

  const stats = React.useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    analyzed.forEach((p) => counts[p.sentiment]++);
    const total = analyzed.length || 1;
    return {
      ...counts,
      total,
      pPos: (counts.positive / total) * 100,
      pNeu: (counts.neutral / total) * 100,
      pNeg: (counts.negative / total) * 100,
    };
  }, [analyzed]);

  const exportCSV = () => {
    if (!analyzed.length) return setError('No data to export.');
    const headers = ['Title', 'Score', 'Sentiment', 'Author', 'Comments'];
    const rows = analyzed.map((p) => [
      `"${p.title.replace(/"/g, '""')}"`,
      p.score,
      p.sentiment,
      p.author || 'anon',
      p.num_comments || 0,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibe-${subreddit}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>📊 Vibe Check</h1>
          <p className="subtitle">Sentiment on the top 50 hot posts (powered by Reddit OAuth)</p>
        </div>
        <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>

      <div className="search-section">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchSubreddit(inputValue)}
          placeholder="Enter subreddit (e.g. programming)"
        />
        <button onClick={() => fetchSubreddit(inputValue)} disabled={loading}>
          {loading ? '⏳ Loading...' : '🔍 Analyze'}
        </button>
        <span className="cache-badge">⚡ OAuth proxy</span>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="skeleton-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-item">
              <span className="skeleton-line short"></span>
              <span className="skeleton-line"></span>
            </div>
          ))}
        </div>
      )}

      {!loading && analyzed.length > 0 && (
        <>
          <div className="stats-grid">
            <div className="stat-card positive">
              <div className="stat-number">{stats.positive}</div>
              <div className="stat-label">😊 Positive</div>
            </div>
            <div className="stat-card neutral">
              <div className="stat-number">{stats.neutral}</div>
              <div className="stat-label">😐 Neutral</div>
            </div>
            <div className="stat-card negative">
              <div className="stat-number">{stats.negative}</div>
              <div className="stat-label">😠 Negative</div>
            </div>
          </div>

          <div className="chart-box">
            <h3>📈 Breakdown</h3>
            {[
              ['Positive', stats.pPos, 'pos'],
              ['Neutral', stats.pNeu, 'neu'],
              ['Negative', stats.pNeg, 'neg'],
            ].map(([label, pct, cls]) => (
              <div key={label} className="chart-row">
                <span className="chart-label">{label}</span>
                <div className="chart-track">
                  <div className={`chart-fill ${cls}`} style={{ width: `${pct}%` }}></div>
                </div>
                <span className="chart-pct">{Math.round(pct)}%</span>
              </div>
            ))}
          </div>

          <div className="post-header">
            <h3>📝 Top 50 Posts</h3>
            <button className="export-btn" onClick={exportCSV}>
              ⬇️ Export CSV
            </button>
          </div>

          <div className="post-list">
            {analyzed.map((post, i) => (
              <div key={i} className={`post-item ${post.sentiment}`}>
                <span className="post-score">⬆ {post.score > 999 ? (post.score / 1000).toFixed(1) + 'k' : post.score}</span>
                <span className="post-title">
                  <a href={post.url} target="_blank" rel="noopener noreferrer">
                    {post.title}
                  </a>
                </span>
                <span className={`post-badge ${post.sentiment}`}>{post.sentiment}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;