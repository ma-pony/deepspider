/**
 * JSForge - 异步追踪 Hook
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
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const originalThen = Promise.prototype.then;
  Promise.prototype.then = jsforge.native(function(onFulfilled, onRejected) {
    const stack = new Error().stack;

    const wrappedFulfilled = onFulfilled ? function(value) {
      jsforge.log('async', { action: 'promise.then', stack });
      return onFulfilled(value);
    } : onFulfilled;

    return originalThen.call(this, wrappedFulfilled, onRejected);
  }, originalThen);

  console.log('[JSForge:async] Promise Hook 已启用');
})();
`;
  }

  /**
   * 生成 setTimeout/setInterval Hook 代码
   */
  generateTimerHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const origSetTimeout = setTimeout;
  const origSetInterval = setInterval;

  setTimeout = jsforge.native(function(fn, delay) {
    jsforge.log('timer', { action: 'setTimeout', delay });
    return origSetTimeout(function() {
      jsforge.log('timer', { action: 'setTimeout.callback', delay });
      if (typeof fn === 'function') fn.apply(this, arguments);
    }, delay);
  }, origSetTimeout);

  setInterval = jsforge.native(function(fn, delay) {
    jsforge.log('timer', { action: 'setInterval', delay });
    return origSetInterval(function() {
      if (typeof fn === 'function') fn.apply(this, arguments);
    }, delay);
  }, origSetInterval);

  console.log('[JSForge:timer] Timer Hook 已启用');
})();
`;
  }
}

export default AsyncHook;
