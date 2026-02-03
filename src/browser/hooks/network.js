/**
 * DeepSpider - 网络请求 Hook
 * 已废弃，请使用 src/env/NetworkHook.js
 */

export const networkHook = `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = deepspider.native(async function(url, options = {}) {
    deepspider.log('fetch', { url, body: options.body });
    return _fetch.call(this, url, options);
  }, _fetch);

  // Hook XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = deepspider.native(function(method, url) {
    this._url = url;
    this._method = method;
    return _open.apply(this, arguments);
  }, _open);

  XMLHttpRequest.prototype.send = deepspider.native(function(body) {
    deepspider.log('xhr', { method: this._method, url: this._url, body });
    return _send.apply(this, arguments);
  }, _send);
})();
`;
