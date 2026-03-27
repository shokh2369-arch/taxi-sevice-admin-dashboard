<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <div v-else-if="driver">
    <h1>Driver #{{ driver.driver_id ?? '—' }}</h1>
    <div class="card">
      <p><strong>Name:</strong> {{ driverDisplayName(driver) }}</p>
      <p><strong>Phone:</strong> {{ driver.phone || '—' }}</p>
      <p><strong>Car:</strong> {{ driver.car_model || '—' }}</p>
      <p><strong>Plate:</strong> {{ driver.plate_number || '—' }}</p>
      <p><strong>Balance:</strong> {{ formatMoney(driver.balance) }}</p>
      <p><strong>Total paid:</strong> {{ formatMoney(driver.total_paid) }}</p>
      <p>
        <strong>Status:</strong>
        <span class="badge" :class="driver.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'">
          {{ driver.status || 'UNKNOWN' }}
        </span>
      </p>
    </div>

    <h2 style="margin-top: 1.5rem">Monthly totals</h2>
    <div class="card" v-if="monthlyTotals.length">
      <table class="table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Monthly total price</th>
            <th>Monthly total amount</th>
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
    <p v-else class="card">No payments yet.</p>

    <h2 style="margin-top: 1.5rem">Add balance</h2>
    <div class="card">
      <input
        v-model.number="amount"
        type="number"
        class="input"
        placeholder="Amount (so'm)"
      />
      <input
        v-model="note"
        type="text"
        class="input"
        placeholder="Note"
        style="margin-left: 0.5rem; width: 200px"
      />
      <button class="button" style="margin-left: 0.5rem" @click="add">
        Add balance
      </button>
    </div>

    <h2 style="margin-top: 1.5rem">Payments</h2>
    <table class="table" v-if="payments.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Fare price</th>
          <th>Amount</th>
          <th>Type</th>
          <th>Note</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td>{{ p.id }}</td>
          <td>{{ formatTotalPrice(p) }}</td>
          <td>{{ formatMoney(p.amount) }}</td>
          <td>{{ p.type }}</td>
          <td>{{ p.note }}</td>
          <td>{{ new Date(p.created_at).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>No payments yet.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet, apiPost } from '../api';
import { driverDisplayName } from '../utils/driverDisplayName';

const route = useRoute();
const id = Number(route.params.id);

const driver = ref(null);
const payments = ref([]);
const amount = ref(null);
const note = ref('');
const loading = ref(true);
const error = ref('');

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
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load driver details';
  } finally {
    loading.value = false;
  }
}

function formatMoney(amount) {
  if (amount == null) return "0 so'm";
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
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

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
    await apiPost(`/admin/drivers/${id}/add-balance`, {
      amount: value,
      note: note.value || 'Admin topup'
    });
    amount.value = null;
    note.value = '';
    await load();
  } catch (e) {
    console.error(e);
  }
}

function normalizeDriver(d) {
  return {
    ...d,
    driver_id: d?.driver_id ?? d?.id ?? d?.driverId ?? null,
    phone: d?.phone ?? d?.driver_phone ?? d?.phone_number ?? '',
    car_model: d?.car_model ?? d?.car_type_model ?? d?.car ?? d?.carName ?? d?.car_name ?? '',
    plate_number: d?.plate_number ?? d?.plate_text ?? d?.plate ?? d?.plateNo ?? '',
    balance: Number(d?.balance ?? d?.driver_balance ?? 0) || 0,
    total_paid: Number(d?.total_paid ?? d?.totalPaid ?? d?.paid_total ?? 0) || 0,
    status: normalizeStatus(
      d?.active_status ??
      d?.is_active ??
      d?.is_online ??
      d?.status ??
      d?.state ??
      d?.driver_status ??
      d?.application_app_status ??
      d?.application_status
    )
  };
}

function normalizeStatus(v) {
  if (typeof v === 'boolean') return v ? 'ACTIVE' : 'INACTIVE';
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';
  if (['1', 'TRUE', 'YES'].includes(s)) return 'ACTIVE';
  if (['0', 'FALSE', 'NO'].includes(s)) return 'INACTIVE';
  if (['ACTIVE', 'ONLINE', 'APPROVED'].includes(s)) return 'ACTIVE';
  if (['PENDING', 'WAITING', 'WAITING_APPROVAL'].includes(s)) return 'PENDING';
  if (['BLOCKED', 'BANNED'].includes(s)) return 'BLOCKED';
  if (['INACTIVE', 'OFFLINE', 'DISABLED'].includes(s)) return 'INACTIVE';
  return s;
}
</script>

