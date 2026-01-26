/**
 * JSForge 基础测试
 */

import { Engine } from '../src/core/Engine.js';
import { ASTAnalyzer } from '../src/analyzer/ASTAnalyzer.js';

async function testSandbox() {
  console.log('=== 测试沙箱执行 ===');
  const engine = new Engine();
  await engine.init();

  const result = await engine.sandbox.execute('1 + 1');
  console.log('1 + 1 =', result.result);

  await engine.dispose();
  console.log('沙箱测试通过\n');
}

async function testAST() {
  console.log('=== 测试 AST 分析 ===');
  const analyzer = new ASTAnalyzer();

  const code = `
    function add(a, b) { return a + b; }
    const result = add(1, 2);
  `;

  const funcs = analyzer.extractFunctions(code);
  console.log('函数:', funcs.length);

  const calls = analyzer.extractCalls(code);
  console.log('调用:', calls.length);
  console.log('AST 测试通过\n');
}

async function main() {
  await testSandbox();
  await testAST();
  console.log('所有测试通过!');
}

main().catch(console.error);
