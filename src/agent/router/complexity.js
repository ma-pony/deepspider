/**
 * 复杂度评估
 */

export function assessComplexity(task) {
  const { code = '', response = '' } = task;
  
  const signals = {
    hasObfuscation: /0x[a-f0-9]{4,}|_0x[a-f0-9]+/.test(code),
    hasWasm: code.includes('WebAssembly'),
    hasCustomCrypto: !/(CryptoJS|crypto-js|forge)/.test(code),
    responseEncrypted: response && !/^[\x20-\x7E\s]*$/.test(response),
    codeSize: code.length,
    hasKnownPattern: /(CryptoJS\.(MD5|AES|SHA256)|btoa|atob)/.test(code),
  };
  
  let score = 0;
  if (signals.hasObfuscation) score += 0.3;
  if (signals.hasWasm) score += 0.2;
  if (signals.hasCustomCrypto) score += 0.2;
  if (signals.responseEncrypted) score += 0.2;
  if (signals.codeSize > 50000) score += 0.1;
  if (signals.hasKnownPattern) score -= 0.3;
  
  return Math.max(0, Math.min(1, score));
}
