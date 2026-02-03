/**
 * DeepSpider - 反反调试模块
 * 绕过常见的反调试检测
 */

import { HookBase } from './HookBase.js';

export class AntiAntiDebug {
  /**
   * 绕过无限 debugger
   */
  generateAntiDebuggerCode() {
    return HookBase.getBaseCode() + `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  const origCtor = Function.prototype.constructor;
  Function.prototype.constructor = deepspider.native(function(...args) {
    if (args[0] && args[0].includes('debugger')) {
      deepspider.log('debug', { action: 'block.debugger.constructor' });
      return function() {};
    }
    return origCtor.apply(this, args);
  }, origCtor);

  const origEval = eval;
  eval = deepspider.native(function(code) {
    if (typeof code === 'string' && code.includes('debugger')) {
      deepspider.log('debug', { action: 'block.debugger.eval' });
      code = code.replace(/debugger/g, '');
    }
    return origEval(code);
  }, origEval);

  const origSetInterval = setInterval;
  setInterval = deepspider.native(function(fn, delay) {
    if (fn.toString().includes('debugger')) {
      deepspider.log('debug', { action: 'block.debugger.setInterval' });
      return 0;
    }
    return origSetInterval(fn, delay);
  }, origSetInterval);

  console.log('[DeepSpider:debug] 无限 debugger 防护已启用');
})();
`;
  }

  /**
   * 绕过控制台检测
   */
  generateAntiConsoleDetectCode() {
    return HookBase.getBaseCode() + `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
  Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 100 });

  const origLog = console.log;
  console.log = deepspider.native(function(...args) {
    if (args[0]?.toString?.().includes('devtools')) {
      deepspider.log('debug', { action: 'block.console.devtools' });
      return;
    }
    return origLog.apply(console, args);
  }, origLog);

  console.table = function() {};
  console.clear = function() {};

  console.log('[DeepSpider:debug] 控制台检测防护已启用');
})();
`;
  }

  /**
   * 绕过 CDP 检测
   */
  generateAntiCDPDetectCode() {
    return HookBase.getBaseCode() + `
(function() {
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
    configurable: true
  });

  console.log('[DeepSpider:debug] CDP 检测防护已启用');
})();
`;
  }

  /**
   * 生成完整的反反调试代码
   */
  generateFullAntiDebugCode() {
    return [
      this.generateAntiDebuggerCode(),
      this.generateAntiConsoleDetectCode(),
      this.generateAntiCDPDetectCode(),
    ].join('\n');
  }
}

export default AntiAntiDebug;
