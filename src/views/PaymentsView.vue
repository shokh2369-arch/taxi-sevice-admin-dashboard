<template>
  <div>
    <h1>Payments</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <table class="table" v-else-if="payments.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Driver</th>
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
          <td>
            <div>{{ formatDriver(p) }}</div>
            <div v-if="p.driver_name && p.driver_phone" style="font-size: 0.8rem; color: #6b7280;">
              {{ p.driver_phone }}
            </div>
          </td>
          <td>{{ formatTotalPrice(p) }}</td>
          <td>{{ formatMoney(p.amount) }}</td>
          <td>{{ p.type }}</td>
          <td>{{ p.note }}</td>
          <td>{{ new Date(p.created_at).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>Loading...</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiGet } from '../api';

const payments = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    payments.value = await apiGet('/admin/payments');
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load payments';
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

function formatDriver(p) {
  if (p.driver_name && p.driver_name.trim()) {
    return p.driver_name;
  }
  if (p.driver_phone && p.driver_phone.trim()) {
    return p.driver_phone;
  }
  return 'Unknown driver';
}
</script>

