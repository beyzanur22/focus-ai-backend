const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

// Hassas uçlar için hız sınırı (brute-force koruması)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme. Lütfen biraz sonra tekrar dene.' },
});

// Doğrulama hatalarını tek noktada yakala
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

// Async controller hatalarını yakala
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  '/register',
  authLimiter,
  body('email').isEmail().withMessage('Geçerli bir e-posta gir.'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı.'),
  validate,
  wrap(ctrl.register)
);

router.post(
  '/verify-otp',
  authLimiter,
  body('email').isEmail(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Kod 6 haneli olmalı.'),
  validate,
  wrap(ctrl.verifyOtpHandler)
);

router.post('/resend-otp', authLimiter, body('email').isEmail(), validate, wrap(ctrl.resendOtp));

router.post(
  '/login',
  authLimiter,
  body('email').isEmail(),
  body('password').notEmpty(),
  validate,
  wrap(ctrl.login)
);

router.post(
  '/forgot-password',
  authLimiter,
  body('email').isEmail().withMessage('Geçerli bir e-posta gir.'),
  validate,
  wrap(ctrl.forgotPassword)
);

router.post(
  '/reset-password',
  authLimiter,
  body('email').isEmail(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Kod 6 haneli olmalı.'),
  body('new_password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı.'),
  validate,
  wrap(ctrl.resetPassword)
);

router.post('/logout', wrap(ctrl.logout));

module.exports = router;
