import useStore from '@/store';

export function useDarkMode() {
  const { darkMode } = useStore();
  return darkMode.darkMode;
}

export function useToggleDarkMode(event?: TouchEvent | MouseEvent) {
  const { darkMode } = useStore();
  darkMode.toggleDarkMode(event);
}
