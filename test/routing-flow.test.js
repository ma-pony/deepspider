/**
 * 加密分析流程测试（简化架构）
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 加密分析流程测试 ===\n');

// 测试 1: 简单 MD5（hints 识别）
console.log('测试 1: 简单 MD5 签名');
const test1 = await analyzeEncryption(`
  const sign = CryptoJS.MD5(data + secret).toString();
`);
console.log(`✓ needsLLM: ${test1.needsLLM}, hints: ${JSON.stringify(test1.hints)}\n`);

// 测试 2: 重复调用（行为一致，无缓存）
console.log('测试 2: 重复调用（一致性）');
const test2 = await analyzeEncryption(`
  const sign = CryptoJS.MD5(data + secret).toString();
`);
console.log(`✓ needsLLM: ${test2.needsLLM}, hints: ${JSON.stringify(test2.hints)}\n`);

// 测试 3: 复杂代码（hints 提取多个）
console.log('测试 3: 中等复杂度（时间戳 + 排序）');
const test3 = await analyzeEncryption(`
  function generateSign(params) {
    const timestamp = Date.now();
    const sorted = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
    return CryptoJS.MD5(sorted + timestamp + 'secret').toString();
  }
`);
console.log(`✓ needsLLM: ${test3.needsLLM}, hints: ${JSON.stringify(test3.hints)}\n`);

// 测试 4: Base64（hints 识别）
console.log('测试 4: Base64 编码');
const test4 = await analyzeEncryption(`
  const encoded = btoa(JSON.stringify(data));
`);
console.log(`✓ needsLLM: ${test4.needsLLM}, hints: ${JSON.stringify(test4.hints)}\n`);

console.log('✅ 所有测试完成（简化架构：直接委托 LLM）');
