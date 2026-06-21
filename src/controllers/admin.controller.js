const db = require('../config/db');

// GET /api/admin/stats — özet sayılar
async function stats(req, res) {
  const [users, verified, sessions, logins] = await Promise.all([
    db.query('SELECT count(*) FROM users'),
    db.query('SELECT count(*) FROM users WHERE is_verified = TRUE'),
    db.query('SELECT count(*) FROM focus_sessions'),
    db.query("SELECT count(*) FROM login_logs WHERE success AND created_at > now() - interval '24 hours'"),
  ]);
  res.json({
    total_users: Number(users.rows[0].count),
    verified_users: Number(verified.rows[0].count),
    total_sessions: Number(sessions.rows[0].count),
    logins_last_24h: Number(logins.rows[0].count),
  });
}

// GET /api/admin/users — kullanıcı listesi
async function listUsers(req, res) {
  const result = await db.query(
    `SELECT id, full_name, email, is_verified, is_admin, created_at, last_login_at
     FROM users ORDER BY created_at DESC LIMIT 200`
  );
  res.json({ users: result.rows });
}

// GET /api/admin/login-logs — kim ne zaman giriş yaptı
async function loginLogs(req, res) {
  const result = await db.query(
    `SELECT l.id, l.email, l.success, l.reason, l.ip_address, l.user_agent, l.created_at,
            u.full_name
     FROM login_logs l LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC LIMIT 200`
  );
  res.json({ logs: result.rows });
}

module.exports = { stats, listUsers, loginLogs };
