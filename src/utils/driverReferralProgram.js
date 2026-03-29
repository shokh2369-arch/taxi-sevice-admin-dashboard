/**
 * Inviter referral reward (YettiQanot): +20 000 promo when referred driver completes 3 FINISHED trips.
 * Not cash — promo kredit only.
 */

/** Inviter-facing copy (bot / haydovchi UI). */
export const REFERRAL_INVITER_MESSAGE = `Taklif qilgan haydovchingiz 3 ta safar qilsa:
🎁 Sizga +20 000 promo kredit beriladi`;

export const REFERRAL_SAFE_FOOTNOTE =
  'Promo kredit — real pul emas; naqdlashtirilmaydi; platforma ichida ishlatiladi.';

export const REFERRAL_TRIPS_TARGET = 3;
export const REFERRAL_PROMO_AMOUNT = 20_000;

/**
 * @param {Record<string, unknown>|null|undefined} o
 * @param {string[]} keys
 */
function firstNumInRange(o, keys, min, max) {
  if (!o) return null;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    const v = o[k];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= min && n <= max) return Math.min(max, Math.max(min, Math.floor(n)));
  }
  return null;
}

/**
 * @param {unknown} v
 */
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'ha'].includes(s)) return true;
    if (['false', '0', 'no', 'yoq'].includes(s)) return false;
  }
  return null;
}

/**
 * Trips completed by referred driver (for inviter bonus), 0..3.
 * @param {Record<string, unknown>} m
 */
function pickReferralTripsProgress(m) {
  const direct = firstNumInRange(
    m,
    [
      'referral_trips_completed',
      'referralTripsCompleted',
      'referrer_reward_trips_completed',
      'referrerRewardTripsCompleted',
      'referee_finished_trips_for_inviter',
      'refereeFinishedTripsForInviter',
      'referral_finished_trips',
      'referralFinishedTrips',
      'inviter_bonus_trips_completed',
      'inviterBonusTripsCompleted',
      'referral_reward_trip_count',
      'referralRewardTripCount'
    ],
    0,
    REFERRAL_TRIPS_TARGET
  );
  if (direct != null) return direct;

  const nested =
    m.referral_program ??
    m.referralProgram ??
    m.referral_status ??
    m.referralStatus ??
    m.inviter_reward ??
    m.inviterReward;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const p = /** @type {Record<string, unknown>} */ (nested);
    const c = firstNumInRange(
      p,
      [
        'completed_trips',
        'completedTrips',
        'finished_trips',
        'finishedTrips',
        'trips_completed',
        'tripsCompleted',
        'progress',
        'count'
      ],
      0,
      REFERRAL_TRIPS_TARGET
    );
    if (c != null) return c;
  }

  const progressStr = m.referral_trip_progress ?? m.referralTripProgress;
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
 * Whether inviter already received the +20k promo for this referral.
 * @param {Record<string, unknown>} m
 */
function pickRewardGranted(m) {
  const keys = [
    'referral_reward_granted',
    'referralRewardGranted',
    'inviter_referral_reward_granted',
    'inviterReferralRewardGranted',
    'referral_promo_granted',
    'referralPromoGranted',
    'referral_bonus_granted',
    'referralBonusGranted'
  ];
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(m, k)) continue;
    const b = toBool(m[k]);
    if (b != null) return b;
  }

  const nested =
    m.referral_program ?? m.referralProgram ?? m.referral_status ?? m.referralStatus;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const p = /** @type {Record<string, unknown>} */ (nested);
    for (const k of ['reward_granted', 'rewardGranted', 'granted', 'completed']) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      const b = toBool(p[k]);
      if (b != null) return b;
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>|null|undefined} root
 * @param {Record<string, unknown>|null|undefined} app
 */
export function normalizeReferralFromSources(root, app) {
  const r = root && typeof root === 'object' ? /** @type {Record<string, unknown>} */ (root) : {};
  const a = app && typeof app === 'object' ? /** @type {Record<string, unknown>} */ (app) : {};
  const m = { ...a, ...r };

  const tripsCompleted = pickReferralTripsProgress(m);
  const rewardGranted = pickRewardGranted(m);
  const hasProgress = tripsCompleted != null || rewardGranted != null;

  return {
    inviterMessage: REFERRAL_INVITER_MESSAGE,
    footnote: REFERRAL_SAFE_FOOTNOTE,
    tripsTarget: REFERRAL_TRIPS_TARGET,
    promoAmount: REFERRAL_PROMO_AMOUNT,
    tripsCompleted,
    rewardGranted,
    hasProgress,
    tripsLabel: tripsCompleted == null ? null : `Safarlar: ${tripsCompleted} / ${REFERRAL_TRIPS_TARGET}`,
    rewardStatusLabel:
      rewardGranted === true
        ? 'Mukofot: berilgan (+20 000 promo kredit)'
        : rewardGranted === false
          ? 'Mukofot: hali berilmagan'
          : null
  };
}
