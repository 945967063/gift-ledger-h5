export {};

declare global {
  interface Window {
    SlideBank: {
      /**接口地址 */
      VUE_APP_BASE_API: string;
    };
  }
}
