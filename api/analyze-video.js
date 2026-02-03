export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { snapshots } = req.body;

    if (!snapshots || snapshots.length === 0) {
      return res.status(200).json({ results: null });
    }

    // Sample 3-4 representative snapshots
    const samplesToAnalyze = snapshots.length <= 4 
      ? snapshots 
      : [
          snapshots[0], 
          snapshots[Math.floor(snapshots.length/3)], 
          snapshots[Math.floor(2*snapshots.length/3)], 
          snapshots[snapshots.length-1]
        ];

    const imageContent = samplesToAnalyze.map(snapshot => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: snapshot.split(',')[1]
      }
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `You are an interview coach analyzing video snapshots from a practice interview session. Analyze these ${samplesToAnalyze.length} snapshots taken throughout the interview and provide feedback.

Evaluate and score (0-100) each category:
1. Eye Contact: Are they looking at the camera (simulating eye contact with interviewer)?
2. Posture: Are they sitting up straight, professional positioning?
3. Facial Expression: Do they appear confident, engaged, friendly?
4. Framing: Are they well-positioned in frame, appropriate distance?
5. Background: Is it professional/clean, or distracting?
6. Overall Presence: Professional video interview presence

Return ONLY valid JSON:
{
  "eyeContact": { "score": 0-100, "feedback": "brief feedback" },
  "posture": { "score": 0-100, "feedback": "brief feedback" },
  "facialExpression": { "score": 0-100, "feedback": "brief feedback" },
  "framing": { "score": 0-100, "feedback": "brief feedback" },
  "background": { "score": 0-100, "feedback": "brief feedback" },
  "overallPresence": { "score": 0-100, "feedback": "brief feedback" },
  "topTip": "The single most important thing to improve",
  "overallVideoScore": 0-100
}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      throw new Error('Failed to analyze video');
    }

    const text = data.content[0].text;
    const cleanText = text.replace(/```json|```/g, '').trim();
    const results = JSON.parse(cleanText);

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error analyzing video:', error);
    res.status(200).json({ results: null });
  }
}
