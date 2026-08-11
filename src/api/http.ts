import axios from 'axios';
import { showToast } from 'vant';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let handlingUnauthorized = false;

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
    const message =
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? '请求超时，请检查网络后重试' : '网络请求失败');

    const isAuthRequest = String(error.config?.url || '').startsWith('/auth/');

    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem('gift_ledger_token');
      localStorage.removeItem('gift_ledger_user');
      if (!handlingUnauthorized) {
        handlingUnauthorized = true;
        showToast({ message: '登录已过期，请重新登录', icon: 'fail' });
        setTimeout(() => {
          window.location.hash = '#/login';
          handlingUnauthorized = false;
        }, 800);
      }
    } else if (status >= 500) {
      showToast({ message: `服务器错误: ${message}`, icon: 'fail' });
    } else {
      showToast({ message, icon: 'fail' });
    }

    return Promise.reject(error);
  }
);

export default http;
