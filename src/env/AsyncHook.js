/**
 * DeepSpider - 异步追踪 Hook
 * 追踪 Promise、setTimeout 等异步调用
 */

import { HookBase } from './HookBase.js';

export class AsyncHook {
  /**
   * 生成 Promise Hook 代码
   */
  generatePromiseHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  const originalThen = Promise.prototype.then;
  Promise.prototype.then = deepspider.native(function(onFulfilled, onRejected) {
    const stack = new Error().stack;

    const wrappedFulfilled = onFulfilled ? function(value) {
      deepspider.log('async', { action: 'promise.then', stack });
      return onFulfilled(value);
    } : onFulfilled;

    return originalThen.call(this, wrappedFulfilled, onRejected);
  }, originalThen);

  console.log('[DeepSpider:async] Promise Hook 已启用');
})();
`;
  }

  /**
   * 生成 setTimeout/setInterval Hook 代码
   */
  generateTimerHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  const origSetTimeout = setTimeout;
  const origSetInterval = setInterval;

  setTimeout = deepspider.native(function(fn, delay) {
    deepspider.log('timer', { action: 'setTimeout', delay });
    return origSetTimeout(function() {
      deepspider.log('timer', { action: 'setTimeout.callback', delay });
      if (typeof fn === 'function') fn.apply(this, arguments);
    }, delay);
  }, origSetTimeout);

  setInterval = deepspider.native(function(fn, delay) {
    deepspider.log('timer', { action: 'setInterval', delay });
    return origSetInterval(function() {
      if (typeof fn === 'function') fn.apply(this, arguments);
    }, delay);
  }, origSetInterval);

  console.log('[DeepSpider:timer] Timer Hook 已启用');
})();
`;
  }
}

export default AsyncHook;
