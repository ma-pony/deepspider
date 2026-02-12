/**
 * DeepSpider - Storage 环境模块
 */

export const storageCode = `
(function() {
  function createStorage() {
    const data = {};
    return {
      get length() { return Object.keys(data).length; },
      key: function(i) { return Object.keys(data)[i] || null; },
      getItem: function(k) { return data[k] ?? null; },
      setItem: function(k, v) { data[k] = String(v); },
      removeItem: function(k) { delete data[k]; },
      clear: function() { for (let k in data) delete data[k]; }
    };
  }
  window.localStorage = createStorage();
  window.sessionStorage = createStorage();
})();
`;

export const storageCovers = [
  'localStorage.length', 'localStorage.key', 'localStorage.getItem',
  'localStorage.setItem', 'localStorage.removeItem', 'localStorage.clear',
  'sessionStorage.length', 'sessionStorage.key', 'sessionStorage.getItem',
  'sessionStorage.setItem', 'sessionStorage.removeItem', 'sessionStorage.clear',
];

export default storageCode;
