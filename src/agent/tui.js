/**
 * TUI 包装层
 * 最小包装：spawn `opencode attach <url>` 继承 stdio，让官方 TUI 接管
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')
const OPENCODE_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/opencode')

/**
 * 启动 TUI：attach 到已启动的 opencode server
 *
 * 返回 exit code。不调用 process.exit —— 调用方负责退出+清理，这样
 * bin/cli.js 的 SIGINT handler 能先关掉 server 再退出。
 *
 * @param {object} server - opencode server 句柄（server.url）
 * @param {object} options - 选项
 * @param {boolean} [options.verbose]
 * @returns {Promise<number>} 子进程 exit code
 */
export async function startTUI(server, options = {}) {
  if (!server?.url) {
    throw new Error('server.url missing, cannot attach TUI')
  }

  if (options.verbose) {
    console.error(`[tui] attaching to ${server.url}`)
  }

  const child = spawn(OPENCODE_BIN, ['attach', server.url], {
    stdio: 'inherit',
    env: process.env,
  })

  // 等待 TUI 进程退出
  const exitCode = await new Promise((resolve, reject) => {
    child.on('exit', (code) => resolve(code ?? 0))
    child.on('error', reject)
  })

  return exitCode
}
