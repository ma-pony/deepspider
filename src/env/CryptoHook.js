/**
 * JSForge - 加密函数 Hook
 * 运行时捕获加密函数的参数和密钥
 */

import { HookBase } from './HookBase.js';

export class CryptoHook {
  /**
   * 生成 CryptoJS Hook 代码
   */
  generateCryptoJSHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  if (typeof CryptoJS !== 'undefined') {
    // AES
    ['encrypt', 'decrypt'].forEach(method => {
      if (CryptoJS.AES && CryptoJS.AES[method]) {
        const original = CryptoJS.AES[method];
        CryptoJS.AES[method] = jsforge.native(function(data, key, options) {
          const entry = jsforge.log('crypto', {
            algo: 'CryptoJS.AES.' + method,
            data: String(data).slice(0, 100),
            key: String(key),
            options: JSON.stringify(options)
          });
          jsforge.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    // DES
    if (CryptoJS.DES) {
      ['encrypt', 'decrypt'].forEach(method => {
        if (CryptoJS.DES[method]) {
          const original = CryptoJS.DES[method];
          CryptoJS.DES[method] = jsforge.native(function(data, key) {
            const entry = jsforge.log('crypto', {
              algo: 'CryptoJS.DES.' + method,
              data: String(data).slice(0, 100),
              key: String(key)
            });
            jsforge.linkCrypto(entry);
            return original.apply(this, arguments);
          }, original);
        }
      });
    }

    // Hash
    ['MD5', 'SHA1', 'SHA256', 'SHA512'].forEach(algo => {
      if (CryptoJS[algo]) {
        const original = CryptoJS[algo];
        CryptoJS[algo] = jsforge.native(function(message) {
          const entry = jsforge.log('crypto', { algo: 'CryptoJS.' + algo, message: String(message).slice(0, 100) });
          jsforge.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    // HMAC
    ['HmacMD5', 'HmacSHA1', 'HmacSHA256', 'HmacSHA512'].forEach(algo => {
      if (CryptoJS[algo]) {
        const original = CryptoJS[algo];
        CryptoJS[algo] = jsforge.native(function(message, key) {
          const entry = jsforge.log('crypto', { algo: 'CryptoJS.' + algo, message: String(message).slice(0, 100), key: String(key) });
          jsforge.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    console.log('[JSForge:crypto] CryptoJS Hook 已启用');
  }
})();
`;
  }

  /**
   * 生成国密 SM Hook 代码
   */
  generateSMCryptoHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  if (typeof sm2 !== 'undefined') {
    const origEnc = sm2.doEncrypt;
    sm2.doEncrypt = jsforge.native(function(msg, pubKey) {
      const entry = jsforge.log('crypto', { algo: 'SM2.encrypt', msg: msg.slice(0, 100), publicKey: pubKey.slice(0, 50) });
      jsforge.linkCrypto(entry);
      return origEnc.apply(this, arguments);
    }, origEnc);

    const origDec = sm2.doDecrypt;
    sm2.doDecrypt = jsforge.native(function(data) {
      const entry = jsforge.log('crypto', { algo: 'SM2.decrypt', data: data.slice(0, 100) });
      jsforge.linkCrypto(entry);
      return origDec.apply(this, arguments);
    }, origDec);
  }

  if (typeof sm3 !== 'undefined') {
    const orig = sm3;
    sm3 = jsforge.native(function(data) {
      const entry = jsforge.log('crypto', { algo: 'SM3', data: String(data).slice(0, 100) });
      jsforge.linkCrypto(entry);
      return orig.apply(this, arguments);
    }, orig);
  }

  if (typeof sm4 !== 'undefined' && sm4.encrypt) {
    const orig = sm4.encrypt;
    sm4.encrypt = jsforge.native(function(data, key) {
      const entry = jsforge.log('crypto', { algo: 'SM4.encrypt', data: data.slice(0, 100), key });
      jsforge.linkCrypto(entry);
      return orig.apply(this, arguments);
    }, orig);
  }

  console.log('[JSForge:crypto] SM Crypto Hook 已启用');
})();
`;
  }

  /**
   * 生成 RSA Hook 代码
   */
  generateRSAHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  if (typeof JSEncrypt !== 'undefined') {
    const proto = JSEncrypt.prototype;
    const origSetPub = proto.setPublicKey;
    proto.setPublicKey = jsforge.native(function(key) {
      const entry = jsforge.log('crypto', { algo: 'RSA.setPublicKey', key: key.slice(0, 100) });
      jsforge.linkCrypto(entry);
      return origSetPub.apply(this, arguments);
    }, origSetPub);

    const origEnc = proto.encrypt;
    proto.encrypt = jsforge.native(function(data) {
      const entry = jsforge.log('crypto', { algo: 'RSA.encrypt', data: String(data).slice(0, 100) });
      jsforge.linkCrypto(entry);
      return origEnc.apply(this, arguments);
    }, origEnc);
  }

  if (typeof forge !== 'undefined' && forge.pki && forge.pki.rsa) {
    const orig = forge.pki.rsa.encrypt;
    forge.pki.rsa.encrypt = jsforge.native(function(data) {
      const entry = jsforge.log('crypto', { algo: 'forge.rsa.encrypt', data: String(data).slice(0, 100) });
      jsforge.linkCrypto(entry);
      return orig.apply(this, arguments);
    }, orig);
  }

  console.log('[JSForge:crypto] RSA Hook 已启用');
})();
`;
  }

  /**
   * 生成通用加密函数 Hook
   */
  generateGenericCryptoHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const jsforge = window.__jsforge__;
  if (!jsforge) return;

  const keywords = ['encrypt', 'decrypt', 'sign', 'hash', 'md5', 'sha', 'aes', 'des', 'rsa', 'hmac'];

  for (const key in window) {
    try {
      if (typeof window[key] === 'function') {
        const lk = key.toLowerCase();
        if (keywords.some(kw => lk.includes(kw))) {
          const orig = window[key];
          window[key] = jsforge.native(function() {
            const entry = jsforge.log('crypto', { algo: 'generic.' + key, args: Array.from(arguments).map(a => String(a).slice(0, 100)) });
            jsforge.linkCrypto(entry);
            return orig.apply(this, arguments);
          }, orig);
        }
      }
    } catch(e) {}
  }

  console.log('[JSForge:crypto] Generic Crypto Hook 已启用');
})();
`;
  }
}

export default CryptoHook;
