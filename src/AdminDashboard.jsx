import React, { useState, useEffect, useRef, useCallback } from 'react';

// ===== ADMIN DASHBOARD COMPONENT =====
// Self-contained component with sidebar navigation and all dashboard views
// Rendered when user.role === 'admin' in App.jsx

export default function AdminDashboard({ supabase, user, org, onLogout }) {
  const [activeView, setActiveView] = useState('overview');
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetail, setCandidateDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [expandedInterview, setExpandedInterview] = useState(null);
  const [expandedAnswer, setExpandedAnswer] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    name: org?.name || '',
    admin_email: org?.admin_email || '',
    slug: org?.slug || '',
    pass_threshold: org?.pass_threshold || 70
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/get-org-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, accessToken: token, period })
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [org?.id, period]);

  // Fetch candidates
  const fetchCandidates = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/get-org-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, accessToken: token })
      });
      const data = await res.json();
      if (res.ok) setCandidates(data.candidates || []);
    } catch (e) {
      console.error('Failed to fetch candidates:', e);
    }
  }, [org?.id]);

  // Fetch candidate detail
  const fetchCandidateDetail = async (candidateId) => {
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/get-candidate-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, accessToken: token, candidateId })
      });
      const data = await res.json();
      if (res.ok) setCandidateDetail(data.candidate);
    } catch (e) {
      console.error('Failed to fetch candidate detail:', e);
    }
  };

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchCandidates()]);
      setLoading(false);
    };
    if (org?.id) load();
  }, [org?.id, fetchStats, fetchCandidates]);

  // Refetch stats when period changes
  useEffect(() => { if (org?.id) fetchStats(); }, [period, fetchStats]);

  // Navigate to individual candidate
  const viewCandidate = async (candidateId) => {
    setSelectedCandidate(candidateId);
    setCandidateDetail(null);
    setActiveView('individual');
    setExpandedInterview(null);
    setExpandedAnswer(null);
    await fetchCandidateDetail(candidateId);
  };

  // Copy magic link
  const copyMagicLink = () => {
    const link = `${window.location.origin}/join/${org.slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Save settings
  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/update-org-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, accessToken: token, updates: settingsForm })
      });
      const data = await res.json();
      if (res.ok) {
        setSettingsMsg('Settings saved successfully');
        setTimeout(() => setSettingsMsg(''), 3000);
      } else {
        setSettingsMsg(data.error || 'Failed to save');
      }
    } catch (e) {
      setSettingsMsg('Failed to save settings');
    }
    setSettingsSaving(false);
  };

  // ===== HELPERS =====
  const getScoreColor = (score) => {
    if (score == null) return C.textMuted;
    if (score >= 80) return '#059669';
    if (score >= 70) return C.green;
    if (score >= 50) return C.amber;
    return C.red;
  };

  const getTierBadge = (tier, tierLabel) => {
    const colors = {
      strong: { bg: 'rgba(5,150,105,0.15)', color: '#34d399', dot: '#059669' },
      ready: { bg: C.greenBg, color: C.greenLight, dot: C.green },
      practice: { bg: C.amberBg, color: C.amber, dot: C.amber },
      'not-ready': { bg: C.redBg, color: C.red, dot: C.red }
    };
    const c = colors[tier] || colors['not-ready'];
    return (
      <span style={{ ...S.tierBadge, background: c.bg, color: c.color }}>
        <span style={{ ...S.tierDot, background: c.dot }}></span>
        {tierLabel}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const categoryLabels = {
    clarity: 'Clarity', relevance: 'Relevance', depth: 'Depth',
    confidence: 'Confidence', conciseness: 'Conciseness',
    starMethod: 'STAR Method', technicalAccuracy: 'Technical Accuracy',
    enthusiasm: 'Enthusiasm'
  };

  const videoLabels = {
    eyeContact: 'Eye Contact', posture: 'Posture', facialExpression: 'Expression',
    framing: 'Framing', background: 'Background', overallPresence: 'Presence'
  };

  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Filter candidates
  const filteredCandidates = candidates
    .filter(c => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (c.name || '').toLowerCase().includes(q) ||
               (c.email || '').toLowerCase().includes(q) ||
               (c.jobTitle || '').toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => (b.latestScore || 0) - (a.latestScore || 0));

  const tierCounts = {
    all: candidates.length,
    strong: candidates.filter(c => c.tier === 'strong').length,
    ready: candidates.filter(c => c.tier === 'ready').length,
    practice: candidates.filter(c => c.tier === 'practice').length,
    'not-ready': candidates.filter(c => c.tier === 'not-ready').length
  };

  // ===== SVG MINI CHART =====
  const MiniLineChart = ({ data, width = 500, height = 200, color = C.green, showDots = true, label = '' }) => {
    if (!data || data.length < 2) return <div style={{ color: C.textMuted, fontSize: 13, padding: 20 }}>Not enough data for chart</div>;
    const max = Math.max(...data.map(d => d.value), 100);
    const min = Math.min(...data.map(d => d.value), 0);
    const range = max - min || 1;
    const pad = 20;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const points = data.map((d, i) => ({
      x: pad + (i / (data.length - 1)) * w,
      y: pad + h - ((d.value - min) / range) * h
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = pathD + ` L ${points[points.length-1].x} ${pad + h} L ${points[0].x} ${pad + h} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => {
          const y = pad + h - ((v - min) / range) * h;
          return <g key={v}><line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" /><text x={pad - 5} y={y + 4} fill={C.textMuted} fontSize="10" textAnchor="end">{v}</text></g>;
        })}
        {/* Area fill */}
        <path d={areaD} fill={color} opacity="0.08" />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
        ))}
        {/* X labels */}
        {data.map((d, i) => (
          <text key={i} x={points[i].x} y={height - 2} fill={C.textMuted} fontSize="10" textAnchor="middle">{d.label}</text>
        ))}
        {/* Pass threshold line at 70 */}
        {(() => {
          const y70 = pad + h - ((70 - min) / range) * h;
          return <line x1={pad} y1={y70} x2={width - pad} y2={y70} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="6,4" />;
        })()}
      </svg>
    );
  };

  // ===== SCORE RING SVG =====
  const ScoreRing = ({ score, size = 160, strokeWidth = 12 }) => {
    const radius = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * radius;
    const progress = (score / 100) * circ;
    const color = getScoreColor(score);
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={circ - progress} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
    );
  };

  // ===== CATEGORY BAR =====
  const CategoryBar = ({ label, score }) => {
    const color = getScoreColor(score);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 130, fontSize: 13, color: C.textSecondary, flexShrink: 0 }}>{label}</div>
        <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 6, transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ width: 36, fontSize: 14, fontWeight: 700, textAlign: 'right', color, flexShrink: 0 }}>{score}</div>
      </div>
    );
  };

  // ===== VIDEO ITEM =====
  const VideoItem = ({ label, score }) => {
    const color = getScoreColor(score);
    return (
      <div style={S.videoItem}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>{label}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color }}>{score ?? '—'}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score || 0}%`, background: color, borderRadius: 2 }} />
        </div>
      </div>
    );
  };

  // ===== SIDEBAR =====
  const Sidebar = () => (
    <div style={S.sidebar}>
      <div style={S.sidebarLogo}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: 0 }}>AceMyInterviews</h1>
        <span style={{ fontSize: 12, color: C.textMuted, display: 'block', marginTop: 2 }}>Admin Dashboard</span>
      </div>
      <div style={S.sidebarOrg}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{org?.name || 'Organization'}</div>
        <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>
          {org?.is_active ? 'Active' : 'Inactive'} — {org?.candidate_limit || 0} candidates
        </div>
      </div>
      <div style={S.navSection}>Dashboard</div>
      <NavItem icon="grid" label="Overview" view="overview" />
      <NavItem icon="users" label="Candidates" view="candidates" />
      <div style={{ ...S.navSection, marginTop: 20 }}>Analysis</div>
      <NavItem icon="chart" label="Skill Breakdown" view="categories" />
      <NavItem icon="video" label="Video Analysis" view="video" />
      <div style={{ ...S.navSection, marginTop: 20 }}>Manage</div>
      <NavItem icon="invite" label="Invite Candidates" view="invite" />
      <NavItem icon="settings" label="Settings" view="settings" />
      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, padding: '0 12px' }}>
        <div onClick={onLogout} style={{ ...S.navItem, color: C.red, cursor: 'pointer' }}>
          <NavIcon type="logout" />
          Sign Out
        </div>
      </div>
    </div>
  );

  const NavItem = ({ icon, label, view }) => (
    <div
      onClick={() => { setActiveView(view); if (view !== 'individual') { setSelectedCandidate(null); setCandidateDetail(null); } }}
      style={{ ...S.navItem, ...(activeView === view ? S.navItemActive : {}) }}
    >
      <NavIcon type={icon} />
      {label}
    </div>
  );

  const NavIcon = ({ type }) => {
    const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
    const icons = {
      grid: <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
      users: <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      chart: <svg {...props}><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
      video: <svg {...props}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
      invite: <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
      settings: <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
      logout: <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
      back: <svg {...props}><polyline points="15 18 9 12 15 6"/></svg>,
    };
    return icons[type] || null;
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bgPrimary, color: C.textPrimary }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Loading Dashboard...</div>
          <div style={{ color: C.textMuted }}>Fetching your organization data</div>
        </div>
      </div>
    );
  }

  // ===== VIEWS =====

  // --- OVERVIEW ---
  const OverviewView = () => {
    const s = stats;
    if (!s) return <div style={{ color: C.textMuted, padding: 40 }}>Loading stats...</div>;

    const sortedCategories = Object.entries(s.categoryAverages || {})
      .map(([key, score]) => ({ key, name: categoryLabels[key] || key, score }))
      .sort((a, b) => a.score - b.score);

    const r = s.readiness || {};
    const rTotal = (r.notReady || 0) + (r.needsPractice || 0) + (r.interviewReady || 0) + (r.strong || 0);

    return (
      <div>
        <div style={S.pageHeader}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Cohort Overview</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {['7d', '30d', 'semester', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ ...S.dateBtn, ...(period === p ? S.dateBtnActive : {}) }}>
                {p === '7d' ? '7 days' : p === '30d' ? '30 days' : p === 'semester' ? 'This semester' : 'All time'}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Row */}
        <div style={S.heroRow}>
          {/* Score Ring */}
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={S.cardTitle}>Cohort Average</div>
            <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 12 }}>
              <ScoreRing score={s.avgScore} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <div style={{ fontSize: 42, fontWeight: 800, color: getScoreColor(s.avgScore) }}>{s.avgScore}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: -4 }}>/100</div>
              </div>
            </div>
            {s.avgImprovement !== 0 && (
              <div style={{ ...S.scoreDelta, background: s.avgImprovement > 0 ? C.greenBg : C.redBg, color: s.avgImprovement > 0 ? C.greenLight : C.red }}>
                {s.avgImprovement > 0 ? '▲' : '▼'} {s.avgImprovement > 0 ? '+' : ''}{s.avgImprovement} avg improvement
              </div>
            )}
          </div>

          {/* Practice Impact Chart */}
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ ...S.cardTitle, marginBottom: 0 }}>Practice Impact — Score by Attempt</div>
            </div>
            <div style={{ flex: 1, minHeight: 180 }}>
              <MiniLineChart data={(s.impactSeries || []).map(t => ({ value: t.avgScore, label: `#${t.interview} (${t.count})` }))} color={C.green} />
            </div>
            {(s.impactSeries || []).length >= 2 && (() => {
              const first = s.impactSeries[0].avgScore;
              const last = s.impactSeries[s.impactSeries.length - 1].avgScore;
              const diff = last - first;
              return diff > 0 ? (
                <div style={{ ...S.scoreDelta, background: C.greenBg, color: C.greenLight, marginTop: 8 }}>
                  +{diff} avg improvement by {ordinal(s.impactSeries.length)} interview — Candidates score {Math.round((diff/first)*100)}% higher after {s.impactSeries.length - 1 === 1 ? 'just one additional practice session' : `just ${s.impactSeries.length - 1} additional practice sessions`}
                </div>
              ) : null;
            })()}
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={S.card}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Pass Rate</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{s.passRate}%</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{s.passCount} of {s.totalCandidates} candidates</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Total Interviews</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>{s.totalInterviews}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Avg {s.avgInterviewsPerCandidate} per candidate</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Avg Improvement</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.avgImprovement > 0 ? C.green : C.textPrimary }}>
                {s.avgImprovement > 0 ? '+' : ''}{s.avgImprovement}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Between 1st and latest</div>
            </div>
          </div>
        </div>

        {/* Readiness */}
        {rTotal > 0 && (
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={S.cardTitle}>Interview Readiness Distribution</div>
            <div style={{ display: 'flex', height: 40, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {r.notReady > 0 && <div style={{ ...S.readinessSegment, background: C.red, width: `${(r.notReady/rTotal)*100}%` }}>{Math.round((r.notReady/rTotal)*100)}%</div>}
              {r.needsPractice > 0 && <div style={{ ...S.readinessSegment, background: C.amber, width: `${(r.needsPractice/rTotal)*100}%` }}>{Math.round((r.needsPractice/rTotal)*100)}%</div>}
              {r.interviewReady > 0 && <div style={{ ...S.readinessSegment, background: C.green, width: `${(r.interviewReady/rTotal)*100}%` }}>{Math.round((r.interviewReady/rTotal)*100)}%</div>}
              {r.strong > 0 && <div style={{ ...S.readinessSegment, background: '#059669', width: `${(r.strong/rTotal)*100}%` }}>{Math.round((r.strong/rTotal)*100)}%</div>}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <LegendItem color={C.red} label="Not Ready (0-49)" count={r.notReady} />
              <LegendItem color={C.amber} label="Needs Practice (50-69)" count={r.needsPractice} />
              <LegendItem color={C.green} label="Interview Ready (70-79)" count={r.interviewReady} />
              <LegendItem color="#059669" label="Strong (80+)" count={r.strong} />
            </div>
          </div>
        )}

        {/* Bottom Grid */}
        <div style={S.bottomGrid}>
          <div style={S.card}>
            <div style={S.cardTitle}>Skill Breakdown (Cohort Average)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedCategories.map(c => <CategoryBar key={c.key} label={c.name} score={c.score} />)}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Video Presence (Cohort Average)</div>
            {s.avgVideoScore != null && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: getScoreColor(s.avgVideoScore) }}>{s.avgVideoScore}</span>
                <span style={{ fontSize: 14, color: C.textMuted }}>/100</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(s.videoAverages || {}).map(([key, score]) => (
                <VideoItem key={key} label={videoLabels[key] || key} score={score} />
              ))}
            </div>
            {Object.keys(s.videoAverages || {}).length === 0 && (
              <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>No video data yet</div>
            )}
          </div>
        </div>

        {/* Recent Activity Table */}
        <div style={S.card}>
          <div style={S.cardTitle}>Recent Activity</div>
          <CandidateTable candidates={candidates.slice(0, 8)} compact />
        </div>
      </div>
    );
  };

  // --- CANDIDATES VIEW ---
  const CandidatesView = () => (
    <div>
      <div style={S.pageHeader}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>All Candidates</h2>
        <input type="text" placeholder="Search candidates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={S.searchBox} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${tierCounts.all})` },
          { key: 'strong', label: `Strong (${tierCounts.strong})` },
          { key: 'ready', label: `Interview Ready (${tierCounts.ready})` },
          { key: 'practice', label: `Needs Practice (${tierCounts.practice})` },
          { key: 'not-ready', label: `Not Ready (${tierCounts['not-ready']})` }
        ].map(f => (
          <button key={f.key} onClick={() => setTierFilter(f.key)} style={{ ...S.filterBtn, ...(tierFilter === f.key ? S.filterBtnActive : {}) }}>
            {f.label}
          </button>
        ))}
      </div>
      <div style={S.card}>
        <CandidateTable candidates={filteredCandidates} full />
      </div>
    </div>
  );

  // --- CANDIDATE TABLE (reusable) ---
  const CandidateTable = ({ candidates: cands, compact, full }) => (
    <table style={S.dataTable}>
      <thead>
        <tr>
          <th style={S.th}>Candidate</th>
          <th style={S.th}>Latest Score</th>
          {full && <th style={S.th}>Video Score</th>}
          <th style={S.th}>Interviews</th>
          <th style={S.th}>Readiness</th>
          {full && <th style={S.th}>Last Active</th>}
          <th style={S.th}>Trend</th>
        </tr>
      </thead>
      <tbody>
        {cands.length === 0 && (
          <tr><td colSpan={full ? 7 : 5} style={{ ...S.td, textAlign: 'center', color: C.textMuted, padding: 40 }}>No candidates yet. Share your invite link to get started.</td></tr>
        )}
        {cands.map(c => (
          <tr key={c.id} onClick={() => viewCandidate(c.id)} style={{ cursor: 'pointer' }}>
            <td style={S.td}>
              <div style={{ fontWeight: 500, color: C.textPrimary }}>{c.name || c.email || 'Anonymous'}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{c.jobTitle || '—'}</div>
            </td>
            <td style={{ ...S.td, fontWeight: 700, color: getScoreColor(c.latestScore) }}>{c.latestScore ?? '—'}</td>
            {full && <td style={{ ...S.td, fontWeight: 600, color: getScoreColor(c.latestVideoScore) }}>{c.latestVideoScore ?? '—'}</td>}
            <td style={S.td}>{c.interviewCount}</td>
            <td style={S.td}>{c.interviewCount > 0 ? getTierBadge(c.tier, c.tierLabel) : <span style={{ color: C.textMuted }}>—</span>}</td>
            {full && <td style={{ ...S.td, color: C.textMuted }}>{formatShortDate(c.lastActive)}</td>}
            <td style={S.td}>
              {c.delta}{' '}
              {c.trend === 'up' && <span style={{ color: C.greenLight, fontSize: 12 }}>▲</span>}
              {c.trend === 'down' && <span style={{ color: C.red, fontSize: 12 }}>▼</span>}
              {c.trend === 'flat' && <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // --- SKILL BREAKDOWN ---
  const CategoriesView = () => {
    const sortedCategories = Object.entries(stats?.categoryAverages || {})
      .map(([key, score]) => ({ key, name: categoryLabels[key] || key, score }))
      .sort((a, b) => a.score - b.score);

    const weakAreas = sortedCategories.filter(c => c.score < 60).slice(0, 2);

    return (
      <div>
        <div style={S.pageHeader}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Skill Breakdown</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {['30d', 'semester', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ ...S.dateBtn, ...(period === p ? S.dateBtnActive : {}) }}>
                {p === '30d' ? '30 days' : p === 'semester' ? 'This semester' : 'All time'}
              </button>
            ))}
          </div>
        </div>
        <div style={S.bottomGrid}>
          <div style={S.card}>
            <div style={S.cardTitle}>Cohort Average by Category</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedCategories.map(c => <CategoryBar key={c.key} label={c.name} score={c.score} />)}
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Practice Impact by Interview Number</div>
            <div style={{ height: 300 }}>
              <MiniLineChart
                data={(stats?.impactSeries || []).map(t => ({ value: t.avgScore, label: `#${t.interview}` }))}
                color={C.green}
              />
            </div>
          </div>
        </div>
        {weakAreas.length > 0 && (
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={{ ...S.cardTitle, color: C.amber }}>Areas Needing Attention</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {weakAreas.map(area => (
                <div key={area.key} style={{ padding: 16, borderRadius: 8, background: C.amberBg, border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.amber, marginBottom: 6 }}>{area.name} — {area.score} avg</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                    This is one of the lowest-scoring categories across your cohort. Consider targeted practice sessions to help candidates improve in this area.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- VIDEO ANALYSIS ---
  const VideoView = () => {
    const va = stats?.videoAverages || {};
    const avgVideo = stats?.avgVideoScore;
    const sortedVideo = Object.entries(va)
      .map(([key, score]) => ({ key, name: videoLabels[key] || key, score }))
      .sort((a, b) => a.score - b.score);

    const worst = sortedVideo[0];

    return (
      <div>
        <div style={S.pageHeader}><h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Video Presence Analysis</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={S.cardTitle}>Cohort Video Score</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: getScoreColor(avgVideo), margin: '16px 0' }}>{avgVideo ?? '—'}</div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Video Score Distribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 8 }}>
              {sortedVideo.map(v => (
                <VideoItem key={v.key} label={v.name} score={v.score} />
              ))}
            </div>
            {sortedVideo.length === 0 && (
              <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>No video data yet — candidates need to complete interviews with video enabled</div>
            )}
          </div>
        </div>
        {worst && worst.score < 50 && (
          <div style={S.card}>
            <div style={{ ...S.cardTitle, color: C.red }}>Critical: {worst.name}</div>
            <div style={{ padding: 16, borderRadius: 8, background: C.redBg, border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6 }}>
                {worst.name} is the lowest-scoring video category for your cohort at {worst.score}/100. Recommend a workshop focused on improving this area to help candidates present more professionally in video interviews.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- INDIVIDUAL CANDIDATE ---
  const IndividualView = () => {
    const c = candidateDetail;
    if (!c) return <div style={{ color: C.textMuted, padding: 40 }}>Loading candidate details...</div>;

    const progressChartData = (c.progressData || []).map(p => ({
      value: p.overallScore,
      label: `#${p.interviewNumber}`
    }));

    const latestCats = Object.entries(c.latestCategories || {})
      .map(([key, val]) => ({ key, name: categoryLabels[key] || key, score: typeof val === 'object' ? val.score : val }))
      .sort((a, b) => a.score - b.score);

    return (
      <div>
        <div onClick={() => { setActiveView('candidates'); setSelectedCandidate(null); setCandidateDetail(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          <NavIcon type="back" /> Back to Candidates
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{c.name || 'Anonymous'}</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              {c.latestJobTitle || 'No role specified'} • {c.interviewCount} interviews completed • Last active: {formatDate(c.lastActive)}
            </div>
          </div>
          {getTierBadge(c.tier, c.tierLabel)}
        </div>

        {/* Score Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <ScoreCard value={c.latestScore} label="Overall Score" color={getScoreColor(c.latestScore)} />
          <ScoreCard value={c.latestVideoScore} label="Video Score" color={getScoreColor(c.latestVideoScore)} />
          <ScoreCard value={c.improvement > 0 ? `+${c.improvement}` : c.improvement} label="Improvement" color={c.improvement > 0 ? C.green : C.textPrimary} />
          <ScoreCard value={c.interviewCount} label="Interviews" color={C.textPrimary} />
        </div>

        {/* Progress + Coaching */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={S.card}>
            <div style={S.cardTitle}>Score Progress</div>
            <div style={{ height: 220 }}>
              <MiniLineChart data={progressChartData} color={C.green} />
            </div>
          </div>
          <div style={{ ...S.card, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }}>
            <div style={{ ...S.cardTitle, color: C.green }}>Coaching Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.coaching?.topStrengths?.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 4 }}>STRENGTHS</div>
                  {c.coaching.topStrengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                      <span style={{ color: C.green, flexShrink: 0 }}>✓</span><span>{s}</span>
                    </div>
                  ))}
                </>
              )}
              {c.coaching?.criticalImprovements?.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, margin: '12px 0 4px' }}>IMPROVE</div>
                  {c.coaching.criticalImprovements.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                      <span style={{ color: C.amber, flexShrink: 0 }}>!</span><span>{s}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.cardTitle}>Category Scores (Latest Interview)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {latestCats.map(c => <CategoryBar key={c.key} label={c.name} score={c.score} />)}
          </div>
        </div>

        {/* Video Analysis (Latest Interview) */}
        {(() => {
          const latestInterview = (c.interviewHistory || [])[0];
          const va = latestInterview?.videoAnalysis;
          if (!va) return null;
          const videoEntries = Object.entries(va)
            .filter(([key]) => ['eyeContact', 'posture', 'facialExpression', 'framing', 'background', 'overallPresence'].includes(key))
            .map(([key, val]) => ({ key, name: videoLabels[key] || key, score: val?.score, feedback: val?.feedback }))
            .filter(v => v.score != null);
          if (videoEntries.length === 0) return null;
          return (
            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={S.cardTitle}>Video Presence (Latest Interview)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {videoEntries.map(v => (
                  <div key={v.key} style={S.videoItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: C.textSecondary }}>{v.name}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: getScoreColor(v.score) }}>{v.score}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${v.score}%`, background: getScoreColor(v.score) }} />
                    </div>
                    {v.feedback && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.4 }}>{v.feedback}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Interview History */}
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={S.cardTitle}>Interview History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(c.interviewHistory || []).map((interview, idx) => (
              <div key={interview.id || idx}>
                <div
                  onClick={() => setExpandedInterview(expandedInterview === idx ? null : idx)}
                  style={S.interviewRow}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={S.interviewNum}>{interview.interviewNumber}</div>
                    <div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>{formatDate(interview.date)}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{interview.jobTitle || 'Practice Interview'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(interview.overallScore) }}>{interview.overallScore}</span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: interview.passed ? C.greenBg : C.redBg, color: interview.passed ? C.greenLight : C.red }}>
                      {interview.passed ? 'PASSED' : 'FAILED'}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>{expandedInterview === idx ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Question Detail */}
                {expandedInterview === idx && (
                  <div style={{ paddingLeft: 40 }}>
                    {(interview.questionScores || []).map((q, qi) => (
                      <div key={qi} style={{ ...S.card, margin: '4px 0', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Q{q.questionNum || qi + 1}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(q.score) }}>{q.score}/100</span>
                        </div>
                        {/* Question text from Q&A data */}
                        {interview.questionsAndAnswers?.[qi]?.question && (
                          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>
                            {interview.questionsAndAnswers[qi].question}
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>{q.feedback}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(q.strengths || []).map((s, si) => (
                            <span key={si} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: C.greenBg, color: C.greenLight }}>{s}</span>
                          ))}
                          {(q.improvements || []).map((s, si) => (
                            <span key={si} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: C.amberBg, color: C.amber }}>{s}</span>
                          ))}
                        </div>
                        {/* View Full Response (Tier 4) */}
                        {interview.questionsAndAnswers?.[qi]?.answer && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedAnswer(expandedAnswer === `${idx}-${qi}` ? null : `${idx}-${qi}`); }}
                              style={S.answerToggle}
                            >
                              👁 View Full Response
                            </button>
                            {expandedAnswer === `${idx}-${qi}` && (
                              <div style={S.answerBox}>
                                "{interview.questionsAndAnswers[qi].answer}"
                              </div>
                            )}
                          </>
                        )}

                        {/* Follow-Up Question */}
                        {q.followUp && q.followUp.score != null && (() => {
                          const fu = q.followUp;
                          const fuQA = (interview.questionsAndAnswers || []).find(
                            qa => qa.isFollowUp && qa.parentQuestionIndex === qi
                          );
                          return (
                            <div style={{ marginTop: 12, marginLeft: 20, padding: 14, borderRadius: 8, borderLeft: `3px solid ${C.amber}`, background: 'rgba(245,158,11,0.04)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>↳ Follow-Up</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(fu.score) }}>{fu.score}/100</span>
                              </div>
                              {fuQA?.question && (
                                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>
                                  {fuQA.question}
                                </div>
                              )}
                              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 8 }}>{fu.feedback}</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {(fu.strengths || []).map((s, si) => (
                                  <span key={si} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: C.greenBg, color: C.greenLight }}>{s}</span>
                                ))}
                                {(fu.improvements || []).map((s, si) => (
                                  <span key={si} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: C.amberBg, color: C.amber }}>{s}</span>
                                ))}
                              </div>
                              {fuQA?.answer && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedAnswer(expandedAnswer === `${idx}-fu-${qi}` ? null : `${idx}-fu-${qi}`); }}
                                    style={S.answerToggle}
                                  >
                                    👁 View Full Response
                                  </button>
                                  {expandedAnswer === `${idx}-fu-${qi}` && (
                                    <div style={S.answerBox}>
                                      "{fuQA.answer}"
                                    </div>
                                  )}
                                </>
                              )}
                              {q.combinedScore != null && (
                                <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>
                                  Combined score: <span style={{ fontWeight: 600, color: getScoreColor(Math.round(q.combinedScore)) }}>{Math.round(q.combinedScore)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(c.interviewHistory || []).length === 0 && (
              <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>No interviews completed yet</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ScoreCard = ({ value, label, color }) => (
    <div style={{ padding: 18, borderRadius: 10, border: `1px solid ${C.border}`, textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: color || C.textPrimary }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
    </div>
  );

  // --- INVITE CANDIDATES ---
  const InviteView = () => {
    const recentCandidates = candidates
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
      .slice(0, 20);

    return (
      <div>
        <div style={S.pageHeader}><h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Invite Candidates</h2></div>

        {/* Seat Usage */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{candidates.length}</span>
            <span style={{ fontSize: 14, color: C.textMuted }}> / {org?.candidate_limit || '∞'} seats used</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 200, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${org?.candidate_limit ? (candidates.length / org.candidate_limit) * 100 : 0}%`, background: C.green, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, color: C.textMuted }}>{org?.candidate_limit ? org.candidate_limit - candidates.length : '∞'} seats remaining</span>
          </div>
        </div>

        {/* Two columns: Magic Link + Email (coming soon) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Magic Link */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>🔗</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Magic Link</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.greenBg, padding: '2px 8px', borderRadius: 10 }}>Recommended</span>
            </div>
            <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16, marginTop: 8 }}>
              Share this unique URL with your candidates. Anyone who signs up through this link will automatically be added to your organization.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input type="text" readOnly value={`${window.location.origin}/join/${org?.slug || ''}`}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgPrimary, color: C.textPrimary, fontSize: 13 }} />
              <button onClick={copyMagicLink} style={{ ...S.dateBtn, ...(copiedLink ? { background: C.green, borderColor: C.green, color: '#fff' } : { background: C.green, borderColor: C.green, color: '#fff' }) }}>
                {copiedLink ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <div style={{ padding: 14, borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.green, marginBottom: 8 }}>How it works</div>
              <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.8 }}>
                1. Copy the link above<br/>
                2. Share via email, LMS, Slack, or any channel<br/>
                3. Candidates sign up and are auto-tagged to your org<br/>
                4. They appear in your dashboard immediately
              </div>
            </div>
          </div>

          {/* Email Invite — Coming Soon */}
          <div style={{ ...S.card, opacity: 0.5, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberBg, padding: '3px 10px', borderRadius: 10 }}>Coming Soon</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>✉️</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Email Invite</span>
            </div>
            <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16, marginTop: 8 }}>
              Send branded invitation emails directly to candidates. They'll receive a personalized invite from {org?.name || 'your organization'}.
            </p>
            <input type="text" disabled placeholder="Enter email address..." style={{ ...S.searchBox, width: '100%', opacity: 0.5, marginBottom: 8 }} />
            <textarea disabled placeholder="Or paste multiple emails (one per line or comma-separated)..." rows={3}
              style={{ width: '100%', padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgPrimary, color: C.textMuted, fontSize: 13, resize: 'none', opacity: 0.5 }} />
          </div>
        </div>

        {/* Recently Joined */}
        <div style={S.card}>
          <div style={S.cardTitle}>Recently Joined</div>
          <table style={S.dataTable}>
            <thead>
              <tr>
                <th style={S.th}>Name</th>
                <th style={S.th}>Joined</th>
                <th style={S.th}>Interviews</th>
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCandidates.length === 0 && (
                <tr><td colSpan={4} style={{ ...S.td, textAlign: 'center', color: C.textMuted, padding: 40 }}>No candidates have joined yet. Share your magic link to get started.</td></tr>
              )}
              {recentCandidates.map(c => (
                <tr key={c.id} onClick={() => viewCandidate(c.id)} style={{ cursor: 'pointer' }}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 500, color: C.textPrimary }}>{c.name || c.email || 'Anonymous'}</div>
                  </td>
                  <td style={{ ...S.td, color: C.textMuted }}>{formatDate(c.joinedAt)}</td>
                  <td style={S.td}>{c.interviewCount}</td>
                  <td style={S.td}>
                    {c.interviewCount > 0
                      ? <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>Active</span>
                      : <span style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>Joined — No interviews yet</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- SETTINGS ---
  const SettingsView = () => (
    <div>
      <div style={S.pageHeader}><h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Settings</h2></div>

      {/* Organization Profile */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16 }}>🏠</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Organization Profile</span>
        </div>
        <SettingsRow label="Organization Name">
          <input type="text" value={settingsForm.name} onChange={e => setSettingsForm({ ...settingsForm, name: e.target.value })} style={S.settingsInput} />
        </SettingsRow>
        <SettingsRow label="Admin Email">
          <input type="email" value={settingsForm.admin_email} onChange={e => setSettingsForm({ ...settingsForm, admin_email: e.target.value })} style={S.settingsInput} />
        </SettingsRow>
        <SettingsRow label="Organization Slug" sub="Used in your magic link URL">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{window.location.host}/join/</span>
            <input type="text" value={settingsForm.slug} onChange={e => setSettingsForm({ ...settingsForm, slug: e.target.value })} style={{ ...S.settingsInput, width: 200 }} />
          </div>
        </SettingsRow>
        <SettingsRow label="Logo" sub="Displayed on candidate invite emails">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {(org?.name || 'O')[0]}
            </div>
            <button style={{ ...S.dateBtn, opacity: 0.5, cursor: 'not-allowed' }}>Upload Logo</button>
            <span style={{ fontSize: 11, color: C.amber }}>Coming Soon</span>
          </div>
        </SettingsRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
          {settingsMsg && <span style={{ fontSize: 13, color: settingsMsg.includes('success') ? C.green : C.red }}>{settingsMsg}</span>}
          <button onClick={saveSettings} disabled={settingsSaving} style={{ ...S.dateBtn, background: C.green, borderColor: C.green, color: '#fff', opacity: settingsSaving ? 0.6 : 1 }}>
            {settingsSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Subscription & Billing */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16 }}>💳</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Subscription & Billing</span>
        </div>
        <SettingsRow label="Current Plan">
          <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{org?.plan_name || 'Institutional'} — {org?.candidate_limit || 0} seats</span>
        </SettingsRow>
        <SettingsRow label="Subscription Status">
          <span style={{ fontSize: 14, fontWeight: 600, color: org?.is_active ? C.green : C.red }}>{org?.subscription_status || 'Active'}</span>
        </SettingsRow>
        <SettingsRow label="Seats Used">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{candidates.length} / {org?.candidate_limit || '∞'}</span>
            <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${org?.candidate_limit ? (candidates.length / org.candidate_limit) * 100 : 0}%`, background: C.green, borderRadius: 3 }} />
            </div>
          </div>
        </SettingsRow>
        <SettingsRow label="Billing Period">
          <span style={{ fontSize: 14, color: C.textSecondary }}>
            {org?.billing_period || 'Annual'}{org?.renewal_date ? ` — Renews ${formatDate(org.renewal_date)}` : ''}
          </span>
        </SettingsRow>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>Need more seats or want to change your plan?</span>
          <a href={`mailto:hello@acemyinterviews.io?subject=Upgrade%20request%20for%20${org?.name || 'our organization'}`}
            style={{ ...S.dateBtn, background: C.green, borderColor: C.green, color: '#fff', textDecoration: 'none' }}>
            Contact Us to Upgrade
          </a>
        </div>
      </div>

      {/* Interview Configuration */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Interview Configuration</span>
        </div>
        <SettingsRow label="Pass Threshold" sub='Minimum score to be marked as "Passed"'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min="40" max="90" value={settingsForm.pass_threshold}
              onChange={e => setSettingsForm({ ...settingsForm, pass_threshold: parseInt(e.target.value) })}
              style={{ width: 200, accentColor: C.green }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: C.green, width: 30 }}>{settingsForm.pass_threshold}</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Available Job Roles" sub="Restrict which roles your candidates can practice for">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: C.textSecondary }}>All roles enabled</span>
            <button style={{ ...S.dateBtn, opacity: 0.5, cursor: 'not-allowed' }}>Manage Roles</button>
            <span style={{ fontSize: 11, color: C.amber }}>Coming Soon</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Questions per Interview" sub="5 main + 3 follow-up questions">
          <span style={{ fontSize: 14, color: C.textSecondary }}>8 questions</span>
        </SettingsRow>
      </div>

      {/* Notifications */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Notifications</span>
        </div>
        <SettingsRow label="Weekly Summary Report" sub="Receive a weekly email with cohort performance summary">
          <ToggleComingSoon />
        </SettingsRow>
        <SettingsRow label="New Candidate Completion" sub="Get notified when a candidate completes their first interview">
          <ToggleComingSoon />
        </SettingsRow>
        <SettingsRow label="Low Score Alert" sub="Alert when a candidate scores below threshold">
          <ToggleComingSoon />
        </SettingsRow>
      </div>
    </div>
  );

  const SettingsRow = ({ label, sub, children }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
      <div>
        <div style={{ fontSize: 14, color: C.textPrimary }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  );

  const ToggleComingSoon = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 44, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.1)', position: 'relative', opacity: 0.4 }}>
        <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberBg, padding: '2px 8px', borderRadius: 10 }}>Coming Soon</span>
    </div>
  );

  const LegendItem = ({ color, label, count }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }}></div>
      {label} <span style={{ fontWeight: 600, color: C.textPrimary }}>{count}</span>
    </div>
  );

  // ===== MAIN RENDER =====
  const viewMap = {
    overview: OverviewView,
    candidates: CandidatesView,
    categories: CategoriesView,
    video: VideoView,
    individual: IndividualView,
    invite: InviteView,
    settings: SettingsView
  };

  const ActiveViewComponent = viewMap[activeView] || OverviewView;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bgPrimary, color: C.textPrimary, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Sidebar />
      <div style={{ marginLeft: 240, padding: '28px 32px', flex: 1, minHeight: '100vh' }}>
        <ActiveViewComponent />
      </div>
    </div>
  );
}

// ===== DESIGN TOKENS =====
const C = {
  bgPrimary: '#0f172a',
  bgSecondary: '#1e293b',
  bgCard: '#1e293b',
  border: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  green: '#10b981',
  greenLight: '#34d399',
  greenBg: 'rgba(16,185,129,0.1)',
  amber: '#f59e0b',
  amberBg: 'rgba(245,158,11,0.1)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.1)',
  blue: '#3b82f6',
  purple: '#8b5cf6'
};

// ===== STYLES =====
const S = {
  sidebar: { position: 'fixed', left: 0, top: 0, bottom: 0, width: 240, background: C.bgSecondary, borderRight: `1px solid ${C.border}`, padding: '24px 0', zIndex: 100, overflowY: 'auto' },
  sidebarLogo: { padding: '0 20px 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 16 },
  sidebarOrg: { padding: '12px 20px', margin: '0 12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' },
  navSection: { padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.textMuted },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', margin: '2px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: C.textSecondary, transition: 'all 0.15s' },
  navItemActive: { background: 'rgba(16,185,129,0.12)', color: C.green, fontWeight: 500 },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  card: { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 },
  cardTitle: { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, marginBottom: 16 },
  heroRow: { display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 20, marginBottom: 20 },
  bottomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  dateBtn: { padding: '6px 14px', borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, cursor: 'pointer' },
  dateBtnActive: { background: C.green, borderColor: C.green, color: '#fff', fontWeight: 500 },
  dataTable: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
  th: { textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.textMuted, borderBottom: `1px solid ${C.border}` },
  td: { padding: '14px 16px', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)' },
  searchBox: { padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgPrimary, color: C.textPrimary, fontSize: 13, width: 260, outline: 'none' },
  filterBtn: { padding: '6px 12px', borderRadius: 20, fontSize: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, cursor: 'pointer' },
  filterBtnActive: { background: C.green, borderColor: C.green, color: '#fff' },
  tierBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  tierDot: { width: 7, height: 7, borderRadius: '50%' },
  readinessSegment: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff' },
  videoItem: { padding: 14, borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' },
  interviewRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'all 0.15s' },
  interviewNum: { width: 28, height: 28, borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: C.green, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  settingsInput: { padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgPrimary, color: C.textPrimary, fontSize: 14, outline: 'none' },
  scoreDelta: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  answerToggle: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: 13, cursor: 'pointer', marginTop: 12 },
  answerBox: { marginTop: 12, padding: 16, borderRadius: 8, background: C.bgPrimary, border: `1px solid ${C.border}`, fontSize: 13, color: C.textSecondary, lineHeight: 1.7, fontStyle: 'italic' }
};
