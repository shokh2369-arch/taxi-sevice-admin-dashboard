<template>
  <div>
    <h1>Dashboard</h1>
    <div class="card-grid" v-if="summary">
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
    <p v-else>Loading...</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../api';

const summary = ref(null);

onMounted(async () => {
  try {
    const { data } = await api.getDashboard();
    summary.value = data;
  } catch (e) {
    console.error(e);
  }
});

const formatMoney = (cents) => {
  return '$' + (cents / 100).toFixed(2);
};
</script>

