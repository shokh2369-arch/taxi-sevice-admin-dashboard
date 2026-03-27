<template>
  <div>
    <h1>Driver actions</h1>
    <p style="color: #6b7280; margin-top: 0.25rem; margin-bottom: 1rem;">
      See where drivers face difficulties so you can improve support.
    </p>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <template v-else>
      <table class="table" v-if="actions.length">
        <thead>
          <tr>
            <th>Date</th>
            <th>Driver</th>
            <th>Type</th>
            <th>Difficulty</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in actions" :key="a.id">
            <td>{{ formatDate(a.created_at) }}</td>
            <td>
              <RouterLink
                v-if="a.driver_id"
                :to="{ name: 'driver-details', params: { id: a.driver_id } }"
                style="color: #2563eb; text-decoration: underline;"
              >
                {{ driverLabel(a) }}
              </RouterLink>
              <span v-else>{{ driverLabel(a) }}</span>
            </td>
            <td>{{ a.action_type || a.type || '—' }}</td>
            <td>
              <span class="badge" :class="difficultyClass(a.difficulty)">
                {{ a.difficulty || '—' }}
              </span>
            </td>
            <td>{{ a.message || a.note || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="card">
        <p style="margin: 0; color: #6b7280;">
          No driver actions or difficulties recorded yet. When the backend sends data to
          <code style="font-size: 0.8rem;">GET /admin/driver-actions</code>, they will appear here.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { apiGet } from '../api';

const actions = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    actions.value = await apiGet('/admin/driver-actions');
    if (!Array.isArray(actions.value)) {
      actions.value = [];
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('404')) {
      actions.value = [];
    } else {
      console.error(e);
      error.value = e instanceof Error ? e.message : 'Failed to load driver actions';
    }
  } finally {
    loading.value = false;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function driverLabel(a) {
  if (a.driver_phone && String(a.driver_phone).trim()) return a.driver_phone;
  if (a.driver_id) return `Driver #${a.driver_id}`;
  return '—';
}

function difficultyClass(difficulty) {
  if (!difficulty) return '';
  const d = String(difficulty).toLowerCase();
  if (d === 'error' || d === 'critical') return 'badge-inactive';
  if (d === 'warning' || d === 'medium') return 'badge-warning';
  return 'badge-active';
}
</script>
