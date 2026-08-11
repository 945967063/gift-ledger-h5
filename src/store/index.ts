import useDarkModeStore from './modules/darkMode';
import useCachedViewStore from './modules/cachedView';
import useGiftStore from './modules/giftStore';

export default function useStore() {
  return {
    darkMode: useDarkModeStore(),
    cachedView: useCachedViewStore(),
    gift: useGiftStore(),
  };
}
