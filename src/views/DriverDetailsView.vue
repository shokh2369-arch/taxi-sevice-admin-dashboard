<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <div v-else-if="driver">
    <h1>Haydovchi #{{ driver.driver_id ?? '—' }}</h1>
    <div class="card">
      <p><strong>Ism:</strong> {{ driverDisplayName(driver) }}</p>
      <p><strong>Telefon:</strong> {{ driver.phone || '—' }}</p>
      <p><strong>Avto:</strong> {{ driver.car_model || '—' }}</p>
      <p><strong>Davlat raqami:</strong> {{ driver.plate_number || '—' }}</p>

      <template v-if="driver.balance_mode === 'split'">
        <div class="card-balance-split">
          <p style="margin: 0 0 0.25rem;">
            <strong>Promo balans</strong>
            <span class="badge badge-promo" style="margin-left: 0.35rem;">platforma krediti</span>
          </p>
          <p style="margin: 0; font-size: 1.05rem;">{{ formatMoney(driver.promo_balance) }}</p>
          <p class="balance-hint" style="margin: 0.35rem 0 0;">
            Promo kredit real pul emas va naqdlashtirilmaydi. Ichki balans — faqat platforma ichida ishlatiladi.
          </p>
        </div>
        <div class="card-balance-split">
          <p style="margin: 0 0 0.25rem;">
            <strong>Naqd balans</strong>
            <span class="badge badge-cash" style="margin-left: 0.35rem;">haqiqiy pul</span>
          </p>
          <p style="margin: 0; font-size: 1.05rem;">{{ formatMoney(driver.cash_balance) }}</p>
          <p class="balance-hint" style="margin: 0.35rem 0 0;">
            Haqiqiy pul (ichki naqd balans). Tashqi to‘lov shlyuzi ulangan bo‘lmasa, odatda 0.
          </p>
        </div>
        <p style="margin-top: 0.75rem;">
          <strong>Jami (promo + naqd):</strong> {{ formatMoney(driver.combined_balance) }}
        </p>
      </template>
      <template v-else>
        <p><strong>Balans (API):</strong> {{ formatMoney(driver.combined_balance) }}</p>
        <p class="balance-hint" style="margin-top: 0.35rem;">
          Eski API: faqat yagona balans maydoni (promo/naqd ajratilmagan).
        </p>
      </template>

      <p style="margin-top: 0.75rem;">
        <strong>Jami komissiya (ichki hisob):</strong> {{ formatMoney(driver.internal_commission_display) }}
      </p>
      <p class="balance-hint" style="margin-top: 0.25rem;">
        Ichki hisoblangan komissiya; promo kredit bilan aralashmasin.
      </p>
      <p style="margin-top: 0.75rem;">
        <strong>Holat:</strong>
        <span class="badge" :class="driver.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'">
          {{ driver.status || 'UNKNOWN' }}
        </span>
      </p>
    </div>

    <h2 class="section-title" style="margin-top: 1.5rem;">Promo dasturi</h2>
    <div class="card">
      <p class="balance-hint" style="margin: 0 0 0.75rem;">
        Haydovchi/botda ko‘rinadigan matn (yangi qoida: 20 000 boshlang‘ich + 3 ta safar bonusi):
      </p>
      <pre class="promo-program-exact" style="white-space: pre-wrap; margin: 0 0 1rem; font-family: inherit; font-size: 0.92rem; line-height: 1.45;">{{ promoProgramDriverText }}</pre>
      <ul style="margin: 0 0 1rem 1.1rem; padding: 0; line-height: 1.5;">
        <li>Boshlang‘ich promo: {{ formatPromoCreditsUz(driver.promoProgram.initialPromo) }}</li>
        <li>1-safar bonusi: +{{ formatPromoCreditsUz(driver.promoProgram.perTripBonus) }}</li>
        <li>2-safar bonusi: +{{ formatPromoCreditsUz(driver.promoProgram.perTripBonus) }}</li>
        <li>3-safar bonusi: +{{ formatPromoCreditsUz(driver.promoProgram.perTripBonus) }}</li>
        <li>Promo kredit real pul emas</li>
      </ul>
      <template v-if="driver.promoProgram.hasBackendProgress">
        <p style="margin: 0 0 0.35rem;"><strong>🎯 Boshlang‘ich bonus progressi</strong></p>
        <p class="balance-hint" style="margin: 0 0 0.5rem;">
          Progress: {{ driver.promoProgram.progressLabel }} · qolgan safar slotlari: {{ driver.promoProgram.remainingTripSlots }}
        </p>
        <ul style="margin: 0; padding: 0; list-style: none; line-height: 1.6; font-size: 0.95rem;">
          <li>{{ driver.promoProgram.completedTripBonuses >= 1 ? '[✔]' : '[ ]' }} 1-safar → +{{ formatPromoCreditsUz(driver.promoProgram.perTripBonus) }}</li>
          <li>{{ driver.promoProgram.completedTripBonuses >= 2 ? '[✔]' : '[ ]' }} 2-safar → +{{ formatPromoCreditsUz(driver.promoProgram.perTripBonus) }}</li>
          <li>{{ driver.promoProgram.completedTripBonuses >= 3 ? '[✔]' : '[ ]' }} 3-safar → +{{ formatPromoCreditsUz(driver.promoProgram.perTripBonus) }}</li>
        </ul>
      </template>
      <p v-else class="balance-hint" style="margin: 0.75rem 0 0;">
        Safar bonusi progressi: API <code>promo_completed_trips</code> / <code>promo_program</code> kabi maydonlar kelganda shu yerda ko‘rinadi.
      </p>
      <p v-if="driver.promoProgram.lastBonusLabel" style="margin: 0.75rem 0 0;">
        {{ driver.promoProgram.lastBonusLabel }}
      </p>
    </div>

    <h2 class="section-title" style="margin-top: 1.5rem;">Taklif / referral</h2>
    <div class="card">
      <p class="balance-hint" style="margin: 0 0 0.75rem;">
        Taklif qilgan haydovchi uchun matn (taklif qilingan haydovchi 3 ta tugallangan safar qilgach):
      </p>
      <pre class="referral-program-exact" style="white-space: pre-wrap; margin: 0 0 0.75rem; font-family: inherit; font-size: 0.92rem; line-height: 1.45;">{{ driver.referralDisplay.inviterMessage }}</pre>
      <p class="balance-hint" style="margin: 0 0 0.75rem;">{{ driver.referralDisplay.footnote }}</p>
      <template v-if="driver.referralDisplay.hasProgress">
        <p v-if="driver.referralDisplay.tripsLabel" style="margin: 0 0 0.35rem;">
          <strong>{{ driver.referralDisplay.tripsLabel }}</strong>
        </p>
        <p v-if="driver.referralDisplay.rewardStatusLabel" style="margin: 0;">
          {{ driver.referralDisplay.rewardStatusLabel }}
        </p>
      </template>
      <p v-else class="balance-hint" style="margin: 0.75rem 0 0;">
        Progress / mukofot holati: API <code>referral_trips_completed</code>, <code>referral_reward_granted</code> yoki <code>referral_program</code> ichida kelganda shu yerda ko‘rinadi.
      </p>
    </div>

    <h2 class="section-title" style="margin-top: 1.5rem;">Balans qo‘shish (admin)</h2>
    <div class="card">
      <p class="balance-hint" style="margin: 0 0 0.75rem;">
        Promo — platforma ichki krediti (naqdlashtirilmaydi). Naqd — faqat haqiqiy pul balansi uchun.
      </p>
      <label class="muted" style="display: block; margin-bottom: 0.35rem;">Balans turi</label>
      <select v-model="topupBucket" class="input" style="max-width: 220px; margin-bottom: 0.75rem;">
        <option value="cash">Naqd balans qo‘shish</option>
        <option value="promo">Promo kredit qo‘shish</option>
      </select>
      <div>
        <input
          v-model.number="amount"
          type="number"
          class="input"
          placeholder="Summa (so‘m)"
        />
        <input
          v-model="note"
          type="text"
          class="input"
          placeholder="Izoh"
          style="margin-left: 0.5rem; width: 200px"
        />
        <button type="button" class="button" style="margin-left: 0.5rem" @click="add">
          {{ topupBucket === 'cash' ? 'Naqd qo‘shish' : 'Promo qo‘shish' }}
        </button>
      </div>
    </div>

    <h2 class="section-title" style="margin-top: 1.5rem;">Balans ayirish (admin)</h2>
    <div class="card">
      <p class="balance-hint" style="margin: 0 0 0.75rem;">
        Bu funksiya faqat haqiqiy naqd balansdan ayiradi. Promo balans hech qachon kamaytirilmaydi. Avval qo‘shilgan
        naqd balansen bir qismini qaytarish kerak bo‘lganda foydalaning.
      </p>
      <div style="margin-bottom: 0.5rem;">
        <label class="muted" style="display: block; margin-bottom: 0.25rem;">Ayiriladigan summa (so‘m)</label>
        <input
          v-model.number="deductionAmount"
          type="number"
          class="input"
          placeholder="Masalan: 5000"
          style="max-width: 260px;"
        />
      </div>
      <div style="margin-bottom: 0.5rem;">
        <label class="muted" style="display: block; margin-bottom: 0.25rem;">Sabab</label>
        <input
          v-model="deductionReason"
          type="text"
          class="input"
          placeholder="Masalan: refund correction"
          style="max-width: 360px;"
        />
      </div>
      <div>
        <button
          type="button"
          class="button button-secondary"
          style="margin-right: 0.5rem;"
          :disabled="isApplyingDeduction || deductionAmount == null || deductionAmount <= 0"
          @click="applyDeduction"
        >
          Balans ayirish
        </button>
        <span v-if="deductionMessage" class="balance-hint" style="margin-left: 0.25rem;">
          {{ deductionMessage }}
        </span>
      </div>
    </div>

    <h2 class="section-title">Balans journali (ledger)</h2>
    <div v-if="ledgerLoading" class="muted">Yuklanmoqda…</div>
    <p v-else-if="ledgerUnsupported" class="card muted" style="margin: 0;">
      Haydovchi uchun ledger API hozircha topilmadi (404). Backend yo‘l qo‘yganida jadval avtomatik to‘ldiriladi.
    </p>
    <p v-else-if="!ledgerRows.length" class="card muted" style="margin: 0;">Hozircha yozuvlar yo‘q.</p>
    <table v-else class="table">
      <thead>
        <tr>
          <th>Vaqt</th>
          <th>Segment</th>
          <th>Voqea</th>
          <th>Summa</th>
          <th>Izoh</th>
          <th>Ref</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in ledgerRows" :key="i">
          <td>{{ formatLedgerTime(row.created_at) }}</td>
          <td>
            <span :class="row.bucket === 'cash' ? 'badge badge-bucket-cash' : 'badge badge-bucket-promo'">
              {{ ledgerBucketLabel(row.bucket) }}
            </span>
          </td>
          <td>{{ ledgerEntryLabel(row.entry_type) }}</td>
          <td :class="row.bucket === 'cash' ? 'ledger-amount-cash' : 'ledger-amount-promo'">
            {{ formatSignedAmount(row.amount) }}
          </td>
          <td>{{ row.note || '—' }}</td>
          <td style="font-size: 0.75rem;">
            <template v-if="row.reference_type || row.reference_id">
              {{ row.reference_type || '' }} {{ row.reference_id || '' }}
            </template>
            <template v-else>—</template>
          </td>
        </tr>
      </tbody>
    </table>

    <h2 class="section-title">Oylik yig‘indilar</h2>
    <p class="balance-hint" style="margin: -0.5rem 0 0.75rem;">
      Komissiya ichki hisob-kitob; promo kredit alohida va real pul emas. Tashqariga pul yechish sharti emas.
    </p>
    <div class="card" v-if="monthlyTotals.length">
      <table class="table">
        <thead>
          <tr>
            <th>Oy</th>
            <th>Safar narxi jami (tarif)</th>
            <th>Hisoblangan komissiya (ichki)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in monthlyTotals" :key="row.monthKey">
            <td>{{ row.monthLabel }}</td>
            <td>{{ formatMoney(row.totalPrice) }}</td>
            <td>{{ formatMoney(row.totalAmount) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="card">To‘lovlar hozircha yo‘q.</p>

    <h2 class="section-title">To‘lovlar / harakatlar</h2>
    <p class="balance-hint" style="margin: -0.5rem 0 0.75rem;">
      Ichki platforma yozuvlari; tashqi kartadan yechim yoki naqd chiqarishni anglatmaydi.
    </p>
    <table class="table" v-if="payments.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Safar narxi</th>
          <th>Summa</th>
          <th>Turi</th>
          <th>Izoh</th>
          <th>Vaqt</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td>{{ p.id }}</td>
          <td>{{ formatTotalPrice(p) }}</td>
          <td>{{ formatMoney(p.amount) }}</td>
          <td>{{ formatPaymentTypeLabel(p.type) }}</td>
          <td>{{ p.note }}</td>
          <td>{{ formatPayTime(p.created_at) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>Harakatlar hozircha yo‘q.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet } from '../api';
import { addDriverBalance, deductDriverBalance, fetchDriverLedger } from '../api/driverBalance.js';
import { driverDisplayName } from '../utils/driverDisplayName';
import { normalizeDriverBalances } from '../utils/driverBalances.js';
import { pickDriverInternalCommission } from '../utils/driverCommission.js';
import {
  ledgerBucketLabel,
  ledgerEntryLabel,
  normalizeLedgerRow,
  unwrapLedgerList
} from '../utils/driverLedger.js';
import { formatPaymentTypeLabel } from '../utils/paymentLabels.js';
import {
  PROMO_PROGRAM_DRIVER_MESSAGE,
  formatPromoCreditsUz,
  normalizePromoProgramFromSources
} from '../utils/driverPromoProgram.js';
import { normalizeReferralFromSources } from '../utils/driverReferralProgram.js';

const route = useRoute();
const id = Number(route.params.id);

const driver = ref(null);
const payments = ref([]);
const amount = ref(null);
const note = ref('');
const topupBucket = ref('cash');
const deductionAmount = ref(null);
const deductionReason = ref('');
const isApplyingDeduction = ref(false);
const deductionMessage = ref('');
const loading = ref(true);
const error = ref('');

const ledgerLoading = ref(false);
const ledgerRows = ref([]);
const ledgerUnsupported = ref(false);

/** Light poll so promo balans / safar bonusi yangilanadi (safar tugagach). */
const REFRESH_MS = 20_000;
let refreshTimer = 0;

const promoProgramDriverText = PROMO_PROGRAM_DRIVER_MESSAGE;

onMounted(async () => {
  await load();
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    load().catch(() => {});
  }, REFRESH_MS);
});

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const raw = await apiGet('/admin/drivers');
    const rows = Array.isArray(raw) ? raw : raw?.drivers || [];
    const normalized = rows.map(normalizeDriver);
    driver.value = normalized.find((d) => Number(d.driver_id) === id) || null;

    payments.value = await apiGet(`/admin/payments?driver_id=${id}`);
    await loadLedger();
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load driver details';
  } finally {
    loading.value = false;
  }
}

async function loadLedger() {
  ledgerLoading.value = true;
  ledgerUnsupported.value = false;
  ledgerRows.value = [];
  try {
    const data = await fetchDriverLedger(id);
    if (data == null) {
      ledgerUnsupported.value = true;
      return;
    }
    ledgerRows.value = unwrapLedgerList(data).map(normalizeLedgerRow).filter(Boolean);
  } catch (e) {
    console.error(e);
    ledgerUnsupported.value = true;
  } finally {
    ledgerLoading.value = false;
  }
}

function formatMoney(amountVal) {
  if (amountVal == null) return "0 so'm";
  return new Intl.NumberFormat('uz-UZ').format(amountVal) + " so'm";
}

/**
 * @param {number} n
 */
function formatSignedAmount(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return sign + formatMoney(Math.abs(n)).replace(" so'm", '') + " so'm";
}

/**
 * @param {string|null} iso
 */
function formatLedgerTime(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

/**
 * @param {unknown} created
 */
function formatPayTime(created) {
  if (created == null) return '—';
  try {
    return new Date(created).toLocaleString();
  } catch {
    return String(created);
  }
}

/** Total price: starting_fee + fare_price, or total_price / total_fare from API. */
function getTotalPrice(p) {
  const start = p?.starting_fee ?? p?.startingFee ?? p?.trip?.starting_fee ?? p?.trip?.startingFee ?? 0;
  const fare = p?.fare_price ?? p?.farePrice ?? p?.fair_price ?? p?.fairPrice ?? p?.trip?.fare_price ?? p?.trip?.farePrice ?? 0;
  const sum = (Number(start) || 0) + (Number(fare) || 0);
  if (sum > 0) return sum;
  const total = p?.total_price ?? p?.totalPrice ?? p?.total_fare ?? p?.totalFare ?? p?.fare_total ?? p?.fareTotal ?? p?.trip?.total_price ?? p?.trip?.totalPrice ?? p?.trip?.total_fare ?? p?.trip?.totalFare ?? 0;
  return Number(total) || 0;
}

function formatTotalPrice(p) {
  const total = getTotalPrice(p);
  return total > 0 ? formatMoney(total) : '—';
}

const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

const monthlyTotals = computed(() => {
  const byMonth = new Map();
  for (const p of payments.value) {
    const d = new Date(p.created_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { totalPrice: 0, totalAmount: 0, year: d.getFullYear(), month: d.getMonth() });
    }
    const row = byMonth.get(monthKey);
    row.totalPrice += getTotalPrice(p);
    if (p?.type === 'commission') {
      row.totalAmount += Number(p?.amount) || 0;
    }
  }
  return Array.from(byMonth.entries())
    .map(([monthKey, row]) => ({
      monthKey,
      monthLabel: `${monthNames[row.month]} ${row.year}`,
      totalPrice: row.totalPrice,
      totalAmount: row.totalAmount
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
});

async function add() {
  if (amount.value == null || amount.value <= 0) return;
  const value = Math.round(amount.value);
  try {
    await addDriverBalance(id, {
      amount: value,
      note: note.value || (topupBucket.value === 'promo' ? 'Admin: promo' : 'Admin: naqd'),
      bucket: topupBucket.value === 'promo' ? 'promo' : 'cash'
    });
    amount.value = null;
    note.value = '';
    topupBucket.value = 'cash';
    await load();
  } catch (e) {
    console.error(e);
  }
}

async function applyDeduction() {
  if (deductionAmount.value == null || deductionAmount.value <= 0) return;
  const value = Math.round(deductionAmount.value);
  isApplyingDeduction.value = true;
  deductionMessage.value = '';
  try {
    await deductDriverBalance(id, {
      amount: value,
      reason: deductionReason.value || undefined
    });
    deductionAmount.value = null;
    deductionReason.value = '';
    deductionMessage.value = 'Naqd balansdan summa muvaffaqiyatli ayirildi.';
    await load();
  } catch (e) {
    console.error(e);
    deductionMessage.value = 'Balans ayirishda xatolik yuz berdi.';
  } finally {
    isApplyingDeduction.value = false;
  }
}

function normalizeDriver(d) {
  const app = d?.application ?? d?.driver_application ?? d?.application_data ?? d?.app ?? {};
  const bal = normalizeDriverBalances(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  const internal_commission_display = pickDriverInternalCommission(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  const promoProgram = normalizePromoProgramFromSources(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  const referralDisplay = normalizeReferralFromSources(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );

  return {
    ...d,
    ...app,
    ...bal,
    internal_commission_display,
    promoProgram,
    referralDisplay,
    driver_id: pickFirst(d, app, ['driver_id', 'id', 'driverId']),
    phone: pickFirst(d, app, ['phone', 'driver_phone', 'phone_number', 'application_phone', 'phone_text']) ?? '',
    car_model: pickFirst(d, app, ['car_model', 'car_type_model', 'application_car_type_model', 'car', 'carName', 'car_name']) ?? '',
    plate_number: pickFirst(d, app, ['plate_number', 'plate_text', 'application_plate_text', 'plate', 'plateNo']) ?? '',
    total_paid: Number(pickFirst(d, app, ['total_paid', 'totalPaid', 'paid_total']) ?? 0) || 0,
    status: normalizeStatus(
      pickFirst(d, app, [
        'application_app_status',
        'application_status',
        'app_status',
        'verification_status',
        'active_status',
        'is_active',
        'is_online',
        'status',
        'state',
        'driver_status',
        'online'
      ])
    )
  };
}

function pickFirst(a, b, keys) {
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

function normalizeStatus(v) {
  if (typeof v === 'boolean') return v ? 'ACTIVE' : 'INACTIVE';
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';
  if (['1', 'TRUE', 'YES'].includes(s)) return 'ACTIVE';
  if (['0', 'FALSE', 'NO'].includes(s)) return 'INACTIVE';
  if (['ACTIVE', 'ONLINE', 'APPROVED'].includes(s)) return 'ACTIVE';
  if (['APPROVE', 'VERIFIED'].includes(s)) return 'ACTIVE';
  if (['PENDING', 'WAITING', 'WAITING_APPROVAL'].includes(s)) return 'PENDING';
  if (['REJECTED', 'DECLINED'].includes(s)) return 'BLOCKED';
  if (['BLOCKED', 'BANNED'].includes(s)) return 'BLOCKED';
  if (['INACTIVE', 'OFFLINE', 'DISABLED'].includes(s)) return 'INACTIVE';
  return s;
}
</script>
