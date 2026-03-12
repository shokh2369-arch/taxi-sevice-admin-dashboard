<template>
  <div>
    <h1>Payments</h1>
    <table class="table" v-if="payments.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Driver</th>
          <th>Amount</th>
          <th>Type</th>
          <th>Note</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id">
          <td>{{ p.id }}</td>
          <td>{{ p.driver_id }}</td>
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
import api from '../api';

const payments = ref([]);

onMounted(async () => {
  try {
    const { data } = await api.getPayments();
    payments.value = data;
  } catch (e) {
    console.error(e);
  }
});

function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}
</script>

