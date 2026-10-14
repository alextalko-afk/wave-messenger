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

Сервер поднимется на `http://localhost:4100` (порт задаётся в `server/.env`).

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

Для push в Android-приложении положите `google-services.json` в `client/android/app/`, для iOS — загрузите ключ APNs в Firebase.
