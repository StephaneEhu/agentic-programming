import type { VercelRequest, VercelResponse } from '@vercel/node';

module.exports= async function handler(req: VercelRequest, res: VercelResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  const prompt = `You are an AWS instructor...`;

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
    const content = json.choices?.[0]?.message?.content || '{}';
    const quiz = JSON.parse(content);

    res.status(200).json(quiz);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI response' });
  }
}
