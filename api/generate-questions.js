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
    const { jobTitle, jobDescription, resume } = req.body;

    // Build the prompt based on available info
    let resumeSection = '';
    if (resume && resume.trim().length > 50) {
      resumeSection = `
CANDIDATE'S RESUME:
${resume}

IMPORTANT: Since you have the candidate's resume, ask questions that probe their SPECIFIC experience:
- Reference projects, companies, or roles from their resume
- Ask about gaps or transitions in their career
- Dig into skills they claim to have
- Ask "Tell me more about [specific thing from resume]"
`;
    }

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
${resumeSection}
CRITICAL: Your questions MUST be tailored to this SPECIFIC role${resume ? ' and the candidate\'s background' : ''}. Reference specific responsibilities, tools, skills, or challenges mentioned.

STEP 1: Read the job description${resume ? ' and resume' : ''} carefully. Identify:
- Key responsibilities mentioned
- Required skills/tools/technologies
- Team dynamics or stakeholders involved
- Challenges this role would face
${resume ? '- Specific experiences from the resume to probe deeper' : ''}

STEP 2: Generate exactly 5 interview questions.

QUESTION MIX:
- 3 behavioral questions ("Tell me about a time...") - tied to specific responsibilities${resume ? ' or their resume' : ''}
- 1 situational question ("What would you do if...") - based on a realistic challenge for this role
- 1 ${resume ? 'resume-specific question (probe something from their background)' : 'role-specific question - directly tests a skill/tool mentioned in the JD'}

HARD RULES:

1. LENGTH: 10-25 words per question. No exceptions.

2. SPECIFICITY: Questions must reference specifics from the job description${resume ? ' or resume' : ''}.
   BAD: "Tell me about a time you led a project."
   GOOD: "Tell me about a time you managed competing stakeholder priorities."
   ${resume ? 'BETTER: "I see you worked at [Company]. Tell me about a challenge you faced there."' : ''}

3. FORMAT: One clear question. No multi-part questions. No bullet points.

4. TONE: Natural spoken English.
   USE: "Tell me about a time...", "Walk me through...", "Give me an example...", "I noticed on your resume..."
   AVOID: "Describe a scenario in which...", academic jargon

5. ONE SKILL PER QUESTION: Each tests one specific thing.

6. CHALLENGING: Probe real challenges, failures, conflicts. No softballs.

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
