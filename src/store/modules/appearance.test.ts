import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import useAppearanceStore, { RANDOM_BACKGROUND_URL } from './appearance';

class MockImage {
  decoding = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    if (value.includes('fail')) this.onerror?.();
    else this.onload?.();
  }
}

describe('随机背景外观设置', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    setActivePinia(createPinia());
    storage.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('预加载成功后才切换页面背景', async () => {
    const store = useAppearanceStore();
    expect(await store.loadRandomBackground()).toBe(true);
    expect(store.backgroundUrl).toContain(RANDOM_BACKGROUND_URL);
    expect(store.backgroundLoading).toBe(false);
    expect(store.backgroundError).toBe(false);
  });

  it('允许关闭背景并持久化设置', async () => {
    const store = useAppearanceStore();
    await store.setBackgroundEnabled(false);
    expect(store.backgroundEnabled).toBe(false);
    expect(storage.get('gift_ledger_background_enabled')).toBe('false');
    expect(await store.loadRandomBackground()).toBe(false);
  });
});
