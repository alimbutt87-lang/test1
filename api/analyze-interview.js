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
    const { answers, jobTitle } = req.body;

    const answersText = answers.map((a, i) => 
      `Question ${i + 1}: ${a.question}\nCandidate's Answer: ${a.answer}\nTime Spent: ${a.timeSpent} seconds`
    ).join('\n\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{
          role: 'user',
          content: `You are an expert interview coach analyzing a candidate's SPOKEN interview performance for a ${jobTitle} position. The answers below were captured via voice transcription, so ignore any spelling/grammar issues - focus only on the CONTENT and SUBSTANCE of their responses.

Interview Responses:
${answersText}

Analyze each answer and provide a comprehensive scorecard. Be fair but rigorous - this is a real interview assessment. Remember: this is transcribed speech, so evaluate what they SAID, not how it's written.

Return ONLY valid JSON in this exact format:
{
  "overallScore": <number 0-100>,
  "passed": <boolean - true if score >= 70>,
  "verdict": "<one sentence: 'Congratulations! You got the job!' or 'Unfortunately, you did not pass this interview.'>",
  "summary": "<2-3 sentence overall assessment>",
  "questionScores": [
    {
      "questionNum": 1,
      "score": <0-100>,
      "feedback": "<specific feedback for this answer - focus on content, structure, examples, not grammar>",
      "strengths": ["<strength1>", "<strength2>"],
      "improvements": ["<improvement1>", "<improvement2>"]
    }
  ],
  "categories": {
    "clarity": {"score": <0-100>, "feedback": "<was their point clear and easy to follow?>"},
    "relevance": {"score": <0-100>, "feedback": "<did they actually answer the question asked?>"},
    "depth": {"score": <0-100>, "feedback": "<did they provide enough detail and specifics?>"},
    "confidence": {"score": <0-100>, "feedback": "<did they sound confident and assured?>"},
    "conciseness": {"score": <0-100>, "feedback": "<were they focused or did they ramble?>"},
    "starMethod": {"score": <0-100>, "feedback": "<did they use Situation, Task, Action, Result for behavioral questions?>"},
    "technicalAccuracy": {"score": <0-100>, "feedback": "<was their technical knowledge accurate?>"},
    "enthusiasm": {"score": <0-100>, "feedback": "<did they show genuine interest in the role?>"}
  },
  "topStrengths": ["<strength1>", "<strength2>", "<strength3>"],
  "criticalImprovements": ["<improvement1>", "<improvement2>", "<improvement3>"],
  "coachingTip": "<one specific, actionable tip for their next interview>"
}`
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      throw new Error('Failed to analyze interview');
    }

    const text = data.content[0].text;
    const cleanText = text.replace(/```json|```/g, '').trim();
    const results = JSON.parse(cleanText);

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error analyzing interview:', error);
    res.status(500).json({ error: 'Failed to analyze interview' });
  }
}
