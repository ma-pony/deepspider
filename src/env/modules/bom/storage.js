/**
 * JSForge - Storage 环境模块
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

export default storageCode;
