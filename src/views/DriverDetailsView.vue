<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <div v-else-if="driver">
    <h1>Driver #{{ driver.driver_id }}</h1>
    <div class="card">
      <p><strong>Name:</strong> {{ driver.name }}</p>
      <p><strong>Phone:</strong> {{ driver.phone }}</p>
      <p><strong>Car:</strong> {{ driver.car_model }}</p>
      <p><strong>Plate:</strong> {{ driver.plate_number }}</p>
      <p><strong>Balance:</strong> {{ formatMoney(driver.balance) }}</p>
      <p><strong>Total paid:</strong> {{ formatMoney(driver.total_paid) }}</p>
      <p>
        <strong>Status:</strong>
        <span class="badge" :class="driver.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'">
          {{ driver.status }}
        </span>
      </p>
    </div>

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
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet, apiPost } from '../api';

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
    const drivers = await apiGet('/admin/drivers');
    driver.value = drivers.find((d) => d.driver_id === id) || null;

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
</script>

