export default {
  plugins: {
    tailwindcss: {},
    // 使用 cnjm-postcss-px-to-viewport 进行移动端自适应转换
    'cnjm-postcss-px-to-viewport': {
      viewportWidth: 375, // 根据设计稿设定
      unitPrecision: 4, // 转化精度，转换后保留位数
      viewportUnit: 'vw', // 转换后的单位为 vw
      fontViewportUnit: 'vw', // 字体单位为 vw
      unitToConvert: 'px', // 需要转换的单位
      minPixelValue: 1, // 小于或等于 1px 不转换为视窗单位
      selectorBlackList: ['ignore-vw'], // 忽略转换的 class
    },
    autoprefixer: {
      overrideBrowserslist: ['Android >= 4.0', 'iOS >= 7'],
    },
  },
};
