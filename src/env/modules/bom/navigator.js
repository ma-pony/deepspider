/**
 * DeepSpider - Navigator 环境模块
 */

export const navigatorCode = `
(function() {
  const navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    appCodeName: 'Mozilla',
    appName: 'Netscape',
    appVersion: '5.0 (Windows NT 10.0; Win64; x64)',
    platform: 'Win32',
    product: 'Gecko',
    vendor: 'Google Inc.',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en'],
    onLine: true,
    cookieEnabled: true,
    hardwareConcurrency: 8,
    maxTouchPoints: 0,
    deviceMemory: 8,
    webdriver: false,
    doNotTrack: null,

    plugins: { length: 0, item: () => null, namedItem: () => null, refresh: () => {} },
    mimeTypes: { length: 0, item: () => null, namedItem: () => null },

    connection: {
      downlink: 10, effectiveType: '4g', rtt: 50, saveData: false,
      addEventListener: () => {}, removeEventListener: () => {}
    },

    geolocation: {
      getCurrentPosition: (s, e) => e && e({ code: 1, message: 'Denied' }),
      watchPosition: () => 0,
      clearWatch: () => {}
    },

    permissions: {
      query: (d) => Promise.resolve({ name: d.name, state: 'prompt' })
    },

    javaEnabled: () => false,
    vibrate: () => true,
    sendBeacon: () => true,

    getBattery: () => Promise.resolve({
      charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1
    }),

    clipboard: {
      read: () => Promise.reject(new Error('NotAllowed')),
      readText: () => Promise.reject(new Error('NotAllowed')),
      write: () => Promise.reject(new Error('NotAllowed')),
      writeText: () => Promise.reject(new Error('NotAllowed'))
    },

    userAgentData: {
      brands: [{ brand: 'Chromium', version: '120' }],
      mobile: false,
      platform: 'Windows',
      getHighEntropyValues: () => Promise.resolve({ platform: 'Windows', architecture: 'x86' })
    }
  };

  window.navigator = navigator;
})();
`;

export default navigatorCode;
