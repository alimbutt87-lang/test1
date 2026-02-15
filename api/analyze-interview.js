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

    // Group answers: main questions with their follow-ups
    const questionGroups = [];
    let currentGroup = null;
    
    answers.forEach((a) => {
      if (!a.isFollowUp) {
        if (currentGroup) questionGroups.push(currentGroup);
        currentGroup = { main: a, followUp: null };
      } else if (currentGroup) {
        currentGroup.followUp = a;
      }
    });
    if (currentGroup) questionGroups.push(currentGroup);

    // Build prompt text - same format as original, but include follow-ups
    const answersText = questionGroups.map((group, i) => {
      let text = `Question ${i + 1}: ${group.main.question}\nCandidate's Answer: ${group.main.answer}\nTime Spent: ${group.main.timeSpent} seconds`;
      
      if (group.followUp) {
        text += `\n\n[FOLLOW-UP for Question ${i + 1}]: ${group.followUp.question}\nCandidate's Follow-up Answer: ${group.followUp.answer}\nTime Spent: ${group.followUp.timeSpent} seconds`;
      }
      
      return text;
    }).join('\n\n');

    const hasAnyFollowUps = questionGroups.some(g => g.followUp);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `You are an expert interview coach analyzing a candidate's SPOKEN interview performance for a ${jobTitle} position. The answers below were captured via voice transcription, so ignore any spelling/grammar issues - focus only on the CONTENT and SUBSTANCE of their responses.

Interview Responses:
${answersText}

Analyze each answer and provide a comprehensive scorecard. Be fair but rigorous - this is a real interview assessment. Remember: this is transcribed speech, so evaluate what they SAID, not how it's written.

SCORING RULES:
- Empty/skipped answers: 0-20
- Very brief or "I don't know": 20-40  
- Vague answer without examples: 40-60
- Good answer with some examples: 60-80
- Excellent detailed answer with specifics: 80-100

${hasAnyFollowUps ? `FOLLOW-UP HANDLING:
- Some questions have follow-up questions marked with [FOLLOW-UP]
- For questions WITH a follow-up: score = 70% main answer + 30% follow-up answer
- Provide feedback for both the main answer AND the follow-up separately
- Include the follow-up details in the questionScores array` : ''}

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
      "improvements": ["<improvement1>", "<improvement2>"]${hasAnyFollowUps ? `,
      "hasFollowUp": <true if this question had a follow-up, false otherwise>,
      "followUp": <null if no follow-up, OR object with: { "question": "...", "score": 0-100, "feedback": "...", "strengths": [...], "improvements": [...] }>` : ''}
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
