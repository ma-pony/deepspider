/**
 * DeepSpider - Screen 环境模块（数据驱动）
 */

export function screenCode(data) {
  if (!data) throw new Error('screen: 需要真实浏览器数据');
  return `(function() {
  window.screen = {
    width: ${Number(data.width) || 1920},
    height: ${Number(data.height) || 1080},
    availWidth: ${Number(data.availWidth) || Number(data.width) || 1920},
    availHeight: ${Number(data.availHeight) || Number(data.height) || 1040},
    colorDepth: ${Number(data.colorDepth) || 24},
    pixelDepth: ${Number(data.pixelDepth) || 24},
    availLeft: ${Number(data.availLeft) || 0},
    availTop: ${Number(data.availTop) || 0},
    orientation: {
      type: ${JSON.stringify(data.orientation?.type || 'landscape-primary')},
      angle: ${data.orientation?.angle ?? 0},
      addEventListener: function() {},
      removeEventListener: function() {}
    }
  };
})();`;
}

export const screenCovers = [
  'screen.width', 'screen.height', 'screen.availWidth', 'screen.availHeight',
  'screen.colorDepth', 'screen.pixelDepth', 'screen.availLeft', 'screen.availTop',
  'screen.orientation',
];

export default screenCode;
