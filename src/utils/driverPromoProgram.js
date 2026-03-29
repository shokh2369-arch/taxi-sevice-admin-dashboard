/**
 * YettiQanot driver promo program (admin + copy helpers).
 * Backend may expose progress under various keys; we normalize here.
 */

export const PROMO_INITIAL_CREDIT = 20_000;
export const PROMO_PER_TRIP_BONUS = 10_000;
export const PROMO_TRIP_BONUS_SLOTS = 3;

/** Exact driver/bot-facing text (Uzbek). */
export const PROMO_PROGRAM_DRIVER_MESSAGE = `🎁 Sizga 20 000 promo kredit berildi

🚀 Birinchi 3 ta safar uchun:
har safar +10 000 promo kredit

ℹ️ Promo kredit:
— real pul emas
— naqdlashtirilmaydi
— platforma ichida ishlatiladi`;

/**
 * @param {number} n
 */
export function formatPromoCreditsUz(n) {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n));
}

/**
 * @param {Record<string, unknown>|null|undefined} o
 * @param {string[]} keys
 */
function firstDefined(o, keys) {
  if (!o) return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(o, k) && o[k] != null && o[k] !== '') return o[k];
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} root
 * @param {Record<string, unknown>} app
 */
function mergedDriverFields(root, app) {
  return { ...app, ...root };
}

/**
 * Parse 0..3 from backend (many possible shapes).
 * @param {Record<string, unknown>} m
 * @returns {number|null}
 */
function pickCompletedTripBonuses(m) {
  const keys = [
    'promo_completed_trips',
    'promoCompletedTrips',
    'promo_trip_bonuses_completed',
    'promoTripBonusesCompleted',
    'driver_promo_trips_completed',
    'driverPromoTripsCompleted',
    'onboarding_trips_completed',
    'onboardingTripsCompleted',
    'first_three_trips_completed',
    'firstThreeTripsCompleted',
    'trip_bonus_progress',
    'tripBonusProgress',
    'promo_trips_count',
    'promoTripsCount'
  ];
  for (const k of keys) {
    const v = m[k];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= PROMO_TRIP_BONUS_SLOTS) {
      return Math.min(PROMO_TRIP_BONUS_SLOTS, Math.max(0, Math.floor(n)));
    }
  }

  const nested =
    m.promo_program ??
    m.promoProgram ??
    m.driver_promo ??
    m.driverPromo ??
    m.promo_onboarding ??
    m.promoOnboarding;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const p = /** @type {Record<string, unknown>} */ (nested);
    const c = firstDefined(p, [
      'completed_trips',
      'completedTrips',
      'trips_completed',
      'tripsCompleted',
      'trip_bonuses_earned',
      'tripBonusesEarned',
      'count',
      'progress'
    ]);
    if (c != null) {
      const n = Number(c);
      if (Number.isFinite(n) && n >= 0 && n <= PROMO_TRIP_BONUS_SLOTS) {
        return Math.min(PROMO_TRIP_BONUS_SLOTS, Math.max(0, Math.floor(n)));
      }
    }
  }

  const progressStr = m.promo_trip_progress ?? m.promoTripProgress;
  if (typeof progressStr === 'string') {
    const match = progressStr.match(/(\d)\s*\/\s*3\b/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= 0 && n <= 3) return n;
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>} m
 * @returns {{ label: string }|null}
 */
function pickLastBonus(m) {
  const tripIdx = firstDefined(m, [
    'last_promo_bonus_trip',
    'lastPromoBonusTrip',
    'promo_last_bonus_trip',
    'promoLastBonusTrip',
    'last_trip_bonus_index',
    'lastTripBonusIndex'
  ]);
  const amount = firstDefined(m, ['last_promo_bonus_amount', 'lastPromoBonusAmount', 'promo_last_bonus_amount']);

  const idxNum = tripIdx != null ? Number(tripIdx) : NaN;
  const amtNum = amount != null ? Number(amount) : NaN;

  if (Number.isFinite(idxNum) && idxNum >= 1 && idxNum <= PROMO_TRIP_BONUS_SLOTS) {
    const a = Number.isFinite(amtNum) && amtNum > 0 ? amtNum : PROMO_PER_TRIP_BONUS;
    return {
      label: `So‘nggi bonus: +${formatPromoCreditsUz(a)} (${idxNum}-safar)`
    };
  }
  if (Number.isFinite(amtNum) && amtNum > 0) {
    return { label: `So‘nggi bonus: +${formatPromoCreditsUz(amtNum)}` };
  }
  return null;
}

/**
 * @param {Record<string, unknown>|null|undefined} root
 * @param {Record<string, unknown>|null|undefined} app
 */
export function normalizePromoProgramFromSources(root, app) {
  const r = root && typeof root === 'object' ? /** @type {Record<string, unknown>} */ (root) : {};
  const a = app && typeof app === 'object' ? /** @type {Record<string, unknown>} */ (app) : {};
  const m = mergedDriverFields(r, a);

  const completed = pickCompletedTripBonuses(m);
  const last = pickLastBonus(m);

  return {
    initialPromo: PROMO_INITIAL_CREDIT,
    perTripBonus: PROMO_PER_TRIP_BONUS,
    tripSlots: PROMO_TRIP_BONUS_SLOTS,
    /** 0..3 when API sends it */
    completedTripBonuses: completed,
    hasBackendProgress: completed != null,
    remainingTripSlots:
      completed == null ? null : Math.max(0, PROMO_TRIP_BONUS_SLOTS - completed),
    progressLabel: completed == null ? null : `${completed} / ${PROMO_TRIP_BONUS_SLOTS}`,
    lastBonusLabel: last?.label ?? null
  };
}
