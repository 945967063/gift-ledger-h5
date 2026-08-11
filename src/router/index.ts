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
  };
}

router.beforeEach((to: toRouteType, from, next) => {
  const { cachedView } = useStore();
  if (to.meta?.title) {
    document.title = to.meta.title;
  }
  cachedView.addCachedView(to);
  next();
});

router.afterEach(() => {
  window.scrollTo(0, 0);
});

export default router;
