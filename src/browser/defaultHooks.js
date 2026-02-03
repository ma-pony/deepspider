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
    + getJSONHooks()
    + getEncodingHooks()
    + getStorageHooks()
    + getWebSocketHooks()
    + getEvalHooks()
    + getWebpackHooks()
    + getCryptoHooks()
    + getCanvasHooks()
    + getNavigatorHooks()
    + getDOMHooks()
    + getProxyHooks()
    + getErrorStackHooks()
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
 * JSON.parse/stringify Hook
 * 只记录较大的 JSON 数据，避免性能问题
 */
function getJSONHooks() {
  return `
// === JSON Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const OriginalParse = JSON.parse;
  const OriginalStringify = JSON.stringify;
  const MIN_LOG_LENGTH = 50; // 只记录长度超过 50 的数据

  JSON.parse = jsforge.native(function(text, reviver) {
    const textStr = String(text);
    if (textStr.length >= MIN_LOG_LENGTH) {
      jsforge.log('json', {
        action: 'parse',
        input: textStr.slice(0, 200),
        len: textStr.length
      });
    }
    return OriginalParse.call(JSON, text, reviver);
  }, OriginalParse);

  JSON.stringify = jsforge.native(function(value, replacer, space) {
    const result = OriginalStringify.call(JSON, value, replacer, space);
    if (result && result.length >= MIN_LOG_LENGTH) {
      jsforge.log('json', {
        action: 'stringify',
        output: result.slice(0, 200),
        len: result.length
      });
    }
    return result;
  }, OriginalStringify);

  console.log('[JSForge] JSON Hook 已启用');
})();
`;
}

/**
 * Base64 + TextEncoder/Decoder Hook
 */
function getEncodingHooks() {
  return `
// === Encoding Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  // atob/btoa Hook
  const OriginalAtob = atob;
  const OriginalBtoa = btoa;

  window.atob = jsforge.native(function(data) {
    const result = OriginalAtob.call(window, data);
    jsforge.log('encoding', {
      action: 'atob',
      input: String(data).slice(0, 100),
      output: result.slice(0, 100)
    });
    return result;
  }, OriginalAtob);

  window.btoa = jsforge.native(function(data) {
    const result = OriginalBtoa.call(window, data);
    jsforge.log('encoding', {
      action: 'btoa',
      input: String(data).slice(0, 100),
      output: result.slice(0, 100)
    });
    return result;
  }, OriginalBtoa);

  // TextEncoder Hook
  if (window.TextEncoder) {
    const OriginalEncode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = jsforge.native(function(input) {
      const result = OriginalEncode.call(this, input);
      if (input && input.length >= 20) {
        jsforge.log('encoding', {
          action: 'TextEncoder.encode',
          input: String(input).slice(0, 100),
          len: result.length
        });
      }
      return result;
    }, OriginalEncode);
  }

  // TextDecoder Hook
  if (window.TextDecoder) {
    const OriginalDecode = TextDecoder.prototype.decode;
    TextDecoder.prototype.decode = jsforge.native(function(input) {
      const result = OriginalDecode.call(this, input);
      if (result && result.length >= 20) {
        jsforge.log('encoding', {
          action: 'TextDecoder.decode',
          output: result.slice(0, 100),
          len: result.length
        });
      }
      return result;
    }, OriginalDecode);
  }

  console.log('[JSForge] Encoding Hook 已启用');
})();
`;
}

/**
 * localStorage/sessionStorage Hook
 */
function getStorageHooks() {
  return `
// === Storage Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  function hookStorage(storage, name) {
    const origGet = storage.getItem.bind(storage);
    const origSet = storage.setItem.bind(storage);

    storage.getItem = jsforge.native(function(key) {
      const value = origGet(key);
      jsforge.log('storage', { action: 'get', storage: name, key: key, value: value?.slice(0, 100) });
      return value;
    }, origGet);

    storage.setItem = jsforge.native(function(key, value) {
      jsforge.log('storage', { action: 'set', storage: name, key: key, value: String(value).slice(0, 100) });
      return origSet(key, value);
    }, origSet);
  }

  if (window.localStorage) hookStorage(localStorage, 'local');
  if (window.sessionStorage) hookStorage(sessionStorage, 'session');

  console.log('[JSForge] Storage Hook 已启用');
})();
`;
}

/**
 * WebSocket Hook
 */
function getWebSocketHooks() {
  return `
// === WebSocket Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;
  if (!window.WebSocket) return;

  const OriginalWS = WebSocket;

  window.WebSocket = function(url, protocols) {
    jsforge.log('websocket', { action: 'connect', url: url });
    const ws = new OriginalWS(url, protocols);

    const origSend = ws.send.bind(ws);
    ws.send = jsforge.native(function(data) {
      jsforge.log('websocket', {
        action: 'send',
        url: url,
        data: String(data).slice(0, 200)
      });
      return origSend(data);
    }, origSend);

    ws.addEventListener('message', function(e) {
      jsforge.log('websocket', {
        action: 'message',
        url: url,
        data: String(e.data).slice(0, 200)
      });
    });

    ws.addEventListener('close', function(e) {
      jsforge.log('websocket', { action: 'close', url: url, code: e.code });
    });

    ws.addEventListener('error', function() {
      jsforge.log('websocket', { action: 'error', url: url });
    });

    return ws;
  };

  window.WebSocket.prototype = OriginalWS.prototype;
  window.WebSocket.CONNECTING = OriginalWS.CONNECTING;
  window.WebSocket.OPEN = OriginalWS.OPEN;
  window.WebSocket.CLOSING = OriginalWS.CLOSING;
  window.WebSocket.CLOSED = OriginalWS.CLOSED;

  console.log('[JSForge] WebSocket Hook 已启用');
})();
`;
}

/**
 * Webpack 模块 Hook - 检测闭包内的加密库
 */
function getWebpackHooks() {
  return `
// === Webpack Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  // 加密特征检测
  const cryptoPatterns = [
    { name: 'CryptoJS', pattern: /CryptoJS|crypto-js/i },
    { name: 'MD5', pattern: /\\bmd5\\b/i },
    { name: 'SHA', pattern: /\\bsha(1|256|512)\\b/i },
    { name: 'AES', pattern: /\\baes\\b/i },
    { name: 'RSA', pattern: /\\brsa\\b/i },
    { name: 'Base64', pattern: /base64|btoa|atob/i }
  ];

  // Hook webpackJsonp
  function hookWebpack() {
    if (window.webpackJsonp && !window.webpackJsonp.__hooked__) {
      const orig = window.webpackJsonp.push;
      window.webpackJsonp.push = function(chunk) {
        jsforge.log('env', { action: 'webpack.chunk', id: chunk[0] });
        return orig.apply(this, arguments);
      };
      window.webpackJsonp.__hooked__ = true;
    }
  }

  // 定期检查
  const check = setInterval(hookWebpack, 100);
  setTimeout(function() { clearInterval(check); }, 5000);

  console.log('[JSForge] Webpack Hook 已启用');
})();
`;
}

/**
 * eval/Function Hook - 捕获动态代码执行 + debugger 绕过
 */
function getEvalHooks() {
  return `
// === Eval/Function Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const debuggerPattern = /\\bdebugger\\b/;

  // Hook eval
  const OriginalEval = eval;
  window.eval = jsforge.native(function(code) {
    let codeStr = String(code);
    // debugger 绕过
    if (debuggerPattern.test(codeStr)) {
      codeStr = codeStr.replace(/\\bdebugger\\b/g, '/* debugger bypassed */');
      jsforge.log('debug', { action: 'bypass', type: 'eval' });
    }
    jsforge.log('eval', {
      action: 'eval',
      code: codeStr.slice(0, 500)
    });
    return OriginalEval.call(window, codeStr);
  }, OriginalEval);

  // Hook Function constructor
  const OriginalFunction = Function;
  window.Function = jsforge.native(function() {
    const args = Array.from(arguments);
    const lastIdx = args.length - 1;
    // debugger 绕过
    if (lastIdx >= 0 && typeof args[lastIdx] === 'string' && debuggerPattern.test(args[lastIdx])) {
      args[lastIdx] = args[lastIdx].replace(/\\bdebugger\\b/g, '/* debugger bypassed */');
      jsforge.log('debug', { action: 'bypass', type: 'Function' });
    }
    jsforge.log('eval', {
      action: 'Function',
      args: args.map(a => String(a).slice(0, 200))
    });
    return OriginalFunction.apply(this, args);
  }, OriginalFunction);
  window.Function.prototype = OriginalFunction.prototype;

  // Hook setTimeout/setInterval 字符串参数
  const OriginalSetTimeout = setTimeout;
  const OriginalSetInterval = setInterval;

  window.setTimeout = jsforge.native(function(handler, delay) {
    if (typeof handler === 'string') {
      // debugger 绕过
      if (debuggerPattern.test(handler)) {
        handler = handler.replace(/\\bdebugger\\b/g, '/* debugger bypassed */');
        jsforge.log('debug', { action: 'bypass', type: 'setTimeout' });
      }
      jsforge.log('eval', {
        action: 'setTimeout',
        code: handler.slice(0, 500),
        delay: delay
      });
      return OriginalSetTimeout.call(window, handler, delay);
    }
    return OriginalSetTimeout.apply(window, arguments);
  }, OriginalSetTimeout);

  window.setInterval = jsforge.native(function(handler, delay) {
    if (typeof handler === 'string') {
      // debugger 绕过
      if (debuggerPattern.test(handler)) {
        jsforge.log('debug', { action: 'bypass', type: 'setInterval' });
        return OriginalSetInterval.call(window, function(){}, delay);
      }
      jsforge.log('eval', {
        action: 'setInterval',
        code: handler.slice(0, 500),
        delay: delay
      });
    }
    // 检测高频 debugger 函数
    if (typeof handler === 'function' && delay < 500) {
      const code = handler.toString();
      if (debuggerPattern.test(code)) {
        jsforge.log('debug', { action: 'bypass', type: 'setInterval-func' });
        return OriginalSetInterval.call(window, function(){}, delay);
      }
    }
    return OriginalSetInterval.apply(window, arguments);
  }, OriginalSetInterval);

  console.log('[JSForge] Eval/Function Hook 已启用');
})();
`;
}

/**
 * 加密函数 Hook (CryptoJS + JSEncrypt + 国密 + Web Crypto API)
 * 使用 Object.defineProperty 拦截全局变量赋值，在加密库加载时立即 Hook
 */
function getCryptoHooks() {
  return `
// === Crypto Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  // Hook CryptoJS 的方法
  function hookCryptoJS(CryptoJS) {
    if (CryptoJS.__jsforge_hooked__) return;
    CryptoJS.__jsforge_hooked__ = true;

    // 对称加密算法
    ['AES', 'DES', 'TripleDES', 'RC4', 'Rabbit'].forEach(cipher => {
      if (!CryptoJS[cipher]) return;
      ['encrypt', 'decrypt'].forEach(method => {
        if (CryptoJS[cipher][method]) {
          const original = CryptoJS[cipher][method];
          CryptoJS[cipher][method] = jsforge.native(function(data, key, options) {
            const entry = jsforge.log('crypto', {
              algo: 'CryptoJS.' + cipher + '.' + method,
              data: String(data).slice(0, 100),
              keyLen: key ? String(key).length : 0,
              options: options ? Object.keys(options) : []
            });
            jsforge.linkCrypto(entry);
            return original.apply(this, arguments);
          }, original);
        }
      });
    });

    // 哈希算法
    ['MD5', 'SHA1', 'SHA256', 'SHA512', 'SHA3', 'RIPEMD160'].forEach(algo => {
      if (CryptoJS[algo]) {
        const original = CryptoJS[algo];
        CryptoJS[algo] = jsforge.native(function() {
          const entry = jsforge.log('crypto', {
            algo: 'CryptoJS.' + algo,
            inputLen: arguments[0] ? String(arguments[0]).length : 0
          });
          jsforge.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    // HMAC 算法
    ['HmacMD5', 'HmacSHA1', 'HmacSHA256', 'HmacSHA512'].forEach(algo => {
      if (CryptoJS[algo]) {
        const original = CryptoJS[algo];
        CryptoJS[algo] = jsforge.native(function() {
          const entry = jsforge.log('crypto', {
            algo: 'CryptoJS.' + algo,
            inputLen: arguments[0] ? String(arguments[0]).length : 0
          });
          jsforge.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    console.log('[JSForge] CryptoJS Hook 已启用');
  }

  // Hook JSEncrypt
  function hookJSEncrypt(JSEncrypt) {
    if (JSEncrypt.__jsforge_hooked__) return;
    JSEncrypt.__jsforge_hooked__ = true;

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

  // Hook SM2
  function hookSM2(sm2) {
    if (sm2.__jsforge_hooked__) return;
    sm2.__jsforge_hooked__ = true;

    if (sm2.doEncrypt) {
      const origEnc = sm2.doEncrypt;
      sm2.doEncrypt = jsforge.native(function(msg, pubKey) {
        const entry = jsforge.log('crypto', { algo: 'SM2.encrypt', msg: String(msg).slice(0, 100) });
        jsforge.linkCrypto(entry);
        return origEnc.apply(this, arguments);
      }, origEnc);
      console.log('[JSForge] SM2 Hook 已启用');
    }
  }

  // Hook node-forge
  function hookForge(forge) {
    if (forge.__jsforge_hooked__) return;
    forge.__jsforge_hooked__ = true;

    // MD/SHA
    ['md5', 'sha1', 'sha256', 'sha512'].forEach(function(algo) {
      if (forge.md && forge.md[algo]) {
        const orig = forge.md[algo].create;
        forge.md[algo].create = function() {
          const md = orig.apply(this, arguments);
          const origUpdate = md.update;
          md.update = function(data) {
            jsforge.log('crypto', { algo: 'forge.' + algo, inputLen: data?.length });
            return origUpdate.apply(this, arguments);
          };
          return md;
        };
      }
    });

    // AES
    if (forge.cipher) {
      const origCreate = forge.cipher.createCipher;
      if (origCreate) {
        forge.cipher.createCipher = function(algo, key) {
          jsforge.log('crypto', { algo: 'forge.cipher.' + algo, keyLen: key?.length });
          return origCreate.apply(this, arguments);
        };
      }
    }
    console.log('[JSForge] Forge Hook 已启用');
  }

  // Hook jsrsasign
  function hookJsrsasign(KJUR) {
    if (KJUR.__jsforge_hooked__) return;
    KJUR.__jsforge_hooked__ = true;

    if (KJUR.crypto && KJUR.crypto.Signature) {
      const origSign = KJUR.crypto.Signature.prototype.sign;
      if (origSign) {
        KJUR.crypto.Signature.prototype.sign = function() {
          jsforge.log('crypto', { algo: 'jsrsasign.sign' });
          return origSign.apply(this, arguments);
        };
      }
    }
    console.log('[JSForge] jsrsasign Hook 已启用');
  }

  // 使用 defineProperty 拦截全局变量赋值
  function watchGlobal(name, hookFn) {
    let value = window[name];
    if (value) {
      hookFn(value);
      return;
    }

    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: function() { return value; },
        set: function(newVal) {
          value = newVal;
          if (newVal) {
            hookFn(newVal);
          }
        }
      });
    } catch (e) {
      // 如果 defineProperty 失败，回退到轮询
      const check = setInterval(function() {
        if (window[name]) {
          clearInterval(check);
          hookFn(window[name]);
        }
      }, 50);
      setTimeout(function() { clearInterval(check); }, 10000);
    }
  }

  watchGlobal('CryptoJS', hookCryptoJS);
  watchGlobal('JSEncrypt', hookJSEncrypt);
  watchGlobal('sm2', hookSM2);
  watchGlobal('forge', hookForge);
  watchGlobal('KJUR', hookJsrsasign);

  // Hook Web Crypto API (原生加密)
  if (window.crypto && window.crypto.subtle) {
    const subtle = window.crypto.subtle;
    ['encrypt', 'decrypt', 'sign', 'verify', 'digest'].forEach(function(method) {
      if (subtle[method]) {
        const original = subtle[method].bind(subtle);
        subtle[method] = jsforge.native(function(algorithm) {
          const algoName = typeof algorithm === 'string' ? algorithm : algorithm.name;
          jsforge.log('crypto', {
            algo: 'WebCrypto.' + method,
            algorithm: algoName
          });
          return original.apply(subtle, arguments);
        }, original);
      }
    });
    console.log('[JSForge] Web Crypto API Hook 已启用');
  }
})();
`;
}

/**
 * Canvas 指纹检测 Hook
 */
function getCanvasHooks() {
  return `
// === Canvas Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  // toDataURL Hook
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = jsforge.native(function() {
    const result = origToDataURL.apply(this, arguments);
    jsforge.log('env', {
      action: 'canvas.toDataURL',
      width: this.width,
      height: this.height,
      hash: result.slice(0, 50)
    });
    return result;
  }, origToDataURL);

  // getImageData Hook
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = jsforge.native(function(x, y, w, h) {
    const result = origGetImageData.apply(this, arguments);
    jsforge.log('env', {
      action: 'canvas.getImageData',
      x: x, y: y, w: w, h: h
    });
    return result;
  }, origGetImageData);

  console.log('[JSForge] Canvas Hook 已启用');
})();
`;
}

/**
 * Navigator/Screen 环境检测 Hook
 */
function getNavigatorHooks() {
  return `
// === Navigator Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  // 监控 navigator 属性访问
  const navProps = ['userAgent', 'platform', 'language', 'languages', 'hardwareConcurrency', 'deviceMemory', 'webdriver'];
  navProps.forEach(function(prop) {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
    if (desc && desc.get) {
      const origGet = desc.get;
      Object.defineProperty(Navigator.prototype, prop, {
        get: function() {
          const val = origGet.call(this);
          jsforge.log('env', { action: 'navigator.' + prop, value: String(val).slice(0, 100) });
          return val;
        },
        configurable: true
      });
    }
  });

  console.log('[JSForge] Navigator Hook 已启用');
})();
`;
}

/**
 * DOM 查询监控
 */
function getDOMHooks() {
  return `
// === DOM Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const methods = [
    { obj: Document.prototype, name: 'getElementById' },
    { obj: Document.prototype, name: 'getElementsByClassName' },
    { obj: Document.prototype, name: 'getElementsByTagName' },
    { obj: Document.prototype, name: 'querySelector' },
    { obj: Document.prototype, name: 'querySelectorAll' },
    { obj: Element.prototype, name: 'querySelector' },
    { obj: Element.prototype, name: 'querySelectorAll' }
  ];

  methods.forEach(function(m) {
    const original = m.obj[m.name];
    if (!original) return;

    m.obj[m.name] = jsforge.native(function() {
      const selector = arguments[0];
      const result = original.apply(this, arguments);
      jsforge.log('dom', {
        action: m.name,
        selector: String(selector),
        found: result ? (result.length !== undefined ? result.length : 1) : 0
      });
      return result;
    }, original);
  });

  console.log('[JSForge] DOM Hook 已启用');
})();
`;
}

/**
 * Proxy/Reflect Hook - 监控现代混淆常用的 Proxy 操作
 */
function getProxyHooks() {
  return `
// === Proxy Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const OriginalProxy = Proxy;

  // 创建 trap 包装器（使用 IIFE 避免闭包问题）
  function wrapTrap(trapName, trapFn) {
    return function() {
      jsforge.log('env', {
        action: 'Proxy.' + trapName,
        args: Array.from(arguments).slice(0, 2).map(function(a) {
          return String(a).slice(0, 50);
        })
      });
      return trapFn.apply(this, arguments);
    };
  }

  window.Proxy = jsforge.native(function(target, handler) {
    jsforge.log('env', {
      action: 'Proxy.create',
      targetType: typeof target,
      traps: handler ? Object.keys(handler) : []
    });

    // 包装 handler
    const wrappedHandler = {};
    if (handler) {
      for (const trap in handler) {
        if (typeof handler[trap] === 'function') {
          wrappedHandler[trap] = wrapTrap(trap, handler[trap]);
        } else {
          wrappedHandler[trap] = handler[trap];
        }
      }
    }

    return new OriginalProxy(target, wrappedHandler);
  }, OriginalProxy);

  // 保留静态方法
  window.Proxy.revocable = OriginalProxy.revocable;

  console.log('[JSForge] Proxy Hook 已启用');
})();
`;
}

/**
 * Error.stack 保护 - 隐藏 Hook 相关的调用栈
 */
function getErrorStackHooks() {
  return `
// === Error Stack Hook ===
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const stackDesc = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');

  if (stackDesc && stackDesc.get) {
    const origGet = stackDesc.get;
    Object.defineProperty(Error.prototype, 'stack', {
      get: function() {
        let stack = origGet.call(this);
        if (stack && typeof stack === 'string') {
          // 过滤掉 JSForge 相关的栈帧
          stack = stack.split('\\n').filter(function(line) {
            return !/__jsforge__|JSForge|jsforge\\.native/.test(line);
          }).join('\\n');
        }
        return stack;
      },
      configurable: true
    });
  }

  console.log('[JSForge] Error Stack Hook 已启用');
})();
`;
}

export default getDefaultHookScript;
