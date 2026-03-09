/**
 * understandEncryption 工具提示词测试
 */

import { understandEncryption } from '../src/agent/tools/ai/encryption.js';

console.log('=== 加密工具提示词测试 ===\n');

// 多重加密场景
const source = `
function buildRequest(data) {
  const encrypted = CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CBC });
  const sign = CryptoJS.MD5(encrypted + timestamp).toString();
  return { data: encrypted, sign };
}
`;

console.log('测试：多重加密（AES-CBC + MD5）\n');

const result = await understandEncryption.invoke({ source, context: '电商API请求签名' });
const parsed = JSON.parse(result);

console.log(`hints: ${JSON.stringify(parsed.hints)}`);
console.log(`instruction: ${parsed.instruction}`);
console.log(`source 长度: ${parsed.source.length} 字符`);
