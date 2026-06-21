require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();

app.use(helmet());
app.use(express.json());
// Mobil uygulama (origin yok) ve admin paneli erişebilsin
app.use(
  cors({
    origin: [process.env.ADMIN_ORIGIN || 'http://localhost:5173'],
    credentials: true,
  })
);
app.set('trust proxy', 1); // doğru IP loglamak için (reverse proxy arkasında)

// Sağlık kontrolü
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'focus-ai-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// React admin panelini (build edilmiş hali) /panel altından servis et
// Böylece tek terminal yeter: backend açıkken panel http://localhost:4000/panel
const panelDist = path.join(__dirname, '..', '..', 'focus_ai_admin', 'dist');
app.use('/panel', express.static(panelDist));
// SPA: /panel/* altındaki tüm yolları index.html'e yönlendir
app.get('/panel/*', (req, res) => res.sendFile(path.join(panelDist, 'index.html')));

// 404
app.use((req, res) => res.status(404).json({ error: 'Uç bulunamadı.' }));

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Focus AI backend http://localhost:${PORT} adresinde çalışıyor`);
});
