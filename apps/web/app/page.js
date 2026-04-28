"use client";

import { useState, useEffect, useCallback } from "react";

const API = "/api";

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function Dashboard() {
  const [page, setPage] = useState("dashboard");
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastReview, setLastReview] = useState(null);
  const [health, setHealth] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, statsRes, configRes, logsRes] = await Promise.all([
        fetch(`${API}/posts`).then((r) => r.json()).catch(() => ({ posts: [] })),
        fetch(`${API}/posts/stats`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/config`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/logs?limit=20`).then((r) => r.json()).catch(() => []),
      ]);
      setPosts(postsRes.posts || []);
      setStats(statsRes);
      setConfig(configRes);
      setLogs(Array.isArray(logsRes) ? logsRes : []);
    } catch (e) {
      console.error("Fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "error" }));
  }, []);

  const generateContent = async () => {
    setGenerating(true);
    setLastReview(null);
    try {
      const res = await fetch(`${API}/generate`, { method: "POST" });
      const data = await res.json();
      setLastReview(data.review);
      await fetchData();
    } catch (e) {
      setLastReview({ error: e.message });
    }
    setGenerating(false);
  };

  const batchGenerate = async () => {
    setGenerating(true);
    try {
      await fetch(`${API}/generate/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const publishPost = async (id) => {
    try {
      await fetch(`${API}/post/${id}`, { method: "POST" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const deletePost = async (id) => {
    if (!confirm("Delete this post?")) return;
    try {
      await fetch(`${API}/posts/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="app">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <nav className="sidebar">
        <h1>⚡ AI Content</h1>
        <div className="subtitle">Automation System</div>

        {health && (
          <div style={{ marginBottom: 24, fontSize: 12 }}>
            <span style={{ color: health.status === "ok" ? "var(--green)" : "var(--red)" }}>●</span>
            {" "}{health.status === "ok" ? "Connected" : "Disconnected"}
          </div>
        )}

        {[
          { id: "dashboard", icon: "📊", label: "Dashboard" },
          { id: "generate", icon: "🤖", label: "Generate" },
          { id: "posts", icon: "📝", label: "All Posts" },
          { id: "config", icon: "⚙️", label: "Config" },
          { id: "reports", icon: "📈", label: "Reports" },
          { id: "logs", icon: "📋", label: "Activity Log" },
        ].map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="main">
        {page === "dashboard" && (
          <DashboardPage
            stats={stats}
            posts={posts}
            generating={generating}
            lastReview={lastReview}
            onGenerate={generateContent}
            onBatchGenerate={batchGenerate}
            onPublish={publishPost}
            onDelete={deletePost}
          />
        )}
        {page === "generate" && (
          <GeneratePage
            generating={generating}
            lastReview={lastReview}
            onGenerate={generateContent}
            onBatchGenerate={batchGenerate}
          />
        )}
        {page === "posts" && (
          <PostsPage posts={posts} onPublish={publishPost} onDelete={deletePost} onRefresh={fetchData} />
        )}
        {page === "config" && <ConfigPage config={config} onSave={fetchData} />}
        {page === "reports" && <ReportsPage />}
        {page === "logs" && <LogsPage logs={logs} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════

function DashboardPage({ stats, posts, generating, lastReview, onGenerate, onBatchGenerate, onPublish, onDelete }) {
  const recentPosts = posts.slice(0, 5);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h2>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Posts</div>
          <div className="stat-value">{stats?.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value green">{stats?.avgScore || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Published</div>
          <div className="stat-value blue">{stats?.byStatus?.posted || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value yellow">{stats?.byStatus?.approved || 0}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Quick Actions</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" onClick={onGenerate} disabled={generating}>
            {generating ? <><span className="spinner" /> Generating...</> : "🤖 Generate Post"}
          </button>
          <button className="btn btn-secondary" onClick={onBatchGenerate} disabled={generating}>
            📦 Batch Generate (5)
          </button>
        </div>

        {lastReview && (
          <div className="review-panel" style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 12, fontSize: 14 }}>Last Review</h4>
            {lastReview.error ? (
              <p style={{ color: "var(--red)" }}>Error: {lastReview.error}</p>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
                  <div className={`score ${lastReview.score >= 80 ? "score-high" : lastReview.score >= 60 ? "score-mid" : "score-low"}`}>
                    {lastReview.score}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{lastReview.passed ? "✅ Approved" : "⚠️ Needs Review"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {lastReview.attempts} attempt(s)
                    </div>
                  </div>
                </div>
                {lastReview.details?.issues?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {lastReview.details.issues.map((issue, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--yellow)", marginBottom: 4 }}>
                        ⚠ {issue}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Posts</span>
        </div>
        {recentPosts.length === 0 ? (
          <p style={{ color: "var(--text-dim)", textAlign: "center", padding: 40 }}>
            No posts yet. Click Generate to create your first post!
          </p>
        ) : (
          recentPosts.map((post) => (
            <PostItem key={post.id} post={post} onPublish={onPublish} onDelete={onDelete} compact />
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GENERATE PAGE
// ═══════════════════════════════════════════════════════════════

function GeneratePage({ generating, lastReview, onGenerate, onBatchGenerate }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Generate Content</h2>

      <div className="card">
        <div className="card-header">
          <span className="card-title">AI Content Generator</span>
        </div>
        <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: 14 }}>
          Generate new social media content using AI. Content goes through a 5-gate review system
          to ensure quality, brand safety, and engagement potential.
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={onGenerate} disabled={generating} style={{ fontSize: 16, padding: "14px 28px" }}>
            {generating ? <><span className="spinner" /> Generating & Reviewing...</> : "🤖 Generate Single Post"}
          </button>
          <button className="btn btn-secondary" onClick={onBatchGenerate} disabled={generating} style={{ fontSize: 16, padding: "14px 28px" }}>
            📦 Batch Generate (5)
          </button>
        </div>

        {/* Review Pipeline Visualization */}
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h4 style={{ marginBottom: 16, fontSize: 14 }}>5-Gate Review Pipeline</h4>
          {[
            { icon: "🛡️", name: "Brand Safety", desc: "Hate speech, misinformation, controversial topics" },
            { icon: "✅", name: "Fact Check", desc: "Verify claims, statistics, and references" },
            { icon: "🎭", name: "Tone Match", desc: "Matches brand voice and personality" },
            { icon: "⭐", name: "Quality Score", desc: "Hook strength, clarity, engagement potential" },
            { icon: "🔍", name: "Uniqueness", desc: "Similarity check against existing posts" },
          ].map((gate, i) => (
            <div key={i} className="review-gate">
              <div className="gate-icon" style={{ background: "var(--bg-card)" }}>{gate.icon}</div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Gate {i + 1}: {gate.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{gate.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lastReview && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Review Results</span>
          </div>
          {lastReview.error ? (
            <p style={{ color: "var(--red)" }}>❌ Error: {lastReview.error}</p>
          ) : (
            <ReviewDetails review={lastReview} />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewDetails({ review }) {
  const details = review.details;
  if (!details) return null;

  return (
    <div>
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 20 }}>
        <div className={`score ${review.score >= 80 ? "score-high" : review.score >= 60 ? "score-mid" : "score-low"}`} style={{ width: 64, height: 64, fontSize: 24 }}>
          {review.score}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{review.passed ? "✅ All Gates Passed" : "⚠️ Review Issues"}</div>
          <div style={{ color: "var(--text-dim)" }}>{review.attempts} generation attempt(s)</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Brand Safety", result: details.brandSafety, pass: details.brandSafety?.passed },
          { label: "Fact Check", result: details.factCheck, pass: details.factCheck?.passed },
          { label: "Tone Match", result: details.toneMatch, pass: details.toneMatch?.score >= 70, score: details.toneMatch?.score },
          { label: "Quality", result: details.quality, pass: details.quality?.score >= 75, score: details.quality?.score },
          { label: "Uniqueness", result: details.uniqueness, pass: details.uniqueness?.passed },
        ].map((gate, i) => (
          <div key={i} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: gate.pass ? "var(--green)" : "var(--red)" }}>{gate.pass ? "✅" : "❌"}</span>
              <span style={{ fontWeight: 500, fontSize: 13 }}>{gate.label}</span>
              {gate.score !== undefined && <span style={{ color: "var(--text-dim)", fontSize: 12 }}>({gate.score}/100)</span>}
            </div>
            {gate.result?.reason && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{gate.result.reason}</div>}
            {gate.result?.feedback && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{gate.result.feedback}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// POSTS PAGE
// ═══════════════════════════════════════════════════════════════

function PostsPage({ posts, onPublish, onDelete, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>All Posts</h2>

      <div className="tabs">
        {["all", "draft", "approved", "posted", "rejected"].map((f) => (
          <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({f === "all" ? posts.length : posts.filter((p) => p.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
          No posts found. Generate some content first!
        </div>
      ) : (
        filtered.map((post) => <PostItem key={post.id} post={post} onPublish={onPublish} onDelete={onDelete} />)
      )}
    </div>
  );
}

function PostItem({ post, onPublish, onDelete, compact }) {
  const scoreClass = post.score >= 80 ? "score-high" : post.score >= 60 ? "score-mid" : "score-low";
  const statusClass = `badge-${post.status}`;

  return (
    <div className="post-item">
      <div className="post-meta">
        <div className={`score ${scoreClass}`}>{post.score}</div>
        <span className={`badge ${statusClass}`}>{post.status}</span>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>📱 {post.platform}</span>
        {post.topic && <span style={{ color: "var(--text-dim)", fontSize: 12 }}>🏷 {post.topic}</span>}
        <span style={{ color: "var(--text-dim)", fontSize: 12, marginLeft: "auto" }}>
          {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="post-content" style={compact ? { maxHeight: 80, overflow: "hidden" } : {}}>
        {post.content}
      </div>

      {post.hashtags?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {post.hashtags.map((tag, i) => (
            <span key={i} style={{ color: "var(--accent)", fontSize: 12, marginRight: 8 }}>{tag}</span>
          ))}
        </div>
      )}

      <div className="post-actions">
        {(post.status === "approved" || post.status === "draft") && (
          <button className="btn btn-primary btn-sm" onClick={() => onPublish(post.id)}>
            🚀 Publish
          </button>
        )}
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(post.id)}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONFIG PAGE
// ═══════════════════════════════════════════════════════════════

function ConfigPage({ config, onSave }) {
  const [form, setForm] = useState({
    niche: "",
    tone: "",
    platforms: [],
    frequency: 3,
    doNotTouch: [],
    brandVoice: "",
    language: "en",
  });
  const [saving, setSaving] = useState(false);
  const [newPlatform, setNewPlatform] = useState("");
  const [newBlocked, setNewBlocked] = useState("");

  useEffect(() => {
    if (config) {
      setForm({
        niche: config.niche || "",
        tone: config.tone || "",
        platforms: config.platforms || [],
        frequency: config.frequency || 3,
        doNotTouch: config.doNotTouch || [],
        brandVoice: config.brandVoice || "",
        language: config.language || "en",
      });
    }
  }, [config]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await onSave();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const addPlatform = () => {
    if (newPlatform && !form.platforms.includes(newPlatform)) {
      setForm({ ...form, platforms: [...form.platforms, newPlatform] });
      setNewPlatform("");
    }
  };

  const removePlatform = (p) => {
    setForm({ ...form, platforms: form.platforms.filter((x) => x !== p) });
  };

  const addBlocked = () => {
    if (newBlocked && !form.doNotTouch.includes(newBlocked)) {
      setForm({ ...form, doNotTouch: [...form.doNotTouch, newBlocked] });
      setNewBlocked("");
    }
  };

  const removeBlocked = (t) => {
    setForm({ ...form, doNotTouch: form.doNotTouch.filter((x) => x !== t) });
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Configuration</h2>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Content Settings</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="input-group">
            <label>Niche / Topic Area</label>
            <input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="e.g., technology, fitness, finance" />
          </div>

          <div className="input-group">
            <label>Tone</label>
            <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="witty">Witty</option>
              <option value="authoritative">Authoritative</option>
              <option value="friendly">Friendly</option>
              <option value="inspirational">Inspirational</option>
              <option value="educational">Educational</option>
            </select>
          </div>

          <div className="input-group">
            <label>Language</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="en">English</option>
              <option value="th">Thai</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>

          <div className="input-group">
            <label>Posts per Day</label>
            <input type="number" min={1} max={10} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: parseInt(e.target.value) || 3 })} />
          </div>
        </div>

        <div className="input-group">
          <label>Brand Voice Description</label>
          <textarea value={form.brandVoice} onChange={(e) => setForm({ ...form, brandVoice: e.target.value })} placeholder="Describe your brand's personality and voice..." />
        </div>

        {/* Platforms */}
        <div className="input-group">
          <label>Platforms</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {form.platforms.map((p) => (
              <span key={p} style={{ background: "var(--accent)", color: "white", padding: "4px 12px", borderRadius: 999, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {p}
                <button onClick={() => removePlatform(p)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
              <option value="">Select platform...</option>
              {["twitter", "facebook", "linkedin", "instagram", "tiktok", "youtube"]
                .filter((p) => !form.platforms.includes(p))
                .map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={addPlatform}>Add</button>
          </div>
        </div>

        {/* Do Not Touch */}
        <div className="input-group">
          <label>Do Not Touch (Topics to Avoid)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {form.doNotTouch.map((t) => (
              <span key={t} style={{ background: "var(--red)", color: "white", padding: "4px 12px", borderRadius: 999, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {t}
                <button onClick={() => removeBlocked(t)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newBlocked} onChange={(e) => setNewBlocked(e.target.value)} placeholder="Add topic to avoid..." onKeyDown={(e) => e.key === "Enter" && addBlocked()} />
            <button className="btn btn-secondary btn-sm" onClick={addBlocked}>Add</button>
          </div>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? "Saving..." : "💾 Save Configuration"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════════

function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports/weekly`);
      const data = await res.json();
      setReport(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, []);

  if (loading) return <div className="card" style={{ textAlign: "center", padding: 60 }}><span className="spinner" /> Loading report...</div>;

  if (!report) return <div className="card" style={{ textAlign: "center", padding: 60 }}>No report data available.</div>;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Weekly Report</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Posts This Week</div>
          <div className="stat-value">{report.stats?.totalPosts || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value green">{report.stats?.avgScore || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Published</div>
          <div className="stat-value blue">{report.stats?.byStatus?.posted || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Queue</div>
          <div className="stat-value yellow">{report.stats?.byStatus?.approved || 0}</div>
        </div>
      </div>

      {report.bestPost && (
        <div className="card">
          <div className="card-header"><span className="card-title">🏆 Best Post</span></div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <div className="score score-high" style={{ width: 48, height: 48, fontSize: 18 }}>{report.bestPost.score}</div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{report.bestPost.content}</p>
        </div>
      )}

      {report.worstPost && (
        <div className="card">
          <div className="card-header"><span className="card-title">📉 Lowest Performing</span></div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <div className="score score-low" style={{ width: 48, height: 48, fontSize: 18 }}>{report.worstPost.score}</div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{report.worstPost.content}</p>
        </div>
      )}

      {report.analysis && (
        <div className="card">
          <div className="card-header"><span className="card-title">💡 AI Analysis & Recommendations</span></div>

          {report.analysis.summary && (
            <p style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>{report.analysis.summary}</p>
          )}

          {report.analysis.bestPatterns?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, color: "var(--green)", marginBottom: 8 }}>✅ What Worked</h4>
              {report.analysis.bestPatterns.map((p, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4, paddingLeft: 12 }}>• {p}</div>
              ))}
            </div>
          )}

          {report.analysis.worstPatterns?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, color: "var(--red)", marginBottom: 8 }}>❌ What Didn't Work</h4>
              {report.analysis.worstPatterns.map((p, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4, paddingLeft: 12 }}>• {p}</div>
              ))}
            </div>
          )}

          {report.analysis.recommendations?.length > 0 && (
            <div>
              <h4 style={{ fontSize: 13, color: "var(--accent)", marginBottom: 8 }}>💡 Recommendations</h4>
              {report.analysis.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4, paddingLeft: 12 }}>→ {r}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="btn btn-secondary" onClick={fetchReport} style={{ marginTop: 8 }}>
        🔄 Refresh Report
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGS PAGE
// ═══════════════════════════════════════════════════════════════

function LogsPage({ logs }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Activity Log</h2>

      <div className="card">
        {logs.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>No activity yet.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-item">
              <span className="log-time">
                {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="log-action">{log.action}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
