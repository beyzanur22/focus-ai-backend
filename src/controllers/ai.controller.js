const { askGemini } = require('../utils/gemini');

// Yapay zeka koçun kişiliği ve görevi
const SYSTEM_BASE = `Sen "Focus AI" uygulamasının yapay zeka odak koçusun.
Görevin: öğrencilere odaklanma, ders çalışma, dikkat dağınıklığıyla baş etme ve
motivasyon konularında kısa, samimi ve uygulanabilir tavsiyeler vermek.
Türkçe konuş. Cevapların kısa ve net olsun (en fazla birkaç paragraf veya madde).
Kullanıcının odak verilerini dikkate alarak kişiselleştir. Tıbbi/psikolojik teşhis koyma;
gerekirse bir uzmana danışmayı öner. Konu dışı sorularda nazikçe odak/çalışma konusuna yönlendir.`;

// POST /api/ai/chat  { message, context? }
async function chat(req, res) {
  const { message, context } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mesaj boş olamaz.' });
  }

  // Kullanıcının odak istatistiklerini sistem talimatına ekle
  let systemText = SYSTEM_BASE;
  if (context && typeof context === 'object') {
    systemText += `\n\nKullanıcının güncel odak verileri:
- Toplam oturum: ${context.totalSessions ?? '?'}
- Ortalama odak skoru: ${context.avgScore ?? '?'}/100
- Toplam çalışma süresi (dk): ${context.totalMinutes ?? '?'}
- Son oturumda telefon kullanımı: ${context.lastPhoneCount ?? '?'} kez
Bu verilere göre kişiselleştir ama her cevapta hepsini tekrar sayma.`;
  }

  try {
    const reply = await askGemini(systemText, message.trim());
    res.json({ reply });
  } catch (err) {
    console.error('Gemini hatası:', err.message);
    res.status(502).json({ error: 'Yapay zekaya ulaşılamadı: ' + err.message });
  }
}

module.exports = { chat };
