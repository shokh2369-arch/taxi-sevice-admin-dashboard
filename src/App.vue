<template>
  <div>
    <header class="navbar">
      <div>Taxi Admin</div>
      <nav class="nav-links">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/drivers">Drivers</RouterLink>
        <RouterLink to="/payments">Payments</RouterLink>
      </nav>
    </header>
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

