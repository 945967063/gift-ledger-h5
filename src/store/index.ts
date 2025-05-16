import useDarkModeStore from './modules/darkMode';
import useCachedViewStore from './modules/cachedView';

export default function useStore() {
  return {
    darkMode: useDarkModeStore(),
    cachedView: useCachedViewStore(),
  };
}
