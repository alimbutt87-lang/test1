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
          content: `You are an expert interviewer at a top tech company conducting a real job interview. Generate exactly 5 challenging, specific interview questions for this role:

Job Title: ${jobTitle}
Job Description: ${jobDescription || 'General role responsibilities'}

Requirements:
- Question 1: Behavioral (past experience, STAR format expected)
- Question 2: Technical/Role-specific skills
- Question 3: Problem-solving/situational
- Question 4: Leadership/teamwork
- Question 5: Culture fit/motivation

Make questions specific to this exact role, not generic. They should be challenging but fair.

Return ONLY a JSON array of 5 question strings, nothing else:
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
    
    // Return fallback questions
    const { jobTitle } = req.body;
    const fallback = [
      `Tell me about a challenging project you led that's relevant to the ${jobTitle} role.`,
      `What technical skills do you bring to this ${jobTitle} position?`,
      `Describe a time you had to solve a complex problem under pressure.`,
      `How do you collaborate with cross-functional teams?`,
      `Why are you interested in this role and what motivates you?`
    ];
    
    res.status(200).json({ questions: fallback });
  }
}
