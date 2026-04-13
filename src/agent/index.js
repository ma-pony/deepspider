/**
 * Agent 入口
 * 启动 opencode server + 连接 + 创建会话
 *
 * 关键顺序：
 *   1. 在 applySandboxEnv 之前 detectExistingOpencode（避免 XDG_* 被自己覆盖）
 *   2. 首次运行跑向导（三选一：link-all / link-auth / fresh）
 *   3. applySandboxEnv 重定向 XDG
 *   4. createOpencode 启动 server
 */

import readline from 'readline'
import { createOpencode } from '@opencode-ai/sdk'
import { buildOpencodeConfig } from './config.js'
import {
  applySandboxEnv,
  detectExistingOpencode,
  initSandbox,
  isSandboxInitialized,
  getSandboxPaths,
} from './sandbox.js'

const DEFAULT_INIT_CHOICE = '1'

/**
 * 启动 DeepSpider Agent
 *
 * @param {object} options
 * @param {string} [options.model] - 覆盖 LLM 模型
 * @param {boolean} [options.verbose]
 * @returns {Promise<{client, server}>}
 */
export async function startAgent(options = {}) {
  // 1. 首次运行向导（必须在 applySandboxEnv 之前调用 detect）
  if (!isSandboxInitialized()) {
    const existing = detectExistingOpencode()
    const mode = await promptInitMode(existing)
    const result = initSandbox(mode)
    if (options.verbose) {
      console.error('[agent] sandbox initialized:', result)
    }
    printInitSummary(result, existing)
  }

  // 2. 重定向 XDG 到沙箱
  applySandboxEnv()

  if (options.verbose) {
    console.error('[agent] sandbox root:', getSandboxPaths().root)
  }

  // 3. 构建注入配置（不含 provider/apiKey，那些由沙箱 opencode.json 负责）
  const config = buildOpencodeConfig({ model: options.model })

  if (options.verbose) {
    console.error('[agent] inject config:', JSON.stringify(config, null, 2))
    console.error('[agent] starting opencode server...')
  }

  const { client, server } = await createOpencode({
    config,
    timeout: 10000,
  })

  if (options.verbose) {
    console.error('[agent] opencode server started')
  }

  return { client, server }
}

/**
 * 首次运行向导：询问如何初始化沙箱
 */
async function promptInitMode(existing) {
  const hasAny = existing.opencodeJson || existing.authJson
  if (!hasAny) {
    console.error('[deepspider] 未检测到已有 opencode 配置，将创建空沙箱。')
    console.error('[deepspider] 之后可以运行：deepspider config auth login  登录模型 provider。')
    return 'fresh'
  }

  console.error('')
  console.error('检测到系统上已有 opencode 配置：')
  if (existing.opencodeJson) console.error(`  config: ${existing.opencodeJson}`)
  if (existing.authJson) console.error(`  auth:   ${existing.authJson}`)
  console.error('')
  console.error('DeepSpider 使用独立的沙箱运行 opencode。请选择初始化方式：')
  console.error('  [1] 软链接 opencode.json + auth.json（复用全部配置，推荐）')
  if (existing.authJson) {
    console.error('  [2] 只软链接 auth.json（复用登录凭据，配置独立）')
  } else {
    console.error('  [2] 只软链接 auth.json  (未检测到 auth.json，不可用)')
  }
  console.error('  [3] 创建空沙箱，之后手动配置')
  console.error('')

  const answer = await ask('选择 [1/2/3]（默认 1）: ')
  const choice = (answer || DEFAULT_INIT_CHOICE).trim()

  if (choice === '3') return 'fresh'
  if (choice === '2') {
    if (!existing.authJson) {
      console.error('[deepspider] 未检测到 auth.json，降级为空沙箱。')
      return 'fresh'
    }
    return 'link-auth'
  }
  // choice === '1' 或其他：软链接全部；existing.opencodeJson 可能为 null，
  // initSandbox 会自行判断是否实际建链。
  return 'link-all'
}

function printInitSummary(result, existing) {
  console.error(`[deepspider] 沙箱就绪：${result.sandbox}`)
  if (result.linked.opencodeJson) {
    console.error(`[deepspider]   ↳ opencode.json → ${existing.opencodeJson}`)
  }
  if (result.linked.authJson) {
    console.error(`[deepspider]   ↳ auth.json     → ${existing.authJson}`)
  }
  if (!result.linked.opencodeJson && !result.linked.authJson) {
    console.error('[deepspider]   ↳ 空沙箱（未软链接任何现有配置）')
  }
  console.error('')
}

function ask(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
    // Ctrl+C / Ctrl+D 期间 readline 默认会 hang 住整个进程（stdin 仍保持 raw 打开），
    // 显式处理 SIGINT 和 close 事件，让向导能被干净中断。
    const onSigint = () => {
      rl.close()
      // 130 = 128 + SIGINT，和 shell 约定一致
      reject(Object.assign(new Error('用户取消初始化向导 (SIGINT)'), { code: 'E_WIZARD_CANCELLED', exitCode: 130 }))
    }
    rl.once('SIGINT', onSigint)
    rl.question(question, (answer) => {
      rl.removeListener('SIGINT', onSigint)
      rl.close()
      resolve(answer)
    })
  })
}
