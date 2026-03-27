<template>
  <div>
    <h1>Drivers</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <template v-else>
      <div style="margin-bottom: 1rem;">
        <input
          v-model.trim="phoneSearch"
          type="text"
          class="input"
          placeholder="Search by phone number"
          style="max-width: 280px;"
        />
      </div>
      <table class="table" v-if="filteredDrivers.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Phone</th>
          <th>Car</th>
          <th>Plate</th>
          <th>Balance</th>
          <th>Total paid</th>
          <th>Status</th>
          <th>Add balance</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="d in filteredDrivers"
          :key="d._key"
          @click="goToDriver(d.driver_id)"
          :style="{ cursor: d.driver_id != null ? 'pointer' : 'default' }"
        >
          <td>{{ d.driver_id ?? '—' }}</td>
          <td>{{ driverDisplayName(d) }}</td>
          <td>{{ d.phone || '—' }}</td>
          <td>{{ d.car_model || '—' }}</td>
          <td>{{ d.plate_number || '—' }}</td>
          <td>{{ formatMoney(d.balance) }}</td>
          <td>{{ formatMoney(d.total_paid) }}</td>
          <td>
            <span class="badge" :class="statusClass(d.status)">
              {{ d.status || 'UNKNOWN' }}
            </span>
          </td>
          <td @click.stop>
            <input
              type="number"
              class="input"
              v-model.number="topups[d._topupKey]"
              placeholder="amount"
              style="width: 80px"
            />
            <button class="button" :disabled="d.driver_id == null" @click="submitTopup(d.driver_id)">
              Add
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>{{ phoneSearch ? 'No drivers match this phone number.' : 'No drivers.' }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet, apiPost } from '../api';
import { driverDisplayName } from '../utils/driverDisplayName';

const router = useRouter();
const drivers = ref([]);
const phoneSearch = ref('');
const topups = ref({});
const loading = ref(true);
const error = ref('');

const filteredDrivers = computed(() => {
  const q = phoneSearch.value;
  if (!q) return drivers.value;
  const lower = q.toLowerCase();
  return drivers.value.filter((d) => (d.phone || '').toLowerCase().includes(lower));
});

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const raw = await apiGet('/admin/drivers');
    const rows = Array.isArray(raw) ? raw : raw?.drivers || [];
    drivers.value = rows.map((d, idx) => normalizeDriver(d, idx));
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load drivers';
  } finally {
    loading.value = false;
  }
}

function formatMoney(amount) {
  if (amount == null) return "0 so'm";
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
}

function goToDriver(id) {
  if (id == null) return;
  router.push({ name: 'driver-details', params: { id } });
}

async function submitTopup(id) {
  if (id == null) return;
  const amount = topups.value[id];
  if (!amount || amount <= 0) return;
  const value = Math.round(amount);
  try {
    await apiPost(`/admin/drivers/${id}/add-balance`, {
      amount: value,
      note: 'Admin topup'
    });
    topups.value[id] = null;
    await load();
  } catch (e) {
    console.error(e);
  }
}

function normalizeDriver(d, idx) {
  const app = d?.application ?? d?.driver_application ?? d?.application_data ?? d?.app ?? {};
  const driverId = pickFirst(d, app, ['driver_id', 'id', 'driverId']);
  const statusRaw =
    pickFirst(d, app, [
      'active_status',
      'is_active',
      'is_online',
      'status',
      'state',
      'driver_status',
      'application_app_status',
      'application_status',
      'app_status'
    ]);
  const status = normalizeStatus(statusRaw);
  return {
    ...d,
    ...app,
    driver_id: driverId,
    phone: pickFirst(d, app, ['phone', 'driver_phone', 'phone_number']) ?? '',
    car_model: pickFirst(d, app, ['car_model', 'car_type_model', 'car', 'carName', 'car_name']) ?? '',
    plate_number: pickFirst(d, app, ['plate_number', 'plate_text', 'plate', 'plateNo']) ?? '',
    balance: Number(pickFirst(d, app, ['balance', 'driver_balance']) ?? 0) || 0,
    total_paid: Number(pickFirst(d, app, ['total_paid', 'totalPaid', 'paid_total']) ?? 0) || 0,
    status,
    _topupKey: String(driverId ?? `row-${idx}`),
    _key: String(driverId ?? pickFirst(d, app, ['phone', 'driver_phone', 'phone_number']) ?? `row-${idx}`)
  };
}

function pickFirst(a, b, keys) {
  for (const k of keys) {
    const va = a?.[k];
    if (va != null && String(va).trim() !== '') return va;
    const vb = b?.[k];
    if (vb != null && String(vb).trim() !== '') return vb;
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
  if (['PENDING', 'WAITING', 'WAITING_APPROVAL'].includes(s)) return 'PENDING';
  if (['BLOCKED', 'BANNED'].includes(s)) return 'BLOCKED';
  if (['INACTIVE', 'OFFLINE', 'DISABLED'].includes(s)) return 'INACTIVE';
  return s;
}

function statusClass(status) {
  if (status === 'ACTIVE') return 'badge-active';
  return 'badge-inactive';
}
</script>

