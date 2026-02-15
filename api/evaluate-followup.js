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
    const { 
      question, 
      answer, 
      questionIndex,
      totalQuestions,
      followUpsAskedSoFar,
      jobTitle,
      previousFollowUpTypes = []
    } = req.body;

    // Max 2-3 follow-ups per interview
    const maxFollowUps = 3;
    const remainingQuestions = totalQuestions - questionIndex - 1;
    
    // Don't ask follow-up if we've hit the max
    if (followUpsAskedSoFar >= maxFollowUps) {
      return res.status(200).json({ 
        shouldFollowUp: false, 
        reason: 'max_followups_reached' 
      });
    }

    // Evaluate if follow-up is needed
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are an expert interviewer for a ${jobTitle} position. Evaluate this answer and decide if a follow-up question is warranted.

QUESTION: "${question}"

CANDIDATE'S ANSWER (transcribed from speech, ignore grammar/spelling):
"${answer}"

CONTEXT:
- This is question ${questionIndex + 1} of ${totalQuestions}
- Follow-ups asked so far this interview: ${followUpsAskedSoFar}
- Maximum follow-ups allowed: ${maxFollowUps}
- Follow-up types already used: ${previousFollowUpTypes.join(', ') || 'none'}

EVALUATION CRITERIA - A follow-up is warranted ONLY if:
1. LACKS SPECIFICS: Said "I improved metrics" but gave no numbers, timeframes, or concrete examples
2. MISSED KEY DIMENSION: Explained technical approach but not stakeholder buy-in, or vice versa
3. SIGNIFICANTLY SHORT: Gave 30 seconds on a question needing a full STAR response (but don't penalize concise answers that were actually complete)

DO NOT follow up if:
- Answer was thorough and specific (even if short)
- Candidate said "I don't have experience with that" (nothing to probe)
- Answer was 3 minutes of detailed, complete response

FOLLOW-UP TYPES (choose one that hasn't been used yet if possible):
- DEPTH_PROBE: When they mention a result without the process ("you said you increased retention by 40%, walk me through exactly what you changed")
- MISSING_ELEMENT: When they covered one angle but missed another ("you explained the technical solution but how did you get your team aligned?")
- CHALLENGE: When the answer sounds good but untested ("what would you have done if the timeline was cut in half?")
- CLARIFICATION: When something is vague ("when you say you led a large team, how many people and what were their roles?")

CRITICAL: The follow-up MUST reference something SPECIFIC from their actual answer. Never generic questions like "tell me more about your experience."

Return ONLY valid JSON:
{
  "shouldFollowUp": true/false,
  "reason": "thorough_answer" | "lacks_specifics" | "missed_dimension" | "too_short" | "no_experience",
  "followUpType": "DEPTH_PROBE" | "MISSING_ELEMENT" | "CHALLENGE" | "CLARIFICATION" | null,
  "followUpQuestion": "specific follow-up question referencing their answer" | null,
  "whatWasMissing": "brief note on what the follow-up is probing for" | null
}`
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      throw new Error('Failed to evaluate answer');
    }

    const text = data.content[0].text;
    const cleanText = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanText);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error evaluating follow-up:', error);
    // On error, don't block the interview - just skip follow-up
    res.status(200).json({ 
      shouldFollowUp: false, 
      reason: 'evaluation_error' 
    });
  }
}
