/**
 * 多重加密 hints 提取测试
 * (部分成功策略已移除，改为完整 hints 提取)
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 多重加密 hints 提取测试 ===\n');

// 复杂混淆代码（含已知加密 + 自定义混淆）
const code = `
function encrypt(data) {
  const step1 = CryptoJS.MD5(data);
  const step2 = CryptoJS.AES.encrypt(step1, key, { mode: CryptoJS.mode.CBC });
  const step3 = customObfuscate(step2); // 自定义混淆
  return step3;
}
`;

console.log('场景：多重加密含自定义逻辑\n');

const hints = getEncryptionHints(code);
console.log(`识别到 hints: ${JSON.stringify(hints)}`);
console.log(`数量: ${hints.length}`);

const result = await analyzeEncryption(code, '');
console.log(`\nneedsLLM: ${result.needsLLM}`);
console.log(`hints: ${JSON.stringify(result.hints)}`);
console.log('\n✅ LLM 将根据 hints 分析完整流程');
