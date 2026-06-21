const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/tokens');

const OTP_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);

// Yeni OTP oluşturup e-posta gönderir
async function issueOtp(userId, email, purpose) {
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  const expires = new Date(Date.now() + OTP_MINUTES * 60 * 1000);

  // Aynı amaca yönelik eski, kullanılmamış kodları geçersiz kıl
  await db.query(
    `UPDATE email_verifications SET consumed_at = now()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose]
  );
  await db.query(
    `INSERT INTO email_verifications (user_id, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, codeHash, purpose, expires]
  );
  await sendOtpEmail(email, code, purpose);
}

// POST /api/auth/register
async function register(req, res) {
  const { full_name, email, password } = req.body;
  const emailNorm = email.trim().toLowerCase();

  const existing = await db.query('SELECT id, is_verified FROM users WHERE email = $1', [emailNorm]);
  if (existing.rows.length && existing.rows[0].is_verified) {
    return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // İlk admin: ADMIN_EMAIL ile eşleşen ilk hesap admin olur
  const isAdmin = emailNorm === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  let userId;
  if (existing.rows.length) {
    // Doğrulanmamış hesap varsa üzerine yaz (yeniden kayıt)
    userId = existing.rows[0].id;
    await db.query(
      'UPDATE users SET full_name = $1, password_hash = $2, is_admin = $3 WHERE id = $4',
      [full_name || null, passwordHash, isAdmin, userId]
    );
  } else {
    const ins = await db.query(
      `INSERT INTO users (full_name, email, password_hash, is_admin)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [full_name || null, emailNorm, passwordHash, isAdmin]
    );
    userId = ins.rows[0].id;
  }

  await issueOtp(userId, emailNorm, 'register');
  res.status(201).json({
    message: 'Kayıt alındı. E-postana gönderilen 6 haneli kodla hesabını doğrula.',
    email: emailNorm,
  });
}

// POST /api/auth/verify-otp  { email, code }
async function verifyOtpHandler(req, res) {
  const { email, code } = req.body;
  const emailNorm = email.trim().toLowerCase();

  const userRes = await db.query('SELECT * FROM users WHERE email = $1', [emailNorm]);
  if (!userRes.rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const user = userRes.rows[0];

  const otpRes = await db.query(
    `SELECT * FROM email_verifications
     WHERE user_id = $1 AND purpose = 'register' AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );
  if (!otpRes.rows.length) return res.status(400).json({ error: 'Aktif doğrulama kodu yok. Yeniden kod iste.' });
  const otp = otpRes.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Kodun süresi dolmuş. Yeniden kod iste.' });
  }
  if (otp.attempts >= 5) {
    return res.status(429).json({ error: 'Çok fazla hatalı deneme. Yeniden kod iste.' });
  }

  const ok = await verifyOtp(code, otp.code_hash);
  if (!ok) {
    await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    return res.status(400).json({ error: 'Kod hatalı.' });
  }

  await db.query('UPDATE email_verifications SET consumed_at = now() WHERE id = $1', [otp.id]);
  await db.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [user.id]);

  res.json({ message: 'Hesabın doğrulandı. Artık giriş yapabilirsin.' });
}

// POST /api/auth/resend-otp  { email }
async function resendOtp(req, res) {
  const emailNorm = req.body.email.trim().toLowerCase();
  const userRes = await db.query('SELECT id, is_verified FROM users WHERE email = $1', [emailNorm]);
  if (!userRes.rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  if (userRes.rows[0].is_verified) return res.status(400).json({ error: 'Hesap zaten doğrulanmış.' });

  await issueOtp(userRes.rows[0].id, emailNorm, 'register');
  res.json({ message: 'Yeni doğrulama kodu e-postana gönderildi.' });
}

// POST /api/auth/login  { email, password }
async function login(req, res) {
  const { email, password } = req.body;
  const emailNorm = email.trim().toLowerCase();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'];

  const logFail = (userId, reason) =>
    db.query(
      `INSERT INTO login_logs (user_id, email, success, reason, ip_address, user_agent)
       VALUES ($1, $2, FALSE, $3, $4, $5)`,
      [userId, emailNorm, reason, ip, ua]
    );

  const userRes = await db.query('SELECT * FROM users WHERE email = $1', [emailNorm]);
  if (!userRes.rows.length) {
    await logFail(null, 'Kullanıcı yok');
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  const user = userRes.rows[0];

  const passOk = await bcrypt.compare(password, user.password_hash);
  if (!passOk) {
    await logFail(user.id, 'Şifre hatalı');
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  if (!user.is_verified) {
    await logFail(user.id, 'Doğrulanmamış hesap');
    return res.status(403).json({ error: 'Önce e-posta adresini doğrula.', need_verification: true });
  }

  // Başarılı giriş
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [user.id, hashToken(refreshToken)]
  );
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await db.query(
    `INSERT INTO login_logs (user_id, email, success, reason, ip_address, user_agent)
     VALUES ($1, $2, TRUE, 'Başarılı', $3, $4)`,
    [user.id, emailNorm, ip, ua]
  );

  res.json({
    message: 'Giriş başarılı.',
    user: { id: user.id, full_name: user.full_name, email: user.email, is_admin: user.is_admin },
    accessToken,
    refreshToken,
  });
}

// POST /api/auth/forgot-password  { email }
async function forgotPassword(req, res) {
  const emailNorm = req.body.email.trim().toLowerCase();
  const userRes = await db.query('SELECT id, is_verified FROM users WHERE email = $1', [emailNorm]);
  if (!userRes.rows.length) {
    return res.status(404).json({ error: 'Bu e-posta ile kayıtlı hesap bulunamadı.' });
  }
  if (!userRes.rows[0].is_verified) {
    return res.status(403).json({ error: 'Önce hesabını doğrulaman gerekiyor.' });
  }
  await issueOtp(userRes.rows[0].id, emailNorm, 'reset');
  res.json({ message: 'Şifre sıfırlama kodu e-postana gönderildi.' });
}

// POST /api/auth/reset-password  { email, code, new_password }
async function resetPassword(req, res) {
  const { email, code, new_password } = req.body;
  const emailNorm = email.trim().toLowerCase();

  const userRes = await db.query('SELECT * FROM users WHERE email = $1', [emailNorm]);
  if (!userRes.rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const user = userRes.rows[0];

  const otpRes = await db.query(
    `SELECT * FROM email_verifications
     WHERE user_id = $1 AND purpose = 'reset' AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );
  if (!otpRes.rows.length) {
    return res.status(400).json({ error: 'Aktif sıfırlama kodu yok. Yeniden kod iste.' });
  }
  const otp = otpRes.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Kodun süresi dolmuş. Yeniden kod iste.' });
  }
  if (otp.attempts >= 5) {
    return res.status(429).json({ error: 'Çok fazla hatalı deneme. Yeniden kod iste.' });
  }

  const ok = await verifyOtp(code, otp.code_hash);
  if (!ok) {
    await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    return res.status(400).json({ error: 'Kod hatalı.' });
  }

  const passwordHash = await bcrypt.hash(new_password, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
  await db.query('UPDATE email_verifications SET consumed_at = now() WHERE id = $1', [otp.id]);

  res.json({ message: 'Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.' });
}

// POST /api/auth/logout  { refreshToken }
async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [
      hashToken(refreshToken),
    ]);
  }
  res.json({ message: 'Çıkış yapıldı.' });
}

module.exports = {
  register,
  verifyOtpHandler,
  resendOtp,
  login,
  logout,
  forgotPassword,
  resetPassword,
};
