import { apiGet } from '../api.js';

const LEGAL_PREFIX = '/v1/admin/legal';

/**
 * @returns {Promise<unknown>}
 */
export function fetchLegalStats() {
  return apiGet(`${LEGAL_PREFIX}/stats`);
}

/**
 * @returns {Promise<unknown>}
 */
export function fetchLegalAcceptances() {
  return apiGet(`${LEGAL_PREFIX}/acceptances`);
}

/**
 * @returns {Promise<unknown>}
 */
export function fetchLegalMissing() {
  return apiGet(`${LEGAL_PREFIX}/missing`);
}
