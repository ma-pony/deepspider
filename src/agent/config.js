/**
 * Agent 配置构建
 * 构建 opencode 配置对象，用于 SDK 注入
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')

/**
 * 构建 opencode 配置对象
 * SDK 内部自动 JSON.stringify 设为 OPENCODE_CONFIG_CONTENT
 *
 * @param {object} userConfig - 用户配置（来自 ~/.deepspider/config/settings.json）
 * @returns {object} opencode 配置对象
 */
export function buildOpencodeConfig(userConfig = {}) {
  const root = PROJECT_ROOT

  return {
    model: userConfig.model || 'anthropic/claude-sonnet-4-5',
    default_agent: 'spider',
    autoupdate: false,

    // MCP：DeepSpider 浏览器工具
    mcp: {
      deepspider: {
        type: 'local',
        command: ['node', path.join(root, 'src/mcp/server.js')],
      },
    },

    // Plugin：DeepSpider 专用插件
    plugin: [path.join(root, 'plugins/deepspider-plugin')],

    // Skills：领域知识
    skills: {
      paths: [path.join(root, 'skills/deepspider')],
    },

    // 权限：内置工具直接用名，MCP 工具用 mcp_<server>_<tool> 格式
    permission: {
      read: 'allow',
      glob: 'allow',
      grep: 'allow',
      bash: 'ask',
      edit: 'ask',
      write: 'ask',
      'mcp_deepspider_*': 'allow',
    },

    // Agent 定义（从 agents/*.md 解析）
    agent: loadAgentDefinitions(path.join(root, 'agents')),

    // Provider（从用户配置合并）
    provider: userConfig.provider || {},
  }
}

/**
 * 从 agents/ 目录加载 Agent 定义
 * 使用 gray-matter 解析 frontmatter + body
 * SDK config.agent 接收已解析的对象（prompt 为纯字符串）
 */
function loadAgentDefinitions(agentsDir) {
  const agents = {}

  if (!fs.existsSync(agentsDir)) return agents

  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith('.md')) continue
    const name = file.replace('.md', '')
    const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8')
    const { data: frontmatter, content: body } = matter(content)
    agents[name] = { ...frontmatter, prompt: body.trim() }
  }

  return agents
}
