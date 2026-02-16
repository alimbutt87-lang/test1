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
        // Merge in metadata captured during the interview by evaluate-followup
        ...(followUpMetadata[fa.parentQuestionIndex] || {})
      };
    });

    // ===== STEP 1: Analyze main answers with V1-identical prompt (full depth) =====
    const mainAnswersText = mainAnswers.map((a, i) =>
      `Question ${i + 1}: ${a.question}\nCandidate's Answer: ${a.answer}\nTime Spent: ${a.timeSpent} seconds`
    ).join('\n\n');

    const mainResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
${mainAnswersText}

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

    const mainData = await mainResponse.json();

    if (!mainResponse.ok) {
      console.error('Anthropic API error (main):', mainData);
      throw new Error('Failed to analyze main answers');
    }

    const mainText = mainData.content[0].text;
    const mainClean = mainText.replace(/```json|```/g, '').trim();
    const mainResults = JSON.parse(mainClean);

    // ===== STEP 2: Analyze follow-up answers separately (only if any exist) =====
    const followUpIndices = Object.keys(followUpMap).map(Number);

    if (followUpIndices.length > 0) {
      const followUpPromptParts = followUpIndices.map(qIdx => {
        const fu = followUpMap[qIdx];
        const mainQ = mainAnswers[qIdx];
        return `Main Question ${qIdx + 1}: ${mainQ.question}
Main Answer (summary): ${mainQ.answer.substring(0, 300)}${mainQ.answer.length > 300 ? '...' : ''}

Follow-up Question: ${fu.question}
What the follow-up was probing for: ${fu.whatWasMissing || 'More detail and specifics'}
Follow-up Type: ${fu.followUpType || 'DEPTH_PROBE'}
Candidate's Follow-up Answer: ${fu.answer}
Time Spent on follow-up: ${fu.timeSpent} seconds`;
      }).join('\n\n---\n\n');

      const followUpResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `You are an expert interview coach. Analyze these follow-up answers from a ${jobTitle} interview. Each follow-up was asked because the candidate's main answer was missing something specific. Evaluate whether the follow-up answer addressed the gap.

Remember: these are transcribed from speech, so ignore grammar/spelling — focus on content.

${followUpPromptParts}

For each follow-up, evaluate:
1. Did they address what the follow-up was probing for?
2. Did they add meaningful new information?
3. Was the follow-up answer a recovery (made up for a weak main answer) or a reinforcement?

Return ONLY valid JSON as an array:
[
  {
    "parentQuestionNum": <1-based question number this follow-up belongs to>,
    "score": <0-100 for the follow-up answer specifically>,
    "addressedGap": <boolean - did they address what the follow-up was testing?>,
    "feedback": "<specific feedback on the follow-up answer — what they added, what was still missing>",
    "strengths": ["<strength1>", "<strength2>"],
    "improvements": ["<improvement1>"],
    "coachingNote": "<explain what the follow-up was testing and whether they addressed it, e.g. 'This follow-up was probing for specific metrics, and you added that the campaign drove 2,400 signups at $12 CAC — exactly the specificity that was missing.'>"
  }
]`
          }]
        })
      });

      const followUpData = await followUpResponse.json();

      if (followUpResponse.ok) {
        try {
          const fuText = followUpData.content[0].text;
          const fuClean = fuText.replace(/```json|```/g, '').trim();
          const followUpScores = JSON.parse(fuClean);

          // Merge follow-up results into the corresponding main question scores
          followUpScores.forEach(fuScore => {
            const qIdx = fuScore.parentQuestionNum - 1;
            if (qIdx >= 0 && qIdx < mainResults.questionScores.length) {
              const mainQ = mainResults.questionScores[qIdx];
              mainQ.hasFollowUp = true;
              mainQ.followUp = {
                question: followUpMap[qIdx].question,
                score: fuScore.score,
                addressedGap: fuScore.addressedGap,
                feedback: fuScore.feedback,
                strengths: fuScore.strengths || [],
                improvements: fuScore.improvements || [],
                coachingNote: fuScore.coachingNote || '',
                followUpType: followUpMap[qIdx].followUpType || null,
                whatWasMissing: followUpMap[qIdx].whatWasMissing || null
              };
              // Combined score: 70% main + 30% follow-up recovery
              mainQ.combinedScore = Math.round(mainQ.score * 0.7 + fuScore.score * 0.3);
            }
          });
        } catch (parseError) {
          console.error('Error parsing follow-up scores:', parseError);
          // Main results are still valid — continue without follow-up enrichment
        }
      } else {
        console.error('Follow-up analysis API error:', followUpData);
        // Non-fatal: main results proceed without follow-up scores
      }
    }

    // ===== STEP 3: Mark questions that had no follow-up =====
    mainResults.questionScores.forEach((q, idx) => {
      if (!q.hasFollowUp) {
        q.hasFollowUp = false;
        q.followUp = null;
        // Attach the reason from evaluate-followup (captured during interview)
        const meta = followUpMetadata[idx];
        if (meta && meta.reason === 'thorough_answer') {
          q.noFollowUpReason = 'thorough_answer';
        } else if (meta && meta.reason) {
          q.noFollowUpReason = meta.reason;
        } else {
          q.noFollowUpReason = null;
        }
      }
    });

    res.status(200).json({ results: mainResults });
  } catch (error) {
    console.error('Error analyzing interview:', error);
    res.status(500).json({ error: 'Failed to analyze interview' });
  }
}
