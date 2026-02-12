/**
 * deepspider --help
 */

import { getVersion } from '../../config/settings.js';

export function run() {
  console.log(`
deepspider v${getVersion()} - 智能爬虫工程平台

用法:
  deepspider                        启动交互式 Agent
  deepspider <url>                  打开目标网站并启动 Agent
  deepspider config                 管理配置
  deepspider update                 检查更新

选项:
  -v, --version                     显示版本号
  -h, --help                        显示帮助信息
  --debug                           启用调试模式

配置命令:
  deepspider config list            列出所有配置
  deepspider config get <key>       获取配置项
  deepspider config set <key> <val> 设置配置项
  deepspider config reset           重置配置
  deepspider config path            显示配置文件路径

示例:
  deepspider https://example.com    分析目标网站
  deepspider config set apiKey sk-xxx
  deepspider config set model gpt-4o
`.trim());
}
