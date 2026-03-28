/** Backend API origin (same as /admin/dashboard). Not the static Vercel page URL unless it reverse-proxies /admin. */
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  'https://taxi-1-kpkh.onrender.com';

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
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status}`);
    }
    return res.json();
  } catch (e) {
    throw normalizeFetchError(e, 'GET', path);
  }
}

export async function apiPost(path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status}`);
    }
    return res;
  } catch (e) {
    throw normalizeFetchError(e, 'POST', path);
  }
}

export { API_BASE };
