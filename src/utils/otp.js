const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// 6 haneli rastgele OTP üretir (kriptografik olarak güvenli)
function generateOtp() {
  // 000000 - 999999 arası, baştaki sıfırlar korunur
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, '0');
}

// OTP'yi hash'leyerek saklarız (düz metin asla DB'ye yazılmaz)
async function hashOtp(code) {
  return bcrypt.hash(code, 10);
}

async function verifyOtp(code, hash) {
  return bcrypt.compare(code, hash);
}

module.exports = { generateOtp, hashOtp, verifyOtp };
