/**
 * JSForge 分析能力测试
 */

import { ASTAnalyzer } from '../src/analyzer/ASTAnalyzer.js';
import { CallStackAnalyzer } from '../src/analyzer/CallStackAnalyzer.js';
import { EncryptionAnalyzer } from '../src/analyzer/EncryptionAnalyzer.js';
import { Deobfuscator } from '../src/analyzer/Deobfuscator.js';
import { Sandbox } from '../src/core/Sandbox.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 读取测试样本
const originalCode = fs.readFileSync(path.join(__dirname, 'samples/original.js'), 'utf-8');
const obfuscatedCode = fs.readFileSync(path.join(__dirname, 'samples/obfuscated.js'), 'utf-8');

console.log('=== JSForge 分析能力测试 ===\n');

// 测试 1: 混淆器识别
console.log('【测试1】混淆器识别');
const deob = new Deobfuscator();
const obfuscatorType = deob.detectObfuscator(obfuscatedCode);
console.log('识别结果:', obfuscatorType);
console.log('混淆类型:', deob._detectType(obfuscatedCode));
console.log('');

// 测试 2: 反混淆流水线
console.log('【测试2】反混淆流水线');
const pipelineResult = deob.runPipeline(obfuscatedCode);
console.log('应用的步骤:', pipelineResult.applied);
console.log('代码长度变化:', obfuscatedCode.length, '->', pipelineResult.code.length);
console.log('');

// 测试 3: AST 分析
console.log('【测试3】AST 分析');
const astAnalyzer = new ASTAnalyzer();
const functions = astAnalyzer.extractFunctions(obfuscatedCode);
console.log('提取到函数数量:', functions.length);
functions.forEach(f => console.log('  -', f.name, `(${f.params.join(', ')})`));
console.log('');

// 测试 4: 调用链分析
console.log('【测试4】调用链分析');
const callAnalyzer = new CallStackAnalyzer();
const entryPoints = callAnalyzer.findEntryPoints(obfuscatedCode);
console.log('入口点:', entryPoints.length);
entryPoints.forEach(e => console.log('  -', e.type, e.name || ''));

const callGraph = callAnalyzer.buildCallGraph(obfuscatedCode);
console.log('调用图节点数:', callGraph.size);
console.log('');

// 测试 5: 加密分析
console.log('【测试5】加密分析');
const encAnalyzer = new EncryptionAnalyzer();
const cryptoResult = encAnalyzer.analyze(obfuscatedCode);
console.log('检测到算法:', cryptoResult.detectedAlgorithms.map(a => a.name));
console.log('可疑函数:', cryptoResult.suspiciousFunctions.length);
console.log('');

// 测试 6: 字符串提取
console.log('【测试6】字符串提取');
const strings = astAnalyzer.extractStrings(obfuscatedCode);
console.log('字符串数量:', strings.length);
const keyStrings = strings.filter(s =>
  s.value.includes('key') ||
  s.value.includes('sign') ||
  s.value.includes('app')
);
console.log('关键字符串:', keyStrings.map(s => s.value));
console.log('');

// 测试 7: 沙箱执行
console.log('【测试7】沙箱执行');
const sandbox = new Sandbox();

const execResult = await sandbox.execute(obfuscatedCode);
console.log('执行成功:', execResult.success);
if (execResult.success) {
  console.log('执行结果:', execResult.result);
} else {
  console.log('错误:', execResult.error);
  console.log('错误类型:', execResult.errorType);
  console.log('缺失环境:', execResult.missingEnv);
}

console.log('\n=== 测试完成 ===');
