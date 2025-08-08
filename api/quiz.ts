import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  async function fetchGeminiQuiz(prompt: string) {
    if (!GEMINI_API_KEY) {
      return { error: 'Missing Gemini API key' };
    }
    try {
      const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const geminiJson = await geminiRes.json();
      const geminiContent = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      let geminiQuiz = null;
      let geminiParseError = null;
      try {
        geminiQuiz = JSON.parse(geminiContent);
      } catch (err) {
        geminiParseError = err instanceof Error ? err.message : String(err);
      }
      return {
        quiz: geminiQuiz,
        parseError: geminiParseError,
        content: geminiContent,
        geminiResponse: geminiJson
      };
    } catch (err) {
      return { error: 'Failed to fetch Gemini response', details: err instanceof Error ? err.message : String(err) };
    }
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
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const json = await aiRes.json();
    const content = json.choices?.[0]?.message?.content || '{}';
    let quiz = null;
    let parseError = null;
    let openaiError = json.error;
    try {
      quiz = JSON.parse(content);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }

    if (openaiError || parseError || !quiz || Object.keys(quiz).length === 0) {
      // Fallback to Gemini if OpenAI fails
      const geminiResult = await fetchGeminiQuiz(prompt);
      res.status(200).json({
        source: 'gemini',
        ...geminiResult,
        openaiError,
        openaiContent: content,
        openaiResponse: json
      });
    } else {
      res.status(200).json({
        source: 'openai',
        quiz,
        parseError,
        content,
        openaiResponse: json
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI response', details: err instanceof Error ? err.message : String(err) });
  }
}
