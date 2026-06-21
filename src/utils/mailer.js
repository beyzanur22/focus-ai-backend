const nodemailer = require('nodemailer');

// Gmail SMTP üzerinden e-posta gönderen taşıyıcı
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail "Uygulama Şifresi"
  },
});

// OTP doğrulama kodu e-postası gönderir
async function sendOtpEmail(to, code, purpose = 'register') {
  const baslik = purpose === 'login_2fa'
      ? 'Giriş doğrulama kodun'
      : purpose === 'reset'
          ? 'Şifre sıfırlama kodun'
          : 'E-posta doğrulama kodun';

  const html = `
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

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Focus AI — Doğrulama kodun: ${code}`,
    html,
  });
}

module.exports = { transporter, sendOtpEmail };
