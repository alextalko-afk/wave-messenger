# Wave — мессенджер

Полноценный мессенджер: React + Vite + Tailwind на фронтенде, Node.js/Express + Socket.io + SQLite (`node:sqlite`) на бэкенде.

## Возможности

- Регистрация и вход (JWT)
- Личные и групповые чаты
- Сообщения в реальном времени (Socket.io)
- Индикатор "печатает…"
- Статус онлайн/оффлайн, "был(а) в…"
- Прочитано/непрочитано, счётчик непрочитанных
- Редактирование и удаление сообщений
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
