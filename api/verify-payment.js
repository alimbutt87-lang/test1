import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { sessionId, interviewId, accessToken } = req.body;

    if (!sessionId || !interviewId) {
      return res.status(400).json({ error: 'Missing sessionId or interviewId' });
    }

    // Verify the Stripe session actually completed
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    // Verify the interviewId matches what's in the session metadata
    if (session.metadata?.interviewId !== interviewId) {
      return res.status(400).json({ error: 'Interview ID mismatch' });
    }

    // Mark the interview as unlocked in Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY, // needs service role to bypass RLS
    );

    const { error } = await supabase
      .from('interview_results')
      .update({ is_unlocked: true })
      .eq('id', interviewId);

    if (error) throw error;

    res.status(200).json({ success: true, unlocked: true });
  } catch (error) {
    console.error('verify-payment error:', error.message);
    res.status(500).json({ error: 'Failed to verify payment', detail: error.message });
  }
}
