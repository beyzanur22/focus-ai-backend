// Google Gemini API'ye istek atan yardımcı.
// Node 18+ yerleşik fetch kullanır.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

async function askGemini(systemText, userText) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY tanımlı değil.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
        // 2.5 modellerinde gereksiz "düşünme" token harcamasını kapat
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Gemini isteği başarısız.';
    throw new Error(msg);
  }

  const reply =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return reply.trim() || 'Şu an bir yanıt üretemedim, tekrar dener misin?';
}

module.exports = { askGemini };
