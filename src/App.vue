<template>
  <div>
    <header class="navbar">
      <div>Taxi Admin</div>
      <nav class="nav-links" v-if="authorized">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/drivers">Drivers</RouterLink>
        <RouterLink to="/payments">Payments</RouterLink>
        <RouterLink to="/driver-actions">Driver actions</RouterLink>
        <RouterLink to="/map">Map</RouterLink>
      </nav>
    </header>
    <main class="container">
      <div v-if="!authorized" class="auth-overlay">
        <div class="auth-card">
          <h2>Enter password</h2>
          <input
            v-model="passwordInput"
            type="password"
            class="input"
            placeholder="Password"
            @keyup.enter="submit"
          />
          <button class="button" style="margin-top: 0.75rem;" @click="submit">
            Continue
          </button>
          <p v-if="error" style="color: #b91c1c; margin-top: 0.5rem; font-size: 0.85rem;">
            {{ error }}
          </p>
        </div>
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
import { ref, onMounted } from 'vue';

const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

const authorized = ref(false);
const passwordInput = ref('');
const error = ref('');

onMounted(() => {
  const stored = window.localStorage.getItem('taxi_admin_authed');
  if (stored === '1') {
    authorized.value = true;
  }
});

function submit() {
  if (!PASSWORD) {
    authorized.value = true;
    return;
  }
  if (passwordInput.value === PASSWORD) {
    authorized.value = true;
    window.localStorage.setItem('taxi_admin_authed', '1');
    error.value = '';
  } else {
    error.value = 'Incorrect password.';
  }
}
</script>

