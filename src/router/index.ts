import { createRouter, createWebHashHistory } from 'vue-router';
import routes from './routes';
import useStore from '@/store';

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const { cachedView, gift } = useStore();
  if (to.meta?.title) document.title = String(to.meta.title);
  cachedView.addCachedView(to);

  const token = localStorage.getItem('gift_ledger_token');
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);
  if (requiresAuth && !token) return '/login';
  if (to.path === '/login' && token) return '/home';

  if (requiresAuth && token && !gift.loaded) {
    try {
      await gift.loadAll();
    } catch {
      if (!localStorage.getItem('gift_ledger_token')) return '/login';
    }
  }
  return true;
});

router.afterEach(() => window.scrollTo(0, 0));

export default router;
