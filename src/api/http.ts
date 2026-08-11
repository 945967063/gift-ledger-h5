import axios from 'axios';
import { showToast } from 'vant';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── 请求拦截器：注入 JWT Token ──────────────────────────────
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gift_ledger_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── 响应拦截器：统一错误处理 ───────────────────────────────
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || '网络请求失败';

    if (status === 401) {
      localStorage.removeItem('gift_ledger_token');
      localStorage.removeItem('gift_ledger_user');
      showToast({ message: '登录已过期，请重新登录', icon: 'fail' });
      // Redirect to login
      setTimeout(() => {
        window.location.hash = '#/login';
      }, 1200);
    } else if (status === 404) {
      // silently ignore
    } else if (status >= 500) {
      showToast({ message: `服务器错误: ${message}`, icon: 'fail' });
    } else {
      showToast({ message, icon: 'fail' });
    }

    return Promise.reject(error);
  }
);

export default http;
