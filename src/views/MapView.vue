<template>
  <div>
    <h1>Live Map</h1>
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
        <h3 style="margin-top: 0;">Details</h3>
        <div v-if="!selectedItem">
          Click a rider request or driver marker.
        </div>
        <div v-else>
          <p><strong>Type:</strong> {{ selectedItem.type }}</p>
          <p><strong>ID:</strong> {{ selectedItem.id }}</p>
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
            <ul style="margin: 0; padding-left: 1.1rem;">
              <li v-for="(row, idx) in nearestList" :key="idx" style="margin-bottom: 0.25rem;">
                {{ nearestLabel(row) }}
              </li>
            </ul>
          </div>
        </div>
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
import { apiGet, API_BASE } from '../api';

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

const pollMs = 7000;
const pollSeconds = Math.floor(pollMs / 1000);
const error = ref('');
const selectedItem = ref(null);
const nearestList = ref([]);
let pollTimer = null;
const requestWarning = ref('');
const driverWarning = ref('');
let googleInitFitted = false;
let leafletLocked = false;
let googleLocked = false;

/** Gin `/admin` group: ListDriversForMap, ListRideRequestsForMap */
const DRIVER_MAP_PATH = '/admin/map/drivers';
const REQUEST_MAP_PATH = '/admin/map/ride-requests';

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

/** Map DTOs often omit `online`; rely on coords for “live” unless the payload clearly says offline. */
function driverExplicitlyOffline(d) {
  if (!d || typeof d !== 'object') return false;
  if (d.online === false || d.is_online === false || d.isOnline === false) return true;
  if (d.offline === true || d.is_offline === true) return true;
  const st = String(d.status ?? d.driver_status ?? d.state ?? '').toLowerCase();
  if (['offline', 'off_line', 'inactive', 'unavailable'].includes(st)) return true;
  return false;
}

function driverExplicitlyOnline(d) {
  if (!d || typeof d !== 'object') return false;
  if (d.online === true || d.is_online === true || d.isOnline === true) return true;
  if (d.on_duty === true || d.driver_online === true) return true;
  if (d.active === true || d.is_active === true) return true;
  const st = String(d.status ?? d.driver_status ?? d.state ?? '').toLowerCase();
  if (['online', 'on_line', 'working', 'active', 'available', 'busy', 'idle', 'onduty', 'on-duty'].includes(st)) {
    return true;
  }
  if (d.live === true || d.has_live === true || d.has_live_location === true) return true;
  return false;
}

function driverStatusColor(d) {
  const hasCoords =
    Array.isArray(d.latlng) &&
    d.latlng.length >= 2 &&
    Number.isFinite(d.latlng[0]) &&
    Number.isFinite(d.latlng[1]);

  if (driverExplicitlyOffline(d)) return '#6b7280';
  if (hasCoords && (driverExplicitlyOnline(d) || !driverExplicitlyOffline(d))) return '#16a34a';

  const online = driverExplicitlyOnline(d);
  const hasLive = Boolean(
    d.live ?? d.has_live ?? d.has_live_location ?? (pickDriverLatLng(d) != null)
  );
  if (online && hasLive) return '#16a34a';
  if (!online) return '#6b7280';
  return '#dc2626';
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

function normalizeDrivers(raw) {
  const rows = extractDriverRows(raw);
  return rows.map((row) => {
    const d = unwrapMapDriverRow(row);
    const ll = pickDriverLatLng(d);
    return {
      ...d,
      driver_id: d.driver_id ?? d.id,
      phone: pickDriverPhone(d),
      latlng: ll
    };
  }).filter((d) => d.latlng);
}

function normalizeRequests(raw) {
  const rows = extractRequestRows(raw);
  return rows.map((row) => {
    const r = unwrapMapRequestRow(row);
    const ll = pickRequestLatLng(r);
    return {
      ...r,
      request_id: r.request_id ?? r.id ?? r.trip_id,
      phone: pickRiderPhone(r),
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
    m.bindPopup(`
      <div>
        <strong>Driver #${d.driver_id ?? 'N/A'}</strong><br/>
        Phone: ${d.phone || 'N/A'}
      </div>
    `);
    m.on('click', () => {
      selectedItem.value = {
        type: 'driver',
        id: d.driver_id ?? 'N/A',
        phone: d.phone,
        latlng: d.latlng,
        raw: d
      };
      nearestList.value = [];
    });
    m.addTo(driverLayer.value);
  });

  requests.forEach((r) => {
    const m = L.marker(r.latlng, { icon: markerIconLeaflet('#2563eb') });
    m.bindPopup(`
      <div>
        <strong>Request #${r.request_id ?? 'N/A'}</strong><br/>
        Phone: ${r.phone || 'N/A'}
      </div>
    `);
    m.on('click', () => {
      selectedItem.value = {
        type: 'request',
        id: r.request_id ?? 'N/A',
        phone: r.phone,
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
      googleInfoWindow.setContent(`
        <div>
          <strong>Driver #${d.driver_id ?? 'N/A'}</strong><br/>
          Phone: ${d.phone || 'N/A'}
        </div>
      `);
      googleInfoWindow.open({ map: googleMap, anchor: marker });
      selectedItem.value = {
        type: 'driver',
        id: d.driver_id ?? 'N/A',
        phone: d.phone,
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
      googleInfoWindow.setContent(`
        <div>
          <strong>Request #${r.request_id ?? 'N/A'}</strong><br/>
          Phone: ${r.phone || 'N/A'}
        </div>
      `);
      googleInfoWindow.open({ map: googleMap, anchor: marker });
      selectedItem.value = {
        type: 'request',
        id: r.request_id ?? 'N/A',
        phone: r.phone,
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
    console.log('[Map] fetching', `${API_BASE}${DRIVER_MAP_PATH}`);
    const driversRaw = await apiGet(DRIVER_MAP_PATH);
    console.log('[Map] success', `${API_BASE}${DRIVER_MAP_PATH}`);

    let requestsRaw = [];
    try {
      console.log('[Map] fetching', `${API_BASE}${REQUEST_MAP_PATH}`);
      requestsRaw = await apiGet(REQUEST_MAP_PATH);
      console.log('[Map] success', `${API_BASE}${REQUEST_MAP_PATH}`);
    } catch (e) {
      console.error('[Map] fetch failed', `${API_BASE}${REQUEST_MAP_PATH}`, e);
    }

    const driverRows = extractDriverRows(driversRaw);
    const drivers = normalizeDrivers(driversRaw);
    const requests = normalizeRequests(requestsRaw);
    renderMarkers(drivers, requests);

    if (!drivers.length) {
      driverWarning.value =
        driverRows.length > 0
          ? `API returned ${driverRows.length} driver(s) but none have coordinates we can plot. Expected fields like last_lat/last_lng, lat/lng, or nested location.{lat,lng}.`
          : 'No drivers online.';
    }
    if (!requests.length) {
      requestWarning.value = 'No active requests.';
    }
  } catch (e) {
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
  try {
    const data = await firstSuccess([
      `/admin/requests/${item.id}/nearest-drivers`,
      `/admin/ride-requests/${item.id}/nearest-drivers`,
      `/admin/nearest-drivers?request_id=${item.id}`
    ]);
    nearestList.value = Array.isArray(data) ? data : data?.drivers || [];
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to fetch nearest drivers';
  }
}

async function loadNearestRequests(item) {
  if (!item?.id) return;
  try {
    const data = await firstSuccess([
      `/admin/drivers/${item.id}/nearest-requests`,
      `/admin/nearest-requests?driver_id=${item.id}`
    ]);
    nearestList.value = Array.isArray(data) ? data : data?.requests || [];
  } catch (e) {
    console.error(e);
    error.value = e instanceof Error ? e.message : 'Failed to fetch nearest requests';
  }
}

function nearestLabel(row) {
  const id = row.driver_id ?? row.request_id ?? row.id ?? 'N/A';
  const phone = pickDriverPhone(row) || pickRiderPhone(row) || phoneStr(row.phone) || 'N/A';
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
