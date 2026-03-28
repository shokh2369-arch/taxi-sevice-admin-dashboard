/**
 * True when legal client exhausted path fallbacks (all 404).
 * @param {string} [msg]
 */
export function isLegalAllRoutes404(msg) {
  return typeof msg === 'string' && msg.includes('all routes returned 404');
}
