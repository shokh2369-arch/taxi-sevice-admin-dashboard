import { apiGet, API_BASE } from '../api.js';

/**
 * Legal routes to try (same host as /admin/dashboard).
 * Order: plain /admin first, then common Go gateway prefixes, then /v1.
 */
const LEGAL_BASES = [
  '/admin/legal',
  '/api/admin/legal',
  '/api/v1/admin/legal',
  '/v1/admin/legal'
];

/**
 * @param {string} resourcePath path after .../legal e.g. `/stats`, `/acceptances`, `/missing?actor_type=user`
 */
async function legalGet(resourcePath) {
  const attemptedPaths = [];
  let lastNon404 = /** @type {Error|null} */ (null);

  for (const base of LEGAL_BASES) {
    const path = `${base}${resourcePath}`;
    attemptedPaths.push(path);
    try {
      return await apiGet(path);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.message.includes('404')) continue;
      lastNon404 = err;
      throw err;
    }
  }

  if (lastNon404) throw lastNon404;

  const fullUrls = attemptedPaths.map((p) => `${API_BASE}${p}`);
  throw new Error(
    `Legal API: all routes returned 404. Tried:\n${fullUrls.map((u) => `  • GET ${u}`).join('\n')}\n` +
      `Implement legal handlers on this API, or set VITE_API_BASE_URL / VITE_API_URL to the Go server that exposes them.`
  );
}

/**
 * @returns {Promise<unknown>}
 */
export function fetchLegalStats() {
  return legalGet('/stats');
}

/**
 * @param {string} [queryString] optional e.g. "driver_id=1" (without leading ?)
 * @returns {Promise<unknown>}
 */
export function fetchLegalAcceptances(queryString = '') {
  const q = queryString
    ? queryString.startsWith('?')
      ? queryString
      : `?${queryString}`
    : '';
  return legalGet(`/acceptances${q}`);
}

/**
 * @param {'user'|'driver'} [actorType]
 * @returns {Promise<unknown>}
 */
export function fetchLegalMissing(actorType) {
  const q = actorType ? `?actor_type=${encodeURIComponent(actorType)}` : '';
  return legalGet(`/missing${q}`);
}

/**
 * GET /admin/legal/documents (same /admin group as dashboard; mounted when legal service is enabled).
 * @returns {Promise<unknown>}
 */
export function fetchLegalDocuments() {
  return legalGet('/documents');
}
