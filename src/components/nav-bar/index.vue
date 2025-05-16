<script setup lang="ts">
  import { useToggleDarkMode } from '@/composables/useToggleDarkMode';

  const onClickRight = (event: TouchEvent | MouseEvent) => {
    useToggleDarkMode(event);
  };
</script>

<template>
  <van-nav-bar fixed placeholder @click-right="onClickRight">
    <template #right>
      <div>121212</div>
    </template>
  </van-nav-bar>
</template>

<style scoped></style>
