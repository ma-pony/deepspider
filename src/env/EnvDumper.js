/**
 * JSForge - 环境自吐模块
 * 通过 Proxy 递归代理全局对象，记录所有环境访问
 */

import { HookBase } from './HookBase.js';

export class EnvDumper {
  constructor() {
    this.logs = [];
    this.maxValueLength = 70;
  }

  /**
   * 生成环境自吐注入代码
   * @param {Object} options - 配置选项
   * @returns {string} 可注入沙箱的 JS 代码
   */
  generateDumpCode(options = {}) {
    const {
      targets = ['window', 'document', 'navigator', 'location'],
      maxValueLength = 70,
      enableCallStack = false,
      skipInternals = true,
    } = options;

    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__ || global.__jsforge__;
  if (!jsforge) {
    console.error('[JSForge:env] 请先注入 HookBase');
    return;
  }
  const MAX_VALUE_LENGTH = ${maxValueLength};
  const ENABLE_CALL_STACK = ${enableCallStack};
  const SKIP_INTERNALS = ${skipInternals};

  // 截取值长度
  function truncateValue(value) {
    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) {
      return value.substring(0, MAX_VALUE_LENGTH) + "...";
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    try {
      const str = JSON.stringify(value);
      if (str.length > MAX_VALUE_LENGTH) {
        return str.substring(0, MAX_VALUE_LENGTH) + "...";
      }
      return str;
    } catch {
      return "[Object]";
    }
  }

  // 序列化值
  function serializeValue(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "function") return "[Function]";
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[Object]";
      }
    }
    return String(value);
  }

  // 记录日志
  function logEnv(type, path, details = {}) {
    const entry = {
      type,
      path,
      ...details
    };
    if (ENABLE_CALL_STACK) {
      entry.stack = new Error().stack;
    }
    jsforge.log('env', entry);

    // 格式化输出
    const pathStr = ('"' + path + '"').padEnd(50, " ");
    switch (type) {
      case 'get':
        console.log(\`[JSForge:env] 获取: \${pathStr} | 值= \${truncateValue(details.value)}\`);
        break;
      case 'set':
        console.log(\`[JSForge:env] 设置: \${pathStr} | 值= \${truncateValue(details.value)}\`);
        break;
      case 'call':
        console.log(\`[JSForge:env] 调用: \${pathStr} | 参数= \${truncateValue(details.args)}\`);
        break;
      case 'construct':
        console.log(\`[JSForge:env] 构造: \${pathStr} | 参数= \${truncateValue(details.args)}\`);
        break;
      case 'missing':
        console.log(\`[JSForge:env] 缺失: \${pathStr}\`);
        if (typeof __recordMissing__ === 'function') {
          __recordMissing__(path);
        }
        break;
    }
  }

  // 判断是否跳过的内部属性
  function shouldSkipKey(key, name) {
    if (!SKIP_INTERNALS) return false;

    const skipKeys = [
      'window', 'self', 'global', 'globalThis',
      '_globalObject', 'prototype', '__proto__'
    ];

    if (skipKeys.includes(key) || key === name) return true;
    if (typeof key === 'string' && (key.startsWith('__') && key.endsWith('__'))) return true;
    if (typeof key === 'symbol') return true;

    return false;
  }

  // 创建代理处理器
  function createHandler(name) {
    const proxyCache = new WeakMap();

    return {
      get(target, key, receiver) {
        // 跳过 Symbol 和特殊属性
        if (typeof key === 'symbol' || key === 'toString' || key === 'valueOf') {
          return Reflect.get(target, key, receiver);
        }

        const value = target[key];
        const fullPath = name + '.' + String(key);

        // 内部属性简单返回
        if (shouldSkipKey(key, name)) {
          return value;
        }

        // 记录缺失
        if (value === undefined && !(key in target)) {
          logEnv('missing', fullPath);
          return undefined;
        }

        // 处理函数
        if (typeof value === 'function') {
          // 检查是否是构造函数
          const isConstructor = value.prototype !== undefined;

          return new Proxy(value, {
            apply(fn, thisArg, args) {
              const result = Reflect.apply(fn, target, args);
              logEnv('call', fullPath, { args: serializeValue(args), result: serializeValue(result) });
              return result;
            },
            construct(fn, args, newTarget) {
              logEnv('construct', fullPath, { args: serializeValue(args) });
              return Reflect.construct(fn, args, newTarget);
            },
            get(fn, prop) {
              // 代理函数的属性访问
              if (prop === 'prototype' || typeof prop === 'symbol') {
                return fn[prop];
              }
              const propValue = fn[prop];
              if (typeof propValue === 'function') {
                return new Proxy(propValue, createHandler(fullPath + '.' + String(prop)));
              }
              return propValue;
            }
          });
        }

        // 处理对象 - 递归代理
        if (value !== null && typeof value === 'object') {
          // 使用缓存避免重复代理
          if (proxyCache.has(value)) {
            return proxyCache.get(value);
          }

          logEnv('get', fullPath, { value: serializeValue(value) });

          const proxy = new Proxy(value, createHandler(fullPath));
          proxyCache.set(value, proxy);
          return proxy;
        }

        // 基本类型
        logEnv('get', fullPath, { value: serializeValue(value) });
        return value;
      },

      set(target, key, value, receiver) {
        const fullPath = name + '.' + String(key);
        logEnv('set', fullPath, { value: serializeValue(value) });
        return Reflect.set(target, key, value, receiver);
      },

      apply(target, thisArg, args) {
        logEnv('call', name, { args: serializeValue(args) });
        return Reflect.apply(target, thisArg, args);
      },

      construct(target, args, newTarget) {
        logEnv('construct', name, { args: serializeValue(args) });
        return Reflect.construct(target, args, newTarget);
      }
    };
  }

  // 代理指定的全局对象
  const targets = ${JSON.stringify(targets)};

  for (const target of targets) {
    if (typeof global[target] !== 'undefined') {
      try {
        global[target] = new Proxy(global[target], createHandler(target));
      } catch (e) {
        console.log('[JSForge:env] 无法代理:', target, e.message);
      }
    }
  }

  console.log('[JSForge:env] 环境自吐已启用，监控目标:', targets.join(', '));
})();
`;
  }

  /**
   * 生成基础环境桩代码
   * 在注入自吐代码前，先创建基础的全局对象
   */
  generateBaseEnv() {
    return `
// 基础环境桩
if (typeof window === 'undefined') {
  global.window = global;
}
if (typeof self === 'undefined') {
  global.self = global;
}
if (typeof document === 'undefined') {
  global.document = {
    cookie: '',
    referrer: '',
    URL: 'about:blank',
    domain: '',
    title: '',
    body: null,
    head: null,
    documentElement: null,
    createElement: function(tag) { return { tagName: tag }; },
    getElementById: function() { return null; },
    getElementsByTagName: function() { return []; },
    getElementsByClassName: function() { return []; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    removeEventListener: function() {},
  };
}
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: '',
    platform: '',
    language: 'zh-CN',
    languages: ['zh-CN'],
    cookieEnabled: true,
    onLine: true,
    hardwareConcurrency: 4,
    maxTouchPoints: 0,
    webdriver: false,
  };
}
if (typeof location === 'undefined') {
  global.location = {
    href: 'about:blank',
    protocol: 'https:',
    host: '',
    hostname: '',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    origin: '',
  };
}
if (typeof screen === 'undefined') {
  global.screen = {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
  };
}
if (typeof localStorage === 'undefined') {
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { for (const k in storage) delete storage[k]; },
    get length() { return Object.keys(storage).length; },
    key: (i) => Object.keys(storage)[i] || null,
  };
}
if (typeof sessionStorage === 'undefined') {
  global.sessionStorage = { ...global.localStorage };
}
`;
  }

  /**
   * 解析环境日志，提取需要补全的环境
   */
  parseEnvLogs(logsJson) {
    try {
      const logs = JSON.parse(logsJson);
      const missing = new Set();
      const calls = [];
      const gets = [];

      for (const log of logs) {
        switch (log.type) {
          case 'missing':
            missing.add(log.path);
            break;
          case 'call':
            calls.push({ path: log.path, args: log.args });
            break;
          case 'get':
            gets.push({ path: log.path, value: log.value });
            break;
        }
      }

      return {
        missing: Array.from(missing),
        calls,
        gets,
        total: logs.length,
      };
    } catch (e) {
      return { error: e.message };
    }
  }
}

export default EnvDumper;
