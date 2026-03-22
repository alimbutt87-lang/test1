import Stripe from 'stripe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { interviewId, userEmail } = req.body;

    if (!interviewId) {
      return res.status(400).json({ error: 'Missing interviewId' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price: 'price_1TDqfgDqS9966uj0y3CkcL30',
        quantity: 1,
      }],
      customer_email: userEmail || undefined,
      metadata: {
        interviewId,
        type: 'result_unlock'
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://acemyinterviews.io'}/?session_id={CHECKOUT_SESSION_ID}&interview_id=${interviewId}&unlocked=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://acemyinterviews.io'}/?unlock_cancelled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('create-checkout error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session', detail: error.message });
  }
}
