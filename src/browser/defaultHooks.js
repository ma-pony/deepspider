/**
 * JSForge - 默认 Hook 脚本
 * 浏览器启动时自动注入
 */

import { HookBase } from '../env/HookBase.js';
import { getAllCollectorScripts } from './collectors/index.js';
import { getAnalysisPanelScript } from './ui/analysisPanel.js';

/**
 * 生成默认注入的 Hook 代码
 */
export function getDefaultHookScript() {
  return HookBase.getBaseCode()
    + getNetworkHooks()
    + getCookieHook()
    + getCryptoHooks()
    + getAllCollectorScripts()
    + getAnalysisPanelScript(); // 分析面板 UI
}

/**
 * 网络请求 Hook (XHR + Fetch)
 */
function getNetworkHooks() {
  return `
// === XHR Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const OriginalXHR = XMLHttpRequest;

  XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const log = { method: '', url: '', requestHeaders: {}, requestBody: null, response: null, status: 0 };

    const originalOpen = xhr.open;
    xhr.open = jsforge.native(function(method, url) {
      log.method = method;
      log.url = url;
      return originalOpen.apply(xhr, arguments);
    }, originalOpen);

    const originalSetHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = jsforge.native(function(name, value) {
      log.requestHeaders[name] = value;
      return originalSetHeader.apply(xhr, arguments);
    }, originalSetHeader);

    const originalSend = xhr.send;
    xhr.send = jsforge.native(function(body) {
      log.requestId = jsforge.startRequest(log.url, log.method);
      log.requestBody = body;
      jsforge.log('xhr', { action: 'send', ...log, body: body?.toString().slice(0, 200) });
      return originalSend.apply(xhr, arguments);
    }, originalSend);

    xhr.addEventListener('load', function() {
      log.status = xhr.status;
      log.response = xhr.responseText?.slice(0, 500);
      const ctx = jsforge.endRequest();
      jsforge.log('xhr', {
        action: 'response',
        url: log.url,
        status: log.status,
        response: log.response?.slice(0, 100),
        linkedCrypto: ctx?.cryptoCalls || []
      });
    });

    return xhr;
  };

  XMLHttpRequest.prototype = OriginalXHR.prototype;
  console.log('[JSForge] XHR Hook 已启用');
})();

// === Fetch Hook ===
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

    log.requestId = jsforge.startRequest(log.url, log.method);

    if (options.body) {
      log.body = typeof options.body === 'string' ? options.body.slice(0, 500) : '[FormData/Blob]';
    }

    jsforge.log('fetch', { action: 'request', ...log });

    const response = await OriginalFetch.apply(this, arguments);
    log.status = response.status;

    try {
      const cloned = response.clone();
      const text = await cloned.text();
      log.response = text.slice(0, 500);
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

    return response;
  }, OriginalFetch);

  console.log('[JSForge] Fetch Hook 已启用');
})();
`;
}

/**
 * Cookie Hook
 */
function getCookieHook() {
  return `
// === Cookie Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                     Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

  if (cookieDesc) {
    Object.defineProperty(document, 'cookie', {
      get: function() {
        const value = cookieDesc.get.call(document);
        jsforge.log('cookie', { action: 'read', value: value?.slice(0, 100) });
        return value;
      },
      set: function(val) {
        jsforge.log('cookie', { action: 'write', value: val });
        return cookieDesc.set.call(document, val);
      },
      configurable: true
    });
  }

  console.log('[JSForge] Cookie Hook 已启用');
})();
`;
}

/**
 * 加密函数 Hook (CryptoJS + JSEncrypt + 国密)
 */
function getCryptoHooks() {
  return `
// === Crypto Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  // 延迟执行，等待加密库加载
  setTimeout(function hookCrypto() {
    // CryptoJS
    if (typeof CryptoJS !== 'undefined') {
      ['encrypt', 'decrypt'].forEach(method => {
        if (CryptoJS.AES && CryptoJS.AES[method]) {
          const original = CryptoJS.AES[method];
          CryptoJS.AES[method] = jsforge.native(function(data, key, options) {
            const entry = jsforge.log('crypto', {
              algo: 'CryptoJS.AES.' + method,
              data: String(data).slice(0, 100),
              key: String(key),
              options: JSON.stringify(options)
            });
            jsforge.linkCrypto(entry);
            return original.apply(this, arguments);
          }, original);
        }
      });

      ['MD5', 'SHA1', 'SHA256', 'SHA512', 'HmacMD5', 'HmacSHA1', 'HmacSHA256'].forEach(algo => {
        if (CryptoJS[algo]) {
          const original = CryptoJS[algo];
          CryptoJS[algo] = jsforge.native(function() {
            const entry = jsforge.log('crypto', {
              algo: 'CryptoJS.' + algo,
              args: Array.from(arguments).map(a => String(a).slice(0, 100))
            });
            jsforge.linkCrypto(entry);
            return original.apply(this, arguments);
          }, original);
        }
      });

      console.log('[JSForge] CryptoJS Hook 已启用');
    }

    // JSEncrypt (RSA)
    if (typeof JSEncrypt !== 'undefined') {
      const proto = JSEncrypt.prototype;
      if (proto.encrypt) {
        const origEnc = proto.encrypt;
        proto.encrypt = jsforge.native(function(data) {
          const entry = jsforge.log('crypto', { algo: 'RSA.encrypt', data: String(data).slice(0, 100) });
          jsforge.linkCrypto(entry);
          return origEnc.apply(this, arguments);
        }, origEnc);
      }
      console.log('[JSForge] RSA Hook 已启用');
    }

    // 国密 SM
    if (typeof sm2 !== 'undefined' && sm2.doEncrypt) {
      const origEnc = sm2.doEncrypt;
      sm2.doEncrypt = jsforge.native(function(msg, pubKey) {
        const entry = jsforge.log('crypto', { algo: 'SM2.encrypt', msg: String(msg).slice(0, 100) });
        jsforge.linkCrypto(entry);
        return origEnc.apply(this, arguments);
      }, origEnc);
      console.log('[JSForge] SM2 Hook 已启用');
    }
  }, 100);
})();
`;
}

export default getDefaultHookScript;
