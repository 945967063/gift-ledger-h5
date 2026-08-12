import Layout from '@/layout/index.vue';
import type { RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '人情簿 - 登录', public: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/home',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: '人情簿 - 首页' },
      },
      {
        path: 'record',
        name: 'Record',
        component: () => import('@/views/record/index.vue'),
        meta: { title: '人情簿 - 记一笔' },
      },
      {
        path: 'events',
        name: 'Events',
        component: () => import('@/views/events/index.vue'),
        meta: { title: '人情簿 - 我的事件' },
      },
      {
        path: 'contacts',
        name: 'Contacts',
        component: () => import('@/views/contacts/index.vue'),
        meta: { title: '人情簿 - 通讯录' },
      },
      {
        path: 'contacts/detail',
        name: 'ContactDetail',
        component: () => import('@/views/contacts/detail.vue'),
        meta: { title: '人情簿 - 联系人详情' },
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/statistics/index.vue'),
        meta: { title: '人情簿 - 人情统计' },
      },
      {
        path: 'settings/backup',
        name: 'BackupSettings',
        component: () => import('@/views/settings/backup.vue'),
        meta: { title: '人情簿 - 备份与恢复' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home',
  },
];

export default routes;
