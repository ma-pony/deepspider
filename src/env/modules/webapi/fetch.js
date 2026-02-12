/**
 * DeepSpider - Fetch 环境模块
 */

export const fetchCode = `
(function() {
  window.fetch = function(url, options = {}) {
    console.log('[fetch]', url);
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      url: url,
      headers: new Map(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      clone: function() { return this; }
    });
  };

  window.Headers = function(init) {
    this._h = new Map();
    if (init) Object.entries(init).forEach(([k,v]) => this._h.set(k,v));
  };
  window.Headers.prototype = {
    get: function(k) { return this._h.get(k); },
    set: function(k,v) { this._h.set(k,v); },
    has: function(k) { return this._h.has(k); },
    delete: function(k) { this._h.delete(k); }
  };

  window.Request = function(url, options) {
    this.url = url;
    this.method = options?.method || 'GET';
  };

  window.Response = function(body, options) {
    this.body = body;
    this.status = options?.status || 200;
  };
})();
`;

export const fetchCovers = [
  'fetch', 'Headers', 'Request', 'Response',
];

export default fetchCode;
