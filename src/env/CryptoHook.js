/**
 * DeepSpider - 加密函数 Hook
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
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  if (typeof CryptoJS !== 'undefined') {
    // AES
    ['encrypt', 'decrypt'].forEach(method => {
      if (CryptoJS.AES && CryptoJS.AES[method]) {
        const original = CryptoJS.AES[method];
        CryptoJS.AES[method] = deepspider.native(function(data, key, options) {
          const entry = deepspider.log('crypto', {
            algo: 'CryptoJS.AES.' + method,
            data: String(data).slice(0, 100),
            key: String(key),
            options: JSON.stringify(options)
          });
          deepspider.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    // DES
    if (CryptoJS.DES) {
      ['encrypt', 'decrypt'].forEach(method => {
        if (CryptoJS.DES[method]) {
          const original = CryptoJS.DES[method];
          CryptoJS.DES[method] = deepspider.native(function(data, key) {
            const entry = deepspider.log('crypto', {
              algo: 'CryptoJS.DES.' + method,
              data: String(data).slice(0, 100),
              key: String(key)
            });
            deepspider.linkCrypto(entry);
            return original.apply(this, arguments);
          }, original);
        }
      });
    }

    // Hash
    ['MD5', 'SHA1', 'SHA256', 'SHA512'].forEach(algo => {
      if (CryptoJS[algo]) {
        const original = CryptoJS[algo];
        CryptoJS[algo] = deepspider.native(function(message) {
          const entry = deepspider.log('crypto', { algo: 'CryptoJS.' + algo, message: String(message).slice(0, 100) });
          deepspider.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    // HMAC
    ['HmacMD5', 'HmacSHA1', 'HmacSHA256', 'HmacSHA512'].forEach(algo => {
      if (CryptoJS[algo]) {
        const original = CryptoJS[algo];
        CryptoJS[algo] = deepspider.native(function(message, key) {
          const entry = deepspider.log('crypto', { algo: 'CryptoJS.' + algo, message: String(message).slice(0, 100), key: String(key) });
          deepspider.linkCrypto(entry);
          return original.apply(this, arguments);
        }, original);
      }
    });

    console.log('[DeepSpider:crypto] CryptoJS Hook 已启用');
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
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  if (typeof sm2 !== 'undefined') {
    const origEnc = sm2.doEncrypt;
    sm2.doEncrypt = deepspider.native(function(msg, pubKey) {
      const entry = deepspider.log('crypto', { algo: 'SM2.encrypt', msg: msg.slice(0, 100), publicKey: pubKey.slice(0, 50) });
      deepspider.linkCrypto(entry);
      return origEnc.apply(this, arguments);
    }, origEnc);

    const origDec = sm2.doDecrypt;
    sm2.doDecrypt = deepspider.native(function(data) {
      const entry = deepspider.log('crypto', { algo: 'SM2.decrypt', data: data.slice(0, 100) });
      deepspider.linkCrypto(entry);
      return origDec.apply(this, arguments);
    }, origDec);
  }

  if (typeof sm3 !== 'undefined') {
    const orig = sm3;
    sm3 = deepspider.native(function(data) {
      const entry = deepspider.log('crypto', { algo: 'SM3', data: String(data).slice(0, 100) });
      deepspider.linkCrypto(entry);
      return orig.apply(this, arguments);
    }, orig);
  }

  if (typeof sm4 !== 'undefined' && sm4.encrypt) {
    const orig = sm4.encrypt;
    sm4.encrypt = deepspider.native(function(data, key) {
      const entry = deepspider.log('crypto', { algo: 'SM4.encrypt', data: data.slice(0, 100), key });
      deepspider.linkCrypto(entry);
      return orig.apply(this, arguments);
    }, orig);
  }

  console.log('[DeepSpider:crypto] SM Crypto Hook 已启用');
})();
`;
  }

  /**
   * 生成 RSA Hook 代码
   */
  generateRSAHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  if (typeof JSEncrypt !== 'undefined') {
    const proto = JSEncrypt.prototype;
    const origSetPub = proto.setPublicKey;
    proto.setPublicKey = deepspider.native(function(key) {
      const entry = deepspider.log('crypto', { algo: 'RSA.setPublicKey', key: key.slice(0, 100) });
      deepspider.linkCrypto(entry);
      return origSetPub.apply(this, arguments);
    }, origSetPub);

    const origEnc = proto.encrypt;
    proto.encrypt = deepspider.native(function(data) {
      const entry = deepspider.log('crypto', { algo: 'RSA.encrypt', data: String(data).slice(0, 100) });
      deepspider.linkCrypto(entry);
      return origEnc.apply(this, arguments);
    }, origEnc);
  }

  if (typeof forge !== 'undefined' && forge.pki && forge.pki.rsa) {
    const orig = forge.pki.rsa.encrypt;
    forge.pki.rsa.encrypt = deepspider.native(function(data) {
      const entry = deepspider.log('crypto', { algo: 'forge.rsa.encrypt', data: String(data).slice(0, 100) });
      deepspider.linkCrypto(entry);
      return orig.apply(this, arguments);
    }, orig);
  }

  console.log('[DeepSpider:crypto] RSA Hook 已启用');
})();
`;
  }

  /**
   * 生成通用加密函数 Hook
   */
  generateGenericCryptoHookCode() {
    return HookBase.getBaseCode() + `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  const keywords = ['encrypt', 'decrypt', 'sign', 'hash', 'md5', 'sha', 'aes', 'des', 'rsa', 'hmac'];

  for (const key in window) {
    try {
      if (typeof window[key] === 'function') {
        const lk = key.toLowerCase();
        if (keywords.some(kw => lk.includes(kw))) {
          const orig = window[key];
          window[key] = deepspider.native(function() {
            const entry = deepspider.log('crypto', { algo: 'generic.' + key, args: Array.from(arguments).map(a => String(a).slice(0, 100)) });
            deepspider.linkCrypto(entry);
            return orig.apply(this, arguments);
          }, orig);
        }
      }
    } catch(e) {}
  }

  console.log('[DeepSpider:crypto] Generic Crypto Hook 已启用');
})();
`;
  }
}

export default CryptoHook;
