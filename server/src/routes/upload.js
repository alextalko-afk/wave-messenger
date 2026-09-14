import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authMiddleware } from '../middleware/auth.js';
import { uploadsDir } from '../paths.js';
import { run, get } from '../db/index.js';
import { publicUser } from './auth.js';

const useCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

let storage;
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
} else {
  // Local dev fallback: files live on disk and are lost on redeploy, but
  // that's fine for a local machine that isn't redeployed.
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${nanoid()}${path.extname(file.originalname)}`),
  });
}

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  res.json({
    url: useCloudinary ? req.file.path : `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype,
  });
});

router.post('/avatar', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  if (!req.file.mimetype?.startsWith('image/')) {
    return res.status(400).json({ error: 'Аватар должен быть изображением' });
  }
  const url = useCloudinary ? req.file.path : `/uploads/${req.file.filename}`;
  await run('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.userId]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});

export default router;
