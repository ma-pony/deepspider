/**
 * 加密 hints 提取性能测试
 */

import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 加密 hints 提取性能测试 ===\n');

// 性能测试
const testCode = 'const encoded = btoa(data);';
const iterations = 10000;

console.log(`性能测试（${iterations}次 getEncryptionHints）:`);
const start = Date.now();
for (let i = 0; i < iterations; i++) {
  getEncryptionHints(testCode);
}
const elapsed = Date.now() - start;

console.log(`总耗时: ${elapsed}ms`);
console.log(`平均: ${(elapsed / iterations).toFixed(3)}ms/次`);
console.log(`吞吐: ${(iterations / elapsed * 1000).toFixed(0)}次/秒`);
