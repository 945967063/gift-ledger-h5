export default {
  plugins: {
    'cnjm-postcss-px-to-viewport': {
      viewportWidth: 375,
      unitPrecision: 4,
      viewportUnit: 'vw',
      fontViewportUnit: 'vw',
      unitToConvert: 'px',
      minPixelValue: 1,
    },
    autoprefixer: {
      overrideBrowserslist: ['Android >= 4.0', 'iOS >= 7'],
    },
  },
};
