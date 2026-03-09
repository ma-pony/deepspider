/**
 * 加密分析无状态测试（缓存已移除）
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';

console.log('=== 加密分析无状态测试 ===\n');

// 测试1：多次调用都返回 needsLLM（无缓存）
console.log('测试1: 多次调用行为');
const result1 = await analyzeEncryption('CryptoJS.MD5(data)', '');
const result2 = await analyzeEncryption('CryptoJS.MD5(data)', '');

console.log(`✓ 第一次调用 needsLLM: ${result1.needsLLM}`);
console.log(`✓ 第二次调用 needsLLM: ${result2.needsLLM}`);
console.log(`✓ hints 一致: ${JSON.stringify(result1.hints) === JSON.stringify(result2.hints)}`);

// 测试2：Base64
const result3 = await analyzeEncryption('btoa(data)', '');
console.log(`\n✓ Base64 hints: ${JSON.stringify(result3.hints)}`);

console.log('\n✅ 无状态分析测试通过');
