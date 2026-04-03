/**
 * Agent 入口
 * 启动 opencode server + 连接 + 创建会话
 */

import path from 'path'
import { homedir } from 'os'
import { createOpencode } from '@opencode-ai/sdk'
import { buildOpencodeConfig } from './config.js'
import { loadConfig } from '../config/settings.js'
import { ensureDir } from '../config/paths.js'

/**
 * 启动 DeepSpider Agent
 *
 * @param {object} options - CLI 选项
 * @param {string} [options.model] - 覆盖 LLM 模型
 * @param {boolean} [options.verbose] - 详细日志
 * @returns {Promise<{client, server}>}
 */
export async function startAgent(options = {}) {
  // 读取用户配置
  const fileConfig = loadConfig()
  const userConfig = { ...fileConfig }

  // CLI --model 覆盖
  if (options.model) {
    userConfig.model = options.model
  }

  const config = buildOpencodeConfig(userConfig)

  if (options.verbose) {
    console.error('[agent] config:', JSON.stringify(config, null, 2))
  }

  // 隔离环境变量
  process.env.OPENCODE_DISABLE_PROJECT_CONFIG = 'true'

  const dbPath = path.join(homedir(), '.deepspider', 'db')
  ensureDir(dbPath)
  process.env.OPENCODE_DB = dbPath

  // 启动 opencode server（独立进程）
  // SDK 接收 JS 对象，内部自动 JSON.stringify 设为 OPENCODE_CONFIG_CONTENT
  if (options.verbose) {
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
