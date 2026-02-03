/**
 * DeepSpider - 加密库 Hook
 * 已废弃，请使用 src/env/CryptoHook.js
 */

export const cryptoHook = `
(function() {
  const deepspider = window.__deepspider__;
  if (!deepspider) return;

  // Hook Function.prototype.apply (CryptoJS)
  const _apply = Function.prototype.apply;
  const applyHook = function() {
    const result = _apply.call(this, ...arguments);
    try {
      if (arguments.length === 2 && arguments[1]?.[0]) {
        const cfg = arguments[1][0];
        if (cfg.ciphertext && cfg.key && cfg.algorithm) {
          deepspider.log('crypto', {
            algo: 'CryptoJS',
            key: cfg.key?.toString?.() || '',
            iv: cfg.iv?.toString?.() || '',
            mode: cfg.mode?.name || 'unknown'
          });
        }
      }
    } catch (e) {}
    return result;
  };
  Function.prototype.apply = deepspider.native(applyHook, _apply);

  // Hook RSA
  const _call = Function.prototype.call;
  const callHook = function() {
    const result = _call.call(this, ...arguments);
    try {
      const arg = arguments[0];
      if (arg?.__proto__?.getPublicKey && arg?.__proto__?.encrypt) {
        const proto = arg.__proto__.__proto__;
        if (proto?.encrypt && !proto.__hooked__) {
          proto.__hooked__ = true;
          const _enc = proto.encrypt;
          proto.encrypt = deepspider.native(function(data) {
            const enc = _enc.call(this, data);
            deepspider.log('crypto', { algo: 'RSA', data, encrypted: enc });
            return enc;
          }, _enc);
        }
      }
    } catch (e) {}
    return result;
  };
  Function.prototype.call = deepspider.native(callHook, _call);
})();
`;
