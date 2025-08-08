import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Missing API keys for both OpenAI and Gemini' });
  }

  const prompt = `
You are an AWS instructor. Generate one multiple-choice question (MCQ) focused ONLY on AWS cloud benefits.
Return a JSON object with:
- question: The question text
- options: An array of 4 choices (1 correct + 3 distractors)
- answer: The correct answer (must match one of the options exactly)

Respond only with a JSON object.
`;

  async function fetchGeminiQuiz() {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const geminiJson = await geminiRes.json();
      let text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      // Remove Markdown code fences if any
      text = text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```[a-zA-Z]*\n?|```$/g, '').trim();
      }

      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function fetchOpenAIQuiz() {
    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
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

      const json = await aiRes.json();
      const text = json.choices?.[0]?.message?.content || '{}';
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  let quiz = {};
  if (OPENAI_API_KEY) {
    quiz = await fetchOpenAIQuiz();
  }

  if (!quiz || Object.keys(quiz).length === 0) {
    quiz = await fetchGeminiQuiz();
  }

  res.status(200).json(quiz || {});
}
