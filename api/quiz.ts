import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Missing API keys for both OpenAI and Gemini' });
  }

  const prompt = `
You are an AWS instructor. Generate ONE multiple-choice question (MCQ) on ONE of the following topics (pick randomly for each request):
• AWS Cloud concepts
• Security and compliance in the AWS Cloud
• Core AWS services
• Economics of the AWS Cloud

The question must be clear, relevant, and technically correct.

Return ONLY a valid JSON object with:
- question: The question text
- options: An array of 4 OR 5 answer choices
    • If there are 4 options: exactly 1 correct answer + 3 distractors
    • If there are 5 options: exactly 2 correct answers + 3 distractors
- answer: 
    • If there is 1 correct answer: a string matching exactly one of the options
    • If there are 2 correct answers: an array containing exactly two strings, each matching one of the options

Constraints:
- The question must NOT ask "Which of the following is NOT..." — always ask positively
- Distractors must be plausible but clearly incorrect to someone with AWS knowledge
- The JSON must be valid and self-contained, without extra commentary, code fences, or Markdown
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
