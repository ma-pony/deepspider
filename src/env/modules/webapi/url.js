/**
 * DeepSpider - URL 环境模块
 */

export const urlCode = `
(function() {
  function URL(url, base) {
    const full = base ? new URL(base).origin + url : url;
    const m = full.match(/^(\\w+):\\/\\/([^/:]+)(:\\d+)?([^?#]*)(\\?[^#]*)?(#.*)?$/);
    this.href = full;
    this.protocol = (m?.[1] || 'https') + ':';
    this.host = (m?.[2] || '') + (m?.[3] || '');
    this.hostname = m?.[2] || '';
    this.port = (m?.[3] || '').slice(1);
    this.pathname = m?.[4] || '/';
    this.search = m?.[5] || '';
    this.hash = m?.[6] || '';
    this.origin = this.protocol + '//' + this.host;
    this.searchParams = new URLSearchParams(this.search);
  }
  URL.prototype.toString = function() { return this.href; };

  function URLSearchParams(init) {
    this._p = new Map();
    if (typeof init === 'string') {
      init.replace(/^\\?/, '').split('&').forEach(p => {
        const [k,v] = p.split('=');
        if (k) this._p.set(decodeURIComponent(k), decodeURIComponent(v || ''));
      });
    }
  }
  URLSearchParams.prototype = {
    get: function(k) { return this._p.get(k) || null; },
    set: function(k,v) { this._p.set(k,v); },
    has: function(k) { return this._p.has(k); },
    delete: function(k) { this._p.delete(k); },
    toString: function() {
      return Array.from(this._p).map(([k,v]) => k+'='+encodeURIComponent(v)).join('&');
    }
  };

  window.URL = URL;
  window.URLSearchParams = URLSearchParams;
})();
`;

export const urlCovers = [
  'URL', 'URLSearchParams',
];

export default urlCode;
