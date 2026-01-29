/**
 * JSForge - 网络请求 Hook 模块
 * 拦截 XHR 和 Fetch 请求/响应
 */

import { HookBase } from './HookBase.js';

export class NetworkHook {
  constructor() {
    this.logs = [];
  }

  /**
   * 生成 XHR Hook 代码
   */
  generateXHRHookCode(options = {}) {
    const { captureBody = true, captureResponse = true } = options;

    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const OriginalXHR = XMLHttpRequest;

  XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const log = {
      method: '',
      url: '',
      requestHeaders: {},
      requestBody: null,
      response: null,
      status: 0
    };

    // Hook open
    const originalOpen = xhr.open;
    xhr.open = jsforge.native(function(method, url) {
      log.method = method;
      log.url = url;
      return originalOpen.apply(xhr, arguments);
    }, originalOpen);

    // Hook setRequestHeader
    const originalSetHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = jsforge.native(function(name, value) {
      log.requestHeaders[name] = value;
      return originalSetHeader.apply(xhr, arguments);
    }, originalSetHeader);

    // Hook send
    const originalSend = xhr.send;
    xhr.send = jsforge.native(function(body) {
      // 开始请求上下文
      log.requestId = jsforge.startRequest(log.url, log.method);
      ${captureBody ? `log.requestBody = body;` : ''}
      jsforge.log('xhr', { action: 'send', ...log, body: body?.toString().slice(0, 200) });
      return originalSend.apply(xhr, arguments);
    }, originalSend);

    ${captureResponse ? `
    xhr.addEventListener('load', function() {
      log.status = xhr.status;
      log.response = xhr.responseText?.slice(0, 500);
      // 结束请求上下文，获取关联的加密调用
      const ctx = jsforge.endRequest();
      jsforge.log('xhr', {
        action: 'response',
        url: log.url,
        status: log.status,
        response: log.response?.slice(0, 100),
        linkedCrypto: ctx?.cryptoCalls || []
      });
    });
    ` : ''}

    return xhr;
  };

  XMLHttpRequest.prototype = OriginalXHR.prototype;
  console.log('[JSForge:xhr] XHR Hook 已启用');
})();
`;
  }

  /**
   * 生成 Fetch Hook 代码
   */
  generateFetchHookCode(options = {}) {
    const { captureBody = true, captureResponse = true } = options;

    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const OriginalFetch = fetch;

  fetch = jsforge.native(async function(url, options = {}) {
    const log = {
      url: typeof url === 'string' ? url : url.url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: null,
      response: null,
      status: 0
    };

    // 开始请求上下文
    log.requestId = jsforge.startRequest(log.url, log.method);

    ${captureBody ? `
    if (options.body) {
      log.body = typeof options.body === 'string' ? options.body.slice(0, 500) : '[FormData/Blob]';
    }
    ` : ''}

    jsforge.log('fetch', { action: 'request', ...log });

    const response = await OriginalFetch.apply(this, arguments);
    log.status = response.status;

    ${captureResponse ? `
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      log.response = text.slice(0, 500);
      // 结束请求上下文
      const ctx = jsforge.endRequest();
      jsforge.log('fetch', {
        action: 'response',
        url: log.url,
        status: log.status,
        response: log.response.slice(0, 100),
        linkedCrypto: ctx?.cryptoCalls || []
      });
    } catch (e) {
      jsforge.endRequest();
    }
    ` : 'jsforge.endRequest();'}

    return response;
  }, OriginalFetch);

  console.log('[JSForge:fetch] Fetch Hook 已启用');
})();
`;
  }

  /**
   * 生成完整的网络 Hook 代码
   */
  generateFullNetworkHookCode(options = {}) {
    return this.generateXHRHookCode(options) + '\n' + this.generateFetchHookCode(options);
  }
}

export default NetworkHook;
