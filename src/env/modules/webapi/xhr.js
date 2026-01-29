/**
 * JSForge - XMLHttpRequest 环境模块
 */

export const xhrCode = `
(function() {
  function XMLHttpRequest() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.responseXML = null;
    this.response = '';
    this.responseType = '';
    this.timeout = 0;
    this.withCredentials = false;
    this._headers = {};
    this._url = '';
    this._method = 'GET';
  }

  XMLHttpRequest.prototype = {
    UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4,
    open: function(method, url) {
      this._method = method;
      this._url = url;
      this.readyState = 1;
    },
    setRequestHeader: function(k, v) { this._headers[k] = v; },
    getResponseHeader: function(k) { return null; },
    getAllResponseHeaders: function() { return ''; },
    send: function(data) {
      console.log('[JSForge:xhr]', this._method, this._url);
      this.readyState = 4;
      this.status = 200;
      if (this.onreadystatechange) this.onreadystatechange();
      if (this.onload) this.onload();
    },
    abort: function() { this.readyState = 0; },
    addEventListener: function() {},
    removeEventListener: function() {}
  };

  window.XMLHttpRequest = XMLHttpRequest;
})();
`;

export default xhrCode;
