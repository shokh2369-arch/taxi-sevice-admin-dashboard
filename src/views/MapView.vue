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

const DRIVER_ENDPOINTS = (
  import.meta.env.VITE_MAP_DRIVER_ENDPOINTS ||
  '/admin/map/drivers'
).split(',').map((s) => s.trim()).filter(Boolean);

const REQUEST_ENDPOINTS = (
  import.meta.env.VITE_MAP_REQUEST_ENDPOINTS ||
  '/admin/map/ride-requests'
).split(',').map((s) => s.trim()).filter(Boolean);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickDriverLatLng(row) {
  const lat = num(row.last_lat);
  const lng = num(row.last_lng);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

function pickRequestLatLng(row) {
  const lat = num(row.pickup_lat);
  const lng = num(row.pickup_lng);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

function markerIconLeaflet(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

function driverStatusColor(d) {
  const online = Boolean(d.online ?? d.is_online ?? d.active);
  const hasLive = Boolean(d.live ?? d.has_live ?? (pickDriverLatLng(d) != null));
  if (online && hasLive) return '#16a34a';
  if (!online) return '#6b7280';
  return '#dc2626';
}

async function firstSuccess(paths) {
  let lastErr = null;
  for (const p of paths) {
    try {
      console.log('[Map] fetching', `${API_BASE}${p}`);
      return await apiGet(p);
    } catch (e) {
      console.error('[Map] fetch failed', `${API_BASE}${p}`, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All endpoint attempts failed');
}

async function firstSuccessOrEmpty(paths) {
  try {
    return await firstSuccess(paths);
  } catch (e) {
    return [];
  }
}

function normalizeDrivers(raw) {
  const rows = Array.isArray(raw) ? raw : raw?.drivers || [];
  return rows.map((d) => {
    const ll = pickDriverLatLng(d);
    return {
      ...d,
      driver_id: d.driver_id ?? d.id,
      phone: d.phone ?? d.driver_phone ?? '',
      latlng: ll
    };
  }).filter((d) => d.latlng);
}

function normalizeRequests(raw) {
  const rows = Array.isArray(raw) ? raw : raw?.requests || raw?.ride_requests || [];
  return rows.map((r) => {
    const ll = pickRequestLatLng(r);
    return {
      ...r,
      request_id: r.request_id ?? r.id ?? r.trip_id,
      phone: r.phone ?? r.rider_phone ?? '',
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
  if (layers.length) {
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

  if (!googleInitFitted && (drivers.length || requests.length)) {
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
    const driversRaw = await firstSuccess(DRIVER_ENDPOINTS);
    const requestsRaw = await firstSuccessOrEmpty(REQUEST_ENDPOINTS);

    const drivers = normalizeDrivers(driversRaw);
    const requests = normalizeRequests(requestsRaw);
    renderMarkers(drivers, requests);

    if (!drivers.length) {
      driverWarning.value = 'No drivers online.';
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
  const phone = row.phone ?? row.driver_phone ?? row.rider_phone ?? 'N/A';
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
      leafletMap.value = L.map(mapEl.value).setView([41.3111, 69.2797], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap.value);

      driverLayer.value = L.layerGroup().addTo(leafletMap.value);
      requestLayer.value = L.layerGroup().addTo(leafletMap.value);
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
