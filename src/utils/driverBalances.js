/**
 * Normalize promo vs cash vs legacy single balance from driver payloads.
 * @param {Record<string, unknown>} root
 * @param {Record<string, unknown>} app
 */
export function normalizeDriverBalances(root, app) {
  const promoRaw = pickBalanceField(root, app, [
    'promo_balance',
    'promoBalance',
    'promotional_balance',
    'internal_promo_balance',
    'platform_promo_balance',
    'promo_balance_integer'
  ]);
  const cashRaw = pickBalanceField(root, app, [
    'cash_balance',
    'cashBalance',
    'real_balance',
    'withdrawable_balance',
    'naqd_balance',
    'cash_balance_integer'
  ]);
  const legacyRaw = pickBalanceField(root, app, [
    'balance',
    'balance_integer',
    'wallet_balance',
    'driver_balance',
    'driver_balance_integer',
    'total_balance'
  ]);

  const hasPromoField = promoRaw !== null && promoRaw !== undefined && String(promoRaw).trim() !== '';
  const hasCashField = cashRaw !== null && cashRaw !== undefined && String(cashRaw).trim() !== '';
  const hasSplit = hasPromoField || hasCashField;

  const promo = hasPromoField ? toNum(promoRaw) : 0;
  const cash = hasCashField ? toNum(cashRaw) : 0;
  const legacy = toNum(legacyRaw);

  if (hasSplit) {
    return {
      balance_mode: 'split',
      promo_balance: promo,
      cash_balance: cash,
      legacy_balance: legacy,
      /** When backend still sends a combined `balance` alongside split fields */
      legacy_also: legacy
    };
  }

  return {
    balance_mode: 'legacy',
    promo_balance: 0,
    cash_balance: 0,
    legacy_balance: legacy,
    legacy_also: legacy
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} a
 * @param {Record<string, unknown>|null|undefined} b
 * @param {string[]} keys
 */
function pickBalanceField(a, b, keys) {
  for (const k of keys) {
    const va = a?.[k];
    if (va != null && String(va).trim() !== '') return va;
    const vb = b?.[k];
    if (vb != null && String(vb).trim() !== '') return vb;
    const vc = a?.[`application_${k}`];
    if (vc != null && String(vc).trim() !== '') return vc;
    const vd = b?.[`application_${k}`];
    if (vd != null && String(vd).trim() !== '') return vd;
  }
  return null;
}

/**
 * @param {unknown} v
 */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Dashboard summary: split totals when API provides them.
 * @param {Record<string, unknown>|null|undefined} summary
 */
export function normalizeDashboardBalances(summary) {
  if (!summary || typeof summary !== 'object') {
    return { mode: 'legacy', promo: null, cash: null, legacyTotal: null };
  }
  const s = /** @type {Record<string, unknown>} */ (summary);
  const promo = pickNum(s, [
    'total_promo_balance',
    'total_promo_balances',
    'promo_balance_total',
    'drivers_promo_balance_total'
  ]);
  const cash = pickNum(s, [
    'total_cash_balance',
    'total_cash_balances',
    'cash_balance_total',
    'drivers_cash_balance_total'
  ]);
  const legacy = pickNum(s, ['total_driver_balances', 'total_balances', 'total_balance']);

  if (promo != null || cash != null) {
    return {
      mode: 'split',
      promo: promo ?? 0,
      cash: cash ?? 0,
      legacyTotal: legacy
    };
  }
  return { mode: 'legacy', promo: null, cash: null, legacyTotal: legacy };
}

/**
 * @param {Record<string, unknown>} s
 * @param {string[]} keys
 */
function pickNum(s, keys) {
  for (const k of keys) {
    const v = s[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}
