import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orgId, accessToken, period } = req.body;
    if (!orgId || !accessToken) {
      return res.status(400).json({ error: 'Missing orgId or accessToken' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin' || profile.org_id !== orgId) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Get org info
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    // Date filter
    let dateFilter = null;
    const now = new Date();
    if (period === '7d') {
      dateFilter = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === '30d' || !period) {
      dateFilter = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'semester') {
      dateFilter = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();
    }
    // 'all' = no filter

    // Get candidate count
    const { count: totalCandidates } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'candidate');

    // Get all interview results for this org
    let query = supabase
      .from('interview_results')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: results, error: resultsError } = await query;
    if (resultsError) throw resultsError;

    const interviews = results || [];
    const totalInterviews = interviews.length;

    if (totalInterviews === 0) {
      return res.status(200).json({
        org,
        totalCandidates: totalCandidates || 0,
        totalInterviews: 0,
        avgScore: 0,
        passRate: 0,
        passCount: 0,
        avgImprovement: 0,
        avgInterviewsPerCandidate: 0,
        readiness: { notReady: 0, needsPractice: 0, interviewReady: 0, strong: 0 },
        categoryAverages: {},
        videoAverages: {},
        trendData: [],
        impactData: null
      });
    }

    // Aggregate scores
    const scores = interviews.map(i => i.overall_score).filter(s => s != null);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const passCount = interviews.filter(i => i.passed).length;
    const passRate = totalInterviews > 0 ? Math.round((passCount / totalInterviews) * 100) : 0;

    // Group by user for per-candidate metrics
    const byUser = {};
    interviews.forEach(i => {
      if (!byUser[i.user_id]) byUser[i.user_id] = [];
      byUser[i.user_id].push(i);
    });

    // Calculate readiness distribution (based on latest score per candidate)
    const readiness = { notReady: 0, needsPractice: 0, interviewReady: 0, strong: 0 };
    const improvements = [];

    Object.values(byUser).forEach(userInterviews => {
      const sorted = userInterviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestScore = sorted[0].overall_score;

      if (latestScore >= 80) readiness.strong++;
      else if (latestScore >= 61) readiness.interviewReady++;
      else if (latestScore >= 41) readiness.needsPractice++;
      else readiness.notReady++;

      // Improvement: latest vs first
      if (sorted.length >= 2) {
        const first = sorted[sorted.length - 1].overall_score;
        const latest = sorted[0].overall_score;
        improvements.push(latest - first);
      }
    });

    const avgImprovement = improvements.length > 0
      ? Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length)
      : 0;

    const uniqueCandidates = Object.keys(byUser).length;
    const avgInterviewsPerCandidate = uniqueCandidates > 0
      ? Math.round((totalInterviews / uniqueCandidates) * 10) / 10
      : 0;

    // Category averages
    const categoryTotals = {};
    const categoryCounts = {};
    interviews.forEach(i => {
      if (i.category_scores) {
        const cats = typeof i.category_scores === 'string' 
          ? JSON.parse(i.category_scores) 
          : i.category_scores;
        Object.entries(cats).forEach(([key, val]) => {
          const score = typeof val === 'object' ? val.score : val;
          if (score != null) {
            categoryTotals[key] = (categoryTotals[key] || 0) + score;
            categoryCounts[key] = (categoryCounts[key] || 0) + 1;
          }
        });
      }
    });

    const categoryAverages = {};
    Object.keys(categoryTotals).forEach(key => {
      categoryAverages[key] = Math.round(categoryTotals[key] / categoryCounts[key]);
    });

    // Video averages
    const videoFields = ['eyeContact', 'posture', 'facialExpression', 'framing', 'background', 'overallPresence'];
    const videoTotals = {};
    const videoCounts = {};
    let videoScoreTotal = 0;
    let videoScoreCount = 0;

    interviews.forEach(i => {
      if (i.video_score != null) {
        videoScoreTotal += i.video_score;
        videoScoreCount++;
      }
      if (i.full_results?.videoAnalysis) {
        const va = i.full_results.videoAnalysis;
        videoFields.forEach(field => {
          if (va[field]?.score != null) {
            videoTotals[field] = (videoTotals[field] || 0) + va[field].score;
            videoCounts[field] = (videoCounts[field] || 0) + 1;
          }
        });
      }
    });

    const videoAverages = {};
    videoFields.forEach(f => {
      if (videoCounts[f]) {
        videoAverages[f] = Math.round(videoTotals[f] / videoCounts[f]);
      }
    });
    const avgVideoScore = videoScoreCount > 0 ? Math.round(videoScoreTotal / videoScoreCount) : null;

    // Trend data — group by week
    const trendData = [];
    if (interviews.length > 0) {
      const weekMap = {};
      interviews.forEach(i => {
        const date = new Date(i.created_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weekMap[weekKey]) weekMap[weekKey] = [];
        weekMap[weekKey].push(i.overall_score);
      });

      Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([week, scores]) => {
          trendData.push({
            week,
            avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            count: scores.length
          });
        });
    }

    // Practice impact data — average score by interview number
    const impactData = {};
    Object.values(byUser).forEach(userInterviews => {
      const sorted = userInterviews.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      sorted.forEach((interview, idx) => {
        const num = idx + 1;
        if (!impactData[num]) impactData[num] = [];
        impactData[num].push(interview.overall_score);
      });
    });

    const impactSeries = Object.entries(impactData)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([num, scores]) => ({
        interview: Number(num),
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        count: scores.length
      }));

    res.status(200).json({
      org,
      totalCandidates: totalCandidates || 0,
      totalInterviews,
      avgScore,
      passRate,
      passCount,
      avgImprovement,
      avgInterviewsPerCandidate,
      readiness,
      categoryAverages,
      videoAverages,
      avgVideoScore,
      trendData,
      impactSeries
    });
  } catch (error) {
    console.error('get-org-stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats', detail: error.message });
  }
}
