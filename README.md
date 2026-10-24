# Wave — мессенджер

Полноценный мессенджер: React + Vite + Tailwind на фронтенде, Node.js/Express + Socket.io + SQLite (`node:sqlite`) на бэкенде.

## Возможности

- Регистрация и вход (JWT)
- Личные и групповые чаты
- Сообщения в реальном времени (Socket.io)
- Индикатор "печатает…"
- Статус онлайн/оффлайн, "был(а) в…"
- Статусы сообщений: отправлено / доставлено / прочитано, счётчик непрочитанных
- Редактирование и удаление сообщений, ответы с цитатой
- Реакции на сообщения (8 эмодзи, по одной на пользователя)
- Поиск по сообщениям (с учётом кириллицы) и по пользователям
- Push-уведомления в нативных приложениях (Capacitor, FCM)
- Голосовые и видеозвонки (WebRTC, опционально TURN)
- Отправка файлов и изображений
- Тёмная и светлая тема
- Адаптивная вёрстка (мобильные устройства)

## Запуск

### 1. Бэкенд

```bash
cd server
npm install
npm run dev
```

Сервер поднимется на порту из `server/.env` (`PORT=4100`; dev-прокси клиента в `client/vite.config.js` ждёт именно 4100). Если `PORT` не задан, используется 4000.

### 2. Фронтенд

```bash
cd client
npm install
npm run dev
```

Откройте `http://localhost:5174` (или порт из `client/vite.config.js`).

## Структура

```
messenger/
  server/   — Express API + Socket.io + SQLite
  client/   — React SPA (Vite + Tailwind)
```

База данных — файл `server/messenger.db` (SQLite), создаётся автоматически при первом запуске.

## Настройка сервера (переменные окружения)

| Переменная | Назначение |
| --- | --- |
| `JWT_SECRET` | **Обязательна.** Секрет подписи токенов; без неё сервер не стартует. Не коммитьте `.env`. |
| `PORT`, `CLIENT_ORIGIN` | Порт и разрешённый origin для CORS. |
| `DB_PATH` / `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Локальный SQLite или удалённая БД Turso. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Хранилище загрузок (иначе — локальная папка `uploads`). |
| `GOOGLE_CLIENT_ID` | Вход через Google. |
| `ALLOW_DEV_PHONE_CODE=1` | Только для разработки: вход по телефону с кодом прямо в ответе. Без SMS-шлюза по умолчанию отключён (503). |
| `FIREBASE_SERVICE_ACCOUNT` | JSON сервис-аккаунта Firebase (сырой или base64) — включает push. Без него push не отправляется. |
| `TURN_URLS`, `TURN_SECRET` | TURN-сервер для звонков (coturn `use-auth-secret`, временные учётные данные). Либо `TURN_USERNAME` + `TURN_CREDENTIAL`. |
| `STUN_URLS` | Список STUN через запятую (по умолчанию публичные Google STUN). |
| `TRUST_PROXY` | Сколько прокси стоит перед сервером (по умолчанию `1` в production: Fly.io). Без этого лимиты запросов считаются по адресу прокси, а не клиента. |
| `UPLOAD_MAX_MB`, `UPLOAD_DAILY_QUOTA_MB` | Максимальный размер файла (25) и суточная квота загрузок на пользователя (500). |
| `UPLOAD_CLEANUP`, `UPLOAD_ORPHAN_MAX_AGE_HOURS` | Удаление «осиротевших» файлов из локальной папки `uploads` (по умолчанию включено только в production; возраст 24 ч). |
| `AUTH_CACHE_TTL_MS` | Сколько секунд сервер кеширует версию токена пользователя (по умолчанию 10000). |
| `TOTP_ENCRYPTION_KEY` | Ключ шифрования секретов двухэтапной проверки. По умолчанию берётся из `JWT_SECRET`; задайте отдельный, если планируете менять `JWT_SECRET` (иначе включённая защита перестанет работать). |

`CLIENT_ORIGIN` можно задать списком через запятую.

## Безопасность и API

- Токены можно отозвать: `POST /api/auth/change-password` и `POST /api/auth/revoke-sessions` инвалидируют все выданные ранее токены (в ответе приходит новый `token` для текущего устройства), а сокеты со старым токеном закрываются. Токен удалённого пользователя перестаёт работать.
- Двухэтапная проверка (Google Authenticator и любые TOTP-приложения): `POST /api/auth/2fa/setup` и `/2fa/enable` включают её и выдают 10 одноразовых резервных кодов, `/2fa/disable` и `/2fa/recovery-codes` требуют код. Если защита включена, `/login` и `/google` отвечают `{ twoFactorRequired, challengeToken }`, а сессию выдаёт `POST /api/auth/2fa/verify`. После 5 неверных кодов шаг блокируется на 5 минут. Мобильные приложения шаг с кодом пока не поддерживают.
- Загрузки: исполняемые и скриптовые типы (`.html`, `.svg`, `.js`, `.exe`, …) отклоняются, аватары принимаются только как JPEG/PNG/GIF/WebP с проверкой сигнатуры файла, на пользователя действуют лимит частоты и суточная квота.
- Заголовки: `helmet` (HSTS, nosniff, frame-ancestors…); CSP пока в режиме `Report-Only` — проверьте консоль браузера и переключите на боевой режим в `server/src/index.js`.
- Пагинация (курсор по `before` + `beforeId`, чтобы не терять сообщения одной секунды): `GET /conversations/:id/messages`, `/media`, `/api/search/messages`, `/api/calls` принимают `limit`, `before`, `beforeId` и возвращают `hasMore` и `nextCursor`; `GET /api/conversations` и `GET /api/users/search` — `limit` и `offset`.

Для push в Android-приложении положите `google-services.json` в `client/android/app/`, для iOS — загрузите ключ APNs в Firebase.
