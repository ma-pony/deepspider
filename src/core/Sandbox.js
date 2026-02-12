/**
 * DeepSpider - 沙箱管理器
 * 基于 isolated-vm 的安全执行环境
 */

import ivm from 'isolated-vm';
import { EnvMonitor } from './EnvMonitor.js';
import { PatchGenerator } from './PatchGenerator.js';
import { modules, loadOrder } from '../env/modules/index.js';

export class Sandbox {
  constructor() {
    this.isolate = null;
    this.context = null;
    this.missingEnv = [];
    this.monitor = new EnvMonitor();
    this.patchGenerator = new PatchGenerator();
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

      const __proxyCache__ = new WeakMap();
      global.__createProxy__ = function(obj, path) {
        if (__proxyCache__.has(obj)) return __proxyCache__.get(obj);
        const proxy = new Proxy(obj, {
          get(t, p) {
            if (typeof p === 'symbol') return t[p];
            const fullPath = path ? path + '.' + p : String(p);
            const val = t[p];
            if (val === undefined && !(p in t)) {
              __recordMissing__(fullPath);
            }
            // 递归代理子对象
            if (val !== null && typeof val === 'object' && !__proxyCache__.has(val)) {
              return __createProxy__(val, fullPath);
            }
            return val;
          }
        });
        __proxyCache__.set(obj, proxy);
        return proxy;
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

  /**
   * 自动补环境闭环执行
   * 加载预置模块 → Proxy 监控 → 迭代补丁 → 返回结果
   */
  async executeWithAutoFix(code, options = {}) {
    const {
      timeout = 5000,
      maxIterations = 10,
      loadModules = true,
    } = options;

    // 1. 加载预置环境模块
    if (loadModules && !this.envLoaded) {
      const envCode = loadOrder.map(n => modules[n]).filter(Boolean).join('\n\n');
      await this.loadEnv(envCode);
    }

    // 2. 用 __createProxy__ 包裹全局对象，启用 missing 监控
    await this._wrapGlobalsWithProxy();

    const appliedPatches = [];
    let lastMissingKey = '';

    for (let i = 0; i < maxIterations; i++) {
      const result = await this.execute(code, { timeout });

      // 成功且无缺失，直接返回
      if (result.success && result.missingEnv.length === 0) {
        return { ...result, iterations: i + 1, appliedPatches };
      }

      // 没有新的缺失可补，退出
      const currentKey = result.missingEnv.sort().join('|');
      if (result.missingEnv.length === 0 || currentKey === lastMissingKey) {
        return {
          ...result,
          iterations: i + 1,
          appliedPatches,
          remainingMissing: result.missingEnv,
          stalled: currentKey === lastMissingKey,
        };
      }
      lastMissingKey = currentKey;

      // 非环境类错误（timeout / runtime-error），不继续补
      if (!result.success) {
        const envErrors = ['undefined-reference', 'not-a-function', 'null-access'];
        if (!envErrors.includes(result.errorType)) {
          return {
            ...result,
            iterations: i + 1,
            appliedPatches,
            remainingMissing: result.missingEnv,
          };
        }
      }

      // 批量生成补丁并注入（过滤掉 skipped 和低置信度的）
      // 未加载模块时，不跳过 coveredAPIs 中的属性
      const genContext = this.envLoaded ? {} : { skipCoveredCheck: true };
      const batch = await this.patchGenerator.generateBatch(result.missingEnv, genContext);
      const effective = batch.patches.filter(p => p.confidence >= 0.5 && !p.skipped);
      const patchCode = this.patchGenerator.mergePatchCode(effective);

      if (!patchCode.trim()) {
        return {
          ...result,
          iterations: i + 1,
          appliedPatches,
          remainingMissing: result.missingEnv,
        };
      }

      const injectResult = await this.inject(patchCode);
      if (!injectResult.success) {
        return {
          ...result,
          iterations: i + 1,
          appliedPatches,
          remainingMissing: result.missingEnv,
          patchError: injectResult.error,
        };
      }

      appliedPatches.push(...effective);

      // 补丁注入后重新包裹全局对象，恢复 Proxy 监控
      await this._wrapGlobalsWithProxy();
    }

    // 达到最大迭代次数
    const finalResult = await this.execute(code, { timeout });
    return {
      ...finalResult,
      iterations: maxIterations,
      appliedPatches,
      remainingMissing: finalResult.missingEnv,
      maxIterationsReached: true,
    };
  }

  /**
   * 将全局环境对象用 __createProxy__ 包裹，启用缺失属性监控
   */
  async _wrapGlobalsWithProxy() {
    const wrapCode = `
      (function() {
        var targets = ['navigator', 'document', 'screen', 'location', 'history'];
        for (var i = 0; i < targets.length; i++) {
          var name = targets[i];
          // 全局对象不存在时先创建空壳，确保 Proxy 可监控
          if (typeof global[name] === 'undefined') {
            global[name] = {};
          }
          if (typeof global[name] === 'object' && global[name] !== null) {
            try {
              global[name] = __createProxy__(global[name], name);
            } catch(e) {}
          }
        }
      })();
    `;
    await this.context.eval(wrapCode);
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
