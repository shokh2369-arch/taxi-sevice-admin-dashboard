import { apiGet } from '../api.js';

/** Same host as /admin/dashboard — no /v1 prefix (Go API admin routes). */
const LEGAL_PREFIX = '/admin/legal';

/**
 * @returns {Promise<unknown>}
 */
export function fetchLegalStats() {
  return apiGet(`${LEGAL_PREFIX}/stats`);
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
  return apiGet(`${LEGAL_PREFIX}/acceptances${q}`);
}

/**
 * @param {'user'|'driver'} [actorType]
 * @returns {Promise<unknown>}
 */
export function fetchLegalMissing(actorType) {
  const q = actorType ? `?actor_type=${encodeURIComponent(actorType)}` : '';
  return apiGet(`${LEGAL_PREFIX}/missing${q}`);
}
