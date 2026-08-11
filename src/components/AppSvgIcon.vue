<script setup lang="ts">
  type AppSvgIconName = 'home' | 'record' | 'contacts' | 'statistics' | 'sun' | 'moon';

  defineProps<{
    name: AppSvgIconName;
  }>();
</script>

<template>
  <svg
    class="app-svg-icon"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g v-if="name === 'home'">
      <path d="M3.5 10.8 12 3.8l8.5 7" />
      <path d="M5.5 9.7v10h13v-10M9.2 19.7v-6h5.6v6" />
    </g>

    <g v-else-if="name === 'record'">
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M9 8h6M12 12v5M9.5 14.5h5" />
    </g>

    <g v-else-if="name === 'contacts'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19c.4-3.2 2.1-5 5.2-5s4.8 1.8 5.2 5" />
      <path d="M15.5 5.5a3 3 0 0 1 0 5.8M16 14c2.5.3 3.8 2 4.2 4.5" />
    </g>

    <g v-else-if="name === 'statistics'">
      <path d="M4 20V10.5h4V20M10 20V4h4v16M16 20v-7h4v7M3 20.5h18" />
    </g>

    <g v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
      />
    </g>

    <path v-else d="M19.5 15.2A8 8 0 0 1 8.8 4.5 8 8 0 1 0 19.5 15.2Z" />
  </svg>
</template>

<style scoped>
  .app-svg-icon {
    display: block;
    width: 1em;
    height: 1em;
    overflow: visible;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
