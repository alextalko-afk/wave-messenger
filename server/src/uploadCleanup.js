import fs from 'fs';
import path from 'path';
import { all, run } from './db/index.js';
import { uploadsDir } from './paths.js';

const HOUR_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * HOUR_MS;
const QUOTA_LEDGER_RETENTION_SECONDS = 7 * 24 * 60 * 60;

// Files nothing points at any more: attachments of deleted messages,
// replaced avatars, uploads that were never sent. Only files older than the
// grace period are touched, so an attachment still being composed is safe.
async function referencedUploads() {
  const refs = new Set();
  const sources = [
    "SELECT file_url AS url FROM messages WHERE file_url LIKE '/uploads/%'",
    "SELECT avatar_url AS url FROM users WHERE avatar_url LIKE '/uploads/%'",
    "SELECT avatar_url AS url FROM conversations WHERE avatar_url LIKE '/uploads/%'",
  ];
  for (const sql of sources) {
    for (const row of await all(sql)) refs.add(row.url);
  }
  return refs;
}

export async function cleanUpOrphanedUploads({ maxAgeMs }) {
  const refs = await referencedUploads();
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const entry of await fs.promises.readdir(uploadsDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    if (refs.has(`/uploads/${entry.name}`)) continue;
    const file = path.join(uploadsDir, entry.name);
    try {
      if ((await fs.promises.stat(file)).mtimeMs > cutoff) continue;
      await fs.promises.unlink(file);
      removed++;
    } catch (err) {
      console.error(`upload cleanup: could not remove ${entry.name}:`, err.message);
    }
  }
  const ledgerCutoff = Math.floor(Date.now() / 1000) - QUOTA_LEDGER_RETENTION_SECONDS;
  await run('DELETE FROM uploads WHERE created_at < ?', [ledgerCutoff]);
  return removed;
}

/**
 * Periodically deletes orphaned files from the local uploads directory.
 * Off unless explicitly enabled (UPLOAD_CLEANUP=1) or running in production:
 * a dev checkout's uploads directory is not backed by a database that knows
 * about its files.
 */
export function startUploadCleanup() {
  const enabled = process.env.UPLOAD_CLEANUP ? process.env.UPLOAD_CLEANUP === '1' : process.env.NODE_ENV === 'production';
  if (!enabled || process.env.CLOUDINARY_CLOUD_NAME) return;
  const maxAgeMs = (Number(process.env.UPLOAD_ORPHAN_MAX_AGE_HOURS) || 24) * HOUR_MS;
  const tick = () =>
    cleanUpOrphanedUploads({ maxAgeMs })
      .then((removed) => removed && console.log(`upload cleanup: removed ${removed} orphaned file(s)`))
      .catch((err) => console.error('upload cleanup failed:', err));
  tick();
  setInterval(tick, CLEANUP_INTERVAL_MS).unref();
}
