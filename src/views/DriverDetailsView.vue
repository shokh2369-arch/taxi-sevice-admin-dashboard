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
            Real pul emas. Faqat platforma ichida ishlatiladi. Naqdlashtirilmaydi.
          </p>
        </div>
        <div class="card-balance-split">
          <p style="margin: 0 0 0.25rem;">
            <strong>Naqd balans</strong>
            <span class="badge badge-cash" style="margin-left: 0.35rem;">haqiqiy pul</span>
          </p>
          <p style="margin: 0; font-size: 1.05rem;">{{ formatMoney(driver.cash_balance) }}</p>
          <p class="balance-hint" style="margin: 0.35rem 0 0;">
            Faqat haqiqiy pul oqimi bo‘lsa ko‘rinadi; bank/Click orqali to‘lov integratsiyasi yo‘q bo‘lsa, odatda 0.
          </p>
        </div>
      </template>
      <template v-else>
        <p><strong>Balans (API, yagona):</strong> {{ formatMoney(driver.legacy_balance) }}</p>
        <p class="balance-hint" style="margin-top: 0.35rem;">
          Promo va naqd alohida kelmagan. Backend yangilanganda promo / naqd alohida ko‘rsatiladi.
        </p>
      </template>

      <p style="margin-top: 0.75rem;">
        <strong>Jami komissiya (ichki hisob):</strong> {{ formatMoney(driver.total_paid) }}
      </p>
      <p class="balance-hint" style="margin-top: 0.25rem;">
        Bank o‘tkazmasi yoki mijoz to‘lovi bilan aralashmasin — ichki hisoblangan komissiya.
      </p>
      <p style="margin-top: 0.75rem;">
        <strong>Holat:</strong>
        <span class="badge" :class="driver.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'">
          {{ driver.status || 'UNKNOWN' }}
        </span>
      </p>
    </div>

    <h2 class="section-title" style="margin-top: 1.5rem;">Balans qo‘shish (admin)</h2>
    <div class="card">
      <p class="balance-hint" style="margin: 0 0 0.75rem;">
        Promo — platforma ichki krediti (naqdlashtirilmaydi). Naqd — faqat haqiqiy pul balansi uchun.
      </p>
      <label class="muted" style="display: block; margin-bottom: 0.35rem;">Balans turi</label>
      <select v-model="topupBucket" class="input" style="max-width: 220px; margin-bottom: 0.75rem;">
        <option value="promo">Promo kredit qo‘shish</option>
        <option value="cash">Naqd balans qo‘shish</option>
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
      Hozirgi bosqichda komissiya ichki promo balans orqali aks ettirilishi mumkin. Live Click/bank o‘tkazmasi nazarda tutilmagan.
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
      Bu ro‘yxat bank yoki mijoz kartasidan yechimni anglatmaydi — ichki platforma yozuvlari.
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
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet } from '../api';
import { addDriverBalance, fetchDriverLedger } from '../api/driverBalance.js';
import { driverDisplayName } from '../utils/driverDisplayName';
import { normalizeDriverBalances } from '../utils/driverBalances.js';
import {
  ledgerBucketLabel,
  ledgerEntryLabel,
  normalizeLedgerRow,
  unwrapLedgerList
} from '../utils/driverLedger.js';
import { formatPaymentTypeLabel } from '../utils/paymentLabels.js';

const route = useRoute();
const id = Number(route.params.id);

const driver = ref(null);
const payments = ref([]);
const amount = ref(null);
const note = ref('');
const topupBucket = ref('promo');
const loading = ref(true);
const error = ref('');

const ledgerLoading = ref(false);
const ledgerRows = ref([]);
const ledgerUnsupported = ref(false);

onMounted(async () => {
  await load();
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
  if (!amount.value || amount.value <= 0) return;
  const value = Math.round(amount.value);
  try {
    await addDriverBalance(id, {
      amount: value,
      note: note.value || (topupBucket.value === 'cash' ? 'Admin: naqd' : 'Admin: promo'),
      bucket: topupBucket.value === 'cash' ? 'cash' : 'promo'
    });
    amount.value = null;
    note.value = '';
    topupBucket.value = 'promo';
    await load();
  } catch (e) {
    console.error(e);
  }
}

function normalizeDriver(d) {
  const app = d?.application ?? d?.driver_application ?? d?.application_data ?? d?.app ?? {};
  const bal = normalizeDriverBalances(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  return {
    ...d,
    ...app,
    ...bal,
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
