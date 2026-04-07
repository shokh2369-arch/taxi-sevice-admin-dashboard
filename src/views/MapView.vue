<template>
  <div>
    <h1>Live Map</h1>
    <p class="map-stats" style="margin: 0 0 0.35rem; font-size: 0.95rem;">
      <strong>Drivers (map API):</strong> {{ mapApiDriverCount }}
      · <strong>Markers plotted:</strong> {{ mapMarkersPlotted }}
      · <strong>Online + live</strong> <span class="muted" style="font-size: 0.8rem;">(is_active &amp; live_location_active)</span>:
      {{ mapOnlineLiveCount }}
      · <strong>Requests (map API):</strong> {{ mapRequestsApiCount }}
      · <strong>Request markers:</strong> {{ mapRequestMarkersPlotted }}
    </p>
    <p v-if="!adminProfilesLoaded" class="muted" style="margin: 0 0 0.5rem; font-size: 0.82rem;">
      Profile data (name / phone / plate) requires <code style="font-size: inherit;">GET /admin/drivers</code> — last fetch failed; markers still show map positions.
    </p>
    <p style="margin-top: -0.25rem; color: #4b5563; font-size: 0.9rem;">
      Auto refresh every {{ pollSeconds }}s
      <span v-if="!useGoogleMaps" style="display: block; margin-top: 0.25rem; font-size: 0.8rem;">
        Using OpenStreetMap. Set <code style="font-size: inherit;">VITE_GOOGLE_MAPS_API_KEY</code> for Google Maps.
      </span>
    </p>

    <div class="map-legend" style="margin: 0.75rem 0 1rem;">
      <span><span class="legend-dot legend-green"></span>Driver: online + live</span>
      <span><span class="legend-dot legend-gray"></span>Driver: offline</span>
      <span><span class="legend-dot legend-red"></span>Driver: no live</span>
      <span><span class="legend-dot legend-blue"></span>Ride request</span>
    </div>

    <div v-if="error" style="color: #b91c1c; margin-bottom: 0.75rem;">{{ error }}</div>
    <div v-if="driverWarning" style="color: #b45309; margin-bottom: 0.25rem;">{{ driverWarning }}</div>
    <div v-if="requestWarning" style="color: #b45309; margin-bottom: 0.75rem;">{{ requestWarning }}</div>

    <div class="map-layout">
      <aside class="map-sidebar">
        <details class="map-details" :open="Boolean(selectedItem)">
          <summary class="map-details-summary">
            <span><strong>Details</strong></span>
            <span class="muted" style="font-size: 0.82rem;">
              <template v-if="selectedItem">
                {{ selectedItem.type }} #{{ selectedItem.id }}
              </template>
              <template v-else>Tap to open</template>
            </span>
          </summary>
          <div class="map-details-body">
            <div v-if="!selectedItem">
              Tap a ride request or driver marker.
            </div>
            <div v-else>
          <p><strong>Type:</strong> {{ selectedItem.type }}</p>
          <p><strong>ID:</strong> {{ selectedItem.id }}</p>
          <template v-if="selectedItem.type === 'driver'">
            <p v-if="selectedItem.driver_name"><strong>Name:</strong> {{ selectedItem.driver_name }}</p>
            <p v-if="selectedItem.plate_number"><strong>Plate:</strong> {{ selectedItem.plate_number }}</p>
          </template>
          <template v-if="selectedItem.type === 'request'">
            <p v-if="selectedItem.rider_name"><strong>Client:</strong> {{ selectedItem.rider_name }}</p>
            <p class="muted" style="font-size: 0.8rem; margin: 0.25rem 0 0;">Tip: click the blue map pin to open the request pop-up.</p>
          </template>
          <p><strong>Phone:</strong> {{ selectedItem.phone || 'N/A' }}</p>

          <button
            v-if="selectedItem.phone"
            class="button"
            style="margin-right: 0.5rem; margin-bottom: 0.5rem;"
            @click="callNumber(selectedItem.phone)"
          >
            {{ selectedItem.type === 'driver' ? 'Call driver' : 'Call rider' }}
          </button>

          <button
            v-if="selectedItem.type === 'request'"
            class="button"
            style="margin-bottom: 0.5rem;"
            @click="loadNearestDrivers(selectedItem)"
          >
            Fetch nearest drivers
          </button>

          <button
            v-if="selectedItem.type === 'driver'"
            class="button"
            style="margin-bottom: 0.5rem;"
            @click="loadNearestRequests(selectedItem)"
          >
            Fetch nearest requests
          </button>

          <div v-if="nearestList.length" style="margin-top: 0.5rem;">
            <h4 style="margin: 0 0 0.35rem;">Nearest {{ selectedItem.type === 'driver' ? 'requests' : 'drivers' }}</h4>
            <p v-if="nearestActionStatus" class="muted" style="margin: 0 0 0.35rem; font-size: 0.82rem; white-space: pre-wrap;">
              {{ nearestActionStatus }}
            </p>
            <ul style="margin: 0; padding-left: 1.1rem;">
              <li v-for="(row, idx) in nearestList" :key="idx" style="margin-bottom: 0.25rem;">
                <span>{{ nearestLabel(row) }}</span>
                <button
                  v-if="selectedItem.type === 'request'"
                  type="button"
                  class="button"
                  style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.8rem;"
                  :disabled="nearestActionBusyKey === `${selectedItem.id}:${(row?.id ?? row?.driver_id ?? row?.driver_user_id ?? '')}`"
                  @click="sendRequestToNearestDriver(row)"
                >
                  Send
                </button>
                <button
                  v-if="selectedItem.type === 'driver'"
                  type="button"
                  class="button"
                  style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.8rem;"
                  :disabled="nearestActionBusyKey === `${(row?.request_id ?? row?.id ?? row?.trip_id ?? '')}:${selectedItem.id}`"
                  @click="sendNearestRequestToSelectedDriver(row)"
                >
                  Send
                </button>
              </li>
            </ul>
          </div>
            </div>
          </div>
        </details>
      </aside>

      <section class="map-box">
        <div ref="mapEl" class="map-canvas"></div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiGet, apiPostJson, API_BASE } from '../api';
import { fetchUsersList } from '../api/users.js';

const mapEl = ref(null);
const leafletMap = ref(null);
const driverLayer = ref(null);
const requestLayer = ref(null);

const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const useGoogleMaps = computed(() => Boolean(GOOGLE_KEY));

let googleMap = null;
let googleInfoWindow = null;
const googleDriverMarkers = [];
const googleRequestMarkers = [];

/** Map poll interval (see GET /admin/map/drivers). */
const pollMs = 10000;
const pollSeconds = Math.floor(pollMs / 1000);

/**
 * When true, only plot drivers where `live_location_active` is truthy (1) after coords parse.
 * Default: show everyone the API returns with valid last_lat/last_lng.
 */
const MAP_DRIVERS_ONLINE_POSITION_ONLY = true;
const error = ref('');
const selectedItem = ref(null);
const nearestList = ref([]);
let pollTimer = null;
const requestWarning = ref('');
const driverWarning = ref('');
/** Counts from GET /admin/map/drivers array length (successful parse), not from row.total. */
const mapApiDriverCount = ref(0);
const mapMarkersPlotted = ref(0);
/** Rows where both numeric flags read as 1 (same rule as green markers when map DTO includes flags). */
const mapOnlineLiveCount = ref(0);
const mapRequestsApiCount = ref(0);
const mapRequestMarkersPlotted = ref(0);
const adminProfilesLoaded = ref(false);
const nearestActionStatus = ref('');
const nearestActionBusyKey = ref('');
let googleInitFitted = false;
let leafletLocked = false;
let googleLocked = false;

/**
 * Gin `GET /admin/map/drivers` — JSON array of `{ id, last_lat, last_lng, is_active, live_location_active }`.
 * Backend should return all rows with non-null lat/lng; `id` is `drivers.user_id` (join to `driver_id` on GET /admin/drivers).
 * Client uses flags for colours / counts, not to infer who was returned from SQL.
 */
const DRIVER_MAP_PATH = '/admin/map/drivers';
const REQUEST_MAP_PATH = '/admin/map/ride-requests';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fields come from GET /admin/drivers (not the minimal map DTO). */
function pickAdminDriverName(row) {
  if (!row || typeof row !== 'object') return '';
  const app = row.application ?? row.driver_application ?? row.application_data ?? row.app ?? {};
  let n =
    row.name ??
    row.full_name ??
    row.driver_name ??
    app.name ??
    app.full_name ??
    app.driver_name;
  if (!phoneStr(n)) {
    const jr = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    const ja = [app.first_name, app.last_name].filter(Boolean).join(' ').trim();
    n = jr || ja;
  }
  return phoneStr(n);
}

function pickAdminPlate(row) {
  if (!row || typeof row !== 'object') return '';
  const app = row.application ?? row.driver_application ?? row.application_data ?? row.app ?? {};
  return phoneStr(row.plate_number ?? row.plate ?? app.plate_number ?? app.plate ?? app.car_plate);
}

/**
 * GET /admin/map/drivers contract: `is_active` and `live_location_active` are 0/1 numbers, not booleans.
 * @param {unknown} v
 */
function intFlagOne(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v == null) return false;
  const n = Number(v);
  if (Number.isFinite(n)) return n === 1;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** @type {[string, string][]} */
const DRIVER_LAT_LNG_KEY_PAIRS = [
  ['last_lat', 'last_lng'],
  ['last_latitude', 'last_longitude'],
  ['current_lat', 'current_lng'],
  ['current_latitude', 'current_longitude'],
  ['map_lat', 'map_lng'],
  ['latitude', 'longitude'],
  ['lat', 'lng'],
  ['lat', 'lon'],
  ['Lat', 'Lng']
];

/** GeoJSON Point / generic coordinates: [longitude, latitude] */
function latLngFromCoordinatesArray(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const a = num(coords[0]);
  const b = num(coords[1]);
  if (a == null || b == null) return null;
  return [b, a];
}

function pickLatLngFromFlatObject(o) {
  if (!o || typeof o !== 'object') return null;
  for (const [latKey, lngKey] of DRIVER_LAT_LNG_KEY_PAIRS) {
    const lat = num(o[latKey]);
    const lng = num(o[lngKey]);
    if (lat != null && lng != null) return [lat, lng];
  }
  // Reversed pair attempt for Lon/Lat style keys
  const lat = num(o.Lat ?? o.lat ?? o.latitude ?? o.last_lat ?? o.last_latitude);
  const lng = num(o.Lng ?? o.lon ?? o.lng ?? o.longitude ?? o.last_lng ?? o.last_longitude);
  if (lat != null && lng != null) return [lat, lng];
  if (Array.isArray(o.coordinates)) return latLngFromCoordinatesArray(o.coordinates);
  const geom = o.geometry;
  if (geom && Array.isArray(geom.coordinates)) return latLngFromCoordinatesArray(geom.coordinates);
  return null;
}

const DRIVER_NESTED_LOCATION_KEYS = [
  'location',
  'last_location',
  'live_location',
  'telegram_location',
  'current_location',
  'position',
  'geo',
  'coordinates_obj'
];

function pickDriverLatLng(row) {
  const direct = pickLatLngFromFlatObject(row);
  if (direct) return direct;
  if (!row || typeof row !== 'object') return null;
  for (const key of DRIVER_NESTED_LOCATION_KEYS) {
    const nested = row[key];
    const ll = pickLatLngFromFlatObject(nested);
    if (ll) return ll;
  }
  return null;
}

/** @type {[string, string][]} */
const REQUEST_LAT_LNG_KEY_PAIRS = [
  ['pickup_lat', 'pickup_lng'],
  ['pickup_latitude', 'pickup_longitude'],
  ['from_lat', 'from_lng'],
  ['latitude', 'longitude'],
  ['lat', 'lng'],
  ['lat', 'lon']
];

function pickRequestLatLng(row) {
  if (!row || typeof row !== 'object') return null;
  for (const [latKey, lngKey] of REQUEST_LAT_LNG_KEY_PAIRS) {
    const lat = num(row[latKey]);
    const lng = num(row[lngKey]);
    if (lat != null && lng != null) return [lat, lng];
  }
  const nested =
    row.pickup_location ??
    row.pickup ??
    row.from ??
    row.origin ??
    row.location;
  const fromNested = pickLatLngFromFlatObject(nested);
  if (fromNested) return fromNested;
  if (Array.isArray(row.coordinates)) return latLngFromCoordinatesArray(row.coordinates);
  const geom = row.geometry;
  if (geom && Array.isArray(geom.coordinates)) return latLngFromCoordinatesArray(geom.coordinates);
  return null;
}

function phoneStr(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/** Rough check: value looks like a phone (digits), not e.g. telegram_username. */
function looksLikePhoneValue(s) {
  if (!s) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 8;
}

const DRIVER_PHONE_KEYS = [
  'phone',
  'driver_phone',
  'phone_number',
  'phoneNumber',
  'Phone',
  'mobile',
  'mobile_phone',
  'mobilePhone',
  'cell',
  'msisdn',
  'contact_phone',
  'primary_phone',
  'application_phone',
  'tel',
  'telegram_phone',
  'whatsapp',
  'whatsapp_number'
];

const DRIVER_PHONE_PARENT_KEYS = [
  'application',
  'driver_application',
  'application_data',
  'app',
  'user',
  'profile',
  'driver',
  'telegram',
  'contact',
  'contacts',
  'meta',
  'details',
  'info',
  'personal'
];

const RIDER_PHONE_KEYS = [
  'phone',
  'rider_phone',
  'passenger_phone',
  'user_phone',
  'customer_phone',
  'client_phone',
  'phone_number',
  'phoneNumber',
  'mobile',
  'mobile_phone',
  'contact_phone',
  'pickup_phone',
  'from_phone',
  'msisdn',
  'telegram_phone',
  'whatsapp',
  'whatsapp_number'
];

const RIDER_PHONE_PARENT_KEYS = [
  'user',
  'rider',
  'passenger',
  'customer',
  'client',
  'profile',
  'telegram',
  'contact',
  'contacts',
  'meta',
  'booking',
  'details',
  'info'
];

function pickFirstPhoneFromObject(o, keys) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return '';
  for (const k of keys) {
    const s = phoneStr(o[k]);
    if (s && looksLikePhoneValue(s)) return s;
  }
  return '';
}

/** Any own key that looks phone-related (API uses odd JSON tags). Skips telegram_id / usernames. */
function pickPhoneByLooseKeyScan(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return '';
  for (const [k, v] of Object.entries(o)) {
    if (v == null || typeof v === 'object') continue;
    const kl = k.toLowerCase();
    if (kl === 'telegram_id' || kl === 'telegramid' || kl === 'user_id' || kl === 'chat_id') continue;
    if (
      kl.includes('phone') ||
      kl.includes('msisdn') ||
      kl === 'mobile' ||
      kl === 'cell' ||
      kl === 'tel' ||
      kl.includes('whatsapp')
    ) {
      const s = phoneStr(v);
      if (s && looksLikePhoneValue(s)) return s;
    }
  }
  return '';
}

/**
 * Depth-first phone search for map DTOs (nested application / user / telegram).
 * @param {string[]} preferredKeys
 * @param {string[]} childPropNames — extra object properties to recurse into
 */
function pickPhoneDeep(o, preferredKeys, childPropNames, maxDepth) {
  const seen = new Set();

  function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > maxDepth) return '';
    if (seen.has(node)) return '';
    seen.add(node);

    let p = pickFirstPhoneFromObject(node, preferredKeys);
    if (p) return p;
    p = pickPhoneByLooseKeyScan(node);
    if (p) return p;

    for (const prop of childPropNames) {
      const child = node[prop];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        p = walk(child, depth + 1);
        if (p) return p;
      }
    }
    return '';
  }

  return walk(o, 0);
}

const DRIVER_PHONE_SCAN_PROPS = [...new Set([...DRIVER_PHONE_PARENT_KEYS, 'data', 'payload', 'attributes'])];

function pickDriverPhone(d) {
  return pickPhoneDeep(d, DRIVER_PHONE_KEYS, DRIVER_PHONE_SCAN_PROPS, 5);
}

function pickRiderPhone(r) {
  const props = [...new Set([...RIDER_PHONE_PARENT_KEYS, 'data', 'payload', 'attributes'])];
  return pickPhoneDeep(r, RIDER_PHONE_KEYS, props, 5);
}

/** After `{ ...inner, ...row }`, restore nested phones if the wrapper cleared them with "" / null. */
function restoreNestedStrings(merged, inner, keys) {
  if (!inner || typeof inner !== 'object') return;
  for (const k of keys) {
    if (!phoneStr(merged[k]) && phoneStr(inner[k])) merged[k] = inner[k];
  }
}

function markerIconLeaflet(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

/** Offline when the API clearly says so (grey marker). */
function driverExplicitlyOffline(d) {
  if (!d || typeof d !== 'object') return false;
  if (d.is_active != null && Number(d.is_active) === 0) return true;
  if (d.online === false || d.is_online === false || d.isOnline === false) return true;
  if (d.offline === true || d.is_offline === true) return true;
  const st = String(d.status ?? d.driver_status ?? d.state ?? '').toLowerCase();
  if (['offline', 'off_line', 'inactive', 'unavailable'].includes(st)) return true;
  return false;
}

/**
 * Legacy / other DTOs: explicit booleans / status (not the map 0/1 fields — those use intFlagOne in driverStatusColor).
 */
function driverStrictlyOnline(d) {
  if (!d || typeof d !== 'object') return false;
  if (driverExplicitlyOffline(d)) return false;
  if (d.is_active != null) return intFlagOne(d.is_active);
  if (d.online === true || d.is_online === true || d.isOnline === true) return true;
  if (d.driver_online === true || d.on_duty === true) return true;
  const st = String(d.status ?? d.driver_status ?? d.state ?? '').toLowerCase();
  if (['online', 'on_line', 'onduty', 'on-duty', 'on_duty'].includes(st)) return true;
  return false;
}

function driverHasLiveCoordsOnly(d) {
  const hasCoords =
    Array.isArray(d.latlng) &&
    d.latlng.length >= 2 &&
    Number.isFinite(d.latlng[0]) &&
    Number.isFinite(d.latlng[1]);
  return hasCoords;
}

/**
 * “Live” for legend: map contract uses `live_location_active` (0/1). Legacy DTOs use booleans or coords.
 */
function driverHasLivePosition(d) {
  if (d.live_location_active != null) return intFlagOne(d.live_location_active);
  return Boolean(
    d.live ?? d.has_live ?? d.has_live_location ?? d.sharing_live_location ?? driverHasLiveCoordsOnly(d)
  );
}

/**
 * Marker colours — GET /admin/map/drivers shape:
 * - Green: is_active === 1 and live_location_active === 1 (numeric/boolean both accepted).
 * - Red: is_active === 1 but live_location_active === 0 (active, not sharing live).
 * - Grey: is_active === 0 or legacy offline / not “online” under other DTOs.
 */
function driverStatusColor(d) {
  if (driverExplicitlyOffline(d)) return '#6b7280';

  const hasNumericMapFlags =
    d &&
    typeof d === 'object' &&
    (d.is_active != null || d.live_location_active != null);

  if (hasNumericMapFlags) {
    const active = d.is_active != null ? intFlagOne(d.is_active) : true;
    const live =
      d.live_location_active != null
        ? intFlagOne(d.live_location_active)
        : driverHasLiveCoordsOnly(d);
    if (!active) return '#6b7280';
    if (live) return '#16a34a';
    return '#dc2626';
  }

  const online = driverStrictlyOnline(d);
  const hasLive = driverHasLivePosition(d);
  if (online && hasLive) return '#16a34a';
  if (online && !hasLive) return '#dc2626';
  return '#6b7280';
}

async function firstSuccess(paths) {
  let lastErr = null;
  for (const p of paths) {
    try {
      console.log('[Map] fetching', `${API_BASE}${p}`);
      const data = await apiGet(p);
      console.log('[Map] success', `${API_BASE}${p}`);
      return data;
    } catch (e) {
      console.error('[Map] fetch failed', `${API_BASE}${p}`, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All endpoint attempts failed');
}

function extractDriverRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const keys = [
    'drivers',
    'map_drivers',
    'active_drivers',
    'items',
    'results',
    'rows',
    'list',
    'values',
    'data'
  ];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
  }
  const inner = raw.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    for (const k of keys) {
      if (Array.isArray(inner[k])) return inner[k];
    }
  }
  return [];
}

function extractRequestRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const keys = [
    'requests',
    'ride_requests',
    'map_ride_requests',
    'active_ride_requests',
    'items',
    'results',
    'rows',
    'list',
    'values',
    'data'
  ];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
  }
  const inner = raw.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    for (const k of keys) {
      if (Array.isArray(inner[k])) return inner[k];
    }
  }
  return [];
}

/** Merge nested `driver` blob (common in API wrappers) so coords/phone on either level apply. */
function unwrapMapDriverRow(row) {
  if (!row || typeof row !== 'object') return row;
  const nested = row.driver ?? row.Driver;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const merged = { ...nested, ...row };
    restoreNestedStrings(merged, nested, DRIVER_PHONE_KEYS);
    return merged;
  }
  return row;
}

function unwrapMapRequestRow(row) {
  if (!row || typeof row !== 'object') return row;
  const nested = row.ride_request ?? row.request ?? row.Request ?? row.RideRequest;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const merged = { ...nested, ...row };
    restoreNestedStrings(merged, nested, RIDER_PHONE_KEYS);
    return merged;
  }
  return row;
}

/**
 * Join map row `id` to admin row `driver_id` only (two APIs — do not mix keys blindly).
 * @param {Map<string, { phone: string, name: string, plate_number: string }>} profileByDriverId
 */
function normalizeDrivers(raw, profileByDriverId) {
  const rows = extractDriverRows(raw);
  return rows
    .map((row) => {
      const d = unwrapMapDriverRow(row);
      const ll = pickDriverLatLng(d);
      /** Map contract: `id` joins to `driver_id` on GET /admin/drivers. */
      const mapId = d.id ?? d.driver_id;
      const prof = mapId != null && profileByDriverId?.get ? profileByDriverId.get(String(mapId)) : undefined;

      let phone = prof?.phone || '';
      let driver_name = prof?.name || '';
      let plate_number = prof?.plate_number || '';
      if (!phone) phone = pickDriverPhone(d) || '';

      if (import.meta.env.DEV && mapId != null && profileByDriverId?.size && !prof) {
        console.warn('[Map] join: no GET /admin/drivers profile for map id=', mapId, '(expected driver_id === id)');
      }

      return {
        ...d,
        driver_id: mapId,
        phone,
        driver_name,
        plate_number,
        latlng: ll
      };
    })
    .filter((d) => {
      if (!d.latlng) return false;
      if (!MAP_DRIVERS_ONLINE_POSITION_ONLY) return true;
      return intFlagOne(d.is_active) && intFlagOne(d.live_location_active);
    });
}

/**
 * Index admin list by `driver_id` (canonical). Duplicate under `id` only when both differ (rare backends).
 * @param {unknown} raw response from `GET /admin/drivers`
 * @returns {Map<string, { phone: string, name: string, plate_number: string }>}
 */
function buildDriverProfileByDriverId(raw) {
  const map = new Map();
  const rows = Array.isArray(raw) ? raw : raw?.drivers || [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const d = unwrapMapDriverRow(row);
    const phone = phoneStr(d.phone) || pickDriverPhone(d) || '';
    const name = pickAdminDriverName(d);
    const plate_number = pickAdminPlate(d);
    const payload = { phone, name, plate_number };
    if (row.driver_id != null) map.set(String(row.driver_id), payload);
    if (row.id != null && String(row.id) !== String(row.driver_id ?? '')) {
      map.set(String(row.id), payload);
    }
  }
  return map;
}

function driverMarkerPopupHtml(d) {
  const id = escapeHtml(d.driver_id ?? 'N/A');
  const name = (d.driver_name && escapeHtml(d.driver_name)) || '';
  const plate = (d.plate_number && escapeHtml(d.plate_number)) || '';
  const phone = escapeHtml(d.phone || '') || 'N/A';
  const parts = [`<strong>Driver #${id}</strong>`];
  if (name) parts.push(`Name: ${name}`);
  if (plate) parts.push(`Plate: ${plate}`);
  parts.push(`Phone: ${phone}`);
  return `<div>${parts.join('<br/>')}</div>`;
}

/** Ride request marker + Leaflet pop-up (escaped). */
function requestMarkerPopupHtml(r) {
  const rid = r.request_id ?? r.id ?? 'N/A';
  const idDisp =
    String(rid).length > 28 ? `${escapeHtml(String(rid).slice(0, 10))}…` : escapeHtml(String(rid));
  const name = (r.rider_name && escapeHtml(r.rider_name)) || '';
  const phone = escapeHtml(r.phone || '') || 'N/A';
  const parts = ['<strong>Ride request</strong>', `ID: ${idDisp}`];
  if (name) parts.push(`Client: ${name}`);
  parts.push(`Phone: ${phone}`);
  return `<div class="map-popup-request">${parts.join('<br/>')}</div>`;
}

/** Map `/admin/users` row to lookup keys: numeric user id + `tg:&lt;telegram_id&gt;`. */
function collectRiderProfileLookupKeys(r) {
  const keys = [];
  const add = (v) => {
    if (v == null || v === '') return;
    const s = String(v);
    if (!keys.includes(s)) keys.push(s);
  };
  add(r.user_id);
  add(r.rider_id);
  add(r.rider_user_id);
  add(r.passenger_id);
  add(r.passenger_user_id);
  add(r.customer_id);
  add(r.client_id);
  add(r.client_user_id);
  add(r.booking_user_id);
  if (r.telegram_id != null) add(`tg:${String(r.telegram_id)}`);
  if (r.passenger_telegram_id != null) add(`tg:${String(r.passenger_telegram_id)}`);
  if (r.client_telegram_id != null) add(`tg:${String(r.client_telegram_id)}`);
  if (r.telegram_user_id != null) add(`tg:${String(r.telegram_user_id)}`);
  if (r.tg_id != null) add(`tg:${String(r.tg_id)}`);
  return keys;
}

/**
 * Rider phone + name from `fetchUsersList()` — keyed by `user_id` / `id` and by `tg:&lt;telegram_id&gt;`
 * (ride requests often only expose telegram id, not admin user id).
 * @returns {Map<string, { phone: string, name: string }>}
 */
function buildRiderProfileLookup(raw) {
  const map = new Map();
  const rows = Array.isArray(raw) ? raw : raw?.users || raw?.items || [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    let phone = pickRiderPhone(row) || phoneStr(row.phone) || '';
    if (phone && !looksLikePhoneValue(phone)) phone = '';
    const name = phoneStr(row.name ?? row.full_name ?? '');
    const uid = row.user_id ?? row.id;
    const tg = row.telegram_id;
    if (!phone && !name && uid == null && tg == null) continue;
    const prof = { phone, name };
    if (uid != null) map.set(String(uid), prof);
    if (tg != null) map.set(`tg:${String(tg)}`, prof);
  }
  return map;
}

/**
 * Ride request map DTO is minimal; join users by id or telegram. Pop-up shows phone / client name when found.
 * @param {Map<string, { phone: string, name: string }>} riderProfileByKey
 */
function normalizeRequests(raw, riderProfileByKey) {
  const rows = extractRequestRows(raw);
  return rows.map((row) => {
    const r = unwrapMapRequestRow(row);
    const ll = pickRequestLatLng(r);
    /** GET /admin/map/ride-requests includes `rider_phone` when the backend provides it. */
    let phone = phoneStr(r.rider_phone);
    if (!phone) phone = pickRiderPhone(r);
    let rider_name = '';
    const lookupKeys = collectRiderProfileLookupKeys(r);
    for (const key of lookupKeys) {
      const p = riderProfileByKey?.get(key);
      if (p) {
        if (!phone && p.phone) phone = p.phone;
        if (!rider_name && p.name) rider_name = p.name;
      }
    }
    if (
      import.meta.env.DEV &&
      !phone &&
      riderProfileByKey?.size > 0 &&
      lookupKeys.length > 0 &&
      !lookupKeys.some((k) => riderProfileByKey.has(k))
    ) {
      console.warn('[Map] ride request: no users row for join keys', lookupKeys, r);
    }
    return {
      ...r,
      request_id: r.request_id ?? r.id ?? r.trip_id,
      phone,
      rider_name,
      latlng: ll
    };
  }).filter((r) => r.latlng);
}

function googleCircleIcon(color) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2
  };
}

function renderMarkersLeaflet(drivers, requests) {
  driverLayer.value.clearLayers();
  requestLayer.value.clearLayers();

  drivers.forEach((d) => {
    const m = L.marker(d.latlng, { icon: markerIconLeaflet(driverStatusColor(d)) });
    m.bindPopup(driverMarkerPopupHtml(d));
    m.on('click', () => {
      m.openPopup();
      selectedItem.value = {
        type: 'driver',
        id: d.driver_id ?? 'N/A',
        phone: d.phone,
        driver_name: d.driver_name,
        plate_number: d.plate_number,
        latlng: d.latlng,
        raw: d
      };
      nearestList.value = [];
    });
    m.addTo(driverLayer.value);
  });

  requests.forEach((r) => {
    const m = L.marker(r.latlng, { icon: markerIconLeaflet('#2563eb') });
    m.bindPopup(requestMarkerPopupHtml(r), { maxWidth: 320, className: 'map-request-popup' });
    m.on('click', () => {
      m.openPopup();
      selectedItem.value = {
        type: 'request',
        id: r.request_id ?? 'N/A',
        phone: r.phone,
        rider_name: r.rider_name,
        latlng: r.latlng,
        raw: r
      };
      nearestList.value = [];
    });
    m.addTo(requestLayer.value);
  });

  const layers = [...driverLayer.value.getLayers(), ...requestLayer.value.getLayers()];
  if (layers.length && !leafletLocked) {
    const group = L.featureGroup(layers);
    leafletMap.value.fitBounds(group.getBounds().pad(0.2));
  }
}

function renderMarkersGoogle(drivers, requests) {
  googleDriverMarkers.forEach((m) => m.setMap(null));
  googleDriverMarkers.length = 0;
  googleRequestMarkers.forEach((m) => m.setMap(null));
  googleRequestMarkers.length = 0;

  drivers.forEach((d) => {
    const color = driverStatusColor(d);
    const marker = new google.maps.Marker({
      position: { lat: d.latlng[0], lng: d.latlng[1] },
      map: googleMap,
      icon: googleCircleIcon(color),
      title: `Driver #${d.driver_id ?? 'N/A'}`
    });
    marker.addListener('click', () => {
      googleInfoWindow.setContent(driverMarkerPopupHtml(d));
      googleInfoWindow.open({ map: googleMap, anchor: marker });
      selectedItem.value = {
        type: 'driver',
        id: d.driver_id ?? 'N/A',
        phone: d.phone,
        driver_name: d.driver_name,
        plate_number: d.plate_number,
        latlng: d.latlng,
        raw: d
      };
      nearestList.value = [];
    });
    googleDriverMarkers.push(marker);
  });

  requests.forEach((r) => {
    const marker = new google.maps.Marker({
      position: { lat: r.latlng[0], lng: r.latlng[1] },
      map: googleMap,
      icon: googleCircleIcon('#2563eb'),
      title: `Request #${r.request_id ?? 'N/A'}`
    });
    marker.addListener('click', () => {
      googleInfoWindow.setContent(requestMarkerPopupHtml(r));
      googleInfoWindow.open({ map: googleMap, anchor: marker });
      selectedItem.value = {
        type: 'request',
        id: r.request_id ?? 'N/A',
        phone: r.phone,
        rider_name: r.rider_name,
        latlng: r.latlng,
        raw: r
      };
      nearestList.value = [];
    });
    googleRequestMarkers.push(marker);
  });

  if (!googleLocked && !googleInitFitted && (drivers.length || requests.length)) {
    const bounds = new google.maps.LatLngBounds();
    drivers.forEach((d) => bounds.extend({ lat: d.latlng[0], lng: d.latlng[1] }));
    requests.forEach((r) => bounds.extend({ lat: r.latlng[0], lng: r.latlng[1] }));
    googleMap.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    googleInitFitted = true;
  }
}

function renderMarkers(drivers, requests) {
  if (googleMap) {
    renderMarkersGoogle(drivers, requests);
  } else if (leafletMap.value && driverLayer.value && requestLayer.value) {
    renderMarkersLeaflet(drivers, requests);
  }
}

async function refreshData() {
  error.value = '';
  requestWarning.value = '';
  driverWarning.value = '';
  try {
    console.log('[Map] fetching map + phone enrichment (drivers + users)');
    const settled = await Promise.allSettled([
      apiGet(DRIVER_MAP_PATH),
      apiGet('/admin/drivers'),
      fetchUsersList()
    ]);

    const mapDriversResult = settled[0];
    if (mapDriversResult.status !== 'fulfilled') throw mapDriversResult.reason;
    const driversRaw = mapDriversResult.value;
    console.log('[Map] success', `${API_BASE}${DRIVER_MAP_PATH}`);
    if (import.meta.env.DEV) {
      const mr = extractDriverRows(driversRaw);
      console.log('[Map] /admin/map/drivers count=', mr.length, mr[0] != null ? { sample: mr[0] } : '');
    }

    adminProfilesLoaded.value = settled[1].status === 'fulfilled';
    const profileByDriverId =
      settled[1].status === 'fulfilled' ? buildDriverProfileByDriverId(settled[1].value) : new Map();
    if (settled[1].status === 'rejected') {
      console.warn('[Map] GET /admin/drivers (profile join) failed', settled[1].reason);
    }

    const riderProfileByKey =
      settled[2].status === 'fulfilled' ? buildRiderProfileLookup(settled[2].value) : new Map();
    if (settled[2].status === 'rejected') {
      console.warn('[Map] users list (rider phone enrichment) failed', settled[2].reason);
    }

    let requestsRaw = [];
    let rideRequestsFetchOk = false;
    try {
      console.log('[Map] fetching', `${API_BASE}${REQUEST_MAP_PATH}`);
      requestsRaw = await apiGet(REQUEST_MAP_PATH);
      rideRequestsFetchOk = true;
      console.log('[Map] success', `${API_BASE}${REQUEST_MAP_PATH}`);
    } catch (e) {
      console.error('[Map] fetch failed', `${API_BASE}${REQUEST_MAP_PATH}`, e);
    }

    const driverRows = extractDriverRows(driversRaw);
    mapApiDriverCount.value = driverRows.length;
    mapOnlineLiveCount.value = driverRows.filter((row) => {
      const r = unwrapMapDriverRow(row);
      return intFlagOne(r.is_active) && intFlagOne(r.live_location_active);
    }).length;

    const requestRows = extractRequestRows(requestsRaw);
    mapRequestsApiCount.value = rideRequestsFetchOk ? requestRows.length : 0;

    const drivers = normalizeDrivers(driversRaw, profileByDriverId);
    const requests = normalizeRequests(requestsRaw, riderProfileByKey);
    mapMarkersPlotted.value = drivers.length;
    mapRequestMarkersPlotted.value = requests.length;
    renderMarkers(drivers, requests);

    if (!drivers.length) {
      driverWarning.value =
        driverRows.length > 0
          ? `Map API returned ${driverRows.length} row(s) but none have coordinates to plot (need last_lat / last_lng).`
          : 'Map API returned an empty driver array (no rows). Request succeeded; backend has nothing to list.';
    }
    if (!rideRequestsFetchOk) {
      mapRequestsApiCount.value = 0;
      mapRequestMarkersPlotted.value = 0;
      requestWarning.value = 'GET /admin/map/ride-requests failed — check Network tab. Request markers unchanged or empty.';
    } else if (!requests.length) {
      requestWarning.value =
        requestRows.length > 0
          ? 'Requests in response but none have pickup coordinates to plot.'
          : 'No ride requests in map response (empty array).';
    }
  } catch (e) {
    mapApiDriverCount.value = 0;
    mapMarkersPlotted.value = 0;
    mapOnlineLiveCount.value = 0;
    mapRequestsApiCount.value = 0;
    mapRequestMarkersPlotted.value = 0;
    adminProfilesLoaded.value = false;
    console.error(e);
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'Failed to fetch') {
      error.value = 'Cannot reach backend API right now. Check VITE_API_BASE_URL / backend status. Auto-retrying...';
    } else {
      error.value = msg || 'Failed to load map data';
    }
  }
}

async function loadNearestDrivers(item) {
  if (!item?.id) return;
  nearestActionStatus.value = '';
  const requestId = encodeURIComponent(String(item.id));
  try {
    /** Backend: GET .../nearest-drivers?request_id=<uuid> → 200 JSON array. */
    const data = await firstSuccess([
      `/admin/nearest-drivers?request_id=${requestId}`,
      `/api/admin/nearest-drivers?request_id=${requestId}`,
      `/admin/requests/${item.id}/nearest-drivers`,
      `/admin/ride-requests/${item.id}/nearest-drivers`
    ]);
    nearestList.value = Array.isArray(data) ? data : data?.drivers || [];
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to fetch nearest drivers';
  }
}

function nearestDriverId(row) {
  return row?.id ?? row?.driver_id ?? row?.driver_user_id ?? null;
}

async function adminSendRequestOfferToDriver(requestId, driverId) {
  const rid = encodeURIComponent(String(requestId));

  // Canonical backend endpoint (mirrored under /api/admin, /api/v1/admin, /v1/admin).
  const attempts = [
    { path: `/admin/ride-requests/${rid}/offer`, body: { driver_id: Number(driverId) || driverId } },
    { path: `/api/admin/ride-requests/${rid}/offer`, body: { driver_id: Number(driverId) || driverId } },
    { path: `/api/v1/admin/ride-requests/${rid}/offer`, body: { driver_id: Number(driverId) || driverId } },
    { path: `/v1/admin/ride-requests/${rid}/offer`, body: { driver_id: Number(driverId) || driverId } }
  ];

  let lastErr = null;
  for (const a of attempts) {
    try {
      return await apiPostJson(a.path, a.body || undefined);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      // keep trying other shapes; 404 is expected until backend implements
      if (String(lastErr.message || '').includes('404')) continue;
    }
  }
  throw lastErr || new Error('No admin offer endpoint available');
}

async function sendRequestToNearestDriver(row) {
  // Desired semantics: send/offer to the driver; driver may accept or ignore.
  if (selectedItem.value?.type !== 'request') return;
  const requestId = selectedItem.value?.id;
  const driverId = nearestDriverId(row);
  if (!requestId || driverId == null) {
    nearestActionStatus.value = 'Missing request_id or driver id.';
    return;
  }

  const busyKey = `${requestId}:${driverId}`;
  nearestActionBusyKey.value = busyKey;
  nearestActionStatus.value = '';
  try {
    await adminSendRequestOfferToDriver(requestId, driverId);
    nearestActionStatus.value = `Sent offer to driver #${driverId}. Driver may accept or ignore.`;
  } catch (e) {
    console.error(e);
    nearestActionStatus.value = e instanceof Error ? e.message : 'Failed to send offer';
  } finally {
    if (nearestActionBusyKey.value === busyKey) nearestActionBusyKey.value = '';
  }
}

async function loadNearestRequests(item) {
  if (!item?.id) return;
  nearestActionStatus.value = '';
  const driverId = encodeURIComponent(String(item.id));
  try {
    const data = await firstSuccess([
      `/admin/nearest-requests?driver_id=${driverId}`,
      `/api/admin/nearest-requests?driver_id=${driverId}`,
      `/admin/drivers/${item.id}/nearest-requests`
    ]);
    nearestList.value = Array.isArray(data) ? data : data?.requests || [];
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to fetch nearest requests';
  }
}

function nearestRequestId(row) {
  return row?.request_id ?? row?.id ?? row?.trip_id ?? null;
}

async function sendNearestRequestToSelectedDriver(row) {
  // Same semantics, other direction: selected driver + nearest request.
  if (selectedItem.value?.type !== 'driver') return;
  const driverId = selectedItem.value?.id;
  const requestId = nearestRequestId(row);
  if (!driverId || !requestId) {
    nearestActionStatus.value = 'Missing driver id or request_id.';
    return;
  }

  const busyKey = `${requestId}:${driverId}`;
  nearestActionBusyKey.value = busyKey;
  nearestActionStatus.value = '';
  try {
    await adminSendRequestOfferToDriver(requestId, driverId);
    nearestActionStatus.value = `Sent offer for request ${requestId} to driver #${driverId}.`;
  } catch (e) {
    console.error(e);
    nearestActionStatus.value = e instanceof Error ? e.message : 'Failed to send offer';
  } finally {
    if (nearestActionBusyKey.value === busyKey) nearestActionBusyKey.value = '';
  }
}

function nearestLabel(row) {
  const id = row.driver_id ?? row.request_id ?? row.id ?? 'N/A';
  const phone =
    pickDriverPhone(row) ||
    pickRiderPhone(row) ||
    phoneStr(row.phone) ||
    (row.telegram_id != null && row.telegram_id !== '' ? `tg:${row.telegram_id}` : '') ||
    'N/A';
  const dist = row.distance_km ?? row.distance ?? row.km;
  const distText = dist != null ? `, ${dist} km` : '';
  return `#${id} (${phone}${distText})`;
}

function callNumber(phone) {
  window.location.href = `tel:${phone}`;
}

async function initGoogleMaps() {
  const { Loader } = await import('@googlemaps/js-api-loader');
  const loader = new Loader({
    apiKey: GOOGLE_KEY,
    version: 'weekly'
  });
  await loader.load();
  googleMap = new google.maps.Map(mapEl.value, {
    center: { lat: 41.3111, lng: 69.2797 },
    zoom: 12,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true
  });
  googleInfoWindow = new google.maps.InfoWindow();
}

onMounted(async () => {
  try {
    if (GOOGLE_KEY) {
      await initGoogleMaps();
    } else {
      leafletMap.value = L.map(mapEl.value, {
        zoomControl: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true
      }).setView([41.3111, 69.2797], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap.value);

      driverLayer.value = L.layerGroup().addTo(leafletMap.value);
      requestLayer.value = L.layerGroup().addTo(leafletMap.value);

      // Ensure zoom interactions are enabled even if Leaflet defaults were changed elsewhere.
      leafletMap.value.scrollWheelZoom?.enable?.();
      leafletMap.value.touchZoom?.enable?.();
      leafletMap.value.doubleClickZoom?.enable?.();

      leafletMap.value.on('zoomstart', () => {
        leafletLocked = true;
      });
      leafletMap.value.on('dragstart', () => {
        leafletLocked = true;
      });
    }

    await refreshData();
    pollTimer = setInterval(refreshData, pollMs);
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to initialize map';
  }
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  googleDriverMarkers.forEach((m) => m.setMap(null));
  googleRequestMarkers.forEach((m) => m.setMap(null));
  googleDriverMarkers.length = 0;
  googleRequestMarkers.length = 0;
  googleMap = null;
  googleInfoWindow = null;
  googleInitFitted = false;
  if (leafletMap.value) {
    leafletMap.value.remove();
    leafletMap.value = null;
  }
});
</script>
