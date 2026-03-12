<template>
  <div>
    <h1>Dashboard</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <div class="card-grid" v-else>
      <div class="card">
        <div>Total drivers</div>
        <strong>{{ summary.total_drivers }}</strong>
      </div>
      <div class="card">
        <div>Active drivers</div>
        <strong>{{ summary.active_drivers }}</strong>
      </div>
      <div class="card">
        <div>Inactive drivers</div>
        <strong>{{ summary.inactive_drivers }}</strong>
      </div>
      <div class="card">
        <div>Total balances</div>
        <strong>{{ formatMoney(summary.total_driver_balances) }}</strong>
      </div>
      <div class="card">
        <div>Today's trips</div>
        <strong>{{ summary.todays_trips }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiGet } from '../api';

const summary = ref(null);
const loading = ref(true);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    summary.value = await apiGet('/admin/dashboard');
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load dashboard';
  } finally {
    loading.value = false;
  }
}

const formatMoney = (amount) => {
  if (amount == null) return '0 so\'m';
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
};
</script>

