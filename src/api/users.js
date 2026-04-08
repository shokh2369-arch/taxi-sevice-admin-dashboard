import { apiGet } from '../api.js';

/**
 * Ordered list: canonical Go admin route first, then fallbacks some stacks use.
 */
const USER_LIST_PATHS = [
  '/admin/users',
  '/api/admin/users',
  '/api/v1/admin/users',
  '/v1/admin/users',
  '/admin/passengers',
  '/api/admin/passengers',
  '/api/v1/admin/passengers',
  '/v1/admin/passengers',
  '/admin/riders',
  '/api/admin/riders',
  '/api/v1/admin/riders',
  '/v1/admin/riders'
];

/**
 * @returns {Promise<unknown>}
 */
export async function fetchUsersList() {
  let lastErr = /** @type {Error|null} */ (null);
  for (const path of USER_LIST_PATHS) {
    try {
      return await apiGet(path);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message.includes('404')) continue;
      throw lastErr;
    }
  }
  throw lastErr ?? new Error(`Users list: tried ${USER_LIST_PATHS.join(', ')} — all 404`);
}
