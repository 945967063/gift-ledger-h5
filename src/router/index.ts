import { createRouter, createWebHashHistory, type RouteLocationNormalized } from 'vue-router';
import routes from './routes';
import useStore from '@/store';

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export interface toRouteType extends RouteLocationNormalized {
  meta: {
    title?: string;
    noCache?: boolean;
    requiresAuth?: boolean;
    public?: boolean;
  };
}

router.beforeEach((to: toRouteType, _from, next) => {
  const { cachedView } = useStore();

  if (to.meta?.title) {
    document.title = to.meta.title;
  }

  cachedView.addCachedView(to);

  // Auth guard: redirect to /login if not authenticated
  const token = localStorage.getItem('gift_ledger_token');
  const requiresAuth = to.matched.some((r) => r.meta?.requiresAuth);

  if (requiresAuth && !token) {
    next('/login');
    return;
  }

  // Already logged in? skip login page
  if (to.path === '/login' && token) {
    next('/home');
    return;
  }

  next();
});

router.afterEach(() => {
  window.scrollTo(0, 0);
});

export default router;
