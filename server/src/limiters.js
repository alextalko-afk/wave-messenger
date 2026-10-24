import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Authenticated routes are limited per user (req.userId is set by
// authMiddleware, which must run first); anything else per client address.
const byUserOrIp = (req) => req.userId || ipKeyGenerator(req.ip);

const limiter = ({ windowMs, limit, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

/** Blanket ceiling for the whole API; generous, it only stops runaway clients. */
export const apiLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 600,
  message: 'Слишком много запросов. Попробуйте позже.',
});

/** Message and user search scan a lot of rows, so they get a tighter budget. */
export const searchLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 40,
  keyGenerator: byUserOrIp,
  message: 'Слишком много поисковых запросов. Попробуйте позже.',
});

export const uploadLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  keyGenerator: byUserOrIp,
  message: 'Слишком много загрузок. Попробуйте позже.',
});
