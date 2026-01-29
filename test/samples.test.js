/**
 * JSForge 综合测试 - 测试所有混淆样本
 */

import { ASTAnalyzer } from '../src/analyzer/ASTAnalyzer.js';
import { CallStackAnalyzer } from '../src/analyzer/CallStackAnalyzer.js';
import { EncryptionAnalyzer } from '../src/analyzer/EncryptionAnalyzer.js';
import { Deobfuscator } from '../src/analyzer/Deobfuscator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, 'samples');

// 获取所有样本文件
const sampleFiles = fs.readdirSync(samplesDir)
  .filter(f => f.endsWith('.js') && f.startsWith('v'))
  .sort();

console.log('=== JSForge 综合测试 ===\n');
console.log(`发现 ${sampleFiles.length} 个测试样本\n`);

// 初始化分析器
const deob = new Deobfuscator();
const astAnalyzer = new ASTAnalyzer();
const encAnalyzer = new EncryptionAnalyzer();

// 导入沙箱工具
import { sandboxExecute, sandboxReset } from '../src/agent/tools/sandbox.js';

// 测试结果统计
const results = {
  total: sampleFiles.length,
  detected: 0,
  executed: 0,
  failed: []
};

// 逐个测试样本
for (const file of sampleFiles) {
  const filePath = path.join(samplesDir, file);
  const code = fs.readFileSync(filePath, 'utf-8');

  console.log(`\n【${file}】`);
  console.log('-'.repeat(40));

  // 1. 混淆器识别
  const obType = deob.detectObfuscator(code);
  const codeType = deob._detectType(code);
  console.log(`混淆器: ${obType} | 类型: ${codeType}`);
  if (obType !== 'unknown') results.detected++;

  // 2. 函数提取
  const funcs = astAnalyzer.extractFunctions(code);
  console.log(`函数数: ${funcs.length}`);

  // 3. 加密检测
  const crypto = encAnalyzer.analyze(code);
  if (crypto.detectedAlgorithms.length > 0) {
    console.log(`加密算法: ${crypto.detectedAlgorithms.map(a => a.name).join(', ')}`);
  }

  // 4. 沙箱执行
  const execResultStr = await sandboxExecute.invoke({ code, timeout: 3000 });
  const execResult = JSON.parse(execResultStr);
  if (execResult.success) {
    console.log(`执行: ✅ 成功`);
    results.executed++;
  } else {
    console.log(`执行: ❌ ${execResult.errorType || 'error'}`);
    if (execResult.missingEnv?.length > 0) {
      console.log(`缺失: ${execResult.missingEnv.slice(0, 3).join(', ')}...`);
    }
    results.failed.push({ file, error: execResult.error });
  }

  // 重置沙箱
  await sandboxReset.invoke({});
}

// 输出统计
console.log('\n' + '='.repeat(50));
console.log('【测试统计】');
console.log(`总样本: ${results.total}`);
console.log(`识别成功: ${results.detected}/${results.total}`);
console.log(`执行成功: ${results.executed}/${results.total}`);

if (results.failed.length > 0) {
  console.log('\n【失败详情】');
  results.failed.forEach(f => {
    console.log(`  ${f.file}: ${f.error?.slice(0, 50)}...`);
  });
}

console.log('\n=== 测试完成 ===');
