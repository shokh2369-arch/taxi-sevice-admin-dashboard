<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @click.self="emit('close')">
      <div class="modal-panel card" role="dialog" aria-modal="true" :aria-labelledby="titleId" @click.stop>
        <div class="modal-panel-header">
          <h2 :id="titleId" class="modal-panel-title">{{ title }}</h2>
          <button type="button" class="button button-ghost" @click="emit('close')">Close</button>
        </div>
        <div v-if="loading" class="modal-panel-body muted">Loading…</div>
        <div v-else-if="loadError" class="modal-panel-body" style="color: #b91c1c;">{{ loadError }}</div>
        <div v-else-if="!rows.length" class="modal-panel-body muted">No acceptance records for this actor.</div>
        <div v-else class="modal-panel-body modal-table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Version</th>
                <th>Accepted at</th>
                <th>Source</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="i">
                <td>{{ r.document_code }}</td>
                <td>{{ r.version_display ?? '—' }}</td>
                <td>{{ formatDate(r.accepted_at) }}</td>
                <td>{{ r.source ?? r.user_agent ?? '—' }}</td>
                <td>{{ r.ip_address ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { fetchLegalAcceptances } from '../api/legal.js';
import { acceptanceHistoryForActor, unwrapList } from '../utils/legalStatus.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Acceptance history' },
  actorType: { type: String, default: 'driver' },
  actorId: { type: [String, Number], default: null },
  /** When set, skips network fetch (e.g. pass parent’s cached acceptances list). */
  acceptances: { type: Array, default: null }
});

const emit = defineEmits(['close']);

const titleId = `legal-modal-${Math.random().toString(36).slice(2, 9)}`;
const loading = ref(false);
const loadError = ref('');
const fetchedRows = ref([]);

const sourceRows = computed(() => {
  if (Array.isArray(props.acceptances)) return props.acceptances;
  return fetchedRows.value;
});

const rows = computed(() => {
  if (props.actorId == null) return [];
  return acceptanceHistoryForActor(sourceRows.value, props.actorType, props.actorId);
});

watch(
  () => [props.open, props.actorId, props.actorType, props.acceptances],
  async ([isOpen]) => {
    if (!isOpen) return;
    if (props.actorId == null) return;
    loadError.value = '';
    if (Array.isArray(props.acceptances)) {
      loading.value = false;
      fetchedRows.value = [];
      return;
    }
    loading.value = true;
    try {
      const data = await fetchLegalAcceptances();
      fetchedRows.value = unwrapList(data);
    } catch (e) {
      console.error(e);
      loadError.value = e instanceof Error ? e.message : 'Failed to load acceptances';
      fetchedRows.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);
/**
 * @param {string|null|undefined} iso
 */
function formatDate(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}
</script>
