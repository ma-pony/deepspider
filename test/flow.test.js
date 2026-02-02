/**
 * JSForge 完整流程测试 - 单样本深度分析
 */

import { ASTAnalyzer } from '../src/analyzer/ASTAnalyzer.js';
import { CallStackAnalyzer } from '../src/analyzer/CallStackAnalyzer.js';
import { EncryptionAnalyzer } from '../src/analyzer/EncryptionAnalyzer.js';
import { Deobfuscator } from '../src/analyzer/Deobfuscator.js';
import { Sandbox } from '../src/core/Sandbox.js';
import { Store } from '../src/store/Store.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 选择 v2_ob_advanced.js 进行深度分析
const code = fs.readFileSync(
  path.join(__dirname, 'samples/v2_ob_advanced.js'),
  'utf-8'
);

console.log('=== JSForge 完整流程测试 ===\n');
console.log('目标: v2_ob_advanced.js\n');

// Step 1: 混淆识别
console.log('【Step 1】混淆识别');
const deob = new Deobfuscator();
console.log('  混淆器:', deob.detectObfuscator(code));
console.log('  类型:', deob._detectType(code));

// Step 2: 反混淆
console.log('\n【Step 2】反混淆流水线');
const deobResult = deob.runPipeline(code);
console.log('  应用步骤:', deobResult.applied.join(' → '));
console.log('  代码压缩:', code.length, '→', deobResult.code.length);

// Step 3: AST 分析
console.log('\n【Step 3】AST 分析');
const ast = new ASTAnalyzer();
const funcs = ast.extractFunctions(code);
console.log('  函数列表:');
funcs.forEach(f => console.log(`    - ${f.name}(${f.params.join(', ')})`));

// Step 4: 调用链分析
console.log('\n【Step 4】调用链分析');
const call = new CallStackAnalyzer();
const graph = call.buildCallGraph(code);
console.log('  调用图:');
for (const [func, calls] of graph) {
  if (calls.length > 0) {
    console.log(`    ${func} → ${calls.map(c => c.callee).join(', ')}`);
  }
}

// Step 5: 加密分析
console.log('\n【Step 5】加密分析');
const enc = new EncryptionAnalyzer();
const crypto = enc.analyze(code);
console.log('  检测算法:', crypto.detectedAlgorithms.map(a => a.name).join(', ') || '无');
console.log('  可疑函数:', crypto.suspiciousFunctions.length);

// Step 6: 字符串提取
console.log('\n【Step 6】字符串提取');
const strings = ast.extractStrings(code);
const keywords = strings.filter(s =>
  /sign|key|secret|app|encrypt/i.test(s.value)
);
console.log('  总字符串:', strings.length);
console.log('  关键字符串:', keywords.map(s => `"${s.value}"`).join(', '));

// Step 7: 沙箱执行
console.log('\n【Step 7】沙箱执行');
const sandbox = new Sandbox();
const result = await sandbox.execute(code, { timeout: 5000 });
console.log('  执行状态:', result.success ? '✅ 成功' : '❌ 失败');
console.log('  结果:', result.result);

// Step 8: 存储结果
console.log('\n【Step 8】存储分析结果');
const store = new Store();
store.save('analysis', 'v2_ob_advanced', {
  obfuscator: deob.detectObfuscator(code),
  functions: funcs.length,
  crypto: crypto.detectedAlgorithms.map(a => a.name),
  executed: result.success
});
console.log('  已保存到 Store');

console.log('\n=== 流程测试完成 ===');
