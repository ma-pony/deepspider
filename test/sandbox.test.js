/**
 * Sandbox 回归测试
 *
 * 覆盖 deep-review 在 src/agent/sandbox.js 上发现的两个关键缺陷：
 *   - F-04 / Correctness-F4: fresh 模式下绝不能动沙箱已有文件
 *   - F-04 (rollback): renameSync 成功 + symlinkSync 失败时必须回滚
 *
 * 用 node:assert，独立的临时 HOME 隔离，不污染用户真实沙箱。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 在 import sandbox.js 之前必须重写 HOME，否则 SANDBOX_ROOT 会绑定到用户真实路径
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-sandbox-test-'))
process.env.HOME = TMP_HOME

const sandbox = await import('../src/agent/sandbox.js')
const { initSandbox, prepareSandbox, getSandboxPaths } = sandbox

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'))
    failed++
  }
}

console.log('=== sandbox.js regression tests ===')
console.log(`tmp HOME: ${TMP_HOME}`)

// ---- T1: fresh 模式不应触碰已存在的沙箱文件 ----
test('fresh mode does not touch existing sandbox files', () => {
  prepareSandbox()
  const paths = getSandboxPaths()
  // 预置一个真实文件，模拟用户跑过 `config set-model` 之后的状态
  const original = '{"model":"test/sentinel"}\n'
  fs.writeFileSync(paths.opencodeJson, original)

  const result = initSandbox('fresh')

  assert.equal(result.mode, 'fresh')
  assert.equal(result.linked.opencodeJson, false)
  assert.equal(result.linked.authJson, false)
  // 关键断言：fresh 模式必须保留原文件，不得改名/删除/创建 .bak
  assert.ok(fs.existsSync(paths.opencodeJson), 'opencode.json should still exist')
  assert.equal(fs.readFileSync(paths.opencodeJson, 'utf-8'), original)
  // 不应该产生备份文件
  const dirEntries = fs.readdirSync(path.dirname(paths.opencodeJson))
  const baks = dirEntries.filter((f) => f.includes('.bak.'))
  assert.equal(baks.length, 0, `unexpected backup files: ${baks.join(', ')}`)
})

// ---- T2: link-all 模式下，已存在的真实文件必须被备份后替换为符号链接 ----
test('link-all mode backs up existing file before symlinking', () => {
  // 重新清理
  const paths = getSandboxPaths()
  for (const p of [paths.opencodeJson, paths.authJson]) {
    try { fs.unlinkSync(p) } catch { /* cleanup */ }
  }
  for (const f of fs.readdirSync(path.dirname(paths.opencodeJson))) {
    if (f.includes('.bak.')) {
      try { fs.unlinkSync(path.join(path.dirname(paths.opencodeJson), f)) } catch { /* cleanup */ }
    }
  }

  // 在沙箱里预置一份"老" opencode.json
  fs.writeFileSync(paths.opencodeJson, '{"old":true}\n')
  // 在 HOME 外造一个"用户原始" opencode.json 作为 symlink 目标
  const userConfigDir = path.join(TMP_HOME, '.config', 'opencode')
  fs.mkdirSync(userConfigDir, { recursive: true })
  const userOpencodeJson = path.join(userConfigDir, 'opencode.json')
  fs.writeFileSync(userOpencodeJson, '{"from":"user"}\n')

  const result = initSandbox('link-all')

  assert.equal(result.linked.opencodeJson, true)
  // 现在沙箱内的 opencode.json 应是软链接，指向用户文件
  const st = fs.lstatSync(paths.opencodeJson)
  assert.ok(st.isSymbolicLink(), 'sandbox opencode.json should be a symlink')
  // realpath 在 macOS 会带 /private 前缀，两侧都解析后再比较
  assert.equal(fs.realpathSync(paths.opencodeJson), fs.realpathSync(userOpencodeJson))
  // 老文件应被备份
  const baks = fs
    .readdirSync(path.dirname(paths.opencodeJson))
    .filter((f) => f.startsWith('opencode.json.bak.'))
  assert.equal(baks.length, 1, 'exactly one backup of the old file')
  assert.equal(
    fs.readFileSync(path.join(path.dirname(paths.opencodeJson), baks[0]), 'utf-8'),
    '{"old":true}\n'
  )
})

// ---- T3: rollback when symlinkSync fails midway ----
test('rollback restores original file when symlink fails', () => {
  const paths = getSandboxPaths()
  // 清理
  for (const p of [paths.opencodeJson, paths.authJson]) {
    try { fs.unlinkSync(p) } catch { /* cleanup */ }
  }
  for (const f of fs.readdirSync(path.dirname(paths.opencodeJson))) {
    if (f.includes('.bak.')) {
      try { fs.unlinkSync(path.join(path.dirname(paths.opencodeJson), f)) } catch { /* cleanup */ }
    }
  }

  // 沙箱里有一份真实老文件
  const original = '{"sentinel":"original"}\n'
  fs.writeFileSync(paths.opencodeJson, original)

  // 把用户的 source 指向一个不存在的路径，让 symlinkSync 仍然成功（symlink 允许悬空），
  // 不太能稳定触发失败。改用另一种构造：让 authJson 的 source 不存在，但目标已经是个 *目录*
  // ——这会让 symlinkSync 抛 EEXIST/EISDIR。
  // 简化做法：直接 monkey-patch fs.symlinkSync 让第二个调用抛错。
  const origSymlink = fs.symlinkSync
  let calls = 0
  fs.symlinkSync = function (src, dst) {
    calls++
    if (calls === 2) {
      throw new Error('synthetic symlink failure')
    }
    return origSymlink.call(this, src, dst)
  }

  // 准备两个用户源文件，让 link-all 触发两次 symlinkSync
  const userConfigDir = path.join(TMP_HOME, '.config', 'opencode')
  const userDataDir = path.join(TMP_HOME, '.local', 'share', 'opencode')
  fs.mkdirSync(userConfigDir, { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  const userOpencodeJson = path.join(userConfigDir, 'opencode.json')
  const userAuthJson = path.join(userDataDir, 'auth.json')
  fs.writeFileSync(userOpencodeJson, '{"from":"user"}\n')
  fs.writeFileSync(userAuthJson, '{"auth":"user"}\n')

  let threw = false
  try {
    initSandbox('link-all')
  } catch (e) {
    threw = true
    assert.match(e.message, /synthetic symlink failure/)
  } finally {
    fs.symlinkSync = origSymlink
  }
  assert.ok(threw, 'initSandbox should propagate the symlink failure')

  // 关键断言：原文件应被还原（renameSync → 备份 → rollback）
  // 注意:测试里第一次 symlink 成功的可能是 authJson 也可能是 opencodeJson，
  // 取决于 targets 顺序（代码里 authJson 在前）。无论如何，opencode.json 老内容必须被回滚。
  assert.ok(fs.existsSync(paths.opencodeJson), 'opencode.json should be restored after rollback')
  // 它应该是个文件而不是软链接
  const st = fs.lstatSync(paths.opencodeJson)
  assert.ok(!st.isSymbolicLink(), 'rollback should leave a regular file, not a symlink')
  assert.equal(fs.readFileSync(paths.opencodeJson, 'utf-8'), original)
})

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
