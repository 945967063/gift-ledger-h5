import { createRouter, createWebHashHistory, type RouteLocationNormalized } from 'vue-router';
import routes from './routes';
import useStore from '@/store';
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export interface toRouteType extends RouteLocationNormalized {
  meta: {
    title?: string;
    noCache?: boolean;
  };
}

router.beforeEach((to: toRouteType, from, next) => {
  const { cachedView } = useStore();
  console.log(to, from);
  // 路由缓存
  cachedView.addCachedView(to);
  next();
});

router.afterEach(() => {});

export default router;
