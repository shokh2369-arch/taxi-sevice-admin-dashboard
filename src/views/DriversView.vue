<template>
  <div>
    <h1>Drivers</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <template v-else>
      <details v-if="debugKeys" class="card" style="margin-bottom: 1rem;">
        <summary style="cursor:pointer;">Debug: /admin/drivers payload keys</summary>
        <div style="margin-top: 0.75rem;">
          <div style="font-size: 0.85rem; color: #6b7280; margin-bottom: 0.35rem;">
            Top-level keys (first row)
          </div>
          <pre style="white-space: pre-wrap; margin: 0;">{{ debugKeys.top.join(', ') }}</pre>
          <div style="font-size: 0.85rem; color: #6b7280; margin: 0.75rem 0 0.35rem;">
            Nested application keys (first row)
          </div>
          <pre style="white-space: pre-wrap; margin: 0;">{{ debugKeys.app.join(', ') }}</pre>
        </div>
      </details>
      <div v-if="legalAcceptancesError" class="card legal-unavailable-card" style="margin-bottom: 1rem;">
        <p class="muted" style="margin: 0 0 0.35rem; color: #b45309;">
          <strong>Legal acceptances</strong> unavailable — driver/privacy columns show as missing until the legal API responds.
        </p>
        <details v-if="isLegalAllRoutes404(legalAcceptancesError)" class="legal-unavailable-details">
          <summary>Technical details</summary>
          <pre>{{ legalAcceptancesError }}</pre>
        </details>
        <p v-else class="muted" style="margin: 0; font-size: 0.82rem; white-space: pre-wrap;">{{ legalAcceptancesError }}</p>
      </div>
      <div class="filter-row">
        <div>
          <input
            v-model.trim="phoneSearch"
            type="text"
            class="input"
            placeholder="Search by phone number"
            style="max-width: 280px;"
          />
        </div>
        <label>
          Legal filter
          <select v-model="legalFilter" class="input" style="margin-left: 0.35rem;">
            <option :value="LEGAL_FILTER_ALL">All</option>
            <option :value="LEGAL_FILTER_ANY_MISSING">Missing any</option>
            <option :value="LEGAL_FILTER_TERMS">Missing driver terms</option>
            <option :value="LEGAL_FILTER_PRIVACY">Missing privacy policy</option>
          </select>
        </label>
      </div>
      <table class="table" v-if="filteredDrivers.length">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Phone</th>
          <th>Car</th>
          <th>Plate</th>
          <th>Balanslar</th>
          <th>Jami komissiya (ichki)</th>
          <th>Status</th>
          <th>Driver terms</th>
          <th>Privacy</th>
          <th>Version</th>
          <th>Legal</th>
          <th>Balans qo‘shish</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="d in filteredDrivers"
          :key="d._key"
          @click="goToDriver(d.driver_id)"
          :class="{ 'table-row-legal-alert': legalSummary(d).missingCodes.length > 0 }"
          :style="{ cursor: d.driver_id != null ? 'pointer' : 'default' }"
        >
          <td>{{ d.driver_id ?? '—' }}</td>
          <td>{{ driverDisplayName(d) }}</td>
          <td>{{ d.phone || '—' }}</td>
          <td>{{ d.car_model || '—' }}</td>
          <td>{{ d.plate_number || '—' }}</td>
          <td @click.stop>
            <div v-if="d.balance_mode === 'split'" class="balance-stack">
              <div class="balance-stack-row">
                <span class="badge badge-promo">Promo</span>
                <span>{{ formatMoney(d.promo_balance) }}</span>
              </div>
              <div v-if="d.promoProgram?.hasBackendProgress" class="balance-hint" style="font-size: 0.7rem; margin-top: 0.15rem;">
                Safar bonusi: {{ d.promoProgram.progressLabel }}
              </div>
              <template v-if="d.referralDisplay?.hasProgress">
                <div v-if="d.referralDisplay.tripsLabel" class="balance-hint" style="font-size: 0.7rem; margin-top: 0.1rem;">
                  Taklif: {{ d.referralDisplay.tripsLabel }}
                </div>
                <div v-if="d.referralDisplay.rewardStatusLabel" class="balance-hint" style="font-size: 0.7rem; margin-top: 0.05rem;">
                  {{ d.referralDisplay.rewardStatusLabel }}
                </div>
              </template>
              <div class="balance-stack-row" style="margin-top: 0.2rem;">
                <span class="badge badge-cash">Naqd</span>
                <span>{{ formatMoney(d.cash_balance) }}</span>
              </div>
              <div class="balance-stack-row" style="margin-top: 0.25rem;">
                <span class="muted" style="font-size: 0.72rem;">Jami</span>
                <span>{{ formatMoney(d.combined_balance) }}</span>
              </div>
            </div>
            <div v-else class="balance-stack">
              <div>{{ formatMoney(d.combined_balance) }}</div>
              <div class="balance-hint">Eski API: faqat yagona balans maydoni</div>
            </div>
          </td>
          <td>{{ formatMoney(d.internal_commission_display) }}</td>
          <td>
            <span class="badge" :class="statusClass(d.status)">
              {{ d.status || 'UNKNOWN' }}
            </span>
          </td>
          <td @click.stop>
            <span class="badge" :class="legalSummary(d).termsOk ? 'badge-legal-ok' : 'badge-legal-miss'">
              {{ legalSummary(d).termsOk ? '✅' : '❌' }}
            </span>
          </td>
          <td @click.stop>
            <span class="badge" :class="legalSummary(d).privacyOk ? 'badge-legal-ok' : 'badge-legal-miss'">
              {{ legalSummary(d).privacyOk ? '✅' : '❌' }}
            </span>
          </td>
          <td @click.stop>{{ legalSummary(d).versionLabel }}</td>
          <td @click.stop>
            <button
              type="button"
              class="button"
              :disabled="d.driver_id == null"
              @click="openLegalModal(d)"
            >
              History
            </button>
          </td>
          <td @click.stop>
            <div class="balance-stack" style="min-width: 9rem;">
              <select v-model="ensureTopup(d._topupKey).bucket" class="input" style="width: 100%; margin-bottom: 0.35rem; font-size: 0.75rem;">
                <option value="cash">Naqd balans</option>
                <option value="promo">Promo kredit</option>
              </select>
              <input
                type="number"
                class="input"
                v-model.number="ensureTopup(d._topupKey).amount"
                placeholder="Summa"
                style="width: 100%; margin-bottom: 0.35rem;"
              />
              <button type="button" class="button" style="width: 100%;" :disabled="d.driver_id == null" @click="submitTopup(d.driver_id, d._topupKey)">
                Qo‘shish
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else>{{ phoneSearch || legalFilter !== LEGAL_FILTER_ALL ? 'No drivers match filters.' : 'No drivers.' }}</p>
    </template>

    <LegalAcceptanceModal
      :open="legalModalOpen"
      actor-type="driver"
      :actor-id="legalModalActorId"
      :title="legalModalTitle"
      :acceptances="acceptanceRows"
      @close="closeLegalModal"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiGet } from '../api';
import { addDriverBalance } from '../api/driverBalance.js';
import { fetchLegalAcceptances } from '../api/legal.js';
import { driverDisplayName } from '../utils/driverDisplayName';
import LegalAcceptanceModal from '../components/LegalAcceptanceModal.vue';
import { isLegalAllRoutes404 } from '../utils/legalUi.js';
import { normalizeDriverBalances } from '../utils/driverBalances.js';
import { pickDriverInternalCommission } from '../utils/driverCommission.js';
import {
  DRIVER_DOC_PRIVACY,
  DRIVER_DOC_TERMS,
  buildAcceptanceMap,
  legalSummaryForActor,
  passesLegalFilter,
  LEGAL_FILTER_ALL,
  LEGAL_FILTER_ANY_MISSING,
  LEGAL_FILTER_TERMS,
  LEGAL_FILTER_PRIVACY,
  unwrapList
} from '../utils/legalStatus.js';
import { normalizePromoProgramFromSources } from '../utils/driverPromoProgram.js';
import { normalizeReferralFromSources } from '../utils/driverReferralProgram.js';

const router = useRouter();
const drivers = ref([]);
const phoneSearch = ref('');
/** @type {Record<string, { amount: number|null, bucket: 'promo'|'cash' }>} */
const topupState = reactive({});
const loading = ref(true);
const error = ref('');
const debugKeys = ref(null);

const acceptanceRows = ref([]);
const legalAcceptancesError = ref('');
const legalFilter = ref(LEGAL_FILTER_ALL);

const legalCodes = { termsCode: DRIVER_DOC_TERMS, privacyCode: DRIVER_DOC_PRIVACY };

const acceptanceMap = computed(() => buildAcceptanceMap(acceptanceRows.value));

const legalModalOpen = ref(false);
const legalModalActorId = ref(null);
const legalModalTitle = ref('Acceptance history');

function legalSummary(d) {
  return legalSummaryForActor(acceptanceMap.value, 'driver', d.driver_id, legalCodes);
}

const filteredDrivers = computed(() => {
  let list = drivers.value;
  const q = phoneSearch.value;
  if (q) {
    const lower = q.toLowerCase();
    list = list.filter((d) => (d.phone || '').toLowerCase().includes(lower));
  }
  if (legalFilter.value !== LEGAL_FILTER_ALL) {
    list = list.filter((d) => passesLegalFilter('driver', legalSummary(d), legalFilter.value, legalCodes));
  }
  return list;
});

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const raw = await apiGet('/admin/drivers');
    const rows = Array.isArray(raw) ? raw : raw?.drivers || [];
    captureDebugKeys(rows);
    drivers.value = rows.map((d, idx) => normalizeDriver(d, idx));
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
    error.value = e instanceof Error ? e.message : 'Failed to load drivers';
  } finally {
    loading.value = false;
  }
}

function openLegalModal(d) {
  if (d.driver_id == null) return;
  legalModalActorId.value = d.driver_id;
  legalModalTitle.value = `Legal — driver #${d.driver_id}`;
  legalModalOpen.value = true;
}

function closeLegalModal() {
  legalModalOpen.value = false;
}

function captureDebugKeys(rows) {
  if (!import.meta.env.DEV) return;
  if (debugKeys.value) return;
  const first = rows?.[0];
  if (!first || typeof first !== 'object') return;
  const app = first?.application ?? first?.driver_application ?? first?.application_data ?? first?.app ?? null;
  debugKeys.value = {
    top: Object.keys(first).sort(),
    app: app && typeof app === 'object' ? Object.keys(app).sort() : []
  };
}

function formatMoney(amount) {
  if (amount == null) return "0 so'm";
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
}

function goToDriver(id) {
  if (id == null) return;
  router.push({ name: 'driver-details', params: { id } });
}

/**
 * @param {string} key
 */
function ensureTopup(key) {
  if (!topupState[key]) {
    topupState[key] = { amount: null, bucket: 'cash' };
  }
  return topupState[key];
}

/**
 * @param {string|number|null} id
 * @param {string} key
 */
async function submitTopup(id, key) {
  if (id == null) return;
  const st = ensureTopup(key);
  const amount = st.amount;
  if (!amount || amount <= 0) return;
  const value = Math.round(amount);
  try {
    await addDriverBalance(id, {
      amount: value,
      note: st.bucket === 'promo' ? 'Admin: promo kredit' : 'Admin: naqd balans',
      bucket: st.bucket === 'promo' ? 'promo' : 'cash'
    });
    st.amount = null;
    st.bucket = 'cash';
    await load();
  } catch (e) {
    console.error(e);
  }
}

function normalizeDriver(d, idx) {
  const app = d?.application ?? d?.driver_application ?? d?.application_data ?? d?.app ?? {};
  const driverId = pickFirst(d, app, ['driver_id', 'id', 'driverId']);
  const statusRaw =
    pickFirst(d, app, [
      'application_app_status',
      'application_status',
      'app_status',
      'verification_status',
      'active_status',
      'is_active',
      'is_online',
      'status',
      'state',
      'driver_status',
      'online'
    ]);
  const status = normalizeStatus(statusRaw);
  const bal = normalizeDriverBalances(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  const internal_commission_display = pickDriverInternalCommission(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  const promoProgram = normalizePromoProgramFromSources(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  const referralDisplay = normalizeReferralFromSources(
    /** @type {Record<string, unknown>} */ (d),
    /** @type {Record<string, unknown>} */ (app)
  );
  return {
    ...d,
    ...app,
    promoProgram,
    referralDisplay,
    driver_id: driverId,
    phone: pickFirst(d, app, ['phone', 'driver_phone', 'phone_number', 'application_phone', 'phone_text']) ?? '',
    car_model: pickFirst(d, app, ['car_model', 'car_type_model', 'application_car_type_model', 'car', 'carName', 'car_name']) ?? '',
    plate_number: pickFirst(d, app, ['plate_number', 'plate_text', 'application_plate_text', 'plate', 'plateNo']) ?? '',
    ...bal,
    internal_commission_display,
    total_paid: Number(pickFirst(d, app, ['total_paid', 'totalPaid', 'paid_total']) ?? 0) || 0,
    status,
    _topupKey: String(driverId ?? `row-${idx}`),
    _key: String(driverId ?? pickFirst(d, app, ['phone', 'driver_phone', 'phone_number']) ?? `row-${idx}`)
  };
}

function pickFirst(a, b, keys) {
  for (const k of keys) {
    const va = a?.[k];
    if (va != null && String(va).trim() !== '') return va;
    const vb = b?.[k];
    if (vb != null && String(vb).trim() !== '') return vb;
    const vc = a?.[`application_${k}`];
    if (vc != null && String(vc).trim() !== '') return vc;
    const vd = b?.[`application_${k}`];
    if (vd != null && String(vd).trim() !== '') return vd;
  }
  return null;
}

function normalizeStatus(v) {
  if (typeof v === 'boolean') return v ? 'ACTIVE' : 'INACTIVE';
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';
  if (['1', 'TRUE', 'YES'].includes(s)) return 'ACTIVE';
  if (['0', 'FALSE', 'NO'].includes(s)) return 'INACTIVE';
  if (['ACTIVE', 'ONLINE', 'APPROVED'].includes(s)) return 'ACTIVE';
  if (['APPROVE', 'VERIFIED'].includes(s)) return 'ACTIVE';
  if (['PENDING', 'WAITING', 'WAITING_APPROVAL'].includes(s)) return 'PENDING';
  if (['REJECTED', 'DECLINED'].includes(s)) return 'BLOCKED';
  if (['BLOCKED', 'BANNED'].includes(s)) return 'BLOCKED';
  if (['INACTIVE', 'OFFLINE', 'DISABLED'].includes(s)) return 'INACTIVE';
  return s;
}

function statusClass(status) {
  if (status === 'ACTIVE') return 'badge-active';
  return 'badge-inactive';
}
</script>
