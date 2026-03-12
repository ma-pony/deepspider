/**
 * DeepSpider - Storage 环境模块（数据驱动）
 */

export function storageCode(localData = {}, sessionData = {}) {
  return `(function() {
  function createStorage(seed) {
    const data = Object.assign({}, seed);
    return {
      get length() { return Object.keys(data).length; },
      key: function(i) { return Object.keys(data)[i] || null; },
      getItem: function(k) { return data[k] ?? null; },
      setItem: function(k, v) { data[k] = String(v); },
      removeItem: function(k) { delete data[k]; },
      clear: function() { for (var k in data) delete data[k]; }
    };
  }
  window.localStorage = createStorage(${JSON.stringify(localData)});
  window.sessionStorage = createStorage(${JSON.stringify(sessionData)});
})();`;
}

export const storageCovers = [
  'localStorage.length', 'localStorage.key', 'localStorage.getItem',
  'localStorage.setItem', 'localStorage.removeItem', 'localStorage.clear',
  'sessionStorage.length', 'sessionStorage.key', 'sessionStorage.getItem',
  'sessionStorage.setItem', 'sessionStorage.removeItem', 'sessionStorage.clear',
];

export default storageCode;
