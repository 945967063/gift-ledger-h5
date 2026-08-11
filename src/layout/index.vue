<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useDarkMode } from '@/composables/useToggleDarkMode';
  import useStore from '@/store';

  const route = useRoute();
  const router = useRouter();
  const { cachedView, gift } = useStore();

  const cachedViews = computed(() => cachedView.cachedViewList);

  const activeTab = ref('home');

  const updateActiveTab = () => {
    const path = route.path;
    if (path.startsWith('/home')) {
      activeTab.value = 'home';
    } else if (path.startsWith('/record') || path.startsWith('/events')) {
      activeTab.value = 'record';
    } else if (path.startsWith('/contacts')) {
      activeTab.value = 'contacts';
    } else if (path.startsWith('/statistics')) {
      activeTab.value = 'statistics';
    }
  };

  watch(() => route.path, updateActiveTab, { immediate: true });

  const onTabChange = (name: string) => {
    switch (name) {
      case 'home':
        router.push('/home');
        break;
      case 'record':
        router.push('/record');
        break;
      case 'contacts':
        router.push('/contacts');
        break;
      case 'statistics':
        router.push('/statistics');
        break;
    }
  };
</script>

<template>
  <div class="app-wrapper">
    <van-config-provider :theme="useDarkMode() ? 'dark' : 'light'">
      <div class="app-shell">
        <div class="main-content">
          <router-view v-slot="{ Component }">
            <keep-alive :include="cachedViews">
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </div>

        <van-overlay :show="gift.loading" class="data-loading-overlay">
          <div class="data-loading-box">
            <van-loading color="#c3423f" size="28" />
            <span>正在同步账簿数据…</span>
          </div>
        </van-overlay>

        <!-- Bottom Tabbar matching design mockup -->
        <van-tabbar
          v-model="activeTab"
          class="custom-tabbar"
          :border="false"
          :fixed="true"
          active-color="#C3423F"
          inactive-color="#8E8E93"
          @change="onTabChange"
        >
          <van-tabbar-item name="home">
            <template #icon="props">
              <van-icon :name="props.active ? 'wap-home' : 'wap-home-o'" />
            </template>
            <span>首页</span>
          </van-tabbar-item>

          <van-tabbar-item name="record">
            <template #icon="props">
              <van-icon :name="props.active ? 'add' : 'add-o'" />
            </template>
            <span>记录</span>
          </van-tabbar-item>

          <van-tabbar-item name="contacts">
            <template #icon="props">
              <van-icon :name="props.active ? 'friends' : 'friends-o'" />
            </template>
            <span>通讯录</span>
          </van-tabbar-item>

          <van-tabbar-item name="statistics">
            <template #icon="props">
              <van-icon :name="props.active ? 'bar-chart-o' : 'chart-trending-o'" />
            </template>
            <span>统计</span>
          </van-tabbar-item>
        </van-tabbar>
      </div>
    </van-config-provider>
  </div>
</template>

<style lang="scss" scoped>
  .app-wrapper {
    position: relative;
    min-height: 100vh;
    width: 100%;
    border-right: 1px solid color-mix(in srgb, var(--app-border) 78%, transparent);
    border-left: 1px solid color-mix(in srgb, var(--app-border) 78%, transparent);
    background: var(--app-shell-bg);
    box-shadow: 0 0 44px rgba(18, 24, 28, 0.13);
    display: flex;
    flex-direction: column;
    max-width: 560px;
    margin: 0 auto;
  }

  .app-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100vh;
    min-height: 100svh;
  }

  .main-content {
    flex: 1;
    width: 100%;
    padding-bottom: calc(58px + env(safe-area-inset-bottom));
    background-color: transparent;
    overflow-x: hidden;
  }

  :deep(.data-loading-overlay) {
    z-index: 200;
    display: grid;
    place-items: center;
    background: rgba(20, 17, 16, 0.32);

    .data-loading-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 18px 22px;
      border: 1px solid var(--app-border);
      border-radius: 16px;
      background: var(--app-card-bg);
      color: var(--app-text-secondary);
      font-size: 12px;
      box-shadow: 0 12px 32px rgba(40, 24, 18, 0.16);
    }
  }

  :deep(.custom-tabbar) {
    position: fixed !important;
    right: auto !important;
    bottom: 0 !important;
    left: 50% !important;
    width: min(100%, 560px) !important;
    transform: translateX(-50%) !important;
    background-color: color-mix(in srgb, var(--app-card-bg) 92%, transparent) !important;
    border-top: 1px solid var(--app-border) !important;
    height: calc(58px + env(safe-area-inset-bottom));
    z-index: 100;
    box-shadow: 0 -8px 28px rgba(15, 23, 42, 0.12);
    padding-bottom: env(safe-area-inset-bottom);
    -webkit-backdrop-filter: blur(18px) saturate(145%);
    backdrop-filter: blur(18px) saturate(145%);

    .van-tabbar-item {
      font-size: 11px;
      font-weight: 500;

      .van-icon {
        font-size: 22px;
        margin-bottom: 2px;
      }

      &--active {
        font-weight: 600;
      }
    }
  }
</style>
