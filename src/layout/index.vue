<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useDarkMode } from '@/composables/useToggleDarkMode';
  import useStore from '@/store';
  import AppSvgIcon from '@/components/AppSvgIcon.vue';

  const route = useRoute();
  const router = useRouter();
  const { cachedView, gift } = useStore();

  const cachedViews = computed(() => cachedView.cachedViewList);

  const activeTab = ref('home');

  type DockIconName = 'home' | 'record' | 'contacts' | 'statistics';

  const dockItems: ReadonlyArray<{ name: string; label: string; icon: DockIconName }> = [
    { name: 'home', label: '首页', icon: 'home' },
    { name: 'record', label: '记一笔', icon: 'record' },
    { name: 'contacts', label: '联系人', icon: 'contacts' },
    { name: 'statistics', label: '统计', icon: 'statistics' },
  ];

  const updateActiveTab = () => {
    const path = route.path;
    if (path.startsWith('/home')) {
      activeTab.value = 'home';
    } else if (path.startsWith('/settings')) {
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

        <nav class="bottom-dock" aria-label="主要导航">
          <div class="bottom-dock__surface">
            <button
              v-for="item in dockItems"
              :key="item.name"
              type="button"
              class="dock-item"
              :class="{ 'dock-item--active': activeTab === item.name }"
              :aria-current="activeTab === item.name ? 'page' : undefined"
              @click="onTabChange(item.name)"
            >
              <span class="dock-item__icon" aria-hidden="true">
                <AppSvgIcon :name="item.icon" />
              </span>
              <span class="dock-item__label">{{ item.label }}</span>
            </button>
          </div>
        </nav>
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
    --app-bottom-dock-space: calc(78px + max(8px, env(safe-area-inset-bottom)));

    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100vh;
    min-height: 100svh;
  }

  .main-content {
    flex: 1;
    width: 100%;
    padding-bottom: var(--app-bottom-dock-space);
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

  .bottom-dock {
    position: fixed !important;
    z-index: 100;
    right: auto;
    bottom: 8px;
    bottom: max(8px, env(safe-area-inset-bottom));
    left: 50% !important;
    width: min(calc(100% - 20px), 540px);
    transform: translateX(-50%) !important;
    pointer-events: none;

    &::after {
      position: absolute;
      top: calc(100% - 1px);
      left: 50%;
      width: min(100vw, 560px);
      height: calc(max(8px, env(safe-area-inset-bottom)) + 1px);
      background: color-mix(in srgb, var(--app-page-bg) 92%, transparent);
      content: '';
      transform: translateX(-50%);
      -webkit-backdrop-filter: blur(18px);
      backdrop-filter: blur(18px);
    }
  }

  .bottom-dock__surface {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 3px;
    padding: 6px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--app-border-strong) 72%, transparent);
    border-radius: 24px;
    background: color-mix(in srgb, var(--app-card-bg) 91%, transparent);
    box-shadow:
      0 18px 44px rgba(15, 23, 42, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.42);
    -webkit-backdrop-filter: blur(24px) saturate(155%);
    backdrop-filter: blur(24px) saturate(155%);
    pointer-events: auto;

    &::before {
      position: absolute;
      inset: 0 12% auto;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
      content: '';
      pointer-events: none;
    }
  }

  .dock-item {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 56px;
    padding: 5px 2px 4px;
    border: 0;
    border-radius: 18px;
    background: transparent;
    color: var(--app-text-secondary);
    font-family: inherit;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    cursor: pointer;
    transition:
      color 180ms ease,
      background-color 180ms ease,
      transform 180ms ease;

    &::after {
      position: absolute;
      right: 50%;
      bottom: 2px;
      width: 14px;
      height: 3px;
      border-radius: 999px;
      background: var(--app-primary);
      content: '';
      opacity: 0;
      transform: translateX(50%) scaleX(0.5);
      transition: 180ms ease;
    }

    &:active {
      transform: scale(0.96);
    }

    &--active {
      background: color-mix(in srgb, var(--app-primary) 12%, var(--app-card-hover));
      color: var(--app-primary);

      &::after {
        opacity: 1;
        transform: translateX(50%) scaleX(1);
      }

      .dock-item__icon {
        transform: translateY(-1px);
      }
    }
  }

  .dock-item__icon {
    display: grid;
    width: 25px;
    height: 25px;
    font-size: 24px;
    place-items: center;
    transition: transform 180ms ease;
  }

  .dock-item__label {
    overflow: hidden;
    max-width: 100%;
    font-size: 10px;
    font-weight: 650;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
