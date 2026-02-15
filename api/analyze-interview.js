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
    const { answers, jobTitle, videoScore } = req.body;

    // Build the prompt for analysis - handle both main and follow-up answers
    const answersText = answers.map((a) => {
      const prefix = a.isFollowUp 
        ? `[FOLLOW-UP to Q${a.parentQuestionIndex + 1}]` 
        : `Question ${a.questionIndex + 1}:`;
      return `${prefix} ${a.question}\nCandidate's Answer: ${a.answer}\nTime Spent: ${a.timeSpent} seconds`;
    }).join('\n\n');

    // Count follow-ups for context
    const followUpCount = answers.filter(a => a.isFollowUp).length;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3500,
        messages: [{
          role: 'user',
          content: `You are an expert interview coach analyzing a candidate's SPOKEN interview performance for a ${jobTitle} position. The answers below were captured via voice transcription, so ignore any spelling/grammar issues - focus only on the CONTENT and SUBSTANCE of their responses.

Interview Responses:
${answersText}

IMPORTANT CONTEXT:
- Some questions have follow-up questions (marked with [FOLLOW-UP])
- Follow-ups were asked when the main answer needed more depth or missed a key element
- If a question has no follow-up, it means the main answer was thorough - this is GOOD, not a penalty
- Total follow-up questions asked: ${followUpCount}

Analyze each answer and provide a comprehensive scorecard. Be fair but rigorous - this is a real interview assessment.

Return ONLY valid JSON in this exact format:
{
  "contentScore": <number 0-100 - overall content quality across all answers>,
  "questionScores": [
    {
      "questionNum": 1,
      "questionText": "<the original question>",
      "mainAnswerScore": <0-100>,
      "mainAnswerFeedback": "<specific feedback for main answer>",
      "mainAnswerStrengths": ["<strength1>", "<strength2>"],
      "mainAnswerImprovements": ["<improvement1>", "<improvement2>"],
      "hasFollowUp": <boolean>,
      "followUpQuestion": "<the follow-up question if asked, or null>",
      "followUpScore": <0-100 or null if no follow-up>,
      "followUpFeedback": "<feedback for follow-up answer or null>",
      "followUpStrengths": ["<strength1>"] or null,
      "followUpImprovements": ["<improvement1>"] or null,
      "whatFollowUpTested": "<what the follow-up was probing for, or null>",
      "combinedQuestionScore": <0-100 - if follow-up exists: 70% main + 30% follow-up, else: 100% main>
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
  "coachingTip": "<one specific, actionable tip for their next interview>",
  "followUpInsight": {
    "totalFollowUpsAsked": <number>,
    "averageMainScore": <0-100>,
    "averageFollowUpScore": <0-100 or null if no follow-ups>,
    "pattern": "<insight like 'You tend to lose specificity when pushed deeper' or 'Your follow-up answers showed good recovery' or null if no follow-ups>"
  }
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
    const analysisResults = JSON.parse(cleanText);

    // Calculate the hero score: 80% content + 20% delivery
    // Content score is average of all combinedQuestionScores
    const avgContentScore = analysisResults.questionScores.reduce(
      (sum, q) => sum + q.combinedQuestionScore, 0
    ) / analysisResults.questionScores.length;

    // Delivery score comes from video analysis (passed in from frontend)
    // If no video score, use content score as fallback for that portion
    const deliveryScore = videoScore || avgContentScore;

    // Hero score: 80% content + 20% delivery
    const heroScore = Math.round(avgContentScore * 0.8 + deliveryScore * 0.2);

    // Determine pass/fail
    const passed = heroScore >= 70;
    const verdict = passed 
      ? "Congratulations! You got the job!" 
      : "Unfortunately, you did not pass this interview.";

    // Build summary
    const summary = `Your interview has been evaluated with a focus on content quality${videoScore ? ' and visual delivery' : ''}. ${
      analysisResults.followUpInsight.totalFollowUpsAsked > 0 
        ? `You received ${analysisResults.followUpInsight.totalFollowUpsAsked} follow-up question${analysisResults.followUpInsight.totalFollowUpsAsked > 1 ? 's' : ''} during the interview.`
        : 'No follow-up questions were needed - your answers were thorough.'
    }`;

    const results = {
      overallScore: heroScore,
      contentScore: Math.round(avgContentScore),
      deliveryScore: Math.round(deliveryScore),
      passed,
      verdict,
      summary,
      questionScores: analysisResults.questionScores,
      categories: analysisResults.categories,
      topStrengths: analysisResults.topStrengths,
      criticalImprovements: analysisResults.criticalImprovements,
      coachingTip: analysisResults.coachingTip,
      followUpInsight: analysisResults.followUpInsight,
      scoringBreakdown: {
        contentWeight: 80,
        deliveryWeight: 20,
        mainAnswerWeight: 70,
        followUpWeight: 30
      }
    };

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error analyzing interview:', error);
    res.status(500).json({ error: 'Failed to analyze interview' });
  }
}
