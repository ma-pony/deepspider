/**
 * 分析器多加密 hints 提取测试
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

const code = `
function buildRequest(data) {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    key,
    { mode: CryptoJS.mode.CBC }
  );
  const sign = CryptoJS.MD5(encrypted + timestamp).toString();
  return { data: encrypted, sign };
}
`;

console.log('=== 分析器多加密测试 ===\n');

console.log('getEncryptionHints:');
const hints = getEncryptionHints(code);
hints.forEach(h => console.log(`  - ${h}`));
console.log(`  总计: ${hints.length} 个加密模式`);
console.log();

console.log('analyzeEncryption:');
const result = await analyzeEncryption(code);
console.log(`  needsLLM: ${result.needsLLM}`);
console.log(`  hints: ${JSON.stringify(result.hints)}`);
