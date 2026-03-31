import { apiGet, apiPost } from '../api.js';

/**
 * POST /admin/drivers/:id/add-balance
 * - Default / cash: { amount, note } — bucket omitted (API treats as cash top-up).
 * - Promo: { amount, note, bucket: "promo" } — promotional credit only.
 *
 * @param {number|string} driverId
 * @param {{ amount: number, note?: string, bucket?: 'promo'|'cash' }} opts
 */
export async function addDriverBalance(driverId, opts) {
  const body = {
    amount: opts.amount,
    note: opts.note || undefined
  };
  if (opts.bucket === 'promo') {
    body.bucket = 'promo';
  }
  await apiPost(`/admin/drivers/${driverId}/add-balance`, body);
}

/**
 * POST /admin/drivers/:id/adjust-balance
 * Manual admin correction: signed delta applied to total balance.
 *
 * @param {number|string} driverId
 * @param {{ amount: number, reason?: string, admin_id: number }} body
 */
export async function adjustDriverBalance(driverId, body) {
  await apiPost(`/admin/drivers/${driverId}/adjust-balance`, body);
}

/**
 * POST /admin/drivers/:id/deduct-balance
 * Dedicated real cash balance deduction (amount > 0).
 *
 * @param {number|string} driverId
 * @param {{ amount: number, reason?: string }} body
 */
export async function deductDriverBalance(driverId, body) {
  return apiPost(`/admin/drivers/${driverId}/deduct-balance`, body);
}

/**
 * Try common ledger paths; returns JSON or null if none succeed.
 * @param {number|string} driverId
 */
export async function fetchDriverLedger(driverId) {
  const id = encodeURIComponent(String(driverId));
  const paths = [
    `/admin/drivers/${id}/ledger`,
    `/v1/admin/drivers/${id}/ledger`,
    `/admin/driver-ledger?driver_id=${id}`,
    `/v1/admin/driver-ledger?driver_id=${id}`
  ];
  for (const p of paths) {
    try {
      return await apiGet(p);
    } catch {
      /* try next */
    }
  }
  return null;
}
