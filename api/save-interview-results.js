import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { accessToken, orgId, interviewData } = req.body;

    if (!accessToken || !interviewData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the user's profile to confirm org membership
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    // Determine the org_id — use profile's org_id, fall back to passed orgId
    const effectiveOrgId = profile?.org_id || orgId || null;

    // If org_id is set, verify the org is active
    if (effectiveOrgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('is_active, candidate_limit')
        .eq('id', effectiveOrgId)
        .single();

      if (!org || !org.is_active) {
        return res.status(403).json({ error: 'Organization is not active' });
      }
    }

    // Count existing interviews for this user in this org (for interview_number)
    let interviewNumber = 1;
    const { count } = await supabase
      .from('interview_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('org_id', effectiveOrgId);

    if (count != null) {
      interviewNumber = count + 1;
    }

    // Extract category scores for fast aggregation
    const categoryScores = {};
    if (interviewData.results?.categories) {
      Object.entries(interviewData.results.categories).forEach(([key, val]) => {
        categoryScores[key] = typeof val === 'object' ? val : { score: val };
      });
    }

    // Build the row
    const row = {
      user_id: user.id,
      org_id: effectiveOrgId,
      job_title: interviewData.jobTitle || null,
      overall_score: interviewData.results?.overallScore || null,
      passed: interviewData.results?.passed || false,
      video_score: interviewData.videoAnalysis?.overallVideoScore || null,
      category_scores: categoryScores,
      interview_number: interviewNumber,
      full_results: {
        ...interviewData.results,
        videoAnalysis: interviewData.videoAnalysis || null,
        userName: interviewData.userName || user.user_metadata?.full_name || user.email?.split('@')[0] || null
      },
      questions_and_answers: interviewData.questionsAndAnswers || null
    };

    const { data, error } = await supabase
      .from('interview_results')
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, id: data.id, interviewNumber });
  } catch (error) {
    console.error('save-interview-results error:', error.message);
    res.status(500).json({ error: 'Failed to save results', detail: error.message });
  }
}
