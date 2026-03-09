/**
 * 加密分析策略测试（升级策略已移除）
 * 所有分析直接委托 LLM，hints 作为上下文
 */

import { analyzeEncryption } from '../src/agent/ai/encryption-analyzer.js';
import { getEncryptionHints } from '../src/agent/rules/engine.js';

console.log('=== 加密分析策略测试 ===\n');

// 场景1：单一加密
console.log('场景1：单一加密');
const simple = await analyzeEncryption('CryptoJS.MD5(data).toString()');
console.log(`  needsLLM: ${simple.needsLLM}`);
console.log(`  hints: ${JSON.stringify(simple.hints)}`);
console.log();

// 场景2：多重加密（返回多个 hints）
console.log('场景2：多重加密（hints 提供上下文）');
const multi = await analyzeEncryption(`
  const encrypted = CryptoJS.AES.encrypt(data, key, { mode: CryptoJS.mode.CBC });
  const sign = CryptoJS.MD5(encrypted + timestamp);
`);
console.log(`  needsLLM: ${multi.needsLLM}`);
console.log(`  hints: ${JSON.stringify(multi.hints)}`);
console.log();

// 场景3：复杂混淆（无 hints，全委托 LLM）
console.log('场景3：复杂混淆');
const complex = await analyzeEncryption('var _0x1a2b=function(a,b){return a^b;}');
console.log(`  needsLLM: ${complex.needsLLM}`);
console.log(`  hints: ${JSON.stringify(complex.hints)}`);
