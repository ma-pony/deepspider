/**
 * deepspider --help
 */

import { getVersion } from './version.js';

export function run() {
  console.log(`
deepspider v${getVersion()} - 智能爬虫工程平台

用法:
  deepspider agent                   启动独立 Agent（opencode TUI）
  deepspider agent --model <id>      覆盖 LLM 模型
  deepspider agent --verbose         详细日志
  deepspider mcp                     启动 MCP Server（供 Claude Code 连接）
  deepspider fetch <url>             快速 HTTP 请求（轻量级）
  deepspider config                  管理沙箱 opencode 配置
  deepspider update                  检查更新

选项:
  -v, --version                      显示版本号
  -h, --help                         显示帮助信息

配置命令（沙箱 ~/.deepspider/opencode-sandbox/）:
  deepspider config list             查看沙箱 opencode.json
  deepspider config path             打印沙箱根目录
  deepspider config set-model <m>    设置模型，例如 anthropic/claude-sonnet-4-5
  deepspider config auth login       登录 provider（透传 opencode auth）
  deepspider config auth list        查看已登录的 provider
  deepspider config reset            清理沙箱，下次启动触发初始化向导

示例:
  deepspider agent
  deepspider agent --model deepseek/deepseek-chat
  deepspider config auth login
  deepspider config set-model anthropic/claude-opus-4-6
  deepspider fetch https://httpbin.org/get
`.trim());
}
