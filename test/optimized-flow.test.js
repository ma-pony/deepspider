/**
 * 简化后流程测试
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 简化后流程测试 ===\n');

const tests = [
  { name: 'MD5标准', code: 'CryptoJS.MD5(data).toString()' },
  { name: 'AES-GCM', code: 'CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.GCM })' },
  { name: 'SM3国密', code: 'sm3.hash(data)' },
];

for (const test of tests) {
  const result = await analyzeEncryption(test.code);
  const hints = result.hints;
  console.log(`${test.name}:`);
  console.log(`  needsLLM: ${result.needsLLM}`);
  console.log(`  hints: ${JSON.stringify(hints)}`);
  console.log();
}
