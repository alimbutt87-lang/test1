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
    const { jobTitle, jobDescription } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
          content: `You are a hiring manager at a top company conducting a behavioral interview.

JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription || 'General role responsibilities'}

STEP 1: Identify the 3-5 most critical skills for success in THIS specific role based on the job title and description.

STEP 2: Generate exactly 5 interview questions.

QUESTION MIX:
- 3 behavioral questions ("Tell me about a time...")
- 1 situational question ("What would you do if...")
- 1 role-specific question (directly tests a key skill for this job)

HARD RULES - DO NOT BREAK:

1. LENGTH: Each question MUST be 10-25 words. Count the words. If over 25, rewrite shorter.

2. FORMAT: One clear question. No multi-part questions. No "and also". No bullet points.

3. TONE: Sound like a real person speaking, not a textbook.
   USE: "Tell me about a time...", "Walk me through...", "Give me an example of...", "What would you do if..."
   AVOID: "Describe a scenario in which...", "Please elaborate on...", academic jargon

4. ONE SKILL PER QUESTION: Each question tests exactly ONE thing relevant to this role.

5. MAKE IT UNCOMFORTABLE: Questions should require real examples, probe challenges/failures/conflicts. No softball questions.

GOOD EXAMPLES:
- "Tell me about a time you failed at something. What happened?" (12 words)
- "Walk me through a project that didn't go as planned." (11 words)
- "Give me an example of when you disagreed with your manager." (12 words)
- "What would you do if a teammate wasn't pulling their weight?" (12 words)

BAD EXAMPLES (too long/complex):
- "Can you describe a situation where you had to work with multiple stakeholders who had competing priorities and explain how you managed to balance their needs while delivering the project on time?" (TOO LONG - 34 words)

Return ONLY a JSON array of exactly 5 question strings:
["question1", "question2", "question3", "question4", "question5"]`
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      throw new Error('Failed to generate questions');
    }

    const text = data.content[0].text;
    const cleanText = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(cleanText);

    res.status(200).json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    
    // Return fallback questions - also short and punchy
    const fallback = [
      "Tell me about a project you're most proud of. Why?",
      "Describe a time you had to learn something quickly.",
      "Give me an example of a difficult decision you made.",
      "What would you do if you disagreed with your manager's direction?",
      "Why do you want this role specifically?"
    ];
    
    res.status(200).json({ questions: fallback });
  }
}
