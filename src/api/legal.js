import { apiGet } from '../api.js';

/** Try current Go routes first, then /v1 for older gateways. Same API host as /admin/dashboard. */
const LEGAL_BASES = ['/admin/legal', '/v1/admin/legal'];

/**
 * @param {string} resourcePath path after .../legal e.g. `/stats`, `/acceptances`, `/missing?actor_type=user`
 */
async function legalGet(resourcePath) {
  let lastErr = /** @type {Error|null} */ (null);
  for (const base of LEGAL_BASES) {
    try {
      return await apiGet(`${base}${resourcePath}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message.includes('404')) continue;
      throw lastErr;
    }
  }
  throw lastErr ?? new Error(`Legal API missing: tried ${LEGAL_BASES.join(', ')}${resourcePath}`);
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
