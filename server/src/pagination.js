// Keyset pagination over rows ordered by (timestamp DESC, rowid DESC).
//
// Timestamps have one-second resolution, so a bare `timestamp < before` cursor
// silently skips every other row that shares the boundary second. Clients send
// the last row's timestamp as `before` and its id as `beforeId`; the id breaks
// the tie. Clients that only send `before` keep the old behaviour.

export function parseLimit(raw, fallback, max) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function parseCursor(query) {
  const before = query.before != null && query.before !== '' ? Number(query.before) : null;
  return {
    before: Number.isFinite(before) ? before : null,
    beforeId: typeof query.beforeId === 'string' && query.beforeId ? query.beforeId : null,
  };
}

/**
 * SQL fragment (starting with AND) that keeps only rows older than the cursor.
 * `table`/`alias` name the paginated table and the alias it has in the query.
 */
export function olderThan({ before, beforeId }, { table, alias, timeColumn = 'created_at' }) {
  if (before === null) return { sql: '', args: [] };
  const ts = `${alias}.${timeColumn}`;
  if (beforeId === null) return { sql: `AND ${ts} < ?`, args: [before] };
  return {
    sql: `AND (${ts} < ? OR (${ts} = ? AND ${alias}.rowid < (SELECT rowid FROM ${table} WHERE id = ?)))`,
    args: [before, before, beforeId],
  };
}

/** Splits `rows` (fetched with LIMIT limit + 1) into the page and its paging info. */
export function toPage(rows, limit, timeKey = 'created_at') {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    page,
    hasMore,
    nextCursor: hasMore && last ? { before: last[timeKey], beforeId: last.id } : null,
  };
}
