// Express 4 does not forward rejected promises from async route handlers to the
// error middleware, so any thrown error (e.g. a DB failure) becomes an
// unhandled rejection and kills the Node process. Patch Layer so a rejected
// handler calls next(err) instead.
import Layer from 'express/lib/router/layer.js';

Layer.prototype.handle_request = function handleRequest(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) {
    next(err);
  }
};
