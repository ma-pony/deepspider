/**
 * 加密分析批量测试（路由监控已移除）
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';

console.log('=== 加密分析批量测试 ===\n');

const tests = [
  { name: 'MD5', code: 'CryptoJS.MD5(data).toString()' },
  { name: 'AES', code: 'CryptoJS.AES.encrypt(data, key)' },
  { name: 'Base64', code: 'btoa(data)' },
  { name: 'SHA256', code: 'CryptoJS.SHA256(data).toString()' },
  { name: 'MD5重复', code: 'CryptoJS.MD5(data).toString()' },
];

for (const test of tests) {
  const result = await analyzeEncryption(test.code);
  console.log(`✓ ${test.name}: needsLLM=${result.needsLLM}, hints=${JSON.stringify(result.hints)}`);
}

console.log('\n✅ 批量测试完成');
