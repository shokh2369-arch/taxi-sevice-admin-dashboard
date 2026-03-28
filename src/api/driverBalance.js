import { apiGet, apiPost } from '../api.js';

/**
 * @param {number|string} driverId
 * @param {{ amount: number, note?: string, bucket?: 'promo'|'cash' }} opts
 */
export async function addDriverBalance(driverId, opts) {
  const bucket = opts.bucket === 'cash' ? 'cash' : 'promo';
  const body = {
    amount: opts.amount,
    note: opts.note || undefined,
    bucket,
    balance_type: bucket
  };
  await apiPost(`/admin/drivers/${driverId}/add-balance`, body);
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
