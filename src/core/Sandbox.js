/**
 * JSForge - 沙箱管理器
 * 基于 isolated-vm 的安全执行环境
 */

import ivm from 'isolated-vm';

export class Sandbox {
  constructor() {
    this.isolate = null;
    this.context = null;
    this.missingEnv = [];
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

  async _injectBase(jail) {
    // console
    await jail.set('console', {
      log: new ivm.Callback((...args) => console.log('[Sandbox]', ...args)),
      error: new ivm.Callback((...args) => console.error('[Sandbox]', ...args)),
      warn: new ivm.Callback((...args) => console.warn('[Sandbox]', ...args))
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
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async execute(code, options = {}) {
    const { timeout = 5000 } = options;
    this.missingEnv = [];

    try {
      const script = await this.isolate.compileScript(code);
      const result = await script.run(this.context, { timeout });

      return {
        success: true,
        result: this._serialize(result),
        missingEnv: [...this.missingEnv]
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        missingEnv: [...this.missingEnv]
      };
    }
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
