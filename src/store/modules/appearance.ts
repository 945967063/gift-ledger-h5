import { defineStore } from 'pinia';

export const RANDOM_BACKGROUND_URL =
  import.meta.env.VITE_RANDOM_BACKGROUND_URL ||
  'https://img.lileyi.de/random?dir=random&type=img&orientation=auto';

const STORAGE_KEY = 'gift_ledger_background_enabled';

const readBackgroundEnabled = () => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'false';
};

let loadSequence = 0;

export default defineStore('appearance', {
  state: () => ({
    backgroundEnabled: readBackgroundEnabled(),
    backgroundUrl: '',
    backgroundLoading: false,
    backgroundError: false,
  }),
  actions: {
    async loadRandomBackground(force = false) {
      if (!this.backgroundEnabled || typeof window === 'undefined') return false;
      if (this.backgroundLoading && !force) return false;

      const sequence = ++loadSequence;
      const url = `${RANDOM_BACKGROUND_URL}&_=${Date.now()}-${sequence}`;
      this.backgroundLoading = true;
      this.backgroundError = false;

      return new Promise<boolean>((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
          if (sequence === loadSequence) {
            this.backgroundUrl = url;
            this.backgroundLoading = false;
            this.backgroundError = false;
          }
          resolve(true);
        };
        image.onerror = () => {
          if (sequence === loadSequence) {
            this.backgroundLoading = false;
            this.backgroundError = true;
          }
          resolve(false);
        };
        image.src = url;
      });
    },

    refreshBackground() {
      return this.loadRandomBackground(true);
    },

    async setBackgroundEnabled(enabled: boolean) {
      this.backgroundEnabled = enabled;
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      if (enabled && !this.backgroundUrl) return this.loadRandomBackground(true);
      return true;
    },
  },
});
