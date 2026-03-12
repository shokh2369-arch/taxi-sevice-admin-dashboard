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
          <th>Note</th>
          <th class="text-center">Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td class="text-center">{{ p.id }}</td>
          <td class="text-center">{{ p.driver_id }}</td>
          <td class="text-center">{{ formatMoney(p.amount) }}</td>
          <td class="text-center">{{ p.type }}</td>
          <td>{{ p.note }}</td>
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
</script>

