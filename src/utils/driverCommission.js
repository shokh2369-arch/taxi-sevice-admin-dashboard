/**
 * Internal commission amount shown per driver (list + detail).
 *
 * Prefer explicit API fields when the Go backend adds them.
 * Fallback: `total_paid` (legacy) if nothing else matches.
 *
 * **Dashboard aggregate:** `GET /admin/dashboard` → `total_internal_commission_accrued`
 * (sum of internal commission accruals — see `normalizeDashboardBalances` / DashboardView).
 *
 * **Optional per-driver source:** aggregate `GET /admin/drivers/:id/ledger` rows where
 * `entry_type === 'COMMISSION_ACCRUED'` (not fetched on list for performance).
 *
 * @param {Record<string, unknown>} root
 * @param {Record<string, unknown>} app
 */
export function pickDriverInternalCommission(root, app) {
  const keys = [
    'internal_commission_accrued',
    'total_internal_commission',
    'commission_accrued',
    'accrued_commission',
    'total_commission_accrued',
    'total_paid',
    'totalPaid',
    'paid_total'
  ];
  for (const k of keys) {
    const va = root?.[k];
    if (va != null && String(va).trim() !== '') return Number(va) || 0;
    const vb = app?.[k];
    if (vb != null && String(vb).trim() !== '') return Number(vb) || 0;
  }
  return 0;
}
