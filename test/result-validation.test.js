/**
 * 加密分析结果结构验证
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 结果结构验证测试 ===\n');

const code = `
function buildRequest(data) {
  const encrypted = CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CBC });
  const sign = CryptoJS.MD5(encrypted + timestamp);
  return { data: encrypted, sign };
}
`;

const result = await analyzeEncryption(code, '');

console.log(`needsLLM: ${result.needsLLM}`);
console.log(`success: ${result.success}`);
console.log(`hints: ${JSON.stringify(result.hints)}`);

// 验证结构
if (result.needsLLM === true && result.success === false && Array.isArray(result.hints)) {
  console.log('\n✅ 结果结构验证通过');
} else {
  console.log('\n❌ 结果结构异常');
}
