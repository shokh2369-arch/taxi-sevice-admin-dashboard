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
        placeholder="Amount (USD)"
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
          <th>Amount</th>
          <th>Type</th>
          <th>Note</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td>{{ p.id }}</td>
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

function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}

async function add() {
  if (!amount.value || amount.value <= 0) return;
  const cents = Math.round(amount.value * 100);
  try {
    await apiPost(`/admin/drivers/${id}/add-balance`, {
      amount: cents,
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

