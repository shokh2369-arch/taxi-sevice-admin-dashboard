/**
 * Human-readable payment / ledger line types (avoid implying live bank settlement).
 * @param {unknown} type
 */
export function formatPaymentTypeLabel(type) {
  const t = String(type ?? '')
    .trim()
    .toLowerCase();
  if (!t) return '—';
  if (t === 'commission') return 'Hisoblangan komissiya';
  if (t === 'promo' || t === 'promo_credit' || t === 'promotional') return 'Promo kredit';
  if (t === 'cash' || t === 'cash_topup') return 'Naqd (ichki)';
  if (t === 'adjustment' || t === 'manual') return 'Qo‘lda tuzatish';
  return String(type);
}
