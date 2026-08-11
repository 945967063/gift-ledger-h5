<script setup lang="ts">
  import { computed, onMounted } from 'vue';
  import useStore from '@/store';

  const { appearance } = useStore();
  const backgroundStyle = computed(() =>
    appearance.backgroundEnabled && appearance.backgroundUrl
      ? { backgroundImage: `url("${appearance.backgroundUrl}")` }
      : undefined
  );

  onMounted(() => {
    void appearance.loadRandomBackground();
  });
</script>

<template>
  <div class="app-root" :class="{ 'background-disabled': !appearance.backgroundEnabled }">
    <div class="global-background" aria-hidden="true">
      <div class="global-background__image" :style="backgroundStyle" />
      <div class="global-background__overlay" />
    </div>
    <router-view />
  </div>
</template>

<style lang="scss">
  .app-root {
    position: relative;
    min-height: 100vh;
    min-height: 100svh;
    isolation: isolate;
  }

  .app-root > :not(.global-background) {
    position: relative;
    z-index: 1;
  }

  .global-background {
    position: fixed;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    background:
      radial-gradient(circle at 18% 16%, rgba(219, 157, 128, 0.34), transparent 34%),
      radial-gradient(circle at 82% 78%, rgba(93, 135, 126, 0.28), transparent 38%), #dcd8d2;
  }

  .global-background__image,
  .global-background__overlay {
    position: absolute;
    inset: 0;
  }

  .global-background__image {
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    opacity: 1;
    filter: saturate(1.06) contrast(1.02);
    transform: scale(1.015);
    transition: opacity 300ms ease;
  }

  .global-background__overlay {
    background: linear-gradient(180deg, rgba(244, 246, 248, 0.08), rgba(235, 229, 222, 0.18));
  }

  html.dark {
    .global-background {
      background:
        radial-gradient(circle at 20% 14%, rgba(119, 51, 48, 0.3), transparent 34%),
        radial-gradient(circle at 80% 82%, rgba(28, 92, 70, 0.24), transparent 38%), #111316;
    }

    .global-background__image {
      filter: saturate(0.9) brightness(0.62) contrast(1.04);
    }

    .global-background__overlay {
      background: linear-gradient(180deg, rgba(8, 14, 19, 0.1), rgba(12, 12, 15, 0.3));
    }
  }

  .background-disabled .global-background__image {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .global-background__image {
      transition: none;
    }
  }
</style>
