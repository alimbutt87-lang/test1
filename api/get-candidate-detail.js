import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orgId, accessToken, candidateId } = req.body;
    if (!orgId || !accessToken || !candidateId) {
      return res.status(400).json({ error: 'Missing required fields' });
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
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Verify candidate belongs to this org
    const { data: candidateProfile } = await supabase
      .from('user_profiles')
      .select('id, org_id, created_at')
      .eq('id', candidateId)
      .eq('org_id', orgId)
      .single();

    if (!candidateProfile) {
      return res.status(404).json({ error: 'Candidate not found in this organization' });
    }

    // Get all interview results for this candidate
    const { data: interviews, error: interviewsError } = await supabase
      .from('interview_results')
      .select('*')
      .eq('user_id', candidateId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (interviewsError) throw interviewsError;

    // Build candidate detail response
    const sorted = (interviews || []).sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    const latest = sorted[0] || null;
    const oldest = sorted[sorted.length - 1] || null;

    // Derive name from the most recent interview
    let name = null;
    for (const interview of sorted) {
      if (interview.full_results?.userName) {
        name = interview.full_results.userName;
        break;
      }
    }

    // Category scores from latest
    const latestCategories = latest?.category_scores || {};

    // Coaching summary from latest
    const coaching = {
      topStrengths: latest?.full_results?.topStrengths || [],
      criticalImprovements: latest?.full_results?.criticalImprovements || [],
      coachingTip: latest?.full_results?.coachingTip || null
    };

    // Score progress over time
    const progressData = sorted
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((interview, idx) => ({
        interviewNumber: idx + 1,
        overallScore: interview.overall_score,
        videoScore: interview.video_score,
        date: interview.created_at,
        jobTitle: interview.job_title,
        passed: interview.passed
      }));

    // Calculate improvement
    const improvement = sorted.length >= 2
      ? latest.overall_score - oldest.overall_score
      : 0;

    // Readiness tier
    const score = latest?.overall_score || 0;
    let tier = 'not-ready';
    let tierLabel = 'Not Ready';
    if (score >= 80) { tier = 'strong'; tierLabel = 'Strong'; }
    else if (score >= 61) { tier = 'ready'; tierLabel = 'Interview Ready'; }
    else if (score >= 41) { tier = 'practice'; tierLabel = 'Needs Practice'; }

    // Interview history with full details
    const interviewHistory = sorted.map((interview, idx) => ({
      id: interview.id,
      interviewNumber: sorted.length - idx,
      date: interview.created_at,
      jobTitle: interview.job_title,
      overallScore: interview.overall_score,
      passed: interview.passed,
      videoScore: interview.video_score,
      categoryScores: interview.category_scores,
      questionScores: interview.full_results?.questionScores || [],
      topStrengths: interview.full_results?.topStrengths || [],
      criticalImprovements: interview.full_results?.criticalImprovements || [],
      coachingTip: interview.full_results?.coachingTip || null,
      videoAnalysis: interview.full_results?.videoAnalysis || null,
      questionsAndAnswers: interview.questions_and_answers,
      summary: interview.full_results?.summary || null,
      verdict: interview.full_results?.verdict || null
    }));

    res.status(200).json({
      candidate: {
        id: candidateId,
        name,
        joinedAt: candidateProfile.created_at,
        lastActive: latest?.created_at || candidateProfile.created_at,
        interviewCount: sorted.length,
        latestScore: latest?.overall_score || null,
        latestVideoScore: latest?.video_score || null,
        improvement,
        tier,
        tierLabel,
        latestJobTitle: latest?.job_title || null,
        latestCategories,
        coaching,
        progressData,
        interviewHistory
      }
    });
  } catch (error) {
    console.error('get-candidate-detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch candidate', detail: error.message });
  }
}
