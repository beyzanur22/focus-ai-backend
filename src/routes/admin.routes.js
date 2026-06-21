const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Tüm admin uçları: önce giriş, sonra admin yetkisi
router.use(requireAuth, requireAdmin);

router.get('/stats', wrap(ctrl.stats));
router.get('/users', wrap(ctrl.listUsers));
router.get('/login-logs', wrap(ctrl.loginLogs));

module.exports = router;
