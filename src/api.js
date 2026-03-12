import axios from 'axios';

const API_BASE = 'https://taxi-service-on-telegram.onrender.com';

const api = axios.create({
  baseURL: API_BASE
});

export default {
  getDashboard() {
    return api.get('/admin/dashboard');
  },
  getDrivers() {
    return api.get('/admin/drivers');
  },
  addBalance(driverId, amount, note) {
    return api.post(`/admin/drivers/${driverId}/add-balance`, { amount, note });
  },
  getPayments(params = {}) {
    return api.get('/admin/payments', { params });
  }
};

