/**
 * DeepSpider - Screen 环境模块
 */

export const screenCode = `
(function() {
  window.screen = {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    availLeft: 0,
    availTop: 0,
    orientation: {
      type: 'landscape-primary',
      angle: 0,
      addEventListener: () => {},
      removeEventListener: () => {}
    }
  };
})();
`;

export default screenCode;
