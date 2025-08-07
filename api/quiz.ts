import type { VercelRequest, VercelResponse } from '@vercel/node';
import { log } from 'console';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  const prompt = `
You are an AWS instructor. Generate one multiple-choice question (MCQ) focused ONLY on AWS cloud benefits.
Return a JSON object with:
- question: The question text
- options: An array of 4 choices (1 correct + 3 distractors)
- answer: The correct answer (must match one of the options exactly)

Respond only with a JSON object.
`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const json = await aiRes.json();
    console.log(json);
    const content = json.choices?.[0]?.message?.content || '{}';
    console.log(content);
    let quiz = null;
    let parseError = null;
    try {
      quiz = JSON.parse(content);
       console.log(quiz);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
    res.status(200).json({
      quiz,
      parseError,
      content,
      openaiResponse: json
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI response' });
  }
}
