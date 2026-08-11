<template>
  <div class="app-root">
    <div class="app-backdrop" aria-hidden="true">
      <span class="app-backdrop__orb app-backdrop__orb--red" />
      <span class="app-backdrop__orb app-backdrop__orb--gold" />
      <span class="app-backdrop__orb app-backdrop__orb--green" />
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

  .app-root > :not(.app-backdrop) {
    position: relative;
    z-index: 1;
  }

  .app-backdrop {
    position: fixed;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.54), transparent 42%),
      linear-gradient(160deg, #f8f4ef 0%, #f2f3ef 48%, #eee7e1 100%);

    &::after {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(96, 75, 61, 0.12) 0.7px, transparent 0.7px);
      background-size: 18px 18px;
      content: '';
      opacity: 0.22;
      -webkit-mask-image: linear-gradient(to bottom, #000, transparent 72%);
      mask-image: linear-gradient(to bottom, #000, transparent 72%);
    }
  }

  .app-backdrop__orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(10px);

    &--red {
      top: -110px;
      left: -120px;
      width: 360px;
      height: 360px;
      background: radial-gradient(circle, rgba(190, 59, 57, 0.2), rgba(190, 59, 57, 0));
    }

    &--gold {
      top: 28%;
      right: -130px;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(190, 143, 74, 0.15), rgba(190, 143, 74, 0));
    }

    &--green {
      bottom: -150px;
      left: 18%;
      width: 380px;
      height: 380px;
      background: radial-gradient(circle, rgba(43, 128, 91, 0.14), rgba(43, 128, 91, 0));
    }
  }

  html.dark {
    .app-backdrop {
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.025), transparent 38%),
        linear-gradient(160deg, #0c1117 0%, #10151b 48%, #0a0f14 100%);

      &::after {
        background-image: radial-gradient(rgba(255, 255, 255, 0.14) 0.7px, transparent 0.7px);
        opacity: 0.12;
      }
    }

    .app-backdrop__orb--red {
      background: radial-gradient(circle, rgba(202, 70, 67, 0.2), rgba(202, 70, 67, 0));
    }

    .app-backdrop__orb--gold {
      background: radial-gradient(circle, rgba(193, 146, 78, 0.12), rgba(193, 146, 78, 0));
    }

    .app-backdrop__orb--green {
      background: radial-gradient(circle, rgba(44, 145, 99, 0.13), rgba(44, 145, 99, 0));
    }
  }
</style>
