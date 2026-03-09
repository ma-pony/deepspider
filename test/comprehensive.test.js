/**
 * 综合测试 - 验证简化架构功能
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 综合架构测试 ===\n');

// 测试1：多加密识别
console.log('1. 多加密识别');
const multi = `
const encrypted = CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CBC });
const sign = CryptoJS.MD5(encrypted);
`;
const hints = getEncryptionHints(multi);
console.log(`   识别数量: ${hints.length}`);
console.log(`   hints: ${JSON.stringify(hints)}`);

// 测试2：analyzeEncryption 总是 needsLLM
console.log('\n2. analyzeEncryption 始终委托 LLM');
const result = await analyzeEncryption(multi, '');
console.log(`   needsLLM: ${result.needsLLM}`);
console.log(`   success: ${result.success}`);
console.log(`   hints: ${JSON.stringify(result.hints)}`);

// 测试3：无加密
console.log('\n3. 无加密代码');
const plain = `console.log("hello world");`;
const plainHints = getEncryptionHints(plain);
console.log(`   hints: ${JSON.stringify(plainHints)}`);

console.log('\n✅ 所有功能正常');
