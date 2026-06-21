const jwt = require('jsonwebtoken');

// Access token doğrular, req.user'a kullanıcı bilgisini koyar
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, email: payload.email, is_admin: payload.is_admin };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }
}

// Sadece admin erişebilir
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
