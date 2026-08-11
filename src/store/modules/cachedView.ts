import { defineStore } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';
export default defineStore('cachedView', {
  state: () => ({
    // 缓存页面 keepAlive
    cachedViewList: [] as string[],
  }),
  actions: {
    addCachedView(view: RouteLocationNormalized) {
      if (typeof view.name !== 'string') return;
      // 不重复添加
      if (this.cachedViewList.includes(view.name as string)) return;
      if (!view?.meta?.noCache) {
        this.cachedViewList.push(view.name as string);
      }
    },
    delCachedView(view: RouteLocationNormalized) {
      const index = this.cachedViewList.indexOf(view.name as string);
      if (index > -1) {
        this.cachedViewList.splice(index, 1);
      }
    },
    delAllCachedViews() {
      this.cachedViewList = [] as string[];
    },
  },
});
