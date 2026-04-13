/**
 * rebuild.js 输入校验回归测试
 *
 * deep-review Security agent F1+F2 在 src/mcp/tools/rebuild.js 的 export_rebuild_bundle
 * 里发现两个 LLM-input 校验缺陷：
 *   - taskId 允许 leading dot → 可创建 .git / .ssh 等隐藏目录
 *   - callExpression 只过滤了 `[;\n\r]` 和少量关键字，可被 \u2028 / 反引号 / eval 注入
 *
 * 这里直接测试校验器逻辑（重新实现一份），与 rebuild.js 保持同步。
 * 真正的端到端测试需要跑 MCP server，所以这里只做单元粒度。
 *
 * 注意：如果 rebuild.js 里的校验改了，这里的副本也要同步改。
 */

import assert from 'node:assert/strict'

// 保持与 src/mcp/tools/rebuild.js 中校验逻辑一致
function validateTaskId(taskId) {
  if (
    !taskId ||
    !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(taskId) ||
    taskId === '.' ||
    taskId === '..'
  ) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true }
}

function validateCallExpression(expr) {
  if (!expr) return { ok: true }
  const sanitized = expr.trim()
  if (sanitized.length > 500) return { ok: false, reason: 'too long' }
  if (/[\n\r\u2028\u2029\u0085]/.test(sanitized)) return { ok: false, reason: 'line terminators' }
  if (/[;`]/.test(sanitized) || sanitized.includes('//') || sanitized.includes('/*')) {
    return { ok: false, reason: 'disallowed characters' }
  }
  if (/\b(require|import|eval|Function|process|global|globalThis|exec|spawn|child_process|__proto__|constructor)\b/.test(sanitized)) {
    return { ok: false, reason: 'disallowed identifier' }
  }
  let depth = 0
  for (const ch of sanitized) {
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) return { ok: false, reason: 'unbalanced parens' }
    }
  }
  if (depth !== 0) return { ok: false, reason: 'unbalanced parens' }
  return { ok: true }
}

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`)
    failed++
  }
}

console.log('=== rebuild.js validators ===')

// taskId
test('taskId: rejects empty', () => assert.equal(validateTaskId('').ok, false))
test('taskId: rejects "."', () => assert.equal(validateTaskId('.').ok, false))
test('taskId: rejects ".."', () => assert.equal(validateTaskId('..').ok, false))
test('taskId: rejects ".git" (leading dot)', () => assert.equal(validateTaskId('.git').ok, false))
test('taskId: rejects ".ssh"', () => assert.equal(validateTaskId('.ssh').ok, false))
test('taskId: rejects "../etc"', () => assert.equal(validateTaskId('../etc').ok, false))
test('taskId: rejects "/abs/path"', () => assert.equal(validateTaskId('/abs/path').ok, false))
test('taskId: accepts "task1"', () => assert.equal(validateTaskId('task1').ok, true))
test('taskId: accepts "my-task_2.v1"', () => assert.equal(validateTaskId('my-task_2.v1').ok, true))
test('taskId: accepts "_underscore"', () => assert.equal(validateTaskId('_underscore').ok, true))

// callExpression
test('callExpr: accepts plain call', () => assert.equal(validateCallExpression('window.foo(1)').ok, true))
test('callExpr: accepts nested', () => assert.equal(validateCallExpression('a.b.c(d, e(f))').ok, true))
test('callExpr: rejects semicolon', () => assert.equal(validateCallExpression('foo();bar()').ok, false))
test('callExpr: rejects newline', () => assert.equal(validateCallExpression('foo()\nbar()').ok, false))
test('callExpr: rejects U+2028', () => assert.equal(validateCallExpression('foo()\u2028bar()').ok, false))
test('callExpr: rejects U+2029', () => assert.equal(validateCallExpression('foo()\u2029bar()').ok, false))
test('callExpr: rejects backtick', () => assert.equal(validateCallExpression('`${x}`').ok, false))
test('callExpr: rejects // comment', () => assert.equal(validateCallExpression('foo() // x').ok, false))
test('callExpr: rejects /* comment */', () => assert.equal(validateCallExpression('foo(/*x*/)').ok, false))
test('callExpr: rejects eval', () => assert.equal(validateCallExpression('eval("alert(1)")').ok, false))
test('callExpr: rejects Function', () => assert.equal(validateCallExpression('new Function("x")()').ok, false))
test('callExpr: rejects require', () => assert.equal(validateCallExpression('require("fs")').ok, false))
test('callExpr: rejects process', () => assert.equal(validateCallExpression('process.exit(0)').ok, false))
test('callExpr: rejects globalThis', () => assert.equal(validateCallExpression('globalThis.x').ok, false))
test('callExpr: rejects __proto__', () => assert.equal(validateCallExpression('x.__proto__').ok, false))
test('callExpr: rejects unbalanced paren', () => assert.equal(validateCallExpression('foo((x)').ok, false))
test('callExpr: rejects close-then-open', () => assert.equal(validateCallExpression(')foo(').ok, false))
test('callExpr: rejects too long', () => assert.equal(validateCallExpression('a'.repeat(501)).ok, false))

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
