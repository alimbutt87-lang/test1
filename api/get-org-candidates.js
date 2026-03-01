import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orgId, accessToken } = req.body;
    if (!orgId || !accessToken) {
      return res.status(400).json({ error: 'Missing orgId or accessToken' });
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // Verify the user is an admin of this org
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin' || profile.org_id !== orgId) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Get all candidates in this org
    const { data: candidates, error: candidatesError } = await supabase
      .from('user_profiles')
      .select('id, created_at')
      .eq('org_id', orgId)
      .eq('role', 'candidate');

    if (candidatesError) throw candidatesError;

    if (!candidates || candidates.length === 0) {
      return res.status(200).json({ candidates: [] });
    }

    const candidateIds = candidates.map(c => c.id);

    // Get auth user details (names, emails) from Supabase auth
    // We need to get this from user metadata stored during sign-in
    // For now, we'll join with interview_results and use what we have

    // Get all interview results for these candidates
    const { data: results, error: resultsError } = await supabase
      .from('interview_results')
      .select('*')
      .eq('org_id', orgId)
      .in('user_id', candidateIds)
      .order('created_at', { ascending: false });

    if (resultsError) throw resultsError;

    // Group results by candidate
    const candidateMap = {};
    candidates.forEach(c => {
      candidateMap[c.id] = {
        id: c.id,
        joinedAt: c.created_at,
        interviews: [],
        latestScore: null,
        latestVideoScore: null,
        interviewCount: 0,
        trend: null,
        delta: null,
        tier: 'not-ready',
        tierLabel: 'Not Ready',
        name: null,
        email: null,
        jobTitle: null
      };
    });

    (results || []).forEach(r => {
      if (candidateMap[r.user_id]) {
        candidateMap[r.user_id].interviews.push(r);
      }
    });

    // Compute per-candidate metrics
    const enrichedCandidates = Object.values(candidateMap).map(c => {
      const interviews = c.interviews.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      c.interviewCount = interviews.length;
      
      if (interviews.length > 0) {
        const latest = interviews[0];
        c.latestScore = latest.overall_score;
        c.latestVideoScore = latest.video_score;
        c.jobTitle = latest.job_title;
        c.lastActive = latest.created_at;
        
        // Extract name from full_results if available
        if (latest.full_results?.userName) {
          c.name = latest.full_results.userName;
        }

        // Calculate trend (difference between first and latest)
        if (interviews.length >= 2) {
          const oldest = interviews[interviews.length - 1];
          const delta = latest.overall_score - oldest.overall_score;
          c.delta = delta > 0 ? `+${delta}` : delta === 0 ? '--' : `${delta}`;
          c.trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        } else {
          c.delta = '--';
          c.trend = 'flat';
        }

        // Assign readiness tier
        const score = latest.overall_score;
        if (score >= 80) {
          c.tier = 'strong';
          c.tierLabel = 'Strong';
        } else if (score >= 61) {
          c.tier = 'ready';
          c.tierLabel = 'Interview Ready';
        } else if (score >= 41) {
          c.tier = 'practice';
          c.tierLabel = 'Needs Practice';
        } else {
          c.tier = 'not-ready';
          c.tierLabel = 'Not Ready';
        }
      }

      // Remove raw interviews from response (keep it lean)
      delete c.interviews;
      return c;
    });

    res.status(200).json({ candidates: enrichedCandidates });
  } catch (error) {
    console.error('get-org-candidates error:', error.message);
    res.status(500).json({ error: 'Failed to fetch candidates', detail: error.message });
  }
}
