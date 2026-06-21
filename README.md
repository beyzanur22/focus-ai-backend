# Focus AI — Backend API

Yapay Zeka Destekli Odaklanma Asistanı için kimlik doğrulama (kayıt + e-posta OTP 2FA + giriş),
oturum yönetimi ve admin paneli backend'i.

**Teknolojiler:** Node.js · Express · PostgreSQL · JWT · bcrypt · Nodemailer (Gmail SMTP)

---

## Kurulum (adım adım)

### 1. Gereksinimler
- [Node.js](https://nodejs.org) 18+
- [PostgreSQL](https://www.postgresql.org/download/) 14+

### 2. Bağımlılıkları yükle
```bash
cd focus_ai_backend
npm install
```

### 3. Ortam değişkenleri
`.env.example` dosyasını `.env` olarak kopyala ve doldur:
```bash
copy .env.example .env      # Windows
```
- `DATABASE_URL` → PostgreSQL bağlantın
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` → rastgele üret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `SMTP_USER` / `SMTP_PASS` → Gmail **Uygulama Şifresi**
  (Gmail → Hesap → Güvenlik → 2 Adımlı Doğrulama → Uygulama Şifreleri)
- `ADMIN_EMAIL` → bu e-posta ile kayıt olan ilk hesap otomatik admin olur

### 4. Veritabanını oluştur
PostgreSQL'de bir veritabanı aç:
```sql
CREATE DATABASE focus_ai;
```
Tabloları kur:
```bash
npm run migrate
```

### 5. Sunucuyu başlat
```bash
npm run dev      # geliştirme (otomatik yeniden başlatma)
npm start        # üretim
```
`http://localhost:4000/health` → `{ "status": "ok" }` dönerse hazır.

---

## API uçları

### Auth — `/api/auth`
| Metot | Uç | Açıklama |
|---|---|---|
| POST | `/register` | `{ full_name, email, password }` → e-postaya OTP gönderir |
| POST | `/verify-otp` | `{ email, code }` → hesabı doğrular |
| POST | `/resend-otp` | `{ email }` → yeni kod gönderir |
| POST | `/login` | `{ email, password }` → `accessToken` + `refreshToken` |
| POST | `/logout` | `{ refreshToken }` → oturumu kapatır |

### Admin — `/api/admin` (Bearer token + admin yetkisi)
| Metot | Uç | Açıklama |
|---|---|---|
| GET | `/stats` | Özet sayılar (kullanıcı, oturum, son 24s giriş) |
| GET | `/users` | Kullanıcı listesi |
| GET | `/login-logs` | Kim ne zaman giriş yaptı (IP, sonuç) |

---

## Hızlı test (curl)
```bash
# Kayıt
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"full_name\":\"Beyza\",\"email\":\"mailin@gmail.com\",\"password\":\"123456\"}"

# E-postadaki kodu doğrula
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"mailin@gmail.com\",\"code\":\"123456\"}"

# Giriş
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"mailin@gmail.com\",\"password\":\"123456\"}"
```

---

## Yol haritası (sonraki adımlar)
- [ ] Flutter tarafına giriş/kayıt ekranları + token saklama (secure storage)
- [ ] React admin paneli (kullanıcılar, giriş kayıtları, istatistikler)
- [ ] "Mum sönene kadar çalış" modu (sunucu destekli oturum + sıralama)
- [ ] Odak oturumlarının buluta senkronizasyonu
- [ ] Refresh token yenileme ucu (`/api/auth/refresh`)
- [ ] Docker + deploy
