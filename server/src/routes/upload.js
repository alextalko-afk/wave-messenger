import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authMiddleware } from '../middleware/auth.js';
import { uploadsDir } from '../paths.js';
import { run, get } from '../db/index.js';
import { uploadLimiter } from '../limiters.js';
import { publicUser } from './auth.js';

const useCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

export const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB) || 25;
const MAX_AVATAR_MB = 10;
const DAILY_QUOTA_BYTES = Math.floor((Number(process.env.UPLOAD_DAILY_QUOTA_MB) || 500) * 1024 * 1024);
const DAY_SECONDS = 24 * 60 * 60;

// Anything that a browser, a shell or the OS would run or render as active
// content. Chat attachments are otherwise free-form (documents, archives...).
const BLOCKED_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.shtml', '.svg', '.svgz', '.xml', '.xsl', '.js', '.mjs', '.cjs', '.jsx', '.php', '.phtml',
  '.exe', '.dll', '.msi', '.scr', '.com', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.wsf', '.hta', '.lnk',
  '.cpl', '.jar', '.apk', '.sh', '.bash', '.reg', '.pif', '.gadget',
]);

// Avatars are rendered inline everywhere, so they are limited to plain raster
// images, checked by file signature and not just by the client's say-so.
const AVATAR_TYPES = {
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': {
    extensions: ['.png'],
    matches: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  'image/gif': { extensions: ['.gif'], matches: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  'image/webp': {
    extensions: ['.webp'],
    matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
};

const httpError = (status, message) => Object.assign(new Error(message), { status });
const extensionOf = (name) => path.extname(String(name || '')).toLowerCase();

function safeExtension(name) {
  const ext = extensionOf(name);
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

let storage;
let avatarStorage;
if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  storage = new CloudinaryStorage({
    cloudinary,
    params: () => ({ folder: 'wave-messenger', resource_type: 'auto' }),
  });
  avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: () => ({
      folder: 'wave-messenger',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    }),
  });
} else {
  // Local dev fallback: files live on disk and are lost on redeploy, but
  // that's fine for a local machine that isn't redeployed.
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    // The stored name is random; only a sanitised extension of the client's
    // name is kept, since it decides how the file is served back.
    filename: (req, file, cb) => cb(null, `${nanoid()}${safeExtension(file.originalname)}`),
  });
  avatarStorage = storage;
}

function attachmentFilter(req, file, cb) {
  if (BLOCKED_EXTENSIONS.has(extensionOf(file.originalname))) {
    return cb(httpError(415, 'Файлы такого типа отправлять нельзя'));
  }
  cb(null, true);
}

function avatarFilter(req, file, cb) {
  const type = AVATAR_TYPES[file.mimetype];
  const ext = extensionOf(file.originalname);
  if (!type || (ext && !type.extensions.includes(ext))) {
    return cb(httpError(415, 'Аватар должен быть изображением JPEG, PNG, GIF или WebP'));
  }
  cb(null, true);
}

const attachmentUpload = multer({ storage, limits: { fileSize: Math.floor(MAX_UPLOAD_MB * 1024 * 1024) }, fileFilter: attachmentFilter });
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: Math.floor(MAX_AVATAR_MB * 1024 * 1024) },
  fileFilter: avatarFilter,
});

// Turns multer's size error into a message that names the actual limit.
const sizeLimited = (handler, megabytes) => (req, res, next) =>
  handler(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') err = httpError(413, `Файл слишком большой (максимум ${megabytes} МБ)`);
    next(err);
  });

// Rolling 24h byte budget per user. The declared Content-Length is checked up
// front so an over-quota upload is refused before it is written anywhere.
async function enforceQuota(req, res, next) {
  const since = Math.floor(Date.now() / 1000) - DAY_SECONDS;
  const row = await get('SELECT COALESCE(SUM(size), 0) AS used FROM uploads WHERE user_id = ? AND created_at > ?', [
    req.userId,
    since,
  ]);
  const incoming = Number(req.headers['content-length']) || 0;
  if (Number(row.used) + incoming > DAILY_QUOTA_BYTES) {
    return res.status(413).json({ error: 'Суточный лимит загрузок исчерпан. Попробуйте завтра.' });
  }
  next();
}

export const uploadedUrl = (file) => (useCloudinary ? file.path : `/uploads/${file.filename}`);

function removeStoredFile(file) {
  if (!useCloudinary && file?.path) fs.promises.unlink(file.path).catch(() => {});
}

// Disk only (Cloudinary validates the format itself via allowed_formats).
async function verifyAvatarSignature(req, res, next) {
  if (!req.file || useCloudinary) return next();
  const header = Buffer.alloc(12);
  const handle = await fs.promises.open(req.file.path, 'r');
  try {
    await handle.read(header, 0, 12, 0);
  } finally {
    await handle.close();
  }
  if (!AVATAR_TYPES[req.file.mimetype]?.matches(header)) {
    removeStoredFile(req.file);
    return res.status(415).json({ error: 'Файл не является изображением' });
  }
  next();
}

async function recordUpload(req, res, next) {
  if (!req.file) return next();
  const size = Number(req.file.size) || Number(req.headers['content-length']) || 0;
  await run('INSERT INTO uploads (id, user_id, url, size) VALUES (?, ?, ?, ?)', [
    nanoid(),
    req.userId,
    uploadedUrl(req.file),
    size,
  ]);
  next();
}

/** Middleware chain for chat attachments; run after authMiddleware. Fills req.file. */
export const uploadAttachment = [
  uploadLimiter,
  enforceQuota,
  sizeLimited(attachmentUpload.single('file'), MAX_UPLOAD_MB),
  recordUpload,
];

/** Middleware chain for user and group avatars; run after authMiddleware. Fills req.file. */
export const uploadAvatar = [
  uploadLimiter,
  enforceQuota,
  sizeLimited(avatarUpload.single('file'), MAX_AVATAR_MB),
  verifyAvatarSignature,
  recordUpload,
];

const router = Router();

router.post('/', authMiddleware, ...uploadAttachment, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  res.json({
    url: uploadedUrl(req.file),
    name: req.file.originalname,
    type: req.file.mimetype,
  });
});

router.post('/avatar', authMiddleware, ...uploadAvatar, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  await run('UPDATE users SET avatar_url = ? WHERE id = ?', [uploadedUrl(req.file), req.userId]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});

router.delete('/avatar', authMiddleware, async (req, res) => {
  await run('UPDATE users SET avatar_url = NULL WHERE id = ?', [req.userId]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});

export { useCloudinary };
export default router;
