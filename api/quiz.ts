import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Missing both OpenAI and Gemini API keys' });
  }

  const prompt = `
You are an AWS instructor. Generate one multiple-choice question (MCQ) focused ONLY on AWS cloud benefits.
Return a JSON object with:
- question: The question text
- options: An array of 4 choices (1 correct + 3 distractors)
- answer: The correct answer (must match one of the options exactly)
Respond only with a JSON object.
`;

  async function fetchGemini(prompt: string) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Strip markdown fences if present
    if (content.trim().startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\n?|```$/g, '').trim();
    }

    let quiz = null;
    let parseError = null;
    try {
      quiz = JSON.parse(content);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }

    return { source: 'gemini', quiz, parseError, content };
  }

  async function fetchOpenAI(prompt: string) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
    const data = await res.json();

    let content = data.choices?.[0]?.message?.content || '{}';
    let quiz = null;
    let parseError = null;
    const error = data.error;
    try {
      quiz = JSON.parse(content);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }

    return { source: 'openai', quiz, parseError, content, error };
  }

  try {
    // Try OpenAI first
    let result = null;
    if (OPENAI_API_KEY) {
      result = await fetchOpenAI(prompt);
    }

    // If OpenAI failed or returned empty, try Gemini
    if (!result || result.error || result.parseError || !result.quiz || Object.keys(result.quiz).length === 0) {
      if (GEMINI_API_KEY) {
        result = await fetchGemini(prompt);
      } else {
        return res.status(500).json({ error: 'Both OpenAI and Gemini failed or are unavailable.' });
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error', details: err instanceof Error ? err.message : String(err) });
  }
}
