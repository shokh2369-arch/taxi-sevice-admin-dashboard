/** Strip trailing slashes so `${API_BASE}/admin/...` never becomes `//admin`. */
function normalizeApiOrigin(v) {
  return String(v || '')
    .trim()
    .replace(/\/+$/, '');
}

/**
 * Origin that reaches the Go service (no trailing slash).
 * If the API lives under `/api`, set e.g. `https://host/api` — paths use `/admin/...` so you get `https://host/api/admin/...`.
 * Do not set `https://host/api/api` unless that is literally your mount path.
 */
const API_BASE = normalizeApiOrigin(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) ||
    'https://taxi-1-kpkh.onrender.com'
);

/** `include` if Go CORS uses credentialed requests + cookie/session (matches ADMIN_DASHBOARD_ORIGIN echo). Default `omit`. */
function fetchCredentials() {
  const c =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_CREDENTIALS) || '';
  const v = String(c).trim().toLowerCase();
  if (v === 'include') return 'include';
  if (v === 'same-origin') return 'same-origin';
  return 'omit';
}

function normalizeFetchError(err, method, path) {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'Failed to fetch') {
    return new Error(
      `Cannot reach backend API (${method} ${path}). Set VITE_API_BASE_URL or VITE_API_URL to your Go API origin.`
    );
  }
  return err instanceof Error ? err : new Error(`${method} ${path} failed`);
}

export async function apiGet(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { credentials: fetchCredentials() });
    const text = await res.text();
    if (!res.ok) {
      let detail = '';
      if (text) {
        try {
          const j = JSON.parse(text);
          if (j && typeof j === 'object') {
            detail =
              (typeof j.error === 'string' && j.error) ||
              (typeof j.message === 'string' && j.message) ||
              (typeof j.msg === 'string' && j.msg) ||
              '';
          }
        } catch {
          detail = text.slice(0, 280).trim();
        }
      }
      throw new Error(
        detail ? `GET ${path} failed: ${res.status} — ${detail}` : `GET ${path} failed: ${res.status}`
      );
    }
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    throw normalizeFetchError(e, 'GET', path);
  }
}

export async function apiPost(path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: fetchCredentials()
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status}`);
    }
    return res;
  } catch (e) {
    throw normalizeFetchError(e, 'POST', path);
  }
}

/**
 * POST JSON and parse JSON response.
 * Supports extra headers (e.g. X-Driver-Id) for driver-scoped admin actions.
 */
export async function apiPostJson(path, body, extraHeaders) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: fetchCredentials()
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = '';
      if (text) {
        try {
          const j = JSON.parse(text);
          if (j && typeof j === 'object') {
            detail =
              (typeof j.error === 'string' && j.error) ||
              (typeof j.message === 'string' && j.message) ||
              (typeof j.msg === 'string' && j.msg) ||
              '';
          }
        } catch {
          detail = text.slice(0, 280).trim();
        }
      }
      throw new Error(
        detail ? `POST ${path} failed: ${res.status} — ${detail}` : `POST ${path} failed: ${res.status}`
      );
    }
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    throw normalizeFetchError(e, 'POST', path);
  }
}

export { API_BASE };
