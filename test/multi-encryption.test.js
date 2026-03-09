/**
 * 多加密识别测试
 */

import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 多加密识别测试 ===\n');

// 真实场景：电商API请求构造
const code = `
function buildRequest(data) {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    key,
    { mode: CryptoJS.mode.CBC }
  );

  const timestamp = Date.now();
  const sign = CryptoJS.MD5(encrypted + timestamp + secret).toString();

  return {
    data: encrypted.toString(),
    sign: sign,
    t: timestamp
  };
}
`;

console.log('测试代码：电商API（AES-CBC + MD5签名）\n');

const hints = getEncryptionHints(code);
console.log('识别结果:');
hints.forEach((h, i) => {
  console.log(`  ${i + 1}. ${h}`);
});
console.log(`\n总计: ${hints.length} 个加密模式`);
console.log(`包含 aes_cbc: ${hints.includes('aes_cbc')}`);
console.log(`包含 md5_sign: ${hints.includes('md5_sign')}`);
