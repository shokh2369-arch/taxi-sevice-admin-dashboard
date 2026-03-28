/**
 * Normalize promo vs cash vs legacy single balance from driver payloads.
 * New API: `promo_balance`, `cash_balance`, `balance` (combined). Keys may be present with 0.
 * Old API: only `balance` — treat as legacy combined.
 * @param {Record<string, unknown>} root
 * @param {Record<string, unknown>} app
 */
export function normalizeDriverBalances(root, app) {
  const hasPromoKey = hasOwnKey(root, app, ['promo_balance', 'promoBalance']);
  const hasCashKey = hasOwnKey(root, app, ['cash_balance', 'cashBalance']);
  const hasSplit = hasPromoKey || hasCashKey;

  const promo = hasPromoKey ? toNum(getOwn(root, app, ['promo_balance', 'promoBalance'])) : 0;
  const cash = hasCashKey ? toNum(getOwn(root, app, ['cash_balance', 'cashBalance'])) : 0;
  const combined = toNum(
    pickBalanceField(root, app, [
      'balance',
      'balance_integer',
      'wallet_balance',
      'driver_balance',
      'driver_balance_integer',
      'total_balance'
    ])
  );

  if (hasSplit) {
    let total = combined;
    if (total === 0 && (promo !== 0 || cash !== 0)) {
      total = promo + cash;
    }
    return {
      balance_mode: 'split',
      promo_balance: promo,
      cash_balance: cash,
      combined_balance: total,
      legacy_balance: total,
      legacy_also: total
    };
  }

  return {
    balance_mode: 'legacy',
    promo_balance: 0,
    cash_balance: 0,
    combined_balance: combined,
    legacy_balance: combined,
    legacy_also: combined
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} a
 * @param {Record<string, unknown>|null|undefined} b
 * @param {string[]} keys
 */
function hasOwnKey(a, b, keys) {
  for (const k of keys) {
    if (a && Object.prototype.hasOwnProperty.call(a, k)) return true;
    if (b && Object.prototype.hasOwnProperty.call(b, k)) return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>|null|undefined} a
 * @param {Record<string, unknown>|null|undefined} b
 * @param {string[]} keys
 */
function getOwn(a, b, keys) {
  for (const k of keys) {
    if (a && Object.prototype.hasOwnProperty.call(a, k)) return a[k];
    if (b && Object.prototype.hasOwnProperty.call(b, k)) return b[k];
  }
  return undefined;
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
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Dashboard summary: totals from GET /admin/dashboard.
 * @param {Record<string, unknown>|null|undefined} summary
 */
export function normalizeDashboardBalances(summary) {
  if (!summary || typeof summary !== 'object') {
    return {
      mode: 'legacy',
      promo: null,
      cash: null,
      combined: null,
      commissionAccrued: null
    };
  }
  const s = /** @type {Record<string, unknown>} */ (summary);
  const promo = pickNum(s, [
    'total_promo_balances',
    'total_promo_balance',
    'promo_balance_total',
    'drivers_promo_balance_total'
  ]);
  const cash = pickNum(s, [
    'total_cash_balances',
    'total_cash_balance',
    'cash_balance_total',
    'drivers_cash_balance_total'
  ]);
  const combined = pickNum(s, ['total_driver_balances', 'total_balances', 'total_balance']);
  const commissionAccrued = pickNum(s, [
    'total_internal_commission_accrued',
    'total_internal_commission',
    'internal_commission_accrued_total'
  ]);

  if (promo != null || cash != null) {
    return {
      mode: 'split',
      promo: promo ?? 0,
      cash: cash ?? 0,
      combined: combined,
      commissionAccrued
    };
  }
  return {
    mode: 'legacy',
    promo: null,
    cash: null,
    combined: combined,
    commissionAccrued
  };
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

/**
 * When GET /admin/dashboard omits total_promo_balances / total_cash_balances but
 * GET /admin/drivers rows include promo_balance & cash_balance, sum them for dashboard cards.
 * @param {unknown} raw response from GET /admin/drivers
 */
export function aggregateBalancesFromDriversPayload(raw) {
  const rows = Array.isArray(raw) ? raw : raw?.drivers || [];
  let promoSum = 0;
  let cashSum = 0;
  let combinedSum = 0;
  let anySplit = false;
  for (const d of rows) {
    if (!d || typeof d !== 'object') continue;
    const o = /** @type {Record<string, unknown>} */ (d);
    const appRaw = o.application ?? o.driver_application ?? o.application_data ?? o.app;
    const app = appRaw && typeof appRaw === 'object' ? /** @type {Record<string, unknown>} */ (appRaw) : {};
    const b = normalizeDriverBalances(o, app);
    if (b.balance_mode === 'split') {
      anySplit = true;
      promoSum += b.promo_balance;
      cashSum += b.cash_balance;
    }
    combinedSum += b.combined_balance;
  }
  return { promoSum, cashSum, combinedSum, anySplit };
}
