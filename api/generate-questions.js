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
          content: `You are a hiring manager conducting a behavioral interview for the specific role below.

JOB TITLE: ${jobTitle}

JOB DESCRIPTION: 
${jobDescription || 'General role responsibilities'}

CRITICAL: Your questions MUST be tailored to this SPECIFIC role and job description. Reference specific responsibilities, tools, skills, or challenges mentioned in the job description.

STEP 1: Read the job description carefully. Identify:
- Key responsibilities mentioned
- Required skills/tools/technologies
- Team dynamics or stakeholders involved
- Challenges this role would face

STEP 2: Generate exactly 5 interview questions that directly relate to what's in the job description.

QUESTION MIX:
- 3 behavioral questions ("Tell me about a time...") - tied to specific responsibilities in the JD
- 1 situational question ("What would you do if...") - based on a realistic challenge for this role
- 1 role-specific question - directly tests a skill/tool mentioned in the JD

HARD RULES:

1. LENGTH: 10-25 words per question. No exceptions.

2. SPECIFICITY: Questions must reference specifics from the job description.
   BAD: "Tell me about a time you led a project."
   GOOD: "Tell me about a time you managed competing stakeholder priorities." (if JD mentions stakeholder management)

3. FORMAT: One clear question. No multi-part questions. No bullet points.

4. TONE: Natural spoken English.
   USE: "Tell me about a time...", "Walk me through...", "Give me an example..."
   AVOID: "Describe a scenario in which...", academic jargon

5. ONE SKILL PER QUESTION: Each tests one specific thing from the JD.

6. CHALLENGING: Probe real challenges, failures, conflicts. No softballs.

EXAMPLES OF GOOD ROLE-SPECIFIC QUESTIONS:
- For PM role mentioning roadmap: "Walk me through how you'd prioritize a cluttered product roadmap."
- For engineer role mentioning scale: "Tell me about a time you debugged a production issue under pressure."
- For sales role mentioning quotas: "Give me an example of a deal you lost. What happened?"

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
