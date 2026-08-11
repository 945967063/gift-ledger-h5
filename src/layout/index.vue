<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useDarkMode } from '@/composables/useToggleDarkMode';
  import useStore from '@/store';

  const route = useRoute();
  const router = useRouter();
  const { cachedView } = useStore();

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
      <div class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive :include="cachedViews">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>

      <!-- Bottom Tabbar matching design mockup -->
      <van-tabbar
        v-model="activeTab"
        class="custom-tabbar"
        :border="false"
        :fixed="true"
        :placeholder="true"
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
    </van-config-provider>
  </div>
</template>

<style lang="scss" scoped>
  .app-wrapper {
    position: relative;
    min-height: 100vh;
    width: 100%;
    background-color: var(--color-background-2);
    display: flex;
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    width: 100%;
    overflow-x: hidden;
  }

  :deep(.custom-tabbar) {
    background-color: var(--app-card-bg) !important;
    border-top: 1px solid var(--app-border) !important;
    height: 58px;
    z-index: 100;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.03);

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
