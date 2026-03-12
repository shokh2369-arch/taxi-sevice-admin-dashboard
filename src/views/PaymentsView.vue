<template>
  <div>
    <h1>Payments</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <table class="table" v-else-if="payments.length">
      <thead>
        <tr>
          <th class="text-center">ID</th>
          <th class="text-center">Driver</th>
          <th class="text-center">Amount</th>
          <th class="text-center">Type</th>
          <th class="text-left">Note</th>
          <th class="text-center">Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td class="text-center">{{ p.id }}</td>
          <td class="text-center">
            <div>{{ formatDriver(p) }}</div>
            <div v-if="p.driver_name && p.driver_phone" style="font-size: 0.8rem; color: #6b7280;">
              {{ p.driver_phone }}
            </div>
          </td>
          <td class="text-center">{{ formatMoney(p.amount) }}</td>
          <td class="text-center">{{ p.type }}</td>
          <td class="text-left">{{ p.note }}</td>
          <td class="text-center">{{ new Date(p.created_at).toLocaleString() }}</td>
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

