import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orgId, accessToken, updates } = req.body;
    if (!orgId || !accessToken || !updates) {
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

    // Whitelist allowed fields
    const allowed = ['name', 'slug', 'admin_email', 'pass_threshold'];
    const safeUpdates = {};
    Object.entries(updates).forEach(([key, val]) => {
      if (allowed.includes(key)) safeUpdates[key] = val;
    });

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // If slug is being changed, check uniqueness
    if (safeUpdates.slug) {
      // Sanitize slug
      safeUpdates.slug = safeUpdates.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', safeUpdates.slug)
        .neq('id', orgId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'This slug is already taken' });
      }
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(safeUpdates)
      .eq('id', orgId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, org: data });
  } catch (error) {
    console.error('update-org-settings error:', error.message);
    res.status(500).json({ error: 'Failed to update settings', detail: error.message });
  }
}
