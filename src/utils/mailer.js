const nodemailer = require('nodemailer');

// OTP e-postası içeriği (HTML)
function buildHtml(code, purpose) {
  const baslik =
    purpose === 'login_2fa'
      ? 'Giriş doğrulama kodun'
      : purpose === 'reset'
        ? 'Şifre sıfırlama kodun'
        : 'E-posta doğrulama kodun';
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;
              background:#0B1020;color:#E8EAF2;border-radius:16px;padding:32px">
    <h1 style="color:#7C3AED;margin:0 0 4px">Focus AI</h1>
    <p style="color:#9AA3B2;margin:0 0 24px">${baslik}</p>
    <div style="background:#161B2E;border-radius:12px;padding:24px;text-align:center">
      <div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#06B6D4">${code}</div>
    </div>
    <p style="color:#9AA3B2;margin-top:24px;font-size:14px">
      Bu kod ${process.env.OTP_EXPIRES_MINUTES || 10} dakika geçerlidir.
      Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.
    </p>
  </div>`;
}

// --- 1) Brevo (HTTP API) — bulutta (Render) çalışır, SMTP engeli yoktur ---
async function sendViaBrevo(to, code, purpose) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: 'Focus AI' },
      to: [{ email: to }],
      subject: `Focus AI — Doğrulama kodun: ${code}`,
      htmlContent: buildHtml(code, purpose),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Brevo e-posta hatası: ' + t.slice(0, 200));
  }
}

// --- 2) Gmail SMTP — yerel geliştirmede çalışır ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendViaSmtp(to, code, purpose) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Focus AI — Doğrulama kodun: ${code}`,
    html: buildHtml(code, purpose),
  });
}

// OTP gönder — BREVO_API_KEY varsa Brevo (bulut), yoksa Gmail SMTP (yerel)
async function sendOtpEmail(to, code, purpose = 'register') {
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevo(to, code, purpose);
  } else {
    await sendViaSmtp(to, code, purpose);
  }
}

module.exports = { transporter, sendOtpEmail };
