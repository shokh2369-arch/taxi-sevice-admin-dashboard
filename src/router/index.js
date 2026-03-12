import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import DriversView from '../views/DriversView.vue';
import DriverDetailsView from '../views/DriverDetailsView.vue';
import PaymentsView from '../views/PaymentsView.vue';

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/drivers', name: 'drivers', component: DriversView },
  { path: '/drivers/:id', name: 'driver-details', component: DriverDetailsView, props: true },
  { path: '/payments', name: 'payments', component: PaymentsView }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;

