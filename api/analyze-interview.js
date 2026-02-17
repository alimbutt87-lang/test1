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
    const { answers, jobTitle, followUpMetadata = {} } = req.body;

    // Separate main answers from follow-up answers
    const mainAnswers = answers.filter(a => !a.isFollowUp);
    const followUpAnswers = answers.filter(a => a.isFollowUp);

    // Build follow-up lookup
    const followUpMap = {};
    followUpAnswers.forEach(fa => {
      followUpMap[fa.parentQuestionIndex] = {
        question: fa.question,
        answer: fa.answer,
        timeSpent: fa.timeSpent,
        ...(followUpMetadata[fa.parentQuestionIndex] || {})
      };
    });

    const hasAnyFollowUps = followUpAnswers.length > 0;
    const followUpQuestionNums = Object.keys(followUpMap).map(i => parseInt(i) + 1);

    // Build interview text — keep it lean
    const answersText = mainAnswers.map((a, i) => {
      const fu = followUpMap[i];
      let text = `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}\nTime: ${a.timeSpent}s`;
      if (fu) {
        text += `\n[FOLLOW-UP Q${i + 1}]: ${fu.question}\nFollow-up answer: ${fu.answer}\nTime: ${fu.timeSpent}s`;
      }
      return text;
    }).join('\n\n');

    // Minimal follow-up instruction — only added when needed
    const followUpBlock = hasAnyFollowUps
      ? `\nQuestions ${followUpQuestionNums.join(', ')} have [FOLLOW-UP] sections. For those, add to each questionScore: "hasFollowUp":true, "followUp":{"score":<0-100>,"feedback":"<2-3 detailed sentences on what the follow-up answer added or failed to add>","strengths":["<specific>","<specific>"],"improvements":["<specific>"],"coachingNote":"<what the follow-up tested and whether they addressed it>"}, "combinedScore":<Math.round(score*0.7+followUp.score*0.3)>. For questions without follow-ups: "hasFollowUp":false,"followUp":null,"noFollowUpReason":"thorough_answer" if the main answer was complete, else null.`
      : '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `You are an expert interview coach analyzing a candidate's SPOKEN interview performance for a ${jobTitle} position. The answers below were captured via voice transcription, so ignore any spelling/grammar issues - focus only on the CONTENT and SUBSTANCE of their responses.

Interview Responses:
${answersText}

Analyze each answer and provide a comprehensive scorecard. Be fair but rigorous - this is a real interview assessment. Remember: this is transcribed speech, so evaluate what they SAID, not how it's written.

Scoring: be strict. Vague answers without concrete examples = 40-60. Mentioning a concept without backing it up = 50-65 max. Only answers with specific examples, metrics, and clear structure score 75+. Incomplete or irrelevant answers score below 30.
${followUpBlock}
Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "passed": <true if >= 70>,
  "verdict": "<'Congratulations! You got the job!' or 'Unfortunately, you did not pass this interview.'>",
  "summary": "<2-3 sentence assessment>",
  "questionScores": [{"questionNum":1,"score":<0-100>,"feedback":"<2-3 specific sentences>","strengths":["<specific>","<specific>"],"improvements":["<specific>","<specific>"]}],
  "categories": {
    "clarity": {"score": <0-100>, "feedback": "<specific>"},
    "relevance": {"score": <0-100>, "feedback": "<specific>"},
    "depth": {"score": <0-100>, "feedback": "<specific>"},
    "confidence": {"score": <0-100>, "feedback": "<specific>"},
    "conciseness": {"score": <0-100>, "feedback": "<specific>"},
    "starMethod": {"score": <0-100>, "feedback": "<specific>"},
    "technicalAccuracy": {"score": <0-100>, "feedback": "<specific>"},
    "enthusiasm": {"score": <0-100>, "feedback": "<specific>"}
  },
  "topStrengths": ["<1>","<2>","<3>"],
  "criticalImprovements": ["<1>","<2>","<3>"],
  "coachingTip": "<specific actionable tip>"
}`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API error:', JSON.stringify(data));
      throw new Error(`API ${response.status}: ${data?.error?.message || 'unknown'}`);
    }

    let results;
    try {
      const text = data.content[0].text;
      const cleanText = text.replace(/```json|```/g, '').trim();
      results = JSON.parse(cleanText);
    } catch (e) {
      console.error('Parse failed:', data.content?.[0]?.text?.substring(0, 500));
      throw new Error('JSON parse failed');
    }

    // Post-process: ensure follow-up fields are correct using our metadata
    if (hasAnyFollowUps) {
      results.questionScores.forEach((q, idx) => {
        const fu = followUpMap[idx];
        if (fu) {
          q.hasFollowUp = true;
          if (q.followUp) {
            q.followUp.followUpType = fu.followUpType || q.followUp.followUpType || null;
            q.followUp.whatWasMissing = fu.whatWasMissing || q.followUp.whatWasMissing || null;
            if (!q.followUp.question) q.followUp.question = fu.question;
          } else {
            // Claude missed it — create from our data
            q.followUp = {
              question: fu.question,
              score: null,
              feedback: 'Follow-up recorded but detailed analysis unavailable.',
              strengths: [], improvements: [],
              coachingNote: fu.whatWasMissing ? `Probing for: ${fu.whatWasMissing}` : null,
              followUpType: fu.followUpType || null,
              whatWasMissing: fu.whatWasMissing || null
            };
          }
          if (q.followUp.score != null && !q.combinedScore) {
            q.combinedScore = Math.round(q.score * 0.7 + q.followUp.score * 0.3);
          }
        } else {
          q.hasFollowUp = false;
          q.followUp = null;
          const meta = followUpMetadata[idx];
          q.noFollowUpReason = (meta?.reason === 'thorough_answer') ? 'thorough_answer' : (meta?.reason || null);
        }
      });
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('analyze-interview error:', error.message);
    res.status(500).json({ error: 'Failed to analyze interview', detail: error.message });
  }
}
