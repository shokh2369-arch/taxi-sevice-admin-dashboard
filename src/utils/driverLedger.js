/** @typedef {{ entry_type: string, bucket: string, amount: number, created_at: string|null, note: string|null, reference_type: string|null, reference_id: string|null, expires_at: string|null }} LedgerRow */

const ENTRY_LABELS = {
  PROMO_GRANTED: 'Promo berildi',
  COMMISSION_ACCRUED: 'Komissiya hisoblandi',
  PROMO_APPLIED_TO_COMMISSION: 'Komissiyaga promo qo‘llandi',
  PROMO_EXPIRED: 'Promo muddati tugadi',
  MANUAL_ADJUSTMENT: 'Qo‘lda tuzatish',
  CASH_TOPUP: 'Naqd balans to‘ldirildi',
  CASH_DEDUCTION: 'Naqd balansdan yechildi',
  ADMIN_PROMO_TOPUP: 'Promo qo‘shildi (admin)',
  ADMIN_CASH_TOPUP: 'Naqd balans qo‘shildi (admin)'
};

const BUCKET_LABELS = {
  promo: 'Promo',
  cash: 'Naqd',
  PROMO: 'Promo',
  CASH: 'Naqd'
};

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function unwrapLedgerList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    for (const k of ['ledger', 'entries', 'items', 'rows', 'data', 'driver_ledger']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

/**
 * @param {unknown} row
 * @returns {LedgerRow|null}
 */
export function normalizeLedgerRow(row) {
  if (!row || typeof row !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const entryType = String(
    o.entry_type ?? o.entryType ?? o.type ?? o.event_type ?? o.eventType ?? ''
  )
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  const bucketRaw = String(o.bucket ?? o.balance_bucket ?? o.balanceBucket ?? 'promo')
    .trim()
    .toLowerCase();
  const bucket = bucketRaw === 'cash' ? 'cash' : 'promo';
  const amount = Number(o.amount ?? o.delta ?? o.value ?? 0);
  const created =
    o.created_at != null
      ? String(o.created_at)
      : o.createdAt != null
        ? String(o.createdAt)
        : null;
  if (!entryType && amount === 0 && !created) return null;
  return {
    entry_type: entryType || 'UNKNOWN',
    bucket,
    amount: Number.isFinite(amount) ? amount : 0,
    created_at: created,
    note: o.note != null ? String(o.note) : null,
    reference_type: o.reference_type != null ? String(o.reference_type) : o.referenceType != null ? String(o.referenceType) : null,
    reference_id:
      o.reference_id != null
        ? String(o.reference_id)
        : o.referenceId != null
          ? String(o.referenceId)
          : null,
    expires_at:
      o.expires_at != null ? String(o.expires_at) : o.expiresAt != null ? String(o.expiresAt) : null
  };
}

/**
 * @param {string} entryType
 */
export function ledgerEntryLabel(entryType) {
  const k = entryType.toUpperCase().replace(/-/g, '_');
  return ENTRY_LABELS[k] ?? entryType.replace(/_/g, ' ');
}

/**
 * @param {string} bucket
 */
export function ledgerBucketLabel(bucket) {
  return BUCKET_LABELS[bucket] ?? BUCKET_LABELS[bucket.toLowerCase()] ?? bucket;
}
