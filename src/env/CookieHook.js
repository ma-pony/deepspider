/**
 * JSForge - Cookie 监控模块
 * 监控 document.cookie 的读写操作
 */

import { HookBase } from './HookBase.js';

export class CookieHook {
  /**
   * 生成 Cookie Hook 代码
   */
  generateCookieHookCode(options = {}) {
    const { trackRead = true, trackWrite = true } = options;

    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                     Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

  if (cookieDesc) {
    Object.defineProperty(document, 'cookie', {
      ${trackRead ? `
      get: function() {
        const value = cookieDesc.get.call(document);
        jsforge.log('cookie', { action: 'read', value: value?.slice(0, 100) });
        return value;
      },
      ` : 'get: cookieDesc.get,'}
      ${trackWrite ? `
      set: function(val) {
        jsforge.log('cookie', { action: 'write', value: val });
        return cookieDesc.set.call(document, val);
      },
      ` : 'set: cookieDesc.set,'}
      configurable: true
    });
  }

  console.log('[JSForge:cookie] Cookie Hook 已启用');
})();
`;
  }
}

export default CookieHook;
