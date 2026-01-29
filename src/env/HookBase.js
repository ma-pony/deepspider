/**
 * JSForge - Hook 基础框架
 * 统一的 Hook 反检测 + 日志管理
 */

export class HookBase {
  /**
   * 获取 Hook 基础代码
   * 包含：反检测、统一日志管理
   */
  static getBaseCode() {
    return `
// === JSForge Hook Base ===
(function() {
  if (window.__jsforge__) return;

  const originalToString = Function.prototype.toString;
  const hookedFns = new WeakMap();

  // 统一日志存储
  const logs = {
    xhr: [],
    fetch: [],
    cookie: [],
    crypto: [],
    async: [],
    timer: [],
    env: [],
    debug: [],
    trace: []  // 追踪日志
  };

  // 请求上下文（用于关联加密和请求）
  let requestContext = null;
  let requestIdCounter = 0;

  // JSForge 全局对象
  window.__jsforge__ = {
    version: '1.0.0',

    // === 安全 Hook 函数 ===
    hook: function(obj, prop, handler) {
      if (!obj || typeof obj[prop] !== 'function') return false;

      const original = obj[prop];
      const origStr = originalToString.call(original);

      const hooked = function() {
        try {
          return handler.call(this, original, this, arguments);
        } catch (e) {
          return original.apply(this, arguments);
        }
      };

      // 保留属性
      try {
        Object.defineProperties(hooked, {
          length: { value: original.length },
          name: { value: original.name },
          prototype: { value: original.prototype }
        });
      } catch(e) {}

      hookedFns.set(hooked, origStr);
      obj[prop] = hooked;
      return true;
    },

    // === 包装函数（让 Hook 函数看起来像原生） ===
    native: function(hookFunc, originalFunc) {
      try {
        Object.defineProperty(hookFunc, 'name', { value: originalFunc.name });
        Object.defineProperty(hookFunc, 'length', { value: originalFunc.length });
      } catch (e) {}
      hookedFns.set(hookFunc, originalToString.call(originalFunc));
      return hookFunc;
    },

    // === 统一日志管理 ===
    log: function(type, data) {
      if (!logs[type]) logs[type] = [];

      const entry = {
        ...data,
        timestamp: Date.now(),
        stack: new Error().stack,
        requestId: requestContext?.id || null
      };

      logs[type].push(entry);
      console.log('[JSForge:' + type + ']', data.action || data.type || '', data);
      return entry;
    },

    // === 调用栈解析 ===
    parseStack: function(stack) {
      if (!stack) return [];
      return stack.split('\\n').slice(2).map(function(line) {
        const match = line.match(/at\\s+(.+?)\\s+\\((.+?):(\\d+):(\\d+)\\)/) ||
                      line.match(/at\\s+(.+?):(\\d+):(\\d+)/);
        if (match) {
          return {
            func: match[1] || 'anonymous',
            file: match[2] || match[1],
            line: parseInt(match[3] || match[2]),
            col: parseInt(match[4] || match[3])
          };
        }
        return { raw: line.trim() };
      }).filter(function(f) { return f.func || f.raw; });
    },

    // === 请求上下文管理 ===
    startRequest: function(url, method) {
      requestIdCounter++;
      requestContext = {
        id: requestIdCounter,
        url: url,
        method: method,
        startTime: Date.now(),
        cryptoCalls: [],
        cookieOps: []
      };
      return requestContext.id;
    },

    endRequest: function() {
      const ctx = requestContext;
      requestContext = null;
      return ctx;
    },

    getRequestContext: function() {
      return requestContext;
    },

    // === 关联加密调用到当前请求 ===
    linkCrypto: function(cryptoEntry) {
      if (requestContext) {
        requestContext.cryptoCalls.push(cryptoEntry);
      }
    },

    getLogs: function(type) {
      if (type) {
        return JSON.stringify(logs[type] || []);
      }
      return JSON.stringify(logs);
    },

    clearLogs: function(type) {
      if (type) {
        if (logs[type]) logs[type].length = 0;
      } else {
        for (const key in logs) {
          logs[key].length = 0;
        }
      }
    },

    // === 获取所有日志（合并） ===
    getAllLogs: function() {
      const all = [];
      for (const type in logs) {
        for (const entry of logs[type]) {
          all.push({ _type: type, ...entry });
        }
      }
      all.sort((a, b) => a.timestamp - b.timestamp);
      return JSON.stringify(all);
    }
  };

  // 绕过 toString 检测
  Function.prototype.toString = function() {
    return hookedFns.has(this) ? hookedFns.get(this) : originalToString.call(this);
  };
  hookedFns.set(Function.prototype.toString, originalToString.call(originalToString));

  console.log('[JSForge] Hook 基础框架已加载');
})();
`;
  }
}

export default HookBase;
