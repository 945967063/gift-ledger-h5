<script setup lang="ts">
  import NavBar from '@/components/nav-bar/index.vue';
  import { useDarkMode } from '@/composables/useToggleDarkMode';
  import useStore from '@/store';
  const { cachedView } = useStore();
  const cachedViews = computed(() => {
    return cachedView.cachedViewList;
  });
</script>

<template>
  <div class="app-wrapper">
    <van-config-provider :theme="useDarkMode() ? 'dark' : 'light'">
      <nav-bar />
      <router-view v-slot="{ Component }">
        <keep-alive :include="cachedViews">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </van-config-provider>
  </div>
</template>

<style lang="scss" scoped>
  @use '@/assets/styles/mixin' as *;
  .app-wrapper {
    @include clearfix;
    position: relative;
    height: 100%;
    width: 100%;
  }
</style>
