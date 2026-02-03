/**
 * DeepSpider - 沙箱管理器
 * 基于 isolated-vm 的安全执行环境
 */

import ivm from 'isolated-vm';
import { EnvMonitor } from './EnvMonitor.js';

export class Sandbox {
  constructor() {
    this.isolate = null;
    this.context = null;
    this.missingEnv = [];
    this.monitor = new EnvMonitor();
    this.envLoaded = false;
  }

  async init(options = {}) {
    const { memoryLimit = 128 } = options;

    this.isolate = new ivm.Isolate({ memoryLimit });
    this.context = await this.isolate.createContext();

    const jail = this.context.global;
    await jail.set('global', jail.derefInto());

    await this._injectBase(jail);
    await this._injectMonitor(jail);

    return this;
  }

  // 加载环境代码
  async loadEnv(envCode) {
    if (!envCode) return;
    await this.context.eval(envCode);
    this.envLoaded = true;
  }

  async _injectBase(jail) {
    // console
    await jail.set('console', {
      log: new ivm.Callback((...args) => console.log('[DeepSpider:sandbox]', ...args)),
      error: new ivm.Callback((...args) => console.error('[DeepSpider:sandbox]', ...args)),
      warn: new ivm.Callback((...args) => console.warn('[DeepSpider:sandbox]', ...args))
    }, { copy: true });

    // Base64
    await jail.set('atob', new ivm.Callback((s) =>
      Buffer.from(s, 'base64').toString('binary')
    ));
    await jail.set('btoa', new ivm.Callback((s) =>
      Buffer.from(s, 'binary').toString('base64')
    ));

    // Timers (stub)
    await jail.set('setTimeout', new ivm.Callback(() => 0));
    await jail.set('setInterval', new ivm.Callback(() => 0));
    await jail.set('clearTimeout', new ivm.Callback(() => {}));
    await jail.set('clearInterval', new ivm.Callback(() => {}));
  }

  async _injectMonitor(jail) {
    const self = this;

    await jail.set('__recordMissing__', new ivm.Callback((path) => {
      if (!self.missingEnv.includes(path)) {
        self.missingEnv.push(path);
      }
    }));

    const monitorCode = `
      const window = global;
      global.window = window;
      global.self = window;

      global.__createProxy__ = function(obj, path) {
        return new Proxy(obj, {
          get(t, p) {
            if (typeof p === 'symbol') return t[p];
            const fullPath = path ? path + '.' + p : String(p);
            if (t[p] === undefined && !(p in t)) {
              __recordMissing__(fullPath);
            }
            return t[p];
          }
        });
      };
    `;

    await this.context.eval(monitorCode);
  }

  async inject(code) {
    try {
      await this.context.eval(code);
      // 返回更多信息帮助 Agent 判断下一步
      return {
        success: true,
        message: '代码已注入沙箱，请使用 sandbox_execute 验证执行',
        codeLength: code.length,
        hint: '建议调用 sandbox_execute 测试注入的函数是否可用'
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        hint: '注入失败，请检查代码语法'
      };
    }
  }

  async execute(code, options = {}) {
    const { timeout = 5000 } = options;
    this.missingEnv = [];

    try {
      const script = await this.isolate.compileScript(code);
      const result = await script.run(this.context, { timeout });

      // 记录到监控系统
      this.missingEnv.forEach(p => this.monitor.logMissing(p));

      return {
        success: true,
        result: this._serialize(result),
        missingEnv: [...this.missingEnv],
        stats: this.monitor.getStats()
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        errorType: this._classifyError(e),
        missingEnv: [...this.missingEnv],
        stats: this.monitor.getStats()
      };
    }
  }

  // 错误分类（帮助判断是环境缺失还是代码错误）
  _classifyError(e) {
    const msg = e.message || '';
    if (/is not defined/.test(msg)) return 'undefined-reference';
    if (/is not a function/.test(msg)) return 'not-a-function';
    if (/Cannot read propert/.test(msg)) return 'null-access';
    if (/timeout/.test(msg)) return 'timeout';
    return 'runtime-error';
  }

  _serialize(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return `[Function]`;
    if (typeof val === 'object') {
      try { return JSON.stringify(val); }
      catch { return '[Object]'; }
    }
    return String(val);
  }

  async reset() {
    await this.dispose();
    this.monitor.clearLogs();
    this.envLoaded = false;
    await this.init();
  }

  async dispose() {
    if (this.context) {
      this.context.release();
      this.context = null;
    }
    if (this.isolate) {
      this.isolate.dispose();
      this.isolate = null;
    }
  }
}

export default Sandbox;
