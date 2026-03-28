import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import DriversView from '../views/DriversView.vue';
import DriverDetailsView from '../views/DriverDetailsView.vue';
import PaymentsView from '../views/PaymentsView.vue';
import DriverActionsView from '../views/DriverActionsView.vue';
import MapView from '../views/MapView.vue';
import UsersView from '../views/UsersView.vue';

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/drivers', name: 'drivers', component: DriversView },
  { path: '/users', name: 'users', component: UsersView },
  { path: '/drivers/:id', name: 'driver-details', component: DriverDetailsView, props: true },
  { path: '/payments', name: 'payments', component: PaymentsView },
  { path: '/driver-actions', name: 'driver-actions', component: DriverActionsView },
  { path: '/map', name: 'map', component: MapView }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;

