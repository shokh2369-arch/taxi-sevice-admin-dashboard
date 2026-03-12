<template>
  <div>
    <h1>Drivers</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <table class="table" v-else-if="drivers.length">
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
          v-for="d in drivers"
          :key="d.driver_id"
          @click="goToDriver(d.driver_id)"
          style="cursor: pointer"
        >
          <td>{{ d.driver_id }}</td>
          <td>{{ d.name }}</td>
          <td>{{ d.phone }}</td>
          <td>{{ d.car_model }}</td>
          <td>{{ d.plate_number }}</td>
          <td>{{ formatMoney(d.balance) }}</td>
          <td>{{ formatMoney(d.total_paid) }}</td>
          <td>
            <span class="badge" :class="d.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'">
              {{ d.status }}
            </span>
          </td>
          <td @click.stop>
            <input
              type="number"
              class="input"
              v-model.number="topups[d.driver_id]"
              placeholder="amount"
              style="width: 80px"
            />
            <button class="button" @click="submitTopup(d.driver_id)">
              Add
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>Loading...</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet, apiPost } from '../api';

const router = useRouter();
const drivers = ref([]);
const topups = ref({});
const loading = ref(true);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    drivers.value = await apiGet('/admin/drivers');
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load drivers';
  } finally {
    loading.value = false;
  }
}

function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function goToDriver(id) {
  router.push({ name: 'driver-details', params: { id } });
}

async function submitTopup(id) {
  const amount = topups.value[id];
  if (!amount || amount <= 0) return;
  const cents = Math.round(amount * 100);
  try {
    await apiPost(`/admin/drivers/${id}/add-balance`, {
      amount: cents,
      note: 'Admin topup'
    });
    topups.value[id] = null;
    await load();
  } catch (e) {
    console.error(e);
  }
}
</script>

