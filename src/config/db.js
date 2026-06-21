const { Pool } = require('pg');

// PostgreSQL bağlantı havuzu
// Localhost dışındaki (Neon, Render, Railway vb.) bağlantılar SSL ister
const url = process.env.DATABASE_URL || '';
const isLocal = url.includes('localhost') || url.includes('127.0.0.1');

const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Beklenmeyen PostgreSQL hatası:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
