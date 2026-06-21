const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/ai.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// AI istekleri için makul bir hız sınırı (kota koruması)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok hızlı gidiyorsun, biraz bekle.' },
});

router.post('/chat', requireAuth, aiLimiter, wrap(ctrl.chat));

module.exports = router;
