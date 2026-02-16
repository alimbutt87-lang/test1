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

    // Build a lookup: questionIndex -> followUp answer + metadata
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

    console.log(`Analyzing interview: ${mainAnswers.length} main answers, ${followUpAnswers.length} follow-ups, job: ${jobTitle}`);

    // Build the interview text — main answers with follow-ups explicitly attached
    const answersText = mainAnswers.map((a, i) => {
      const fu = followUpMap[i];
      let text = `Question ${i + 1}: ${a.question}\nCandidate's Answer: ${a.answer}\nTime Spent: ${a.timeSpent} seconds`;

      if (fu) {
        text += `\n\n  [FOLLOW-UP for Question ${i + 1}]`;
        text += `\n  Follow-up Question: ${fu.question}`;
        text += `\n  What this follow-up was probing for: ${fu.whatWasMissing || 'More detail and specifics'}`;
        text += `\n  Follow-up Type: ${fu.followUpType || 'DEPTH_PROBE'}`;
        text += `\n  Candidate's Follow-up Answer: ${fu.answer}`;
        text += `\n  Time Spent: ${fu.timeSpent} seconds`;
      }

      return text;
    }).join('\n\n---\n\n');

    // Build the list of which questions have follow-ups (explicit, not for Claude to guess)
    const followUpQuestionNums = Object.keys(followUpMap).map(i => parseInt(i) + 1);

    // Build the JSON schema — always include follow-up fields so the structure is consistent
    const questionScoreSchema = hasAnyFollowUps
      ? `{
      "questionNum": 1,
      "score": <0-100 for the MAIN answer only>,
      "feedback": "<2-3 sentences of specific feedback on the MAIN answer, referencing what the candidate actually said>",
      "strengths": ["<specific strength from their main answer>", "<another>"],
      "improvements": ["<specific improvement>", "<another>"],
      "hasFollowUp": <true if this question has a [FOLLOW-UP] section above, false otherwise>,
      "followUp": <null if no follow-up, OR if this question had a follow-up: {
        "question": "<the follow-up question that was asked>",
        "score": <0-100 for the follow-up answer specifically>,
        "addressedGap": <boolean - did the follow-up answer address what was being probed?>,
        "feedback": "<2-3 sentences on the follow-up answer — what they added, what was still missing>",
        "strengths": ["<specific strength from follow-up>"],
        "improvements": ["<specific improvement>"],
        "coachingNote": "<explain what the follow-up tested and whether they addressed it>"
      }>,
      "combinedScore": <null if no follow-up, OR Math.round(score * 0.7 + followUp.score * 0.3)>,
      "noFollowUpReason": <null if has follow-up, "thorough_answer" if no follow-up was needed because the main answer was complete, null otherwise>
    }`
      : `{
      "questionNum": 1,
      "score": <0-100>,
      "feedback": "<2-3 sentences of specific feedback referencing what the candidate actually said>",
      "strengths": ["<specific strength from their answer>", "<another>"],
      "improvements": ["<specific improvement>", "<another>"]
    }`;

    const followUpInstructions = hasAnyFollowUps
      ? `
FOLLOW-UP HANDLING:
- Questions ${followUpQuestionNums.join(', ')} have follow-up sections marked with [FOLLOW-UP].
- Score the MAIN answer and the FOLLOW-UP answer SEPARATELY. Do NOT blend them in the main score.
- The main answer score should reflect ONLY the main answer quality. The follow-up is scored in its own field.
- For the follow-up feedback: explain whether the candidate addressed what was missing. Reference specific things they said.
- For the follow-up coachingNote: tell them what the follow-up was testing and whether they nailed it. Example: "This follow-up probed for specific metrics. You added that the campaign drove 2,400 signups at $12 CAC — exactly the specificity missing from your initial answer."
- For questions WITHOUT a follow-up: set hasFollowUp to false, followUp to null. If the reason the question had no follow-up is that the answer was already thorough, set noFollowUpReason to "thorough_answer".
`
      : '';

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

Analyze each answer and provide a comprehensive scorecard. Be fair but rigorous - this is a real interview assessment. Remember: this is transcribed speech, so evaluate what they SAID, not how it's written.

QUALITY STANDARDS — CRITICAL:
- Each question's feedback MUST be 2-3 detailed sentences referencing specific things the candidate said (or failed to say). Generic feedback like "good answer" or "needs improvement" is unacceptable.
- Each question MUST have at least 2 specific strengths and 2 specific improvements that reference actual content from their answer.
- Be a STRICT grader: vague answers without concrete examples = 40-60. Mentioning a framework without a real example = 50-65 max. Only answers with specific examples, metrics, clear structure AND relevant detail score above 75. A score of 80+ means genuinely impressive.
- Category feedback must also reference specific moments from the interview, not generic observations.
${followUpInstructions}
Return ONLY valid JSON in this exact format:
{
  "overallScore": <number 0-100>,
  "passed": <boolean - true if score >= 70>,
  "verdict": "<one sentence: 'Congratulations! You got the job!' or 'Unfortunately, you did not pass this interview.'>",
  "summary": "<2-3 sentence overall assessment>",
  "questionScores": [
    ${questionScoreSchema}
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
      console.error('Anthropic API error:', JSON.stringify(data));
      throw new Error(`API error: ${response.status} - ${data?.error?.message || JSON.stringify(data)}`);
    }

    let results;
    try {
      const text = data.content[0].text;
      console.log('Analysis response length:', text.length);
      const cleanText = text.replace(/```json|```/g, '').trim();
      results = JSON.parse(cleanText);
      console.log('Parsed successfully. Overall score:', results.overallScore, 'Questions:', results.questionScores?.length);
    } catch (parseError) {
      console.error('JSON parse failed. Raw:', data.content?.[0]?.text?.substring(0, 1000));
      throw new Error('Failed to parse analysis JSON');
    }

    // Post-process: ensure follow-up fields are set correctly using our metadata
    // This is the safety net — even if Claude misses a field, we fill it from our data
    if (hasAnyFollowUps) {
      results.questionScores.forEach((q, idx) => {
        const fu = followUpMap[idx];
        if (fu) {
          // This question HAD a follow-up — ensure it's marked
          q.hasFollowUp = true;
          if (q.followUp) {
            // Claude provided follow-up analysis — enrich with our metadata
            q.followUp.followUpType = fu.followUpType || q.followUp.followUpType || null;
            q.followUp.whatWasMissing = fu.whatWasMissing || q.followUp.whatWasMissing || null;
            if (!q.followUp.question) q.followUp.question = fu.question;
          } else {
            // Claude missed the follow-up — create a basic entry from our data
            console.warn(`Claude missed follow-up for Q${idx + 1}, creating from metadata`);
            q.followUp = {
              question: fu.question,
              score: null,
              addressedGap: null,
              feedback: 'Follow-up answer was recorded but could not be analyzed in detail.',
              strengths: [],
              improvements: [],
              coachingNote: fu.whatWasMissing ? `This follow-up was probing for: ${fu.whatWasMissing}` : null,
              followUpType: fu.followUpType || null,
              whatWasMissing: fu.whatWasMissing || null
            };
          }
          // Ensure combinedScore is calculated
          if (q.followUp.score !== null && q.followUp.score !== undefined) {
            q.combinedScore = Math.round(q.score * 0.7 + q.followUp.score * 0.3);
          }
        } else {
          // No follow-up for this question
          q.hasFollowUp = false;
          q.followUp = null;
          // Set the reason from our metadata
          const meta = followUpMetadata[idx];
          if (meta && meta.reason === 'thorough_answer') {
            q.noFollowUpReason = 'thorough_answer';
          } else if (meta && meta.reason) {
            q.noFollowUpReason = meta.reason;
          } else {
            q.noFollowUpReason = q.noFollowUpReason || null;
          }
        }
      });
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('analyze-interview FATAL:', error.message);
    res.status(500).json({ error: 'Failed to analyze interview', detail: error.message });
  }
}
