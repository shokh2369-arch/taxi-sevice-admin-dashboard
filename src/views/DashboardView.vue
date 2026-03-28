<template>
  <div>
    <h1>Dashboard</h1>
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" style="color: red;">{{ error }}</div>
    <template v-else>
      <div class="card-grid">
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
        <template v-if="cardBalances.mode === 'split'">
          <div class="card">
            <div>Jami promo balans</div>
            <strong>{{ formatMoney(cardBalances.promo) }}</strong>
            <div class="balance-hint" style="margin-top: 0.35rem;">Platforma krediti; naqdlashtirilmaydi.</div>
          </div>
          <div class="card">
            <div>Jami naqd balans</div>
            <strong>{{ formatMoney(cardBalances.cash) }}</strong>
            <div class="balance-hint" style="margin-top: 0.35rem;">Haqiqiy pul balansi.</div>
          </div>
          <div class="card">
            <div>Jami haydovchi balansi (promo+naqd)</div>
            <strong>{{ formatMoney(cardBalances.combined ?? summary.total_driver_balances) }}</strong>
            <div v-if="cardBalances.sourceHint" class="balance-hint" style="margin-top: 0.35rem;">{{ cardBalances.sourceHint }}</div>
            <div v-else class="balance-hint" style="margin-top: 0.35rem;">API: total_driver_balances</div>
          </div>
        </template>
        <div v-else class="card">
          <div>Jami haydovchi balansi</div>
          <strong>{{ formatMoney(cardBalances.combined ?? summary.total_driver_balances) }}</strong>
          <div v-if="driversAggLoading" class="balance-hint" style="margin-top: 0.35rem;">Promo/naqd ajratmasi tekshirilmoqda…</div>
        </div>
        <div v-if="cardBalances.commissionAccrued != null" class="card">
          <div>Hisoblangan komissiya (ichki)</div>
          <strong>{{ formatMoney(cardBalances.commissionAccrued) }}</strong>
          <div class="balance-hint" style="margin-top: 0.35rem;">API: total_internal_commission_accrued</div>
        </div>
        <div class="card">
          <div>Today's trips</div>
          <strong>{{ summary.todays_trips }}</strong>
        </div>
      </div>

      <h2 class="section-title">Legal compliance</h2>
      <div v-if="legalStatsLoading" class="muted">Loading legal stats…</div>
      <div v-else-if="legalStatsError" class="card legal-unavailable-card">
        <template v-if="isLegalAllRoutes404(legalStatsError)">
          <p style="margin: 0 0 0.5rem;"><strong>Legal monitoring</strong> is not available on this API host.</p>
          <p class="balance-hint" style="margin: 0;">
            No <code>/admin/legal/*</code> route responded at
            <strong>{{ apiBaseDisplay }}</strong>. On many deployments legal routes exist only when the legal service is enabled in Go
            (<code>legalSvc != nil</code>). The bundled default API (e.g. Render) may not mount them.
          </p>
          <p class="balance-hint" style="margin: 0.5rem 0 0;">
            Fix: set <code>VITE_API_BASE_URL</code> to the Go server that exposes legal admin routes, or enable legal in the backend and redeploy.
          </p>
          <details class="legal-unavailable-details">
            <summary>Technical details (URLs tried)</summary>
            <pre>{{ legalStatsError }}</pre>
          </details>
        </template>
        <div v-else style="color: #b91c1c; white-space: pre-wrap; font-size: 0.82rem;">
          {{ legalStatsError }}
        </div>
      </div>
      <div v-else class="card-grid">
        <div class="card">
          <div>Users accepted (legal)</div>
          <strong>{{ fmtCount(legalStats.totalUsersAccepted) }}</strong>
        </div>
        <div class="card">
          <div>Drivers accepted (legal)</div>
          <strong>{{ fmtCount(legalStats.totalDriversAccepted) }}</strong>
        </div>
        <div class="card">
          <div>Users missing legal</div>
          <strong>
            <span v-if="legalStats.usersMissingLegal != null" class="badge badge-legal-miss">{{ legalStats.usersMissingLegal }}</span>
            <span v-else>—</span>
          </strong>
        </div>
        <div class="card">
          <div>Drivers missing legal</div>
          <strong>
            <span v-if="legalStats.driversMissingLegal != null" class="badge badge-legal-miss">{{ legalStats.driversMissingLegal }}</span>
            <span v-else>—</span>
          </strong>
        </div>
      </div>

      <h2 class="section-title">Legal issues</h2>
      <div v-if="legalMissingLoading" class="muted">Loading legal issues…</div>
      <div v-else-if="legalMissingError" class="card legal-unavailable-card">
        <template v-if="isLegalAllRoutes404(legalMissingError)">
          <p style="margin: 0 0 0.5rem;"><strong>Legal issues list</strong> needs the same legal API routes as above.</p>
          <p class="balance-hint" style="margin: 0;">Host: <strong>{{ apiBaseDisplay }}</strong></p>
          <details class="legal-unavailable-details">
            <summary>Technical details (URLs tried)</summary>
            <pre>{{ legalMissingError }}</pre>
          </details>
        </template>
        <div v-else style="color: #b91c1c; white-space: pre-wrap; font-size: 0.82rem;">
          {{ legalMissingError }}
        </div>
      </div>
      <p v-else-if="!legalMissingRows.length" class="card muted" style="margin: 0;">No outstanding legal issues.</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Actor ID</th>
            <th>Type</th>
            <th>Missing documents</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in legalMissingRows" :key="`${row.actor_type}-${row.actor_id}-${i}`">
            <td>{{ row.actor_id }}</td>
            <td>{{ row.actor_type }}</td>
            <td>{{ row.missing_documents.join(', ') || '—' }}</td>
            <td>
              <span class="badge badge-legal-miss">Missing</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { apiGet, API_BASE } from '../api';
import { isLegalAllRoutes404 } from '../utils/legalUi.js';
import { fetchLegalStats, fetchLegalMissing } from '../api/legal.js';
import { normalizeLegalStats, normalizeMissingRow, unwrapMissingList } from '../utils/legalStatus.js';
import { aggregateBalancesFromDriversPayload, normalizeDashboardBalances } from '../utils/driverBalances.js';

const apiBaseDisplay = API_BASE;

const summary = ref(null);
const driversAgg = ref(/** @type {{ promoSum: number, cashSum: number, combinedSum: number, anySplit: boolean } | null} */ (null));
const driversAggLoading = ref(false);
const loading = ref(true);
const error = ref('');

const legalStatsRaw = ref(null);
const legalStatsLoading = ref(true);
const legalStatsError = ref('');

const legalMissingRaw = ref(null);
const legalMissingLoading = ref(true);
const legalMissingError = ref('');

const legalStats = computed(() => normalizeLegalStats(legalStatsRaw.value));

const legalMissingRows = computed(() => {
  const raw = legalMissingRaw.value;
  const list = Array.isArray(raw) ? raw : unwrapMissingList(raw);
  return list.map(normalizeMissingRow).filter(Boolean);
});

const dashBal = computed(() => normalizeDashboardBalances(summary.value));

/** Dashboard cards: summary totals, else sums from /admin/drivers when rows carry promo/cash. */
const cardBalances = computed(() => {
  const d = dashBal.value;
  const agg = driversAgg.value;
  if (d.mode === 'split') {
    return {
      mode: 'split',
      promo: d.promo ?? 0,
      cash: d.cash ?? 0,
      combined: d.combined,
      commissionAccrued: d.commissionAccrued,
      sourceHint: null
    };
  }
  if (agg?.anySplit) {
    return {
      mode: 'split',
      promo: agg.promoSum,
      cash: agg.cashSum,
      combined: agg.combinedSum || summary.value?.total_driver_balances,
      commissionAccrued: d.commissionAccrued,
      sourceHint: 'Haydovchilar ro‘yxatidan jamlangan (/admin/drivers)'
    };
  }
  return {
    mode: 'legacy',
    promo: null,
    cash: null,
    combined: d.combined,
    commissionAccrued: d.commissionAccrued,
    sourceHint: null
  };
});

onMounted(() => {
  loadDashboard();
  loadLegalStats();
  loadLegalMissing();
});

async function loadDashboard() {
  loading.value = true;
  error.value = '';
  driversAgg.value = null;
  try {
    summary.value = await apiGet('/admin/dashboard');
    const dash = normalizeDashboardBalances(summary.value);
    if (dash.mode === 'legacy') {
      driversAggLoading.value = true;
      try {
        const raw = await apiGet('/admin/drivers');
        driversAgg.value = aggregateBalancesFromDriversPayload(raw);
      } catch (e) {
        console.error(e);
        driversAgg.value = null;
      } finally {
        driversAggLoading.value = false;
      }
    }
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to load dashboard';
  } finally {
    loading.value = false;
  }
}

async function loadLegalStats() {
  legalStatsLoading.value = true;
  legalStatsError.value = '';
  try {
    legalStatsRaw.value = await fetchLegalStats();
  } catch (e) {
    console.error(e);
    legalStatsError.value = e instanceof Error ? e.message : 'Failed to load legal stats';
    legalStatsRaw.value = null;
  } finally {
    legalStatsLoading.value = false;
  }
}

async function loadLegalMissing() {
  legalMissingLoading.value = true;
  legalMissingError.value = '';
  const merged = [];
  let lastErr = '';
  for (const actorType of ['user', 'driver']) {
    try {
      const data = await fetchLegalMissing(actorType);
      merged.push(...unwrapMissingList(data));
    } catch (e) {
      console.error(e);
      lastErr = e instanceof Error ? e.message : 'Failed to load legal issues';
    }
  }
  legalMissingRaw.value = merged;
  if (merged.length === 0 && lastErr) legalMissingError.value = lastErr;
  legalMissingLoading.value = false;
}

const formatMoney = (amount) => {
  if (amount == null) return '0 so\'m';
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
};

/**
 * @param {number|null|undefined} n
 */
function fmtCount(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('uz-UZ').format(n);
}
</script>
