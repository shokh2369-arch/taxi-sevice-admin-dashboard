<template>
  <div>
    <h1>Foydalanuvchilar</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <template v-else>
      <p
        v-if="legalAcceptancesError"
        class="muted"
        style="margin-bottom: 0.75rem; color: #b45309; white-space: pre-wrap; font-size: 0.82rem;"
      >
        Legal acceptances: {{ legalAcceptancesError }} (user terms fallback: API terms_accepted)
      </p>
      <div class="filter-row">
        <div>
          <input
            v-model.trim="search"
            type="text"
            class="input"
            placeholder="Qidiruv: telefon, ism, telegram ID"
            style="max-width: 280px;"
          />
        </div>
        <label>
          Legal filter
          <select v-model="legalFilter" class="input" style="margin-left: 0.35rem;">
            <option :value="LEGAL_FILTER_ALL">All</option>
            <option :value="LEGAL_FILTER_ANY_MISSING">Missing any</option>
            <option :value="LEGAL_FILTER_TERMS">Missing user terms</option>
            <option :value="LEGAL_FILTER_PRIVACY">Missing privacy policy</option>
          </select>
        </label>
      </div>
      <table class="table" v-if="filteredUsers.length">
        <thead>
          <tr>
            <th>ID</th>
            <th>Telegram</th>
            <th>Role</th>
            <th>Name</th>
            <th>Phone</th>
            <th>terms_accepted</th>
            <th>User terms</th>
            <th>Privacy</th>
            <th>Version</th>
            <th>Legal</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="u in filteredUsers"
            :key="u._key"
            :class="{ 'table-row-legal-alert': legalSummary(u).missingCodes.length > 0 }"
          >
            <td>{{ u.user_id ?? '—' }}</td>
            <td>{{ u.telegram_id ?? '—' }}</td>
            <td>{{ u.role || '—' }}</td>
            <td>{{ u.name || '—' }}</td>
            <td>{{ u.phone || '—' }}</td>
            <td style="font-size: 0.8rem;">{{ formatTermsAccepted(u.terms_accepted) }}</td>
            <td>
              <span class="badge" :class="legalSummary(u).termsOk ? 'badge-legal-ok' : 'badge-legal-miss'">
                {{ legalSummary(u).termsOk ? '✅' : '❌' }}
              </span>
            </td>
            <td>
              <span class="badge" :class="legalSummary(u).privacyOk ? 'badge-legal-ok' : 'badge-legal-miss'">
                {{ legalSummary(u).privacyOk ? '✅' : '❌' }}
              </span>
            </td>
            <td>{{ legalSummary(u).versionLabel }}</td>
            <td>
              <button
                type="button"
                class="button"
                :disabled="u.user_id == null"
                @click="openLegalModal(u)"
              >
                History
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else>{{ search || legalFilter !== LEGAL_FILTER_ALL ? 'No users match filters.' : 'No users.' }}</p>
    </template>

    <LegalAcceptanceModal
      :open="legalModalOpen"
      actor-type="user"
      :actor-id="legalModalActorId"
      :title="legalModalTitle"
      :acceptances="acceptanceRows"
      @close="closeLegalModal"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchUsersList } from '../api/users.js';
import { fetchLegalAcceptances } from '../api/legal.js';
import LegalAcceptanceModal from '../components/LegalAcceptanceModal.vue';
import {
  USER_DOC_PRIVACY,
  USER_DOC_TERMS,
  buildAcceptanceMap,
  legalSummaryForActor,
  passesLegalFilter,
  LEGAL_FILTER_ALL,
  LEGAL_FILTER_ANY_MISSING,
  LEGAL_FILTER_TERMS,
  LEGAL_FILTER_PRIVACY,
  unwrapList
} from '../utils/legalStatus.js';

const users = ref([]);
const search = ref('');
const loading = ref(true);
const error = ref('');

const acceptanceRows = ref([]);
const legalAcceptancesError = ref('');
const legalFilter = ref(LEGAL_FILTER_ALL);

const legalCodes = { termsCode: USER_DOC_TERMS, privacyCode: USER_DOC_PRIVACY };

const acceptanceMap = computed(() => buildAcceptanceMap(acceptanceRows.value));

const legalModalOpen = ref(false);
const legalModalActorId = ref(null);
const legalModalTitle = ref('Acceptance history');

/**
 * Merge /admin/users `terms_accepted` with acceptances list when needed.
 * @param {object} u
 */
function legalSummary(u) {
  const base = legalSummaryForActor(acceptanceMap.value, 'user', u.user_id, legalCodes);
  const ta = u.terms_accepted;
  const apiTermsOk =
    ta === true ||
    ta === 1 ||
    String(ta).toLowerCase() === 'true' ||
    String(ta).toLowerCase() === 'yes';
  if (!base.termsOk && apiTermsOk) {
    const missing = base.missingCodes.filter((c) => c !== USER_DOC_TERMS);
    return { ...base, termsOk: true, missingCodes: missing };
  }
  return base;
}

const filteredUsers = computed(() => {
  let list = users.value;
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter((u) => {
      const phone = (u.phone || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      const tg = String(u.telegram_id ?? '').toLowerCase();
      return phone.includes(q) || name.includes(q) || tg.includes(q);
    });
  }
  if (legalFilter.value !== LEGAL_FILTER_ALL) {
    list = list.filter((u) => passesLegalFilter('user', legalSummary(u), legalFilter.value, legalCodes));
  }
  return list;
});

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    /** GET /admin/users (or fallbacks in fetchUsersList) */
    const raw = await fetchUsersList();
    const rows = Array.isArray(raw) ? raw : raw?.users || raw?.items || [];
    users.value = rows.map((row, idx) => normalizeUser(row, idx));
    legalAcceptancesError.value = '';
    try {
      const acceptancesData = await fetchLegalAcceptances();
      acceptanceRows.value = unwrapList(acceptancesData);
    } catch (le) {
      console.error(le);
      legalAcceptancesError.value = le instanceof Error ? le.message : 'Failed to load acceptances';
      acceptanceRows.value = [];
    }
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load users';
  } finally {
    loading.value = false;
  }
}

function openLegalModal(u) {
  if (u.user_id == null) return;
  legalModalActorId.value = u.user_id;
  legalModalTitle.value = `Legal — user #${u.user_id}`;
  legalModalOpen.value = true;
}

function closeLegalModal() {
  legalModalOpen.value = false;
}

/**
 * @param {unknown} v
 */
function formatTermsAccepted(v) {
  if (v === true || v === 1) return 'true';
  if (v === false || v === 0) return 'false';
  if (v == null) return '—';
  return String(v);
}

/**
 * @param {Record<string, unknown>} row
 * @param {number} idx
 */
function normalizeUser(row, idx) {
  if (!row || typeof row !== 'object') {
    return {
      user_id: null,
      telegram_id: null,
      role: '',
      phone: '',
      name: '',
      terms_accepted: undefined,
      _key: `row-${idx}`
    };
  }
  const userId = pickFirst(row, ['id', 'user_id', 'userId', 'passenger_id', 'customer_id']);
  const phone = pickFirst(row, ['phone', 'phone_number', 'mobile', 'user_phone']) ?? '';
  const fromFields = pickFirst(row, ['name', 'full_name', 'display_name', 'username', 'first_name']);
  const fromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const name = (fromFields ?? fromParts) || '';
  return {
    ...row,
    user_id: userId,
    telegram_id: row.telegram_id ?? row.telegramId ?? null,
    role: row.role != null ? String(row.role) : '',
    phone,
    name,
    terms_accepted: row.terms_accepted ?? row.termsAccepted,
    _key: String(userId ?? phone ?? `row-${idx}`)
  };
}

/**
 * @param {object} o
 * @param {string[]} keys
 */
function pickFirst(o, keys) {
  for (const k of keys) {
    const v = o?.[k];
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}
</script>
